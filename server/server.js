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

// Core Framework Imports (Agnostic Infrastructure)
import { CacheManager } from './CacheManager.js';
import { GPUResourceManager } from './GPUResourceManager.js';
import { AIEngine } from './AIEngine/AIEngine.js';
import { LogManager } from './LogManager.js';
import { PipelineService } from './PipelineService.js';
import { SocketController } from './SocketController.js';
import { log } from 'console';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = new LogManager();

const isLocal = process.env.LOCAL_MODE === 'true';
const allowedOrigin = isLocal ? '*' : process.env.ALLOWED_ORIGIN;

/**
 * @async
 * @function startServer
 * @description Standardized Agnostic Bootloader for the Express/WebSocket backend. Assembles the infrastructure (Cache, GPU, Logging) and bootstraps the AI Engine.
 * @returns {Promise<void>}
 */
async function startServer() {
    const absoluteDbPath = process.env.DB_PATH
        ? path.resolve(__dirname, process.env.DB_PATH)
        : undefined;

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

    app.use(express.static(path.join(__dirname, 'public')));

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

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => logger.log(`[Server] Online at port ${PORT}`));
}

startServer().catch(err => logger.error(`[Fatal] Boot failed: ${err.message}`));