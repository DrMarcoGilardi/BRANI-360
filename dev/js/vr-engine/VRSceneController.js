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
import { InteractiveUI } from './InteractiveUI.js';

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
        if (typeof InteractiveUI !== 'undefined') InteractiveUI.register();
        this.setupListeners();

        this.loadUserPlugin();

        this.hudUpdateInterval = null;
    }

    loadUserPlugin() {
        try {
            import('./vr-plugin/vr-behaviours-plugin.js')
                .then(() => {
                    console.log("[ABBA-360] Custom behaviour VR logic loaded successfully.");
                })
                .catch(() => {
                });
        } catch {
            console.log("[VR Scene Controller] No behaviours plugin found. Continuing...")
        }
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
        document.addEventListener('app:request_vr_entry', () => {
            this.enterVR();
        });

        const scene = document.querySelector('a-scene');
        if (scene) {
            scene.addEventListener('enter-vr', () => {
                const cameraEl = document.querySelector('[camera]') || document.querySelector('a-camera');
                if (cameraEl) cameraEl.setAttribute('look-controls', 'enabled', true);
            });

            scene.addEventListener('exit-vr', () => {
                if (this.hudUpdateInterval) {
                    clearInterval(this.hudUpdateInterval);
                    this.hudUpdateInterval = null;
                }

                const hudEl = document.getElementById('hud');
                if (hudEl) {
                    hudEl.style.height = '';
                    hudEl.style.maxHeight = '';
                }

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

                // const pov = this.vrManager.getPOV();
                // if (pov) {
                //     document.dispatchEvent(new CustomEvent('app:sync_camera_intent', { detail: pov }));
                // }
            });
        }

        document.addEventListener('app:pov_changed', (e) => {
            this.sync2DRotation(e.detail);
        });

        document.addEventListener('app:engine_visible', (e) => {
            if (e.detail.isVisible) this.ensureAudioContext();
        });

        document.addEventListener('nav:epoch_updated', (e) => {
            this.setEpoch(e.detail.epoch);
        });

        document.addEventListener('nav:node_applied', (e) => {
            const { nodeId, links } = e.detail;
            this.updateSkybox(nodeId);
            this.updateVRNavigation(links);
        });

        document.addEventListener('app:audio_context_resume', () => {
            this.ensureAudioContext();
        });
        document.addEventListener('audio:spatial_source_added', (e) => {
            const { payload, tunnelUrl } = e.detail;
            this.addSpatialSource(payload, tunnelUrl);
        });

        document.addEventListener('vr:custom_ui_action', (event) => {
            if (event.detail.actionName === 'toggle-ui') {
                this._toggleVRHud();
            }
        });
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
                // mapWindow.classList.add('raycastable');

                mapWindow.setAttribute('visible', false);

                mapWindow.setAttribute('interactive-map', 'canvasId: map-layer');

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
                        wristUI.setAttribute('position', '-0.3 -0.3 -1.6');
                        wristUI.setAttribute('rotation', '0 0 0');
                        camera.appendChild(wristUI);
                    } else {
                        scene.appendChild(wristUI); // Last resort
                    }
                }
            }

            this._triggerHudSync();

            if (this.hudUpdateInterval) clearInterval(this.hudUpdateInterval);

            this.hudUpdateInterval = setInterval(() => {
                this._triggerHudSync();
            }, 500);

            const hudEl = document.getElementById('hud');
            if (hudEl) {
                hudEl.style.height = '350px';
                hudEl.style.maxHeight = '350px';
            }
            const vrHudPanel = document.getElementById('vr-hud-panel');
            if (vrHudPanel && !vrHudPanel.hasAttribute('html')) {
                vrHudPanel.setAttribute('html', 'html: #hud');
            }
            const vrRadarPanel = document.getElementById('vr-hud-radar');
            if (vrRadarPanel && !vrRadarPanel.hasAttribute('html')) {
                vrRadarPanel.setAttribute('html', 'html: #radar-container');
            }
            scene.enterVR();
        }
    }

    /**
     * @method _triggerHudSync
     * @memberof VRSceneController
     * @description Injects a hidden timestamp into the 2D HUD to force A-Frame's HTML component to redraw the 3D texture.
     * @private
     */
    _triggerHudSync() {
        const hud = document.getElementById('hud');
        if (!hud) return;

        let ticker = document.getElementById('htmlmesh-ticker');
        if (!ticker) {
            ticker = document.createElement('div');
            ticker.id = 'htmlmesh-ticker';
            ticker.style.opacity = '0.01';
            ticker.style.position = 'absolute';
            ticker.style.pointerEvents = 'none';
            hud.appendChild(ticker);
        }
        ticker.innerText = Date.now().toString();
    }

    /**
     * @method _toggleVRHud
     * @memberof VRSceneController
     * @description Toggles the visibility of the 3D VR Camera HUD.
     * @private
     */
    _toggleVRHud() {
        const vrHud = document.getElementById('vr-camera-hud');
        if (vrHud) {
            const isVisible = vrHud.getAttribute('visible');
            vrHud.setAttribute('visible', !isVisible);
        }
    }
}