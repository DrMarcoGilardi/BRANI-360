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

import { BaseTopologyProvider } from "./BaseTopologyProvider.js";
import { SpatialUtils } from "../../Utilities/SpatialUtils.js";

/**
 * EXAMPLE STRATEGY IMPLEMENTATION  
 * Resolves node geometry and constructs topological links using Mapillary sequences.  
 * Optimized with Memory-Capped LRU Caching and rate-limit throttling.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * BaseTopologyProvider <|-- MapillaryTopologyProvider
 * class MapillaryTopologyProvider{
 * +getNode(nodeId) Promise~Object~
 * }
 * ```
 * 
 * @class
 */
export class MapillaryTopologyProvider extends BaseTopologyProvider {
    /**
     * @constructor
     * @param {string} accessToken - Mapillary Client Access Token.
     */
    constructor(accessToken) {
        super();
        this.token = accessToken;

        this.sequenceCache = new Map();
        this.nodeCache = new Map();
        this.spatialCache = new Map();
        this.pendingRequests = new Map();

        // Strict Memory Caps
        this.MAX_NODES = 500;      // Holds nodes in RAM
        this.MAX_SEQUENCES = 100;   // Holds roughly 100 distinct driving routes
        this.MAX_SPATIAL_CACHES = 200;

        this.fetchQueue = [];
        this.isFetchingQueue = false;
        this.FETCH_DELAY_MS = 50;
    }

    /**
     * @method _lruSet
     * @memberof MapillaryTopologyProvider
     * @description Native JS Last Recently Used (LRU) Cache implementation. Deletes the oldest entry if the map exceeds its memory limit.
     * @param {Map} cacheMap - The Map instance acting as a cache.
     * @param {string|number} key - Cache key.
     * @param {any} value - Item to cache.
     * @param {number} limit - Maximum number of items allowed in the map.
     * @private
     */
    _lruSet(cacheMap, key, value, limit) {
        if (cacheMap.has(key)) {
            cacheMap.delete(key); // Remove to refresh insertion order
        } else if (cacheMap.size >= limit) {
            cacheMap.delete(cacheMap.keys().next().value); // Evict oldest
        }
        cacheMap.set(key, value);
    }

    /**
     * @method _fetchWithThrottle
     * @memberof MapillaryTopologyProvider
     * @description Adds a fetch request to the throttle queue to prevent API rate limiting.
     * @param {string} url - The URL to fetch.
     * @returns {Promise<Response>} Fetch API Response object.
     * @private
     */
    _fetchWithThrottle(url) {
        return new Promise((resolve, reject) => {
            this.fetchQueue.push({ url, resolve, reject, retries: 2 });
            if (!this.isFetchingQueue) this._processFetchQueue();
        });
    }

    /**
     * @async
     * @method _processFetchQueue
     * @memberof MapillaryTopologyProvider
     * @description Processes the internal fetch queue with fixed delays, handling 429 retries.
     * @returns {Promise<void>}
     * @private
     */
    async _processFetchQueue() {
        this.isFetchingQueue = true;
        while (this.fetchQueue.length > 0) {
            const task = this.fetchQueue.shift();
            try {
                const response = await fetch(task.url);

                if (response.status === 429) {
                    if (task.retries > 0) {
                        console.warn(`[MAPILLARY] 429 Rate Limit Hit. Sleeping 2 seconds...`);
                        await new Promise(r => setTimeout(r, 2000));
                        task.retries--;
                        this.fetchQueue.unshift(task); // Put back at the front of the line
                        continue;
                    }
                }
                task.resolve(response);
            } catch (e) {
                task.reject(e);
            }

            // The magic bullet: Force a strict delay before the loop can grab the next request
            await new Promise(r => setTimeout(r, this.FETCH_DELAY_MS));
        }
        this.isFetchingQueue = false;
    }

    /**
     * @async
     * @method getNode
     * @memberof MapillaryTopologyProvider
     * @description Public interface to retrieve node data and navigation links. Deduplicates concurrent requests.
     * @param {string} nodeId - The target Image ID.
     * @returns {Promise<{id: string, lat: number, lng: number, links: Array<{id: string, pano: string, heading: number}>} | null>}
     */
    async getNode(nodeId) {
        nodeId = nodeId?.toString();

        if (this.pendingRequests.has(nodeId)) {
            return this.pendingRequests.get(nodeId);
        }

        const fetchPromise = this._resolveNode(nodeId);
        this.pendingRequests.set(nodeId, fetchPromise);

        try {
            return await fetchPromise;
        } finally {
            this.pendingRequests.delete(nodeId);
        }
    }

