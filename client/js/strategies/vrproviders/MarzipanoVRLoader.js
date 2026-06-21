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
 * Manages texture loading and image processing specific to Marzipano environments for WebXR injection.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * BaseVRLoader <|-- MarzipanoVRLoader
 * class MarzipanoVRLoader{
 * +tourPath string
 * +getLowResBase(nodeId, canvas, ctx) Promise~void~
 * +stitchProgressively(nodeId, zoom, ctx, onTileDrawn) Promise~boolean~
 * }
 * ```
 * 
 * @class
 */
export class MarzipanoVRLoader extends BaseVRLoader {
    /**
     * @constructor
     * @memberof MarzipanoVRLoader
     * @description Initializes the VR loader and extracts the root tour path from URL params.
     * @param {Object} [key={}] - Options object.
     */
    constructor(key = {}) {
        super(key);

        const urlParams = new URLSearchParams(window.location.search);
        this.tourPath = urlParams.get('tour') || '/tour';
    }

    /**
     * @async
     * @method getLowResBase
     * @memberof MarzipanoVRLoader
     * @description Fetches and paints a base equirectangular image onto a provided canvas context for XR environments.
     * @param {string} nodeId - Target image/scene ID.
     * @param {HTMLCanvasElement} canvas - Target canvas element.
     * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context.
     * @returns {Promise<void>} Resolves when image is painted or on error fallback.
     */
    async getLowResBase(nodeId, canvas, ctx) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";

            // WebXR will pull the equirectangular image from the remote host
            img.src = `${this.tourPath}/source_images/${nodeId}.jpg`;

            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve();
            };

            img.onerror = (e) => {
                console.error(`[MarzipanoVRLoader] Missing source image for VR: ${nodeId}`, e);
                ctx.fillStyle = '#111';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                resolve();
            };
        });
    }

    /**
     * @async
     * @method stitchProgressively
     * @memberof MarzipanoVRLoader
     * @description Placeholder method fulfilling the BaseVRLoader contract for progressive texture enhancement.
     * @param {string} nodeId - Target node ID.
     * @param {number} zoom - Target zoom/LOD level.
     * @param {CanvasRenderingContext2D} ctx - Rendering context.
     * @param {Function} onTileDrawn - Callback fired on individual tile paints.
     * @returns {Promise<boolean>} Resolves to true when process halts/completes.
     */
    async stitchProgressively(nodeId, zoom, ctx, onTileDrawn) { return true; }
}