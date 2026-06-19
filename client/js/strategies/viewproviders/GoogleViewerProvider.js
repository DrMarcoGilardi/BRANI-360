import { BaseViewerProvider } from './BaseViewerProvider.js';
import { GoogleMapsLoader } from '../../Utilities/GoogleMapsLoader.js';

export class GoogleViewerProvider extends BaseViewerProvider {
    constructor(containerId, apiKey) {
        super(containerId);
        this.apiKey = apiKey;
        this.panorama = null;
    }

    async init() {
        // 1. Wait for the API to completely download and initialize
        await GoogleMapsLoader.load(this.apiKey);
        
        // 2. We no longer need importLibrary(). The map object is globally ready.
        const mapObj = new window.google.maps.Map(document.getElementById(this.containerId), {
            center: { lat: 42.5196, lng: 12.5276 },
            zoom: 3,
            streetViewControl: true,
            backgroundColor: '#000000' // Prevents white flashes while tiles load
        });

        this.panorama = mapObj.getStreetView();
        
        this.panorama.addListener('pov_changed', () => {
            const pov = this.panorama.getPov();
            if (pov) this.trigger('pov_changed', { heading: pov.heading, pitch: pov.pitch });
        });
        
        this.panorama.addListener('visible_changed', () => {
            this.trigger('visible_changed', this.panorama.getVisible());
        });
        
        this.panorama.addListener('pano_changed', () => {
            const loc = this.panorama.getLocation();
            this.trigger('node_changed', {
                id: this.panorama.getPano(),
                location: loc && loc.latLng ? `${loc.latLng.lat()},${loc.latLng.lng()}` : "0,0"
            });
        });
    }

    getCurrentNodeId() { return this.panorama?.getPano() || null; }
    
    getLocation() {
        const loc = this.panorama?.getLocation();
        return loc && loc.latLng ? `${loc.latLng.lat()},${loc.latLng.lng()}` : "0,0";
    }
    
    isVisible() { return this.panorama?.getVisible() || false; }
    
    getNativeViewer() { return this.panorama; }

    /**
     * CAPABILITY FLAG: Google Street View natively supports external camera syncing.
     * @returns {boolean}
     */
    get supportsCameraSync() { 
        return true; 
    }

    /**
     * Executes the camera sync using Google's proprietary SDK methods.
     * @param {Object} pov - Standardized { heading, pitch } object
     */
    syncCamera(pov) {
        // Use your specific property name for the Google instance
        if (this.panorama && typeof this.panorama.setPov === 'function') {
            this.panorama.setPov({ heading: pov.heading, pitch: pov.pitch });
        }
    }
}