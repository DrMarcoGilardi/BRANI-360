import { BaseVRLoader } from './BaseVRLoader.js';
import { GoogleMapsLoader } from '../../Utilities/GoogleMapsLoader.js'; 

export class GoogleVRLoader extends BaseVRLoader {
    constructor(key) {
        super(key);
        this.svs = null; 
        this.tileDataCache = new Map();
    }

    async _getTileData(nodeId) {
        if (!this.svs) {
            try {
                await GoogleMapsLoader.load(this.key);
                this.svs = new google.maps.StreetViewService();
            } catch (e) {
                return Promise.reject(new Error("Maps API unavailable"));
            }
        }

        if (this.tileDataCache.has(nodeId)) {
            return this.tileDataCache.get(nodeId);
        }

        return new Promise((resolve, reject) => {
            this.svs.getPanorama({ pano: nodeId }, (data, status) => {
                if (status === google.maps.StreetViewStatus.OK) {
                    this.tileDataCache.set(nodeId, data);
                    resolve(data);
                } else {
                    reject(new Error(`StreetViewService failed with status: ${status}`));
                }
            });
        });
    }

    _getTileUrl(canonicalId, zoom, x, y) {
        if (canonicalId.startsWith('CAoS') || canonicalId.startsWith('AF1Q')) {
            return `https://lh3.ggpht.com/p/${canonicalId}=x${x}-y${y}-z${zoom}`;
        } else {
            return `https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv&panoid=${canonicalId}&x=${x}&y=${y}&zoom=${zoom}`;
        }
    }

    /**
     * Core Drawing Engine: Mathematically computes padding, crops it dynamically, 
     * and maps exactly to the VR Buffer.
     */
    async _drawTiles(data, zoom, ctx, canvasWidth, canvasHeight, onTileDrawn = null) {
        const canonicalId = data.location.pano;
        const tileSize = data.tiles.tileSize.width || 512;
        const worldW = data.tiles.worldSize.width;
        const worldH = data.tiles.worldSize.height;

        // 1. Grid definition at the current requested zoom level
        const numCols = Math.pow(2, zoom);
        const numRows = Math.pow(2, Math.max(0, zoom - 1));

        // 2. Find the enclosing power-of-two grid to calculate the true padding ratio
        const maxCols = Math.pow(2, Math.ceil(Math.log2(worldW / tileSize)));
        const maxRows = Math.max(1, maxCols / 2); // Standard 2:1 aspect ratio constraint
        
        const validRatioX = worldW / (maxCols * tileSize);
        const validRatioY = worldH / (maxRows * tileSize);

        // 3. Exact pixel dimensions of valid image data at THIS zoom level
        const currentGridWidth = numCols * tileSize;
        const currentGridHeight = numRows * tileSize;
        const validWidthAtZoom = currentGridWidth * validRatioX;
        const validHeightAtZoom = currentGridHeight * validRatioY;

        // 4. Bound loops exclusively to tiles containing valid data (Neutralizes 503 Errors)
        const activeCols = Math.ceil(validWidthAtZoom / tileSize);
        const activeRows = Math.ceil(validHeightAtZoom / tileSize);

        // 5. Scaling factors to stretch valid data perfectly over the persistent 4K buffer
        const scaleX = canvasWidth / validWidthAtZoom;
        const scaleY = canvasHeight / validHeightAtZoom;

        const tilePromises = [];

        for (let y = 0; y < activeRows; y++) {
            for (let x = 0; x < activeCols; x++) {
                tilePromises.push(new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    
                    img.onload = () => {
                        // Calculate padding bounds to crop edge tiles dynamically
                        const tileValidW = Math.min(tileSize, validWidthAtZoom - (x * tileSize));
                        const tileValidH = Math.min(tileSize, validHeightAtZoom - (y * tileSize));

                        // Safety check to prevent Canvas IndexSizeErrors
                        const cropW = Math.min(img.width, tileValidW);
                        const cropH = Math.min(img.height, tileValidH);

                        const destX = (x * tileSize) * scaleX;
                        const destY = (y * tileSize) * scaleY;
                        const destW = cropW * scaleX;
                        const destH = cropH * scaleY;
                        
                        // Crop padding out natively via drawImage
                        ctx.drawImage(img, 0, 0, cropW, cropH, destX, destY, destW, destH);
                        
                        if (onTileDrawn) onTileDrawn();
                        resolve(true);
                    };
                    
                    // If Google drops a tile, fail silently. Base layer shines through.
                    img.onerror = () => resolve(false);

                    // Defer to the native URL generator, which routes perfectly
                    img.src = typeof data.tiles.getTileUrl === 'function' ? 
                              data.tiles.getTileUrl(canonicalId, zoom, x, y) : 
                              this._getTileUrl(canonicalId, zoom, x, y);
                }));
            }
        }

        return Promise.all(tilePromises);
    }

    async getLowResBase(nodeId, ctx, width, height) {
        try {
            const data = await this._getTileData(nodeId);
            
            // Clear canvas ONLY when laying down the first base layer
            ctx.clearRect(0, 0, width, height);
            
            await this._drawTiles(data, 1, ctx, width, height);
            return true;
        } catch (e) {
            console.error("[GoogleVRLoader] Failed to construct base layer.", e);
            return false;
        }
    }

    async _checkTileExists(canonicalId, zoom, data) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = typeof data.tiles.getTileUrl === 'function' ? 
                      data.tiles.getTileUrl(canonicalId, zoom, 0, 0) : 
                      this._getTileUrl(canonicalId, zoom, 0, 0);
        });
    }

    async stitchProgressively(nodeId, zoom, ctx, width, height, onTileDrawn) {
        let data;
        try {
            data = await this._getTileData(nodeId);
        } catch (e) {
            return false;
        }

        const canonicalId = data.location.pano;
        const levelExists = await this._checkTileExists(canonicalId, zoom, data);
        if (!levelExists) return false; 

        // Paint high-res tiles dynamically over the base
        await this._drawTiles(data, zoom, ctx, width, height, onTileDrawn);
        return true; 
    }
}