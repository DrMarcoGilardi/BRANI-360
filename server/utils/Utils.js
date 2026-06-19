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

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

/**
 * Server-side utility class for file handling and audio manipulation.
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class Utils{
 * +loadDictionary(filePath, logger)$ Promise~Object~
 * +transcode(wavBuffer, targetFormat, taskType, logger)$ Promise~Buffer~
 * }
 * ```
 */
export class Utils {
    /**
     * @static
     * @async
     * @method loadDictionary
     * @memberof Utils
     * @description Loads a JSON research dictionary and maps it for fast backend lookup.
     * @param {string} filePath - Absolute path to the JSON file.
     * @param {Object} [logger=console] - System logger for error reporting.
     * @returns {Promise<Object>} The mapped dictionary.
     */
    static async loadDictionary(filePath, logger = console) {
        try {
            const raw = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(raw);
            const dict = {};

            // Expected schema: { "ambients": [ { "id": "city", ... } ] }
            if (data && data.ambients) {
                data.ambients.forEach(entry => {
                    if (entry.id) {
                        dict[entry.id.toLowerCase()] = entry;
                    }
                });
            }

            return {
                ambients: dict,
                base_positive_prompt: data.base_positive_prompt || "",
                base_negative_prompt: data.base_negative_prompt || ""
            };
        } catch (e) {
            logger.error(`[DictionaryUtils] Failed to load ${filePath}: ${e.message}`);
            return { ambients: {}, positivePrompt: "", negativePrompt: "" };
        }
    }

    /**
     * @static
     * @async
     * @method transcode
     * @memberof Utils
     * @description Transcodes a raw WAV buffer into the target framework format (webm, mp3, ogg) using FFmpeg. Also handles stereo-to-mono downmixing based on semantic task type.
     * @param {Buffer} wavBuffer - The source audio buffer.
     * @param {string} targetFormat - Target extension (e.g., 'webm').
     * @param {string} taskType - Semantic task type (used to determine channel count).
     * @param {Object} [logger=console] - System logger.
     * @returns {Promise<Buffer>} The transcoded audio buffer.
     */
    static async transcode(wavBuffer, targetFormat, taskType, logger = console) {
        if (!targetFormat || targetFormat === 'wav') return wavBuffer;

        const timestamp = Date.now();
        const uniqueId = `${timestamp}_${Math.random().toString(36).substring(2, 9)}`;
        const tempIn = path.join(tmpdir(), `res_${uniqueId}.wav`);
        const tempOut = path.join(tmpdir(), `res_${uniqueId}.${targetFormat}`);

        try {
            await fs.writeFile(tempIn, wavBuffer);

            // Domain Logic: Point-source objects are mono (1), Ambients are stereo (2)
            const channels = (taskType || '').startsWith('object') ? 1 : 2;
            
            let args = "";
            if (targetFormat === 'webm') {
                args = `-c:a libopus -b:a ${channels === 1 ? '48k' : '96k'} -vbr on`;
            } else if (targetFormat === 'ogg') {
                args = `-c:a libvorbis -q:a 4`;
            } else if (targetFormat === 'mp3') {
                args = `-c:a libmp3lame -q:a 4`;
            }

            await execAsync(`ffmpeg -i ${tempIn} ${args} -ac ${channels} ${tempOut} -y`);
            
            const outBuf = await fs.readFile(tempOut);
            logger.log(`[TRANSCODER] File Transcoded`);
            // Async Cleanup
            await fs.unlink(tempIn).catch(() => {}); 
            await fs.unlink(tempOut).catch(() => {});
            
            return outBuf;
        } catch (e) {
            if (logger) logger.error(`[AudioUtils] Transcoding failed: ${e.message}`);
            return wavBuffer; // Fallback to raw WAV on failure
        }
    }
}