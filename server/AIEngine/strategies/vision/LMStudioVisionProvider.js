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

import { VisionProvider } from './VisionProvider.js';
import axios from 'axios';

/**
 * EXAMPLE STRATEGY IMPLEMENTATION  
 * Strategy authority for prompt engineering and intent mapping using a local LM Studio Vision-Language Model.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * VisionProvider <|-- LMStudioVisionProvider
 * class LMStudioVisionProvider{
 * +init() Promise~void~
 * +analyse(buffer, context, options) Promise~Object~
 * }
 * ```
 * 
 * @class
 */
export class LMStudioVisionProvider extends VisionProvider {
    /**
     * @constructor
     * @param {Object} config - Configuration object containing {LM_STUDIO_API, VLM_MODEL_ID, VLM_PROMPT_AMBIENT, VLM_PROMPT_SPATIAL}
     * @param {LogManager} logger - The system logger
     */
    constructor(config, logger) {
        super();
        this.logger = logger || console;

        // const parseBoolean = (val) => val === 'true';

        this.port = config.LM_STUDIO_PORT;
        this.model = config.VLM_MODEL_ID;

        // this.workers = parseInt(config.GPU_MAX_WORKERS, 10);
        // this.contextLength = parseInt(config.VLM_CONTEXT_LENGTH, 10);
        // this.cpuThreads = parseInt(config.VLM_CPU_THREADS, 10);
        // this.evalBatchSize = parseInt(config.VLM_EVAL_BATCH_SIZE, 10);
        // this.physicalBatchSize = parseInt(config.VLM_PHYSICAL_BATCH_SIZE, 10);
        // this.offloadKVCacheToGPU = parseBoolean(config.VLM_OFFLOAD_KV_CACHE_TO_GPU);
        // this.keepModelInMemory = parseBoolean(config.VLM_KEEP_MODEL_IN_MEMORY);
        // this.useMMap = parseBoolean(config.VLM_USE_MMAP);
        // this.flashAttention = parseBoolean(config.VLM_FLASH_ATTENTION);

        this.promptAmbient = config.VLM_PROMPT_AMBIENT;
        this.promptSpatial = config.VLM_PROMPT_SPATIAL;

        if (!this.port || !this.model) {
            this.logger.error('[VisionProvider] Missing LM Studio configuration.');
        }
    }

    // layerProcessors = {
    //     // 1. The Persistent Anchor Background
    //     'horizon': async (buffer, locationContext, layerName) => {
    //         const loadResult = await this._loadLMStudioModel();
    //         if (!loadResult.success) {
    //             console.error(`Generation aborted: ${loadResult.error}`);
    //             throw new Error("LLM_OFFLINE");
    //         }
    //         const dynamicPrompt = `Analyze acoustics at ${locationContext}. STRICTLY return JSON: {"reverb": "outside|inside|wet|dry", "description": "foley-grounded description", "type":"nature|city|suburban"}`;
    //         const vlmResponse = await this._callLMStudio(this.promptAmbient, dynamicPrompt, buffer, locationContext);

    //         if (!vlmResponse || !vlmResponse.reverb) return [];
    //         return [{
    //             layer: layerName,
    //             label: "Environment",
    //             prompt: this._buildAudioReadyAmbient(vlmResponse, locationContext),
    //             type: "ambient",
    //             eventName: "node_ready",
    //             identity: "node",
    //             persistent: true,     // Sent to Engine
    //             positional: false,    // Sent to Player
    //             envType: vlmResponse.type || "generic"
    //         }];
    //     },

    //     // Transient Semantic Wash (e.g., weather, mood)
    //     'ambient': async (buffer, locationContext, layerName) => {
    //         const loadResult = await this._loadLMStudioModel();
    //         if (!loadResult.success) {
    //             console.error(`Generation aborted: ${loadResult.error}`);
    //             throw new Error("LLM_OFFLINE");
    //         }
    //         const dynamicPrompt = `Analyze acoustics at ${locationContext}. STRICTLY return JSON: {"reverb": "outside|inside|wet|dry", "description": "foley-grounded description", "type":"nature|city|suburban"}`;
    //         const vlmResponse = await this._callLMStudio(this.promptAmbient, dynamicPrompt, buffer, locationContext);

