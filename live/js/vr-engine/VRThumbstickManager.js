export class VRThumbstickManager {
    static register() {
        if (typeof AFRAME === 'undefined' || AFRAME.components['contextual-thumbsticks']) return;

        AFRAME.registerComponent('contextual-thumbsticks', {
            init: function () {
                this.currentFocus = '360';
                this.navCooldown = 0;
                this.rotateCooldown = 0;
                this.lastPanTime = 0;

                // Debug timer to prevent console flooding
                this.debugTimer = 0;

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

            // Polling loop runs at your headset's framerate (72Hz - 120Hz)
            tick: function (time, timeDelta) {
                // Find controllers regardless of whether you used hyphens or camelCase in index.html
                const leftHand = document.querySelector('#left-hand') || document.querySelector('#leftHand');
                const rightHand = document.querySelector('#right-hand') || document.querySelector('#rightHand');

                this.pollHand(leftHand, 'left', time, timeDelta);
                this.pollHand(rightHand, 'right', time, timeDelta);
            },

            pollHand: function (handEl, handName, time, timeDelta) {
                if (!handEl) return;

                // A-Frame auto-injects 'tracked-controls' under the hood for all VR controllers.
                // We directly hijack its internal axis array.
                const tracked = handEl.components['tracked-controls'] || handEl.components['tracked-controls-webxr'];
                if (!tracked || !tracked.axis || tracked.axis.length === 0) return;

                const axes = tracked.axis;

                // --- HARDWARE RADAR ---
                // Proves we have a pulse. If an axis moves past 10%, log it twice a second.
                if (time - this.debugTimer > 500) {
                    for (let i = 0; i < axes.length; i++) {
                        if (Math.abs(axes[i]) > 0.1) {
                            console.log(`[A-Frame Hardware] ${handName} axis[${i}] = ${axes[i].toFixed(2)}`);
                            this.debugTimer = time;
                        }
                    }
                }

                // Map standard WebXR axes (Meta Quest)
                let x = axes.length >= 4 ? axes[2] : axes[0];
                let y = axes.length >= 4 ? axes[3] : axes[1];

                // Map Emulator / Google Cardboard fallback
                if (axes.length >= 2 && Math.abs(axes[0]) > 0.25 && Math.abs(x) < 0.1) x = axes[0];
                if (axes.length >= 2 && Math.abs(axes[1]) > 0.25 && Math.abs(y) < 0.1) y = axes[1];

                if (x === undefined) x = 0;
                if (y === undefined) y = 0;

                // If thumbstick is pushed past 25% deadzone, process it
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
                const mapCanvas = document.querySelector('#map-layer');
                if (!mapCanvas) return;

                if (hand === 'right' && Math.abs(y) > 0.25) {
                    // timeDelta ensures zoom speed is identical on a 72Hz Quest and a 120Hz Quest
                    const scrollDelta = y * (timeDelta * 0.1);
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

            handleHudControls: function (y, timeDelta) {
                const hudContainer = document.querySelector('#hud');
                if (!hudContainer) return;
                hudContainer.scrollBy({ top: y * (timeDelta * 0.05), behavior: 'auto' });
            },

            handle360Controls: function (x, y) {
                const now = performance.now();

                // Snap Rotation (Left/Right)
                if (Math.abs(x) > 0.7 && now - this.rotateCooldown > 500) {
                    const rig = document.getElementById('camera-rig') || document.getElementById('rig');
                    if (rig) {
                        const rot = rig.getAttribute('rotation');
                        rot.y += (x > 0 ? -45 : 45);
                        rig.setAttribute('rotation', rot);
                        this.rotateCooldown = now;
                    }
                }

                // Node Navigation (Forward/Back)
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