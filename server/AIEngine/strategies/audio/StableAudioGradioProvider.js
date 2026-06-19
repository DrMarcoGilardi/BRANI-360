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
import { AudioProvider } from './AudioProvider.js';
import { Utils } from '../../../utils/Utils.js';

const execAsync = promisify(exec);

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * EXAMPLE STRATEGY IMPLEMENTATION
 * StableAudioGradioProvider
 * Handles generation and transcodes of audio via Gradio API connections to a Stable Audio Open instance.
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * AudioProvider <|-- StableAudioGradioProvider
 * class StableAudioGradioProvider{
 * +init() Promise~void~
 * +generate(task, executionContext) Promise~Object~
 * }
 * ```
 */
export class StableAudioGradioProvider extends AudioProvider {
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
        this._internalDictPath = path.join(__dirname, 'prompts', 'AmbientSettings.json');

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
                if(this.gradioClient) 
                    this.logger.log(`[AudioProvider] Gradio Engine linked at ${this.api}.`);
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
    async init(){
        this.ambientsSettings = await Utils.loadDictionary(this._internalDictPath, this.logger);
        this.logger.log(`[AudioProvider] Strategy ready. Dictionary entries: ${Object.keys(this.ambientsSettings.ambients).length}`);
        
        // Pre-warm the connection
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
        
        // Load Definitions for Audio
        const { type, envType, regenOpts } = task;
        
        let steps = 75; // Default for objects
        let noiseLevel = 0.1;
        // 1. Calculate Steps based on Intent
        if (type === 'ambient' && this.ambientsSettings.ambients) {
            const ambientParams = this.ambientsSettings.ambients[(envType || "generic").toLowerCase()]?.params;
            steps = ambientParams?.steps || 100;
        }

        // 2. Translate Feedback Rating into Noise Floor
        if (regenOpts) {
            if (regenOpts.fromScratch) {
                noiseLevel = 0.1;
            } else if (regenOpts.rating !== undefined) {
                // Higher rating = request for more intensive change = higher noise added
                // Math: Translate 1-10 magnitude to 0.1 - 1.0 Gradio noise (Aligns with Tweak -> Nuke)
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
        const { signal, socket, progressCallback } = executionContext;
        const { prompt, type, id: taskId, nodeId, locationContext, regenOpts, navEpoch, envType } = task;

        const { steps, noiseLevel } = this._calibrateTask(task);
        
        return new Promise(async (resolve) => {
            let submission = null;
            const startTime = Date.now();

            const timeoutId = setTimeout(() => {
                this.logger.warn(`[AudioProvider] Task ${taskId} timed out. Force-releasing.`);
                if (submission) submission.cancel().catch(() => {});
                resolve({ buffer: null, duration: 0 });
            }, 180000);

            try {
                await this._getGradio();
                const client =this.gradioClient;
                if (!client) {
                    clearTimeout(timeoutId);
                    return resolve({ buffer: null, duration: 0 });
                }

                // 1. SMART PROMPTING LOGIC
                let qualityPrompt = "";
                let negativePrompt = "";
                let CFGScore = 7;
                let CFGRescale = 0;
                let sigmaMin = 0.03;
                let sigmaMax = 500;
                let cleanPrompt = prompt.replace(/[a-zA-Z0-9]{15,}/g, '')
                    .replace(/_/g, ' ').replace(/\./g, '')
                    .replace(/[^a-zA-Z0-9\s-,]/g, ' ').replace(/\s+/g, ' ')
                    .trim().toLowerCase() || "sound effect";

                if (type.startsWith('object')) {
                    let specificModifiers = "";
                    if (type === 'object_human') {
                        CFGScore = 4;
                        const hasVoices = /walla|chatter|speech|talk|babble|efforts/i.test(cleanPrompt);
                        if (hasVoices) CFGRescale = 0.5;
                    } else if (type === 'object_organic') {
                        CFGScore = 5;
                        specificModifiers = "natural sound, distinct intermittent textures, professional Foley sound effect";
                    } else {
                        CFGScore = 7;
                        CFGRescale = 0.5;
                        specificModifiers = "professional Foley sound effect";
                    }

                    qualityPrompt = `clear, realistic, authentic field recording, ${cleanPrompt}, ${locationContext}, ${specificModifiers}, seamless loop, cinematic SFX, high quality, 44.1kHz`;
                    
                    const baseNegative = "music, melody, rhythm, synth, instrument, static, distorted, low quality, silence, mute, empty";
                    negativePrompt = (type === 'object_organic' || type === 'object_human')
                        ? `${baseNegative}, engine, motor, machine, mechanical, rain, broadband noise`
                        : baseNegative;
                } else {
                    // Ambient logic using Research Dictionary
                    const lowerEnv = (envType || "generic").toLowerCase();
                    const ambientParams = this.ambientsSettings.ambients[lowerEnv] || { params: {}, prompts: {} };
                    qualityPrompt = `${cleanPrompt}, ${ambientParams.prompts?.positive_modifiers || ""}, ${this.ambientsSettings.base_positive_prompt}`;
                    negativePrompt = `${this.ambientsSettings.base_negative_prompt}, ${ambientParams.prompts?.negative_modifiers || ""}`;
                    CFGScore = ambientParams.params?.CFGScore;
                    CFGRescale = ambientParams.params?.CFGRescale;
                    sigmaMin = ambientParams.params?.sigmaMin;
                    sigmaMax = ambientParams.params?.sigmaMax;
                    this.logger.log(`[Audio Settings] [${envType},${CFGScore},${CFGRescale},${sigmaMin},${sigmaMax}]`)
                }

                // Audio-to-Audio (Regen) injection
                if (regenOpts?.feedback) {
                    negativePrompt = `${regenOpts.feedback}, ${negativePrompt}`;
                }

                let uploadPath = regenOpts?.path || null;
                let tempWavPath = null;

                if (uploadPath) {
                    const ext = path.extname(uploadPath).toLowerCase();
                    const validFormats = ['.wav', '.ogg', '.mp3', '.webm'];

                    // 1. Whitelist Validation
                    if (!validFormats.includes(ext)) {
                        this.logger.error(`[AudioProvider] Invalid upload format rejected: ${ext}`);
                        uploadPath = null; 
                    } 
                    // 2. Intercept and Transcode valid compressed formats
                    else if (ext !== '.wav') {
                        tempWavPath = `${uploadPath}_init_${Date.now()}.wav`; 
                        
                        try {
                            this.logger.log(`[AudioProvider] Transcoding ${ext} to WAV for PyTorch...`);
                            // Force a strict 44.1kHz stereo WAV
                            await execAsync(`ffmpeg -i "${uploadPath}" -ar 44100 -ac 2 "${tempWavPath}" -y`);
                            uploadPath = tempWavPath; // Swap the path to the newly created WAV
                        } catch (e) {
                            this.logger.error(`[AudioProvider] FFmpeg init conversion failed: ${e.message}`);
                            uploadPath = null; // Prevent sending a broken path to Gradio
                        }
                    }
                }
                
                this.logger.log(`[AudioProvider] Submitting ${type.toUpperCase()}: ${taskId} (CFG: ${CFGScore})`);
                
                submission = client.submit("/generate", [
                    qualityPrompt, 
                    negativePrompt, 
                    0, 
                    48, 
                    CFGScore, 
                    steps, 
                    0, 
                    -1, 
                    "dpmpp-3m-sde", 
                    sigmaMin, 
                    sigmaMax, 
                    CFGRescale, 
                    !!regenOpts?.useInit, 
                    uploadPath ? handle_file(uploadPath) : null, 
                    regenOpts?.noiseLevel || 0.1
                ]);

                let wavBuffer = null;

                try {
                    for await (const msg of submission) {
                        // User navigation abort check
                        if (signal?.aborted && type.startsWith('object')) {
                            submission.cancel().catch(() => {});
                            break; 
                        }

                        // 1. Capture the Data
                        if (msg.type === "data") {
                            const audioPath = msg.data?.[0]?.path || msg.data?.[0];
                            if (audioPath) wavBuffer = await fs.readFile(audioPath);
                        }

                        // 2. Progress Extraction
                        let currentProgress = -1;

                        // Check the status object for tracking arrays
                        if (msg.type === "status") {
                            const pData = msg.progress_data?.[0];
                            if (pData) {
                                // Sometimes Gradio sends a direct decimal
                                if (typeof pData.progress === 'number') {
                                    currentProgress = pData.progress;
                                } 
                                // Most of the time, Gradio tracks iterations (e.g., Step 10 of 75)
                                else if (typeof pData.index === 'number' && typeof pData.length === 'number' && pData.length > 0) {
                                    currentProgress = pData.index / pData.length;
                                }
                            }
                        }

                        // Fallback: Check if the description string contains a fraction (e.g., "45/100")
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

                        // Forces Node.js to resolve the Promise
                        if (msg.type === "status" && msg.stage === "complete") {
                            break; 
                        }
                    }
                } catch (streamError) {
                    this.logger.error(`[AudioProvider] Stream Error Shielded: ${streamError.message}`);
                }

                clearTimeout(timeoutId);
                
                if (tempWavPath) {
                    fs.unlink(tempWavPath).catch(() => {});
                }

                if (wavBuffer) {
                    resolve({ buffer: wavBuffer, duration: ((Date.now() - startTime) / 1000).toFixed(2) });
                } else {
                    resolve({ buffer: null, duration: 0 });
                }
            } catch (e) {
                clearTimeout(timeoutId);
                if (tempWavPath) fs.unlink(tempWavPath).catch(() => {})
                this.logger.error(`[AudioProvider Fatal] ${e.message}`);
                resolve({ buffer: null, duration: 0 });
            }
        });
    }
}