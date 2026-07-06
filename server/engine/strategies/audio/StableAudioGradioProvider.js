/*
 * ABBA-360: An Agnostic Browser-Based Research Sandbox Architecture for AI Audio Generation on Networks of 360° Images
 * Copyright (C) 2026 Dr Marco Gilardi, University of the West of Scotland.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 * 
 * -------------------------------------------------------------------------
 * COMMERCIAL LICENSING
 * ABBA-360 is dual-licensed. The above AGPLv3 license applies to open-source 
 * and academic research use. If you wish to integrate this software into a 
 * closed-source or commercial application, you must obtain a proprietary 
 * commercial license. 
 * 
 * Please contact Marco.Gilardi@uws.ac.uk for commercial licensing details.
 * -------------------------------------------------------------------------
 */

import { Client, handle_file } from "@gradio/client";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

import { BaseAudioProvider } from './BaseAudioProvider.js';
import { Utils } from '../../../utilities/Utils.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * EXAMPLE STRATEGY IMPLEMENTATION  
 * Handles generation and transcodes of audio via Gradio API connections to a Stable Audio Open instance.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * BaseAudioProvider <|-- StableAudioGradioProvider
 * class StableAudioGradioProvider{
 * +init() Promise~void~
 * +generate(task, executionContext) Promise~Object~
 * }
 * ```
 * 
 * @class
 */
export class StableAudioGradioProvider extends BaseAudioProvider {
    /**
     * @constructor
     * @param {Object} config - System configuration containing STABLE_AUDIO_API URL.
     * @param {Object} logger - System Logger.
     */
    constructor(config, logger) {
        super();
        this.api = config.STABLE_AUDIO_API;
        this.logger = logger || console;
        this.gradioClient = null;
        this.ambientsSettings = {};
        this._internalAmbDictPath = path.join(__dirname, '../../prompts', 'AmbientSettings.json');
        this.objectsSettings = {};
        this._internalObjDictPath = path.join(__dirname, '../../prompts', 'ObjectSettings.json');

        if (!this.api) {
            this.logger.error('[AudioProvider] Missing STABLE_AUDIO_API.');
        }
    }

    /**
     * @async
     * @method _getGradio
     * @memberof StableAudioGradioProvider
     * @description Instantiates or reuses the @gradio/client connection.
     * @returns {Promise<void>}
     * @private
     */
    async _getGradio() {
        if (!this.gradioClient) {
            try {
                this.logger.log(`[AudioProvider] Linking to Gradio Engine at ${this.api}...`);
                this.gradioClient = await Client.connect(this.api, { events: ["data", "status"] });
                if (this.gradioClient)
                    this.logger.log(`[AudioProvider] Gradio Engine linked at ${this.api}`);
            } catch (e) {
                this.logger.error(`[AudioProvider] Connection Failed: ${e.message}`);
                this.gradioClient = null;
            }
        }
    }

    /**
     * @async
     * @method init
     * @memberof StableAudioGradioProvider
     * @description Pre-loads the prompt tuning dictionary and pre-warms the Gradio API connection.
     * @returns {Promise<void>}
     */
    async init() {
        this.ambientsSettings = await Utils.loadAmbientsDictionary(this._internalAmbDictPath, this.logger);
        this.logger.log(`[AudioProvider] Strategy ready. Ambients dictionary entries: ${Object.keys(this.ambientsSettings.ambients).length}`);

        this.objectsSettings = await Utils.loadObjectsDictionary(this._internalObjDictPath, this.logger);
        this.logger.log(`[AudioProvider] Strategy ready. Objects dictionary entries: ${Object.keys(this.objectsSettings.objects).length}`);

        await this._getGradio();
    }

    /**
     * @method _calibrateTask
     * @memberof StableAudioGradioProvider
     * @description Translates generic AI Engine intents into model-specific diffusion parameters (steps, noise levels).
     * @param {Object} task - The task payload.
     * @returns {{steps: number, noiseLevel: number}} Calibrated generation parameters.
     * @private
     */
    _calibrateTask(task) {
        const { type, envType, regenOpts } = task;

        let steps = 75;
        let noiseLevel = 0.1;
        if (type === 'ambient' && this.ambientsSettings.ambients) {
            const ambientParams = this.ambientsSettings.ambients[(envType || "generic").toLowerCase()]?.params;
            steps = ambientParams?.steps || 100;
        }

        if (regenOpts) {
            if (regenOpts.fromScratch) {
                noiseLevel = 0.1;
            } else if (regenOpts.rating !== undefined) {
                noiseLevel = Math.max(0.1, regenOpts.rating / 10);
            }
        }

        return { steps, noiseLevel };
    }

    /**
     * @async
     * @method generate
     * @memberof StableAudioGradioProvider
     * @description Executes the generation cycle via Gradio API, handling prompt formulation, audio-to-audio feedback transcodes, and socket progress callbacks.
     * @param {Object} task - Audio generation intent parameters.
     * @param {Object} executionContext - Context containing abort signals, sockets, and callbacks.
     * @returns {Promise<{buffer: Buffer|null, duration: number|string}>} The generated audio buffer and tracking duration.
     */
    async generate(task, executionContext) {
        const { signal, progressCallback } = executionContext;
        const { prompt, type, id: taskId, locationContext, regenOpts, envType } = task;
        const startTime = Date.now();

        let submission = null;
        let tempWavPath = null;
        let timeoutId = null;

        try {
            await this._getGradio();
            if (!this.gradioClient) {
                return { buffer: null, duration: 0 };
            }

            const promptParams = await this._assemblePrompt(prompt, type, envType, locationContext);

            const { tempWavPath: wavPath, ...regenParams } = await this._regParams(regenOpts, promptParams.negativePrompt);
            tempWavPath = wavPath;

            const finalParams = { ...promptParams, ...regenParams };

            console.log(`[AudioProvider] Submitting ${type.toUpperCase()}:`, [
                finalParams.positivePrompt,
                finalParams.negativePrompt,
                0,
                48,
                finalParams.CFGScore,
                finalParams.requestedSteps,
                0,
                -1,
                "dpmpp-3m-sde",
                finalParams.sigmaMin,
                finalParams.sigmaMax,
                finalParams.CFGRescale,
                !!regenOpts?.useInit,
                finalParams.uploadPath ? handle_file(finalParams.uploadPath) : null,
                (regenOpts ? Math.max(0.1, regenOpts.rating / 10) : .1)
            ]);

            submission = this.gradioClient.submit("/generate", [
                finalParams.positivePrompt,
                finalParams.negativePrompt,
                0,
                48,
                finalParams.CFGScore,
                finalParams.requestedSteps,
                0,
                -1,
                "dpmpp-3m-sde",
                finalParams.sigmaMin,
                finalParams.sigmaMax,
                finalParams.CFGRescale,
                !!regenOpts?.useInit,
                finalParams.uploadPath ? handle_file(finalParams.uploadPath) : null,
                (regenOpts ? Math.max(0.1, regenOpts.rating / 10) : .1)
            ]);

            const processAudio = this._genProgress(submission, signal, type, progressCallback);

            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    if (submission) submission.cancel().catch(() => { });
                    reject(new Error("TASK_TIMEOUT"));
                }, 180000);
            });

            const wavBuffer = await Promise.race([processAudio, timeoutPromise]);

            return {
                buffer: wavBuffer || null,
                duration: wavBuffer ? ((Date.now() - startTime) / 1000).toFixed(2) : 0
            };

        } catch (e) {
            if (e.message === "TASK_TIMEOUT") {
                this.logger.warn(`[AudioProvider] Task ${taskId} timed out. Force-releasing.`);
            } else {
                this.logger.error(`[AudioProvider Fatal] ${e.message}`);
            }
            return { buffer: null, duration: 0 };

        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            if (tempWavPath) fs.unlink(tempWavPath).catch(() => { });
        }
    }

    async _assemblePrompt(prompt, type, envType, locationContext) {
        let positivePrompt = "";
        let negativePrompt = "";

        let cleanPrompt = prompt.replace(/[a-zA-Z0-9]{15,}/g, '')
            .replace(/_/g, ' ').replace(/\./g, '')
            .replace(/[^a-zA-Z0-9\s-,]/g, ' ').replace(/\s+/g, ' ')
            .trim().toLowerCase() || "sound effect";

        let stabeAudioParams = {
        };

        if (type.startsWith('object')) {
            const lowerObj = (type || "generic").toLowerCase();
            stabeAudioParams = this.objectsSettings.objects[lowerObj] || { params: {}, prompts: {} };
            positivePrompt = `${cleanPrompt}, ${stabeAudioParams.prompts?.positive_modifiers || ""}, ${this.objectsSettings.base_positive_prompt} `;
            negativePrompt = `${this.objectsSettings.base_negative_prompt}, ${stabeAudioParams.prompts?.negative_modifiers || ""} `;
        } else {
            const lowerEnv = (envType || "generic").toLowerCase();
            stabeAudioParams = this.ambientsSettings.ambients[lowerEnv] || { params: {}, prompts: {} };
            positivePrompt = `${cleanPrompt}, ${stabeAudioParams.prompts?.positive_modifiers || ""}, ${this.ambientsSettings.base_positive_prompt} `;
            negativePrompt = `${this.ambientsSettings.base_negative_prompt}, ${stabeAudioParams.prompts?.negative_modifiers || ""} `;
        }

        return {
            "positivePrompt": positivePrompt,
            "negativePrompt": negativePrompt,
            ...stabeAudioParams?.params
        }
    }

    async _regParams(regenOpts, negativePrompt) {
        let tempWavPath = null;
        if (regenOpts?.feedback) {
            negativePrompt = `${regenOpts.feedback}, ${negativePrompt} `;
        }

        let uploadPath = regenOpts?.path || null;

        if (uploadPath) {
            const ext = path.extname(uploadPath).toLowerCase();
            const validFormats = ['.wav', '.ogg', '.mp3', '.webm'];

            if (!validFormats.includes(ext)) {
                this.logger.error(`[AudioProvider] Invalid upload format rejected: ${ext} `);
                uploadPath = null;
            }
            else if (ext !== '.wav') {
                tempWavPath = `${uploadPath}_init_${Date.now()}.wav`;

                try {
                    this.logger.log(`[AudioProvider] Transcoding ${ext} to WAV for PyTorch...`);
                    await execAsync(`ffmpeg -i "${uploadPath}" -ar 44100 -ac 2 "${tempWavPath}" -y`);
                    uploadPath = tempWavPath;
                } catch (e) {
                    this.logger.error(`[AudioProvider] FFmpeg init conversion failed: ${e.message}`);
                    uploadPath = null;
                }
            }
        }

        return {
            "negativePrompt": negativePrompt,
            "uploadPath": uploadPath,
            "tempWavPath": tempWavPath
        };
    }

    async _genProgress(submission, signal, type, progressCallback) {
        let wavBuffer = null
        try {
            for await (const msg of submission) {
                if (signal?.aborted && type.startsWith('object')) {
                    submission.cancel().catch(() => { });
                    break;
                }
                if (msg.type === "data") {
                    const audioPath = msg.data?.[0]?.path || msg.data?.[0];
                    if (audioPath) wavBuffer = await fs.readFile(audioPath);
                }
                let currentProgress = -1;
                if (msg.type === "status") {
                    const pData = msg.progress_data?.[0];
                    if (pData) {
                        if (typeof pData.progress === 'number') {
                            currentProgress = pData.progress;
                        }
                        else if (typeof pData.index === 'number' && typeof pData.length === 'number' && pData.length > 0) {
                            currentProgress = pData.index / pData.length;
                        }
                    }
                }
                if (currentProgress < 0 && (msg.desc || msg.stage)) {
                    const text = msg.desc || msg.stage;
                    const m = text.match(/(\d+)\/(\d+)/);
                    if (m && parseInt(m[2]) > 0) {
                        currentProgress = parseInt(m[1]) / parseInt(m[2]);
                    }
                }
                if (currentProgress >= 0) {
                    if (progressCallback) progressCallback(currentProgress);
                    else if (socket) {
                        socket.emit('pipeline_progress', {
                            id: taskId,
                            stage: 'audio processing',
                            progress: currentProgress,
                            nodeId,
                            navEpoch,
                            taskData: task
                        });
                    }
                }
                if (msg.type === "status" && msg.stage === "complete") {
                    break;
                }
            }
        } catch (streamError) {
            this.logger.error(`[AudioProvider] Stream Error Shielded: ${streamError.message}`);
        }
        return wavBuffer;
    }
}