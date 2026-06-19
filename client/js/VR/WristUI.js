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