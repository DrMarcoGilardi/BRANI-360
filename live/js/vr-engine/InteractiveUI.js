/*
 * BRANI-360: An Agnostic Browser-Based Research Sandbox Architecture for AI Audio Generation on Networks of 360° Images
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
 * BRANI-360 is dual-licensed. The above AGPLv3 license applies to open-source 
 * and academic research use. If you wish to integrate this software into a 
 * closed-source or commercial application, you must obtain a proprietary 
 * commercial license. 
 * 
 * Please contact Marco.Gilardi@uws.ac.uk for commercial licensing details.
 * -------------------------------------------------------------------------
 */

/**
 * Bridges 3D WebXR raycast events to a 2D HTML5 Canvas.  
 * Registers the 'interactive-map' A-Frame component to allow users to interact with UI elements like the topology radar from within VR.
 *
 * ### Architecture
 * ```mermaid
 * classDiagram
 * class InteractiveMap{
 * +register() void
 * }
 * ```
 * 
 * @class
 */
// export class InteractiveUI {
//     static register() {
//         if (typeof AFRAME === 'undefined' || AFRAME.components['interactive-map']) return;

//         AFRAME.registerComponent('interactive-map', {
//             schema: { canvasId: { type: 'string', default: 'map-layer' } },

//             // init: function () {
//             //     this.canvas = null;
//             //     this.texture = null;
//             //     this.hasListener = false;
//             //     this.wasSuccessfullyBound = false;

//             //     this.el.setAttribute('visible', 'false');
//             //     this.lastWidth = 0;
//             //     this.lastHeight = 0;

//             //     this.bindCanvas = () => {
//             //         let targetElement = document.getElementById(this.data.canvasId);
//             //         if (!targetElement) return false;

//             //         // this.canvas = targetElement.tagName === 'CANVAS'
//             //         //     ? targetElement
//             //         //     : targetElement.querySelector('canvas');
//             //         if (targetElement.tagName === 'CANVAS') {
//             //             this.canvas = targetElement;
//             //         } else {
//             //             const canvases = Array.from(targetElement.querySelectorAll('canvas'));
//             //             const activeCanvases = canvases.filter(c => c.clientWidth > 0 && c.clientHeight > 0);
//             //             activeCanvases.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight));
//             //             this.canvas = activeCanvases.length > 0 ? activeCanvases[0] : null;
//             //         }

//             //         if (!this.canvas) return false;

//             //         if (this.canvas.clientWidth === 0 || this.canvas.clientHeight === 0 || this.canvas.width === 0) {
//             //             this.canvas = null;
//             //             return false;
//             //         }

//             //         this.texture = new AFRAME.THREE.CanvasTexture(this.canvas);
//             //         this.texture.generateMipmaps = false;
//             //         this.texture.minFilter = AFRAME.THREE.LinearFilter;

//             //         const mesh = this.el.getObject3D('mesh');
//             //         if (mesh && mesh.material) {
//             //             mesh.material.map = this.texture;
//             //             mesh.material.needsUpdate = true;
//             //         }

//             //         if (!this.hasListener) {
//             //             this.el.addEventListener('click', (evt) => {
//             //                 const isVisible = this.el.getAttribute('visible');
//             //                 if (isVisible === false || isVisible === 'false') return;

//             //                 if (!this.canvas) return;
//             //                 const intersection = evt.detail.intersection;
//             //                 if (!intersection) return;

//             //                 const uv = intersection.uv;
//             //                 const rect = this.canvas.getBoundingClientRect();

//             //                 const displayWidth = rect.width || this.canvas.width;
//             //                 const displayHeight = rect.height || this.canvas.height;
//             //                 const left = rect.left || 0;
//             //                 const top = rect.top || 0;

//             //                 const clientX = left + (uv.x * displayWidth);
//             //                 const clientY = top + ((1 - uv.y) * displayHeight);

//             //                 this.canvas.dispatchEvent(new MouseEvent('click', {
//             //                     view: window, bubbles: true, cancelable: true,
//             //                     clientX: clientX, clientY: clientY
//             //                 }));
//             //             });
//             //             this.hasListener = true;
//             //         }

//             //         if (!this.wasSuccessfullyBound) {
//             //             this.el.setAttribute('visible', 'true');
//             //             this.el.classList.add('raycastable');
//             //             this.wasSuccessfullyBound = true;
//             //         }

//             //         this.lastWidth = this.canvas.width;
//             //         this.lastHeight = this.canvas.height;

//             //         return true;
//             //     };
//             // },

//             // tick: function () {
//             //     if (this.canvas) {
//             //         if (!document.body.contains(this.canvas) || this.canvas.clientWidth === 0 || this.canvas.clientHeight === 0) {
//             //             if (this.texture) {
//             //                 this.texture.dispose();
//             //             }
//             //             this.texture = null;
//             //             this.canvas = null;
//             //         }
//             //     }

