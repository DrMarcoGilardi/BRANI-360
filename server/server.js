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

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';

// Core Framework Imports (Agnostic Infrastructure)
import { AIEngine } from './engine/AIEngine.js';
import { SocketController } from './network/SocketController.js';
import { PipelineService } from './orchestrator/PipelineService.js';
import { CacheManager } from './infrastructure/CacheManager.js';
import { GPUResourceManager } from './infrastructure/GPUResourceManager.js';
import { LogManager } from './infrastructure/LogManager.js';
import { log } from 'console';

// dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env');

dotenv.config({ path: envPath });

const logger = new LogManager(process.env.DB_PATH);

const isLocal = process.env.LOCAL_MODE === 'true';
const allowedOrigin = isLocal ? '*' : process.env.ALLOWED_ORIGIN;

/**
 * @async
 * @function startServer
 * @description Standardized Agnostic Bootloader for the Express/WebSocket backend. Assembles the infrastructure (Cache, GPU, Logging) and bootstraps the AI Engine.
 * @returns {Promise<void>}
 */
async function startServer() {


    const logger = new LogManager(process.env.DB_PATH);
    const cacheManager = new CacheManager(
        { dbPath: process.env.DB_PATH, audioFormat: process.env.AUDIO_FORMAT },
        logger
    );
    await cacheManager.init();
    const gpuManager = new GPUResourceManager(process.env.GPU_MAX_WORKERS);

    // The Engine receives the raw process.env and manages its own providers.
    const aiEngine = new AIEngine({
        config: process.env,
        cacheManager,
        logger
    });

    // Triggers internal AI Engine instantiation
    await aiEngine.init();

    const app = express();
    app.use(cors({ origin: allowedOrigin }));
    app.use(express.json());

    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: allowedOrigin,
            methods: ["GET", "POST"]
        }
    });

    const pipelineService = new PipelineService(aiEngine, gpuManager, cacheManager, logger);
    new SocketController(io, pipelineService, gpuManager, logger);

    logger.log(`[Server] For the .env admin dashboard open http://localhost:${process.env.PORT}/admin`, "cyan");

    // --- ADMIN ROUTES (Secured via Localhost) ---
    /**
     * @api {get} /admin
     * @description Serves the protected Dashboard UI HTML file.
     */
    app.get('/admin', requireLocalhost, (req, res) => {
        // Point to the new admin subfolder
        res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
    });

    // This ensures only localhost can download the admin styles and scripts
    app.use('/admin', requireLocalhost, express.static(path.join(__dirname, 'admin')));

    /**
     * @api {get} /api/admin/env
     * @description Exposes the fully parsed environment dictionary (including comments) to the local dashboard.
     */
    app.get('/api/admin/env', requireLocalhost, (req, res) => {
        res.json(getEnvData());
    });

    /**
     * @api {post} /api/admin/env
     * @description Receives variable updates, writes them to disk, dynamically reloads the AI Engine, and broadcasts a reload signal to clients.
     */
    app.post('/api/admin/env', requireLocalhost, async (req, res) => {
        try {
            updateEnvFile(req.body);

            aiEngine.config = process.env;
            await aiEngine.init();

            io.emit('server_reloaded');

            logger.log(`[Admin] Environment updated and engine re-initialized.`);
            res.json({ success: true });
        } catch (error) {
            logger.error(`[Admin] Env update failed: ${error.message}`);
            res.status(500).json({ error: "Update failed" });
        }
    });

    // --- EXPRESS APIs ---
    /**
     * @api {get} /api/config
     * @description Exposes public client-side UI and Strategy configuration data securely without leaking backend environment secrets.
     * @returns {Object} JSON configuration object.
     */
    app.get('/api/config', (req, res) => {
        res.json(aiEngine.getPublicConfig());
    });

    /**
     * @api {get} /api/node/:nodeId
     * @description Fast-path data retrieval for previously spidered semantic nodes to bypass expensive VLM network analysis.
     * @param {string} req.params.nodeId - The identifier of the cached node.
     * @returns {Object} JSON representation of the cached semantic metadata and intents.
     */
    app.get('/api/node/:nodeId', async (req, res) => {
        try {
            const data = await cacheManager.getNode(req.params.nodeId);
            if (data) res.json(data);
            else res.status(404).send("Node not found");
        } catch (e) { res.status(500).send("DB Error"); }
    });

    /**
     * @api {get} /audio/stream.:ext
     * @description Agnostic audio delivery endpoint. Locates and serves synthesized audio binaries from the cache system via ID.
     * @param {string} req.query.id - The unique audio cache identifier.
     * @param {string} req.params.ext - Requested audio file extension.
     * @returns {Buffer} Audio binary stream.
     */
    app.get('/audio/stream.:ext', async (req, res) => {
        try {
            // Express automatically decodes the query string. 
            // 'id' perfectly matches the raw database key (including '_' and '.')
            const id = req.query.id;

            if (!id) {
                return res.status(400).send("Missing audio ID payload.");
            }

            const filePath = await cacheManager.getAudioPath(id);

            if (!filePath) {
                return res.status(404).send("Audio not found in database.");
            }

            res.sendFile(filePath);
        } catch (e) {
            res.status(404).send("Not found");
        }
    });

    // Serve public assets
    app.use(express.static(path.join(__dirname, 'public')));

    const PORT = process.env.PORT;
    server.listen(PORT, () => logger.log(`[Server] Online at port ${PORT}`));
}

