/*
 * BRANI-360: An Agnostic Browser-Based Research Sandbox Architecture for AI Audio Generation on Networks of 360° Images
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
 * BRANI-360 is dual-licensed. The above AGPLv3 license applies to open-source 
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
    constructor(path = {}) {
        super(path);

        const urlParams = new URLSearchParams(window.location.search);
        this.tourPath = path;

        this.faceMap = {
            'r': 0, // +x 
            'l': 1, // -x 
            'u': 2, // +y 
            'd': 3, // -y 
            'f': 4, // +z 
            'b': 5  // -z 
        };

        this.faceCanvases = [];
        this.faceContexts = [];
        this.faceTextures = [];
    }

    async getLowResBase(nodeId, canvas, ctx) {
        const skyEl = document.getElementById('vr-sky');
        if (!skyEl) return false;
        skyEl.setAttribute('geometry', 'primitive: box; width: 100; height: 100; depth: 100');
        skyEl.setAttribute('scale', '-1 1 1');

        const mesh = skyEl.getObject3D('mesh');
        if (!mesh) return false;
        if (this.faceCanvases.length === 0) {
            for (let i = 0; i < 6; i++) {
                const c = document.createElement('canvas');
                c.width = 2048;
                c.height = 2048;
                this.faceCanvases.push(c);
                this.faceContexts.push(c.getContext('2d', { willReadFrequently: true }));

                const tex = new AFRAME.THREE.CanvasTexture(c);
                tex.minFilter = AFRAME.THREE.LinearFilter;
                tex.generateMipmaps = false;
                this.faceTextures.push(tex);
            }
        }

        mesh.material = this.faceTextures.map(tex => new AFRAME.THREE.MeshBasicMaterial({
            map: tex,
            side: AFRAME.THREE.BackSide,
            depthWrite: false
        }));

        await this._drawZoomLevel(nodeId, 1);
        return true;
    }

    async stitchProgressively(nodeId, zoom, ctx, width, height, onTileDrawn) {
        return await this._drawZoomLevel(nodeId, zoom, onTileDrawn);
    }

    async _drawZoomLevel(nodeId, zoom, onTileDrawn) {
        const cols = Math.pow(2, Math.max(0, zoom - 1));

        const firstTileExists = await this._checkTileExists(nodeId, zoom, 'f', 0, 0);
        if (!firstTileExists) return false;

        const tileDrawSize = 2048 / cols;
        const faces = Object.keys(this.faceMap);
        const promises = [];

        for (const face of faces) {
            const targetIdx = this.faceMap[face];
            const faceCtx = this.faceContexts[targetIdx];
            const faceTex = this.faceTextures[targetIdx];

            for (let y = 0; y < cols; y++) {
                for (let x = 0; x < cols; x++) {
                    const url = `${this.tourPath}/tiles/${nodeId}/${zoom}/${face}/${y}/${x}.jpg`;

                    const dx = x * tileDrawSize;
                    const dy = y * tileDrawSize;

                    const p = this._loadAndDrawTile(url, faceCtx, faceTex, dx, dy, tileDrawSize).then(() => {
                        if (onTileDrawn) onTileDrawn();
                    });
                    promises.push(p);
                }
            }
        }

        await Promise.all(promises);
        return true;
    }

    _loadAndDrawTile(url, ctx, texture, dx, dy, size) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                ctx.drawImage(img, dx, dy, size, size);
                texture.needsUpdate = true;
                resolve();
            };
            img.onerror = () => {
                resolve();
            };
            img.src = url;
        });
    }

    _checkTileExists(nodeId, zoom, face, y, x) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = `${this.tourPath}/tiles/${nodeId}/${zoom}/${face}/${y}/${x}.jpg`;
        });
    }
}