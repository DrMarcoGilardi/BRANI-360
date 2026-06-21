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

import { BaseContextProvider } from './BaseContextProvider.js'

/**
 * EXAMPLE STRATEGY IMPLEMENTATION  
 * Resolves geographical coordinates into location context strings using the Geoapify Reverse Geocoding API.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * BaseContextProvider <|-- GeoapifyContextProvider
 * class GeoapifyContextProvider{
 * +resolve(lat, lng) Promise~string~
 * +getPublicConfig() Object
 * }
 * ```
 * 
 * @class
 */
export class GeoapifyContextProvider extends BaseContextProvider {
    /**
     * @constructor
     * @param {Object} key - Server configuration object containing API tokens.
     * @param {Object} logger - System Logger instance.
     */
    constructor(key, logger) {
        super();
        this.geoapifykey = key.GEOAPIFY_TOKEN;
        this.mapillaryKey = key.MAPILLARY_TOKEN;
        this.logger = logger;
    }

    /**
     * @async
     * @method resolve
     * @memberof GeoapifyContextProvider
     * @description Resolves raw coordinates into contextual language data for prompts.
     * @param {number} lat - Latitude.
     * @param {number} lng - Longitude.
     * @returns {Promise<string>} Formatted location string (e.g., "City, State, Country").
     */
    async resolve(lat, lng) {
        try {
            var requestOptions = {
                method: 'GET',
            };

            const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${this.geoapifykey}`, requestOptions)
            const result = await response.json();
            if (result.features && result.features.length > 0) {
                const props = result.features[0].properties;
                return [props.city, props.state, props.country].filter(Boolean).join(", ");
            }
            return "Unknown Location";
        } catch (error) {
            console.error('Geoapify error:', error);
            return "Unknown Location";
        }
    }

    /**
     * @method getPublicConfig
     * @memberof GeoapifyContextProvider
     * @description Exposes required public keys to the frontend without leaking server secrets.
     * @returns {Object} Public configuration object.
     */
    getPublicConfig() {
        return {
            key: this.mapillaryKey
        };
    }
}