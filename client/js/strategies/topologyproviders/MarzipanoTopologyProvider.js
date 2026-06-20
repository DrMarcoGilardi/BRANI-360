import { BaseTopologyProvider } from './BaseTopologyProvider.js';

export class MarzipanoTopologyProvider extends BaseTopologyProvider {
    constructor(key) {
        super();
        this.data = window.APP_DATA; // Already loaded by ViewerProvider
    }

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