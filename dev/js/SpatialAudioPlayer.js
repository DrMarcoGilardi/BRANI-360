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

import { SpatialUtils } from './utilities/SpatialUtils.js';

/**
 * Manages the A-Frame/Three.js audio lifecycle for the 3D viewer.  
 * Explicitly manages 3D positional instances, local foreground washes, and neighbor background mixes.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class SpatialAudioPlayer{
 * +setSyncState(epoch, nodeId)
 * +registerPersistentAnchor(nodeId, bufferData, url) Promise~void~
 * +updatePersistentVolumes(mixRatios)
 * +toggleMutePersistent(nodeId) boolean
 * +playObjectSound(data)
 * +stopObjectSound(uniqueId)
 * +toggleMuteObject(uniqueId) boolean
 * +clearSpatialObjects()
 * +purgeAll()
 * +startGarbageCollector(treadmill)
 * }
 * ```
 * 
 * @class
 */
export class SpatialAudioPlayer {
    /**
     * @constructor
     */
    constructor(config, semanticProvider) {
        this.semanticProvider = semanticProvider;
        this.manifest = semanticProvider.getLayerManifest();
        this.audioSources = new Map();

        for (const [layerId, config] of Object.entries(this.manifest)) {
            if (config.persistent) this.audioSources.set(layerId, new Map());
        }

        this.spatialSources = new Map();
        this.activeSpatialLabels = new Set();

        this.mutedPersistent = new Set();
        this.mutedSpatial = new Set();

        this.currentEpoch = 0;
        this.currentNodeId = null;

        const {
            masterNeighborGain: neighborGain,
            masterLocalGain: localGain,
            masterObjectGain: objectGain
        } = config.audioParams

        this.masterNeighborGain = !isNaN(parseFloat(neighborGain)) ? parseFloat(neighborGain) : console.error("\x1b[31m [SpatialAusioPlayer][ERROR] neighborGain is NaN \x1b[0m");
        this.masterLocalGain = !isNaN(parseFloat(localGain)) ? parseFloat(localGain) : console.error("\x1b[31m [SpatialAusioPlayer][ERROR] localGain is NaN \x1b[0m");
        this.masterObjectGain = !isNaN(parseFloat(objectGain)) ? parseFloat(objectGain) : console.error("\x1b[31m [SpatialAusioPlayer][ERROR] objectGain is NaN \x1b[0m");
    }

    /**
     * @method setSyncState
     * @memberof SpatialAudioPlayer
     * @description Locks the player to the current navigation epoch to prevent stale audio playback.
     * @param {number} epoch - Active epoch tick.
     * @param {string} nodeId - Active node ID.
     */
    setSyncState(epoch, nodeId) {
        this.currentEpoch = epoch;
        this.currentNodeId = nodeId;
    }

    /**
     * @method getMimeType
     * @memberof SpatialAudioPlayer
     * @description Deduces the browser-friendly MIME type from a given file URL.
     * @param {string} url - Audio endpoint URL.
     * @returns {string} Proper MIME type string.
     */
    getMimeType(url) {
        if (!url) return 'audio/wav';
        const cleanUrl = url.split('?')[0].toLowerCase();
        if (cleanUrl.endsWith('.ogg')) return 'audio/ogg';
        if (cleanUrl.endsWith('.webm')) return 'audio/webm';
        if (cleanUrl.endsWith('.mp3')) return 'audio/mpeg';
        return 'audio/wav';
    }

    /**
     * @method getSafeArrayBuffer
     * @memberof SpatialAudioPlayer
     * @description Ensures memory stability by extracting a clean slice from an ArrayBuffer wrapper.
     * @param {ArrayBuffer|Object} bufferData - The raw HTTP payload.
     * @returns {ArrayBuffer|null}
     */
    getSafeArrayBuffer(bufferData) {
        if (!bufferData) return null;
        if (bufferData instanceof ArrayBuffer) return bufferData.slice(0);
        if (bufferData.buffer instanceof ArrayBuffer) return bufferData.buffer.slice(0);
        return null;
    }

