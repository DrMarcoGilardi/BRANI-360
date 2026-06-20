import { ContextProvider } from './ContextProvider.js'

export class MarzipanoContextProvider extends ContextProvider {
    constructor(path, logger) {
        super();
        this.path = path.TOUR_PATH;
        this.logger = logger;
    }
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
        return "Unknown Location";
    }

    /**
     * @method getPublicConfig
     * @memberof ContextProvider
     * @description Exposes public configuration/credentials safely to the frontend client.
     * @returns {Object} Public config dictionary (e.g., { apiKey: "..." }).
     * @throws {Error} If not implemented by the specific provider.
     */
    getPublicConfig() {
        return {
            key: this.path
        }
    }
}