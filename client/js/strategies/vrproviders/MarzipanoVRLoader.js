import { BaseVRLoader } from './BaseVRLoader.js';

/**
 * @class MarzipanoVRLoader
 * @description Manages texture loading and image processing specific to Marzipano environments for WebXR injection.
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