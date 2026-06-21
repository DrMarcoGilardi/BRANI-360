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

import { ImageSourceProvider } from './ImageSourceProvider.js'
import axios from 'axios';
import fs from 'fs';

/**
 * EXAMPLE STRATEGY IMPLEMENTATION 
 * Provider strategy for fetching raw equirectangular image buffers from the Mapillary API. 
 * Enforces strict filtering to reject non-360 panoramic images.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * ImageSourceProvider <|-- MapillarySource
 * class MapillarySource{
 * +getImage(id) Promise~Buffer~
 * }
 * ```
 * 
 * @class
 */
export class MapillarySource extends ImageSourceProvider {
    /**
     * @constructor
     * @param {Object} options - Configuration containing the MAPILLARY_TOKEN.
     * @param {Object} logger - System Logger.
     * @param {Object} [cacheManager=null] - Optional disk caching manager.
     */
    constructor(options, logger, cacheManager) {
        super();
        this.token = options.MAPILLARY_TOKEN;
        this.logger = logger;
        this.cacheManager = options.cacheManager || null;
    }

    /**
     * @async
     * @method getImage
     * @memberof MapillarySource
     * @description Fetches the image buffer for a given Mapillary Node ID, utilizing the cache if available.
     * @param {string} id - Mapillary Image ID.
     * @returns {Promise<Buffer>} The image data buffer.
     * @throws {Error} If the image is not a 360 panorama or the fetch fails.
     */
    async getImage(id) {
        const resolution = 2048;
        if (this.cacheManager) {
            const cachedPath = await this.cacheManager.getImage(id);
            if (cachedPath) {
                this.logger.log(`[MapillarySource] Cache hit for image: ${id}`);
                return await fs.readFileSync(cachedPath);
            }
        }

        this.logger.log(`[MapillarySource] Downloading image ${id}...`);
        const url = `https://graph.mapillary.com/${id}?fields=thumb_${resolution}_url,is_pano&access_token=${this.token}`;
        const response = await axios.get(url);
        const metadata = response.data;

        if (!metadata.is_pano) {
            throw new Error(`[Mapillary] Image ${id} is not a 360 panorama. Analysis aborted.`);
        }

        const imageUrl = metadata.thumb_2048_url;// || metadata.thumb_2048_url || metadata.thumb_original_url;
        const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(imgRes.data);

        if (this.cacheManager) {
            try {
                this.cacheManager.saveImage(id, buffer);
                this.logger.log(`[MapillarySource] Saved image ${id} to cache.`);
            } catch (e) {
                this.logger.error(`[MapillarySource] Failed to cache image ${id}: ${e.message}`);
            }
        }

        return buffer;
    }
}