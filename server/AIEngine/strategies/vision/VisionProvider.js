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
 * Base class interface.  
 * Interface for multimodal analysis providers.  
 * CONTRACT: Implementing classes must return an object containing an 'intents' array.
 *  
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class VisionProvider{
 * <<Abstract>>
 * +analyse(buffer, context, options) Promise~Object~
 * +validateResponse(data) Object
 * }
 * ```
 * 
 * @class
 */
export class VisionProvider {
    /**
     * @async
     * @method analyse
     * @memberof VisionProvider
     * @description Executes multimodal analysis to extract sonic layers from visuals.
     * @param {Buffer} buffer - Raw image data.
     * @param {string} context - Geocoded location string.
     * @param {Object} options - Strategy configuration parameters.
     * @returns {Promise<Object>} Must resolve with { intents: [...] }
     * @throws {Error} If not implemented by the specific provider.
     */
    async analyse(buffer, context, options) {
        throw new Error("[VISION PROVIDER CONTRACT VIOLATION]: Method 'analyse()' must be implemented.");
    }

    /**
     * @method validateResponse
     * @memberof VisionProvider
     * @description Validation guard ensuring the provider adheres to the system pipeline schema.
     * @param {Object} data - Data payload to validate.
     * @returns {Object} Validated payload.
     * @throws {Error} If fields are missing.
     */
    validateResponse(data) {
        if (!data || !Array.isArray(data.intents)) {
            throw new Error(`[VISION PROVIDER CONTRACT VIOLATION]: Response must contain an 'intents' array.`);
        }

        data.intents.forEach((intent, i) => {
            const missing = [];
            if (!intent.eventName) missing.push('eventName');
            if (!intent.identity) missing.push('identity');
            if (!intent.prompt) missing.push('prompt');
            if (!intent.type) missing.push('type');

            if (missing.length > 0) {
                throw new Error(`[VISION PROVIDER CONTRACT VIOLATION]: Intent at index ${i} is missing required fields: ${missing.join(', ')}`);
            }
        });

        return data;
    }
}