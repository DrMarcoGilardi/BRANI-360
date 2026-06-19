/**
 * PipelineService (Framework Orchestrator)
 * A pure, domain-agnostic task runner.
 * It treats tasks as black boxes and moves data without editing it.
 */
export class PipelineService {
    /**
     * @constructor
     * @param {AIEngine} aiEngine - The central AI processing engine.
     * @param {GPUResourceManager} gpuManager - The queue/concurrency manager.
     * @param {CacheManager} cacheManager - The hybrid caching system.
     * @param {LogManager} logger - The system logger.
     */
    constructor(aiEngine, gpuManager, cacheManager, logger) {
        this.aiEngine = aiEngine;
        this.gpuManager = gpuManager;
        this.cacheManager = cacheManager;
        this.logger = logger;

        this.activeControllers = new Map();
        this.socketEpochs = new Map();

        this.pipelineStartTime = 0;
        this.activeBatchNodeId = null;
    }

    /**
     * @method setEpoch
     * @memberof PipelineService
     * @description Registers the current navigation epoch for a specific client socket.
     * @param {string} socketId - The client's socket identifier.
     * @param {number} epoch - The current navigation tick.
     */
    setEpoch(socketId, epoch) { this.socketEpochs.set(socketId, epoch); }

    /**
     * @method cleanupSocket
     * @memberof PipelineService
     * @description Aborts active tasks and removes epoch tracking for a disconnected client.
     * @param {string} socketId - The client's socket identifier.
     */
    cleanupSocket(socketId) {
        if (this.activeControllers.has(socketId)) this.activeControllers.get(socketId).abort();
        this.socketEpochs.delete(socketId);
    }

    /**
     * @method checkBatchCompletion
     * @memberof PipelineService
     * @description Evaluates if all queued tasks for the active batch have concluded to log completion times.
     */
    checkBatchCompletion() {
        if (this.gpuManager.backgroundQueue.length === 0 && !this.gpuManager.isBusy() && this.pipelineStartTime) {
            const totalTime = ((Date.now() - this.pipelineStartTime) / 1000).toFixed(2);
            this.logger.log(`[Pipeline] Batch ${this.activeBatchNodeId} processed in ${totalTime}s`);
        }
    }

    /**
     * @method _sanitize
     * @memberof PipelineService
     * @description Strips non-serializable objects (sockets, abort signals) from task data prior to network emission.
     * @param {Object} data - The raw task payload.
     * @returns {Object|null} Sanitized payload.
     * @private
     */
    _sanitize(data) {
        if (!data) return null;
        const { socket, signal, ...clean } = data;
        return clean;
    }

    /**
     * @method _emitStage
     * @memberof PipelineService
     * @description Emits standardized progress updates back to the client interface.
     * @param {Socket} socket - The target client socket.
     * @param {Object} task - The task data.
     * @param {string} stage - The human-readable pipeline stage.
     * @param {number} progress - The raw progress percentage (0.0 to 1.0).
     * @private
     */
    _emitStage(socket, task, stage, progress) {
        let mappedProgress = progress;
        const s = stage.toLowerCase();

        if (s.includes('vlm')) mappedProgress = 0.30;
        else if (s.includes('queued')) mappedProgress = 0.50;
        else if (s.includes('audio processing')) mappedProgress = 0.50 + (progress * 0.49);
        else if (s === 'complete') mappedProgress = 1.0;

        socket.emit('pipeline_progress', {
            id: task.id, nodeId: task.nodeId, stage, progress: mappedProgress,
            navEpoch: task.navEpoch, taskData: this._sanitize(task)
        });
    }

