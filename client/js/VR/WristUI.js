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
 * Manages a wrist-mounted 3D UI panel for WebXR. 
 * Registers the 'wrist-ui' A-Frame component, rendering an interactive raycastable menu for exiting VR and toggling floating maps.
 *
 * ### Architecture
 * ```mermaid
 * classDiagram
 * class WristUI{
 * +register() void
 * }
 * ```
 * 
 * @class
 */
export class WristUI {
    /**
     * @method syncPOV
     * @memberof WristUI
     * @description Registers the 'wrist-ui' component with the global A-Frame registry. Should be called once before the scene initializes.
     * @static
     */
    static register() {
        if (typeof AFRAME === 'undefined' || AFRAME.components['wrist-ui']) {
            console.log(`[VR WRIST UI] AFRAME not initialised or component already registered`);
            return;
        }

        AFRAME.registerComponent('wrist-ui', {
            init: function () {
                this.menuContainer = document.createElement('a-entity');
                this.menuContainer.setAttribute('position', '0 0.05 0.1');
                this.menuContainer.setAttribute('rotation', '-90 0 0');
                this.menuContainer.setAttribute('scale', '1 1 1');

                const panel = document.createElement('a-entity');
                panel.setAttribute('geometry', 'primitive: plane; width: 0.18; height: 0.14');
                panel.setAttribute('material', 'color: #1a1a1a; shader: flat; transparent: true; opacity: 0.9');
                panel.setAttribute('position', '0 -0.03 0');
                this.menuContainer.appendChild(panel);

                const createButton = (label, color, yOffset, callback) => {
                    const btn = document.createElement('a-entity');
                    btn.setAttribute('geometry', 'primitive: plane; width: 0.15; height: 0.04');
                    btn.setAttribute('material', `color: ${color}; shader: flat`);
                    btn.setAttribute('position', `0 ${yOffset} 0.005`);
                    btn.classList.add('raycastable');

                    const text = document.createElement('a-text');
                    text.setAttribute('value', label);
                    text.setAttribute('align', 'center');
                    text.setAttribute('position', '0 0 0.001');
                    text.setAttribute('scale', '0.08 0.08 0.08');
                    btn.appendChild(text);

                    btn.addEventListener('click', () => {
                        btn.setAttribute('scale', '0.9 0.9 0.9');
                        setTimeout(() => btn.setAttribute('scale', '1 1 1'), 150);
                        callback();
                    });

                    btn.addEventListener('mouseenter', () => btn.setAttribute('material', 'opacity', '0.8'));
                    btn.addEventListener('mouseleave', () => btn.setAttribute('material', 'opacity', '1.0'));

                    return btn;
                };

                const exitBtn = createButton('EXIT VR', '#ff0055', 0, () => {
                    if (this.el.sceneEl) this.el.sceneEl.exitVR();
                });

                const mapBtn = createButton('TOGGLE MAP', '#00f0ff', -0.06, () => {
                    const mapWindow = document.getElementById('vr-floating-map');
                    if (mapWindow) {
                        const isVisible = mapWindow.getAttribute('visible');
                        mapWindow.setAttribute('visible', isVisible === false || isVisible === 'false' ? true : false);
                    }
                });

                this.menuContainer.appendChild(exitBtn);
                this.menuContainer.appendChild(mapBtn);
                this.el.appendChild(this.menuContainer);
            }
        });
    }
}