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

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Utils } from '../utils/Utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Handles logic, prompt construction, and provider selection.  
 * Standardized: Encapsulates all strategy instantiation and dictionary.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * AIEngine --> ImageSourceProvider : Uses
 * AIEngine --> ContextProvider : Uses
 * AIEngine --> VisionProvider : Uses
 * AIEngine --> AudioProvider : Uses
 * AIEngine --> CacheManager : Uses
 * class AIEngine{
 * +init() Promise~void~
 * +getPublicConfig() Object
 * +getTasksForMovement(nodeId, lat, lng, isAnchor, locationContext, requestedLayers) Promise~Array~
 * +getTasksForHorizon(nodeId, lat, lng, locationContext, requestedLayers) Promise~Array~
 * +createRegenTask(taskData, feedbackData, epoch) Promise~Object~
 * +process(nodeId, lat, lng, options) Promise~Object~
 * +generateAudio(task, signal, socket, progressCallback) Promise~Object~
 * }
 * ```
 * 
 * @class
 */
export class AIEngine {
    /**
     * @constructor
     * @param {Object} options - Initialization options including config, cacheManager, and logger.
     */
    constructor(options = {}) {
        this.config = options.config || {};
        this.cacheManager = options.cacheManager;
        this.logger = options.logger || console;

        this.dictionary = {};
        this.activeNodeId = null;
        this.activeBase64 = null;
        this.targetFormat = (this.config.AUDIO_FORMAT || 'wav').toLowerCase();

        this.imageSource = null;
        this.vision = null;
        this.synthesis = null;
        this.context = null;
    }

    /**
     * @async
     * @method init
     * @memberof AIEngine
     * @description Instantiates the configured strategy providers via dynamic imports based on the environment variables.
     * @returns {Promise<void>}
     */
    async init() {
        try {
            const imgClassStr = this.config.IMAGE_PROVIDER;
            const ctxClassStr = this.config.CONTEXT_PROVIDER;
            const visClassStr = this.config.VISION_PROVIDER;
            const audClassStr = this.config.AUDIO_PROVIDER;

            const [ImageModule, ContextModule, VisionModule, AudioModule] = await Promise.all([
                import(`./strategies/imagesource/${imgClassStr}.js`),
                import(`./strategies/context/${ctxClassStr}.js`),
                import(`./strategies/vision/${visClassStr}.js`),
                import(`./strategies/audio/${audClassStr}.js`)
            ]);

            const ImageClass = ImageModule[imgClassStr];
            const ContextClass = ContextModule[ctxClassStr];
            const VisionClass = VisionModule[visClassStr];
            const AudioClass = AudioModule[audClassStr];

            if (!ImageClass || !ContextClass || !VisionClass || !AudioClass) {
                throw new Error("[AI ENGINGE] Failed to extract classes from imported modules. Ensure export names match file names.");
            }

            const providerOptions = { ...this.config, cacheManager: this.cacheManager };

            this.imageSource = new ImageClass(providerOptions, this.logger);
            this.context = new ContextClass(providerOptions, this.logger);
            this.vision = new VisionClass(this.config, this.logger);
            this.synthesis = new AudioClass(this.config, this.logger);

            const strategies = [this.imageSource, this.context, this.vision, this.synthesis];
            for (const strategy of strategies) {
                if (typeof strategy.init === 'function') await strategy.init();
            }

            this.logger.log(`[AIEngine] Auto-Discovery complete. Active stack: [${imgClassStr}, ${ctxClassStr}, ${visClassStr}, ${audClassStr}]`);

        } catch (e) {
            this.logger.error(`[AIEngine] Auto-Discovery Failed: ${e.message}`);
        }
    }

    /**
     * @async
     * @method getPublicConfig
     * @memberof AIEngine
     * @description Exposes public configuration parameters required by the frontend client strategies.
     * @returns {Object} Configuration bundle.
     */
    getPublicConfig() {
        const baseConfig = this.context ? this.context.getPublicConfig() : {};
        const semanticString = this.config.CLIENT_SEMANTIC_LAYERS;
        const semanticLayers = semanticString.split(',').map(s => s.trim());

        const strategyOptions = {};
        for (const [key, value] of Object.entries(this.config)) {
            if (key.startsWith('CLIENT_PARAM_')) {
                const cleanKey = key.replace('CLIENT_PARAM_', '');
                this.logger.log(`[AI Engine] CLENAN KEY: ${cleanKey}, ${value}`);
                strategyOptions[cleanKey] = value;
            }
        }

        return {
            ...baseConfig,
            clientStrategies: {
                viewerProvider: this.config.CLIENT_VIEWER_PROVIDER,
                topologyProvider: this.config.CLIENT_TOPOLOGY_PROVIDER,
                nodeSelectionStrategy: this.config.CLIENT_NODE_SELECTION_STRATEGY,
                semanticProvider: this.config.CLIENT_SEMANTIC_PROVIDER,
                vrLoaderProvider: this.config.CLIENT_VR_LOADER_PROVIDER,
                semanticLayers: semanticLayers,
            },
            options: strategyOptions,
            audioGains: {
                masterBackgroundGain: this.config.BACKGROUND_GAIN,
                masterForegroundGain: this.config.FOREGROUND_GAIN,
                masterSpatialGain: this.config.SPATIAL_GAIN
            }
        };
    }

    /**
     * @async
     * @method getTasksForMovement
     * @memberof AIEngine
     * @description Evaluates VLM data for a primary node to generate a queue of foreground Audio tasks.
     * @param {string} nodeId - Target panorama ID.
     * @param {number} lat - Latitude.
     * @param {number} lng - Longitude.
     * @param {boolean} isAnchor - Whether the node is a topological/acoustic anchor.
     * @param {string} locationContext - Geocoded contextual string.
     * @param {Array<string>} requestedLayers - Target semantic layers (e.g., 'ambient', 'spatial').
     * @returns {Promise<Array<Object>>} Array of configured synthesis tasks.
     */
    async getTasksForMovement(nodeId, lat, lng, isAnchor, locationContext, requestedLayers) {
        let sceneData = await this.cacheManager.getVLMData(nodeId) || {};

        if (!sceneData.intents || sceneData.intents.length === 0) {
            const res = await this.process(nodeId, lat, lng, { isAnchor, requestedLayers });
            sceneData = res.sceneData;
            this.logger.log(`[AI ENGINE VLM RESULT] TasksForMovement: ${JSON.stringify(sceneData, null, 2).toString().replace(/_/g, " ")}`);
            await this.cacheManager.saveVLMData(nodeId, sceneData);
        }

        const tasks = [];
        const cleanNodeId = nodeId.toString().replace(/[^a-zA-Z0-9]/g, '');
        const labelCounts = {};

        let locSlug = "global";
        if (locationContext && locationContext !== "Unknown Location") {
            const countryOnly = locationContext.split(',').pop().trim();
            locSlug = countryOnly.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
        }

        (sceneData.intents || []).forEach((intent, index) => {
            const isPersistent = !!intent.persistent;

            const label = intent.label || "sound";
            const labelSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            labelCounts[labelSlug] = (labelCounts[labelSlug] || 0) + 1;

            const audioKey = isPersistent ? nodeId : `${locSlug}_${labelSlug}_v${labelCounts[labelSlug]}`;
            const instanceId = isPersistent ? nodeId : `${audioKey}_${cleanNodeId}_${index}`;

            tasks.push({
                ...intent, // Implicitly passes through the intent.positional boolean from the VLM to the Audio Player
                id: instanceId,
                nodeId,
                eventName: isPersistent ? 'node_ready' : 'instance_ready',
                persistent: isPersistent,
                audioContentId: audioKey,
                locationContext,
                displayName: label,
                visualMetadata: { ...intent }
            });
        });

        return tasks;
    }


    /**
      * @async
      * @method getTasksForHorizon
      * @memberof AIEngine
      * @description Evaluates VLM data for background/neighboring nodes to support the acoustic treadmill.
      * @param {string} nodeId - Target panorama ID.
      * @param {number} lat - Latitude.
      * @param {number} lng - Longitude.
      * @param {string} locationContext - Geocoded contextual string.
      * @param {Array<string>} requestedLayers - Target semantic layers.
      * @returns {Promise<Array<Object>>} Array of configured background tasks.
      */
    async getTasksForHorizon(nodeId, lat, lng, locationContext, requestedLayers) {
        let sceneData = await this.cacheManager.getVLMData(nodeId) || {};

        if (!sceneData.intents || sceneData.intents.length === 0) {
            const res = await this.process(nodeId, lat, lng, { isAnchor: true, requestedLayers });
            sceneData = res.sceneData;
            this.logger.log(`[AI ENGINE VLM RESULT] TasksForHorizon: ${JSON.stringify(sceneData, null, 2).toString().replace("_", " ")}`);
            await this.cacheManager.saveVLMData(nodeId, sceneData);
        }

        return (sceneData.intents || [])
            .filter(intent => intent.persistent)
            .map(intent => ({
                ...intent,
                id: nodeId,
                nodeId,
                eventName: 'node_ready',
                persistent: true,
                audioContentId: nodeId,
                locationContext
            }));

    }

    /**
     * @async
     * @method createRegenTask
     * @memberof AIEngine
     * @description Reconfigures an existing task for forced generation based on user feedback.
     * @param {Object} taskData - Existing task state.
     * @param {Object} feedbackData - Explicit user modification requests.
     * @param {number} epoch - Current navigation epoch.
     * @returns {Promise<Object>} Regenerated task payload.
     */
    async createRegenTask(taskData, feedbackData, epoch) {
        const fromScratch = !!feedbackData.fromScratch;
        const audioKey = taskData.audioContentId || taskData.id;
        if (fromScratch) await this.cacheManager.deleteAudio(audioKey);

        return {
            ...taskData,
            navEpoch: epoch,
            forceBypassCache: true,
            regenOpts: {
                useInit: !fromScratch,
                path: (!fromScratch && taskData.audioContentId) ? await this.cacheManager.getAudioPath(taskData.audioContentId) : null,
                feedback: feedbackData.text,
                rating: feedbackData.rating,
                fromScratch: fromScratch
            }
        };
    }

    /**
     * @async
     * @method process
     * @memberof AIEngine
     * @description Wraps the image acquisition and Vision Language Model evaluation phases.
     * @param {string} nodeId - Target node identifier.
     * @param {number} lat - Latitude.
     * @param {number} lng - Longitude.
     * @param {Object} [options={}] - Extra contextual options.
     * @returns {Promise<Object>} Object containing generated { sceneData, locationString }.
     */
    async process(nodeId, lat, lng, options = {}) {
        try {
            let buffer;
            if (this.activeNodeId === nodeId && this.activeBase64) {
                buffer = Buffer.from(this.activeBase64, 'base64');
            } else {
                buffer = await this.imageSource.getImage(nodeId);
                this.activeNodeId = nodeId;
                this.activeBase64 = buffer.toString('base64');
            }

            const locationString = await this.context.resolve(lat, lng);

            const sceneData = await this.vision.analyse(buffer, locationString, options);
            return { sceneData, locationString };
        } catch (e) {
            this.logger.error(`[AI Engine] Vision failure for ${nodeId}: ${e.message}`);
            return { sceneData: {}, locationString: "Unknown Location" };
        }
    }

    /**
     * @async
     * @method generateAudio
     * @memberof AIEngine
     * @description Executes the audio diffusion strategy and performs post-processing transcodes.
     * @param {Object} task - The synthesis configuration payload.
     * @param {AbortSignal} signal - Cancellation controller.
     * @param {Socket} socket - Target client socket for localized progress events.
     * @param {Function} progressCallback - Hook to emit step-by-step progress.
     * @returns {Promise<Object>} Object containing the raw { buffer }.
     */
    async generateAudio(task, signal, socket, progressCallback) {
        if (!this.synthesis) return { buffer: null };
        const result = await this.synthesis.generate(task, { signal, socket, progressCallback });
        if (result?.buffer) {
            result.buffer = await Utils.transcode(result.buffer, this.targetFormat, task.type, this.logger);
        }

        return result;
    }
}