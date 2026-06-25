// /*
//  * ABBA-360: An Agnostic Browser-Based Research Sandbox Architecture for AI Audio Generation on Networks of 360° Images
//  * Copyright (C) 2026 Dr Marco Gilardi, University of the West of Scotland.
//  * 
//  * This program is free software: you can redistribute it and/or modify
//  * it under the terms of the GNU Affero General Public License as published
//  * by the Free Software Foundation, either version 3 of the License, or
//  * (at your option) any later version.
//  * 
//  * This program is distributed in the hope that it will be useful,
//  * but WITHOUT ANY WARRANTY; without even the implied warranty of
//  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  * GNU Affero General Public License for more details.
//  * 
//  * You should have received a copy of the GNU Affero General Public License
//  * along with this program.  If not, see <https://www.gnu.org/licenses/>.
//  * 
//  * -------------------------------------------------------------------------
//  * COMMERCIAL LICENSING
//  * ABBA-360 is dual-licensed. The above AGPLv3 license applies to open-source 
//  * and academic research use. If you wish to integrate this software into a 
//  * closed-source or commercial application, you must obtain a proprietary 
//  * commercial license. 
//  * 
//  * Please contact Marco.Gilardi@uws.ac.uk for commercial licensing details.
//  * -------------------------------------------------------------------------
//  */

// /**
//  * Bridges 3D WebXR raycast events to a 2D HTML5 Canvas.  
//  * Registers the 'interactive-map' A-Frame component to allow users to interact with UI elements like the topology radar from within VR.
//  *
//  * ### Architecture
//  * ```mermaid
//  * classDiagram
//  * class InteractiveMap{
//  * +register() void
//  * }
//  * ```
//  * 
//  * @class
//  */
// export class InteractiveMap {
//     static register() {
//         if (typeof AFRAME === 'undefined' || AFRAME.components['interactive-map']) return;

//         AFRAME.registerComponent('interactive-map', {
//             schema: { canvasId: { type: 'string', default: 'map-layer' } },

//             init: function () {
//                 this.hasListener = false;

//                 this.bindCanvas = () => {
//                     let targetElement = document.getElementById(this.data.canvasId);
//                     if (!targetElement) return false;

//                     // RESTORED: Check if it's a DIV and find the canvas inside
//                     if (targetElement.tagName !== 'CANVAS') {
//                         this.canvas = targetElement.querySelector('canvas');
//                     } else {
//                         this.canvas = targetElement;
//                     }

//                     if (!this.canvas) return false;

//                     this.texture = new AFRAME.THREE.CanvasTexture(this.canvas);
//                     this.el.getObject3D('mesh').material.map = this.texture;

//                     if (!this.hasListener) {
//                         this.el.addEventListener('click', (evt) => {
//                             const intersection = evt.detail.intersection;
//                             if (!intersection) return;
//                             const uv = intersection.uv;
//                             const rect = this.canvas.getBoundingClientRect();
//                             const clientX = rect.left + (uv.x * rect.width);
//                             const clientY = rect.top + ((1 - uv.y) * rect.height);
//                             this.canvas.dispatchEvent(new MouseEvent('click', {
//                                 view: window, bubbles: true, cancelable: true,
//                                 clientX: clientX, clientY: clientY
//                             }));
//                         });
//                         this.hasListener = true;
//                     }
//                     return true;
//                 };

//                 this.bindCanvas();
//             },

//             tick: function () {
//                 if (!this.texture) {
//                     this.bindCanvas();
//                 } else {
//                     this.texture.needsUpdate = true;
//                 }
//             }
//         });
//     }
// }

export class InteractiveMap {
    static register() {
        if (typeof AFRAME === 'undefined' || AFRAME.components['interactive-map']) return;

        AFRAME.registerComponent('interactive-map', {
            schema: { canvasId: { type: 'string', default: 'map-layer' } },

            init: function () {
                this.canvas = null;
                this.texture = null;
                this.hasListener = false;
                this.wasSuccessfullyBound = false;

                this.el.setAttribute('visible', 'false');
                this.lastWidth = 0;
                this.lastHeight = 0;

                this.bindCanvas = () => {
                    let targetElement = document.getElementById(this.data.canvasId);
                    if (!targetElement) return false;

                    this.canvas = targetElement.tagName === 'CANVAS'
                        ? targetElement
                        : targetElement.querySelector('canvas');

                    if (!this.canvas) return false;

                    if (this.canvas.clientWidth === 0 || this.canvas.clientHeight === 0 || this.canvas.width === 0) {
                        this.canvas = null;
                        return false;
                    }

                    this.texture = new AFRAME.THREE.CanvasTexture(this.canvas);
                    this.texture.generateMipmaps = false;
                    this.texture.minFilter = AFRAME.THREE.LinearFilter;

                    const mesh = this.el.getObject3D('mesh');
                    if (mesh && mesh.material) {
                        mesh.material.map = this.texture;
                        mesh.material.needsUpdate = true;
                    }

                    if (!this.hasListener) {
                        this.el.addEventListener('click', (evt) => {
                            if (!this.canvas) return;
                            const intersection = evt.detail.intersection;
                            if (!intersection) return;

                            const uv = intersection.uv;
                            const rect = this.canvas.getBoundingClientRect();

                            const displayWidth = rect.width || this.canvas.width;
                            const displayHeight = rect.height || this.canvas.height;
                            const left = rect.left || 0;
                            const top = rect.top || 0;

                            const clientX = left + (uv.x * displayWidth);
                            const clientY = top + ((1 - uv.y) * displayHeight);

                            this.canvas.dispatchEvent(new MouseEvent('click', {
                                view: window, bubbles: true, cancelable: true,
                                clientX: clientX, clientY: clientY
                            }));
                        });
                        this.hasListener = true;
                    }

                    if (!this.wasSuccessfullyBound) {
                        this.el.setAttribute('visible', 'true');
                        this.wasSuccessfullyBound = true;
                    }

                    this.lastWidth = this.canvas.width;
                    this.lastHeight = this.canvas.height;

                    return true;
                };
            },

            tick: function () {
                if (this.canvas && !document.body.contains(this.canvas)) {
                    if (this.texture) {
                        this.texture.dispose();
                    }
                    this.texture = null;
                    this.canvas = null;
                }

                if (!this.texture || !this.canvas) {
                    this.bindCanvas();
                    return;
                }

                if (this.canvas.width === 0 || this.canvas.height === 0) return;

                if (this.canvas.width !== this.lastWidth || this.canvas.height !== this.lastHeight) {
                    if (this.texture) this.texture.dispose();

                    this.texture = new AFRAME.THREE.CanvasTexture(this.canvas);
                    this.texture.generateMipmaps = false;
                    this.texture.minFilter = AFRAME.THREE.LinearFilter;

                    const mesh = this.el.getObject3D('mesh');
                    if (mesh && mesh.material) {
                        mesh.material.map = this.texture;
                        mesh.material.needsUpdate = true;
                    }

                    this.lastWidth = this.canvas.width;
                    this.lastHeight = this.canvas.height;
                } else {
                    this.texture.needsUpdate = true;
                }
            }
        });
    }
}