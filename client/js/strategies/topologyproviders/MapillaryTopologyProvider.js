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

import { BaseTopologyProvider } from "./BaseTopologyProvider.js";
import { SpatialUtils } from "../../utilities/SpatialUtils.js";

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

        this.batchQueue = new Set();
        this.batchTimeout = null;
        this.batchPromises = new Map();
        this.pendingSequences = new Map();

        this.MAX_NODES = 500;
        this.MAX_SEQUENCES = 100;
        this.MAX_SPATIAL_CACHES = 200;

        this.fetchQueue = [];
        this.activeFetches = 0;
        this.MAX_CONCURRENT_FETCHES = 15;
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
            cacheMap.delete(key);
        } else if (cacheMap.size >= limit) {
            cacheMap.delete(cacheMap.keys().next().value);
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
            this.fetchQueue.push({ url, resolve, reject, retries: 3 });
            this._processFetchQueue();
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
        if (this.activeFetches >= this.MAX_CONCURRENT_FETCHES || this.fetchQueue.length === 0) {
            return;
        }
        this.activeFetches++;
        const task = this.fetchQueue.shift();
        try {
            const response = await fetch(task.url);
            if (response.status === 429) {
                if (task.retries > 0) {
                    console.warn(`[MAPILLARY] 429 Rate Limit Hit. Backing off...`);
                    task.retries--;
                    setTimeout(() => {
                        this.fetchQueue.unshift(task);
                        this.activeFetches--;
                        this._processFetchQueue();
                    }, 2000);
                    return;
                }
            }
            task.resolve(response);
        } catch (e) {
            task.reject(e);
        }
        this.activeFetches--;
        this._processFetchQueue();
    }

    /**
     * @async
     * @method _executeFetchTask
     * @memberof MapillaryTopologyProvider
     * @description Handles the individual fetch lifecycle and rate-limit retries.
     * @private
     */
    async _executeFetchTask(task) {
        try {
            const response = await fetch(task.url);

            if (response.status === 429 && task.retries > 0) {
                console.warn(`[MAPILLARY] 429 Rate Limit Hit. Re-queuing...`);
                setTimeout(() => {
                    task.retries--;
                    this.fetchQueue.unshift(task);
                    if (!this.isFetchingQueue) this._processFetchQueue();
                }, 2000);
                return;
            }
            task.resolve(response);
        } catch (e) {
            task.reject(e);
        }
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
     * @method _fetchNodeGeometry
     * @memberof MapillaryTopologyProvider
     * @description Fetches core node data. Deduplicates concurrent requests for the exact same node geometry.
     * @param {string} nodeId - The target Image ID.
     */
    async _fetchNodeGeometry(nodeId) {
        if (this.nodeCache.has(nodeId)) return Promise.resolve(this.nodeCache.get(nodeId));
        if (this.batchPromises.has(nodeId)) return this.batchPromises.get(nodeId).promise;

        let res, rej;
        const promise = new Promise((resolve, reject) => {
            res = resolve;
            rej = reject;
        });

        this.batchPromises.set(nodeId, { promise, resolve: res, reject: rej });
        this.batchQueue.add(nodeId);

        if (!this.batchTimeout) {
            this.batchTimeout = setTimeout(() => this._flushGeometryBatch(), 15);
        }

        return promise;
    }

    /**
     * @async
     * @method _flushGeometryBatch
     * @description Flushes the gathered IDs and dispatches chunked batch requests.
     */
    async _flushGeometryBatch() {
        this.batchTimeout = null;
        const idsToFetch = Array.from(this.batchQueue);
        this.batchQueue.clear();

        const CHUNK_SIZE = 50;
        for (let i = 0; i < idsToFetch.length; i += CHUNK_SIZE) {
            const chunk = idsToFetch.slice(i, i + CHUNK_SIZE);
            this._executeBatchChunk(chunk);
        }
    }

    /**
     * @async
     * @method _executeBatchChunk
     * @description Executes a single batch HTTP request and distributes the results back to the individual promises.
     */
    async _executeBatchChunk(chunk) {
        const idString = chunk.join(',');
        try {
            const res = await this._fetchWithThrottle(`https://graph.mapillary.com?ids=${idString}&fields=id,geometry,sequence&access_token=${this.token}`);
            if (!res.ok) throw new Error('Batch fetch failed');

            const data = await res.json();
            const results = Array.isArray(data.data) ? data.data : Object.values(data);
            const processedIds = new Set();

            for (const item of results) {
                const id = item.id;
                processedIds.add(id);

                if (item.geometry?.coordinates?.length >= 2) {
                    const lat = parseFloat(item.geometry.coordinates[1]);
                    const lng = parseFloat(item.geometry.coordinates[0]);
                    const cachedData = { id, lat, lng, sequence: item.sequence };

                    this._lruSet(this.nodeCache, id, cachedData, this.MAX_NODES);
                    if (this.batchPromises.has(id)) {
                        this.batchPromises.get(id).resolve(cachedData);
                    }
                } else {
                    if (this.batchPromises.has(id)) {
                        this.batchPromises.get(id).resolve(null);
                    }
                }
            }
            for (const id of chunk) {
                if (!processedIds.has(id) && this.batchPromises.has(id)) {
                    this.batchPromises.get(id).resolve(null);
                }
                this.batchPromises.delete(id);
            }

        } catch (e) {
            for (const id of chunk) {
                if (this.batchPromises.has(id)) {
                    this.batchPromises.get(id).resolve(null);
                    this.batchPromises.delete(id);
                }
            }
        }
    }

    /**
     * @async
     * @method _fetchSequence
     * @description Fetches a Mapillary sequence array. Deduplicates concurrent requests to prevent Cache Stampedes during radar spidering.
     */
    async _fetchSequence(sequenceId) {
        if (!sequenceId) return [];
        if (this.sequenceCache.has(sequenceId)) return this.sequenceCache.get(sequenceId);
        if (this.pendingSequences.has(sequenceId)) return this.pendingSequences.get(sequenceId);
        const seqPromise = (async () => {
            try {
                const seqRes = await this._fetchWithThrottle(`https://graph.mapillary.com/image_ids?sequence_id=${sequenceId}&access_token=${this.token}`);
                if (seqRes.ok) {
                    const seqData = await seqRes.json();
                    const imageIds = (seqData.data || []).map(img => (img.id || img)?.toString());
                    this._lruSet(this.sequenceCache, sequenceId, imageIds, this.MAX_SEQUENCES);
                    return imageIds;
                }
                return [];
            } catch (e) {
                return [];
            } finally {
                this.pendingSequences.delete(sequenceId);
            }
        })();

        this.pendingSequences.set(sequenceId, seqPromise);
        return seqPromise;
    }

    /**
     * @async
     * @method _resolveNode
     * @description Internal core logic for resolving geometry and sequence links for a Mapillary node.
     */
    async _resolveNode(nodeId) {
        if (this.nodeCache.has(nodeId) && this.nodeCache.get(nodeId).links) {
            const cached = this.nodeCache.get(nodeId);
            this._lruSet(this.nodeCache, nodeId, cached, this.MAX_NODES);
            return cached;
        }

        const primaryData = await this._fetchNodeGeometry(nodeId);
        if (!primaryData) return null;

        const { lat, lng, sequence: sequenceId } = primaryData;
        const links = [];

        const sequencePromise = (async () => {
            const imageIds = await this._fetchSequence(sequenceId);

            const currentIndex = imageIds.indexOf(nodeId);
            if (currentIndex !== -1) {

                // --- THE MAGIC TRICK: NEIGHBORHOOD PREFETCHING ---
                // The radar spiders out ~8 hops. Let's pre-load the next 10 nodes in both directions 
                // into the DataLoader so the radar BFS hits 100% RAM cache instead of the network!
                const searchRadius = 10;
                const startIndex = Math.max(0, currentIndex - searchRadius);
                const endIndex = Math.min(imageIds.length - 1, currentIndex + searchRadius);

                for (let i = startIndex; i <= endIndex; i++) {
                    // We DO NOT await these here. We just fire them into the 15ms batch queue.
                    this._fetchNodeGeometry(imageIds[i]);
                }
                // ------------------------------------------------

                const adjacentIds = [];
                if (currentIndex > 0) adjacentIds.push(imageIds[currentIndex - 1]);
                if (currentIndex < imageIds.length - 1) adjacentIds.push(imageIds[currentIndex + 1]);

                await Promise.all(adjacentIds.map(async (adjId) => {
                    // Because we pre-fetched above, the batcher will group these adjacent nodes 
                    // WITH the rest of the neighborhood into ONE single HTTP call!
                    const adjData = await this._fetchNodeGeometry(adjId);

                    if (adjData && adjData.lat !== undefined && adjData.lng !== undefined) {
                        links.push({
                            id: adjId,
                            heading: SpatialUtils.getBearing(lat, lng, adjData.lat, adjData.lng)
                        });
                    }
                }));
            }
        })();

        await Promise.all([sequencePromise]);

        const finalResult = { id: nodeId, lat, lng, links };
        this._lruSet(this.nodeCache, nodeId, { ...primaryData, links: finalResult.links }, this.MAX_NODES);

        return finalResult;
    }
}