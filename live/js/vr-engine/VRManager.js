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
 * Main coordinator for the VR experience.  
 * Orchestrates HD visual projection and Camera sync.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * VRManager --> BaseVRLoader : Uses to fetch images/tiles
 * class VRManager{
 * +updateSkybox(nodeId) Promise~void~
 * +createNavArrows(links, onNavigate)
 * +syncPOV(panorama)
 * }
 * ```
 * 
 * @class
 */

import { SpatialUtils } from '../utilities/SpatialUtils.js';

export class VRManager {
    /**
     * @constructor
     * @param {string} apiKey - API Key for visual assets.
     * @param {UIManager} uiManager - Reference to the UI for progress bars.
     * @param {BaseVRLoader} vrLoaderStrategy - Injected tile loading strategy.
     */
    constructor(uiManager, vrLoaderStrategy) {
        this.ui = uiManager;
        this.tileLoader = vrLoaderStrategy;

        this.canvas = document.createElement('canvas');
        this.canvas.width = 4096;
        this.canvas.height = 2048;
        this.ctx = this.canvas.getContext('2d');
        this.texture = null;
    }

    /**
     * @async
     * @method updateSkybox
     * @memberof VRManager
     * @description Triggers a progressive HD tile load for the A-Frame skybox using a persistent 4K canvas.
     * @param {string} nodeId - Target panorama identifier.
     * @returns {Promise<void>}
     */
    async updateSkybox(nodeId) {
        const skyEl = document.getElementById('vr-sky');
        if (!skyEl) {
            console.error("[VR] Target #vr-sky not found in DOM. Visual update aborted.");
            return;
        }

        try {
            if (!this.texture) {
                this.texture = new AFRAME.THREE.CanvasTexture(this.canvas);
                this.texture.minFilter = AFRAME.THREE.LinearFilter;
                skyEl.setAttribute('scale', '-1 1 1');
                skyEl.setAttribute('geometry', { primitive: 'sphere', radius: 100, segmentsWidth: 64, segmentsHeight: 64 });
                skyEl.setAttribute('material', { shader: 'flat', side: 'back', transparent: false });

                const mesh = skyEl.getObject3D('mesh');
                if (mesh) mesh.material.map = this.texture;
            }

            if (typeof this.tileLoader.getLowResBase === 'function') {
                await this.tileLoader.getLowResBase(nodeId, this.ctx, this.canvas.width, this.canvas.height);
                this.texture.needsUpdate = true;
            }

            const zoomLevels = [1, 2, 3, 4];

            for (const zoom of zoomLevels) {
                const totalTiles = Math.pow(2, zoom) * Math.pow(2, zoom - 1);
                let tilesLoaded = 0;

                this.ui.updatePipelineProgress('Visuals', `Enhancing Level ${zoom - 1}...`, 0.1, 'vr_vis', false);

                const success = await this.tileLoader.stitchProgressively(
                    nodeId, zoom, this.ctx, this.canvas.width, this.canvas.height,
                    () => {
                        tilesLoaded++;
                        if (zoom === 3 || tilesLoaded % 4 === 0) {
                            this.texture.needsUpdate = true;
                        }
                        const progress = (tilesLoaded / totalTiles);
                        this.ui.updatePipelineProgress('Visuals', `Lvl ${zoom - 1}: ${tilesLoaded}/${totalTiles}`, progress, 'vr_vis', false);
                    }
                );

                this.texture.needsUpdate = true;

                if (!success) {
                    console.log(`[VRManager] Reached maximum available resolution at Zoom ${zoom - 1}.`);
                    break;
                }
            }

            this.ui.updatePipelineProgress('Visuals', 'HD Complete', 1.0, 'vr_vis', false);
        } catch (e) {
            console.error("[VR MANAGER] HD Projection failed:", e);
        }
    }

    /**
     * @method createNavArrows
     * @memberof VRManager
     * @description Generates raycastable 3D arrows for WebXR navigation.
     * @param {Array<Object>} links - Array of topological links with headings.
     */
    createNavArrows(links) {
        const sceneEl = document.querySelector('a-scene');
        if (!sceneEl || !links) return;

        if (this.navContainer) {
            this.navContainer.parentNode.removeChild(this.navContainer);
        }

        this.navContainer = document.createElement('a-entity');
        this.navContainer.id = "vr-nav-arrows";
        sceneEl.appendChild(this.navContainer);

        links.forEach(link => {
            const arrow = document.createElement('a-entity');
            const pos = SpatialUtils.sphericalToCartesian(link.heading, 0, 8);

            arrow.setAttribute('geometry', { primitive: 'plane', width: 1.5, height: 1.5 });
            arrow.setAttribute('material', {
                src: './js/vr-engine/assets/svg/chevron.svg',
                color: '#ffffff',
                shader: 'flat',
                transparent: true,
                opacity: 0.5,
                side: 'double'
            });
            arrow.setAttribute('position', `${pos.x} -1.0 ${pos.z}`);
            arrow.setAttribute('rotation', `-80 ${- link.heading} 0`);
            arrow.classList.add('raycastable');

            arrow.addEventListener('mouseenter', () => {
                arrow.setAttribute('material', 'color', '#ffffffcc');
                arrow.setAttribute('material', 'opacity', '0.9');
            })

            arrow.addEventListener('mouseleave', () => {
                arrow.setAttribute('material', 'color', '#ffffff');
                arrow.setAttribute('material', 'opacity', '0.5');
            });

            arrow.addEventListener('click', () => {
                const targetNodeId = link.id;
                document.dispatchEvent(new CustomEvent('app:navigation_intent', {
                    detail: { nodeId: targetNodeId }
                }));
            });

            this.navContainer.appendChild(arrow);
        });
    }

    /**
     * @method getPOV
     * @memberof VRManager
     * @description Extracts the current VR headset rotation as a standardized POV object.
     * @returns {Object|null} Standardized { heading, pitch } object.
     */
    getPOV() {
        const cameraEl = document.querySelector('[camera]');
        if (!cameraEl) return null;
        const rotation = cameraEl.getAttribute('rotation');
        if (!rotation) return null;

        return { heading: -rotation.y, pitch: rotation.x };
    }
}