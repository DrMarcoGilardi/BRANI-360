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
 * Base Class Interface. Interface for audio synthesis providers.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class AudioProvider{
 * <<Abstract>>
 * +generate(task, context) Promise~Object~
 * }
 * ```
 * 
 * @class
 */
export class AudioProvider {
    /**
     * @async
     * @method generate
     * @memberof AudioProvider
     * @description Executes the audio generation pipeline for a given semantic task.
     * @param {Object} task - The complete task metadata (prompt, type, steps).
     * @param {Object} context - Execution hooks including { signal, socket, progressCallback }.
     * @returns {Promise<{buffer: Buffer, duration: string}>} The generated audio data.
     * @throws {Error} If not implemented by the specific provider.
     */
    async generate(task, context) {
        throw new Error("[AUDIO PROVIDER CONTRACT VIOLATION]: Method 'generate(task, context)' must be implemented.");
    }
}

