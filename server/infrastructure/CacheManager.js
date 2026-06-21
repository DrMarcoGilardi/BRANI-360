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

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Implements a hybrid storage strategy:  
 *  - SQLite: Database of pointers and lightweight metadata.  
 *  - Filesystem: Standalone storage for JSON (VLM Ouputs) and Audio outputs.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class CacheManager{
 * +dbPath string
 * +init()
 * +get(key, type) Promise~any~
 * +set(key, value, type) Promise~boolean~
 * +delete(key) Promise~boolean~
 * +getNode(nodeId) Promise~Object~
 * +saveNode(nodeId, data) Promise~boolean~
 * +getImage(imageId) Promise~string~
 * +saveImage(imageId, buffer) Promise~string~
 * +getVLMData(nodeId) Promise~Object~
 * +saveVLMData(nodeId, data) Promise~boolean~
 * +getAudio(id) Promise~string~
 * +saveAudio(id, buffer) Promise~boolean~
 * }
 * ```
 * 
 * @class
 */
export class CacheManager {
    /**
     * @constructor
     * @param {Object} config - Configuration object containing { dbPath, audioFormat }.
     * @param {Object} [logger=console] - Optional logger instance.
     */
    constructor(config, logger = console) {
        let rawPath = (config.dbPath)?.trim() || path.join(__dirname, '../..', 'cache', 'cache.db');
        this.dbPath = path.resolve(__dirname, rawPath);
        this.audioExt = config.audioFormat || 'wav';
        this.logger = logger;
        this.db = null;

        const baseDir = path.dirname(this.dbPath);

        // Ensure the directories exist before trying to create the DB file or save audio
        if (this.dbPath !== ':memory:') {
            // Define directory structure relative to the database location
            this.audioCacheDir = path.join(baseDir, 'audio_cache');
            this.vlmCacheDir = path.join(baseDir, 'VLM_cache');

            const dirs = [baseDir, this.audioCacheDir, this.vlmCacheDir];

            dirs.forEach(dir => {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
            });

            // VLM and Audio boot logs
            this.logger.log(`[CacheManager] VLM Cache path: ${this.vlmCacheDir}`);
            this.logger.log(`[CacheManager] Audio Cache path: ${this.audioCacheDir}`);
        }

        this.imageCacheDir = path.join(baseDir, 'image_cache');
        if (!fs.existsSync(this.imageCacheDir)) {
            fs.mkdirSync(this.imageCacheDir, { recursive: true });
        }
        this.logger.log(`[CacheManager] Image Cache path: ${this.imageCacheDir}`);
    }

    /**
     * @method init
     * @memberof CacheManager
     * @description Initializes the SQLite database and creates the necessary tables. Operates synchronously via better-sqlite3.
     * @throws {Error} If database initialization fails.
     */
    init() {
        try {
            this.logger.log(`[CacheManager] Initializing database at ${this.dbPath}`);

            this.db = new Database(this.dbPath, { fileMustExist: false, readonly: false });
            this.db.pragma('journal_mode = WAL');

            // Create a unified cache table using an UPSERT structure
            const createTableStmt = `
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    value TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;
            this.db.exec(createTableStmt);

            this.logger.log('[CacheManager] Database initialized and tables verified.');
        } catch (error) {
            this.logger.error(`[CacheManager] Failed to initialize database: ${error.message}`);
            throw error;
        }
    }

    /**
     * @async
     * @method get
     * @memberof CacheManager
     * @description Retrieves a value from the SQLite cache.
     * @param {string} key - The unique identifier for the cache entry.
     * @param {string} [type='json'] - The data format ('json' or 'string').
     * @returns {Promise<any|null>} The parsed JSON or string value, or null if not found.     
     */
    async get(key, type = 'json') {
        if (!this.db) throw new Error("Database not initialized. Call init() first.");

        try {
            const stmt = this.db.prepare('SELECT value FROM cache WHERE key = ? AND type = ?');
            const row = stmt.get(key, type);

            if (row) {
                this.logger.log(`[CacheManager] Cache hit for key: ${key}`);
                return type === 'json' ? JSON.parse(row.value) : row.value;
            }

            this.logger.log(`[CacheManager] Cache miss for key: ${key}`);
            return null;
        } catch (error) {
            this.logger.error(`[CacheManager] Error getting key ${key}: ${error.message}`);
            return null;
        }
    }

    /**
     * @async
     * @method set
     * @memberof CacheManager
     * @description Stores a value in the SQLite cache using an UPSERT strategy.
     * @param {string} key - The unique identifier for the cache entry.
     * @param {any} value - The data to store.
     * @param {string} [type='json'] - The data format ('json' or 'string').
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async set(key, value, type = 'json') {
        if (!this.db) throw new Error("Database not initialized. Call init() first.");
        try {
            const storeValue = type === 'json' ? JSON.stringify(value) : value;

            const stmt = this.db.prepare(`
                INSERT INTO cache (key, type, value) 
                VALUES (?, ?, ?) 
                ON CONFLICT(key) DO UPDATE SET 
                    value = excluded.value,
                    created_at = CURRENT_TIMESTAMP
            `);

            stmt.run(key, type, storeValue);

            this.logger.log(`[CacheManager] Cache stored for key: ${key}`);
            return true;
        } catch (error) {
            this.logger.error(`[CacheManager] Error setting key ${key}: ${error.message}`);
            return false;
        }
    }

    /**
     * @async
     * @method delete
     * @memberof CacheManager
     * @description Deletes a specific entry from the SQLite cache.
     * @param {string} key - The unique identifier for the cache entry.
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async delete(key) {
        if (!this.db) throw new Error("Database not initialized.");
        try {
            const stmt = this.db.prepare('DELETE FROM cache WHERE key = ?');
            stmt.run(key);
            return true;
        } catch (error) {
            this.logger.error(`[CacheManager] Error deleting key ${key}: ${error.message}`);
            return false;
        }
    }

    /**
     * @method close
     * @memberof CacheManager
     * @description Closes the database connection safely.
     */
    close() {
        if (this.db) {
            this.db.close();
            this.logger.log('[CacheManager] Database connection closed.');
        }
    }

    // ==========================================
    // Domain Wrappers Required by Pipeline
    // ==========================================
    /**
     * @method getSafeFileName
     * @memberof CacheManager
     * @description Sanitizes an identifier for safe use as a file name.
     * @param {string|number} id - The raw identifier.
     * @returns {string} The sanitized file name.
     */
    getSafeFileName(id) {
        return id.toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    /**
     * @async
     * @method getNode
     * @memberof CacheManager
     * @description Retrieves cached metadata for a specific geographic node.
     * @param {string} nodeId - The unique node identifier.
     * @returns {Promise<Object|null>} The node data.
     */
    async getNode(nodeId) {
        return this.get(`node_${nodeId}`, 'json');
    }

    /**
     * @async
     * @method saveNode
     * @memberof CacheManager
     * @description Saves geographic node metadata to the cache.
     * @param {string} nodeId - The unique node identifier.
     * @param {Object} data - The node data to save.
     * @returns {Promise<boolean>}
     */
    async saveNode(nodeId, data) {
        return this.set(`node_${nodeId}`, data, 'json');
    }

    // --- IMAGES HYBRID CACHING---
    /**
     * @async
     * @method getImage
     * @memberof CacheManager
     * @description Retrieves the physical path of a cached image.
     * @param {string} imageId - The unique image identifier.
     * @returns {Promise<string|null>} The file path, or null if not found.
     */
    async getImage(imageId) {
        const imagePath = path.join(this.imageCacheDir, `${imageId}.jpg`);
        if (fs.existsSync(imagePath)) {
            return imagePath;
        }
        return null;
    }

    /**
     * @async
     * @method saveImage
     * @memberof CacheManager
     * @description Saves an image buffer to the physical filesystem.
     * @param {string} imageId - The unique image identifier.
     * @param {Buffer} buffer - The image data.
     * @returns {Promise<string|null>} The file path if successful, null otherwise.
     */
    async saveImage(imageId, buffer) {
        const imagePath = path.join(this.imageCacheDir, `${imageId}.jpg`);
        try {
            fs.writeFileSync(imagePath, buffer);
            return imagePath;
        } catch (e) {
            this.logger.error(`[CacheManager] Failed to save image ${imageId}: ${e.message}`);
            return null;
        }
    }

    // --- VLM HYBRID CACHING ---
    /**
     * @async
     * @method getVLMData
     * @memberof CacheManager
     * @description Retrieves VLM (Vision-Language Model) data for a given node. Resolves the database pointer to read the physical JSON file from disk.
     * @param {string} nodeId - The unique node identifier.
     * @returns {Promise<Object|null>} The parsed VLM JSON data.
     */
    async getVLMData(nodeId) {
        try {
            // Fetch the physical file path from SQLite
            const filePath = await this.get(`vlm_${nodeId}`, 'string');
            if (!filePath) return null;

            // Read and parse the heavy JSON from the filesystem
            const fileData = await fs.promises.readFile(filePath, 'utf8');
            return JSON.parse(fileData);
        } catch (error) {
            this.logger.error(`[CacheManager] Failed to read VLM file for ${nodeId}: ${error.message}`);
            return null;
        }
    }

    /**
     * @async
     * @method saveVLMData
     * @memberof CacheManager
     * @description Saves VLM data as an individual physical JSON file and stores its pointer in the database.
     * @param {string} nodeId - The unique node identifier.
     * @param {Object} data - The VLM data to serialize and save.
     * @returns {Promise<boolean>} True if successful.
     */
    async saveVLMData(nodeId, data) {
        try {
            const safeName = this.getSafeFileName(nodeId) + '.json';
            const filePath = path.join(this.vlmCacheDir, safeName);

            // Write the formatted JSON out to a separate physical file
            await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));

            // Store the lightweight pointer string in the SQLite database
            return this.set(`vlm_${nodeId}`, filePath, 'string');
        } catch (error) {
            this.logger.error(`[CacheManager] Failed to save VLM file for ${nodeId}: ${error.message}`);
            return false;
        }
    }

    /**
     * @async
     * @method saveAudio
     * @memberof CacheManager
     * @description Saves a physical audio buffer to disk and stores its path in SQLite.
     * @param {string} id - The unique audio identifier.
     * @param {Buffer} buffer - The raw audio data.
     * @returns {Promise<boolean>} True if successful.
     */
    async saveAudio(id, buffer) {
        try {
            // Apply the environment-defined extension to the filename
            const safeName = this.getSafeFileName(id) + '.' + this.audioExt;
            const filePath = path.join(this.audioCacheDir, safeName);

            // Write binary to disk
            await fs.promises.writeFile(filePath, buffer);

            // Save the path reference in the database
            return this.set(`audio_${id}`, filePath, 'string');
        } catch (error) {
            this.logger.error(`[CacheManager] Failed to save audio ${id}: ${error.message}`);
            return false;
        }
    }

    /**
     * @async
     * @method getAudio
     * @memberof CacheManager
     * @description Retrieves the database reference path for an audio file.
     * @param {string} id - The unique audio identifier.
     * @returns {Promise<string|null>} The file path.
     */
    async getAudio(id) {
        return this.get(`audio_${id}`, 'string');
    }

    /**
     * @async
     * @method getAudioPath
     * @memberof CacheManager
     * @description Retrieves the physical path to serve via Express.
     * @param {string} id - The unique audio identifier.
     * @returns {Promise<string|null>} The file path.
     */
    async getAudioPath(id) {
        return this.get(`audio_${id}`, 'string');
    }

    /**
     * @async
     * @method deleteAudio
     * @memberof CacheManager
     * @description Deletes an audio file and its database reference.
     * @param {string} id - The unique audio identifier.
     * @returns {Promise<boolean>} True if successful.
     */
    async deleteAudio(id) {
        const filePath = await this.getAudioPath(id);
        if (filePath) {
            try {
                await fs.promises.unlink(filePath);
            } catch (error) {
                this.logger.warn(`[CacheManager] Failed to delete file ${filePath}: ${error.message}`);
            }
            return this.delete(`audio_${id}`);
        }
        return false;
    }
}