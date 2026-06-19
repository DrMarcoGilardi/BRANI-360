export class InteractiveMap {
    /**
     * @method syncPOV
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