import { NodeSelectionStrategy } from "./NodeSelectionStrategy.js";

/**
 * --- CONCRETE STRATEGY: Maximal Independent Set (MIS) ---
 * A deterministic greedy approximation for mathematically optimal spacing.
 */
export class MaximalIndependentSetStrategy extends NodeSelectionStrategy {
    constructor(radius = 2) {
        super();
        this.radius = radius;
    }

    reset() { /* MIS is stateless */ }

    async isAnchor(nodeId, radar) {
        const myScore = await this._getScore(nodeId, radar);
        const neighborhood = await radar._getNeighborhood(nodeId, this.radius);
        
        for (const neighborId of neighborhood.keys()) {
            if (neighborId === nodeId) continue;
            const neighborScore = await this._getScore(neighborId, radar);
            if (neighborScore > myScore || (neighborScore === myScore && neighborId > nodeId)) {
                return false;
            }
        }
        return true;
    }

    async _getScore(id, radar) {
        const data = await radar._getNode(id);
        if (data?.links?.length <= 1) return Infinity; 
        return radar.hashNodeId(id);
    }
}
