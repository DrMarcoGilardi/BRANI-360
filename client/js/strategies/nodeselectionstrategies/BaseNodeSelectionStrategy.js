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
 * Strategy Pattern Interface for Node Selection.  
 * Determines the logical importance of a node within the topological graph.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class BaseNodeSelectionStrategy{
 * <<Abstract>>
 * +isAnchor(nodeId, radar) Promise~boolean~
 * +reset()
 * }
 * ```
 * 
 * @class
 */
export class BaseNodeSelectionStrategy {
    /**
     * @async
     * @method isAnchor
     * @memberof BaseNodeSelectionStrategy
     * @description Evaluates whether a specific node should act as an acoustic anchor.
     * @param {string} nodeId - The unique identifier for the node.
     * @param {TopologyRadar} radar - The active TopologyRadar instance for neighborhood context.
     * @returns {Promise<boolean>} True if the node is an anchor, false otherwise.
     * @throws {Error} If not implemented by the specific provider.
     */
    async isAnchor(nodeId, radar) { throw new Error("[NODE SELECTION STRATEGY] isAnchor() must be implemented."); }

    /**
     * @method reset
     * @memberof BaseNodeSelectionStrategy
     * @description Optional state cleanup triggered when the engine resets.
     */
    reset() { /* Optional state cleanup */ }
}