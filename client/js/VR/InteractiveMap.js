/*
 * ABBA-360: An Agnostic Browser-Based Research Sandbox Architecture for AI Audio Generation on Networks of 360° Images
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
 * ABBA-360 is dual-licensed. The above AGPLv3 license applies to open-source 
 * and academic research use. If you wish to integrate this software into a 
 * closed-source or commercial application, you must obtain a proprietary 
 * commercial license. 
 * 
 * Please contact Marco.Gilardi@uws.ac.uk for commercial licensing details.
 * -------------------------------------------------------------------------
 */

/**
 * @class InteractiveMap
 * @description Bridges 3D WebXR raycast events to a 2D HTML5 Canvas. Registers the 'interactive-map' A-Frame component to allow users to interact with UI elements like the topology radar from within VR.
 *
 * ### Architecture
 * ```mermaid
 * classDiagram
 * class InteractiveMap{
 * +register() void
 * }
 * ```
 */
export class InteractiveMap {
    /**
     * @method register
     * @memberof InteractiveMap
     * @description Registers the 'interactive-map' component with the global A-Frame registry. Should be called once before the scene initializes.
     */
    static register() {
        if (typeof AFRAME === 'undefined' || AFRAME.components['interactive-map']) {
            return;
        }

        AFRAME.registerComponent('interactive-map', {
            schema: {
                canvasId: { type: 'string', default: 'radar-canvas' } // Can point to the Radar or MapLibre canvas
            },

            init: function () {
                this.canvas = document.getElementById(this.data.canvasId);
                if (!this.canvas) return;
                this.texture = new AFRAME.THREE.CanvasTexture(this.canvas);
                this.el.getObject3D('mesh').material.map = this.texture;

                this.el.addEventListener('click', (evt) => {
                    const intersection = evt.detail.intersection;
                    if (!intersection) return;

                    const uv = intersection.uv;

                    const rect = this.canvas.getBoundingClientRect();
                    const clientX = rect.left + (uv.x * rect.width);

                    const clientY = rect.top + ((1 - uv.y) * rect.height);

                    const clickEvent = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                        clientX: clientX,
                        clientY: clientY
                    });
                    this.canvas.dispatchEvent(clickEvent);
                });
            },

            tick: function () {
                if (this.texture) {
                    this.texture.needsUpdate = true;
                }
            }
        });
    }
}