//             //     if (!this.texture || !this.canvas) {
//             //         this.bindCanvas();
//             //         return;
//             //     }

//             //     if (this.canvas.width === 0 || this.canvas.height === 0) return;

//             //     if (this.canvas.width !== this.lastWidth || this.canvas.height !== this.lastHeight) {
//             //         if (this.texture) this.texture.dispose();

//             //         this.texture = new AFRAME.THREE.CanvasTexture(this.canvas);
//             //         this.texture.generateMipmaps = false;
//             //         this.texture.minFilter = AFRAME.THREE.LinearFilter;

//             //         const mesh = this.el.getObject3D('mesh');
//             //         if (mesh && mesh.material) {
//             //             mesh.material.map = this.texture;
//             //             mesh.material.needsUpdate = true;
//             //         }

//             //         this.lastWidth = this.canvas.width;
//             //         this.lastHeight = this.canvas.height;
//             //     } else {
//             //         this.texture.needsUpdate = true;
//             //     }
//             // }

//             init: function () {
//                 this.canvas = null;
//                 this.texture = null;
//                 this.hasListener = false;
//                 this.wasSuccessfullyBound = false;

//                 this.renderBuffer = document.createElement('canvas');
//                 this.renderCtx = this.renderBuffer.getContext('2d', { willReadFrequently: true });

//                 this.el.setAttribute('visible', 'false');

//                 this.bindCanvas = () => {
//                     let targetElement = document.getElementById(this.data.canvasId);
//                     if (!targetElement) return false;

//                     if (targetElement.tagName === 'CANVAS') {
//                         this.canvas = targetElement;
//                     } else {
//                         const canvases = Array.from(targetElement.querySelectorAll('canvas'));

//                         const activeCanvases = canvases.filter(c => {
//                             if (c.clientWidth === 0 || c.clientHeight === 0) return false;
//                             let el = c;
//                             while (el && el !== document.body) {
//                                 const style = window.getComputedStyle(el);
//                                 if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
//                                 el = el.parentElement;
//                             }
//                             return true;
//                         });

//                         activeCanvases.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight));
//                         this.canvas = activeCanvases.length > 0 ? activeCanvases[0] : null;
//                     }

//                     if (!this.canvas) return false;

//                     if (!this.hasListener) {
//                         this.el.addEventListener('click', (evt) => {
//                             const isVisible = this.el.getAttribute('visible');
//                             if (isVisible === false || isVisible === 'false') return;
//                             if (!this.canvas) return;
//                             const intersection = evt.detail.intersection;
//                             if (!intersection) return;

//                             const uv = intersection.uv;
//                             const rect = this.canvas.getBoundingClientRect();
//                             const displayWidth = rect.width || this.canvas.clientWidth;
//                             const displayHeight = rect.height || this.canvas.clientHeight;
//                             const left = rect.left || 0;
//                             const top = rect.top || 0;

//                             const clientX = left + (uv.x * displayWidth);
//                             const clientY = top + ((1 - uv.y) * displayHeight);

//                             this.canvas.dispatchEvent(new MouseEvent('click', {
//                                 view: window, bubbles: true, cancelable: true,
//                                 clientX: clientX, clientY: clientY
//                             }));
//                         });
//                         this.hasListener = true;
//                     }

//                     if (!this.wasSuccessfullyBound) {
//                         this.el.setAttribute('visible', 'true');
//                         this.el.classList.add('raycastable');
//                         this.wasSuccessfullyBound = true;
//                     }

//                     return true;
//                 };
//             },

//             tick: function () {
//                 if (this.canvas) {
//                     let isHidden = this.canvas.clientWidth === 0 || this.canvas.clientHeight === 0;
//                     if (!isHidden && document.body.contains(this.canvas)) {
//                         let el = this.canvas;
//                         while (el && el !== document.body) {
//                             const style = window.getComputedStyle(el);
//                             if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
//                                 isHidden = true;
//                                 break;
//                             }
//                             el = el.parentElement;
//                         }
//                     }

//                     if (!document.body.contains(this.canvas) || isHidden) {
//                         if (this.texture) this.texture.dispose();
//                         this.texture = null;
//                         this.canvas = null;
//                     }
//                 }

//                 if (!this.texture || !this.canvas) {
//                     this.bindCanvas();
//                     return;
//                 }

//                 const targetWidth = this.canvas.clientWidth;
//                 const targetHeight = this.canvas.clientHeight;

//                 if (targetWidth === 0 || targetHeight === 0) return;

//                 if (this.renderBuffer.width !== targetWidth || this.renderBuffer.height !== targetHeight) {
//                     this.renderBuffer.width = targetWidth;
//                     this.renderBuffer.height = targetHeight;

