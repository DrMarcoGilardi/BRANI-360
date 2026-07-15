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
 * Acts as the primary research interface for WebSocket clients.  
 * It coordinates real-time data flow between the frontend, the GPU queue, and the pluggable AI strategies. 
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * SocketController --> PipelineService : Routes Events
 * SocketController --> GPUResourceManager : Triggers Cancels
 * SocketController --> LogManager : Tracks Sessions
 * class SocketController{
 * +io Server
 * +init()
 * }
 * ```
 * 
 * @class
 */
export class SocketController {
    /**
     * @constructor
     * @param {Server} io - Socket.io Server instance.
     * @param {PipelineService} pipelineService - The active generation pipeline.
     * @param {GPUResourceManager} gpuManager - The queue manager.
     * @param {LogManager} logger - The system logger.
     */
    constructor(io, pipelineService, gpuManager, logger) {
        this.io = io;
        this.pipelineService = pipelineService;
        this.gpuManager = gpuManager;
        this.logger = logger;

        this.init();
    }

    /**
     * @method init
     * @memberof SocketController
     * @description Binds event listeners to incoming connections (spatial_sync, cancel_tasks, regenerate).
     */
    init() {
        this.io.on('connection', (socket) => {
            const sessionLogName = this.logger.startSession(socket.id);
            this.logger.log(`[Network] Client Connected: ${socket.id} (Logging to: ${sessionLogName})`, "clear", socket.id);

            /**
             * Primary Navigation Sync
             * Triggered when the user moves to a new panorama.
             */
            socket.on('spatial_sync', (data) => {
                this.pipelineService.processMovement(socket, data);
            });

            /**
             * Task Cancellation
             * Flushes the GPU queue for this specific user.
             */
            socket.on('cancel_tasks', () => {
                this.gpuManager.clearTasksForSocket(socket.id);
            });

            /**
             * Audio Regeneration
             * Handles feedback-based denoising or "from scratch" requests.
             */
            socket.on('regenerate_task', (payload) => {
                this.pipelineService.regenerateTask(socket, payload.taskData, payload.feedbackData);
            });

            /**
             * Simulator Push
             * Allows external virtual environments (Unity/Unreal) to push 
             * equirectangular frames directly into the SyntheticSimSource buffer.
             */
            socket.on('sim_push_frame', (payload) => {
                const { id, buffer } = payload;
                const engine = this.pipelineService.aiEngine;

                if (engine.imageSource && typeof engine.imageSource.updateFrame === 'function') {
                    engine.imageSource.updateFrame(id, buffer);
                    this.logger.log(`[Sim] In-memory buffer updated for Simulation ID: ${id}`, "clear", socket.id);
                } else {
                    this.logger.error(`[Sim] Push rejected: Active ImageSource strategy does not support manual frame updates.`);
                }
            });

            /**
             * Client-Side Log Piping
             * Allows frontend errors or interaction events to be captured 
             * in the server's session-based .log files.
             */
            socket.on('client_event_log', (payload) => {
                this.logger.log(`[Client-${payload.type || 'EVENT'}] ${payload.message}`, "clear", socket.id);
            });

            /**
             * Hot-Reload 
             * Triggers the engine to re-load the AmbientSettings.json without a restart.
             */
            socket.on('reload_research_presets', async () => {
                try {
                    // Triggers the engine to re-read the file from its internal path
                    await this.pipelineService.aiEngine.init();
                    this.logger.log(`[System] Presets hot-reloaded successfully.`, "clear", socket.id);
                    socket.emit('system_notification', {
                        type: 'success',
                        message: "Dictionary reloaded."
                    });
                } catch (e) {
                    this.logger.error(`[System] Hot-reload failed: ${e.message}`, socket.id);
                    socket.emit('system_notification', {
                        type: 'error',
                        message: "Reload failed. Check server logs."
                    });
                }
            });

            socket.on('tunnel_keepalive', () => {
                // Heartbeat to prevent zrok/proxy timeouts
            });

            socket.on('disconnect', () => {
                this.logger.log(`[Network] Client Disconnected: ${socket.id}`, "clear", socket.id);
                this.pipelineService.cleanupSocket(socket.id);
                this.logger.endSession(socket.id);
            });
        });
    }
}