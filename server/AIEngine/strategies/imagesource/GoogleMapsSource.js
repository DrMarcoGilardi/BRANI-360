import {ImageSourceProvider} from './ImageSourceProvider.js'
import axios from 'axios';

/**
 * GoogleMapsSource
 * Handles acquisition of Street View imagery.
 * Extends ImageSourceProvider to satisfy the agnostic framework contract.
 */
export class GoogleMapsSource extends ImageSourceProvider {
    constructor(config, logger) {
        super();
        this.apiKey = (config.GOOGLE_MAPS_API_KEY || '').replace(/['";\s]/g, '');
        this.logger = logger || console;

        if (!this.apiKey) {
            this.logger.error('[ImageSource] Missing GOOGLE_MAPS_API_KEY in environment.');
        }
    }

    /**
     * Implementation of the ImageSourceProvider interface.
     * Fetches a 1024x512 equirectangular panorama from the Google Static API.
     */
    async getImage(nodeId) {
        try {
            const url = `https://maps.googleapis.com/maps/api/streetview?size=1024x512&pano=${nodeId}&key=${this.apiKey}`;
            const response = await axios.get(url, { 
                responseType: 'arraybuffer', 
                timeout: 20000 
            });
            
            return Buffer.from(response.data);
        } catch (e) {
            this.logger.error(`[ImageSource Error] API failure for node ${nodeId}: ${e.message}`);
            throw e;
        }
    }
}