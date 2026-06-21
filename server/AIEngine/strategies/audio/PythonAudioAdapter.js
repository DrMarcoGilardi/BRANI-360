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

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { BaseAudioProvider } from '../../BaseAudioProvider.js';

/**
 * EXAMPLE STRATEGY IMPLEMENTATION  
 * Delegate strategy for producing audio by invoking an external Python generation script (e.g., custom PyTorch inferencing).
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * BaseAudioProvider <|-- PythonAudioProvider
 * class PythonAudioProvider{
 * +init() Promise~void~
 * +generate(task, contextHooks) Promise~Object~
 * }
 * ```
 * @class 
 */
export class PythonAudioProvider extends BaseAudioProvider {
    /**
     * @constructor
     * @param {Object} config - System configuration containing PYTHON_EXEC and PYTHON_AUDIO_SCRIPT.
     * @param {Object} logger - System Logger.
     */
    constructor(config, logger) {
        super();
        this.config = config;
        this.logger = logger || console;

        this.pythonExec = this.config.PYTHON_EXEC;
        this.scriptPath = this.config.PYTHON_AUDIO_SCRIPT;
    }

    /**
     * @async
     * @method init
     * @memberof PythonAudioProvider
     * @description Validates configuration variables upon system start.
     * @returns {Promise<void>}
     */
    async init() {
        if (this.scriptPath || this.scriptPath === "" || this.scriptPath === " ")
            this.logger.log(`[PYTHON AUDIO ADAPTER] Initialized using script: ${this.scriptPath}`);
        else
            this.logger.error(new Error('[PYTHON AUDIO ADAPTER] Audio generation aborted PYTHON_AUDIO_SCRIPT not set in .env.'));
    }

    /**
     * @async
     * @method generate
     * @memberof PythonAudioProvider
     * @description Offloads the audio task to a Python subprocess, handling the retrieval of the generated wav file.
     * @param {Object} task - Execution instructions/intent.
     * @param {Object} [contextHooks={}] - Optional object containing abort signals, sockets, and progress callbacks.
     * @returns {Promise<{buffer: Buffer|null, duration: number|string}>} Generated audio data buffer and performance timing.
     */
    async generate(task, contextHooks = {}) {
        const { signal, socket, progressCallback } = contextHooks;
        const startTime = Date.now();

        const tempAudioName = `audio_out_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`;
        const tempAudioPath = path.join(os.tmpdir(), tempAudioName);

        try {
            const args = [
                this.scriptPath,
                '--task', JSON.stringify(task),
                '--output', tempAudioPath
            ];

            await this._executePython(args, signal, progressCallback, socket, task);

            const audioBuffer = await fs.readFile(tempAudioPath);

            return {
                buffer: audioBuffer,
                duration: ((Date.now() - startTime) / 1000).toFixed(2)
            };

        } catch (error) {
            this.logger.error(`[PythonAudioProvider] Generation failed for ${task.id}: ${error.message}`);
            return { buffer: null, duration: 0 };
        } finally {
            await fs.unlink(tempAudioPath).catch(() => { });
        }
    }

    /**
     * @method _executePython
     * @memberof PythonAudioProvider
     * @description Wraps child process execution in a Promise, routing stdout regex matches to progress callbacks and monitoring for abort signals.
     * @param {Array<string>} args - Command line arguments for Python execution.
     * @param {AbortSignal} signal - System interruption hook.
     * @param {Function} progressCallback - Local progress tracking callback.
     * @param {Object} socket - Remote websocket tracking connection.
     * @param {Object} task - The source instruction context.
     * @returns {Promise<void>} Resolves when the script exits successfully.
     * @private
     */
    _executePython(args, signal, progressCallback, socket, task) {
        return new Promise((resolve, reject) => {
            if (this.pythonExec || this.pythonExec === "" || this.pythonExec === " ") {
                const process = spawn(this.pythonExec, args);
                let stderrData = '';
            } else { reject(new Error('[PYTHON AUDIO ADAPTER] Audio generation aborted PYTHON_EXEC not set in .env.')); }

            if (signal) {
                signal.addEventListener('abort', () => {
                    process.kill('SIGTERM');
                    reject(new Error('[PYTHON AUDIO ADAPTER] Audio generation aborted via user navigation.'));
                });
            }

            process.stdout.on('data', (data) => {
                const output = data.toString();

                // Parse fractional progress like "PROGRESS: 5/50" printed by Python
                const match = output.match(/PROGRESS:\s*(\d+)\/(\d+)/);
                if (match) {
                    const currentProgress = parseInt(match[1]) / parseInt(match[2]);

                    if (progressCallback) {
                        progressCallback(currentProgress);
                    } else if (socket) {
                        socket.emit('pipeline_progress', {
                            id: task.id,
                            stage: 'audio processing',
                            progress: currentProgress,
                            nodeId: task.nodeId,
                            navEpoch: task.navEpoch,
                            taskData: task
                        });
                    }
                }
            });

            process.stderr.on('data', (data) => { stderrData += data.toString(); });

            process.on('close', (code) => {
                if (code === null) return;
                if (code !== 0) return reject(new Error(`Exit code ${code}: ${stderrData}`));
                resolve();
            });
        });
    }
}