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

import { VRManager } from './VRManager.js';
import { VRRPGAudioManager } from './VRRPGAudioManager.js';
import { WristUI } from './WristUI.js';
import { InteractiveMap } from './InteractiveMap.js';

/**
 * Manages the A-Frame Lifecycle and WebXR spatial audio syncing.  
 * Acts as the bridge between agnostic 2D logic and 3D WebXR representation.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * VRSceneController --> VRManager : Updates Visuals
 * VRSceneController --> VRRPGAudioManager : Syncs Audio
 * class VRSceneController{
 * +setEpoch(epoch)
 * +setupListeners()
 * +ensureAudioContext()
 * +sync2DRotation(pov)
 * +syncVRHeadtracking(nativeViewer)
 * +updateSkybox(nodeId)
 * +updateVRNavigation(links, nativeViewer)
 * +addSpatialSource(data, tunnelUrl)
 * +setAmbientWash(url)
 * +clearSpatialSources()
 * +enterVR(nodeId, links, nativeViewer)
 * }
 * ```
 * 
 * @class
 */
export class VRSceneController {
    /**
     * @constructor
     * @param {string} googleApiKey - The API key for fetching tiles.
     * @param {UIManager} ui - The interface manager.
     * @param {BaseVRLoader} vrLoaderStrategy - The injected 360-image loading strategy.
     */
    constructor(ui, vrLoaderStrategy) {
        this.ui = ui;
        this.vrManager = new VRManager(ui, vrLoaderStrategy);
        this.vrAudio = new VRRPGAudioManager();
        this.currentEpoch = 0;
        if (typeof WristUI !== 'undefined') WristUI.register();
        if (typeof InteractiveMap !== 'undefined') InteractiveMap.register();
        this.setupListeners();

        this.loadUserPlugin();
    }

    loadUserPlugin() {
        import('./vrplugin/vr-behaviours-plugin.js')
            .then(() => {
                console.log("[ABBA-360] Custom user VR logic loaded successfully.");
            })
            .catch(() => {
            });
    }

    /**
     * @method setEpoch
     * @memberof SceneController
     * @description Sets the active navigation epoch to sync VR operations with the pipeline.
     * @param {number} epoch - The current navigation tick.
     */
    setEpoch(epoch) {
        this.currentEpoch = epoch;
    }

    /**
     * @method setupListeners
     * @memberof SceneController
     * @description Initializes A-Frame enter/exit VR event listeners.
     */
    setupListeners() {
        const scene = document.querySelector('a-scene');
        if (scene) {
            scene.addEventListener('enter-vr', () => {
                const cameraEl = document.querySelector('[camera]') || document.querySelector('a-camera');
                if (cameraEl) cameraEl.setAttribute('look-controls', 'enabled', true);
            });

            scene.addEventListener('exit-vr', () => {
                const cameraEl = document.querySelector('[camera]') || document.querySelector('a-camera');
                if (cameraEl) cameraEl.setAttribute('look-controls', 'enabled', false);

                const vrContainer = document.getElementById('vr-engine');
                const mapLayer = document.getElementById('map-layer');

                if (vrContainer) {
                    vrContainer.style.opacity = '0';
                    vrContainer.style.zIndex = '10';
                    setTimeout(() => { vrContainer.style.display = 'none'; }, 1000);
                }
                if (mapLayer) mapLayer.style.visibility = 'visible';

                if (this.ui && this.ui.showXrButton) this.ui.showXrButton();

                // AGNOSTIC FIX: Broadcast the camera sync intent globally
                const pov = this.vrManager.getPOV();
                if (pov) {
                    document.dispatchEvent(new CustomEvent('app:sync_camera_intent', { detail: pov }));
                }
            });
        }
    }

    /**
     * @method ensureAudioContext
     * @memberof SceneController
     * @description Ensures the Three.js AudioContext is resumed after user interaction.
     */
    ensureAudioContext() {
        const scene = document.querySelector('a-scene');
        if (!scene) return;

        if (!scene.audioListener && AFRAME.THREE) {
            scene.audioListener = new AFRAME.THREE.AudioListener();
            const cameraEl = document.querySelector('[camera]') || document.querySelector('a-camera');

            if (cameraEl && cameraEl.object3D) {
                cameraEl.object3D.add(scene.audioListener);
                console.log("[Audio] Listener attached to active Camera.");
            } else {
                scene.object3D.add(scene.audioListener);
                console.log("[Audio] Listener attached to Scene root.");
            }
        }

        const context = scene.audioListener?.context || (AFRAME.THREE ? AFRAME.THREE.AudioContext.getContext() : null);
        if (context && context.state === 'suspended') {
            context.resume().then(() => console.log("[Audio] Context Resumed"));
        }
    }

    /**
     * @method sync2DRotation
     * @memberof SceneController
     * @description Syncs the 2D viewer's Point-of-View into the 3D scene camera (when not in VR).
     * @param {Object} pov - The heading and pitch object.
     */
    sync2DRotation(pov) {
        const cameraEl = document.querySelector('[camera]') || document.querySelector('a-camera');
        if (cameraEl) {
            const sceneEl = document.querySelector('a-scene');
            if (sceneEl && !sceneEl.is('vr-mode')) {
                cameraEl.setAttribute('look-controls', 'enabled', false);
                // POV now uses generic { heading, pitch } standardized by ViewerProvider
                cameraEl.setAttribute('rotation', `${pov.pitch} ${-pov.heading} 0`);
            }
        }
    }