    //         if (!vlmResponse || !vlmResponse.reverb) return [];
    //         return [{
    //             layer: layerName,
    //             label: "Ambient",
    //             prompt: this._buildAudioReadyAmbient(vlmResponse, locationContext),
    //             type: "ambient",
    //             eventName: "instance_ready",
    //             identity: "instance",
    //             persistent: false,    // Sent to Engine
    //             positional: false,    // Sent to Player
    //             envType: vlmResponse.type || "generic"
    //         }];
    //     },

    //     // 3D Spatial Objects
    //     'spatial': async (buffer, locationContext, layerName) => {
    //         const loadResult = await this._loadLMStudioModel();
    //         if (!loadResult.success) {
    //             console.error(`Generation aborted: ${loadResult.error}`);
    //             throw new Error("LLM_OFFLINE");
    //         }
    //         // Structured Foley Glossary
    //         const foleyGlossary = "{'Crowds': ['walla', 'babble', 'chatter', 'efforts'], 'Weather': ['gust', 'howl', 'leaf rustle', 'drizzle'], 'Environments': ['atmos', 'drone', 'wash'], 'Vehicular': ['pass-by', 'doppler', 'idle', 'rumble'], 'Texture': ['cloth rustle', 'scuff', 'crunch', 'clatter', 'thud'], 'Quality Modifier': ['dry', 'slapback', 'proximity', 'transient']";
    //         const dynamicPrompt = `Analyze visual sound sources at ${locationContext}. STRICTLY return JSON: {"spatial_objects": [{"label": "string", "category": "human|mechanical|organic", "h": 0, "p": 0, "dist": 0}]}, Format the "label" STRICTLY as '[Object], [Foley Term], [Quality Modifier]'.`;

    //         const vlmResponse = await this._callLMStudio(this.promptSpatial, dynamicPrompt, buffer, locationContext, foleyGlossary);

    //         if (!vlmResponse || !vlmResponse.spatial_objects) return [];

    //         return vlmResponse.spatial_objects.map(obj => ({
    //             ...obj,
    //             layer: layerName,
    //             prompt: this._buildAudioReadySpatial(obj, locationContext),
    //             type: this._mapCategoryToType(obj.category),
    //             identity: "instance",
    //             eventName: "instance_ready",
    //             persistent: false,    // Sent to Engine
    //             positional: true,     // Sent to Player
    //             envType: obj.category || "generic"
    //         }));
    //     }
    // };

    /**
     * @method layerProcessors
     * @memberof LMStudioVisionProvider
     * @description Maps requested layer names to their corresponding processing functions.
     * @type {Object}
     */
    layerProcessors = {
        'horizon': (buffer, loc, layer) => this._processAmbientLayer(buffer, loc, layer, {
            label: "Environment",
            eventName: "node_ready",
            identity: "node",
            persistent: true
        }),

        'ambient': (buffer, loc, layer) => this._processAmbientLayer(buffer, loc, layer, {
            label: "Ambient",
            eventName: "instance_ready",
            identity: "instance",
            persistent: false
        }),

        'spatial': async (buffer, locationContext, layerName) => {
            // await this._ensureLLMReady();

            const foleyGlossary = "{'Crowds': ['walla', 'babble', 'chatter', 'efforts'], 'Weather': ['gust', 'howl', 'leaf rustle', 'drizzle'], 'Environments': ['atmos', 'drone', 'wash'], 'Vehicular': ['pass-by', 'doppler', 'idle', 'rumble'], 'Texture': ['cloth rustle', 'scuff', 'crunch', 'clatter', 'thud'], 'Quality Modifier': ['dry', 'slapback', 'proximity', 'transient']}";
            const dynamicPrompt = `Analyze visual sound sources at ${locationContext}. STRICTLY return JSON: {"spatial_objects": [{"label": "string", "category": "human|mechanical|organic", "h": 0, "p": 0, "dist": 0}]}, Format the "label" STRICTLY as '[Object], [Foley Term], [Quality Modifier]'.`;

            const vlmResponse = await this._callLMStudio(this.promptSpatial, dynamicPrompt, buffer, locationContext, foleyGlossary);

            if (!vlmResponse || !vlmResponse.spatial_objects) return [];

            return vlmResponse.spatial_objects.map(obj => ({
                ...obj,
                layer: layerName,
                prompt: this._buildAudioReadySpatial(obj, locationContext),
                type: this._mapCategoryToType(obj.category),
                identity: "instance",
                eventName: "instance_ready",
                persistent: false,
                positional: true,
                envType: obj.category || "generic"
            }));
        }
    };

