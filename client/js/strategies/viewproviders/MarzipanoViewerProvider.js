import { BaseViewerProvider } from './BaseViewerProvider.js';
import { Physics2D } from '../../Utilities/Physics2D.js';

/**
 * @class MarzipanoViewerProvider
 * @description Provider managing the Marzipano 360 viewer, its dynamic force-directed graph UI overlay, and event orchestration.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * BaseViewerProvider <|-- MarzipanoViewerProvider
 * MarzipanoViewerProvider --> Physics2D : Drives UI Graph
 * class MarzipanoViewerProvider{
 * +tourPath string
 * +isViewerVisible boolean
 * +init() Promise~void~
 * +setupUI(scenes) void
 * +switchScene(nodeId) void
 * +getCurrentNodeId() string
 * +getLocation() string
 * +isVisible() boolean
 * +getNativeViewer() Object
 * }
 * ```
 */
export class MarzipanoViewerProvider extends BaseViewerProvider {
    /**
     * @constructor
     * @memberof MarzipanoViewerProvider
     * @description Initializes the provider and prepares the required HTML container.
     * @param {string} containerId - The ID of the DOM element to host the viewer and graph.
     * @param {string} path - The relative or absolute path to the local Marzipano tour folder.
     */
    constructor(containerId, path) {
        super(containerId);
        this.container = document.getElementById(containerId);

        if (getComputedStyle(this.container).position === 'static') {
            this.container.style.position = 'relative';
        }

        this.tourPath = path;
        this.viewer = null;
        this.scenes = {};
        this.currentNodeId = null;
        this.isViewerVisible = false;

        this.nodeChangeTimer = null;

        this.graphNodes = [];
        this.graphEdges = [];
        this.physicsEngine = null;
    }

    /**
     * @async
     * @method init
     * @memberof MarzipanoViewerProvider
     * @description Loads external scripts, reads local tour data, initializes the Marzipano Viewer, and triggers UI setup.
     * @throws {Error} If Marzipano or the tour's APP_DATA fails to load.
     * @returns {Promise<void>}
     */
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
            const source = window.Marzipano.ImageUrlSource.fromString(
                `${this.tourPath}/tiles/${sceneData.id}/{z}/{f}/{y}/{x}.jpg`,
                { cubeMapPreviewUrl: `${this.tourPath}/tiles/${sceneData.id}/preview.jpg` }
            );
            const geometry = new window.Marzipano.CubeGeometry(sceneData.levels);
            const view = new window.Marzipano.RectilinearView(sceneData.initialViewParameters);

            const scene = this.viewer.createScene({ source, geometry, view, pinFirstLevel: true });

            sceneData.linkHotspots.forEach(hotspot => {
                const element = document.createElement('div');
                Object.assign(element.style, {
                    width: '40px', height: '40px', background: 'rgba(0, 240, 255, 0.5)',
                    borderRadius: '50%', cursor: 'pointer', border: '2px solid #00f0ff'
                });

                element.addEventListener('click', () => {
                    if (this.isViewerVisible) this.switchScene(hotspot.target);
                });
                scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
            });

