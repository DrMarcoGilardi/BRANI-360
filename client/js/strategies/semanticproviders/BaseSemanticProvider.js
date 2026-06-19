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
 * Strategy Pattern Interface for semantic definitions
 * Defines what a node "means" and how the engine should behave towards those meanings.
 * Extracts layer definitions away from the core orchestration.
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class BaseSemanticProvider{
 * <<Abstract>>
 * +getActiveLayers() Array~string~
 * +getBackgroundLayers() Array~string~
 * +requiresBackgroundProcessing() boolean
 * }
 * ```
 * @class
 */
export class BaseSemanticProvider {
    /** 
     * @method getActiveLayers
     * @memberof BaseSemanticProvider
     * @description Retrieves the semantic layers required for the central user node.
     * @returns {Array<string>} An array of active layer designations (e.g., ['spatial', 'ambient']).
     */
    getActiveLayers() { return []; }

    /** 
     * @method getBackgroundLayers
     * @memberof BaseSemanticProvider
     * @description Retrieves the semantic layers required for neighboring/background nodes.
     * @returns {Array<string>} An array of background layer designations.
     */
    getBackgroundLayers() { return []; }

    /** 
     * @method requiresBackgroundProcessing
     * @memberof BaseSemanticProvider
     * @description Determines if the current strategy dictates spidering background neighbors.
     * @returns {boolean} True if background topological processing is required.
     */
    requiresBackgroundProcessing() { return false; }
}