    /**
     * @async
     * @method init
     * @memberof LMStudioVisionProvider
     * @description Initializes the Vision Provider and logs connection details.
     * @returns {Promise<void>}
     */
    async init() {
        if (this.port && this.model) {
            this.logger.log(`[VisionProvider] LM Studio Strategy active.`);
            this.logger.log(`[VisionProvider] Model: ${this.model} at http://localhost:${this.port}`);
        }
    }

    /**
     * @async
     * @method analyse
     * @memberof LMStudioVisionProvider
     * @description Executes multimodal analysis to extract sonic layers from an image buffer.
     * @param {Buffer} buffer - Raw equirectangular image data.
     * @param {string} context - Geocoded location string.
     * @param {Object} options - Strategy configuration parameters containing requested layers and topology info.
     * @returns {Promise<Object>} An object containing an array of audio generation 'intents'.
     */
    async analyse(buffer, context, options) {
        const requestedLayers = options.requestedLayers || ['spatial'];
        const { isAnchor } = options;
        const locationContext = context || "Unknown Location";

        try {
            const layersToProcess = requestedLayers.filter(layer => {
                // Domain Logic: Horizon only processes on anchor nodes
                if (layer === 'horizon' && !isAnchor) return false;
                return true;
            });

            const activeProcessors = layersToProcess
                .filter(layer => {
                    if (!this.layerProcessors[layer]) {
                        this.logger.warn(`[VisionProvider] Unrecognized layer requested: '${layer}'. Skipping.`);
                        return false;
                    }
                    return true;
                })
                // THE FIX: Explicitly pass 'layer' as the 3rd argument 'layerName'
                .map(layer => this.layerProcessors[layer](buffer, locationContext, layer));

            // 3. Execute concurrently and flatten
            const results = await Promise.all(activeProcessors);
            const intents = results.flat();

            return this.validateResponse({ intents });

        } catch (e) {
            this.logger.error(`[Vision Strategy Error]: ${e.message}`);
            return this.validateResponse({ intents: [] });
        }
    }

    // --- Helper Methods ---

    // /**
    //  * @async
    //  * @method _ensureLLMReady
    //  * @memberof LMStudioVisionProvider
    //  * @description Ensures the LLM is ready for processing.
    //  * @returns {Promise<void>}
    //  */
    // async _ensureLLMReady() {
    //     const loadResult = await this._loadLMStudioModel();
    //     if (!loadResult.success) {
    //         this.logger.error(`Generation aborted: ${loadResult.error}`);
    //         throw new Error("LLM_OFFLINE");
    //     }
    // }

    /**
     * @async
     * @method _processAmbientLayer
     * @memberof LMStudioVisionProvider
     * @description Processes the ambient layer for audio generation.
     * @param {Buffer} buffer - Raw equirectangular image data.
     * @param {string} locationContext - Geocoded location string.
     * @param {string} layerName - Name of the layer being processed.
     * @param {Object} config - Configuration options for the processing function.
     * @returns {Promise<Array>} An array of processed ambient audio intents.
     */
    async _processAmbientLayer(buffer, locationContext, layerName, config) {
        // await this._ensureLLMReady();

        const dynamicPrompt = `Analyze acoustics at ${locationContext}. STRICTLY return JSON: {"reverb": "outside|inside|wet|dry", "description": "foley-grounded description", "type":"nature|city|suburban"}`;
        const vlmResponse = await this._callLMStudio(this.promptAmbient, dynamicPrompt, buffer, locationContext);

        if (!vlmResponse || !vlmResponse.reverb) return [];

        return [{
            layer: layerName,
            prompt: this._buildAudioReadyAmbient(vlmResponse, locationContext),
            type: "ambient",
            positional: false,
            envType: vlmResponse.type || "generic",
            ...config
        }];
    }

