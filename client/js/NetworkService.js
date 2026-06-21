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
 * Encapsulates WebSocket orchestration and High-Speed Navigation Guards.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * NetworkService --> UIManager : Updates HUD
 * NetworkService --> SpatialAudioPlayer : Feeds Buffers
 * NetworkService --> Window : Triggers Client Reload
 * class NetworkService{
 * +activeNavEpoch number
 * +init(...)
 * +incrementEpoch() number
 * +getEpoch() number
 * +emitSync(data)
 * +emitCancel()
 * +emitRegen(taskData, feedbackData)
 * +abortAllFetches()
 * +fetchAudioUrl(url, isPersistent) Promise~ArrayBuffer~
 * }
 * ```
 * 
 * @class
 */
export class NetworkService {
    /**
     * @constructor
     * @param {string} tunnelUrl - Base remote URL (e.g., zrok or ngrok tunnel).
     */
    constructor(tunnelUrl) {
        this.tunnelUrl = tunnelUrl;
        this.activeNavEpoch = 0;

        this.objectFetchControllers = new Set();
        this.persistentFetchControllers = new Set();

        this.socket = io(this.tunnelUrl, {
            transports: ['polling', 'websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            timeout: 99999999,
            forceNew: false
        });

        setInterval(() => {
            if (this.socket.connected) this.socket.emit('tunnel_keepalive');
        }, 10000);
    }

    /**
     * @method init
     * @memberof NetworkService
     * @description Binds internal managers to incoming socket events.
     * @param {UIManager} ui - The UI Manager.
     * @param {SpatialAudioPlayer} player - The Audio Player.
     * @param {SceneController} sceneController - The VR Manager.
     * @param {AcousticTreadmill} treadmill - The Audio Mixing Engine.
     * @param {NavigationManager} navManager - The primary Nav Orchestrator.
     */
    init(ui, player, sceneController, treadmill, navManager) {
        this.ui = ui;
        this.player = player;
        this.sceneController = sceneController;
        this.treadmill = treadmill;
        this.navManager = navManager;

        this._setupListeners();

        if (this.socket.connected) {
            this.ui.setConnectionStatus(true, this.socket.id);
        }
    }

    /**
     * @method incrementEpoch
     * @memberof NetworkService
     * @description Increments the navigation epoch to invalidate older network requests.
     * @returns {number} The new epoch tick.
     */
    incrementEpoch() {
        this.activeNavEpoch++;
        return this.activeNavEpoch;
    }

    /**
     * @method getEpoch
     * @memberof NetworkService
     * @description Returns the current epoch
     * @returns {number} The current navigation epoch. 
     */
    getEpoch() { return this.activeNavEpoch; }

    /**
     * @method emitSync
     * @memberof NetworkService
     * @description Pushes current topological state to the backend to trigger the generation pipeline.
     * @param {Object} data - Spatial sync payload.
     */
    emitSync(data) { this.socket.emit('spatial_sync', data); }

    /**
     * @method emitCancel
     * @memberof NetworkService
     * @description Sends an explicit cancellation flag to the GPU queue.
     */
    emitCancel() { this.socket.emit('cancel_tasks'); }

    /**
     * @method emitRegen
     * @memberof NetworkService
     * @description Emits a request to regenerate a specific audio task.
     * @param {Object} taskData - The original task payload.
     * @param {Object} feedbackData - Explicit user modifications.
     */
    emitRegen(taskData, feedbackData) { this.socket.emit('regenerate_task', { taskData, feedbackData }); }

    /**
     * @method abortObjectFetches
     * @memberof NetworkService
     * @description Cancels pending fetch requests for transient objects.
     */
    abortObjectFetches() {
        for (let controller of this.objectFetchControllers) controller.abort();
        this.objectFetchControllers.clear();
    }

    /**
     * @method abortPersistentFetches
     * @memberof NetworkService
     * @description Cancels pending fetch requests for persistent backgrounds.
     */
    abortPersistentFetches() {
        for (let controller of this.persistentFetchControllers) controller.abort();
        this.persistentFetchControllers.clear();
    }

    /**
     * @method abortAllFetches
     * @memberof NetworkService
     * @description Cancels all pending fetch requests.
     */
    abortAllFetches() {
        this.abortObjectFetches();
        this.abortPersistentFetches();
    }

    /**
     * @method fetchAudioUrl
     * @memberof NetworkService
     * @description Safely fetches an audio buffer from the backend using an AbortController.
     * @param {string} url - Target endpoint.
     * @param {boolean} [isPersistent=false] - Used to route the controller to the correct abort registry.
     * @returns {Promise<ArrayBuffer>} The downloaded audio buffer.
     * @throws {Error} On network failure.
     */
    async fetchAudioUrl(url, isPersistent = false) {
        const controller = new AbortController();
        const targetRegistry = isPersistent ? this.persistentFetchControllers : this.objectFetchControllers;

        targetRegistry.add(controller);
        try {
            const separator = url.includes('?') ? '&' : '?';
            const fetchUrl = `${this.tunnelUrl}${url}${separator}t=${Date.now()}`;

            const response = await fetch(fetchUrl, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status} failed to fetch audio`);

            return await response.arrayBuffer();
        } catch (e) {
            throw e;
        } finally {
            targetRegistry.delete(controller);
        }
    }

    /**
     * @method getHUDLabel
     * @memberof NetworkService
     * @description Calculates the correct HUD display label for a task based on topology.
     * @param {string} id - Task identifier.
     * @param {boolean} isObject - Whether the task is a spatial object.
     * @param {string|null} displayName - Optional predefined display name.
     * @param {string} nodeId - The parent node of the task.
     * @returns {string} Formatted label.
     */
    getHUDLabel(id, isObject, displayName, nodeId) {
        if (isObject) return displayName || id;

        if (nodeId === this.navManager?.currentNodeId || id === this.navManager?.currentNodeId) {
            const alias = this.ui.getAlias(id, this.navManager.currentIsAnchor);
            return this.navManager.currentIsAnchor ? `${alias.replace(/^S/, 'A')} [ANCHOR]` : alias;
        }

        const isNearbyAnchor = this.navManager?.currentNearbyAnchors?.some(a => a.nodeId === id);
        if (isNearbyAnchor) {
            const alias = this.ui.getAlias(id, true);
            // Agnostic UI label for background/neighbor nodes
            return `${alias.replace(/^S/, 'A')} (Background)`;
        }

        return this.ui.getAlias(id, false);
    }

    // ---- PRIVATE HANDLERS ----
    /**
     * @method _setupListeners
     * @memberof NetworkService
     * @description Binds internal Socket.IO event handlers for tracking connection state and routing pipeline progress.
     * @private
     */
    _setupListeners() {
        this.socket.on('connect', () => this.ui.setConnectionStatus(true, this.socket.id));
        this.socket.on('disconnect', () => this.ui.setConnectionStatus(false));
        this.socket.on('pipeline_reset', () => this.ui.resetPipeline());

        this.socket.on('server_reloaded', () => {
            console.warn("[Network Guard] Server environment changed. Reloading client to apply new configurations.");
            window.location.reload();
        });

        this.socket.on('pipeline_progress', this._handlePipelineProgress.bind(this));
        this.socket.on('instance_ready', this._handleObjectReady.bind(this));
        this.socket.on('node_ready', this._handlePersistentReady.bind(this));
    }

    /**
     * @method _isEpochValid
     * @memberof NetworkService
     * @description Validation guard to prevent processing stale network packets from previous navigation epochs. Defends against audio loading from panoramas the user has already navigated away from.
     * @param {number} incomingEpoch - The epoch tick attached to the incoming packet.
     * @param {string} [label="Packet"] - Contextual label used for debugging logs.
     * @returns {boolean} True if the epoch matches the current active state, false if stale.
     * @private
     */
    _isEpochValid(incomingEpoch, label = "Packet") {
        if (incomingEpoch !== undefined && incomingEpoch < this.activeNavEpoch) {
            console.warn(`[Network Guard] Dropped stale ${label} (Epoch ${incomingEpoch} < ${this.activeNavEpoch})`);
            return false;
        }
        return true;
    }

    /**
     * @method _handlePipelineProgress
     * @memberof NetworkService
     * @description Ingests generic pipeline progress events and routes them to the UI HUD. Evaluates topological state to determine if the payload belongs to a spatial object, a local node, or a background neighbor.
     * @param {Object} data - Standardized pipeline progress payload.
     * @private
     */
    _handlePipelineProgress(data) {
        if (!this._isEpochValid(data.navEpoch, 'Progress')) return;

        // Flatten payload to guarantee access to deep task intent data
        const payload = data.taskData ? { ...data, ...data.taskData } : { ...data };

        const nodeId = payload.nodeId?.toString();
        const targetId = payload.id?.toString();
        let currentNodeId = this.navManager.currentNodeId?.toString();

        const isNeighbor = this.treadmill.anchorTracker.expectedIds.includes(nodeId);
        if (nodeId && nodeId !== currentNodeId && !isNeighbor) return;

        // In AIEngine, persistent nodes share their ID with the node ID. 
        // Spatial instances have a unique suffixed ID.
        const isObject = targetId !== nodeId;

        // Evaluate topological state
        const isBackgroundNode = this.treadmill.anchorTracker.expectedIds.includes(targetId) && targetId !== currentNodeId;
        const isAnchorInSession = this.navManager.currentIsAnchor && targetId === currentNodeId;

        const label = this.getHUDLabel(targetId, isObject, payload.displayName || payload.label, nodeId);

        this.ui.updatePipelineProgress(
            targetId, payload.stage, payload.progress, isObject, isAnchorInSession, isBackgroundNode, label, payload.taskData
        );

        if (this.treadmill.anchorTracker.activeNodeId && isBackgroundNode && !this.navManager.currentIsAnchor) {
            const totalExpected = this.treadmill.anchorTracker.expectedIds.length;
            if (totalExpected > 0) {
                const baseProgress = (this.treadmill.anchorTracker.completedIds.size / totalExpected);
                const incremental = (payload.progress / totalExpected);
                // UI Agnostic string for background loading
                this.ui.updatePipelineProgress(this.treadmill.anchorTracker.activeNodeId, 'syncing background', baseProgress + incremental, false, false, false, null, null);
            }
        }
    }

    /**
     * @async
     * @method _handleObjectReady
     * @memberof NetworkService
     * @description Event handler for 'instance_ready'. Triggered when a localized 3D spatial object finishes generating. Initiates the audio download and mounts the positional buffer into the 3D VR scene.
     * @param {Object} data - Completion payload containing the audio stream URL.
     * @returns {Promise<void>}
     * @private
     */
    async _handleObjectReady(data) {
        // Merge taskData properties to the top level for the AudioPlayer
        const payload = data.taskData ? { ...data, ...data.taskData } : { ...data };

        const nodeId = payload.nodeId?.toString();
        const targetId = payload.id?.toString();
        let currentNodeId = this.navManager.currentNodeId?.toString();


        if (!this._isEpochValid(payload.navEpoch, `Object ${payload.label}`)) return;
        if (nodeId !== currentNodeId) return;

        this.sceneController.ensureAudioContext();

        const taskPayload = payload.taskData ? { ...payload.taskData } : { ...payload };
        delete taskPayload.audioBuffer;

        try {
            const buffer = await this.fetchAudioUrl(payload.url, false);
            if (!buffer) return;

            currentNodeId = this.navManager.currentNodeId?.toString();
            if (!currentNodeId) return;

            if (!this._isEpochValid(payload.navEpoch, `Object ${payload.label} (Post-DL)`)) return;
            if (nodeId !== currentNodeId) return;

            payload.audioBuffer = buffer;
            payload.nodeId = nodeId;

            this.player.playObjectSound(payload);
            if (this.sceneController.addSpatialSource) {
                this.sceneController.addSpatialSource(payload, this.tunnelUrl);
            }

            this.ui.updatePipelineProgress(
                targetId, 'complete', 1.0, true, false, false, payload.displayName || payload.label, taskPayload
            );
        } catch (e) {
            if (e.name === 'AbortError') return;
            console.error(`[Audio Error] Object ${payload.displayName || payload.label} failed:`, e);
            if (nodeId === currentNodeId) {
                this.ui.updatePipelineProgress(targetId, 'error', 1.0, true, false, false, payload.displayName || payload.label, taskPayload);
            }
        }
    }

    /**
     * @async
     * @method _handlePersistentReady
     * @memberof NetworkService
     * @description Event handler for 'persistent_ready'. Triggered when a persistent background audio source is ready for playback.
     * @param {Object} data - Completion payload containing the audio stream URL.
     * @returns {Promise<void>}
     * @private
     */
    async _handlePersistentReady(data) {
        const payload = data.taskData ? { ...data, ...data.taskData } : { ...data };

        const nodeId = payload.nodeId?.toString();
        let currentNodeId = this.navManager.currentNodeId?.toString();

        if (!currentNodeId) return;

        const isCurrentlyRelevant = nodeId === currentNodeId || this.treadmill.anchorTracker.expectedIds.includes(nodeId);
        if (!isCurrentlyRelevant) return;

        this.sceneController.ensureAudioContext();

        const taskPayload = payload.taskData ? { ...payload.taskData } : { ...payload };
        delete taskPayload.audioBuffer;

        try {
            // true flag routes this fetch to the persistentFetchControllers
            const buffer = await this.fetchAudioUrl(payload.url, true);
            if (!buffer) return;

            currentNodeId = this.navManager.currentNodeId?.toString();
            if (!currentNodeId) return;

            if (!this.treadmill.anchorTracker.expectedIds.includes(nodeId) && nodeId !== currentNodeId) return;

            // Use the new agnostic method name
            await this.player.registerPersistentAnchor(nodeId, buffer, payload.url);
            const label = this.getHUDLabel(nodeId, false, null, nodeId);

            if (nodeId === currentNodeId) {
                if (this.sceneController.setAmbientWash) {
                    this.sceneController.setAmbientWash(`${this.tunnelUrl}${payload.url}`);
                }
                this.ui.updatePipelineProgress(nodeId, 'complete', 1.0, false, this.navManager.currentIsAnchor, false, label, taskPayload);
            } else {
                this.treadmill.updateAggregateProgress(nodeId, this.navManager.currentIsAnchor);
                this.ui.updatePipelineProgress(nodeId, 'complete', 1.0, false, true, true, label, taskPayload);
            }

            setTimeout(() => this.treadmill.refreshMix(currentNodeId, this.navManager.currentIsAnchor, this.navManager.currentNearbyAnchors, this.navManager.radar), 100);
        } catch (e) {
            if (e.name === 'AbortError') return;
            console.error(`[Audio Error] Persistent Layer ${nodeId} failed:`, e);

            const label = this.getHUDLabel(nodeId, false, null, nodeId);
            const isBackgroundNode = nodeId !== currentNodeId;
            this.ui.updatePipelineProgress(nodeId, 'error', 1.0, false, nodeId === currentNodeId && this.navManager.currentIsAnchor, isBackgroundNode, label, taskPayload);
        }
    }
}