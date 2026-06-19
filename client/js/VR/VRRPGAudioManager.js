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

import { SpatialUtils } from '../Utilities/SpatialUtils.js';

/**
 * VRRPGAudioManager: Manages A-Frame sound entities.
 * Places "organic" and "mechanical" sounds physically in the 3D space.
 */
export class VRRPGAudioManager {
    /**
     * @constructor
     * @description Initializes the VRRPGAudioManager.
     */
    constructor() {
        this.treadmill = document.getElementById('audio-treadmill');
        this.ambientPool = document.getElementById('ambient-pool');
    }

    /**
     * @method addSpatialSource
     * @memberof VRRPGAudioManager
     * @description Creates or updates a spatial audio entity based on VLM coordinates.
     * @param {string} id - Unique identifier for the sound.
     * @param {string} label - Display label.
     * @param {string} audioUrl - Source URL.
     * @param {Object} spatialData - Spherical coordinates { h, p, dist }.
     */
    addSpatialSource(id, label, audioUrl, spatialData) {
        const { h, p, dist } = spatialData;
        const pos = SpatialUtils.sphericalToCartesian(h, p, dist);

        let entity = document.getElementById(`source-${id}`);
        if (!entity) {
            entity = document.createElement('a-entity');
            entity.setAttribute('id', `source-${id}`);
            this.treadmill.appendChild(entity);
        }

        // Positional audio settings
        // y is offset by 1.6 to align horizon with average eye/ear level
        entity.setAttribute('position', `${pos.x} ${pos.y + 1.6} ${pos.z}`);
        entity.setAttribute('sound', {
            src: audioUrl,
            autoplay: true,
            loop: true,
            distanceModel: 'exponential',
            rolloffFactor: 1.5,
            refDistance: 1,
            positional: true
        });
        
        // Helpful for debugging in development
        // entity.setAttribute('geometry', 'primitive: sphere; radius: 0.2');
        // entity.setAttribute('material', 'color: yellow; opacity: 0.5');
    }

    /**
     * @method setAmbientWash
     * @memberof VRRPGAudioManager
     * @description Mounts a non-positional ambient wash to the VR scene.
     * @param {string} audioUrl - Source URL.
     */
    setAmbientWash(audioUrl) {
        if (!this.ambientPool) return;
        this.ambientPool.setAttribute('sound', {
            src: audioUrl,
            autoplay: true,
            loop: true,
            positional: false,
            volume: 0.5
        });
    }

    /**
     * @method clearSpatialSources
     * @memberof VRRPGAudioManager
     * @description Destroys all currently mounted spatial sources.
     */
    clearSpatialSources() {
        if (!this.treadmill) return;
        while (this.treadmill.firstChild) {
            this.treadmill.removeChild(this.treadmill.firstChild);
        }
    }
}