    // /**
    //  * @method _loadLMStudioModel
    //  * @memberof LMStudioVisionProvider
    //  * @description Loads the specified model into LM Studio if not already loaded.
    //  * @returns {Promise<Object>} An object indicating success or failure of the load operation.
    //  * @private 
    // */
    // async _loadLMStudioModel() {
    //     const baseUrl = `http://localhost:${this.port}`;

    //     try {
    //         const modelsResponse = await axios.get(`${baseUrl}/v1/models`);
    //         const loadedModels = modelsResponse.data.data.map(model => model.id);

    //         if (!loadedModels.includes(this.model)) {
    //             console.log(`Model ${this.model} not loaded. Loading now...`);

    //             await axios.post(`${baseUrl}/api/v1/models/load`, {
    //                 model: this.model,
    //                 max_concurrent_predictions: this.workers, // Maps to Max Concurrent Predictions
    //                 context_length: this.contextLength, // Maps to Context Length
    //                 cpu_threads: this.cpuThreads,                 // Maps to CPU Thread Pool Size
    //                 eval_batch_size: this.evalBatchSize,           // Maps to Evaluation Batch Size
    //                 physical_batch_size: this.physicalBatchSize,        // Maps to Physical Batch Size
    //                 max_concurrent_predictions: this.workers,   // Maps to Max Concurrent Predictions
    //                 offload_kv_cache_to_gpu: this.offloadKVCacheToGPU,   // Maps to Offload KV Cache to GPU Memory
    //                 keep_model_in_memory: this.keepModelInMemory,      // Maps to Keep Model in Memory
    //                 use_mmap: this.useMmap,                  // Maps to Try mmap()
    //                 flash_attention: this.flashAttention
    //             });
    //             console.log('Model loaded successfully.');
    //             return { success: true, model: this.model };
    //         } else {
    //             console.log(`Model ${this.model} is already loaded. Skipping load phase.`);
    //             // Expected success state
    //             return { success: true, model: this.model };
    //         }

    //     } catch (error) {
    //         // NOW we have a real error object to report!
    //         console.error(`[LM Studio API Error] Failed to communicate with host: ${error.message}`);
    //         return {
    //             success: false,
    //             error: error.message,
    //             code: error.code
    //         };
    //     }
    // }

    /**
     * @method _bufferToBase64
     * @memberof LMStudioVisionProvider
     * @description Prevents binary corruption by formatting a buffer into base64.
     * @param {Buffer} buffer - Raw equirectangular image data.
     * @returns {string} Base64 encoded image string.
     * @private
     */
    _bufferToBase64(buffer) {
        if (Buffer.isBuffer(buffer)) {
            return buffer.toString('base64');
        } else if (buffer instanceof ArrayBuffer || buffer instanceof Uint8Array) {
            return Buffer.from(buffer).toString('base64');
        } else if (typeof buffer === 'string') {
            const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(buffer.substring(0, 50));
            return isBase64 ? buffer : Buffer.from(buffer, 'binary').toString('base64');
        } else {
            throw new Error("Invalid image buffer type.");
        }
    }

    /**
     * @async
     * @method _callLMStudio
     * @memberof LMStudioVisionProvider
     * @description Prevents binary corruption by formatting a buffer into base64.
     * @param {Buffer|ArrayBuffer|string} buffer - The source image data.
     * @returns {string} Base64 encoded image string.
     * @private
     */
    // async _callLMStudio(promptTemplate, dynamicPrompt, buffer, locationContext, foleyGlossary = '') {
    //     try {
    //         const baseUrl = `http://localhost:${this.port}`;
    //         const base64Image = this._bufferToBase64(buffer);

    //         const groundedSystemPrompt = promptTemplate
    //             .replace("{location_context}", locationContext)
    //             .replace("{foley_terms}", foleyGlossary);

