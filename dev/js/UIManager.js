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
 * Handles all 2D overlays, HUD elements, and the Radar graph visualization.  
 * Completely Provider Agnostic.  
 * Styles are driven by topological context.
 * 
 * * ### Architecture
 * ```mermaid
 * classDiagram
 * UIManager <-- NetworkService : Updates HUD
 * UIManager <-- NavigationManager : Triggers Graph Updates
 * UIManager <-- AcousticTreadmill : Updates Background Progress
 * class UIManager{
 * +isHudVisible boolean
 * +isRadarVisible boolean
 * +initToggleControls()
 * +toggleHud()
 * +toggleRadar()
 * +toggleMasterMute(btn)
 * +getAlias(nodeId, isAnchor) string
 * +setConnectionStatus(isConnected, socketId)
 * +setNodeInfo(nodeId, isAnchor)
 * +resetPipeline()
 * +updatePipelineProgress(id, stage, progressPercentage, isObject, isAnchor, isBackgroundNode, displayName, taskData)
 * +drawRadarGraph(graphData, currentNodeId)
 * +onMuteToggle(callback)
 * +onRegenToggle(callback)
 * +showStartButton(onClickCallback)
 * +setEngineVisibility(isVisible)
 * +showXrButton()
 * }
 * ```
 * 
 * @class
 */
export class UIManager {
    /** 
     * @constructor
     */
    constructor() {
        this.statusEl = document.getElementById('status');
        this.progressContainer = document.getElementById('progress-container');
        this.xrBtn = document.getElementById('xr-btn');
        this.vrEngine = document.getElementById('vr-engine');
        this.hudEl = document.getElementById('hud');

        this.taskElements = new Map();
        this.muteCallback = null;
        this.regenCallback = null;

        this.isHudVisible = true;
        this.isRadarVisible = true;

        this.aliasMap = new Map();
        this.anchorCounter = 1;
        this.standardCounter = 1;

        this.isEnteringVR = false;

        this._styleXrButton();
        this._bindPropagationGuards();
        this.initToggleControls();

        this.isXRHudVisible = true;
        this.isXRRadarVisible = true;
        document.addEventListener('vr:custom_ui_action', (event) => {
            if (event.detail.actionName === 'toggle-ui') {
                this.toggleVRHud();
            }
        });
    }

    toggleVRHud() {
        this.isXRHudVisible = !this.isXRHudVisible;
        const vrHud = document.getElementById('vr-camera-hud');
        if (vrHud) {
            vrHud.setAttribute('visible', this.isXRHudVisible);
        }
    }

    triggerVRHudSync() {
        const hud = document.getElementById('hud');
        if (hud) {
            let ticker = document.getElementById('htmlmesh-ticker');
            if (!ticker) {
                ticker = document.createElement('div');
                ticker.id = 'htmlmesh-ticker';
                ticker.style.opacity = '0.01';
                ticker.style.position = 'absolute';
                ticker.style.pointerEvents = 'none';
                hud.appendChild(ticker);
            }
            ticker.innerText = Date.now().toString();
        }
    }

