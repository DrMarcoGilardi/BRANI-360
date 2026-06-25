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
 * Manages the mathematical mixing of backgrounds and aggregate progress tracking.  
 * Agnostically adjusts volume levels of adjacent nodes to simulate distance.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * AcousticTreadmill --> SpatialAudioPlayer : Pushes Volumes
 * AcousticTreadmill --> UIManager : Pushes Progress
 * class AcousticTreadmill{
 * +anchorTracker Object
 * +reset(nodeId, expectedIds, currentIsAnchor)
 * +updateAggregateProgress(anchorId, currentIsAnchor)
 * +refreshMix(currentNodeId, currentIsAnchor, currentNearbyAnchors, radar)
 * }
 * ```
 * 
 * @class
 */
export class AcousticTreadmill {
    /**
     * @constructor
     * @param {SpatialAudioPlayer} player - The active audio player.
     * @param {UIManager} ui - The UI HUD.
     * @param {Object} clientConfig - Configuration options for the client.
     */
    constructor(player, ui, semanticProvider, clientConfig = {}) {
        this.player = player;
        this.ui = ui;
        this.clientConfig = clientConfig;
        this.spatiallyContinuous = (String(this.clientConfig?.audioParams?.spatiallyContinuous) === 'true');
        this.anchorTracker = {
            expectedIds: [],
            completedIds: new Set(),
            activeNodeId: null
        };
        this.semanticProvider = semanticProvider;
    }

    /**
     * @method reset
     * @memberof AcousticTreadmill
     * @description Resets the treadmill state for a new navigation origin.
     * @param {string} nodeId - The central node identifier.
     * @param {Array<string>} expectedIds - List of neighboring nodes to track.
     * @param {boolean} currentIsAnchor - True if the central node is an anchor.
     */
    reset(nodeId, expectedIds, currentIsAnchor) {
        this.anchorTracker = {
            activeNodeId: nodeId,
            expectedIds: expectedIds || [],
            completedIds: new Set()
        };

        if (!currentIsAnchor) {
            this.ui.updatePipelineProgress(nodeId, 'syncing', 0, 'local', false, null, null);
        }
    }

    /**
     * @method updateAggregateProgress
     * @memberof AcousticTreadmill
     * @description Increments background generation progress and updates the HUD.
     * @param {string} anchorId - The newly completed neighbor node.
     * @param {boolean} currentIsAnchor - True if the central node is an anchor.
     */
    updateAggregateProgress(anchorId, currentIsAnchor) {
        if (!this.anchorTracker.activeNodeId || currentIsAnchor) return;

        if (this.anchorTracker.expectedIds.includes(anchorId)) {
            this.anchorTracker.completedIds.add(anchorId);

            const total = this.anchorTracker.expectedIds.length;
            const count = this.anchorTracker.completedIds.size;
            const progress = count / total;

            if (count >= total) {
                this.ui.updatePipelineProgress(
                    this.anchorTracker.activeNodeId, 'complete', 1.0, 'local', false, null, null
                );
            } else {
                this.ui.updatePipelineProgress(
                    this.anchorTracker.activeNodeId, 'syncing neighbors', progress, 'local', false, null, null
                );
            }
        }
    }

    /**
     * @method refreshMix
     * @memberof AcousticTreadmill
     * @description Calculates distance-based volume weights and pushes them to the audio player.
     * @param {string} currentNodeId - Active central node.
     * @param {boolean} currentIsAnchor - Active anchor status.
     * @param {Array<Object>} currentNearbyAnchors - List of topological neighbors.
     * @param {TopologyRadar} radar - Radar topology reference.
     */
    refreshMix(currentNodeId, currentIsAnchor, currentNearbyAnchors, radar) {
        const manifest = this.semanticProvider.getLayerManifest();

        if (!this.spatiallyContinuous) {
            let fallbackVolumes = [];
            const localLayers = Object.entries(manifest).filter(([_, conf]) => conf.behavior === 'local');
            localLayers.forEach(([layerId]) => {
                fallbackVolumes.push({ id: String(currentNodeId), layerId: layerId, weight: 1.0 });
            });

            if (currentIsAnchor) {
                const neighborLayers = Object.entries(manifest).filter(([_, conf]) => conf.behavior === 'neighbor');
                neighborLayers.forEach(([layerId]) => {
                    fallbackVolumes.push({ id: String(currentNodeId), layerId: layerId, weight: 1.0 });
                });
            }
            this.player.updatePersistentVolumes(fallbackVolumes);
            return;
        }

        let volumes = []; // Structure: { id, layerId, weight }
        let totalWeightBudget = 0;

        const localLayers = Object.entries(manifest).filter(([_, conf]) => conf.behavior === 'local');
        const neighborLayers = Object.entries(manifest).filter(([_, conf]) => conf.behavior === 'neighbor');

        const validNeighbors = (currentNearbyAnchors || []).filter(a => a.nodeId);

        let mixTargets = [...validNeighbors];
        if (currentIsAnchor) {
            mixTargets.push({ nodeId: currentNodeId, hops: 0 });
        }

        localLayers.forEach(([_, conf]) => totalWeightBudget += conf.baseWeight);
        if (mixTargets.length > 0) {
            neighborLayers.forEach(([_, conf]) => totalWeightBudget += conf.baseWeight);
        }

        if (totalWeightBudget === 0) totalWeightBudget = 1.0;

        localLayers.forEach(([layerId, conf]) => {
            const layerBudget = conf.baseWeight / totalWeightBudget;
            volumes.push({
                id: String(currentNodeId),
                layerId: layerId,
                weight: layerBudget
            });
        });


        if (mixTargets.length > 0) {
            let totalInvHops = 0;
            const SMOOTHING_FACTOR = 1.0;

            mixTargets.forEach(a => {
                const safeHops = (typeof a.hops === 'number' && !isNaN(a.hops)) ? a.hops : 1;
                totalInvHops += 1 / (SMOOTHING_FACTOR + safeHops);
            });
            neighborLayers.forEach(([layerId, conf]) => {
                const layerBudget = conf.baseWeight / totalWeightBudget;

                mixTargets.forEach(a => {
                    const safeHops = (typeof a.hops === 'number' && !isNaN(a.hops)) ? a.hops : 1;
                    let nodeFraction = (1 / (SMOOTHING_FACTOR + safeHops)) / totalInvHops;

                    if (isNaN(nodeFraction) || !isFinite(nodeFraction)) nodeFraction = 0;

                    volumes.push({
                        id: String(a.nodeId),
                        layerId: layerId,
                        weight: nodeFraction * layerBudget
                    });

                });
            });
        }

        this.player.updatePersistentVolumes(volumes);
    }
}