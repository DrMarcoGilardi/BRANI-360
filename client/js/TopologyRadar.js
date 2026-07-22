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
 * Handles map-agnostic topological mapping and BFS spidering of ANY node-based graph.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * TopologyRadar --> BaseTopologyProvider : Fetches Data
 * TopologyRadar --> NodeSelectionStrategy : Evaluates Anchors
 * class TopologyRadar{
 * +clearCache()
 * +hashNodeId(nodeId) number
 * +isAnchorNode(nodeId) Promise~boolean~
 * +findNearestAnchors(startNodeId, maxDepth) Promise~Array~
 * +buildVisualGraph(startNodeId, activeAnchorIds) Promise~Object~
 * }
 * ```
 * 
 * @class
 */

export class TopologyRadar {
    /**
     * @constructor
     * @param {BaseTopologyProvider} topologyProvider - Injected network edge fetcher.
     * @param {NodeSelectionStrategy} selectionStrategy - Injected semantic evaluation strategy.
     */
    constructor(topologyProvider, selectionStrategy) {
        if (!topologyProvider) throw new Error("[TOPOLOGY RADAR] TopologyProvider required.");
        if (!selectionStrategy) throw new Error("[TOPOLOGY RADAR] SelectionStrategy required.");
        this.provider = topologyProvider;
        this.strategy = selectionStrategy;

        this.anchorCache = new Map();
        this.nodeCache = new Map();
        this.MAX_CACHE_SIZE = 2000;
    }

    /** 
     * @method clearCache
     * @memberof TopologyRadar
     * @description Flushes cached radar state. 
     */
    clearCache() {
        this.anchorCache.clear();
        this.nodeCache.clear();
        this.strategy.reset();
        console.log("[Radar] All caches and strategy state flushed.");
    }

    /**
     * @method _refreshCachePosition
     * @memberof TopologyRadar
     * @description Refreshes a cache entry's position to enforce LRU (Least Recently Used) behavior, dropping oldest keys.
     * @param {Map} cacheMap - Target memory cache map.
     * @param {string} key - Cache item key to refresh.
     * @param {any} value - Value to cache.
     * @private
     */
    _refreshCachePosition(cacheMap, key, value) {
        cacheMap.delete(key);
        cacheMap.set(key, value);
        if (cacheMap.size > this.MAX_CACHE_SIZE) {
            cacheMap.delete(cacheMap.keys().next().value);
        }
    }

    /**
     * @method hashNodeId
     * @memberof TopologyRadar
     * @description Creates a consistent numeric hash from a string node identifier.
     * @param {string} nodeId - The raw node identifier.
     * @returns {number} Parsed Hash.
     */
    hashNodeId(nodeId) {
        let hash = 0;
        const strId = String(nodeId);
        for (let i = 0; i < strId.length; i++) {
            hash = ((hash << 5) - hash) + strId.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    /**
     * @async
     * @method _getNode
     * @memberof TopologyRadar
     * @description Fetches node topology from the external provider, utilizing the internal memory cache if available.
     * @param {string} nodeId - Target node identifier.
     * @returns {Promise<Object|null>} Node topological data including links.
     * @private
     */
    async _getNode(nodeId) {
        if (this.nodeCache.has(nodeId)) {
            const data = this.nodeCache.get(nodeId);
            this._refreshCachePosition(this.nodeCache, nodeId, data);
            return data;
        }
        const data = await this.provider.getNode(nodeId);
        if (data) this._refreshCachePosition(this.nodeCache, nodeId, data);
        return data;
    }

    /**
     * @async
     * @method _getNeighborhood
     * @memberof TopologyRadar
     * @description Executes an async Breadth-First-Search to find all nodes within a specified depth.
     * @param {string} startNodeId - The origin node to branch from.
     * @param {number} maxDepth - Maximum hop count.
     * @returns {Promise<Map>} A map of visited nodes and their depths.
     * @private
     */
    async _getNeighborhood(startNodeId, maxDepth) {
        let queue = [{ id: startNodeId, depth: 0 }];
        let visited = new Map();
        visited.set(startNodeId, 0);

        while (queue.length > 0) {

            const currentLayer = [...queue];
            queue = [];

            await Promise.all(currentLayer.map(async (current) => {
                if (current.depth >= maxDepth) return;
                const data = await this._getNode(current.id);
                if (!data?.links) return;

                for (const link of data.links) {
                    if (!visited.has(link.id)) {
                        visited.set(link.id, current.depth + 1);
                        queue.push({ id: link.id, depth: current.depth + 1 });
                    }
                }
            }));
        }
        return visited;
    }

    /**
     * @async
     * @method isAnchorNode
     * @memberof TopologyRadar
     * @description Checks if a node qualifies as a topological anchor via the injected strategy.
     * @param {string} nodeId - Target node.
     * @returns {Promise<boolean>} True if it is an anchor.
     */
    async isAnchorNode(nodeId) {
        if (this.anchorCache.has(nodeId)) {
            const cached = this.anchorCache.get(nodeId);
            this._refreshCachePosition(this.anchorCache, nodeId, cached);
            return cached;
        }
        const isAnchor = await this.strategy.isAnchor(nodeId, this);
        this._refreshCachePosition(this.anchorCache, nodeId, isAnchor);
        return isAnchor;
    }

    /**
     * @async
     * @method findNearestAnchors
     * @memberof TopologyRadar
     * @description Executes an async Breadth-First-Search to find the nearest N semantic anchors.
     * @param {string} startNodeId - The origin node to branch from.
     * @param {number} [maxDepth=8] - Maximum hop count.
     * @returns {Promise<Array<Object>>} List of found anchor nodes with distances.
     */
    async findNearestAnchors(startNodeId, maxDepth = 8) {
        let queue = [{ nodeId: startNodeId, hops: 0 }];
        let visited = new Set([startNodeId]);
        let foundAnchors = [];

        while (queue.length > 0) {

            const currentLayer = [...queue];
            queue = [];

            await Promise.all(currentLayer.map(async (n) => {
                if (n.hops > maxDepth) return;
                const d = await this._getNode(n.nodeId);
                if (!d?.links) return;

                const isAnchor = await this.isAnchorNode(n.nodeId);

                if (isAnchor && n.nodeId !== startNodeId) {
                    if (!foundAnchors.some(a => a.nodeId === n.nodeId)) {
                        foundAnchors.push({
                            nodeId: n.nodeId,
                            hops: n.hops
                        });
                    }
                    return; // Stop spidering down this path
                }

                if (n.hops < maxDepth) {
                    d.links.forEach(l => {
                        if (!visited.has(l.id)) {
                            visited.add(l.id);
                            queue.push({ nodeId: l.id, hops: n.hops + 1 });
                        }
                    });
                }
            }));
        }
        return foundAnchors;
    }

    /**
     * @async
     * @method buildVisualGraph
     * @memberof TopologyRadar
     * @description Compiles a flat visual graph representation (Nodes and Edges) for the UI Radar.
     * @param {string} startNodeId - The center node.
     * @param {Array<string>} [activeAnchorIds=[]] - List of active anchor IDs to highlight.
     * @returns {Promise<{nodes: Array<Object>, edges: Array<Object>}>} Plottable graph data.
     */
    async buildVisualGraph(startNodeId, activeAnchorIds = []) {
        let nodes = new Map(), edges = [];
        let queue = [{ nodeId: startNodeId, x: 0, y: 0, state: 'seeking', depth: 0 }];
        let visited = new Set([startNodeId]);

        while (queue.length > 0) {

            const currentLayer = [...queue];
            queue = [];

            await Promise.all(currentLayer.map(async (current) => {
                const data = await this._getNode(current.nodeId);
                if (!data) return;

                const links = data.links || [];
                const isAnchor = await this.isAnchorNode(current.nodeId);
                const isActiveAnchor = activeAnchorIds.includes(current.nodeId);

                let nodeType = 'standard';
                if (links.length <= 1 && current.nodeId !== startNodeId) nodeType = 'end';
                else if (isAnchor) nodeType = 'anchor';

                nodes.set(current.nodeId, {
                    id: current.nodeId, x: current.x, y: current.y,
                    type: nodeType, isAnchor, isActiveAnchor
                });

                if (current.state === 'past_anchor' || current.depth >= 8) return;
                const nextState = isActiveAnchor ? 'past_anchor' : 'seeking';

                links.forEach((link, idx) => {
                    edges.push({ from: current.nodeId, to: link.id });
                    if (!visited.has(link.id)) {
                        visited.add(link.id);

                        let angle;
                        if (link.heading !== undefined) {
                            angle = (link.heading - 90) * (Math.PI / 180);
                        } else {
                            angle = (idx / links.length) * (Math.PI * 2);
                        }

                        queue.push({
                            nodeId: link.id, x: current.x + Math.cos(angle) * 40, y: current.y + Math.sin(angle) * 40,
                            state: nextState, depth: current.depth + 1
                        });
                    }
                });
            }));
        }
        return { nodes: Array.from(nodes.values()), edges };
    }
}