    /**
     * @async
     * @method processMovement
     * @memberof PipelineService
     * @description Primary entry point for syncing audio generation when a user navigates to a new node. Coordinates VLM analysis, foreground layer generation, and background horizon fetching.
     * @param {Socket} socket - The client's socket.
     * @param {Object} data - Navigation payload including coordinates, anchors, and requested layers.
     * @returns {Promise<void>}
     */
    async processMovement(socket, data) {
        const { nodeId, requestedLayers, fromId, navEpoch, isAnchor, nearbyAnchors, location, dbPayload } = data;
        const socketId = socket.id;

        this.logger.log(`\n[Pipeline] Movement Sync: Node ${nodeId} (Epoch: ${navEpoch})`, socketId);
        this.setEpoch(socketId, navEpoch);
        this.pipelineStartTime = Date.now();
        this.activeBatchNodeId = nodeId;

        if (this.activeControllers.has(socketId)) this.activeControllers.get(socketId).abort();

        const controller = new AbortController();
        this.activeControllers.set(socketId, controller);
        this.gpuManager.clearTasksForSocket(socketId);

        let [lat, lng] = [0, 0];
        if (typeof location === 'string') [lat, lng] = location.split(',').map(v => parseFloat(v));
        else if (location?.lat) {
            lat = typeof location.lat === 'function' ? location.lat() : location.lat;
            lng = typeof location.lng === 'function' ? location.lng() : location.lng;
        }

        const locationContext = await this.aiEngine.context?.resolve(lat, lng) || "Unknown Location";

        const mainLayers = requestedLayers || ['ambient', 'spatial'];

        socket.emit('pipeline_progress', {
            id: nodeId,
            nodeId: nodeId,
            stage: 'vlm analysis',
            progress: 0.10,
            navEpoch: navEpoch,
            taskData: { nodeId: nodeId, label: "Scanning Scene..." }
        });

        this.aiEngine.getTasksForMovement(nodeId, lat, lng, isAnchor, locationContext, mainLayers)
            .then(async (tasks) => {
                // Persistence: Cache spidered node results if provided
                if (dbPayload && !await this.cacheManager.getNode(nodeId)) {
                    dbPayload.objects = tasks.filter(t => t.visualMetadata).map(t => t.visualMetadata);
                    await this.cacheManager.saveNode(nodeId, dbPayload);
                }
                tasks.forEach(t => this.queueTask(socket, t, navEpoch, controller.signal));
            });

        if (nearbyAnchors && Array.isArray(nearbyAnchors)) {
            nearbyAnchors.forEach(anchor => {
                const id = typeof anchor === 'string' ? anchor : (anchor.nodeId || anchor.id);
                const anchorLayers = anchor.requestedLayers || ['ambient'];
                if (!id || id === nodeId) return;

                socket.emit('pipeline_progress', {
                    id: id,
                    nodeId: id,
                    stage: 'vlm analysis',
                    progress: 0.10,
                    navEpoch: navEpoch,
                    taskData: { nodeId: id, label: "Scanning Background..." }
                });

                this.aiEngine.getTasksForHorizon(id, lat, lng, locationContext, anchorLayers)
                    .then(tasks => tasks.forEach(t => this.queueTask(socket, t, navEpoch, controller.signal)));
            });
        }
    }

    /**
     * @method queueTask
     * @memberof PipelineService
     * @description Routes a single synthesized task to either the active Cache or the GPU queue.
     * @param {Socket} socket - The client's socket.
     * @param {Object} task - The task configuration.
     * @param {number} navEpoch - The navigation tick tracking task relevance.
     * @param {AbortSignal} signal - The controller signal for cancellation.
     */
    queueTask(socket, task, navEpoch, signal) {
        const fullTask = { ...task, socket, navEpoch, signal };
        const audioKey = task.audioContentId || task.id;

        // Bypass cache check if AI Engine flag requires regeneration
        if (task.isRegen) {
            this._emitStage(socket, fullTask, 'queued (regen)', 0.0);
            this.gpuManager.queueBackgroundTask(fullTask);
            this.processGPUQueue();
            return;
        }

        this.cacheManager.getAudio(audioKey).then(cached => {
            if (cached) {
                this._emitReadyEvent(fullTask, audioKey);
            } else {
                this._emitStage(socket, fullTask, 'queued', 0.0);
                this.gpuManager.queueBackgroundTask(fullTask);
                this.processGPUQueue();
            }
        });
    }

