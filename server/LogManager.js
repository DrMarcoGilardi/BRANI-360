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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Handles session-based file logging.  
 * It creates a new log file for the system boot and individual files for each socket connection.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class LogManager{
 * +init()
 * +startSession(socketId) string
 * +endSession(socketId)
 * +write(stream, message)
 * +log(message, socketId)
 * +warn(message, socketId)
 * +error(message, socketId)
 * }
 * ```
 * 
 * @class
 */
export class LogManager {
    /**
     * @constructor
     */
    constructor() {
        this.logsDir = path.join(__dirname, '../../cache/logs');
        this.systemLogStream = null;
        this.sessionStreams = new Map();

        this.init();
    }

    /**
     * @method init
     * @memberof LogManager
     * @description Initializes the logging directory and system-level boot log.
     */
    init() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }

        // Initialize a system-level log for boot sequences
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `system_boot_${timestamp}.log`;
        const filePath = path.join(this.logsDir, filename);

        this.systemLogStream = fs.createWriteStream(filePath, { flags: 'a' });
        this.write(this.systemLogStream, `[SYSTEM] Log initialized at ${new Date().toISOString()}`);
        console.log(`[LogManager] System logging started: ${filename}`);
    }

    /**
     * @method startSession
     * @memberof LogManager
     * @description Starts a new log file for a specific socket session.
     * @param {string} socketId - The client's socket identifier.
     * @returns {string} The generated filename for the session log.
     */
    startSession(socketId) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `session_${socketId}_${timestamp}.log`;
        const filePath = path.join(this.logsDir, filename);

        const stream = fs.createWriteStream(filePath, { flags: 'a' });
        this.sessionStreams.set(socketId, stream);

        this.write(stream, `[SESSION START] Socket: ${socketId} at ${new Date().toISOString()}`);
        return filename;
    }

    /**
     * @method endSession
     * @memberof LogManager
     * @description Closes the write stream for a disconnected session.
     * @param {string} socketId - The client's socket identifier.
     */
    endSession(socketId) {
        if (this.sessionStreams.has(socketId)) {
            const stream = this.sessionStreams.get(socketId);
            this.write(stream, `[SESSION END] Socket disconnected at ${new Date().toISOString()}`);
            stream.end();
            this.sessionStreams.delete(socketId);
        }
    }

    /**
     * @method write
     * @memberof LogManager
     * @description Internal write helper that strips ANSI colors before writing to disk.
     * @param {fs.WriteStream} stream - The target file stream.
     * @param {string} message - The raw string message.
     */
    write(stream, message) {
        if (stream && stream.writable) {
            const cleanMessage = message.replace(/\u001b\[[0-9;]*m/g, ''); // Strip ANSI colors
            stream.write(`${cleanMessage}\n`);
        }
    }

    /**
     * @method log
     * @memberof LogManager
     * @description Central logging method that mirrors to console, system log, and active session log.
     * @param {string} message - The message to log.
     * @param {string|null} [socketId=null] - Optional socket ID to route to a specific session log.
     */
    log(message, socketId = null) {
        const timestamp = new Date().toLocaleTimeString();
        const fullMessage = `[${timestamp}] ${message}`;

        console.log(fullMessage);

        this.write(this.systemLogStream, fullMessage);

        if (socketId && this.sessionStreams.has(socketId)) {
            this.write(this.sessionStreams.get(socketId), fullMessage);
        }
    }

    /**
     * @method warn
     * @memberof LogManager
     * @description Warning logging method for non-fatal alerts.
     * @param {string} message - The warning message.
     * @param {string|null} [socketId=null] - Optional socket ID.
     */
    warn(message, socketId = null) {
        const timestamp = new Date().toLocaleTimeString();
        const fullMessage = `[${timestamp}] [WARNING] ${message}`;

        console.warn(fullMessage);
        this.write(this.systemLogStream, fullMessage);

        if (socketId && this.sessionStreams.has(socketId)) {
            this.write(this.sessionStreams.get(socketId), fullMessage);
        }
    }

    /**
     * @method error
     * @memberof LogManager
     * @description Error logging method for critical failures.
     * @param {string} message - The error message.
     * @param {string|null} [socketId=null] - Optional socket ID.
     */
    error(message, socketId = null) {
        const timestamp = new Date().toLocaleTimeString();
        const fullMessage = `[${timestamp}] [ERROR] ${message}`;

        console.error(fullMessage);
        this.write(this.systemLogStream, fullMessage);

        if (socketId && this.sessionStreams.has(socketId)) {
            this.write(this.sessionStreams.get(socketId), fullMessage);
        }
    }
}