//                     if (this.texture) this.texture.dispose();

//                     this.texture = new AFRAME.THREE.CanvasTexture(this.renderBuffer);
//                     this.texture.format = AFRAME.THREE.RGBAFormat;
//                     this.texture.unpackAlignment = 1;
//                     this.texture.generateMipmaps = false;
//                     this.texture.minFilter = AFRAME.THREE.LinearFilter;

//                     const mesh = this.el.getObject3D('mesh');
//                     if (mesh && mesh.material) {
//                         mesh.material.map = this.texture;
//                         mesh.material.needsUpdate = true;
//                     }
//                 }

//                 try {
//                     this.renderCtx.clearRect(0, 0, targetWidth, targetHeight);
//                     this.renderCtx.drawImage(this.canvas, 0, 0, targetWidth, targetHeight);
//                     this.texture.needsUpdate = true;
//                 } catch (e) {
//                 }
//             }
//         });
//     }
// }
export class InteractiveUI {
    static register() {
        if (typeof AFRAME === 'undefined' || AFRAME.components['interactive-map']) return;

        AFRAME.registerComponent('interactive-map', {
            schema: { canvasId: { type: 'string', default: 'map-layer' } },

            init: function () {
                this.canvas = null;
                this.referenceElement = null;
                this.texture = null;
                this.isDomMap = false;
                this.wasSuccessfullyBound = false;

                this.isDragging = false;
                this.currentRaycaster = null;
                this.lastX = 0;
                this.lastY = 0;

                this.renderBuffer = document.createElement('canvas');
                this.renderCtx = this.renderBuffer.getContext('2d', { willReadFrequently: true });

                this.el.setAttribute('visible', 'false');

                this.setupZoomControls();

                this.bindCanvas = () => {
                    let targetElement = document.getElementById(this.data.canvasId);
                    if (!targetElement) return false;

                    const canvases = Array.from(targetElement.querySelectorAll('canvas'));
                    const validCanvases = canvases.filter(c => c.clientWidth > 0 && c.clientHeight > 0 && getComputedStyle(c).display !== 'none');
                    validCanvases.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight));

                    const baseMesh = this.el.getObject3D('mesh');
                    let mainCanvas = null;

                    if (validCanvases.length > 0) {
                        const canvasArea = validCanvases[0].clientWidth * validCanvases[0].clientHeight;
                        const containerArea = targetElement.clientWidth * targetElement.clientHeight;
                        if (canvasArea >= containerArea * 0.75) mainCanvas = validCanvases[0];
                    }

                    if (mainCanvas) {
                        this.isDomMap = false;
                        this.canvas = mainCanvas;
                        this.referenceElement = targetElement;
                        if (baseMesh) baseMesh.visible = true;
                        if (this.el.hasAttribute('html')) this.el.removeAttribute('html');
                    } else {
                        this.isDomMap = true;
                        this.referenceElement = targetElement;
                        targetElement.style.opacity = '1';
                        if (getComputedStyle(targetElement).backgroundColor === 'rgba(0, 0, 0, 0)') {
                            targetElement.style.backgroundColor = '#141414';
                        }
                        if (baseMesh) baseMesh.visible = false;
                        if (!this.el.hasAttribute('html')) {
                            this.el.setAttribute('html', `html: #${this.data.canvasId}; fps: 15`);
                        }
                    }

                    this.attachEventTranslators();

                    if (!this.wasSuccessfullyBound) {
                        this.el.setAttribute('visible', 'true');
                        this.el.classList.add('raycastable');
                        this.wasSuccessfullyBound = true;
                    }

                    return true;
                };
            },

            attachEventTranslators: function () {
                if (this.hasListener) return;

                this.el.addEventListener('raycaster-intersected', (evt) => {
                    this.currentRaycaster = evt.detail.el;
                });

                this.el.addEventListener('raycaster-intersected-cleared', () => {
                    this.currentRaycaster = null;
                    if (this.isDragging) {
                        this.isDragging = false;
                        this.dispatchDOMEvent('pointerup', this.lastX, this.lastY);
                        this.dragTarget = null;
                    }
                });

                this.el.addEventListener('mousedown', (evt) => {
                    const coords = this.getCanvasCoords(evt.detail.intersection.uv);
                    if (!coords) return;
                    this.isDragging = true;
                    this.lastX = coords.x;
                    this.lastY = coords.y;
                    this.dragTarget = this.getActualTarget(coords.x, coords.y); // Lock Target
                    this.dispatchDOMEvent('pointerdown', coords.x, coords.y);
                });

                this.el.addEventListener('mouseup', (evt) => {
                    const coords = this.getCanvasCoords(evt.detail.intersection.uv);
                    if (!coords) return;
                    this.dispatchDOMEvent('pointerup', coords.x, coords.y);
                    this.dispatchDOMEvent('click', coords.x, coords.y);
                    this.isDragging = false;
                    this.dragTarget = null; // Release Target
                });

                this.hasListener = true;
            },

            setupZoomControls: function () {
                window.addEventListener('axismove', (evt) => {
                    if (!this.currentRaycaster || !this.wasSuccessfullyBound) return;

                    const thumbstickY = evt.detail.axis[1] || evt.detail.axis[3];
                    if (Math.abs(thumbstickY) > 0.1) {
                        const scrollDelta = thumbstickY * 50;
                        this.dispatchDOMEvent('wheel', this.lastX, this.lastY, { deltaY: scrollDelta });
                    }
                });
            },

            getCanvasCoords: function (uv) {
                const target = this.isDomMap ? this.referenceElement : this.canvas;
                if (!target || !uv) return null;

                const rect = target.getBoundingClientRect();
                const displayWidth = rect.width || target.clientWidth;
                const displayHeight = rect.height || target.clientHeight;

                return {
                    x: (rect.left || 0) + (uv.x * displayWidth),
                    y: (rect.top || 0) + ((1 - uv.y) * displayHeight)
                };
            },

            getActualTarget: function (x, y) {
                const target = this.isDomMap ? this.referenceElement : this.canvas;
                if (!target) return null;
                let actualTarget = target;
                const originalEvents = target.style.pointerEvents;
                target.style.pointerEvents = 'auto';
                const stack = document.elementsFromPoint(x, y);
                for (const el of stack) {
                    if (target.contains(el)) { actualTarget = el; break; }
                }
                target.style.pointerEvents = originalEvents;
                return actualTarget;
            },

            dispatchDOMEvent: function (type, x, y, extraProps = {}) {
                const actualTarget = (this.isDragging && this.dragTarget)
                    ? this.dragTarget
                    : this.getActualTarget(x, y);
                if (!actualTarget) return;
                const options = {
                    view: window, bubbles: true, cancelable: true,
                    clientX: x, clientY: y,
                    screenX: x, screenY: y,
                    button: 0, buttons: this.isDragging ? 1 : 0,
                    pointerId: 1, pointerType: 'mouse',
                    ...extraProps
                };
                if (type === 'wheel') {
                    actualTarget.dispatchEvent(new WheelEvent('wheel', options));
                } else if (type === 'click') {
                    actualTarget.dispatchEvent(new MouseEvent('click', options));
                } else {
                    actualTarget.dispatchEvent(new PointerEvent(type, options));
                    actualTarget.dispatchEvent(new MouseEvent(type.replace('pointer', 'mouse'), options));
                }
            },

            tick: function () {
                if (!this.wasSuccessfullyBound) {
                    this.bindCanvas();
                    return;
                }

                if (this.currentRaycaster && this.isDragging) {
                    const intersection = this.currentRaycaster.components.raycaster.getIntersection(this.el);
                    if (intersection && intersection.uv) {
                        const coords = this.getCanvasCoords(intersection.uv);

                        if (coords && (Math.abs(coords.x - this.lastX) > 0.5 || Math.abs(coords.y - this.lastY) > 0.5)) {
                            const movementX = coords.x - this.lastX;
                            const movementY = coords.y - this.lastY;

                            this.lastX = coords.x;
                            this.lastY = coords.y;

                            this.dispatchDOMEvent('pointermove', coords.x, coords.y, {
                                movementX: movementX,
                                movementY: movementY
                            });
                        }
                    }
                }

                if (this.isDomMap) return;

                if (this.canvas) {
                    const targetWidth = this.canvas.clientWidth;
                    const targetHeight = this.canvas.clientHeight;

                    if (targetWidth === 0 || targetHeight === 0) return;

                    if (this.renderBuffer.width !== targetWidth || this.renderBuffer.height !== targetHeight) {
                        this.renderBuffer.width = targetWidth;
                        this.renderBuffer.height = targetHeight;

                        if (this.texture) this.texture.dispose();

                        this.texture = new AFRAME.THREE.CanvasTexture(this.renderBuffer);
                        this.texture.generateMipmaps = false;
                        this.texture.minFilter = AFRAME.THREE.LinearFilter;

                        const mesh = this.el.getObject3D('mesh');
                        if (mesh && mesh.material) {
                            mesh.material.map = this.texture;
                            mesh.material.needsUpdate = true;
                        }
                    }

                    try {
                        this.renderCtx.clearRect(0, 0, targetWidth, targetHeight);
                        this.renderCtx.drawImage(this.canvas, 0, 0, targetWidth, targetHeight);
                        this.texture.needsUpdate = true;
                    } catch (e) { }
                }
            }
        });
    }
}