    /**
     * @async
     * @method processGPUQueue
     * @memberof PipelineService
     * @description Continuously pulls tasks from the GPU queue until saturation is reached.
     * @returns {Promise<void>}
     */
    async processGPUQueue() {
        while (!this.gpuManager.isBusy()) {
            const task = this.gpuManager.getNextBackgroundTask();
            if (!task) break;
            this._executeSynthesisTask(task);
        }
    }

    /**
     * @async
     * @method _executeSynthesisTask
     * @memberof PipelineService
     * @description Acquires a GPU lock and executes the synthesis workload for a specific task.
     * @param {Object} task - The task payload targeting the AudioProvider.
     * @private
     */
    async _executeSynthesisTask(task) {
        const audioKey = task.audioContentId || task.id;

        // Abort if the task is NOT marked as persistent by the AI Engine.
        if (task.signal?.aborted && !task.persistent) {
            this.gpuManager.completeTask(task.id, false);
            return;
        }

        await this.gpuManager.acquireLock();

        const alreadyCached = await this.cacheManager.getAudio(audioKey);
        if (alreadyCached && !task.isRegen) {
            this.logger.log(`[Pipeline] Bypassing GPU, ${audioKey} was generated by a parallel task.`);
            this._emitReadyEvent(task, audioKey);
            this.gpuManager.releaseLock();
            this.gpuManager.completeTask(task.id, true);
            setImmediate(() => this.processGPUQueue());
            return;
        }

        const progressCallback = (p) => this._emitStage(task.socket, task, 'audio processing', p);
        
        let success = false;
        try {
            const safeSignal = task.persistent ? task.signal : null;
            const result = await this.aiEngine.generateAudio(task, safeSignal, task.socket, progressCallback);
            if (result?.buffer) {
                await this.cacheManager.saveAudio(audioKey, result.buffer);
                this._emitReadyEvent(task, audioKey);
                success = true;
            }
        } catch (e) {
            this.logger.error(`[GPU Fail] ${task.id}: ${e.message}`);
        } finally {
            this.gpuManager.releaseLock();
            this.gpuManager.completeTask(task.id, success);
            setImmediate(() => this.processGPUQueue());
        }
    }

    /**
     * @method _emitReadyEvent
     * @memberof PipelineService
     * @description Emits the final stream URL to the client once audio processing is complete.
     * @param {Object} task - The completed task object.
     * @param {string} audioKey - The cache/file reference identifier.
     * @private
     */
    _emitReadyEvent(task, audioKey) {
        const ext = this.cacheManager.audioExt || 'wav';
        const url = `/audio/stream.${ext}?id=${encodeURIComponent(audioKey)}`;
        // const url = `/audio/${this.cacheManager.getSafeFileName(audioKey)}`;
        const cleanTask = this._sanitize(task);

        const currentEpoch = this.socketEpochs.get(task.socket.id);

        // Deliver if still relevant to current view OR if task is background-persistent
        if (task.navEpoch === currentEpoch || task.persistent) {
            task.socket.emit(task.eventName, {
                url,
                nodeId: task.nodeId,
                navEpoch: task.navEpoch,
                taskData: cleanTask
            });
        }
        this.checkBatchCompletion();
    }

    /**
     * @async
     * @method regenerateTask
     * @memberof PipelineService
     * @description Stateless entry for audio regeneration (human-in-the-loop). Creates a new forced-bypass task using user feedback.
     * @param {Socket} socket - The client's socket.
     * @param {Object} taskData - The original task metadata.
     * @param {Object} feedbackData - The user's feedback payload (text, ratings).
     * @returns {Promise<void>}
     */
    async regenerateTask(socket, taskData, feedbackData) {
        const currentEpoch = this.socketEpochs.get(socket.id) || 0;
        const signal = (this.activeControllers.get(socket.id) || new AbortController()).signal;

        const newTask = await this.aiEngine.createRegenTask(taskData, feedbackData, currentEpoch, signal);
        if (newTask) {
            newTask.isRegen = true;
            this.queueTask(socket, newTask, currentEpoch, signal);
        }
    }
}