    /** 
     * @method initToggleControls
     * @memberof UIManager
     * @description Initializes HUD and Radar toggle buttons/hotkeys. 
     */
    initToggleControls() {
        const toggleContainer = document.createElement('div');
        toggleContainer.id = 'ui-toggle-container';
        Object.assign(toggleContainer.style, {
            position: 'fixed', top: '20px', right: '20px', zIndex: '9999',
            display: 'flex', gap: '10px', pointerEvents: 'auto'
        });

        this.hudToggleBtn = document.createElement('button');
        this.setupToggleButton(this.hudToggleBtn, 'HUD', this.isHudVisible);
        this.hudToggleBtn.onclick = (e) => { e.stopPropagation(); this.toggleHud(); };

        this.radarToggleBtn = document.createElement('button');
        this.setupToggleButton(this.radarToggleBtn, 'RADAR', this.isRadarVisible);
        this.radarToggleBtn.onclick = (e) => { e.stopPropagation(); this.toggleRadar(); };

        toggleContainer.appendChild(this.hudToggleBtn);
        toggleContainer.appendChild(this.radarToggleBtn);
        document.body.appendChild(toggleContainer);

        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key.toLowerCase() === 'h') this.toggleHud();
            if (e.key.toLowerCase() === 'r') this.toggleRadar();
        });
    }

    /** 
     * @method toggleHud
     * @memberof UIManager
     * @description Toggles visibility of the main Pipeline HUD. 
     */
    toggleHud() {
        this.isHudVisible = !this.isHudVisible;
        if (this.hudEl) {
            this.hudEl.style.opacity = this.isHudVisible ? '1' : '0';
            this.hudEl.style.pointerEvents = this.isHudVisible ? 'auto' : 'none';
            // this.hudEl.style.display = this.isHudVisible ? '' : 'none';
        }
        this.updateToggleButton(this.hudToggleBtn, 'HUD', this.isHudVisible);
    }

    /** 
     * @method toggleRadar
     * @memberof UIManager
     * @description Toggles visibility of the acoustic Radar visualization. 
     */
    toggleRadar() {
        this.isRadarVisible = !this.isRadarVisible;
        const radarContainer = document.getElementById('radar-container');
        if (radarContainer) {
            radarContainer.style.display = 'block';
            // radarContainer.style.left = this.isRadarVisible ? '20px' : '-9999px';
        }
        this.updateToggleButton(this.radarToggleBtn, 'RADAR', this.isRadarVisible);
    }

    /**
     * @method toggleMasterMute
     * @memberof UIManager
     * @description Toggles global master mute state across all active layers.
     * @param {HTMLButtonElement} btn - The mute button element.
     */
    toggleMasterMute(btn) {
        this.isMasterMuted = !this.isMasterMuted;
        btn.innerText = this.isMasterMuted ? 'UNMUTE ALL' : 'MUTE ALL';
        btn.style.color = this.isMasterMuted ? '#ff0055' : '#00ffaa';
        btn.style.borderColor = this.isMasterMuted ? '#ff0055' : '#00ffaa';

        // Loop through all currently rendered tasks and click their mute buttons if needed
        this.taskElements.forEach((el) => {
            const muteBtn = el.querySelector('.mute-btn');
            if (muteBtn && muteBtn.style.display !== 'none') {
                const isCurrentlyMuted = muteBtn.innerText === 'UNMUTE';
                if (isCurrentlyMuted !== this.isMasterMuted) {
                    muteBtn.click();
                }
            }
        });
    }

    /**
     * @method getAlias
     * @memberof UIManager
     * @description Translates raw Provider IDs into standardized UI aliases (e.g., "A1", "S5").
     * @param {string} nodeId - The raw node identifier.
     * @param {boolean} [isAnchor=false] - Whether the node is an anchor.
     * @returns {string} The formatted alias.
     */
    getAlias(nodeId, isAnchor = false) {
        if (!nodeId) return "";
        if (this.aliasMap.has(nodeId)) {
            const existing = this.aliasMap.get(nodeId);
            if (isAnchor && !existing.isAnchor) {
                existing.isAnchor = true;
                existing.alias = `A${this.anchorCounter++}`;
            }
            return existing.alias;
        }
        const prefix = isAnchor ? 'A' : 'S';
        const count = isAnchor ? this.anchorCounter++ : this.standardCounter++;
        const alias = `${prefix}${count}`;
        this.aliasMap.set(nodeId, { alias, isAnchor });
        return alias;
    }

    /**
      * @method setConnectionStatus
      * @memberof UIManager
      * @description Updates the WebSocket connection status indicator.
      * @param {boolean} isConnected - Connection state.
      * @param {string|null} [socketId=null] - The active socket identifier.
      */
    setConnectionStatus(isConnected, socketId = null) {
        if (!this.statusEl) return;
        if (isConnected) {
            this.statusEl.innerHTML = '<span class="pulse"></span>HW: ONLINE';
            this.statusEl.style.color = '#00f0ff';
        } else {
            this.statusEl.innerHTML = 'HW: OFFLINE';
            this.statusEl.style.color = '#ff0055';
        }
    }

    /**
     * @method setNodeInfo
     * @memberof UIManager
     * @description Mounts the active Node alias above the main HUD.
     * @param {string} nodeId - Active node identifier.
     * @param {boolean} isAnchor - True if the node is an anchor.
     */
    setNodeInfo(nodeId, isAnchor) {
        let el = document.getElementById('node-info');
        if (!el) {
            el = document.createElement('div');
            el.id = 'node-info';
            Object.assign(el.style, {
                fontSize: '11px', marginTop: '8px', marginBottom: '4px',
                fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase'
            });
            if (this.statusEl && this.statusEl.parentNode) {
                this.statusEl.parentNode.insertBefore(el, this.statusEl.nextSibling);
            }
        }
        const alias = this.getAlias(nodeId, isAnchor);
        el.innerText = `NODE: ${alias} [${isAnchor ? 'ANCHOR' : 'STANDARD'}]`;
        el.style.color = isAnchor ? '#ffdd00' : '#00bfff';
    }

    /** 
     * @method resetPipeline
     * @memberof UIManager
     * @description Flushes the DOM pipeline containers for a new node hop. 
     */
    resetPipeline() {
        this.taskElements.clear();
        if (this.progressContainer) {
            this.progressContainer.innerHTML = `
                <div id="pipeline-header-group" style="display: none; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 6px;">
                    <div id="pipeline-current-node-title" style="font-weight: bold; font-size: 12px; letter-spacing: 1px;"></div>
                    <button id="master-mute-btn" style="background: none; border: 1px solid #00ffaa; color: #00ffaa; font-size: 9px; padding: 3px 6px; cursor: pointer; border-radius: 3px; transition: background 0.2s;">MUTE ALL</button>
                </div>
                
                <div id="behavior-local-container" style="display: flex; flex-direction: column; gap: 0px;"></div>
                
                <div id="behavior-neighbor-header" style="display: none; font-size: 10px; color: #888; margin-top: 12px; margin-bottom: 6px; border-bottom: 1px solid #333; padding-bottom: 3px; font-weight: bold; letter-spacing: 1px;">NEIGHBORING LAYERS</div>
                <div id="behavior-neighbor-container" style="display: flex; flex-direction: column; gap: 0px;"></div>
                
                <div id="behavior-object-header" style="display: none; font-size: 10px; color: #aaa; margin-top: 12px; margin-bottom: 6px; border-bottom: 1px solid #333; padding-bottom: 3px; font-weight: bold; letter-spacing: 1px;">SCENE OBJECTS</div>
                <div id="behavior-object-container" style="display: flex; flex-direction: column; gap: 0px;"></div>
            `;

            const masterMuteBtn = this.progressContainer.querySelector('#master-mute-btn');
            if (masterMuteBtn) {
                masterMuteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleMasterMute(masterMuteBtn);
                };
            }
            this.isMasterMuted = false;
        }
    }

    /**
     * @method updatePipelineProgress
     * @memberof UIManager
     * @description Updates the status of an active task within the visual pipeline list.
     * @param {string} id - Task identifier.
     * @param {string} stage - Human readable stage name.
     * @param {number} progressPercentage - Progress from 0.0 to 1.0.
     * @param {boolean} [isObject=false] - True if task is a transient object.
     * @param {boolean} [isAnchor=false] - True if task is an anchor node.
     * @param {boolean} [isBackgroundNode=false] - True if task is a background neighbor.
     * @param {string|null} [displayName=null] - Explicit UI label.
     * @param {Object|null} [taskData=null] - Raw task JSON attached to the DOM for regen triggers.
     */
    updatePipelineProgress(id, stage, progressPercentage, behavior = 'local', isAnchor = false, displayName = null, taskData = null) {
        const key = id;
        let el = this.taskElements.get(key);

        if (!el) {
            el = document.createElement('div');
            el.className = 'task-item';

            if (behavior === 'neighbor') {
                Object.assign(el.style, { opacity: '0.6', borderLeft: '2px solid #555', paddingLeft: '8px', marginBottom: '6px' });
            } else if (behavior === 'object') {
                Object.assign(el.style, { borderLeft: '2px solid #00bfff', paddingLeft: '8px', marginBottom: '6px' });
            } else {
                // Local Main Node formatting
                Object.assign(el.style, { borderLeft: '2px solid #ffdd00', paddingLeft: '8px', marginBottom: '8px' });
            }

            el.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <div class="task-title" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 75%; font-weight: bold; font-size: 11px;"></div>
                    <div style="display: flex;">
                        <button class="regen-btn" style="display: none; background: none; border: 1px solid #ffdd00; color: #ffdd00; font-size: 9px; padding: 2px 5px; cursor: pointer; border-radius: 3px; margin-right: 4px; transition: background 0.2s;">REGEN</button>
                        <button class="mute-btn" style="display: none; background: none; border: 1px solid #00ffaa; color: #00ffaa; font-size: 9px; padding: 2px 5px; cursor: pointer; border-radius: 3px; transition: background 0.2s;">MUTE</button>
                    </div>
                </div>
                <div style="font-size: 9px; margin-bottom: 4px; letter-spacing: 0.5px;"><span class="stage-text">${stage}</span></div>
                <div class="progress-bar" style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                    <div class="progress-fill" style="height: 100%; width: 0%; transition: width 0.3s ease, background 0.3s ease;"></div>
                </div>  
                <div class="regen-form" style="display: none; flex-direction: column; gap: 4px; padding: 5px; background: rgba(0,0,0,0.5); border-radius: 4px; margin-top: 5px; border: 1px solid #444;">
                    <input type="text" class="regen-feedback" placeholder="What's wrong? (e.g., dog barking)" style="font-size: 9px; background: #222; color: #fff; border: 1px solid #555; border-radius: 2px; padding: 3px;">
                    <label style="display: flex; align-items: center; gap: 4px; font-size: 8px; color: #ffdd00; cursor: pointer; margin: 2px 0;">
                        <input type="checkbox" class="regen-scratch" style="margin:0; width: auto;"> 
                        <span>REGEN FROM SCRATCH (DISCARD OLD)</span>
                    </label>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 2px;">
                        <div class="slider-zone" style="display: flex; align-items: center; gap: 6px; flex-grow: 1; font-size: 8px; color: #aaa; transition: all 0.2s ease;">
                            <span>TWEAK</span>
                            <input type="range" class="regen-rating" min="1" max="10" value="5" style="flex-grow: 1;">
                            <span>NUKE</span>
                        </div>
                        <button class="regen-submit" style="background: #ffdd00; color: #000; border: none; border-radius: 2px; padding: 2px 6px; font-weight: bold; cursor: pointer; margin-left: 8px;">GO</button>
                    </div>
                </div>
            `;

            const muteBtn = el.querySelector('.mute-btn');
            if (muteBtn) {
                muteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.muteCallback) {
                        let muteKey = id;
                        const isMuted = this.muteCallback(muteKey, behavior === 'object');

                        muteBtn.innerText = isMuted ? 'UNMUTE' : 'MUTE';
                        muteBtn.style.color = isMuted ? '#ff0055' : '#00ffaa';
                        muteBtn.style.borderColor = isMuted ? '#ff0055' : '#00ffaa';
                    }
                });
            }

            const scratchCheckbox = el.querySelector('.regen-scratch');
            const ratingSlider = el.querySelector('.regen-rating');
            const sliderZone = el.querySelector('.slider-zone');

            if (scratchCheckbox && ratingSlider && sliderZone) {
                scratchCheckbox.addEventListener('change', () => {
                    const fromScratch = scratchCheckbox.checked;
                    ratingSlider.disabled = fromScratch;
                    sliderZone.style.opacity = fromScratch ? '0.3' : '1.0';
                    sliderZone.style.filter = fromScratch ? 'grayscale(1)' : 'none';
                    sliderZone.style.pointerEvents = fromScratch ? 'none' : 'auto';
                });
            }

            const localContainer = document.getElementById('behavior-local-container');
            const neighborContainer = document.getElementById('behavior-neighbor-container');
            const objectContainer = document.getElementById('behavior-object-container');

            if (behavior === 'object') {
                if (objectContainer) objectContainer.appendChild(el);
                const objHeader = document.getElementById('behavior-object-header');
                if (objHeader) objHeader.style.display = 'block';
            } else if (behavior === 'neighbor') {
                if (neighborContainer) neighborContainer.appendChild(el);
                const neighborHeader = document.getElementById('behavior-neighbor-header');
                if (neighborHeader) neighborHeader.style.display = 'block';
            } else {
                const headerGroup = document.getElementById('pipeline-header-group');
                const titleEl = document.getElementById('pipeline-current-node-title');
                if (headerGroup && titleEl) {
                    headerGroup.style.display = 'flex';
                    const alias = this.getAlias(id, isAnchor);
                    titleEl.innerText = isAnchor ? `${alias} [ANCHOR]` : `${alias} [STANDARD]`;
                    titleEl.style.color = isAnchor ? '#ffdd00' : '#00bfff';
                }
                if (localContainer) localContainer.prepend(el);
            }

            this.taskElements.set(key, el);
            if (this.hudEl) this.hudEl.scrollTop = this.hudEl.scrollHeight;
        }

        const titleEl = el.querySelector('.task-title');
        const fill = el.querySelector('.progress-fill');
        const text = el.querySelector('.stage-text');
        const muteBtn = el.querySelector('.mute-btn');
        const regenBtn = el.querySelector('.regen-btn');
        const regenForm = el.querySelector('.regen-form');
        const submitBtn = el.querySelector('.regen-submit');
        const feedbackInput = el.querySelector('.regen-feedback');
        const ratingInput = el.querySelector('.regen-rating');
        const scratchCheckbox = el.querySelector('.regen-scratch');

        if ((stage === 'complete' || stage === 'error') && regenForm && regenForm.style.display === 'flex') {
            return;
        }

        let displayTitle = displayName || id;
        if (behavior !== 'object' && !displayName) {
            const alias = this.getAlias(id, isAnchor);
            displayTitle = (behavior === 'neighbor') ? `${alias} (Neighbor)` : (isAnchor ? `${alias} [ANCHOR]` : alias);
        }

        if (titleEl) {
            titleEl.innerText = displayTitle.toUpperCase();
            titleEl.style.color = (behavior === 'neighbor') ? '#888' : (isAnchor ? '#ffdd00' : '#fff');
        }

        const lowerStage = stage.toLowerCase();
        if (text) {
            text.innerText = lowerStage.toUpperCase();
            if (lowerStage.includes('vlm')) text.style.color = '#ff00ff';
            else if (lowerStage.includes('queued')) text.style.color = '#888888';
            else if (lowerStage.includes('audio processing')) text.style.color = '#00f0ff';
            else if (lowerStage === 'complete') text.style.color = '#00ffaa';
            else if (lowerStage === 'error' || lowerStage === 'aborted') text.style.color = '#ff0055';
            else text.style.color = '#ffffff';
        }

        if (progressPercentage !== null) {
            fill.style.width = `${Math.max(5, progressPercentage * 100)}%`;
            if (lowerStage.includes('vlm')) fill.style.background = '#ff00ff';
            else if (lowerStage.includes('queued')) fill.style.background = '#555';
            else if (lowerStage.includes('audio processing')) fill.style.background = '#00f0ff';
            else if (lowerStage === 'complete') fill.style.background = '#00ffaa';
            else if (lowerStage === 'error' || lowerStage === 'aborted') fill.style.background = '#ff0055';
        }

        if (taskData) {
            el.dataset.taskData = JSON.stringify(taskData);
        }

        if (stage === 'complete' || stage === 'error' || stage === 'aborted') {
            if (stage === 'complete') {
                if (fill) { fill.style.width = '100%'; fill.style.background = '#00ffaa'; }
                if (text) text.style.color = '#00ffaa';
            } else {
                if (fill) { fill.style.width = '100%'; fill.style.background = '#ff0055'; }
                if (text) text.style.color = '#ff0055';
            }

            if (behavior === 'neighbor') el.style.opacity = '1';

            if (muteBtn) {
                if (behavior !== 'object' && !isAnchor) {
                    muteBtn.style.display = 'none';
                } else {
                    muteBtn.style.display = (stage === 'complete') ? 'block' : 'none';
                    if (stage === 'complete' && this.isMasterMuted && muteBtn.innerText === 'MUTE') {
                        setTimeout(() => muteBtn.click(), 10);
                    }
                }
            }

            if (el.dataset.taskData) {
                if (behavior !== 'object' && !isAnchor) {
                    if (regenBtn) regenBtn.style.display = 'none';
                    if (regenForm) regenForm.style.display = 'none';
                } else {
                    if (regenBtn) regenBtn.style.display = 'block';
                    if (regenForm) regenForm.style.display = 'none';

                    if (regenBtn) {
                        regenBtn.onclick = (e) => {
                            e.stopPropagation();
                            regenBtn.style.display = 'none';
                            regenForm.style.display = 'flex';

                            setTimeout(() => {
                                if (this.hudEl) this.hudEl.scrollTop = this.hudEl.scrollHeight;
                            }, 10);
                        };
                    }
                }
                if (submitBtn) {
                    submitBtn.onclick = (e) => {
                        e.stopPropagation();
                        const storedTaskData = JSON.parse(el.dataset.taskData);
                        const feedbackData = {
                            text: feedbackInput.value.trim(),
                            rating: parseInt(ratingInput.value, 10),
                            fromScratch: scratchCheckbox.checked
                        };

                        if (this.regenCallback) {
                            this.updatePipelineProgress(id, 'regenerating', 0.1, behavior, isAnchor, displayName);
                            regenForm.style.display = 'none';
                            this.regenCallback(storedTaskData, feedbackData);
                        }
                    };
                }
            }
        } else {
            if (regenBtn) regenBtn.style.display = 'none';
            if (regenForm) regenForm.style.display = 'none';
            if (muteBtn) muteBtn.style.display = 'none';
        }

        this.triggerVRHudSync();
    }

    /**
     * @method drawRadarGraph
     * @memberof UIManager
     * @description Renders the 2D HTML5 canvas topology graph.
     * @param {Object} graphData - Object containing nodes and edges.
     * @param {string} currentNodeId - The currently occupied node.
     */
    drawRadarGraph(graphData, currentNodeId) {
        let container = document.getElementById('radar-container');

        if (container && container.innerHTML.trim() === '') {
            Object.assign(container.style, {
                position: 'absolute',
                top: '25%',
                transform: 'translateY(-50%)',
                zIndex: '100',
                background: 'rgba(0,0,0,0.9)',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '12px',
                pointerEvents: 'auto',
                boxShadow: '0 0 20px rgba(0,0,0,0.5)'
            });
            container.innerHTML = `
                <div style="font-size: 9px; font-weight: bold; color: #00f0ff; margin-bottom: 8px; text-align: center; letter-spacing: 2px; text-transform: uppercase;">Acoustic Radar</div>
                <canvas id="radar-canvas"></canvas>
                <div style="font-size: 8px; margin-top: 8px; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; font-weight: bold; color: #888;">
                    <span><span style="display:inline-block; width:6px; height:6px; background:#fff; border-radius:50%; margin-right:4px;"></span>YOU</span>
                    <span><span style="display:inline-block; width:6px; height:6px; background:#ffdd00; border-radius:50%; margin-right:4px;"></span>ANCHOR</span>
                    <span><span style="display:inline-block; width:6px; height:6px; background:#ff0055; border-radius:50%; margin-right:4px;"></span>END</span>
                    <span><span style="display:inline-block; width:6px; height:6px; background:#00bfff; border-radius:50%; margin-right:4px;"></span>NODE</span>
                </div>
            `;
        }

        if (!container) return;

        container.style.display = 'block';
        container.style.left = this.isRadarVisible ? '20px' : '-9999px';
        container.style.opacity = '1';

        const canvas = document.getElementById('radar-canvas');
        const ctx = canvas.getContext('2d');
        const { nodes, edges } = graphData;

        const dpr = window.devicePixelRatio || 1;
        const logicalSize = 200;

        canvas.width = logicalSize * dpr;
        canvas.height = logicalSize * dpr;
        canvas.style.width = `${logicalSize}px`;
        canvas.style.height = `${logicalSize}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, logicalSize, logicalSize);

        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, logicalSize, logicalSize);

        if (!nodes || nodes.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
            if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
        });

        const padding = 20;
        const scale = Math.min(
            (logicalSize - padding * 2) / Math.max(maxX - minX, 1),
            (logicalSize - padding * 2) / Math.max(maxY - minY, 1)
        );

        const cx = logicalSize / 2, cy = logicalSize / 2;
        const bx = (minX + maxX) / 2, by = (minY + maxY) / 2;
        const transform = (x, y) => ({ x: cx + (x - bx) * scale, y: cy + (y - by) * scale });

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        edges.forEach(e => {
            const n1 = nodes.find(n => n.id === e.from), n2 = nodes.find(n => n.id === e.to);
            if (n1 && n2) {
                const p1 = transform(n1.x, n1.y), p2 = transform(n2.x, n2.y);
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
            }
        });

        nodes.forEach(n => {
            const p = transform(n.x, n.y);
            const isCurrent = n.id === currentNodeId;

            ctx.beginPath();
            ctx.arc(p.x, p.y, isCurrent ? 5 : 3, 0, Math.PI * 2);

            if (isCurrent) {
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00f0ff';
            } else if (n.type === 'end') {
                ctx.fillStyle = '#ff0055';
                ctx.shadowBlur = 0;
            } else if (n.type === 'anchor') {
                ctx.fillStyle = n.isActiveAnchor ? '#ffdd00' : '#665500';
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = '#00bfff';
                ctx.shadowBlur = 0;
            }
            ctx.fill();

            if (n.type === 'anchor' || n.type === 'end') {
                const label = this.getAlias(n.id, true);
                ctx.font = 'bold 8px monospace';

                if (isCurrent) {
                    ctx.fillStyle = '#fff';
                } else if (n.type === 'end') {
                    ctx.fillStyle = '#ff0055';
                } else if (n.type === 'anchor') {
                    ctx.fillStyle = n.isActiveAnchor ? '#ffdd00' : '#665500';
                }
                ctx.textAlign = 'center';
                ctx.fillText(label, p.x, p.y - 8);
            }
        });
        ctx.shadowBlur = 0;

        if (container) {
            container.setAttribute('data-htmlmesh-tick', Date.now());
        }
    }

    /**
     * @method _styleXrButton
     * @memberof UIManager
     * @description Applies default inline CSS styles, positioning, and hover effects to the XR entry button.
     * @private
     */
    _styleXrButton() {
        if (!this.xrBtn) return;

        Object.assign(this.xrBtn.style, {
            position: 'fixed',
            top: '70px',
            right: '20px',
            left: 'auto',
            bottom: 'auto',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#ffdd00',
            border: '1px solid #ffdd00',
            borderRadius: '4px',
            cursor: 'pointer',
            zIndex: '101',
            boxShadow: '0 0 10px rgba(255, 221, 0, 0.2)',
            transition: 'all 0.2s',
            width: 'auto',
            height: 'auto',
            transform: 'none'
        });

        this.xrBtn.onmouseenter = () => { this.xrBtn.style.background = 'rgba(20, 20, 20, 0.9)'; };
        this.xrBtn.onmouseleave = () => { this.xrBtn.style.background = 'rgba(0, 0, 0, 0.8)'; };
    }

    /**
     * @method _bindPropagationGuards
     * @memberof UIManager
     * @description Binds event listeners to the HUD element to stop event propagation. Prevents UI interactions (clicks, touches, scrolls) from accidentally bleeding through to the underlying map or 3D canvas.
     * @private
     */
    _bindPropagationGuards() {
        if (!this.hudEl) return;
        const stopEvent = (e) => e.stopPropagation();
        const events = ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'pointerdown', 'pointerup', 'dblclick', 'contextmenu', 'wheel'];
        events.forEach(evt => {
            this.hudEl.addEventListener(evt, stopEvent, { passive: false });
        });
    }

    /**
     * @method onMuteToggle
     * @memberof UIManager
     * @description Registers a callback to be executed when the global master mute toggle is triggered.
     * @param {Function} callback - The function to execute on mute toggle.
     */
    onMuteToggle(callback) {
        this.muteCallback = callback;
    }

    /**
     * @method onRegenToggle
     * @memberof UIManager
     * @description Registers a callback to be executed when a specific task regeneration is requested from the UI.
     * @param {Function} callback - The function to execute when regeneration is toggled.
     */
    onRegenToggle(callback) {
        this.regenCallback = callback;
    }

    /**
     * @method clearRadarGraph
     * @memberof UIManager
     * @description Clear the radar graph innerHTML container.
     */
    clearRadarGraph() {
        const container = document.getElementById('radar-container');
        // if (container) container.remove();
        container.innerHTML = '';
        container.style.display = 'none';
    }

    /**
     * @method clearNodeInfo
     * @memberof UIManager
     * @description Removes the active node information display from the DOM.
     */
    clearNodeInfo() {
        const el = document.getElementById('node-info');
        if (el) {
            el.remove();
        }
    }

    /**
     * @method showStartButton
     * @memberof UIManager
     * @description Configures the XR button to initiate the VR transition and executes a callback upon click. Includes a 2-second debounce guard to prevent rapid double-entries.
     * @param {Function} [onClickCallback] - Optional callback executed when the VR transition begins.
     */
    showStartButton(onClickCallback) {
        if (!this.xrBtn) return;
        // this.xrBtn.style.display = 'block';
        this.xrBtn.onclick = () => {
            if (this.isEnteringVR) return;
            this.isEnteringVR = true;

            this.xrBtn.style.display = 'none';
            if (this.vrEngine) {
                this.vrEngine.style.opacity = '1';
                this.vrEngine.style.pointerEvents = 'auto';
            }
            if (onClickCallback) onClickCallback();
            setTimeout(() => { this.isEnteringVR = false; }, 2000);
        };
    }

    /**
     * @method setEngineVisibility
     * @memberof UIManager
     * @description Toggles the visibility of introductory UI prompts and the XR entry button based on map/engine status.
     * @param {boolean} isVisible - True if the panoramic viewer/engine has successfully loaded a location.
     */
    setEngineVisibility(isVisible) {
        const prompt = document.getElementById('drop-prompt');
        if (prompt) {
            prompt.style.display = isVisible ? 'none' : 'block';
        }

        if (this.xrBtn) {
            this.xrBtn.style.display = isVisible ? 'block' : 'none';
        }
    }

    /**
     * @method showXrButton
     * @memberof UIManager
     * @description Restores the visibility of the XR entry button and resets the VR entry state guard.
     */
    showXrButton() {
        if (this.xrBtn) {
            this.xrBtn.style.display = 'block';
            this.xrBtn.style.zIndex = '101';
            this.isEnteringVR = false;
        }
    }

    /**
     * @method setupToggleButton
     * @memberof UIManager
     * @description Configures the initial styling, label, and hover effects for a custom UI toggle button.
     * @param {HTMLButtonElement} btn - The DOM button element to configure.
     * @param {string} label - The text label for the button (e.g., 'HUD', 'RADAR').
     * @param {boolean} state - The initial toggle state (true for ON, false for OFF).
     */
    setupToggleButton(btn, label, state) {
        Object.assign(btn.style, {
            background: 'rgba(0, 0, 0, 0.8)', border: `1px solid ${state ? '#00f0ff' : '#555'}`,
            color: state ? '#00f0ff' : '#888', padding: '6px 12px', fontSize: '11px',
            fontWeight: 'bold', fontFamily: 'monospace', cursor: 'pointer',
            borderRadius: '4px', textTransform: 'uppercase', transition: 'all 0.2s ease-in-out',
            boxShadow: state ? '0 0 10px rgba(0, 240, 255, 0.2)' : 'none'
        });
        btn.innerText = `${label}: ${state ? 'ON' : 'OFF'}`;
        btn.onmouseenter = () => { btn.style.background = 'rgba(20, 20, 20, 0.9)'; };
        btn.onmouseleave = () => { btn.style.background = 'rgba(0, 0, 0, 0.8)'; };
    }

    /**
     * @method updateToggleButton
     * @memberof UIManager
     * @description Updates the visual style (borders, shadows, text color) of an existing toggle button to reflect its active state.
     * @param {HTMLButtonElement} btn - The DOM button element to update.
     * @param {string} label - The text label for the button.
     * @param {boolean} state - The current toggle state.
     */
    updateToggleButton(btn, label, state) {
        btn.style.borderColor = state ? '#00f0ff' : '#555';
        btn.style.color = state ? '#00f0ff' : '#888';
        btn.style.boxShadow = state ? '0 0 10px rgba(0, 240, 255, 0.2)' : 'none';
        btn.innerText = `${label}: ${state ? 'ON' : 'OFF'}`;
    }
}