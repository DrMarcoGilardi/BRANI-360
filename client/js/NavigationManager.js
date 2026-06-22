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
 * Orchestrates movement using injected Strategy Providers (Viewer, Topology, UI, etc.) agnostically.  
 * Coordinates the fetch state and topology mapping when navigating between panoramas.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * NavigationManager --> BaseViewerProvider : Listens to
 * NavigationManager --> TopologyRadar : Requests Graph
 * NavigationManager --> NetworkService : Emits Sync
 * NavigationManager --> SpatialAudioPlayer : Syncs Audio
 * NavigationManager --> AcousticTreadmill : Drives Mix
 * NavigationManager --> BaseSemanticProvider : Queries Intents
 * class NavigationManager{
 * +currentNodeId string
 * +navEpoch number
 * +setupListeners()
 * +moveToNode(nodeId, location, isAnchor, epoch, originNodeId) Promise~void~
 * }
 * ```
 * 
 * @class
 */
export class NavigationManager {
    /**
     * @constructor
     * @param {BaseViewerProvider} viewer - Agnostic viewer strategy.
     * @param {TopologyRadar} radar - Agnostic topology evaluation strategy.
     * @param {NetworkService} networkService - WebSocket orchestrator.
     * @param {UIManager} ui - HUD interface.
     * @param {SpatialAudioPlayer} player - Web Audio lifecycle manager.
     * @param {AcousticTreadmill} treadmill - Background audio mixer.
     * @param {VRSceneController} vrSceneController - 3D/VR Environment manager.
     * @param {BaseSemanticProvider} semanticProvider - Strategy defining active semantic media layers.
     */
    constructor(viewer, radar, networkService, ui, player, treadmill, vrSceneController, semanticProvider) {
        this.viewer = viewer;
        this.radar = radar;
        this.networkService = networkService;
        this.ui = ui;
        this.player = player;
        this.treadmill = treadmill;
        this.vrSceneController = vrSceneController;

        this.currentNodeId = null;
        this.navEpoch = 0;
        this.nodeTimeout = null;

        // Ensure these are initialized to prevent undefined errors in UI interactions
        this.currentIsAnchor = false;
        this.currentNearbyAnchors = [];

        // Delegate semantic meaning and behavior to the injected strategy
        if (!semanticProvider) throw new Error("SemanticProvider is required.");
        this.semanticProvider = semanticProvider;

        this._init();
    }

    /**
     * @async
     * @method _init
     * @memberof NavigationManager
     * @description Initializes the viewer and establishes listeners.
     * @private
     */
    async _init() {
        try {
            // Initialize whichever visual engine was injected
            await this.viewer.init();
            this.setupListeners();
        } catch (e) {
            console.error("[Navigation] Viewer Strategy failed to initialize:", e);
            this.ui.setConnectionStatus(false);
        }
    }

    /**
     * @method setupListeners
     * @memberof NetworkService
     * @description Binds generic, cross-provider event listeners bridging visual transitions to the internal Navigation state machine.
     */
    setupListeners() {
        // Standardized POV sync
        this.viewer.on('pov_changed', (pov) => {
            this.vrSceneController.sync2DRotation(pov);
        });

        // Listen for VR headset removal to sync VR -> Map
        document.addEventListener('app:sync_camera_intent', (e) => {
            const pov = e.detail;
            // Evaluates the new Capabilities Pattern cleanly
            if (pov && this.viewer.supportsCameraSync) {
                this.viewer.syncCamera(pov);
            }
        });

        // Listen for VR Chevron clicks to navigate
        document.addEventListener('app:navigation_intent', (e) => {
            const nextNodeId = e.detail.nodeId;
            if (nextNodeId && this.currentNodeId !== nextNodeId) {
                const originNodeId = this.currentNodeId;
                this.currentNodeId = nextNodeId;
                const epoch = this.networkService.incrementEpoch();
                this.moveToNode(nextNodeId, null, true, epoch, originNodeId);
            }
        });

        this.viewer.on('visible_changed', (isVisible) => {
            if (isVisible) {
                if (this.ui.setEngineVisibility) this.ui.setEngineVisibility(true);

                this.vrSceneController.ensureAudioContext();

                const nodeId = this.viewer.getCurrentNodeId();
                const epoch = this.networkService.incrementEpoch();

                this.vrSceneController.setEpoch(epoch);
                if (nodeId) this.player.setSyncState(epoch, nodeId);

                this.networkService.abortObjectFetches();
                this.player.clearSpatialObjects();

                this.player.updatePersistentVolumes([]);
                this.ui.resetPipeline();

                if (nodeId) {
                    this.currentNodeId = nodeId;
                    this.moveToNode(nodeId, this.viewer.getLocation(), true, epoch);
                }

                if (this.player.startGarbageCollector) {
                    this.player.startGarbageCollector(this.treadmill);
                }
            } else {
                if (this.ui.setEngineVisibility) this.ui.setEngineVisibility(false);

                this.networkService.incrementEpoch();
                this.treadmill.reset(null, [], false);

                this.networkService.abortAllFetches();
                this.networkService.emitCancel();
                this.currentNodeId = null;
                this.ui.resetPipeline();
                if (this.ui.clearRadarGraph) this.ui.clearRadarGraph();
                if (this.ui.clearNodeInfo) this.ui.clearNodeInfo();

                this.player.clearSpatialObjects();
                if (this.player.purgeAll)
                    this.player.purgeAll();
            }
        });

        this.viewer.on('node_changed', (data) => {
            const { id: newNodeId, location } = data;
            if (!newNodeId || !this.viewer.isVisible()) return;

            const epoch = this.networkService.incrementEpoch();
            this.networkService.abortObjectFetches();

            const originNodeId = this.currentNodeId;
            this.currentNodeId = newNodeId;

            this.player.setSyncState(epoch, newNodeId);
            this.vrSceneController.setEpoch(epoch);

            this.player.clearSpatialObjects();

            this.player.updatePersistentVolumes([]);

            this.ui.resetPipeline();

            clearTimeout(this.nodeTimeout);
            this.nodeTimeout = setTimeout(() => {
                if (this.viewer.isVisible()) {
                    this.moveToNode(newNodeId, location, true, epoch, originNodeId);
                }
            }, 800);
        });
    }

    /**
     * @async
     * @method moveToNode
     * @memberof NavigationManager
     * @description Evaluates a node hop. Follows a fast path (Cached API hit) or slow path (Radar Analysis).
     * @param {string} nodeId - Target node ID.
     * @param {Object|null} [location=null] - Optional Lat/Lng payload.
     * @param {boolean} [isAnchor=true] - Whether the origin assumes anchor status.
     * @param {number|null} [epoch=null] - Navigational validity tick.
     * @param {string|null} [originNodeId=null] - ID of the previous node.
     * @returns {Promise<void>}
     */
    async moveToNode(nodeId, location = null, isAnchor = true, epoch = null, originNodeId = null) {
        const currentEpoch = epoch || this.networkService.getEpoch();
        if (currentEpoch < this.navEpoch) return;

        this.logger = this.ui.logger || console;
        this.logger.log(`[Nav] Syncing Node: ${nodeId} (Epoch: ${currentEpoch})`);

        try {
            const response = await fetch(`${this.networkService.tunnelUrl}/api/node/${nodeId}`);

            if (response.ok) {
                const cachedData = await response.json();
                this.logger.log(`[Nav] Fast Path hit for ${nodeId}`);

                if (!cachedData.links || cachedData.links.length === 0) {
                    const nodeData = await this.radar._getNode(nodeId);
                    cachedData.links = nodeData ? nodeData.links : [];
                }

                this._applyNavigationState(nodeId, cachedData, location, currentEpoch, originNodeId);

                if (cachedData.objects) {
                    cachedData.objects.forEach(obj => {
                        this.player.playObjectSound({ ...obj, nodeId, navEpoch: currentEpoch, isPlaceholder: true });
                    });
                }
            } else {
                this.logger.log(`[Nav] Slow Path triggered for ${nodeId}`);
                this._runAgnosticSlowPath(nodeId, location, isAnchor, currentEpoch, originNodeId);
            }
        } catch (e) {
            this.logger.error(`[Nav] Navigation error: ${e.message}`);
        }
    }

    /**
     * @async
     * @method _runAgnosticSlowPath
     * @memberof NavigationManager
     * @description Triggers the slow-path geographic spidering for unexplored panoramas. Constructs acoustic properties, determines anchors, and builds the visual UI graph.
     * @param {string} nodeId - Target node ID.
     * @param {Object|null} location - Geographic coordinates.
     * @param {boolean} isAnchor - Origin anchor context.
     * @param {number} epoch - Current navigation tick.
     * @param {string|null} originNodeId - Preceding node ID.
     * @returns {Promise<void>}
     * @private
     */
    async _runAgnosticSlowPath(nodeId, location, isAnchor, epoch, originNodeId) {
        if (epoch < this.networkService.getEpoch()) return;

        const nodeData = await this.radar._getNode(nodeId);
        const links = nodeData ? nodeData.links : [];

        const currentIsAnchor = await this.radar.isAnchorNode(nodeId);
        const nearbyAnchors = await this.radar.findNearestAnchors(nodeId, 8);

        const nearbyAnchorIds = nearbyAnchors.map(a => a.nodeId || a.id);
        const graphData = await this.radar.buildVisualGraph(nodeId, nearbyAnchorIds);

        const payload = {
            type: currentIsAnchor ? 'anchor' : 'standard',
            location: location || this.viewer.getLocation(),
            links: links,
            nearbyAnchors: nearbyAnchors,
            graphData: graphData
        };

        this._applyNavigationState(nodeId, payload, location, epoch, originNodeId, true);
    }

    /**
     * @method _applyNavigationState
     * @memberof NavigationManager
     * @description Orchestrates the final transition data by mapping UI state, configuring the Acoustic Treadmill, and emitting the backend sync payload to trigger audio generation.
     * @param {string} nodeId - Target node ID.
     * @param {Object} data - Payload containing graph data and nearby anchors.
     * @param {Object|null} location - Raw geographic coordinates.
     * @param {number} epoch - Active navigation tick.
     * @param {string|null} originNodeId - Preceding node ID.
     * @param {boolean} [isSlowPath=false] - Whether this data was just freshly generated via the radar.
     * @private
     */
    _applyNavigationState(nodeId, data, location, epoch, originNodeId, isSlowPath = false) {
        const isAnchor = data.type === 'anchor' || data.type === 'end';

        const manifest = this.semanticProvider.getLayerManifest();
        const activeLayers = Object.keys(manifest);
        const neighborLayers = Object.keys(manifest).filter(layerId => manifest[layerId].behavior === 'neighbor');

        const wantsBackground = neighborLayers.length > 0;

        const nearbyAnchorIds = wantsBackground ? data.nearbyAnchors.map(a => a.nodeId || a.id) : [];

        const nearbyAnchorPayloads = wantsBackground ? data.nearbyAnchors.map(a => ({
            nodeId: a.nodeId || a.id,
            hops: a.hops,
            requestedLayers: neighborLayers
        })) : [];

        this.currentIsAnchor = isAnchor;
        this.currentNearbyAnchors = wantsBackground ? data.nearbyAnchors : [];

        this.ui.setNodeInfo(nodeId, isAnchor);
        if (data.graphData) this.ui.drawRadarGraph(data.graphData, nodeId);

        this.treadmill.reset(nodeId, nearbyAnchorIds, isAnchor);

        this.treadmill.refreshMix(nodeId, isAnchor, this.currentNearbyAnchors, this.radar);

        if (this.currentNodeId === nodeId && this.vrSceneController) {
            this.vrSceneController.updateSkybox(nodeId);
            this.vrSceneController.updateVRNavigation(data.links);
        }

        this.networkService.emitSync({
            nodeId: nodeId,
            originNodeId: originNodeId,
            navEpoch: epoch,
            isAnchor: isAnchor,
            location: location || data.location,
            nearbyAnchors: nearbyAnchorPayloads,
            requestedLayers: activeLayers,
            dbPayload: isSlowPath ? data : null
        });
    }
}