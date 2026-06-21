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
    constructor(config) {
        this.spatialSources = new Map();
        this.foregroundSources = new Map();
        this.backgroundSources = new Map();

        this.activeSpatialLabels = new Set();
        this.mutedPersistent = new Set();
        this.mutedSpatial = new Set();

        const {
            masterBackgroundGain: backGain,
            masterForegroundGain: foreGain,
            masterSpatialGain: spatialGain
        } = config.audioGains

        this.masterBackgroundGain = parseFloat(backGain);
        this.masterForegroundGain = parseFloat(foreGain);
        this.masterSpatialGain = parseFloat(spatialGain);

        this.currentEpoch = 0;
        this.currentNodeId = null;
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
    async registerPersistentAnchor(nodeId, bufferData, url) {
        // Determine if this is a foreground sound or a background sound.
        const isForeground = (nodeId === this.currentNodeId);
        const targetMap = isForeground ? this.foregroundSources : this.backgroundSources;
        const prefix = isForeground ? 'foreground-wash' : 'background';

        if (isForeground && this.backgroundSources.has(nodeId)) {
            console.log(`[Audio] Promoting Background to Foreground: ${nodeId}`);
            const existing = this.backgroundSources.get(nodeId);
            this.backgroundSources.delete(nodeId);

            existing.entity.id = `${prefix}-${nodeId}`;
            targetMap.set(nodeId, existing);

            const targetVol = this.mutedPersistent.has(nodeId) ? 0 : this.masterForegroundGain;
            console.log(targetVol);
            this.fadeEntityVolume(existing.entity, targetVol, 2000); // 2-second swell
            return;
        }

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
        el.id = `${prefix}-${nodeId}`;

        el.setAttribute('sound', {
            src: blobUrl,
            autoplay: true,
            loop: true,
            volume: 0,
            positional: false
        });

        const scene = document.querySelector('a-scene');
        scene.appendChild(el);

        targetMap.set(nodeId, { entity: el, blobUrl, url });
        console.log(`[Audio] Registered ${isForeground ? 'Foreground' : 'Background'} Wash: ${nodeId}`);
    }

    /**
     * @method updatePersistentVolumes
     * @memberof SpatialAudioPlayer
     * @description Dynamically shifts background layer volumes based on mathematical distance logic provided by the Acoustic Treadmill.
     * @param {Array<Object>} mixRatios - Array of objects dictating {id, weight}.
     */
    updatePersistentVolumes(mixRatios) {
        const applyVolumes = (sourceMap, masterGain) => {
            const safeMasterGain = !isNaN(masterGain) ? masterGain : 1.0;

            for (const [nodeId, anchorData] of sourceMap.entries()) {
                const mix = mixRatios.find(m => String(m.id) === String(nodeId));
                let targetVolume = 0; // Default to 0

                if (mix && isFinite(mix.weight)) {
                    targetVolume = parseFloat(mix.weight * safeMasterGain);
                    if (isNaN(targetVolume) || !isFinite(targetVolume)) targetVolume = 0;
                } else if (sourceMap === this.foregroundSources && !mix) {
                    targetVolume = safeMasterGain;
                }

                anchorData.lastTargetVolume = targetVolume;

                if (this.mutedPersistent.has(nodeId)) {
                    this.fadeEntityVolume(anchorData.entity, 0, 500);
                    continue;
                }

                this.fadeEntityVolume(anchorData.entity, targetVolume, 750);
            }
        };

        applyVolumes(this.backgroundSources, this.masterBackgroundGain);
        applyVolumes(this.foregroundSources, this.masterForegroundGain);
    }

    /**
     * @method toggleMutePersistent
     * @memberof SpatialAudioPlayer
     * @description Toggles mute state for continuous ambient washes, applying smooth transitions.
     * @param {string} nodeId - Identifier for the persistent layer.
     * @returns {boolean} True if the layer is now muted.
     */
    toggleMutePersistent(nodeId) {
        const isMuted = this.mutedPersistent.has(nodeId);

        if (isMuted) {
            this.mutedPersistent.delete(nodeId);
        } else {
            this.mutedPersistent.add(nodeId);
        }

        const isNowMuted = !isMuted;

        if (this.foregroundSources.has(nodeId)) {
            const el = this.foregroundSources.get(nodeId).entity;
            this.fadeEntityVolume(el, isNowMuted ? 0 : this.masterForegroundGain, 0);
        }

        if (this.backgroundSources.has(nodeId)) {
            const anchorData = this.backgroundSources.get(nodeId);
            if (isNowMuted) {
                this.fadeEntityVolume(anchorData.entity, 0, 0);
            } else {
                const restoreVol = anchorData.lastTargetVolume || 0;
                this.fadeEntityVolume(anchorData.entity, restoreVol, 0);
            }
        }
        return !isMuted;
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

        el.id = `foreground-${uniqueId.replace(/[^a-zA-Z0-9]/g, '')}`;

        const rawH = parseFloat(data.h);
        const rawP = parseFloat(data.p);
        const rawDist = parseFloat(data.dist);

        const safeH = isNaN(rawH) ? 0 : rawH;
        const safeP = isNaN(rawP) ? 90 : rawP;

        // Ensure distance is never exactly 0, which would cause an Infinity divide-by-zero crash
        const safeDist = isNaN(rawDist) ? 10 : Math.max(0.1, rawDist);

        const cartesian = SpatialUtils.sphericalToCartesian(safeH || 0, safeP || 90, safeDist || 10);
        el.setAttribute('position', `${cartesian.x} ${cartesian.y} ${cartesian.z}`);

        const initialGain = this.mutedSpatial.has(uniqueId) ? 0 : (data.isPlaceholder ? 0.2 : this.masterSpatialGain);

        el.setAttribute('sound', {
            src: blobUrl,
            autoplay: true,
            loop: true,
            volume: initialGain,
            distanceModel: 'inverse',
            refDistance: 2,
            maxDistance: 50,
            rolloffFactor: 1 // True 3D Audio
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
            this.activeSpatialLabels.add(uniqueId);
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
        const scene = document.querySelector('a-scene');
        if (scene) {
            const allEntities = scene.querySelectorAll('a-entity[id^="foreground-"]');
            allEntities.forEach(el => {
                if (!el.id.startsWith('foreground-wash-')) {
                    this._cleanupEntity({ entity: el });
                }
            });
        }

        // Clean up Foreground Wash when leaving the node!
        // Because they are local, they must die when you navigate away.
        this.foregroundSources.forEach((obj, nodeId) => {
            this._cleanupEntity(obj);
        });
        this.foregroundSources.clear();

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

        // Clear any existing fade to prevent tug-of-war
        if (entity._fadeInterval) clearInterval(entity._fadeInterval);

        // Wait for A-Frame to attach the component if it's a newly created entity
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

            // Guard against the entity being deleted during the crossfade
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
        // 1. Clear foregrounds and spatials
        this.clearSpatialObjects();

        // 2. Destroy all background washes which survive normal navigation
        this.backgroundSources.forEach((obj, nodeId) => {
            this._cleanupEntity(obj);
        });
        this.backgroundSources.clear();

        // 3. Kill the background garbage collector loop
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

            // GC only touches Background sources. Foreground sources are cleaned
            // instantly in clearSpatialObjects() when navigating.
            for (const [nodeId, anchorData] of this.backgroundSources.entries()) {
                if (!activeIds.includes(nodeId) && nodeId !== this.currentNodeId) {

                    const el = anchorData.entity;
                    if (el && el.components.sound) {
                        let currentVol = parseFloat(el.getAttribute('sound').volume);
                        if (isNaN(currentVol)) currentVol = 0;
                        const fadeOut = setInterval(() => {
                            currentVol -= 0.05;
                            if (currentVol <= 0) {
                                clearInterval(fadeOut);
                                this._cleanupEntity(anchorData);
                                this.backgroundSources.delete(nodeId);
                                console.log(`[Audio GC] Purged stale Background: ${nodeId}`);
                            } else {
                                el.setAttribute('sound', 'volume', currentVol);
                            }
                        }, 100);
                    } else {
                        this._cleanupEntity(anchorData);
                        this.backgroundSources.delete(nodeId);
                    }
                }
            }
        }, 5000);
    }
}