    //         const response = await axios.post(`${baseUrl}/v1/chat/completions`, {
    //             model: this.model,
    //             messages: [
    //                 { role: "system", content: groundedSystemPrompt },
    //                 {
    //                     role: "user",
    //                     content: [
    //                         { type: "text", text: dynamicPrompt },
    //                         { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
    //                     ]
    //                 }
    //             ],
    //             temperature: 0.1,
    //             max_tokens: 1024,
    //             stream: false
    //         }, {
    //             // headers: { 'Connection': 'close' }, // Force socket release for LM Studio stability
    //             timeout: 120000
    //         });

    //         let rawContent = response.data.choices[0].message.content.trim();
    //         const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    //         return JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);

    //     } catch (e) {
    //         this.logger.error(`[LM Studio Request Failed] ${e.message}`);
    //         return {};
    //     }
    // }

    async _callLMStudio(promptTemplate, dynamicPrompt, buffer, locationContext, foleyGlossary = '', maxRetries = 3) {
        const baseUrl = `http://localhost:${this.port}`;
        const base64Image = this._bufferToBase64(buffer);

        const groundedSystemPrompt = promptTemplate
            .replace("{location_context}", locationContext)
            .replace("{foley_terms}", foleyGlossary);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios.post(`${baseUrl}/v1/chat/completions`, {
                    model: this.model,
                    messages: [
                        { role: "system", content: groundedSystemPrompt },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: dynamicPrompt },
                                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                            ]
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 1024,
                    stream: false
                }, {
                    timeout: 120000
                });

                let rawContent = response.data.choices[0].message.content.trim();
                const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                return JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);

            } catch (e) {
                // Check if the error is a 500 Server Error or a dropped network connection
                const isRetryable = (e.response && e.response.status >= 500) || ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(e.code);

                if (isRetryable && attempt < maxRetries) {
                    // Calculate wait time: 5s, then 10s, etc.
                    const waitTime = attempt * 5000;
                    this.logger.warn(`[LM Studio Error] 500 Server Busy. Retrying attempt ${attempt + 1}/${maxRetries} in ${waitTime / 1000}s...`);

                    // Pause execution before looping again
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                // If we run out of retries, log the final failure and return empty
                this.logger.error(`[LM Studio Request Failed] Final failure after ${attempt} attempts: ${e.message}`);
                return {};
            }
        }
    }

    /**
     * @method _buildAudioReadyAmbient
     * @memberof LMStudioVisionProvider
     * @description Combines raw VLM tags into Stable Audio ready prompts for ambient washes.
     * @param {Object} data - The raw VLM intent output.
     * @param {string} context - The physical location string.
     * @returns {string} A unified audio generation prompt.
     * @private
     */
    _buildAudioReadyAmbient(data, context) {
        const desc = (data.description || "ambient soundscape").trim();
        const reverb = (data.reverb || "natural").trim();
        return `${desc}, ${reverb} acoustics, recorded at ${context}, realistic clean field recording, high quality`;
    }

    /**
     * @method _buildAudioReadySpatial
     * @memberof LMStudioVisionProvider
     * @description Formats spatial objects into high-fidelity point-source generation prompts.
     * @param {Object} obj - The raw VLM object output.
     * @param {string} context - The physical location string.
     * @returns {string} A unified spatial audio generation prompt.
     * @private
     */
    _buildAudioReadySpatial(obj, context) {
        const label = (obj.label || "sound source").trim();
        return `${label}, recorded at ${context}, clear distinct point-source clean sound, professional foley`;
    }

    /**
     * @method _buildAudioReadySpatial
     * @memberof LMStudioVisionProvider
     * @description Maps generic VLM categories to core engine architectural types.
     * @param {string} category - The raw category string.
     * @returns {string} The mapped engine type.
     * @private
     */
    _mapCategoryToType(category) {
        const cat = String(category).toLowerCase();
        if (cat.includes('mechanical')) return 'object_mechanical';
        if (cat.includes('human')) return 'object_human';
        return 'object_organic';
    }
}