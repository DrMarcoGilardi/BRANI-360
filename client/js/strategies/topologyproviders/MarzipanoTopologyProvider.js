import { BaseTopologyProvider } from './BaseTopologyProvider.js';
/**
 * EXAMPLE STRATEGY IMPLEMENTATION  
 * Provides network topology parsing for Marzipano local tours, generating spatial routing and node relationships.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * BaseTopologyProvider <|-- MarzipanoTopologyProvider
 * class MarzipanoTopologyProvider{
 * +data Object
 * +getNode(nodeId) Promise~Object~
 * }
 * ```
 * 
 * @class
 */
export class MarzipanoTopologyProvider extends BaseTopologyProvider {
    /**
     * @constructor 
     * @memberof MarzipanoTopologyProvider
     * @description Initializes the Topology provider to read the shared APP_DATA.
     * @param {Object} key - Configuration or initialization key.
     */
    constructor(key) {
        super();
        this.data = window.APP_DATA; // Already loaded by ViewerProvider
    }

    /**
     * @async
     * @method getNode
     * @memberof MarzipanoTopologyProvider
     * @description Resolves detailed node connection data and hotspot headings for a given scene.
     * @param {string} nodeId - Target Marzipano scene ID.
     * @returns {Promise<Object>} An object detailing lat, lng, and formatted spatial links.
     * @throws {Error} If the node ID does not exist in the loaded data.
     */
    async getNode(nodeId) {
        if (!this.data) this.data = window.APP_DATA;

        const scene = this.data.scenes.find(s => s.id === nodeId);
        if (!scene) throw new Error(`Node ${nodeId} not found in Marzipano data.`);

        const links = (scene.linkHotspots || []).map(link => {
            const headingDegrees = link.yaw * (180 / Math.PI);
            return {
                id: link.target,
                heading: headingDegrees < 0 ? headingDegrees + 360 : headingDegrees
            };
        });

        return {
            id: scene.id,
            lat: Math.random() * 0.001, // Arbitrary for force-directed radar layout
            lng: Math.random() * 0.001,
            links: links
        };
    }
}