    // --- PERSISTENT AUDIO (FOREGROUND & BACKGROUND) ---
    /**
     * @method registerPersistentAnchor
     * @memberof SpatialAudioPlayer
     * @description Mounts a persistent ambient track (Foreground or Background) into the 3D scene. Foreground sounds are local to the current node, while background sounds are from neighboring nodes.
     * @param {string} nodeId - Target node identifier.
     * @param {ArrayBuffer} bufferData - Raw audio data.
     * @param {string} url - Origin URL used for MIME resolution.
     * @returns {Promise<void>}
     */
    async registerPersistentAnchor(nodeId, layerId, bufferData, url) {
        if (!this.manifest || !this.manifest[layerId]) {
            console.warn(`[Audio] Layer ${layerId} not defined in manifest. Dropping audio.`);
            return;
        }

        const targetMap = this.audioSources.get(layerId);
        if (!targetMap) return;

        if (targetMap.has(nodeId)) {
            const current = targetMap.get(nodeId);
            if (current.entity) this._cleanupEntity(current);
            targetMap.delete(nodeId);
        }

        const safeBuffer = this.getSafeArrayBuffer(bufferData);
        if (!safeBuffer) throw new Error("Invalid buffer");

        const blob = new Blob([safeBuffer], { type: this.getMimeType(url) });
        const blobUrl = URL.createObjectURL(blob);

        const el = document.createElement('a-entity');
        el.id = `${layerId}-${nodeId}`;

        el.setAttribute('sound', {
            src: blobUrl,
            autoplay: true,
            loop: true,
            volume: 0,
            positional: false
        });

        const scene = document.querySelector('a-scene');
        scene.appendChild(el);

        targetMap.set(nodeId, { entity: el, blobUrl, url, layerId });
        console.log(`[Audio] Registered Wash (${layerId}): ${nodeId}`);
    }

    /**
     * @method updatePersistentVolumes
     * @memberof SpatialAudioPlayer
     * @description Dynamically shifts background layer volumes based on mathematical distance logic provided by the Acoustic Treadmill.
     * @param {Array<Object>} mixRatios - Array of objects dictating {id, weight}.
     */
    updatePersistentVolumes(mixRatios) {
        const manifest = this.semanticProvider?.getLayerManifest() || {};

        for (const [layerId, layerMap] of this.audioSources.entries()) {

            const behavior = manifest[layerId]?.behavior || 'local';
            const masterMultiplier = behavior === 'neighbor' ? this.masterNeighborGain : this.masterLocalGain;
            const safeMasterGain = !isNaN(masterMultiplier) ? masterMultiplier : 1.0;

            for (const [nodeId, anchorData] of layerMap.entries()) {
                const mix = mixRatios.find(m => String(m.id) === String(nodeId) && m.layerId === layerId);
                let targetVolume = 0;

                if (mix && isFinite(mix.weight)) {
                    targetVolume = parseFloat(mix.weight) * safeMasterGain;
                }

                anchorData.lastTargetVolume = targetVolume;

                if (this.mutedPersistent.has(nodeId)) {
                    this.fadeEntityVolume(anchorData.entity, 0, 500);
                    continue;
                }

                console.log(`Target Volume ${targetVolume}`);
                this.fadeEntityVolume(anchorData.entity, targetVolume, 750);
            }
        }
    }

    /**
     * @method toggleMutePersistent
     * @memberof SpatialAudioPlayer
     * @description Toggles mute state for continuous ambient washes, applying smooth transitions.
     * @param {string} nodeId - Identifier for the persistent layer.
     * @returns {boolean} True if the layer is now muted.
     */
    toggleMutePersistent(nodeId) {
        let isNowMuted = false;

        const isMuted = this.mutedPersistent.has(nodeId);

        if (isMuted) {
            this.mutedPersistent.delete(nodeId);
            isNowMuted = false;
        } else {
            this.mutedPersistent.add(nodeId);
            isNowMuted = true;
        }

        // Apply mute/unmute transition across all dynamic maps
        for (const layerMap of this.audioSources.values()) {
            if (layerMap.has(nodeId)) {
                const anchorData = layerMap.get(nodeId);
                if (isNowMuted) {
                    this.fadeEntityVolume(anchorData.entity, 0, 0);
                } else {
                    const restoreVol = anchorData.lastTargetVolume || 0;
                    this.fadeEntityVolume(anchorData.entity, restoreVol, 0);
                }
            }
        }
        return isNowMuted;
    }

