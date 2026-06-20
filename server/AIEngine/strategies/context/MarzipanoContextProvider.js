import { ContextProvider } from './ContextProvider.js'

/**
 * @class MarzipanoContextProvider
 * @description Serves locational and contextual metadata logic for local Marzipano environments.
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