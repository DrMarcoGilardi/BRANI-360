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
 * A standalone 2D physics engine using force-directed graph algorithms to dynamically layout and arrange nodes and their text labels.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * class Physics2D{
 * +container HTMLElement
 * +nodes Array
 * +edges Array
 * +nodeSize number
 * +isRunning boolean
 * +start() void
 * +stop() void
 * -_normalizeVector(x, y) Object
 * -_calculateLabelOffset(nx, ny, labelWidth, labelHeight, nodeRadius) number
 * -_run() void
 * }
 * ```
 * 
 * @class
 */
export class Physics2D {
    /**
     * @constructor
     * @param {HTMLElement} container - The DOM element bounding the physics simulation.
     * @param {Array<Object>} nodes - The array of graph node objects to simulate.
     * @param {Array<Object>} edges - The array of graph edge (link) objects.
     * @param {number} [nodeSize=100] - The pixel dimension of the nodes used to scale forces.
     */
    constructor(container, nodes, edges, nodeSize = 100) {
        this.container = container;
        this.nodes = nodes;
        this.edges = edges;
        this.nodeSize = nodeSize;
        this.nodeRadius = nodeSize / 2;

        this.physicsLoop = null;
        this.isRunning = false;

        this.repulsion = 40000 * (nodeSize / 100);
        this.springDist = Math.max(150, nodeSize * 2);
        this.springForce = 0.05;
        this.gravity = 0.001;
        this.damping = .5;

        this.repulsionThreshold = Math.max(300, nodeSize * 3);
        this.labelAvoidanceThreshold = Math.max(200, nodeSize * 2);
    }

    /**
     * @method start
     * @memberof Physics2D
     * @description Wakes up the physics engine and starts the requestAnimationFrame loop.
     * @returns {void}
     */
    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this._run();
        }
    }

    /**
     * @method stop
     * @memberof Physics2D
     * @description Halts the physics simulation loop and clears pending animation frames.
     * @returns {void}
     */
    stop() {
        this.isRunning = false;
        if (this.physicsLoop) {
            cancelAnimationFrame(this.physicsLoop);
            this.physicsLoop = null;
        }
    }

    /**
     * @method _normalizeVector
     * @memberof Physics2D
     * @description Normalizes a 2D vector to a length of 1.
     * @param {number} x - The x component.
     * @param {number} y - The y component.
     * @returns {Object} An object containing the normalized nx and ny components.
     * @private
     */
    _normalizeVector(x, y) {
        const len = Math.sqrt(x * x + y * y) || 1;
        return { nx: x / len, ny: y / len };
    }

    /**
     * @method _calculateLabelOffset
     * @memberof Physics2D
     * @description Calculates the exact displacement distance needed to prevent a rectangular label from overlapping a circular node using Minkowski Sum collision math.
     * @param {number} nx - Normalized X direction vector.
     * @param {number} ny - Normalized Y direction vector.
     * @param {number} [labelWidth=150] - Pixel width of the text label.
     * @param {number} [labelHeight=30] - Pixel height of the text label.
     * @param {number} [nodeRadius=65] - Target radius collision boundary.
     * @returns {number} The distance (t) to push the label center along the vector.
     * @private
     */
    _calculateLabelOffset(nx, ny, labelWidth = 150, labelHeight = 30, nodeRadius = 65) {
        const w = labelWidth / 2;
        const h = labelHeight / 2;

        const absNx = Math.abs(nx);
        const absNy = Math.abs(ny) || 0.0001;
        const safeNx = absNx || 0.0001;

        const t1 = (nodeRadius + h) / absNy;

        if (t1 * absNx <= w) return t1;

        const t2 = (nodeRadius + w) / safeNx;
        if (t2 * absNy <= h) return t2;

        const B = -2 * (absNx * w + absNy * h);
        const C = (w * w) + (h * h) - (nodeRadius * nodeRadius);
        return (-B + Math.sqrt((B * B) - (4 * C))) / 2;
    }

    /**
     * @method _run
     * @memberof Physics2D
     * @description The core internal physics loop applying repulsion, spring forces, gravity, and label avoidance algorithms. Recursively calls requestAnimationFrame.
     * @returns {void}
     * @private
     */
    _run() {
        if (!this.isRunning) return;

        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;
        const center = { x: width / 2, y: height / 2 };

        // 1. Repulsion
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const n1 = this.nodes[i];
                const n2 = this.nodes[j];
                const dx = n1.x - n2.x;
                const dy = n1.y - n2.y;
                let dist = Math.sqrt(dx * dx + dy * dy) || 1;

                if (dist < this.repulsionThreshold) {
                    const force = this.repulsion / (dist * dist);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    if (!n1.isDragging) { n1.vx += fx; n1.vy += fy; }
                    if (!n2.isDragging) { n2.vx -= fx; n2.vy -= fy; }
                }
            }
        }

        // 2. Spring Force
        this.edges.forEach(edge => {
            const dx = edge.target.x - edge.source.x;
            const dy = edge.target.y - edge.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (dist - this.springDist) * this.springForce;

            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!edge.source.isDragging) { edge.source.vx += fx; edge.source.vy += fy; }
            if (!edge.target.isDragging) { edge.target.vx -= fx; edge.target.vy -= fy; }
        });

        let totalMovement = 0;

        // 3. Apply velocities and compute dynamic label placements
        this.nodes.forEach(node => {
            if (!node.isDragging) {
                node.vx += (center.x - node.x) * this.gravity;
                node.vy += (center.y - node.y) * this.gravity;
                node.vx *= this.damping;
                node.vy *= this.damping;
                node.x += node.vx;
                node.y += node.vy;
                totalMovement += Math.abs(node.vx) + Math.abs(node.vy);
            }

            // Label Positioning Vector Math
            let rx = 0;
            let ry = 20;

            node.neighbors.forEach(neighbor => {
                const dx = neighbor.x - node.x;
                const dy = neighbor.y - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                rx -= (dx / dist) * this.nodeSize;
                ry -= (dy / dist) * this.nodeSize;
            });

            this.nodes.forEach(otherNode => {
                if (node === otherNode) return;
                const dx = otherNode.x - node.x;
                const dy = otherNode.y - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                if (dist < this.labelAvoidanceThreshold) {
                    const force = (this.labelAvoidanceThreshold - dist);
                    rx -= (dx / dist) * force;
                    ry -= (dy / dist) * force;
                }
            });

            const targetLen = Math.sqrt(rx * rx + ry * ry) || 1;
            node.lx += ((rx / targetLen) - node.lx) * 0.15;
            node.ly += ((ry / targetLen) - node.ly) * 0.15;

            // 4. Update DOM Elements
            const { nx, ny } = this._normalizeVector(node.lx, node.ly);

            node.el.style.left = `${node.x}px`;
            node.el.style.top = `${node.y}px`;

            if (!node.labelWidth && node.labelEl.offsetWidth) {
                node.labelWidth = node.labelEl.offsetWidth;
                node.labelHeight = node.labelEl.offsetHeight;
            }

            // Provide the dynamic nodeRadius to the Minkowski Sum collision calculation (+15px gap)
            const t = this._calculateLabelOffset(nx, ny, node.labelWidth, node.labelHeight, this.nodeRadius + 15);

            node.labelEl.style.left = `${node.x}px`;
            node.labelEl.style.top = `${node.y}px`;
            node.labelEl.style.transform = `translate(calc(-50% + ${nx * t}px), calc(-50% + ${ny * t}px))`;
        });

        this.edges.forEach(edge => {
            edge.el.setAttribute('x1', edge.source.x);
            edge.el.setAttribute('y1', edge.source.y);
            edge.el.setAttribute('x2', edge.target.x);
            edge.el.setAttribute('y2', edge.target.y);
        });

        // Sleep Optimization
        if (totalMovement > 0.5 || this.nodes.some(n => n.isDragging)) {
            this.physicsLoop = requestAnimationFrame(() => this._run());
        } else {
            this.isRunning = false;
        }
    }
}