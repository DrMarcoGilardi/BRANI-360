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

import { BaseNodeSelectionStrategy } from "./BaseNodeSelectionStrategy.js";

/**
 * EXAMPLE STRATEGY IMPLEMENTATION  
 * Enforces strict Min 3 / Max 6 spacing across topological graphs.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * BaseNodeSelectionStrategy <|-- AcousticHorizonStrategy
 * class AcousticHorizonStrategy{
 * +reset()
 * +isAnchor(nodeId, radar) Promise~boolean~
 * }
 * ```
 * 
 * @class 
 */
export class AcousticHorizonStrategy extends BaseNodeSelectionStrategy {
    /**
     * @constructor
     */
    constructor(clientConfig = {}) {
        super();
        this.MIN_SPACING = parseInt(clientConfig?.options?.MIN_SPACING, 10);
        this.MAX_GAP = parseInt(clientConfig?.options?.MAX_GAP, 10);
        this.isSpatiallyContinuous = (clientConfig?.audioParams?.spatiallyContinuous === 'true');
        this.gapFillerCache = new Map();
        this.MAX_STRATEGY_CACHE = 1000;
    }

    /**
     * @method reset
     * @memberof AcousticHorizonStrategy
     * @description Clears cached topological logic decisions to free memory.
     */
    reset() {
        this.gapFillerCache.clear();
    }

    /**
     * @method _enforceCacheLimit
     * @memberof AcousticHorizonStrategy
     * @description Prevents the internal strategy cache from growing infinitely. Drops the oldest entry if size exceeds MAX_STRATEGY_CACHE.
     * @private
     */
    _enforceCacheLimit() {
        if (this.gapFillerCache.size > this.MAX_STRATEGY_CACHE) {
            const oldestKey = this.gapFillerCache.keys().next().value;
            this.gapFillerCache.delete(oldestKey);
        }
    }

    /**
     * @async
     * @method isAnchor
     * @memberof AcousticHorizonStrategy
     * @description Evaluates whether a specific node should act as an acoustic anchor.
     * @param {string} nodeId - The target node to evaluate.
     * @param {TopologyRadar} radar - The active TopologyRadar dependency.
     * @returns {Promise<boolean>} True if the node qualifies as an anchor.
     */
    async isAnchor(nodeId, radar) {
        if (!this.isSpatiallyContinuous) {
            return true;
        }

        const neighborhood = await radar._getNeighborhood(nodeId, this.MAX_GAP);

        // 1. Isolated Component Logic (The Island Rule)
        if (neighborhood.size < this.MIN_SPACING) {
            let hasMoreLinks = false;
            for (const id of neighborhood.keys()) {
                const data = await radar._getNode(id);
                if (data?.links?.some(link => !neighborhood.has(link.id))) {
                    hasMoreLinks = true;
                    break;
                }
            }
            if (!hasMoreLinks) {
                const sortedNodes = Array.from(neighborhood.keys()).sort((a, b) => radar.hashNodeId(b) - radar.hashNodeId(a));
                return nodeId === sortedNodes[0];
            }
        }

        if (await this._isBaseAnchor(nodeId, radar)) return true;
        return await this._isGapFiller(nodeId, radar);
    }

    /**
     * @async
     * @method _getScore
     * @memberof AcousticHorizonStrategy
     * @description Computes an algorithmic score for a node based on connectivity and hash logic.
     * @param {string} id - Node ID.
     * @param {TopologyRadar} radar - Radar reference.
     * @returns {Promise<number>} Node importance score (Infinity if low importance).
     * @private
     */
    async _getScore(id, radar) {
        const data = await radar._getNode(id);
        if (data?.links?.length <= 1) return Infinity;
        return radar.hashNodeId(id);
    }

    /**
     * @async
     * @method _isBaseAnchor
     * @memberof AcousticHorizonStrategy
     * @description Checks if the node acts as a primary base anchor within its direct neighborhood.
     * @param {string} id - Target node.
     * @param {TopologyRadar} radar - Radar reference.
     * @returns {Promise<boolean>}
     * @private
     */
    async _isBaseAnchor(id, radar) {
        const myScore = await this._getScore(id, radar);
        const localNeighborhood = await radar._getNeighborhood(id, this.MIN_SPACING - 1);
        for (const neighborId of localNeighborhood.keys()) {
            if (neighborId === id) continue;
            const neighborScore = await this._getScore(neighborId, radar);
            if (neighborScore > myScore || (neighborScore === myScore && neighborId > id)) return false;
        }
        return true;
    }

    /**
     * @async
     * @method _isGapFiller
     * @memberof AcousticHorizonStrategy
     * @description Determines if a node is forced to act as an anchor to prevent acoustic dead zones.
     * @param {string} currentId - Target node.
     * @param {TopologyRadar} radar - Radar reference.
     * @returns {Promise<boolean>}
     * @private
     */
    async _isGapFiller(currentId, radar) {
        if (this.gapFillerCache.has(currentId)) return this.gapFillerCache.get(currentId);

        const gapSearchRadius = Math.floor(this.MAX_GAP / 2);
        const localNhood = await radar._getNeighborhood(currentId, gapSearchRadius);

        for (const nId of localNhood.keys()) {
            if (await this._isBaseAnchor(nId, radar)) {
                this.gapFillerCache.set(currentId, false);
                this._enforceCacheLimit();
                return false;
            }
        }

        const myScore = await this._getScore(currentId, radar);
        for (const nId of localNhood.keys()) {
            if (nId === currentId) continue;
            const nScore = await this._getScore(nId, radar);
            if (nScore > myScore || (nScore === myScore && nId > currentId)) {
                if (await this._isGapFiller(nId, radar)) {
                    this.gapFillerCache.set(currentId, false);
                    this._enforceCacheLimit();
                    return false;
                }
            }
        }
        this.gapFillerCache.set(currentId, true);
        this._enforceCacheLimit();
        return true;
    }
}
