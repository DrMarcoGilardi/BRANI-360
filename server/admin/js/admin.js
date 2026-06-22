/**
 * @file admin.js
 * @description Client-side logic for the ABBA-360 .env Variables Editor. Handles auto-expanding inputs, variable block movement, collapsing, protecting core config elements, and saving state.
 */

/**
 * @type {Array<Object>}
 * @description Stores the ordered sequence of document blocks (sections and variables) fetched from the server.
 */
let envItems = [];

/**
 * @type {number}
 * @description Tracks the array index of the variable currently selected to move sections via the move modal. A value of -1 indicates no variable is currently queued to move.
 */
let currentMoveIndex = -1;

/**
 * @constant {Array<string>}
 * @description A strict list of section titles (in uppercase) that represent core architecture. The UI prevents these sections from being deleted or renamed.
 */
const PROTECTED_SECTIONS = [
    'CORE CONFIG',
    'SERVER STRATEGIES',
    'CLIENT STRATEGIES',
    'AUDIO PARAMETERS'
];

/**
 * @constant {Array<string>}
 * @description A strict list of environment variable keys that represent core application state. The UI prevents these specific keys from being deleted or renamed (though their values can still be edited).
 */
const PROTECTED_VARIABLES = [
    'PORT', 'DB_PATH', 'AUDIO_FORMAT', 'LOCAL_MODE', 'GPU_MAX_WORKERS', 'ALLOWED_ORIGIN',
    'IMAGE_PROVIDER', 'CONTEXT_PROVIDER', 'VISION_PROVIDER', 'AUDIO_PROVIDER',
    'CLIENT_VIEWER_PROVIDER', 'CLIENT_TOPOLOGY_PROVIDER', 'CLIENT_VR_LOADER_PROVIDER',
    'CLIENT_NODE_SELECTION_STRATEGY', 'CLIENT_SEMANTIC_PROVIDER', 'CLIENT_SEMANTIC_LAYERS',
    'SPATIALLY_CONTINUOUS', 'BACKGROUND_GAIN', 'FOREGROUND_GAIN', 'SPATIAL_GAIN'
];

/**
 * @async
 * @function loadEnv
 * @description Fetches the array of environment blocks from the backend API via localhost.
 * @returns {Promise<void>}
 */
async function loadEnv() {
    const res = await fetch('/api/admin/env');
    if (res.ok) {
        envItems = await res.json();
        render();
    } else {
        alert("Access Denied. Are you on localhost?");
    }
}

/**
 * @function escapeHTML
 * @description Sanitizes raw strings for safe injection into HTML attributes to prevent layout breakage and XSS.
 * @param {string} str - The raw string to sanitize.
 * @returns {string} The escaped HTML string.
 */
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * @function getSectionTitle
 * @description Parses a raw section header block and extracts a clean, readable title for dropdown menus.
 * @param {string} content - The raw, multi-line string of the section header.
 * @returns {string} A cleaned string representing the title.
 */
