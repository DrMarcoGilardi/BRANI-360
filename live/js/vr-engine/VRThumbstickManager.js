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

            // THE NUCLEAR OPTION: Talk directly to the browser's WebXR Hardware API
            tick: function (time, timeDelta) {
                // 1. Only run if we are actually in an immersive WebXR session
                if (!this.el.sceneEl || !this.el.sceneEl.is('vr-mode')) return;

                // 2. Grab the raw WebXR session from Three.js
                const session = this.el.sceneEl.renderer.xr.getSession();
                if (!session || !session.inputSources) return;

                // 3. Loop through all active controllers (hands)
                for (const source of session.inputSources) {
                    if (!source.gamepad || !source.gamepad.axes) continue;

                    const hand = source.handedness; // 'left' or 'right'
                    const axes = source.gamepad.axes;

                    // WebXR API Standard:
                    // Touchpad = axes[0], axes[1]
                    // Thumbstick = axes[2], axes[3]
                    const x = axes.length >= 4 ? axes[2] : axes[0];
                    const y = axes.length >= 4 ? axes[3] : axes[1];

                    // Check deadzone (filters out hardware drift and resting thumbs)
                    if (Math.abs(x) > 0.25 || Math.abs(y) > 0.25) {
                        this.routeInput(hand, x, y, timeDelta);
                    }
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
                const mapCanvas = document.querySelector('#map-layer');
                if (!mapCanvas) return;

                if (hand === 'right' && Math.abs(y) > 0.25) {
                    // Because `tick` runs at 60-90 FPS, we multiply by timeDelta 
                    // to ensure smooth zooming regardless of framerate
                    const scrollDelta = y * (timeDelta * 0.1);
                    mapCanvas.dispatchEvent(new WheelEvent('wheel', {
                        deltaY: scrollDelta, bubbles: true, view: window
                    }));
                }
                else if (hand === 'left') {
                    // Throttled panning to mimic keyboard repeat rates
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

            handleHudControls: function (y, timeDelta) {
                const hudContainer = document.querySelector('#hud');
                if (!hudContainer) return;

                // Smooth frame-independent scrolling
                hudContainer.scrollBy({ top: y * (timeDelta * 0.05), behavior: 'auto' });
            },

            handle360Controls: function (x, y) {
                const now = performance.now();

                // Snap Rotation
                if (Math.abs(x) > 0.7 && now - this.rotateCooldown > 500) {
                    const rig = document.getElementById('camera-rig');
                    if (rig) {
                        const rot = rig.getAttribute('rotation');
                        rot.y += (x > 0 ? -45 : 45);
                        rig.setAttribute('rotation', rot);
                        this.rotateCooldown = now;
                    }
                }

                // Node Navigation
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