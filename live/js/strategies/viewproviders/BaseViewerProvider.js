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

/**
 * Abstract Strategy Pattern for 2D/360 Viewer SDKs (Google Maps, Mapillary, etc.).  
 * Standardizes event emissions and location tracking APIs.
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
 * 
 * @class
 */
export class BaseViewerProvider {
    /**
     * @constructor
     * @param {string} containerId - The DOM ID for mounting the viewer.
     */
    constructor(containerId) {
        this.containerId = containerId;
        this.callbacks = { 'node_changed': [], 'pov_changed': [], 'visible_changed': [] };
    }

    /**
     * @method on
     * @memberof BaseViewerProvider
     * @description Subscribes a listener to a standardized, agnostic viewer event.
     * @param {string} event - The normalized event name (e.g., 'node_changed', 'pov_changed').
     * @param {Function} callback - The execution closure to trigger when the event fires.
     */
    on(event, callback) { if (this.callbacks[event]) this.callbacks[event].push(callback); }

    /**
     * @method trigger
     * @memberof BaseViewerProvider
     * @description Safely executes all attached callbacks for a given agnostic event.
     * @param {string} event - The normalized event name.
     * @param {any} data - The standardized payload injected into the callback.
     */
    trigger(event, data) { if (this.callbacks[event]) this.callbacks[event].forEach(cb => cb(data)); }

    // --- ABSTRACT CONTRACT (Subclasses MUST override) ---

    /**
     * @async
     * @method init
     * @memberof BaseViewerProvider
     * @description Initializes the underlying third-party map SDK and mounts it to the DOM.
     * @returns {Promise<void>} Resolves when the viewer is fully loaded and ready for interaction.
     * @throws {Error} If not implemented by a subclass.
     */
    async init() { throw new Error("Not implemented"); }

    /**
     * @method getCurrentNodeId
     * @memberof BaseViewerProvider
     * @description Retrieves the unique identifier of the currently loaded panoramic node.
     * @returns {string} The agnostic node identifier.
     * @throws {Error} If not implemented by a subclass.
     */
    getCurrentNodeId() { throw new Error("BaseViewerProvider: 'getCurrentNodeId()' must be implemented."); }

    /**
     * @method getLocation
     * @memberof BaseViewerProvider
     * @description Extracts the geographical or spatial coordinates of the current node.
     * @returns {Object|string} Unified location coordinate string or spatial object representation.
     * @throws {Error} If not implemented by a subclass.
     */
    getLocation() { throw new Error("BaseViewerProvider: 'getLocation()' must be implemented."); }

    /**
     * @method isVisible
     * @memberof BaseViewerProvider
     * @description Checks if the street-level/360 panoramic view is currently active and visible to the user on screen.
     * @returns {boolean} True if the panorama canvas is visible.
     * @throws {Error} If not implemented by a subclass.
     */
    isVisible() { throw new Error("BaseViewerProvider: 'isVisible()' must be implemented."); }

    /**
     * @method getNativeViewer
     * @memberof BaseViewerProvider
     * @description Returns a raw, direct reference to the underlying native SDK object (e.g., the google.maps.StreetViewPanorama instance). Use with extreme caution as this breaks agnostic boundaries.
     * @returns {any} The instantiated native viewer object.
     * @throws {Error} If not implemented by a subclass.
     */
    getNativeViewer() { throw new Error("BaseViewerProvider: 'getNativeViewer()' must be implemented."); }

    // --- OPTIONAL CAPABILITIES (Subclasses CAN override) ---

    /**
     * @member {boolean} supportsCameraSync
     * @memberof BaseViewerProvider
     * @description CAPABILITY FLAG: Indicates whether this specific viewer provider allows for external programmatic control of its pitch and heading.
     * @returns {boolean} True if the viewer's camera can be synchronized by external UI modules. Defaults to false.
     */
    get supportsCameraSync() {
        return false;
    }

    /**
     * @method syncCamera
     * @memberof BaseViewerProvider
     * @description Optional implementation for external camera syncing. Called by the orchestrator (e.g., VR headsets, Minimaps) only if `supportsCameraSync` returns true.
     * @param {Object} pov - Standardized Point of View object.
     * @param {number} pov.heading - The camera yaw angle in degrees (0-360).
     * @param {number} pov.pitch - The camera pitch angle in degrees (-90 to 90).
     */
    syncCamera(pov) {
        console.warn("syncCamera called but supportsCameraSync is false.");
    }
}