function getSectionTitle(content) {
    const lines = content.split('\n');
    for (let line of lines) {
        const cleaned = line.replace(/#|=|-/g, '').trim();
        if (cleaned.length > 0) return cleaned;
    }
    return "Unnamed Section";
}

/**
 * @function autoExpand
 * @description Dynamically resizes a textarea height to fit its content exactly, removing internal scrollbars.
 * @param {HTMLElement} field - The textarea element triggering the input event.
 * @returns {void}
 */
function autoExpand(field) {
    field.style.height = '20px'; // Reset briefly to calculate shrinkage
    field.style.height = (field.scrollHeight + 2) + 'px';
}

/**
 * @function syncStateFromDOM
 * @description Scrapes all current input values from the screen and updates the internal `envItems` array state. Prevents unsaved text edits from disappearing when the UI is forced to re-render.
 * @returns {void}
 */
function syncStateFromDOM() {
    envItems.forEach((item, index) => {
        if (item.type === 'section') {
            const el = document.getElementById(`content-${index}`);
            if (el) item.content = el.value;
        } else if (item.type === 'variable') {
            const keyEl = document.getElementById(`key-${index}`);
            const valEl = document.getElementById(`val-${index}`);
            const commentEl = document.getElementById(`comment-${index}`);

            if (keyEl) {
                let newKey = keyEl.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
                if (newKey) item.key = newKey;
            }
            if (valEl) item.value = valEl.value;
            if (commentEl) item.comment = commentEl.value;
        }
    });
}

/**
 * @function render
 * @description Flushes the container and iterates over the `envItems` array to draw the UI. Respects the 'collapsed' state of sections and enforces read-only UI rules for protected variables/sections.
 * @returns {void}
 */
function render() {
    const container = document.getElementById('env-container');
    let htmlBuffer = '';
    let isCollapsed = false;
    const deleteButton = `<svg xmlns="http://w3.org" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bin-icon"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`;

    envItems.forEach((item, index) => {
        if (item.type === 'section') {
            isCollapsed = !!item.collapsed;
            const toggleIcon = isCollapsed ? '➕' : '➖';

            // Check protection status
            const sectionTitle = getSectionTitle(item.content).toUpperCase();
            const isProtected = PROTECTED_SECTIONS.includes(sectionTitle);

            const readonlyAttr = isProtected ? 'readonly' : '';
            const deleteBtnHtml = isProtected
                ? `<button class="btn-secondary btn-icon" style="opacity: 0.3; cursor: not-allowed;" title="Core Section - Cannot Delete" disabled>${deleteButton}</button>`
                : `<button class="btn-danger btn-icon" onclick="removeItem(${index})" title="Delete Section">${deleteButton}</button>`;

            htmlBuffer += `
                <div class="env-item section-item" id="item-${index}">
                    <div class="row" style="margin-top: 0;">
                        <textarea class="section-input auto-expand" id="content-${index}" ${readonlyAttr} oninput="autoExpand(this)">${escapeHTML(item.content)}</textarea>
                        <button class="btn-secondary btn-icon" onclick="moveBlock(${index}, -1)" title="Move Section Up">▲</button>
                        <button class="btn-secondary btn-icon" onclick="moveBlock(${index}, 1)" title="Move Section Down">▼</button>
                        <button class="btn-secondary" onclick="toggleCollapse(${index})" title="Toggle Visibility">${toggleIcon}</button>
                        ${deleteBtnHtml}
                    </div>
                </div>`;
        } else if (item.type === 'variable') {
            const displayStyle = isCollapsed ? 'display: none;' : '';

            // Check protection status
            const isProtected = PROTECTED_VARIABLES.includes(item.key.toUpperCase());
            const readonlyAttr = isProtected ? 'readonly' : '';
            const deleteBtnHtml = isProtected
                ? `<button class="btn-secondary btn-icon" style="opacity: 0.3; cursor: not-allowed;" title="Core Variable - Cannot Delete" disabled>${deleteButton}</button>`
                : `<button class="btn-danger btn-icon" onclick="removeItem(${index})" title="Delete Variable">${deleteButton}</button>`;

            htmlBuffer += `
                <div class="env-item var-item" id="item-${index}" style="${displayStyle}">
                    <textarea class="comment-input auto-expand" id="comment-${index}" placeholder="# Optional specific note for this variable..." oninput="autoExpand(this)">${escapeHTML(item.comment)}</textarea>
                    <div class="row">
                        <input type="text" class="key-input" id="key-${index}" value="${escapeHTML(item.key)}" ${readonlyAttr} title="${isProtected ? 'Core Key - Cannot Edit' : 'Edit Variable Key'}">
                        <textarea class="val-input auto-expand" id="val-${index}" title="Edit Variable Value" placeholder="Value..." oninput="autoExpand(this)">${escapeHTML(item.value)}</textarea>
                        
                        <button class="btn-secondary btn-icon" onclick="moveBlock(${index}, -1)" title="Move Up">▲</button>
                        <button class="btn-secondary btn-icon" onclick="moveBlock(${index}, 1)" title="Move Down">▼</button>
                        <button class="btn-secondary btn-icon" onclick="openMoveModal(${index})" title="Move to Section">↹</button>
                        
                        ${deleteBtnHtml}
                    </div>
                </div>`;
        }
    });

    container.innerHTML = htmlBuffer;

    // Trigger auto-expand on all newly rendered textareas after the DOM paints
    setTimeout(() => {
        document.querySelectorAll('.auto-expand').forEach(el => autoExpand(el));
    }, 0);
}

/**
 * @function toggleCollapse
 * @description Flips the visibility state for the variables nested under a specific section header.
 * @param {number} index - The array index of the section header to toggle.
 * @returns {void}
 */
function toggleCollapse(index) {
    syncStateFromDOM();
    envItems[index].collapsed = !envItems[index].collapsed;
    render();
}

/**
 * @function moveBlock
 * @description Mathematically moves a single variable OR an entire section block (header + children) up or down the array.
 * @param {number} index - The starting array index of the item.
 * @param {number} dir - The direction of movement (-1 for Up, 1 for Down).
 * @returns {void}
 */
function moveBlock(index, dir) {
    syncStateFromDOM();

    if (envItems[index].type === 'variable') {
        const target = index + dir;
        if (target < 0 || target >= envItems.length) return;
        const temp = envItems[index];
        envItems[index] = envItems[target];
        envItems[target] = temp;
    }
    else if (envItems[index].type === 'section') {
        let start1 = index;
        let end1 = start1;
        while (end1 + 1 < envItems.length && envItems[end1 + 1].type === 'variable') {
            end1++;
        }
        const currentBlock = envItems.slice(start1, end1 + 1);

        if (dir === -1) {
            if (start1 === 0) return;
            let end2 = start1 - 1;
            let start2 = end2;
            while (start2 > 0 && envItems[start2].type !== 'section') {
                start2--;
            }
            const prevBlock = envItems.slice(start2, end2 + 1);
            const before = envItems.slice(0, start2);
            const after = envItems.slice(end1 + 1);
            envItems = [...before, ...currentBlock, ...prevBlock, ...after];
        }
        else if (dir === 1) {
            if (end1 === envItems.length - 1) return;
            let start2 = end1 + 1;
            let end2 = start2;
            while (end2 + 1 < envItems.length && envItems[end2 + 1].type !== 'section') {
                end2++;
            }
            const nextBlock = envItems.slice(start2, end2 + 1);
            const before = envItems.slice(0, start1);
            const after = envItems.slice(end2 + 1);
            envItems = [...before, ...nextBlock, ...currentBlock, ...after];
        }
    }
    render();
}

/**
 * @function openAddModal
 * @description Syncs the DOM state, populates the target section dropdown, and opens the 'Add Variable' modal.
 * @returns {void}
 */
function openAddModal() {
    syncStateFromDOM();

    const select = document.getElementById('new-var-section');
    select.innerHTML = '<option value="-1">-- Top of File (No Section) --</option>';

    envItems.forEach((item, index) => {
        if (item.type === 'section') {
            select.innerHTML += `<option value="${index}">${escapeHTML(getSectionTitle(item.content))}</option>`;
        }
    });

    document.getElementById('new-var-key').value = '';
    document.getElementById('new-var-val').value = '';
    document.getElementById('new-var-comment').value = '';
    document.getElementById('add-modal').style.display = 'flex';
}

/**
 * @function closeAddModal
 * @description Hides the 'Add Variable' modal overlay without saving changes.
 * @returns {void}
 */
function closeAddModal() {
    document.getElementById('add-modal').style.display = 'none';
}

/**
 * @function confirmAddVariable
 * @description Validates modal input, formats comments safely, calculates insertion index, and appends the new variable.
 * @returns {void}
 */
function confirmAddVariable() {
    const key = document.getElementById('new-var-key').value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const val = document.getElementById('new-var-val').value;
    let comment = document.getElementById('new-var-comment').value;
    const targetIndex = parseInt(document.getElementById('new-var-section').value, 10);

    if (!key) { alert("A Key Name is required!"); return; }

    if (comment.trim() !== '') {
        comment = comment.split('\n').map(l => {
            const t = l.trim();
            if (t === '') return '';
            return t.startsWith('#') ? l : `# ${l}`;
        }).join('\n');
    } else {
        comment = '';
    }

    const newItem = { type: 'variable', key, value: val, comment };

    if (targetIndex === -1) {
        let insertAt = 0;
        while (insertAt < envItems.length && envItems[insertAt].type === 'variable') insertAt++;
        envItems.splice(insertAt, 0, newItem);
    } else {
        let insertAt = targetIndex + 1;
        while (insertAt < envItems.length && envItems[insertAt].type === 'variable') insertAt++;
        envItems[targetIndex].collapsed = false;
        envItems.splice(insertAt, 0, newItem);
    }

    closeAddModal();
    render();
}

/**
 * @function openMoveModal
 * @description Syncs the DOM state, prepares the target section dropdown, and opens the Move overlay.
 * @param {number} index - The array index of the variable being moved.
 * @returns {void}
 */
function openMoveModal(index) {
    syncStateFromDOM();

    currentMoveIndex = index;
    const item = envItems[index];

    document.getElementById('move-var-name').innerText = item.key;
    const select = document.getElementById('move-var-section');
    select.innerHTML = '<option value="-1">-- Top of File (No Section) --</option>';

    envItems.forEach((block, i) => {
        if (block.type === 'section') {
            select.innerHTML += `<option value="${i}">${escapeHTML(getSectionTitle(block.content))}</option>`;
        }
    });

    document.getElementById('move-modal').style.display = 'flex';
}

/**
 * @function closeMoveModal
 * @description Hides the move modal overlay and resets the active move index.
 * @returns {void}
 */
function closeMoveModal() {
    document.getElementById('move-modal').style.display = 'none';
    currentMoveIndex = -1;
}

/**
 * @function confirmMoveVariable
 * @description Calculates array offsets to extract the selected variable and inject it at the bottom of the target section.
 * @returns {void}
 */
function confirmMoveVariable() {
    if (currentMoveIndex === -1) return;

    const targetSectionIndex = parseInt(document.getElementById('move-var-section').value, 10);

    let insertAt = 0;
    if (targetSectionIndex === -1) {
        while (insertAt < envItems.length && envItems[insertAt].type === 'variable') insertAt++;
    } else {
        insertAt = targetSectionIndex + 1;
        while (insertAt < envItems.length && envItems[insertAt].type === 'variable') insertAt++;
    }

    const itemToMove = envItems[currentMoveIndex];

    if (currentMoveIndex < insertAt) {
        insertAt--;
    }

    envItems.splice(currentMoveIndex, 1);
    envItems.splice(insertAt, 0, itemToMove);

    if (targetSectionIndex !== -1) {
        envItems[targetSectionIndex].collapsed = false;
    }

    closeMoveModal();
    render();

    setTimeout(() => {
        document.getElementById(`item-${insertAt}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
}

/**
 * @function addNewSection
 * @description Syncs the DOM state, then appends a new Section Header template to the bottom of the state flow.
 * @returns {void}
 */
function addNewSection() {
    syncStateFromDOM();

    envItems.push({
        type: 'section',
        content: "\n# ==========================================\n# NEW SECTION\n# =========================================="
    });
    render();
    window.scrollTo(0, document.body.scrollHeight);
}

/**
 * @function removeItem
 * @description Syncs the DOM state, destroys a specific block, and re-renders the UI. Runs an additional code-level guard against deleting protected core elements in case the UI lock is bypassed.
 * @param {number} index - The array index of the item to remove.
 * @returns {void}
 */
function removeItem(index) {
    syncStateFromDOM();

    const item = envItems[index];

    // Final security check in case UI was bypassed
    if (item.type === 'section' && PROTECTED_SECTIONS.includes(getSectionTitle(item.content).toUpperCase())) {
        alert("This is a core section and cannot be deleted.");
        return;
    } else if (item.type === 'variable' && PROTECTED_VARIABLES.includes(item.key.toUpperCase())) {
        alert("This is a core variable and cannot be deleted.");
        return;
    }

    const label = item.type === 'variable' ? item.key : 'this section header (and any child variables will become orphaned)';

    if (confirm(`Are you sure you want to delete ${label}?`)) {
        envItems.splice(index, 1);
        render();
    }
}

/**
 * @async
 * @function saveChanges
 * @description Syncs the DOM state, then executes a POST request to the backend to write the updated `.env` array to disk.
 * @returns {Promise<void>}
 */
async function saveChanges() {
    syncStateFromDOM();

    const res = await fetch('/api/admin/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envItems)
    });

    if (res.ok) {
        alert("Environment synced! The file structure was preserved and clients are refreshing.");
        loadEnv();
    } else {
        alert("Failed to update environment.");
    }
}

window.onload = loadEnv;