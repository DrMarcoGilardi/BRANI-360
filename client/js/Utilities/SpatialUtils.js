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
 * Agnostic mathematical utilities for geographic and topological operations.  
 * Explicitly decoupled from proprietary libraries.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class SpatialUtils{
 * +getDistance(lat1, lon1, lat2, lon2) number
 * +getBearing(lat1, lon1, lat2, lon2) number
 * +getRelativePosition(originLat, originLng, targetLat, targetLng) Object
 * +normalizeHeading(heading) number
 * +sphericalToCartesian(h, p, dist) Object
 * }
 * ```
 * 
 * @class
 */
export const SpatialUtils = {
    /**
     * @method getDistance
     * @memberof SpatialUtils
     * @description Calculates the Haversine distance between two points in meters.
     * @param {number} lat1 
     * @param {number} lon1 
     * @param {number} lat2 
     * @param {number} lon2 
     * @returns {number} Distance in meters.
     */
    getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth radius in meters
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const dphi = (lat2 - lat1) * Math.PI / 180;
        const dlambda = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(dphi / 2) * Math.sin(dphi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dlambda / 2) * Math.sin(dlambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    },

    /**
     * @method getBearing
     * @memberof SpatialUtils
     * @description Calculates the initial bearing (heading) between two points.
     * @param {number} lat1 
     * @param {number} lon1 
     * @param {number} lat2 
     * @param {number} lon2 
     * @returns {number} Bearing in degrees (0-360).
     */
    getBearing(lat1, lon1, lat2, lon2) {
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const dlambda = (lon2 - lon1) * Math.PI / 180;

        const y = Math.sin(dlambda) * Math.cos(phi2);
        const x = Math.cos(phi1) * Math.sin(phi2) -
            Math.sin(phi1) * Math.cos(phi2) * Math.cos(dlambda);

        let brng = Math.atan2(y, x);
        brng = brng * 180 / Math.PI;
        return (brng + 360) % 360;
    },

    /**
     * Converts a lat/lng pair into relative Cartesian X/Z coordinates.
     * @param {number} originLat 
     * @param {number} originLng 
     * @param {number} targetLat 
     * @param {number} targetLng 
     * @returns {{x: number, z: number}}
     */
    getRelativePosition(originLat, originLng, targetLat, targetLng) {
        const distance = this.getDistance(originLat, originLng, targetLat, targetLng);
        const bearing = this.getBearing(originLat, originLng, targetLat, targetLng);
        const rad = (bearing - 90) * (Math.PI / 180);

        return {
            x: Math.cos(rad) * distance,
            z: Math.sin(rad) * distance
        };
    },

    /**
     * @method normalizeHeading
     * @memberof SpatialUtils
     * @description Normalizes a heading into the standard 0-360 degree range.
     * @param {number} heading - Raw heading.
     * @returns {number} Normalized heading.
     */
    normalizeHeading(heading) {
        return (heading % 360 + 360) % 360;
    },

    /**
     * @method sphericalToCartesian
     * @memberof SpatialUtils
     * @description Converts Spherical coordinates to Cartesian coordinates. Crucial bridge between VLM spatial analysis and WebGL/Three.js environments.
     * @param {number} h - Horizontal heading (degrees).
     * @param {number} p - Pitch/Vertical elevation (degrees).
     * @param {number} dist - Distance from origin (meters).
     * @returns {{x: number, y: number, z: number}}
     */
    sphericalToCartesian(h, p, dist) {
        const hRad = h * (Math.PI / 180);
        const pRad = p * (Math.PI / 180);
        const x = dist * Math.cos(pRad) * Math.sin(hRad);
        const y = dist * Math.sin(pRad);
        const z = -dist * Math.cos(pRad) * Math.cos(hRad);

        return { x, y, z };
    }
};