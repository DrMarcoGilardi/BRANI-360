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
 * @calss ContextProvider
 * @description Interface for location resolution and client-side configuration delivery. Enforces provider-agnosticism on the backend.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class ContextProvider{
 * <<Abstract>>
 * +resolve(lat, lng) Promise~string~
 * +getPublicConfig() Object
 * }
 * ```
 */
export class ContextProvider {
    /**
     * @async
     * @method resolve
     * @memberof ContextProvider
     * @description Resolves raw latitude and longitude into a human-readable location context.
     * @param {number} lat - Latitude.
     * @param {number} lng - Longitude.
     * @returns {Promise<string>} Contextual string (e.g., "Urban City Center, London").
     * @throws {Error} If not implemented by the specific provider.
     */
    async resolve(lat, lng) {
        throw new Error("[CONTEXT PROVIDER CONTRACT VIOLATION]: Method 'resolve(lat, lng)' must be implemented.");
    }

    /**
     * @method getPublicConfig
     * @memberof ContextProvider
     * @description Exposes public configuration/credentials safely to the frontend client.
     * @returns {Object} Public config dictionary (e.g., { apiKey: "..." }).
     * @throws {Error} If not implemented by the specific provider.
     */
    getPublicConfig() {
        throw new Error("[CONTEXT PROVIDER CONTRACT VIOLATION]: Method 'getPublicConfig()' must be implemented.");
    }
}