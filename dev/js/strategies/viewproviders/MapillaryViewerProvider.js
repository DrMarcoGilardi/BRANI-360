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

import { BaseViewerProvider } from './BaseViewerProvider.js';

/**
 * EXAMPLE STRATEGY IMPLEMENTATION  
 * Strategy implementing the map and 360° viewer interface utilizing MapillaryJS and MapLibre GL.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * BaseViewerProvider <|-- MapillaryViewerProvider
 * class MapillaryViewerProvider{
 * +init() Promise~void~
 * +show360Viewer(imageId)
 * +getCurrentNodeId() string
 * +getLocation() string
 * +isVisible() boolean
 * +getNativeViewer() Object
 * }
 * ```
 * 
 * @class
 */
export class MapillaryViewerProvider extends BaseViewerProvider {

    /**
     * @constructor
     * @memberof MapillaryViewerProvider
     * @description Initializes the MapillaryViewerProvider with necessary DOM bindings and credentials.
     * @param {string} containerId - The HTML element ID to mount the viewer inside.
     * @param {string} accessToken - Mapillary Client Access Token.
     */
    constructor(containerId, accessToken) {
        super(containerId);
        this.token = accessToken;
        this.map = null;
        this.mlyViewer = null;
        this.activeNodeId = null;
        this.activeLocation = "0,0";

        this.mapContainer = null;
        this.viewerContainer = null;
        this.closeBtn = null;
        this.satBtn = null;

        this.lastReportedNodeId = null;
    }

