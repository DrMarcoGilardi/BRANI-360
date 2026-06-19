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

/**
 * Strategy Pattern Interface for VR 360 Image Fetching.
 * Standardizes the progressive loading of high-resolution panoramas for WebXR.
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class BaseVRLoader{
 * <<Abstract>>
 * +getLowResBase(nodeId, canvas, ctx) Promise~void~
 * +stitchProgressively(nodeId, zoom, ctx, onTileDrawn) Promise~boolean~
 * }
 * ```
 * @class
 */
export class BaseVRLoader {
    /**
     * @constructor
     * @param {Object} [key={}] - Configuration or API keys required by the provider.
     */
    constructor(key = {}) {
        this.key = key;
    }

    /**
     * @async
     * @method getLowResBase
     * @memberof BaseVRLoader
     * @description Fetches and draws the initial low-resolution base image to the canvas.
     * @param {string} nodeId - The unique identifier for the panorama.
     * @param {HTMLCanvasElement} canvas - Target canvas element.
     * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context.
     * @returns {Promise<void>}
     * @throws {Error} If not implemented by the specific provider.
     */
    async getLowResBase(nodeId, canvas, ctx) { 
        throw new Error("[VR Loader] Method 'getLowResBase' must be implemented."); 
    }

    /**
     * @async
     * @method stitchProgressively
     * @memberof BaseVRLoader
     * @description Progressively fetches and stitches high-resolution tiles over the base layer.
     * @param {string} nodeId - The unique identifier for the panorama.
     * @param {number} zoom - Target zoom/quality level to fetch.
     * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context.
     * @param {Function} onTileDrawn - Callback fired whenever a tile is successfully drawn.
     * @returns {Promise<boolean>} True if the resolution level was successfully stitched.
     */
    async stitchProgressively(nodeId, zoom, ctx, onTileDrawn) { 
        throw new Error("[VR Loader] Method 'stitchProgressively' must be implemented."); 
    }
}