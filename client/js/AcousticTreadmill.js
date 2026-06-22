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
    constructor(player, ui, clientConfig = {}) {
        this.player = player;
        this.ui = ui;
        this.clientConfig = clientConfig;
        this.spatiallycontinuous = (this.clientConfig?.audioParams?.SPATIALLY_CONTINUOUS === 'true');
        this.anchorTracker = {
            expectedIds: [],
            completedIds: new Set(),
            activeNodeId: null
        };
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
            this.ui.updatePipelineProgress(nodeId, 'syncing', 0, false, false, false, null, null);
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
                    this.anchorTracker.activeNodeId,
                    'complete',
                    1.0, false, false, false, null, null
                );
            } else {
                // UI Agnostic string for background loading
                this.ui.updatePipelineProgress(
                    this.anchorTracker.activeNodeId,
                    'syncing background',
                    progress, false, false, false, null, null
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

        if (!this.spatiallycontinuous) {
            this.player.updatePersistentVolumes([{ id: String(currentNodeId), weight: 1.0 }]);
            return;
        }

        if (!currentNearbyAnchors || !Array.isArray(currentNearbyAnchors)) return;

        let mixTargets = [];
        let volumes = [];

        if (currentIsAnchor) {
            // Filter out the foreground node to calculate background splits
            currentNearbyAnchors.forEach(a => {
                const targetId = (a.nodeId)?.toString();
                if (targetId && targetId !== String(currentNodeId)) {
                    mixTargets.push({ nodeId: targetId, hops: a.hops });
                }
            });

            if (mixTargets.length > 0) {
                // Foreground gets exactly 50% of the mix
                volumes.push({ id: String(currentNodeId), weight: 0.5 });

                let totalInvHops = 0;
                const SMOOTHING_FACTOR = 1.0;

                mixTargets.forEach(a => {
                    const safeHops = (typeof a.hops === 'number' && !isNaN(a.hops)) ? a.hops : 1;
                    totalInvHops += 1 / (SMOOTHING_FACTOR + safeHops);
                });

                // Backgrounds share the remaining 50% 
                mixTargets.forEach(a => {
                    const safeHops = (typeof a.hops === 'number' && !isNaN(a.hops)) ? a.hops : 1;
                    let calculatedWeight = (1 / (SMOOTHING_FACTOR + safeHops)) / totalInvHops;

                    if (isNaN(calculatedWeight) || !isFinite(calculatedWeight)) {
                        calculatedWeight = 0;
                    }

                    volumes.push({
                        id: String(a.nodeId),
                        weight: calculatedWeight * 0.5 // Scale to 50%
                    });
                });
            } else {
                // If there are no backgrounds, give the foreground 100%
                volumes.push({ id: String(currentNodeId), weight: 1.0 });
            }

        } else if (currentNearbyAnchors.length > 0) {
            mixTargets = currentNearbyAnchors.map(a => ({
                nodeId: (a.nodeId)?.toString(),
                hops: a.hops
            })).filter(a => a.nodeId); // Filter out any broken entries

            let totalInvHops = 0;
            const SMOOTHING_FACTOR = 1.0;

            mixTargets.forEach(a => {
                const safeHops = (typeof a.hops === 'number' && !isNaN(a.hops)) ? a.hops : 1;
                totalInvHops += 1 / (SMOOTHING_FACTOR + safeHops);
            });

            volumes = mixTargets.map(a => {
                const safeHops = (typeof a.hops === 'number' && !isNaN(a.hops)) ? a.hops : 1;
                let calculatedWeight = (1 / (SMOOTHING_FACTOR + safeHops)) / totalInvHops;

                if (isNaN(calculatedWeight) || !isFinite(calculatedWeight)) calculatedWeight = 0;

                return {
                    id: String(a.nodeId),
                    weight: calculatedWeight
                };
            });
        }

        if (volumes.length > 0) {
            // Pass the mixing math directly to the persistent/background channels in the audio player
            this.player.updatePersistentVolumes(volumes);
        }
    }
}