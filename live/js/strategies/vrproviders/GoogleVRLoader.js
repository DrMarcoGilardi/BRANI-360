import { BaseVRLoader } from './BaseVRLoader.js';
import { GoogleMapsLoader } from '../../utilities/GoogleMapsLoader.js';

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
            console.log(`[GoogleVRLoader] User uploaded image, panoID: ${canonicalId}`)
            return `https://lh3.googleusercontent.com/p/${canonicalId}=x${x}-y${y}-z${zoom}`;
        } else {
            console.log(`[GoogleVRLoader] Official image, panoID: ${canonicalId}`)
            return `https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${canonicalId}&x=${x}&y=${y}&zoom=${zoom}`;
        }
    }

    /**
     * Core Drawing Engine: Mathematically computes padding, crops it dynamically, 
     * and maps exactly to the VR Buffer.
     */
    async _drawTiles(data, zoom, ctx, canvasWidth, canvasHeight) {
        const canonicalId = data.location.pano;
        // if (data.tiles && typeof data.tiles.getTileUrl === 'function') {
        const cols = Math.pow(2, zoom);
        const rows = Math.pow(2, Math.max(0, zoom - 1));

        const tileSize = 512;
        const totalPanoWidth = cols * tileSize;
        const totalPanoHeight = rows * tileSize;

        const scaleX = canvasWidth / totalPanoWidth;
        const scaleY = canvasHeight / totalPanoHeight;

        const tileDrawWidth = tileSize * scaleX;
        const tileDrawHeight = tileSize * scaleY;

        const promises = [];

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const url = this._getTileUrl(canonicalId, zoom, x, y);
                // const url = data.tiles.getTileUrl(canonicalId, zoom, x, y);
                const dx = x * tileDrawWidth;
                const dy = y * tileDrawHeight;

                promises.push(this._loadAndDrawTile(url, ctx, dx, dy, tileDrawWidth, tileDrawHeight));
            }
        }
        await Promise.all(promises);
        // }
    }

    _loadAndDrawTile(url, ctx, dx, dy, dWidth, dHeight) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";

            img.onload = () => {
                ctx.drawImage(img, dx, dy, dWidth, dHeight);
                resolve();
            };

            img.onerror = () => {
                console.warn(`[GoogleVRLoader] CORS or 404 Error on tile: ${url}`);
                ctx.fillStyle = '#ff0055';
                ctx.fillRect(dx, dy, dWidth, dHeight);
                resolve();
            };

            img.src = url;
        });
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