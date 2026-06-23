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

import { UIManager } from './UIManager.js';
import { SpatialAudioPlayer } from './SpatialAudioPlayer.js';
import { VRSceneController } from './vr/VRSceneController.js';
import { AcousticTreadmill } from './AcousticTreadmill.js';
import { NetworkService } from './NetworkService.js';
import { NavigationManager } from './NavigationManager.js';
import { TopologyRadar } from './TopologyRadar.js';

const ZROK_UNIQUE_NAME = "uwscct"; // <--- Set the unique name you created in zrok here!
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'; //<-- detects whether the software is running locally
const urlParams = new URLSearchParams(window.location.search);
const nodeToken = urlParams.get('token') || ZROK_UNIQUE_NAME; // <--- Looks for the random zrok token in the url, if not provided it defaults to the unique name
const tunnel = urlParams.get('tunnel');
const TUNNEL_URL = isLocalhost ? 'http://localhost:3000' :
    tunnel ? tunnel :
        (nodeToken && nodeToken !== "ZROK_UNIQUE_NAME") ? `https://${nodeToken}.shares.zrok.io` : //<--- If not custon tunnel is provided it defaults to a zrok tunnel
            (() => {
                const errorMsg = "ABBA-360 Error: No valid backend connection found. Please set your ZROK_UNIQUE_NAME_HERE, provide a ?tunnel= URL parameter, or use a ?token= parameter.";
                console.error(errorMsg);
                throw new Error(errorMsg); //<--- If neither token or unique name are set then it throws an error
            })();

const networkService = new NetworkService(TUNNEL_URL);

/**
 * @async
 * @function bootstrap
 * @description Main application bootstrap (Dependency Injection Root). Fully Agnostic Injection handler. Fetches configuration from the server and imports requested strategy patterns dynamically over the network.
 * @returns {Promise<void>}
 */
async function bootstrap() {
    const ui = new UIManager();
    let config = null;

    while (!config) {
        try {
            ui.statusEl.innerHTML = '<span class="pulse"></span>HW: WAITING FOR SERVER...';
            const configResponse = await fetch(`${TUNNEL_URL}/api/config`);
            if (configResponse.ok) {
                config = await configResponse.json();
                ui.statusEl.innerHTML = '<span class="pulse"></span>HW: CONFIG ACQUIRED...';
            } else throw new Error();
        } catch (e) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    try {
        console.log(config);
        // --- DYNAMIC AGNOSTIC STRATEGY INJECTION --
        const {
            viewerProvider: vName,
            topologyProvider: tName,
            nodeSelectionStrategy: nName,
            semanticProvider: sName,
            vrLoaderProvider: vrName,
            semanticLayers,
        } = config.clientStrategies;

        ui.statusEl.innerHTML = '<span class="pulse"></span>HW: LOADING CLIENT STRATEGIES...';

        // Dynamically fetch the requested JS modules over the network
        const [ViewerMod, TopologyMod, SelectionMod, SemanticMod, VRLoaderMod] = await Promise.all([
            import(`./strategies/viewproviders/${vName}.js`),
            import(`./strategies/topologyproviders/${tName}.js`),
            import(`./strategies/nodeselectionstrategies/${nName}.js`),
            import(`./strategies/semanticproviders/${sName}.js`),
            import(`./strategies/vrproviders/${vrName}.js`)
        ]);

        // Extract the classes blindly
        const ViewerClass = ViewerMod[vName];
        const TopologyClass = TopologyMod[tName];
        const SelectionClass = SelectionMod[nName];
        const SemanticClass = SemanticMod[sName];
        const VRLoaderClass = VRLoaderMod[vrName];

        if (!ViewerClass || !TopologyClass || !SelectionClass || !SemanticClass || !VRLoaderClass) {
            throw new Error("Failed to extract client strategy classes. Ensure export names match .env names.");
        }

        // Instantiate based on the base contracts
        const viewerProvider = new ViewerClass("map-layer", config.key);
        const semanticProvider = new SemanticClass(semanticLayers);

        const player = new SpatialAudioPlayer(config, semanticProvider);
        const treadmill = new AcousticTreadmill(player, ui, semanticProvider, config);

        const topologyProvider = new TopologyClass(config.key);
        const nodeSelectionStrategy = new SelectionClass(config);
        const radar = new TopologyRadar(topologyProvider, nodeSelectionStrategy);

        const vrLoaderProvider = new VRLoaderClass(config.key);
        const vrSceneController = new VRSceneController(ui, vrLoaderProvider);


        const navManager = new NavigationManager(viewerProvider, radar, networkService, ui, player, treadmill, vrSceneController, semanticProvider);

        networkService.init(ui, player, vrSceneController, treadmill, navManager, semanticProvider);

        const originalClear = player.clearSpatialObjects.bind(player);
        player.clearSpatialObjects = () => {
            originalClear();
            vrSceneController.clearSpatialSources();
        };

        const originalPlay = player.playObjectSound.bind(player);
        player.playObjectSound = (data) => {
            if (data.navEpoch !== undefined && data.navEpoch < networkService.getEpoch()) return;
            const targetId = data.nodeId;
            if (targetId && targetId !== navManager.currentNodeId) return;
            originalPlay(data);
        };


        ui.onMuteToggle((id, isObject) => {
            if (isObject) return player.toggleMuteObject(id);
            // Renamed to target persistent layers agnostically
            const isMuted = player.toggleMutePersistent(id);
            treadmill.refreshMix(navManager.currentNodeId, navManager.currentIsAnchor, navManager.currentNearbyAnchors, radar);
            return isMuted;
        });

        ui.onRegenToggle((taskData, feedbackData) => {
            networkService.emitRegen(taskData, feedbackData);
            // Rely on the server's 'persistent' boolean, not the word 'ambient'
            if (!taskData.persistent) player.stopObjectSound(taskData.label || taskData.id);
        });

        ui.xrBtn.innerText = "ENTER VR";
        ui.showStartButton(async () => {
            const nodeId = navManager.currentNodeId;

            if (!nodeId) {
                console.warn("[Boot] VR Entry blocked: Map has not initialized a location yet.");
                ui.showXrButton();
                return;
            }

            const nodeData = await radar._getNode(nodeId);
            vrSceneController.enterVR(nodeId, nodeData?.links || []);
        });

        window.addEventListener('mousedown', () => vrSceneController.ensureAudioContext(), { capture: true });
        window.addEventListener('touchstart', () => vrSceneController.ensureAudioContext(), { capture: true });

    } catch (e) {
        console.error("[Boot Error]", e);
        ui.statusEl.innerText = "HW: BOOT SEQUENCE FAILED";
    }
}

window.onload = bootstrap;