export class VRThumbstickManager {
    static register() {
        if (typeof AFRAME === 'undefined' || AFRAME.components['contextual-thumbsticks']) return;

        console.log("🛠️ [VR Thumbstick Manager] Registering component with A-Frame...");

        AFRAME.registerComponent('contextual-thumbsticks', {
            init: function () {
                this.currentFocus = '360';
                this.navCooldown = 0;
                this.rotateCooldown = 0;
                this.lastPanTime = 0;

                this.handAxes = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };

                this.setupFocusTracking();
                this.setupAxisListeners();
            },

            setupFocusTracking: function () {
                this.el.addEventListener('mouseenter', (evt) => {
                    if (!evt.target) return;

                    const id = evt.target.id;
                    if (id === 'vr-floating-map') {
                        this.currentFocus = 'MAP';
                        console.log(`👁️ [Focus Changed] Now looking at: MAP`);
                    } else if (id === 'vr-hud-panel') {
                        this.currentFocus = 'HUD';
                        console.log(`👁️ [Focus Changed] Now looking at: HUD`);
                    }
                });

                this.el.addEventListener('mouseleave', (evt) => {
                    if (!evt.target) return;

                    const id = evt.target.id;
                    if (id === 'vr-floating-map' || id === 'vr-hud-panel') {
                        this.currentFocus = '360';
                    }
                });
            },

            setupAxisListeners: function () {
                this.el.addEventListener('axismove', (evt) => {
                    const hand = evt.target.id.includes('left') ? 'left' : 'right';
                    const axes = evt.detail.axis;
                    if (!axes || axes.length === 0) return;

                    let x = axes.length >= 4 ? axes[2] : axes[0];
                    let y = axes.length >= 4 ? axes[3] : axes[1];

                    this.handAxes[hand] = { x: x || 0, y: y || 0 };
                });

                this.el.addEventListener('thumbstickmoved', (evt) => {
                    const hand = evt.target.id.includes('left') ? 'left' : 'right';
                    console.log(`🕹️ [Oculus Thumbstick] ${hand} moved: X:${evt.detail.x.toFixed(2)} Y:${evt.detail.y.toFixed(2)}`);
                    this.handAxes[hand] = { x: evt.detail.x, y: evt.detail.y };
                });
            },

            tick: function (time, timeDelta) {
                if (Math.floor(time) % 5000 < 20 && this.lastHeartbeat !== Math.floor(time / 5000)) {
                    console.log(`❤️ [Thumbstick Tick Heartbeat] Scene is ticking. Current Focus: ${this.currentFocus}`);
                    this.lastHeartbeat = Math.floor(time / 5000);
                }

                this.processHandInput('left', timeDelta);
                this.processHandInput('right', timeDelta);
            },

            processHandInput: function (handName, timeDelta) {
                const x = this.handAxes[handName].x;
                const y = this.handAxes[handName].y;

                if (Math.abs(x) > 0.25 || Math.abs(y) > 0.25) {
                    this.routeInput(handName, x, y, timeDelta);
                }
            },

            routeInput: function (hand, x, y, timeDelta) {
                switch (this.currentFocus) {
                    case 'MAP':
                        this.handleMapControls(hand, x, y, timeDelta);
                        break;
                    case 'HUD':
                        this.handleHudControls(y, timeDelta);
                        break;
                    case '360':
                    default:
                        this.handle360Controls(x, y);
                        break;
                }
            },

            handleMapControls: function (hand, x, y, timeDelta) {
                const mapEntity = document.getElementById('vr-floating-map');
                if (!mapEntity || !mapEntity.components['interactive-map']) return;

                const interactiveMap = mapEntity.components['interactive-map'];
                const mapTarget = interactiveMap.isDomMap ? interactiveMap.referenceElement : interactiveMap.canvas;
                if (!mapTarget) return;

                if (hand === 'right' && Math.abs(y) > 0.25) {
                    const scrollDelta = y * (timeDelta * 0.5);
                    const rect = mapTarget.getBoundingClientRect();
                    const targetX = interactiveMap.lastX || (rect.left + rect.width / 2);
                    const targetY = interactiveMap.lastY || (rect.top + rect.height / 2);
                    interactiveMap.dispatchDOMEvent('wheel', targetX, targetY, { deltaY: scrollDelta });
                }
                else if (hand === 'left') {
                    if (performance.now() - this.lastPanTime < 50) return;

                    let key = null;
                    let keyCode = 0;
                    if (Math.abs(x) > 0.3 || Math.abs(y) > 0.3) {
                        if (Math.abs(x) > Math.abs(y)) {
                            key = x > 0 ? 'ArrowRight' : 'ArrowLeft';
                            keyCode = x > 0 ? 39 : 37;
                        } else {
                            key = y > 0 ? 'ArrowDown' : 'ArrowUp';
                            keyCode = y > 0 ? 40 : 38;
                        }
                    }

                    if (key) {
                        if (!mapTarget.hasAttribute('tabindex')) {
                            mapTarget.setAttribute('tabindex', '0');
                        }
                        mapTarget.focus();
                        mapTarget.dispatchEvent(new KeyboardEvent('keydown', {
                            key: key,
                            code: key,
                            keyCode: keyCode,
                            bubbles: true,
                            cancelable: true
                        }));

                        this.lastPanTime = performance.now();
                    }
                }
            },

            handleHudControls: function (y, timeDelta) {
                const hudContainer = document.querySelector('#hud');
                if (!hudContainer) return;

                hudContainer.scrollBy({ top: y * (timeDelta * 0.05), behavior: 'auto' });
            },

            handle360Controls: function (x, y) {
                const now = performance.now();

                if (Math.abs(x) > 0.7 && now - this.rotateCooldown > 500) {
                    const rig = document.getElementById('camera-rig');
                    if (rig) {
                        const rot = rig.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
                        const newY = rot.y + (x > 0 ? -30 : 30);

                        rig.setAttribute('rotation', { x: rot.x, y: newY, z: rot.z });
                        this.rotateCooldown = now;
                    }
                }

                if (Math.abs(y) > 0.7 && now - this.navCooldown > 1000) {
                    const intent = y < 0 ? 'next' : 'prev';
                    console.log(`🚀 [Navigate] Dispatching intent: ${intent}`);

                    document.dispatchEvent(new CustomEvent('vr:thumbstick_navigate', {
                        detail: { direction: intent }
                    }));
                    this.navCooldown = now;
                }
            }
        });

        const attachToScene = () => {
            const scene = document.querySelector('a-scene');
            if (scene && !scene.hasAttribute('contextual-thumbsticks')) {
                scene.setAttribute('contextual-thumbsticks', '');
                console.log("🔌 [VR Thumbstick Manager] Dynamically attached attribute to <a-scene>!");
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(attachToScene, 10));
        } else {
            setTimeout(attachToScene, 10);
        }
    }
}