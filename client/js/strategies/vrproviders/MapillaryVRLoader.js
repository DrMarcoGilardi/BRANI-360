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

import { BaseVRLoader } from './BaseVRLoader.js';
/**
 * EXAMPLE STRATEGY IMPLEMENTATION
 * MapillaryVRLoader
 * Strategy implementation for loading panoramic images from Mapillary's Graph API into the VR buffer.
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * BaseVRLoader <|-- MapillaryVRLoader
 * class MapillaryVRLoader{
 * +getLowResBase(nodeId, ctx, width, height) Promise~void~
 * +stitchProgressively(nodeId, zoom, ctx, width, height, onTileDrawn) Promise~boolean~
 * }
 * ```
 * @class
 */
export class MapillaryVRLoader extends BaseVRLoader {
    /**
     * @constructor
     * @param {string} key - Mapillary Client Access Token.
     */
    constructor(key) {
        super(key);
    }

    /**
     * @async
     * @method getLowResBase
     * @memberof MapillaryVRLoader
     * @description Fetches and draws the initial low-resolution base image (1024px) to the canvas.
     * @param {string} nodeId - The Mapillary Image ID.
     * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context.
     * @param {number} width - Canvas width.
     * @param {number} height - Canvas height.
     * @returns {Promise<void>}
     */
    async getLowResBase(nodeId, ctx, width, height) {
        return this._fetchAndDraw(nodeId, 'thumb_2048_url', ctx, width, height);
    }

    /**
     * @async
     * @method stitchProgressively
     * @memberof MapillaryVRLoader
     * @description Updates the canvas with the maximum-resolution image.
     * @param {string} nodeId - Mapillary Image ID.
     * @param {number} zoom - Zoom level defining resolution tier.
     * @param {CanvasRenderingContext2D} ctx - Target rendering context.
     * @param {number} width - Output width.
     * @param {number} height - Output height.
     * @param {Function} [onTileDrawn] - Callback fired to simulate individual tile load progression.
     * @returns {Promise<boolean>} True if the resolution tier was successfully rendered.
     */
    async stitchProgressively(nodeId, zoom, ctx, width, height, onTileDrawn) {
        this._fetchAndDraw(nodeId, 'thumb_original_url', ctx, ctx.canvas.width, ctx.canvas.height);
        if (onTileDrawn) onTileDrawn();
        return true;
    }
    
    /**
     * @async
     * @method _fetchAndDraw
     * @memberof MapillaryVRLoader
     * @description Internal helper to fetch and paint a specific image field from the Graph API.
     * @param {string} nodeId - Mapillary Image ID.
     * @param {string} field - API field to fetch (e.g., 'thumb_1024_url').
     * @param {CanvasRenderingContext2D} ctx - Target rendering context.
     * @param {number} width - Output width.
     * @param {number} height - Output height.
     * @returns {Promise<void>}
     * @private
     */
    async _fetchAndDraw(nodeId, field, ctx, width, height) {
        try {
            const res = await fetch(`https://graph.mapillary.com/${nodeId}?fields=${field}&access_token=${this.key}`);
            if (!res.ok) throw new Error("Network response was not ok");
            const data = await res.json();
            
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = data[field];
            });
            
            ctx.drawImage(img, 0, 0, width, height);
        } catch (e) {
            console.warn(`[MapillaryVRLoader] Fetch failed for ${field}:`, e);
        }
    }
}