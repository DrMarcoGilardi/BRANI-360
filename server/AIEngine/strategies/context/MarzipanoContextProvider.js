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

import { ContextProvider } from './ContextProvider.js'

/**
 * EXAMPLE STRATEGY IMPLEMENTATION
 * Serves locational and contextual metadata logic for local Marzipano environments.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * ContextProvider <|-- MarzipanoContextProvider
 * class MarzipanoContextProvider{
 * +path string
 * +logger Object
 * +resolve(lat, lng) Promise~string~
 * +getPublicConfig() Object
 * }
 * ```
 * 
 * @class
 */
export class MarzipanoContextProvider extends ContextProvider {
    /**
     * @constructor
     * @memberof MarzipanoContextProvider
     * @description Sets up the context provider with the server-side tour path and logger.
     * @param {Object} path - Provider options including TOUR_PATH.
     * @param {Object} logger - Logging instance.
     */
    constructor(path, logger) {
        super();
        this.path = path.TOUR_PATH;
        this.logger = logger;
    }

    /**
     * @async
     * @method resolve
     * @memberof MarzipanoContextProvider
     * @description Resolves raw latitude and longitude into a human-readable location context.
     * @param {number} lat - Latitude.
     * @param {number} lng - Longitude.
     * @returns {Promise<string>} Contextual string. For Marzipano this defaults to "Unknown Location".
     * @throws {Error} If internal provider routing fails.
     */
    async resolve(lat, lng) {
        return "Unknown Location";
    }

    /**
     * @method getPublicConfig
     * @memberof MarzipanoContextProvider
     * @description Exposes public configuration/credentials safely to the frontend client.
     * @returns {Object} Public config dictionary (e.g., { key: "..." }).
     * @throws {Error} If config generation fails.
     */
    getPublicConfig() {
        return {
            key: this.path
        }
    }
}