    // --- TRANSIENT / SPATIAL AUDIO ---
    /**
     * @method playObjectSound
     * @memberof SpatialAudioPlayer
     * @description Generates a spatially placed 3D audio entity based on VLM coordinates.
     * @param {Object} data - Object configuration payload {id, buffer, h, p, dist, isPlaceholder}.
     */
    playObjectSound(data) {
        if (data.navEpoch !== undefined && data.navEpoch < this.currentEpoch) return;
        if (data.persistent) return;

        const targetId = data.nodeId;
        if (targetId && targetId !== this.currentNodeId) return;

        const uniqueId = data.id
        const label = data.displayName || data.label || 'Unknown';

        if (this.spatialSources.has(uniqueId)) {
            this.stopObjectSound(uniqueId);
        }

        const safeBuffer = this.getSafeArrayBuffer(data.audioBuffer);
        if (!safeBuffer) return;

        const blob = new Blob([safeBuffer], { type: this.getMimeType(data.url) });
        const blobUrl = URL.createObjectURL(blob);

        const el = document.createElement('a-entity');

        el.id = `object-${uniqueId.replace(/[^a-zA-Z0-9]/g, '')}`;

        const rawH = parseFloat(data.h);
        const rawP = parseFloat(data.p);
        const rawDist = parseFloat(data.dist);

        const safeH = isNaN(rawH) ? 0 : rawH;
        const safeP = isNaN(rawP) ? 90 : rawP;

        const safeDist = isNaN(rawDist) ? 10 : Math.max(0.1, rawDist);

        const cartesian = SpatialUtils.sphericalToCartesian(safeH, safeP, safeDist);
        el.setAttribute('position', `${cartesian.x} ${cartesian.y} ${cartesian.z}`);

        const initialGain = this.mutedSpatial.has(uniqueId) ? 0 : (data.isPlaceholder ? 0.2 : this.masterObjectGain);

        el.setAttribute('sound', {
            src: blobUrl,
            autoplay: true,
            loop: true,
            volume: initialGain,
            distanceModel: 'inverse',
            refDistance: 2,
            maxDistance: 50,
            rolloffFactor: 1,
            positional: true
        });

        const scene = document.querySelector('a-scene');
        scene.appendChild(el);

        this.spatialSources.set(uniqueId, { entity: el, blobUrl, initialGain, label });
        this.activeSpatialLabels.add(uniqueId);
        console.log(`[Audio] Playing Spatial Object: ${label} (ID: ${uniqueId})`);
    }

    /**
     * @method stopObjectSound
     * @memberof SpatialAudioPlayer
     * @description Halts a specific object sound and removes its entity from the scene.
     * @param {string} uniqueId - Target spatial object identifier.
     */
    stopObjectSound(uniqueId) {
        if (this.spatialSources.has(uniqueId)) {
            const data = this.spatialSources.get(uniqueId);
            this._cleanupEntity(data);
            this.spatialSources.delete(uniqueId);
            this.activeSpatialLabels.delete(uniqueId);
        }
    }

    /**
     * @method _cleanupEntity
     * @memberof SpatialAudioPlayer
     * @description Internal destruction helper for active A-Frame sound entities.
     * @private
     */
    _cleanupEntity(data) {
        const el = data?.entity;
        if (el) {
            // Stop any running crossfades before destroying the object
            if (el._fadeInterval) {
                clearInterval(el._fadeInterval);
                el._fadeInterval = null;
            }
            if (el.parentNode) {
                if (el.components && el.components.sound) el.components.sound.stopSound();
                el.parentNode.removeChild(el);
            }
        }
        if (data?.blobUrl) URL.revokeObjectURL(data.blobUrl);
    }

    /**
     * @method clearSpatialObjects
     * @memberof SpatialAudioPlayer
     * @description Removes all spatial objects and localized foreground washes, resetting state for a new node hop.
     */
    clearSpatialObjects() {
        this.activeSpatialLabels.clear();
        this.spatialSources.forEach((obj, uniqueId) => {
            this.stopObjectSound(uniqueId);
        });
        this.spatialSources.clear();

        if (this.manifest) {
            for (const [layerId, config] of Object.entries(this.manifest)) {
                if (config.behavior === 'local') {
                    const map = this.audioSources.get(layerId);
                    if (map) {
                        map.forEach((obj) => this._cleanupEntity(obj));
                        map.clear();
                    }
                }
            }
        }

        const scene = document.querySelector('a-scene');
        if (scene) {
            const allEntities = scene.querySelectorAll('a-entity[sound]');
            allEntities.forEach(el => {
                if (el.id.startsWith('object-') || (this.manifest && Object.keys(this.manifest).some(layer => el.id.startsWith(`${layer}-`)))) {
                    this._cleanupEntity({ entity: el });
                }
            });
        }

        this.mutedSpatial.clear();
        this.mutedPersistent.clear();
    }