            this.scenes[sceneData.id] = scene;
        });

        this.viewer.addEventListener('viewChange', () => {
            if (!this.isViewerVisible) return;

            const view = this.viewer.view();
            const heading = view.yaw() * (180 / Math.PI);
            const pitch = view.pitch() * (180 / Math.PI);
            this.trigger('pov_changed', { heading: heading < 0 ? heading + 360 : heading, pitch });
        });

        if (data.scenes.length > 0) {
            this.setupUI(data.scenes);
        }
    }

    /**
     * @method setupUI
     * @memberof MarzipanoViewerProvider
     * @description Constructs the dynamic topology graph interface and back button overlay, and launches the Physics2D engine.
     * @param {Array<Object>} scenes - Array of scene objects from the Marzipano APP_DATA.
     * @returns {void}
     */
    setupUI(scenes) {
        const numNodes = scenes.length || 1;
        const nodeSize = Math.max(50, Math.min(120, 300 / Math.sqrt(numNodes)));

        // --- 1. Base UI Elements ---
        const backButton = document.createElement('button');
        backButton.innerText = '← Back to Map';
        Object.assign(backButton.style, {
            position: 'absolute', top: '20px', left: '20px', zIndex: 1001,
            padding: '10px 20px', fontSize: '16px', cursor: 'pointer',
            backgroundColor: 'rgba(20, 20, 20, 0.8)', color: '#fff',
            border: '2px solid #00f0ff', borderRadius: '8px',
            display: 'none', transition: 'background-color 0.2s'
        });

        backButton.onmouseenter = () => backButton.style.backgroundColor = 'rgba(0, 240, 255, 0.3)';
        backButton.onmouseleave = () => backButton.style.backgroundColor = 'rgba(20, 20, 20, 0.8)';

        const overlay = document.createElement('div');
        overlay.id = 'tour-graph-overlay';
        Object.assign(overlay.style, {
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(20, 20, 20, 0.95)', zIndex: 1000, overflow: 'hidden'
        });

        const svgNS = "http://www.w3.org/2000/svg";
        const svgCanvas = document.createElementNS(svgNS, "svg");
        Object.assign(svgCanvas.style, {
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none'
        });
        overlay.appendChild(svgCanvas);

        const nodeMap = {};

        // --- 2. Initialize Nodes and Labels ---
        scenes.forEach(scene => {
            const previewUrl = `${this.tourPath}/tiles/${scene.id}/preview.jpg`;

            const nodeElement = document.createElement('div');
            nodeElement.title = scene.name || `Node ${scene.id}`;

            Object.assign(nodeElement.style, {
                position: 'absolute', width: `${nodeSize}px`, height: `${nodeSize}px`, cursor: 'pointer',
                backgroundImage: `url('${previewUrl}')`,
                backgroundSize: '100% 600%', backgroundPosition: 'center top',
                border: '3px solid #00f0ff', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                transition: 'border-color 0.3s ease, transform 0.1s',
                transform: 'translate(-50%, -50%)', userSelect: 'none', zIndex: 50
            });

            nodeElement.onmouseenter = () => nodeElement.style.borderColor = '#ffffff';
            nodeElement.onmouseleave = () => nodeElement.style.borderColor = '#00f0ff';

            const labelElement = document.createElement('div');
            labelElement.innerText = scene.name || `Node ${scene.id}`;
            Object.assign(labelElement.style, {
                position: 'absolute', color: '#fff', background: 'rgba(20,20,20,0.85)',
                padding: '4px 10px', borderRadius: '12px', fontSize: '13px',
                fontFamily: 'sans-serif', whiteSpace: 'nowrap', pointerEvents: 'none',
                transform: 'translate(-50%, -50%)', border: '1px solid rgba(0, 240, 255, 0.4)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.5)', zIndex: 60
            });

            overlay.appendChild(nodeElement);
            overlay.appendChild(labelElement);

            const nodeData = {
                id: scene.id, el: nodeElement, labelEl: labelElement,
                x: Math.random() * (window.innerWidth || 800),
                y: Math.random() * (window.innerHeight || 600),
                vx: 0, vy: 0, isDragging: false,
                lx: 0, ly: 1,
                neighbors: []
            };

            nodeMap[scene.id] = nodeData;
            this.graphNodes.push(nodeData);

            nodeElement.addEventListener('mousedown', (e) => {
                nodeData.isDragging = true;
                e.preventDefault();
                if (this.physicsEngine) this.physicsEngine.start();
            });

            nodeElement.addEventListener('click', () => {
                if (Math.abs(nodeData.vx) < 1 && Math.abs(nodeData.vy) < 1) {
                    overlay.style.display = 'none';
                    backButton.style.display = 'block';
                    this.switchScene(scene.id);
                }
            });
        });

        // --- 3. Initialize Edges ---
        scenes.forEach(scene => {
            if (!scene.linkHotspots) return;
            scene.linkHotspots.forEach(hotspot => {
                if (nodeMap[hotspot.target]) {
                    const sourceNode = nodeMap[scene.id];
                    const targetNode = nodeMap[hotspot.target];

                    if (!sourceNode.neighbors.includes(targetNode)) sourceNode.neighbors.push(targetNode);
                    if (!targetNode.neighbors.includes(sourceNode)) targetNode.neighbors.push(sourceNode);

                    const edgeId = [scene.id, hotspot.target].sort().join('-');
                    if (!this.graphEdges.find(e => e.id === edgeId)) {
                        const line = document.createElementNS(svgNS, 'line');
                        line.setAttribute('stroke', 'rgba(0, 240, 255, 0.4)');
                        line.setAttribute('stroke-width', '3');
                        svgCanvas.appendChild(line);

                        this.graphEdges.push({
                            id: edgeId, el: line,
                            source: sourceNode, target: targetNode
                        });
                    }
                }
            });
        });

        // --- 4. Global Event Listeners ---
        window.addEventListener('mousemove', (e) => {
            const draggingNode = this.graphNodes.find(n => n.isDragging);
            if (draggingNode) {
                const rect = overlay.getBoundingClientRect();
                draggingNode.x = e.clientX - rect.left;
                draggingNode.y = e.clientY - rect.top;
                draggingNode.vx = 0;
                draggingNode.vy = 0;
            }
        });

        window.addEventListener('mouseup', () => {
            this.graphNodes.forEach(n => n.isDragging = false);
        });

        backButton.addEventListener('click', () => {
            backButton.style.display = 'none';
            overlay.style.display = 'block';

            this.isViewerVisible = false;
            this.currentNodeId = null;

            if (this.nodeChangeTimer) {
                clearTimeout(this.nodeChangeTimer);
                this.nodeChangeTimer = null;
            }

            this.trigger('node_changed', { id: null });
            this.trigger('visible_changed', false);

            if (this.physicsEngine) this.physicsEngine.start();
        });

        this.container.appendChild(overlay);
        this.container.appendChild(backButton);

        // --- 5. Start Physics Engine with Dynamic Scale ---
        this.physicsEngine = new Physics2D(this.container, this.graphNodes, this.graphEdges, nodeSize);
        this.physicsEngine.start();
    }

    /**
     * @method switchScene
     * @memberof MarzipanoViewerProvider
     * @description Triggers Marzipano to switch to a specific scene and manages delayed audio/sync triggers.
     * @param {string} nodeId - The target Marzipano scene/node ID.
     * @returns {void}
     */
    switchScene(nodeId) {
        if (!this.scenes[nodeId]) return;

        if (!this.isViewerVisible) {
            this.isViewerVisible = true;
            this.trigger('visible_changed', true);
            if (this.physicsEngine) this.physicsEngine.stop();
        }

        this.scenes[nodeId].switchTo();
        this.currentNodeId = nodeId;

        if (this.nodeChangeTimer) {
            clearTimeout(this.nodeChangeTimer);
        }

        this.nodeChangeTimer = setTimeout(() => {
            if (!this.isViewerVisible || this.currentNodeId !== nodeId) return;

            this.trigger('node_changed', { id: nodeId });

            const view = this.viewer.view();
            const heading = view.yaw() * (180 / Math.PI);
            const pitch = view.pitch() * (180 / Math.PI);
            this.trigger('pov_changed', { heading: heading < 0 ? heading + 360 : heading, pitch });

        }, 600);
    }

    /**
     * @method _loadScript
     * @memberof MarzipanoViewerProvider
     * @description Helper to dynamically load external JavaScript files into the document.
     * @param {string} src - URL or path of the script.
     * @returns {Promise<Event>} Promise resolving when the script finishes loading.
     * @private
     */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * @method getCurrentNodeId
     * @memberof MarzipanoViewerProvider
     * @description Returns the currently active 360 node.
     * @returns {string|null} The current node ID.
     */
    getCurrentNodeId() { return this.currentNodeId; }

    /**
     * @method getLocation
     * @memberof MarzipanoViewerProvider
     * @description Fallback location string since local Marzipano tours are non-geographic.
     * @returns {string} Default local string.
     */
    getLocation() { return "Local Marzipano Tour"; }

    /**
     * @method isVisible
     * @memberof MarzipanoViewerProvider
     * @description Indicates whether the 360 viewer (as opposed to the graph map) is active.
     * @returns {boolean} True if inside a 360 scene.
     */
    isVisible() { return this.isViewerVisible; }

    /**
     * @method getNativeViewer
     * @memberof MarzipanoViewerProvider
     * @description Returns the raw Marzipano viewer instance.
     * @returns {Object|null} Marzipano Viewer object.
     */
    getNativeViewer() { return this.viewer; }

    /**
     * @method supportsCameraSync
     * @memberof MarzipanoViewerProvider
     * @description Capability flag defining if external heading/pitch forcing is supported.
     * @returns {boolean}
     */
    get supportsCameraSync() { return false; }
}