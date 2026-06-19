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
 * LMStudioVisionProvider
 * Strategy authority for prompt engineering and intent mapping using a local LM Studio Vision-Language Model.
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * VisionProvider <|-- LMStudioVisionProvider
 * class LMStudioVisionProvider{
 * +init() Promise~void~
 * +analyse(buffer, context, options) Promise~Object~
 * }
 * ```
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

        this.api = config.LM_STUDIO_API;
        this.model = config.VLM_MODEL_ID;
        this.promptAmbient = config.VLM_PROMPT_AMBIENT;
        this.promptSpatial = config.VLM_PROMPT_SPATIAL;

        if (!this.api || !this.model) {
            this.logger.error('[VisionProvider] Missing LM Studio configuration.');
        }

        this.layerProcessors = {
            // 1. The Persistent Anchor Background
            'horizon': async (buffer, locationContext, layerName) => {
                const dynamicPrompt = `Analyze acoustics at ${locationContext}. STRICTLY return JSON: {"reverb": "outside|inside|wet|dry", "description": "foley-grounded description", "type":"nature|city|suburban"}`;
                const res = await this._callLMStudio(this.promptAmbient, dynamicPrompt, buffer, locationContext);
                
                if (!res || !res.reverb) return [];
                return [{
                    layer: layerName, 
                    label: "Environment", 
                    prompt: this._buildAudioReadyAmbient(res, locationContext),
                    type: "ambient", 
                    eventName: "node_ready",
                    identity: "node",
                    persistent: true,     // Sent to Engine
                    positional: false,    // Sent to Player
                    envType: res.type || "generic"
                }];
            },

            // 2. The Transient Semantic Wash (e.g., weather, mood)
            'ambient': async (buffer, locationContext, layerName) => {
                const dynamicPrompt = `Analyze acoustics at ${locationContext}. STRICTLY return JSON: {"reverb": "outside|inside|wet|dry", "description": "foley-grounded description", "type":"nature|city|suburban"}`;
                const res = await this._callLMStudio(this.promptAmbient, dynamicPrompt, buffer, locationContext);
                
                if (!res || !res.reverb) return [];
                return [{
                    layer: layerName, 
                    label: "Ambient", 
                    prompt: this._buildAudioReadyAmbient(res, locationContext),
                    type: "ambient", 
                    eventName: "instance_ready",
                    identity: "instance",
                    persistent: false,    // Sent to Engine
                    positional: false,    // Sent to Player
                    envType: res.type || "generic"
                }];
            },

            // 3. The 3D Spatial Objects
                'spatial': async (buffer, locationContext, layerName) => {
                // Structured Foley Glossary
                const foleyGlossary = "{'Crowds': ['walla', 'babble', 'chatter', 'efforts'], 'Weather': ['gust', 'howl', 'leaf rustle', 'drizzle'], 'Environments': ['atmos', 'drone', 'wash'], 'Vehicular': ['pass-by', 'doppler', 'idle', 'rumble'], 'Texture': ['cloth rustle', 'scuff', 'crunch', 'clatter', 'thud'], 'Quality Modifier': ['dry', 'slapback', 'proximity', 'transient']";
                const dynamicPrompt = `Analyze visual sound sources at ${locationContext}. STRICTLY return JSON: {"spatial_objects": [{"label": "string", "category": "human|mechanical|organic", "h": 0, "p": 0, "dist": 0}]}, Format the "label" STRICTLY as '[Object], [Foley Term], [Quality Modifier]'.`;
                
                const res = await this._callLMStudio(this.promptSpatial, dynamicPrompt, buffer, locationContext, foleyGlossary);
                
                if (!res || !res.spatial_objects) return [];

                return res.spatial_objects.map(obj => ({
                    ...obj,
                    layer: layerName,
                    prompt: this._buildAudioReadySpatial(obj, locationContext),
                    type: this._mapCategoryToType(obj.category),
                    identity: "instance", 
                    eventName: "instance_ready",
                    persistent: false,    // Sent to Engine
                    positional: true,     // Sent to Player
                    envType: obj.category || "generic" 
                }));
            }
        };
    }

    /**
     * @async
     * @method init
     * @memberof LMStudioVisionProvider
     * @description Initializes the Vision Provider and logs connection details.
     * @returns {Promise<void>}
     */
    async init() {
        if (this.api && this.model) {
            this.logger.log(`[VisionProvider] LM Studio Strategy active.`);
            this.logger.log(`[VisionProvider] Model: ${this.model} at ${this.api}`);
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
    async _callLMStudio(promptTemplate, dynamicPrompt, buffer, locationContext, foleyGlossary='') {
        try {
            const base64Image = this._bufferToBase64(buffer);
            
            
            const groundedSystemPrompt = promptTemplate
                .replace("{location_context}", locationContext)
                .replace("{foley_terms}", foleyGlossary);

            const response = await axios.post(this.api, {
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
                max_tokens: 1000,
                stream: false
            }, {
                headers: { 'Connection': 'close' }, // Force socket release for LM Studio stability
                timeout: 120000
            });

            let rawContent = response.data.choices[0].message.content.trim();
            const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
            return JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);

        } catch (e) {
            this.logger.error(`[LM Studio Request Failed] ${e.message}`);
            return {};
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