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
 * @clas BaseViewerProvider
 * @description Abstract Strategy Pattern for 2D/360 Viewer SDKs (Google Maps, Mapillary, etc.). Standardizes event emissions and location tracking APIs.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class BaseViewerProvider{
 * <<Abstract>>
 * +supportsCameraSync boolean
 * +init() Promise~void~
 * +on(event, callback)
 * +trigger(event, data)
 * +getCurrentNodeId() string
 * +getLocation() Object
 * +isVisible() boolean
 * +getNativeViewer() Object
 * +syncCamera(pov)
 * }
 * ```
 */
export class BaseViewerProvider {
    /**
     * @param {string} containerId - The DOM ID for mounting the viewer.
     */
    constructor(containerId) {
        this.containerId = containerId;
        this.callbacks = { 'node_changed': [], 'pov_changed': [], 'visible_changed': [] };
    }

    /**
     * Initializes the underlying map SDK.
     * @returns {Promise<void>}
     * @throws {Error} If not implemented by the specific provider.
     */
    async init() { throw new Error("Not implemented"); }

    /**
     * Binds a callback to standardized viewer events (e.g., 'node_changed', 'pov_changed').
     * @param {string} event - The agnostic event name.
     * @param {Function} callback - Execution callback.
     */
    on(event, callback) { if (this.callbacks[event]) this.callbacks[event].push(callback); }

    /**
     * Safely executes attached callbacks.
     * @param {string} event - The agnostic event name.
     * @param {any} data - Event payload.
     */
    trigger(event, data) { if (this.callbacks[event]) this.callbacks[event].forEach(cb => cb(data)); }

    /** @returns {string|null} Current agnostic node ID. */
    getCurrentNodeId() { return null; }

    /** @returns {Object|string} Unified location coordinate string or object. */
    getLocation() { return "0,0"; }

    /** @returns {boolean} Whether the street level view is actively visible. */
    isVisible() { return false; }

    /** @returns {any} A raw reference to the underlying SDK map object. */
    getNativeViewer() { return null; }

    /**
     * CAPABILITY FLAG: Does this viewer support external camera syncing?
     * Override this to return true if the viewer can be programmatically rotated
     * (e.g., by UI compass clicks, Minimaps, or VR headsets).
     * @returns {boolean}
     */
    get supportsCameraSync() {
        return false;
    }

    /**
     * Optional implementation for external camera syncing.
     * Only called by the orchestrator if supportsCameraSync returns true.
     * @param {Object} pov - Standardized { heading, pitch } object
     */
    syncCamera(pov) {
        console.warn("syncCamera called but supportsCameraSync is false.");
    }
}