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
import { BaseSemanticProvider } from "./BaseSemanticProvider.js";

/**
 * @class DefaultSemanticProvider
 * @description EXAMPLE STRATEGY IMPLEMENTATION Default Semantic Strategy. Implements the standard base layers: ambient, spatial, and horizon.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * BaseSemanticProvider <|-- DefaultSemanticProvider
 * class DefaultSemanticProvider{
 * +setLayers(layers)
 * +onChange(callback)
 * +notifyListeners()
 * +getActiveLayers() Array~string~
 * +getBackgroundLayers() Array~string~
 * +requiresBackgroundProcessing() boolean
 * }
 * ```
 * @class
 */
export class DefaultSemanticProvider extends BaseSemanticProvider {
    /**
     * @constructor Initializes the provider with an array of active semantic layers.
     * @param {Array<string>} [initialLayers=['ambient', 'spatial', 'horizon']] - The default layers to evaluate during navigation.
     */
    constructor(initialLayers = ['ambient', 'spatial', 'horizon']) {
        super();
        this.layers = initialLayers;
        this.listeners = [];
    }

    /**
     * @method setLayers
     * @memberof DefaultSemanticProvider
     * @description Allows developers or the UI to dynamically change the semantic meaning of the session at runtime.
     * @param {Array<string>} layers - Array of new semantic layer strings (e.g., ['ambient', 'weather']).
     */
    setLayers(layers) {
        this.layers = layers;
        this.notifyListeners();
    }

    /**
     * @method onChange
     * @memberof DefaultSemanticProvider
     * @description Subscribes a listener function to be executed whenever the active layers change.
     * @param {Function} callback - The function to execute on layer change.
     */
    onChange(callback) {
        this.listeners.push(callback);
    }

    /**
     * @method notifyListeners
     * @memberof DefaultSemanticProvider
     * @description Iterates through and executes all subscribed change listeners.
     */
    notifyListeners() {
        this.listeners.forEach(cb => cb(this.layers));
    }

    /**
     * @method getActiveLayers
     * @memberof DefaultSemanticProvider
     * @description Retrieves the semantic layers required for the central user node.
     * @returns {Array<string>} The currently active semantic layers.
     */
    getActiveLayers() {
        return this.layers;
    }

    /**
     * @method getBackgroundLayers
     * @memberof DefaultSemanticProvider
     * @description Retrieves the semantic layers meant for background or neighboring nodes.
     * @returns {Array<string>} The active background semantic layers.
     */
    getBackgroundLayers() {
        return this.layers;
    }

    /**
     * @method requiresBackgroundProcessing
     * @memberof DefaultSemanticProvider
     * @description Determines if the current strategy dictates spidering background neighbors.
     * @returns {boolean} True if the engine should process acoustic data for topological neighbors.
     */
    requiresBackgroundProcessing() {
        return this.layers.includes('horizon');
    }
}