    /**
     * @async
     * @method _loadLibrary
     * @memberof MapillaryViewerProvider
     * @description Asynchronously loads MapLibre and MapillaryJS scripts and styles into the document.
     * @private
     * @returns {Promise<void>}
     */
    async _loadLibrary() {
        const loadStyle = (id, href) => {
            if (!document.getElementById(id)) {
                const link = document.createElement('link');
                link.id = id; link.rel = 'stylesheet'; link.href = href;
                document.head.appendChild(link);
            }
        };

        const loadScript = (id, src) => new Promise((resolve, reject) => {
            if (document.getElementById(id)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.id = id; script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });

        loadStyle('maplibre-style', 'https://unpkg.com/maplibre-gl@3.3.1/dist/maplibre-gl.css');
        loadStyle('mapillary-style', 'https://unpkg.com/mapillary-js@4.1.2/dist/mapillary.css');

        await Promise.all([
            loadScript('maplibre-script', 'https://unpkg.com/maplibre-gl@3.3.1/dist/maplibre-gl.js'),
            loadScript('mapillary-script', 'https://unpkg.com/mapillary-js@4.1.2/dist/mapillary.js')
        ]);
    }

    /**
     * @async
     * @method init
     * @memberof MapillaryViewerProvider
     * @description Initializes the underlying map SDK, constructs DOM elements, and binds core event listeners.
     * @returns {Promise<void>}
     */
    async init() {
        await this._loadLibrary();

        const parentContainer = document.getElementById(this.containerId);
        if (!parentContainer) return;

        parentContainer.style.position = 'relative';

        this.mapContainer = document.createElement('div');
        this.mapContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;';

        this.viewerContainer = document.createElement('div');
        this.viewerContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; z-index: 50;';

        this.loadingCover = document.createElement('div');
        this.loadingCover.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 51; display: none; background-color: #1a1a1a; background-size: cover; background-position: center; transition: opacity 0.3s ease-in-out;';

        this.loadingCover.innerHTML = `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); border: 3px solid rgba(255,255,255,0.1); border-left-color: #00f0ff; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite;"></div><style>@keyframes spin { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }</style>`;

        this.closeBtn = document.createElement('button');
        this.closeBtn.innerText = 'BACK TO MAP';
        this.closeBtn.style.cssText = 'position: absolute; top: 20px; left: 20px; z-index: 53; display: none; padding: 10px; background: rgba(0,0,0,0.8); color: #00f0ff; border: 1px solid #00f0ff; cursor: pointer; border-radius: 4px; font-weight: bold; font-family: sans-serif;';

        this.satBtn = document.createElement('button');
        this.satBtn.innerText = 'SATELLITE';
        this.satBtn.style.cssText = 'position: absolute; top: 70px; right: 20px; z-index: 100; display: block; padding: 10px; background: rgba(0,0,0,0.8); color: #00f0ff; border: 1px solid #00f0ff; cursor: pointer; border-radius: 4px; font-weight: bold; font-family: sans-serif; transition: background 0.2s;';
        this.satBtn.onmouseenter = () => this.satBtn.style.background = 'rgba(20,20,20,0.9)';
        this.satBtn.onmouseleave = () => this.satBtn.style.background = 'rgba(0,0,0,0.8)';

        parentContainer.appendChild(this.mapContainer);
        parentContainer.appendChild(this.viewerContainer);
        parentContainer.appendChild(this.loadingCover);
        parentContainer.appendChild(this.closeBtn);
        parentContainer.appendChild(this.satBtn);

        this.map = new window.maplibregl.Map({
            container: this.mapContainer,
            preserveDrawingBuffer: true,
            style: {
                version: 8,
                sources: {
                    'osm': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19 },
                    'satellite': { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19 }
                },
                layers: [
                    { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } },
                    { id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'visible' } }
                ]
            },
            center: [0, 20], zoom: 2, maxZoom: 18
        });

        let isSatellite = false;
        this.satBtn.addEventListener('click', () => {
            isSatellite = !isSatellite;
            this.satBtn.innerText = isSatellite ? 'MAP VIEW' : 'SATELLITE';
            this.map.setLayoutProperty('osm', 'visibility', isSatellite ? 'none' : 'visible');
            this.map.setLayoutProperty('satellite', 'visibility', isSatellite ? 'visible' : 'none');
        });

        this.map.on('load', () => {
            this.map.resize();

            this.map.addSource('mapillary', {
                type: 'vector',
                tiles: [`https://tiles.mapillary.com/maps/vtp/mly1_computed_public/2/{z}/{x}/{y}?access_token=${this.token}`],
                minzoom: 0,
                maxzoom: 14
            });

            this.map.addLayer({
                id: 'mapillary-overview',
                type: 'circle',
                source: 'mapillary',
                'source-layer': 'overview',
                maxzoom: 6,
                filter: ['==', ['get', 'is_pano'], true],
                paint: { 'circle-color': '#05CB63', 'circle-radius': 4 }
            });

            this.map.addLayer({
                id: 'mapillary-sequence',
                type: 'line',
                source: 'mapillary',
                'source-layer': 'sequence',
                minzoom: 6,
                filter: ['==', ['get', 'is_pano'], true],
                paint: { 'line-color': '#05CB63', 'line-width': 4, 'line-opacity': 0.6 }
            });

            this.map.addLayer({
                id: 'mapillary-images',
                type: 'circle',
                source: 'mapillary',
                'source-layer': 'image',
                minzoom: 6,
                filter: ['==', ['get', 'is_pano'], true],
                paint: { 'circle-color': '#05CB63', 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' }
            });

            const handleMapillaryClick = async (e) => {
                if (!e.features || e.features.length === 0) return;

                const feature = e.features[0];
                let clickedId = null;

                if (feature.sourceLayer === 'image' || feature.sourceLayer === 'overview') {
                    clickedId = feature.properties.id?.toString();
                } else if (feature.sourceLayer === 'sequence') {
                    const lat = e.lngLat.lat;
                    const lng = e.lngLat.lng;
                    try {
                        const radiusMeters = 20;
                        const latOffset = radiusMeters / 111320;
                        const lngOffset = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
                        const bbox = `${lng - lngOffset},${lat - latOffset},${lng + lngOffset},${lat + latOffset}`;

                        const radiusRes = await fetch(`https://graph.mapillary.com/images?fields=id&bbox=${bbox}&is_pano=true&limit=1&access_token=${this.token}`);
                        if (!radiusRes.ok) return;

                        const radiusData = await radiusRes.json();
                        if (radiusData.data && radiusData.data.length > 0) {
                            clickedId = radiusData.data[0].id.toString();
                        }
                    } catch (err) { return; }
                }

                if (!clickedId) return;

                this.show360Viewer(clickedId);
                this.trigger('visible_changed', true);
            };

            const interactiveLayers = ['mapillary-images', 'mapillary-sequence', 'mapillary-overview'];
            interactiveLayers.forEach(layer => {
                this.map.on('click', layer, handleMapillaryClick);
                this.map.on('mouseenter', layer, () => this.map.getCanvas().style.cursor = 'pointer');
                this.map.on('mouseleave', layer, () => this.map.getCanvas().style.cursor = '');
            });
        });

        this.closeBtn.addEventListener('click', () => {
            this.viewerContainer.style.display = 'none';
            this.loadingCover.style.display = 'none';
            this.closeBtn.style.display = 'none';
            if (this.satBtn) this.satBtn.style.display = 'block';

            if (this.map) this.map.resize();

            this.activeNodeId = null;
            this.activeLocation = "0,0";
            this.lastReportedNodeId = null;

            this.trigger('node_changed', { id: null });
            this.trigger('visible_changed', false);
        });
    }

    /**
     * @method show360Viewer
     * @memberof MapillaryViewerProvider
     * @description Displays the Mapillary 360 viewer, utilizing native covers for clean, internal WebGL transitions.
     * @param {string|number} imageId - The Mapillary image ID to render.
     */
    show360Viewer(imageId) {
        const targetId = imageId?.toString();

        this.viewerContainer.style.display = 'block';
        this.closeBtn.style.display = 'block';
        if (this.satBtn) this.satBtn.style.display = 'none';

        this.loadingCover.style.backgroundImage = 'none';
        this.loadingCover.style.display = 'block';
        this.loadingCover.style.opacity = '1';

        fetch(`https://graph.mapillary.com/${targetId}?fields=thumb_2048_url&access_token=${this.token}`)
            .then(res => res.json())
            .then(data => {
                if (data.thumb_2048_url && this.loadingCover.style.opacity === '1') {
                    this.loadingCover.style.backgroundImage = `url(${data.thumb_2048_url})`;
                }
            }).catch(() => { });

        if (!this.mlyViewer) {
            this.mlyViewer = new window.mapillary.Viewer({
                accessToken: this.token,
                container: this.viewerContainer,
                imageId: targetId,
                component: { cover: false, direction: true, sequence: true }
            });

            this.mlyViewer.setFilter(['==', 'cameraType', 'spherical']);

            this.mlyViewer.on('image', (event) => {
                const img = event.image;
                if (!img) return;
                const newId = img.id?.toString();
                if (this.loadingCover.style.opacity === '1') {
                    this.loadingCover.style.opacity = '0';
                    setTimeout(() => { this.loadingCover.style.display = 'none'; }, 300);
                }

                if (this.lastReportedNodeId === newId) return;

                this.activeNodeId = newId;
                const lat = img.lngLat ? parseFloat(img.lngLat.lat || 0) : 0;
                const lng = img.lngLat ? parseFloat(img.lngLat.lng || 0) : 0;
                this.activeLocation = `${lat},${lng}`;
                this.lastReportedNodeId = newId;

                this.trigger('node_changed', { id: this.activeNodeId, location: this.activeLocation });

                this.mlyViewer.getPointOfView().then(pov => {
                    if (pov) {
                        const heading = isNaN(pov.bearing) ? 0 : pov.bearing;
                        const pitch = isNaN(pov.tilt) ? 0 : pov.tilt;
                        this.trigger('pov_changed', { heading, pitch });
                    }
                }).catch(() => { });
            });

            this.mlyViewer.on('pov', async () => {
                try {
                    const pov = await this.mlyViewer.getPointOfView();
                    if (pov && typeof pov.bearing !== 'undefined') {
                        const heading = isNaN(pov.bearing) ? 0 : pov.bearing;
                        const pitch = isNaN(pov.tilt) ? 0 : pov.tilt;
                        this.trigger('pov_changed', { heading, pitch });
                    }
                } catch (err) { }
            });
        } else {
            this.mlyViewer.resize();
            this.mlyViewer.moveTo(targetId).catch(() => {
                this.loadingCover.style.opacity = '0';
                setTimeout(() => { this.loadingCover.style.display = 'none'; }, 300);
            });
        }
    }

    /**
     * @method getCurrentNodeId
     * @memberof MapillaryViewerProvider
     * @description Retrieves the currently active node's ID.
     * @returns {string|null} Current agnostic node ID.
     */
    getCurrentNodeId() {
        return this.activeNodeId;
    }

    /**
     * @method getLocation
     * @memberof MapillaryViewerProvider
     * @description Retrieves the current geographical coordinates.
     * @returns {string} Unified location coordinate string formatted as "lat,lng".
     */
    getLocation() {
        return this.activeLocation;
    }

    /**
     * @method isVisible
     * @memberof MapillaryViewerProvider
     * @description Checks if the 360 viewer is currently mounted and displayed.
     * @returns {boolean} True if the viewer is visible.
     */
    isVisible() {
        return this.viewerContainer?.style.display === 'block';
    }

    /**
     * @method getNativeViewer
     * @memberof MapillaryViewerProvider
     * @description Exposes the underlying Mapillary JS Viewer instance.
     * @returns {Object|null} Native Mapillary viewer instance.
     */
    getNativeViewer() {
        return this.mlyViewer;
    }

    /**
     * @method supportsCameraSync
     * @memberof MapillaryViewerProvider
     * @description CAPABILITY FLAG: Indiciates Mapillary natively supports external camera syncing.
     * @returns {boolean}
     */
    get supportsCameraSync() {
        return true;
    }

    /**
     * @method syncCamera
     * @memberof MapillaryViewerProvider
     * @description Executes the camera sync using Mapillary's proprietary SDK methods.
     * @param {Object} pov - Standardized object containing the target viewing angles.
     * @param {number} pov.heading - The horizontal bearing.
     * @param {number} pov.pitch - The vertical tilt.
     */
    syncCamera(pov) {
        if (!this.mlyViewer) return;
        if (typeof this.mlyViewer.setCenter === 'function') {
            this.mlyViewer.setCenter([pov.heading, pov.pitch]);
        } else if (typeof this.mlyViewer.setBearing === 'function') {
            this.mlyViewer.setBearing(pov.heading);
            if (typeof this.mlyViewer.setPitch === 'function') {
                this.mlyViewer.setPitch(pov.pitch);
            }
        }
    }
}