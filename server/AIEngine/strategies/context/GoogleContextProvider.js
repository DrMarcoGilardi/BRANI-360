import { ContextProvider } from './ContextProvider.js'
import axios from 'axios';

export class GoogleContextProvider extends ContextProvider {
    constructor(key, logger) {
        super();
        this.key = key.GOOGLE_MAPS_API_KEY;
        this.logger = logger;
    }

    async resolve(lat, lng) {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${this.key}`;
        const res = await axios.get(url);
        if (res.data.status === "OK" && res.data.results.length > 0) {
            const comps = res.data.results[0].address_components;
            let city = "", country = "";
            for (const c of comps) {
                if (c.types.includes("locality")) city = c.long_name;
                if (c.types.includes("country")) country = c.long_name;
            }
            return [city, country].filter(Boolean).join(", ");
        }
        return "Unknown Location";
    }

    getPublicConfig() {
        return {
            key: this.key
        };
    }
}