    /**
     * @async
     * @method _resolveNode
     * @memberof MapillaryTopologyProvider
     * @description Internal core logic for resolving geometry and sequence links for a Mapillary node.
     * @param {string} nodeId - The target Image ID.
     * @returns {Promise<Object|null>} Node data with formatted adjacent links.
     * @private
     */
    async _resolveNode(nodeId) {
        if (this.nodeCache.has(nodeId) && this.nodeCache.get(nodeId).links) {
            // Refresh LRU status on read
            const cached = this.nodeCache.get(nodeId);
            this._lruSet(this.nodeCache, nodeId, cached, this.MAX_NODES);
            return cached;
        }

        let lat, lng, sequenceId;

        if (this.nodeCache.has(nodeId)) {
            const cached = this.nodeCache.get(nodeId);
            lat = cached.lat;
            lng = cached.lng;
            sequenceId = cached.sequence;
        } else {
            try {
                const res = await this._fetchWithThrottle(`https://graph.mapillary.com/${nodeId}?fields=id,geometry,sequence&access_token=${this.token}`);
                if (!res.ok) return null;
                const data = await res.json();
                if (!data.geometry || !data.geometry.coordinates || data.geometry.coordinates.length < 2) {
                    console.warn(`[MAPILLARY TOPOLOGY PROVIDER] Node ${nodeId} missing geometry. Dropped from graph.`);
                    return null;
                }

                lng = parseFloat(data.geometry.coordinates[0]);
                lat = parseFloat(data.geometry.coordinates[1]);
                sequenceId = data.sequence;

                this._lruSet(this.nodeCache, nodeId, { id: nodeId, lat, lng, sequence: sequenceId }, this.MAX_NODES);
            } catch (e) {
                return null;
            }
        }

        const links = [];

        const sequencePromise = (async () => {
            if (!sequenceId) return;
            let imageIds = this.sequenceCache.get(sequenceId);
            if (!imageIds) {
                try {
                    const seqRes = await fetch(`https://graph.mapillary.com/image_ids?sequence_id=${sequenceId}&access_token=${this.token}`);
                    if (seqRes.ok) {
                        const seqData = await seqRes.json();
                        imageIds = (seqData.data || []).map(img => (img.id || img)?.toString());
                        this._lruSet(this.sequenceCache, sequenceId, imageIds, this.MAX_SEQUENCES);
                    } else {
                        imageIds = [];
                    }
                } catch (e) {
                    imageIds = [];
                }
            } else {
                this._lruSet(this.sequenceCache, sequenceId, imageIds, this.MAX_SEQUENCES);
            }

            const currentIndex = imageIds.indexOf(nodeId);
            if (currentIndex !== -1) {
                const adjacentIds = [];
                if (currentIndex > 0) adjacentIds.push(imageIds[currentIndex - 1]);
                if (currentIndex < imageIds.length - 1) adjacentIds.push(imageIds[currentIndex + 1]);

                await Promise.all(adjacentIds.map(async (adjId) => {
                    let nLat, nLng;

                    if (this.nodeCache.has(adjId)) {
                        const nCached = this.nodeCache.get(adjId);
                        nLat = nCached.lat;
                        nLng = nCached.lng;
                    } else {
                        try {
                            const adjRes = await fetch(`https://graph.mapillary.com/${adjId}?fields=id,geometry,sequence&access_token=${this.token}`);
                            if (adjRes.ok) {
                                const adjData = await adjRes.json();
                                if (adjData.geometry?.coordinates?.length >= 2) {
                                    nLng = adjData.geometry.coordinates[0];
                                    nLat = adjData.geometry.coordinates[1];
                                    this._lruSet(this.nodeCache, adjId, {
                                        id: adjId, lat: nLat, lng: nLng, sequence: adjData.sequence
                                    }, this.MAX_NODES);
                                }
                            }
                        } catch (e) { return; }
                    }

                    if (nLat !== undefined && nLng !== undefined) {
                        links.push({
                            id: adjId,
                            heading: SpatialUtils.getBearing(lat, lng, nLat, nLng)
                        });
                    }
                }));
            }
        })();

        await Promise.all([sequencePromise]);

        const finalResult = { id: nodeId, lat, lng, links };
        this._lruSet(this.nodeCache, nodeId, { ...this.nodeCache.get(nodeId), links: finalResult.links }, this.MAX_NODES);

        return finalResult;
    }
}