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
import { VisionProvider } from '../../VisionProvider.js';

/**
 * @Class PythonVisionProvider
 * @description EXAMPLE STRATEGY IMPLEMENTATION Interacts with external Python scripts (e.g., custom models or OpenCV pipelines) to generate sonic intents from visual buffers.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * VisionProvider <|-- PythonVisionProvider
 * class PythonVisionProvider{
 * +init() Promise~void~
 * +analyse(buffer, contextString, options) Promise~Object~
 * }
 * ```
 * @class
 */
export class PythonVisionProvider extends VisionProvider {
    /**
     * @constructor
     * @param {Object} config - System configuration containing PYTHON_EXEC and PYTHON_VISION_SCRIPT paths.
     * @param {Object} logger - System Logger.
     */
    constructor(config, logger) {
        super();
        this.config = config;
        this.logger = logger || console;

        // Map these in your environment/config
        this.pythonExec = this.config.PYTHON_EXEC;
        this.scriptPath = this.config.PYTHON_VISION_SCRIPT;
    }

    /**
     * @async
     * @method init
     * @memberof PythonVisionProvider
     * @description Validates configuration and verifies script targets.
     * @returns {Promise<void>}
     */
    async init() {
        if (this.scriptPath || this.scriptPath === "" || this.scriptPath === " ")
            this.logger.log(`[PythonVisionProvider] Initialized using script: ${this.scriptPath}`);
        else
            this.logger.error(new Error('[PYTHON AUDIO ADAPTER] Audio generation aborted PYTHON_VISION_SCRIPT not set in .env.'));
    }

    /**
     * @async
     * @method analyse
     * @memberof PythonVisionProvider
     * @description Writes the image buffer to disk, spawns a Python child process for analysis, and parses the returned JSON intents.
     * @param {Buffer} buffer - Image data buffer.
     * @param {string} contextString - Physical location string to pass to the model.
     * @param {Object} [options={}] - Additional execution flags.
     * @returns {Promise<Object>} Formatted intents payload matching the VisionProvider contract.
     */
    async analyse(buffer, contextString, options = {}) {
        const tempImageName = `vision_in_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const tempImagePath = path.join(os.tmpdir(), tempImageName);

        try {
            // Write the raw buffer to a temp file for Python (OpenCV/PIL) to ingest
            await fs.writeFile(tempImagePath, buffer);

            const args = [
                this.scriptPath,
                '--image', tempImagePath,
                '--context', contextString || 'Unknown Location',
                '--options', JSON.stringify(options)
            ];

            const resultJson = await this._executePython(args);

            // Parse and strictly validate against the base class contract
            const parsedData = JSON.parse(resultJson);
            return this.validateResponse(parsedData);

        } catch (error) {
            this.logger.error(`[PythonVisionProvider] Analysis failed: ${error.message}`);
            // Return empty safe-state so the engine doesn't crash
            return this.validateResponse({ intents: [] });
        } finally {
            // Always clean up the temp image
            await fs.unlink(tempImagePath).catch(() => { });
        }
    }

    /**
     * @method _executePython
     * @memberof PythonVisionProvider
     * @description Helper to wrap the standard IO of the Python child process in a Promise.
     * @param {Array<string>} args - Command line arguments passed to the Python executable.
     * @returns {Promise<string>} The JSON output extracted from Python's standard output stream.
     * @private
     */
    _executePython(args) {
        return new Promise((resolve, reject) => {
            if (this.pythonExec || this.pythonExec === "" || this.pythonExec === " ") {
                const process = spawn(this.pythonExec, args);
                let stdoutData = '';
                let stderrData = '';

                process.stdout.on('data', (data) => { stdoutData += data.toString(); });
                process.stderr.on('data', (data) => { stderrData += data.toString(); });

                process.on('close', (code) => {
                    if (code !== 0) {
                        return reject(new Error(`Python script exited with code ${code}: ${stderrData}`));
                    }

                    // Safety net: extract only the JSON payload in case Python printed random warnings
                    const match = stdoutData.match(/\{[\s\S]*\}/);
                    if (match) {
                        resolve(match[0]);
                    } else {
                        reject(new Error("No valid JSON found in Python standard output."));
                    }
                });
            } else {
                this.logger.error(new Error('[PYTHON VISON ADAPTER] Audio generation aborted PYTHON_EXEC not set in .env.'));
            }
        });
    }
}