    /**
     * @method getVRHeadtracking
     * @memberof SceneController
     * @description Retrieves the WebXR head-tracking rotation (only when active in VR).
     * @returns {Object|null} Standardized POV object.
     */
    getVRHeadtracking() {
        const scene = document.querySelector('a-scene');
        if (scene && scene.is('vr-mode')) {
            return this.vrManager.getPOV();
        }
        return null;
    }

    /**
     * @method updateSkybox
     * @memberof SceneController
     * @description Triggers the progressive HD skybox update for the current node.
     * @param {string} nodeId - The target node identifier.
     */
    updateSkybox(nodeId) {
        const scene = document.querySelector('a-scene');
        if (scene && scene.is('vr-mode')) {
            this.vrManager.updateSkybox(nodeId);
        }
    }

    /**
     * @method updateVRNavigation
     * @memberof SceneController
     * @description Spawns 3D navigation arrows in the WebXR scene based on topological links.
     * @param {Array<Object>} links - Array of connected neighbor nodes.
     * @param {Object} nativeViewer - The underlying map SDK object.
     */
    updateVRNavigation(links) {
        const scene = document.querySelector('a-scene');
        if (scene) {
            this.vrManager.createNavArrows(links);
        }
    }

    /**
     * @method addSpatialSource
     * @memberof SceneController
     * @description Pipes a localized sound object to the VR audio manager.
     * @param {Object} data - Spatial audio configuration data.
     * @param {string} tunnelUrl - The base URL of the remote backend.
     */
    addSpatialSource(data, tunnelUrl) {
        if (data.navEpoch !== undefined && data.navEpoch < this.currentEpoch) {
            return;
        }
        const scene = document.querySelector('a-scene');
        if (scene && scene.is('vr-mode')) {
            this.vrAudio.addSpatialSource(
                data.label,
                data.displayName || data.label,
                `${tunnelUrl}${data.url}`,
                { h: data.h, p: data.p, dist: data.dist }
            );
        }
    }

    /**
     * @method setAmbientWash
     * @memberof SceneController
     * @description Sets the persistent ambient wash for the VR scene.
     * @param {string} url - Audio URL.
     */
    setAmbientWash(url) {
        const scene = document.querySelector('a-scene');
        if (scene && scene.is('vr-mode')) {
            this.vrAudio.setAmbientWash(url);
        }
    }

    /**
     * @method clearSpatialSources
     * @memberof SceneController
     * @description Wipes all existing spatial sources from the VR scene.
     */
    clearSpatialSources() {
        this.vrAudio.clearSpatialSources();

        const scene = document.querySelector('a-scene');
        if (scene) {
            const entities = scene.querySelectorAll('a-entity[id^="spatial-"]');
            entities.forEach(e => {
                if (e.components && e.components.sound) {
                    e.components.sound.stopSound();
                }
                e.remove();
            });
        }
    }

    /**
     * @method enterVR
     * @memberof SceneController
     * @description Orchestrates the transition from 2D DOM into the WebXR immersive session.
     * @param {string} nodeId - Target panorama identifier.
     * @param {Array<Object>} links - Topological neighbors.
     * @param {Object} nativeViewer - The underlying map SDK object.
     */
    enterVR(nodeId, links) {
        this.ensureAudioContext();
        const scene = document.querySelector('a-scene');
        const vrContainer = document.getElementById('vr-engine');
        const mapLayer = document.getElementById('map-layer');

        if (scene && vrContainer) {

            vrContainer.style.display = 'block';
            vrContainer.style.zIndex = '100';
            vrContainer.style.opacity = '1';
            vrContainer.style.pointerEvents = 'auto';
            if (mapLayer) {
                mapLayer.style.visibility = 'hidden';
                mapLayer.style.zIndex = '1'; // Push map to the background
            }

            if (nodeId) this.vrManager.updateSkybox(nodeId);

            if (links) this.updateVRNavigation(links);

            let mapWindow = document.getElementById('vr-floating-map');
            if (!mapWindow) {
                mapWindow = document.createElement('a-entity');
                mapWindow.setAttribute('id', 'vr-floating-map');

                mapWindow.setAttribute('position', '0 1.2 -1.5');
                mapWindow.setAttribute('rotation', '-15 0 0');

                mapWindow.setAttribute('geometry', 'primitive: plane; width: 1.6; height: 0.9');
                mapWindow.setAttribute('material', 'shader: flat; side: double');
                mapWindow.classList.add('raycastable');

                mapWindow.setAttribute('visible', false);

                mapWindow.setAttribute('interactive-map', 'canvasId: radar-canvas');

                scene.appendChild(mapWindow);
            }

            let wristUI = document.getElementById('vr-wrist-menu');
            if (!wristUI) {
                wristUI = document.createElement('a-entity');
                wristUI.setAttribute('id', 'vr-wrist-menu');
                wristUI.setAttribute('wrist-ui', ''); // Apply your custom component

                // Attempt to attach it to the Left Hand controller if it exists
                let leftHand = document.querySelector('[hand-controls="hand: left"]') || document.querySelector('#leftHand');

                if (leftHand) {
                    leftHand.appendChild(wristUI);
                } else {
                    // Fallback: If no hand controllers are present, attach it to the camera as a HUD
                    const camera = document.querySelector('[camera]') || document.querySelector('a-camera');
                    if (camera) {
                        // Position it slightly down and to the left of the view
                        wristUI.setAttribute('position', '-0.3 -0.3 -0.6');
                        // Re-adjust rotation so it faces the camera (overriding the -90 wrist rotation)
                        wristUI.setAttribute('rotation', '0 0 0');
                        camera.appendChild(wristUI);
                    } else {
                        scene.appendChild(wristUI); // Last resort
                    }
                }
            }
            scene.enterVR();
        }
    }
}