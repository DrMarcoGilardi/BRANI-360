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
 * Strategy Pattern Interface for semantic definitions.  
 * Defines what a node "means" and how the engine should behave towards those meanings.  
 * Extracts layer definitions away from the core orchestration.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class BaseSemanticProvider{
 * <<Abstract>>
 * +getLayerManifest() Object
 * +onChange(callback)
 * +notifyListeners()
 * }
 * ```
 * 
 * @class
 */
export class BaseSemanticProvider {
    /**
     * @method getLayerManifest
     * @memberof BaseSemanticProvider
     * @description Returns the agnostic ruleset for active semantic layers.
     * @returns {Object} Manifest dictating layer behavior, persistence, and mix weights.
     * @throws {Error} If not implemented by a subclass.
     */
    getLayerManifest() {
        throw new Error("BaseSemanticProvider: Method 'getLayerManifest()' must be implemented by subclass.");
    }

    /**
     * @method onChange
     * @memberof BaseSemanticProvider
     * @description Subscribes a listener function to be executed whenever the active layers change.
     * @param {Function} callback - The function to execute on layer change.
     */
    onChange(callback) { }

    /**
     * @method notifyListeners
     * @memberof BaseSemanticProvider
     * @description Iterates through and executes all subscribed change listeners.
     */
    notifyListeners() { }
}