    /**
     * @method toggleMuteObject
     * @memberof SpatialAudioPlayer
     * @description Immediately toggles the volume of a localized spatial object entity.
     * @param {string} uniqueId - Target spatial object identifier.
     * @returns {boolean} True if the object is now muted.
     */
    toggleMuteObject(uniqueId) {
        if (this.mutedSpatial.has(uniqueId)) {
            this.mutedSpatial.delete(uniqueId);
            const obj = this.spatialSources.get(uniqueId);
            if (obj && obj.entity) obj.entity.setAttribute('sound', 'volume', obj.initialGain);
            return false;
        } else {
            this.mutedSpatial.add(uniqueId);
            const obj = this.spatialSources.get(uniqueId);
            if (obj && obj.entity) obj.entity.setAttribute('sound', 'volume', 0);
            return true;
        }
    }

    /**
     * @method fadeEntityVolume
     * @memberof SpatialAudioPlayer
     * @description Interpolates A-Frame audio volume over time to prevent popping.
     * @param {HTMLElement} entity - The A-Frame DOM element.
     * @param {number} targetVolume - Target normalized gain (0.0 to 1.0).
     * @param {number} [durationMs=2000] - Duration of the crossfade.
     */
    fadeEntityVolume(entity, targetVolume, durationMs = 2000) {
        if (!entity) return;

        if (entity._fadeInterval) clearInterval(entity._fadeInterval);

        if (!entity.components || !entity.components.sound) {
            setTimeout(() => this.fadeEntityVolume(entity, targetVolume, durationMs), 50);
            return;
        }

        let currentVol = parseFloat(entity.getAttribute('sound').volume);
        if (isNaN(currentVol)) currentVol = 0;

        const steps = 20;
        const stepTime = durationMs / steps;
        const volDelta = (targetVolume - currentVol) / steps;

        let currentStep = 0;
        entity._fadeInterval = setInterval(() => {
            currentStep++;
            currentVol += volDelta;

            if (!entity.parentNode) {
                clearInterval(entity._fadeInterval);
                return;
            }

            entity.setAttribute('sound', 'volume', currentVol);

            if (currentStep >= steps) {
                clearInterval(entity._fadeInterval);
                entity.setAttribute('sound', 'volume', targetVolume);
            }
        }, stepTime);
    }

    /**
     * @method purgeAll
     * @memberof SpatialAudioPlayer
     * @description Command to wipe ALL audio tracking layers.
     */
    purgeAll() {
        this.clearSpatialObjects();

        if (this.manifest) {
            for (const layerMap of this.audioSources.values()) {
                layerMap.forEach((obj) => this._cleanupEntity(obj));
                layerMap.clear();
            }
        }

        if (this.gcInterval) {
            clearInterval(this.gcInterval);
            this.gcInterval = null;
        }

        console.log("[Audio] Fully purged all audio layers on exit.");
    }

    // --- LIFECYCLE ---
    /**
     * @method startGarbageCollector
     * @memberof SpatialAudioPlayer
     * @description Initializes a periodic garbage collection loop to remove stale background sounds that are no longer referenced by the AcousticTreadmill.
     * @param {AcousticTreadmill} treadmill - The active topology tracking reference.
     */
    startGarbageCollector(treadmill) {
        if (this.gcInterval) clearInterval(this.gcInterval);

        this.gcInterval = setInterval(() => {
            const activeIds = treadmill?.anchorTracker?.expectedIds || [];

            if (this.manifest) {
                for (const [layerId, config] of Object.entries(this.manifest)) {
                    if (config.behavior === 'neighbor') {
                        const layerMap = this.audioSources.get(layerId);
                        if (!layerMap) continue;

                        for (const [nodeId, anchorData] of layerMap.entries()) {
                            if (!activeIds.includes(nodeId) && nodeId !== this.currentNodeId) {
                                const el = anchorData.entity;
                                if (el && el.components && el.components.sound) {
                                    let currentVol = parseFloat(el.getAttribute('sound').volume);
                                    if (isNaN(currentVol)) currentVol = 0;
                                    const fadeOut = setInterval(() => {
                                        currentVol -= 0.05;
                                        if (currentVol <= 0) {
                                            clearInterval(fadeOut);
                                            this._cleanupEntity(anchorData);
                                            layerMap.delete(nodeId);
                                            console.log(`[Audio GC] Purged stale ${layerId}: ${nodeId}`);
                                        } else {
                                            el.setAttribute('sound', 'volume', currentVol);
                                        }
                                    }, 100);
                                } else {
                                    this._cleanupEntity(anchorData);
                                    layerMap.delete(nodeId);
                                }
                            }
                        }
                    }
                }
            }
        }, 5000);
    }
}