import { BaseViewerProvider } from './BaseViewerProvider.js';

export class MarzipanoViewerProvider extends BaseViewerProvider {
    constructor(containerId, path) {
        super(containerId); // Strict adherence to contract
        this.container = document.getElementById(containerId);

        this.tourPath = path;

        this.viewer = null;
        this.scenes = {};
        this.currentNodeId = null;
    }

    async init() {
        await this._loadScript('https://www.marzipano.net/build/marzipano.js');
        await this._loadScript(`${this.tourPath}/data.js`);

        if (!window.Marzipano || !window.APP_DATA) {
            throw new Error("Failed to load Marzipano or APP_DATA");
        }

        const data = window.APP_DATA;
        const viewerOpts = { controls: { mouseViewMode: data.settings.mouseViewMode } };
        this.viewer = new window.Marzipano.Viewer(this.container, viewerOpts);

        data.scenes.forEach(sceneData => {
            const source = window.Marzipano.ImageUrlSource.fromString(`${this.tourPath}/tiles/${sceneData.id}/{z}/{f}/{y}/{x}.jpg`, { cubeMapPreviewUrl: `${this.tourPath}/tiles/${sceneData.id}/preview.jpg` });
            const geometry = new window.Marzipano.CubeGeometry(sceneData.levels);
            const view = new window.Marzipano.RectilinearView(sceneData.initialViewParameters);

            const scene = this.viewer.createScene({ source, geometry, view, pinFirstLevel: true });

            sceneData.linkHotspots.forEach(hotspot => {
                const element = document.createElement('div');
                Object.assign(element.style, {
                    width: '40px', height: '40px', background: 'rgba(0, 240, 255, 0.5)',
                    borderRadius: '50%', cursor: 'pointer', border: '2px solid #00f0ff'
                });

                element.addEventListener('click', () => this.switchScene(hotspot.target));
                scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
            });

            this.scenes[sceneData.id] = scene;
        });

        this.viewer.addEventListener('viewChange', () => {
            const view = this.viewer.view();
            const heading = view.yaw() * (180 / Math.PI);
            const pitch = view.pitch() * (180 / Math.PI);
            this.trigger('pov_changed', { heading: heading < 0 ? heading + 360 : heading, pitch });
        });

        if (data.scenes.length > 0) this.switchScene(data.scenes[0].id);
    }

    switchScene(nodeId) {
        if (!this.scenes[nodeId]) return;
        this.scenes[nodeId].switchTo();
        this.currentNodeId = nodeId;
        this.trigger('node_changed', { id: nodeId });
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    getCurrentNodeId() { return this.currentNodeId; }
    getLocation() { return "Local Marzipano Tour"; }
    isVisible() { return true; }
    getNativeViewer() { return this.viewer; }
    get supportsCameraSync() { return false; }
}