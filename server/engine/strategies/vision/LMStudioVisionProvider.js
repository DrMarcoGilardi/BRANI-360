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

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url'
import { exec } from 'child_process';
import { promisify } from 'util';

import { BaseVisionProvider } from './BaseVisionProvider.js';
import { Utils } from '../../../utilities/Utils.js';
import { log } from 'console';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * EXAMPLE STRATEGY IMPLEMENTATION  
 * Strategy authority for prompt engineering and intent mapping using a local LM Studio Vision-Language Model.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * BaseVisionProvider <|-- LMStudioVisionProvider
 * class LMStudioVisionProvider{
 * +init() Promise~void~
 * +analyse(buffer, context, options) Promise~Object~
 * }
 * ```
 * 
 * @class
 */
export class LMStudioVisionProvider extends BaseVisionProvider {
    /**
     * @constructor
     * @param {Object} config - Configuration object containing {LM_STUDIO_API, VLM_MODEL_ID, VLM_PROMPT_AMBIENT, VLM_PROMPT_SPATIAL}
     * @param {LogManager} logger - The system logger
     */
    constructor(config, logger) {
        super();
        this.logger = logger || console;

        this.port = config.LM_STUDIO_PORT;
        this.model = config.VLM_MODEL_ID;
        this.targetDevice = config.LM_LINK_TARGET_DEVICE;

        this.promptAmbient = ''; //config.VLM_PROMPT_AMBIENT;
        this.promptSpatial = ''; //config.VLM_PROMPT_SPATIAL;

        if (!this.port || !this.model) {
            this.logger.error('[VisionProvider] Missing LM Studio configuration.');
        }

        this.biomeIds = '';
        this.objectsIds = '';
    }

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

            const foleyGlossary = "{'Crowds': ['walla', 'babble', 'chatter', 'efforts'], 'Weather': ['gust', 'howl', 'leaf rustle', 'drizzle'], 'Environments': ['atmos', 'drone', 'wash'], 'Vehicular': ['pass-by', 'doppler', 'idle', 'rumble'], 'Texture': ['cloth rustle', 'scuff', 'crunch', 'clatter', 'thud'], 'Quality Modifier': ['dry', 'slapback', 'proximity', 'transient']}";
            const dynamicPrompt = `Analyze visual sound sources at ${locationContext}. STRICTLY return JSON: {"spatial_objects": [{"label": "string", "category": "${this.objectsIds}", "h": 0, "p": 0, "dist": 0}]}, Format the "label" STRICTLY as '[Object], [Foley Term], [Quality Modifier]'.`;

            const vlmResponse = await this._callLMStudio(
                this.promptSpatial,
                dynamicPrompt,
                buffer,
                locationContext,
                {
                    foleyGlossary: foleyGlossary,
                    soundCategory: this.objectsIds //'human | voice | organic | mechanical'
                });

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
        this.logger.log("[LM STUDIO VP INITIALISATION]");
        this._internalObjectsDictPath = path.join(__dirname, '../../prompts', 'ObjectSettings.json');
        this.objectsSettings = await Utils.loadObjectsDictionary(this._internalObjectsDictPath, this.logger);
        this.promptSpatial = this.objectsSettings?.vlm_system_prompt_template;
        this.objectsIds = Object.keys(this.objectsSettings?.objects).map(key => key.replace('object_', '')).join('|');

        this._internalAmbientsDictPath = path.join(__dirname, '../../prompts', 'AmbientSettings.json');
        this.ambientsSettings = await Utils.loadAmbientsDictionary(this._internalAmbientsDictPath, this.logger);
        this.promptAmbient = this.ambientsSettings?.vlm_system_prompt_template;
        this.biomeIds = Object.keys(this.ambientsSettings?.ambients).join('|');

        if (this.port && this.model) {
            if (this.targetDevice) {
                this.logger.log(`[VisionProvider] Routing LM Link traffic to remote machine: ${this.targetDevice}...`);
                try {
                    let deviceListOutput = "";
                    try {
                        const { stdout } = await execAsync('lms link list');
                        deviceListOutput = stdout;
                    } catch (listError) {
                        const { stderr } = await execAsync('lms link set-preferred-device DUMMY_DEVICE').catch(e => e);
                        deviceListOutput = stderr;
                    }

                    const safeTargetName = this.targetDevice.replace(/^["']+|["']+$/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`- ([a-f0-9]+) \\(${safeTargetName}\\)`, 'i');
                    const match = deviceListOutput.match(regex);

                    if (match && match[1]) {
                        const deviceId = match[1];
                        this.logger.log(`[VisionProvider] Found matching ID: ${deviceId}`);

                        const { stdout: setOut, stderr: setErr } = await execAsync(`lms link set-preferred-device ${deviceId}`);

                        if (setErr) {
                            this.logger.warn(`[VisionProvider] LM Link CLI Warning: ${setErr.trim()}`);
                        } else {
                            this.logger.log(`[VisionProvider] LM Link successfully routed. Traffic will go to ${this.targetDevice}.`);
                        }
                    } else {
                        this.logger.warn(`[VisionProvider] Could not find device "${this.targetDevice}" in the LM Link network. Falling back to local execution.`);
                    }

                } catch (error) {
                    this.logger.error(`[VisionProvider] Failed to route LM Link traffic. Error: ${error.message}`);
                }
            }
            this.logger.log(`[VisionProvider] LM Studio Strategy active.`);
            this.logger.log(`[VisionProvider] Model: ${this.model} at http://localhost:${this.port}`);
        }
    }

    /**
     * @async
     * @method analyse
     * @memberof LMStudioVisionProvider
     * @description Executes multimodal analysis to extract sound layers from an image buffer.
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
                .map(layer => this.layerProcessors[layer](buffer, locationContext, layer));

            const results = await Promise.all(activeProcessors);
            const intents = results.flat();

            return this.validateResponse({ intents });

        } catch (e) {
            this.logger.error(`[Vision Strategy Error]: ${e.message}`);
            return this.validateResponse({ intents: [] });
        }
    }

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
        const dynamicPrompt = `Analyze acoustics at ${locationContext}. STRICTLY return JSON: {"reverb": "outside|inside", "description": "foley-grounded description", "type":"${this.biomeIds}"}`;
        const vlmResponse = await this._callLMStudio(
            this.promptAmbient,
            dynamicPrompt,
            buffer,
            locationContext,
            { ambientBiomes: this.biomeIds } // 'nature|beach_sea|desert|city|suburban|generic'
        );
        this.logger.log(JSON.stringify(vlmResponse));
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
     * @description Formats the system prompt, converts the image buffer to base64, and sends a chat completion request to a local LM Studio Vision-Language Model (VLM). Includes automatic JSON extraction and exponential backoff retry logic for server/network errors.
     * @param {string} promptTemplate - The base system prompt containing placeholders for context variables.
     * @param {string} dynamicPrompt - The dynamic user-provided prompt to instruct the VLM.
     * @param {Buffer} buffer - The raw image buffer to be analyzed by the vision model.
     * @param {string} locationContext - Contextual information about the location to inject into the template.
     * @param {Object} [contextOptions={}] - Optional context parameters for prompt injection.
     * @param {string} [contextOptions.foleyGlossary=''] - Specific foley terms to replace `{foley_terms}` in the template. Spatial sounds only.
     * @param {string} [contextOptions.soundCategory=''] - Sound classification category to replace `{sound_category}`. Spatial sounds only.
     * @param {string} [contextOptions.ambientBiomes=''] - Biome information to replace `{ambient_biomes}`. Abmient sound only.
     * @param {number} [maxRetries=3] - Maximum number of retry attempts for 500-level or network connection errors.
     * @returns {Promise<Object>} A promise that resolves to the parsed JSON object from the VLM's response, or an empty object `{}` if the request ultimately fails.
     * @private
     */
    async _callLMStudio(promptTemplate, dynamicPrompt, buffer, locationContext, { foleyGlossary = '', soundCategory = '', ambientBiomes = '' }, maxRetries = 3) {
        const baseUrl = `http://localhost:${this.port}`;
        const base64Image = this._bufferToBase64(buffer);

        const groundedSystemPrompt = promptTemplate
            .replace("{location_context}", locationContext)
            .replace("{foley_terms}", foleyGlossary)
            .replace("{sound_category}", soundCategory)
            .replace("{ambient_biomes}", ambientBiomes);

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
                const isRetryable = (e.response && e.response.status >= 500) || ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(e.code);

                if (isRetryable && attempt < maxRetries) {
                    const waitTime = attempt * 5000;
                    this.logger.warn(`[LM Studio Error] 500 Server Busy. Retrying attempt ${attempt + 1}/${maxRetries} in ${waitTime / 1000}s...`);

                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

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
        const desc = data.description.trim();
        const reverb = data.reverb.trim();
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
        const label = obj.label.trim();
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