/**
 * @function requireLocalhost
 * @description Express middleware to restrict route access strictly to the local machine. Blocks external IP addresses from accessing the admin dashboard.
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 * @param {express.NextFunction} next - The next middleware function.
 */
function requireLocalhost(req, res, next) {
    const clientIp = req.ip || req.connection.remoteAddress;

    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
        next();
    } else {
        logger.warn(`[Security] Blocked external attempt to access admin dashboard from IP: ${clientIp}`);
        res.status(403).send("403 Forbidden: Admin access is restricted to localhost.");
    }
}

/**
 * @function getEnvData
 * @description Parses the .env file into an ordered array of blocks. Separates standalone section headers from variable-specific comments.
 * @returns {Array<Object>} An array of objects representing the document flow. [{ type: 'section', content: '...' }, { type: 'variable', key: '...', value: '...', comment: '...' }]
 */
function getEnvData() {
    if (!fs.existsSync(envPath)) {
        logger.error(`[Admin API] Cannot read .env, file not found at: ${envPath}`);
        return [];
    }

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    const items = [];
    let currentBlock = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('#') || trimmed === '') {
            currentBlock.push(line);
        } else {
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let val = match[2].trim();

                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }

                // Split accumulated comments: scan backwards to separate variable docs from section headers
                let varComments = [];
                let sectionLines = [];
                let hitBoundary = false;

                for (let j = currentBlock.length - 1; j >= 0; j--) {
                    const cLine = currentBlock[j];
                    const cTrimmed = cLine.trim();

                    if (hitBoundary) {
                        sectionLines.unshift(cLine);
                    } else {
                        if (cTrimmed === '' || cTrimmed.includes('===') || cTrimmed.includes('---')) {
                            hitBoundary = true;
                            sectionLines.unshift(cLine);
                        } else {
                            varComments.unshift(cLine);
                        }
                    }
                }

                if (sectionLines.length > 0) {
                    items.push({ type: 'section', content: sectionLines.join('\n') });
                }

                items.push({
                    type: 'variable',
                    key: key,
                    value: val,
                    comment: varComments.join('\n')
                });

                currentBlock = [];
            } else {
                // If malformed, treat as a text block
                currentBlock.push(line);
            }
        }
    }

    // Push any trailing comments at the end of the file as a section
    if (currentBlock.length > 0) {
        items.push({ type: 'section', content: currentBlock.join('\n') });
    }

    return items;
}

/**
 * @function updateEnvFile
 * @description Reconstructs and writes the .env file sequentially from an array of blocks, maintaining exact order and updating the live `process.env`.
 * @param {Array<Object>} items - The ordered array of section and variable blocks from the UI.
 */
function updateEnvFile(items) {
    if (!fs.existsSync(envPath)) {
        logger.warn(`[Admin API] Creating new .env file at: ${envPath}`);
    }

    // Track old keys to detect deletions for process.env cleanup
    const oldData = getEnvData();
    const oldKeys = oldData.filter(i => i.type === 'variable').map(i => i.key);

    const newLines = [];
    const newKeys = new Set();

    for (const item of items) {
        if (item.type === 'section') {
            newLines.push(item.content);
        } else if (item.type === 'variable') {
            if (item.comment && item.comment.trim() !== '') {
                const commentLines = item.comment.split(/\r?\n/).map(l => {
                    const t = l.trim();
                    return (t === '' || t.startsWith('#')) ? l : `# ${l}`;
                });
                newLines.push(commentLines.join('\n'));
            }
            newLines.push(`${item.key}="${item.value}"`);

            // Update active memory
            process.env[item.key] = item.value;
            newKeys.add(item.key);
        }
    }

    // Scrub deleted keys from live memory
    for (const key of oldKeys) {
        if (!newKeys.has(key)) {
            delete process.env[key];
        }
    }

    fs.writeFileSync(envPath, newLines.join('\n'));
}

startServer().catch(err => logger.error(`[Fatal] Boot failed: ${err.message}`));