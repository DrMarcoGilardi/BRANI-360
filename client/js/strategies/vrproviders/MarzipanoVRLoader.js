import { BaseVRLoader } from './BaseVRLoader.js';

export class MarzipanoVRLoader extends BaseVRLoader {
    constructor(key = {}) {
        super(key); // Strict adherence to contract
        
        const urlParams = new URLSearchParams(window.location.search);
        this.tourPath = urlParams.get('tour') || '/tour';
    }

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
    
    async stitchProgressively(nodeId, zoom, ctx, onTileDrawn) { return true; }
}