import { BaseTopologyProvider } from "./BaseTopologyProvider.js";
import { GoogleMapsLoader } from '../../utilities/GoogleMapsLoader.js';

/*
 * Must return: { id, lat, lng, links: [{ id, heading }] }
 */
export class GoogleTopologyProvider extends BaseTopologyProvider {
    constructor(apiKey) {
        super();
        this.apiKey = apiKey;
        this.svService = null;
    }

    async getNode(nodeId) {
        // Guarantee the API is loaded (inherited from your original logic)
        await GoogleMapsLoader.load(this.apiKey);

        if (!this.svService) {
            // Using the global namespace initialized by the traditional script tag
            this.svService = new window.google.maps.StreetViewService();
        }

        return new Promise((resolve) => {
            this.svService.getPanorama({ pano: nodeId }, (data, status) => {
                // Exact safety checks and structural mapping from your original code
                if (status === 'OK' && data.links && data.location?.latLng) {
                    resolve({
                        id: nodeId, // Notice: your original used nodeId here instead of data.location.pano
                        lat: data.location.latLng.lat(),
                        lng: data.location.latLng.lng(),
                        // Restored the 'pano' property that TopologyRadar needs
                        links: data.links.map(l => ({
                            id: l.pano,
                            heading: l.heading
                        }))
                    });
                } else {
                    // Gracefully return null on failure instead of crashing the pipeline
                    resolve(null);
                }
            });
        });
    }
}