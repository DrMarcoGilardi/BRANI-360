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
 * Handles queuing and concurrency for hardware-intensive tasks.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class GPUResourceManager{
 * +maxWorkers number
 * +activeWorkers number
 * +isBusy() boolean
 * +isTaskActive(id) boolean
 * +acquireLock() Promise~void~
 * +releaseLock()
 * +queueBackgroundTask(task)
 * +getNextBackgroundTask() Object
 * +clearTasksForSocket(socketId)
 * +completeTask(id, success)
 * }
 * ```
 * 
 * @class
 */
export class GPUResourceManager {
    /**
     * @constructor
     * @param {number} [maxWorkers=2] - The maximum number of concurrent GPU tasks allowed.
     */
    constructor(maxWorkers = 2) {
        this.maxWorkers = maxWorkers;
        this.activeWorkers = 0;
        this.backgroundQueue = [];
        this.lockQueue = [];

        this.activeTasks = new Map();
        this.recentCompletions = new Set();
    }

    /**
     * @method isBusy
     * @memberof GPUResourceManager
     * @description Checks if the GPU worker pool is currently full.
     * @returns {boolean}
     */
    isBusy() {
        return this.activeWorkers >= this.maxWorkers;
    }

    /**
     * @method isTaskActive
     * @memberof GPUResourceManager
     * @description Checks if a specific task ID is currently being processed by the GPU.
     * @param {string} id - The task identifier.
     * @returns {boolean}
     */
    isTaskActive(id) {
        return this.activeTasks.has(id);
    }

    /**
     * @async
     * @method acquireLock
     * @memberof GPUResourceManager
     * @description Asynchronously waits until a GPU worker slot is available.
     * @returns {Promise<void>}
     */
    async acquireLock() {
        if (this.activeWorkers < this.maxWorkers) {
            this.activeWorkers++;
            return Promise.resolve();
        }
        return new Promise(resolve => {
            this.lockQueue.push(resolve);
        });
    }

    /**
     * @method releaseLock
     * @memberof GPUResourceManager
     * @description Releases a GPU worker slot and resolves the next task in the lock queue.
     */
    releaseLock() {
        if (this.activeWorkers > 0) {
            this.activeWorkers--;
        }
        if (this.lockQueue.length > 0 && this.activeWorkers < this.maxWorkers) {
            this.activeWorkers++;
            const nextResolve = this.lockQueue.shift();
            nextResolve();
        }
    }

    /**
     * @method queueBackgroundTask
     * @memberof GPUResourceManager
     * @description Adds a task to the background processing queue. Handles regeneration bypasses and metadata updates for existing tasks.
     * @param {Object} task - The task configuration object.
     */
    queueBackgroundTask(task) {
        // ALLOW bypass if this is an explicit regeneration request
        const isRegen = !!task.regenOpts;

        if (!isRegen && this.recentCompletions.has(task.id)) {
            return;
        }

        const existingQueued = this.backgroundQueue.find(t => t.id === task.id);
        const existingActive = this.activeTasks.get(task.id);

        if (existingQueued || existingActive) {
            const target = existingQueued || existingActive;

            // Update session metadata so the result can be delivered to the 
            // latest socket/epoch even if the task was started in a previous one.
            target.socket = task.socket;
            target.signal = task.signal;
            target.navEpoch = task.navEpoch;
            return;
        }

        this.backgroundQueue.push(task);
    }

    /**
     * @method getNextBackgroundTask
     * @memberof GPUResourceManager
     * @description Shifts the next task off the background queue and marks it active.
     * @returns {Object|undefined} The next task, or undefined if the queue is empty.
     */
    getNextBackgroundTask() {
        const task = this.backgroundQueue.shift();
        if (task) {
            this.activeTasks.set(task.id, task);
        }
        return task;
    }

    /**
     * @method clearTasksForSocket
     * @memberof GPUResourceManager
     * @description Flushes the task queue for a specific user upon disconnection/cancellation, preserving tasks marked as 'persistent' by the AI Engine.
     * @param {string} socketId - The client's socket identifier.
     */
    clearTasksForSocket(socketId) {
        this.backgroundQueue = this.backgroundQueue.filter(t =>
            t.socket?.id !== socketId || t.persistent === true
        );
    }

    /**
     * @method completeTask
     * @memberof GPUResourceManager
     * @description Marks an active task as completed and tracks it in the recent completions set.
     * @param {string} id - The task identifier.
     * @param {boolean} [success=true] - Whether the task finished successfully.
     */
    completeTask(id, success = true) {
        if (this.activeTasks.has(id)) {
            this.activeTasks.delete(id);
            if (success) {
                this.recentCompletions.add(id);
                if (this.recentCompletions.size > 1000) {
                    const first = this.recentCompletions.values().next().value;
                    this.recentCompletions.delete(first);
                }
            }
        }
    }
}