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
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { ImageSourceProvider } from './ImageSourceProvider.js';

/**
 * Provides server-side processing to stitch Marzipano tiles back into equirectangular formats for AI engine ingestion.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * ImageSourceProvider <|-- MarzipanoImageSource
 * class MarzipanoImageSource{
 * +getImage(id) Promise~Buffer~
 * }
 * ```
 * 
 * @class
 */
export class MarzipanoImageSource extends ImageSourceProvider {
    /**
     * @constructor
     * @memberof MarzipanoImageSource
     * @description Initializes the server-side image source provider.
     * @param {Object} options - Configuration options, including TOUR_PATH.
     * @param {Object} [logger] - Optional logger instance.
     */
    constructor(options, logger) {
        super();
        this.logger = logger || console;
        // The URL or local path where the pristine /tour folder is hosted
        this.tourPath = options.TOUR_PATH;
    }

    /**
     * @async
     * @method getImage
     * @memberof MarzipanoImageSource
     * @description Reads local tour data and dynamically stitches raw Marzipano tiles into a single output Buffer using sharp.
     * @param {string} id - The ID of the scene to stitch.
     * @returns {Promise<Buffer>} The stitched image data as a JPEG buffer.
     * @throws {Error} If the scene is not found or stitching operations fail.
     */
    async getImage(id) {
        const maxResolution = 1024; // Define the maximum resolution for the output image
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        this.logger.log(`[MarzipanoImageSource] Stitching tiles for scene: ${id}`);
        try {
            // Read the tour's data.js to find the tiling structure
            const absoluteFolderPath = path.resolve(__dirname, '..', this.tourPath);
            const dataRaw = await fs.readFile(path.join(absoluteFolderPath, 'data.js'), 'utf8');
            this.logger.log(`[MarzipanoImageSource] Read data.js from ${dataRaw}`);
            const data = JSON.parse(dataRaw.replace('var APP_DATA = ', '').trim().replace(/;$/, ''));
            const scene = data.scenes.find(s => s.id === id);

            if (!scene) throw new Error(`Scene ${id} not found in data.js`);

            let levelIndex = scene.levels.length - 1;
            for (let i = scene.levels.length - 1; i >= 0; i--) {
                if (scene.levels[i].size <= maxResolution) {
                    levelIndex = i;
                    break;
                }
            }

            const targetLevel = scene.levels[levelIndex];
            const highestLevel = scene.levels[scene.levels.length - 1];
            const tileSize = highestLevel.tileSize;
            const gridSize = Math.ceil(targetLevel.size / tileSize);

            // 3. Assemble tiles into an array for Sharp
            // Marzipano structure: tiles/{id}/{level}/{face}/{y}/{x}.jpg
            const composite = [];
            for (let y = 0; y < gridSize; y++) {
                for (let x = 0; x < gridSize; x++) {
                    // Use our newly found optimal levelIndex
                    const tilePath = path.join(absoluteFolderPath, 'tiles', id, String(levelIndex), 'f', String(y), `${x}.jpg`);
                    composite.push({
                        input: await fs.readFile(tilePath),
                        top: y * tileSize,
                        left: x * tileSize
                    });
                }
            }

            // 4. Stitch back into one high-res equirectangular buffer
            return await sharp({
                create: {
                    width: highestLevel.size,
                    height: highestLevel.size,
                    channels: 3,
                    background: '#000'
                }
            })
                .composite(composite)
                .resize(maxResolution, maxResolution, { fit: 'inside', withoutEnlargement: true })
                .jpeg()
                .toBuffer();

        } catch (error) {
            this.logger.error(`[MarzipanoImageSource] Stitching failed for ${id}: ${error.message}`);
            throw error;
        }
    }
}