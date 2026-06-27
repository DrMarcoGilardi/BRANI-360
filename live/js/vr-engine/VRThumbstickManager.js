export class VRThumbstickManager {
    static register() {
        if (typeof AFRAME === 'undefined' || AFRAME.components['contextual-thumbsticks']) return;

        AFRAME.registerComponent('contextual-thumbsticks', {
            init: function () {
                this.currentFocus = '360';
                this.navCooldown = 0;
                this.rotateCooldown = 0;
                this.lastPanTime = 0;

                this.setupFocusTracking();

                // Wait for the scene to load before attaching to the hands
                if (this.el.sceneEl.hasLoaded) {
                    this.setupControllers();
                } else {
                    this.el.sceneEl.addEventListener('loaded', () => this.setupControllers());
                }
            },

            setupFocusTracking: function () {
                const trackEntity = (id, stateName) => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.addEventListener('mouseenter', () => { this.currentFocus = stateName; });
                        el.addEventListener('mouseleave', () => { this.currentFocus = '360'; });
                    }
                };

                trackEntity('vr-floating-map', 'MAP');
                trackEntity('vr-hud-panel', 'HUD');
            },

            setupControllers: function () {
                const leftHand = document.querySelector('#leftHand');
                const rightHand = document.querySelector('#rightHand');

                // Bind DIRECTLY to the controller entities
                if (leftHand) {
                    leftHand.addEventListener('axismove', (e) => this.onAxisMove(e, 'left'));
                }
                if (rightHand) {
                    rightHand.addEventListener('axismove', (e) => this.onAxisMove(e, 'right'));
                }
            },

            onAxisMove: function (e, hand) {
                const axis = e.detail.axis;
                if (!axis || axis.length === 0) return;

                // --- DIAGNOSTIC LOG ---
                // Open your browser console (or remote debugger) to see if this fires!
                console.log(`[Thumbstick] ${hand} hand moved. Axis data:${axis}`);

                // Meta Quest standard: Thumbstick is 2,3. Older WebVR: 0,1.
                const x = axis.length >= 4 ? axis[2] : axis[0];
                const y = axis.length >= 4 ? axis[3] : axis[1];

                this.routeInput(hand, x, y);
            },

            routeInput: function (hand, x, y) {
                if (Math.abs(x) < 0.25 && Math.abs(y) < 0.25) return;

                switch (this.currentFocus) {
                    case 'MAP':
                        this.handleMapControls(hand, x, y);
                        break;
                    case 'HUD':
                        this.handleHudControls(y);
                        break;
                    case '360':
                    default:
                        this.handle360Controls(x, y);
                        break;
                }
            },

            handleMapControls: function (hand, x, y) {
                const mapCanvas = document.querySelector('#map-layer');
                if (!mapCanvas) return;

                if (hand === 'right' && Math.abs(y) > 0.25) {
                    const scrollDelta = y * 50;
                    mapCanvas.dispatchEvent(new WheelEvent('wheel', {
                        deltaY: scrollDelta, bubbles: true, view: window
                    }));
                }
                else if (hand === 'left') {
                    if (performance.now() - this.lastPanTime < 50) return;

                    let key = null;
                    if (Math.abs(x) > Math.abs(y)) {
                        key = x > 0 ? 'ArrowRight' : 'ArrowLeft';
                    } else {
                        key = y > 0 ? 'ArrowDown' : 'ArrowUp';
                    }

                    if (key) {
                        mapCanvas.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true }));
                        this.lastPanTime = performance.now();
                    }
                }
            },

            handleHudControls: function (y) {
                const hudContainer = document.querySelector('#hud');
                if (!hudContainer || Math.abs(y) < 0.25) return;
                hudContainer.scrollBy({ top: y * 20, behavior: 'auto' });
            },

            handle360Controls: function (x, y) {
                const now = performance.now();

                // Rotate
                if (Math.abs(x) > 0.7 && now - this.rotateCooldown > 500) {
                    const rig = document.getElementById('camera-rig');
                    if (rig) {
                        const rot = rig.getAttribute('rotation');
                        rot.y += (x > 0 ? -45 : 45);
                        rig.setAttribute('rotation', rot);
                        this.rotateCooldown = now;
                    }
                }

                // Navigate
                if (Math.abs(y) > 0.7 && now - this.navCooldown > 1000) {
                    const intent = y < 0 ? 'next' : 'prev';
                    document.dispatchEvent(new CustomEvent('vr:thumbstick_navigate', {
                        detail: { direction: intent }
                    }));
                    this.navCooldown = now;
                }
            }
        });
    }
}