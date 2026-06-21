/**
 * @file admin.js
 * @description Client-side logic for the ABBA-360 Environment Dashboard.
 * Handles fetching, parsing, editing, and saving environment variables and document section headers.
 */

/**
 * @type {Array<Object>}
 * @description Stores the ordered sequence of document blocks (sections and variables) fetched from the server.
 * Example item: { type: 'variable', key: 'PORT', value: '3000', comment: '# Server Port' }
 */
let envItems = [];

/**
 * @async
 * @function loadEnv
 * @description Fetches the array of environment blocks from the backend via the secured localhost API.
 * Triggers the initial DOM render upon a successful fetch.
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
 * @description Sanitizes raw strings for safe injection into HTML attributes to prevent XSS and layout breakage.
 * @param {string} str - The raw string to sanitize.
 * @returns {string} The safely escaped HTML string.
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
 * @description Parses a raw section header block and extracts a clean, readable title for the UI dropdown.
 * Strips out formatting characters like '=', '-', and '#'.
 * @param {string} content - The raw, multi-line string of the section header.
 * @returns {string} A cleaned string representing the title of the section.
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
 * @function render
 * @description Flushes the primary container and iterates over the `envItems` array to sequentially draw Section Headers and Variables in their exact file flow.
 * @returns {void}
 */
function render() {
    const container = document.getElementById('env-container');
    container.innerHTML = '';

    envItems.forEach((item, index) => {
        if (item.type === 'section') {
            container.innerHTML += `
                <div class="env-item section-item" id="item-${index}">
                    <div class="row" style="margin-top: 0;">
                        <span class="badge">DOCUMENT SECTION HEADER</span>
                        <button class="btn-danger" onclick="removeItem(${index})" title="Delete Section">✖</button>
                    </div>
                    <textarea class="section-input" id="content-${index}">${escapeHTML(item.content)}</textarea>
                </div>`;
        } else if (item.type === 'variable') {
            container.innerHTML += `
                <div class="env-item var-item" id="item-${index}">
                    <textarea class="comment-input" id="comment-${index}" placeholder="# Optional specific note for this variable...">${escapeHTML(item.comment)}</textarea>
                    <div class="row">
                        <input type="text" class="key-input" id="key-${index}" value="${escapeHTML(item.key)}" readonly>
                        <input type="text" class="val-input" id="val-${index}" value="${escapeHTML(item.value)}">
                        <button class="btn-danger" onclick="removeItem(${index})" title="Delete Variable">✖</button>
                    </div>
                </div>`;
        }
    });
}

/**
 * @function openAddModal
 * @description Opens the 'Add Variable' modal overlay. Dynamically populates the "Placement" dropdown 
 * based on the currently existing Section Headers in the document, and clears out previous input values.
 * @returns {void}
 */
function openAddModal() {
    const select = document.getElementById('new-var-section');
    select.innerHTML = '<option value="-1">-- Top of File (No Section) --</option>';

    // Populate dropdown with active section headers
    envItems.forEach((item, index) => {
        if (item.type === 'section') {
            select.innerHTML += `<option value="${index}">${escapeHTML(getSectionTitle(item.content))}</option>`;
        }
    });

    // Reset inputs
    document.getElementById('new-var-key').value = '';
    document.getElementById('new-var-val').value = '';
    document.getElementById('new-var-comment').value = '';

    // Show modal
    document.getElementById('add-modal').style.display = 'flex';
}

/**
 * @function closeAddModal
 * @description Hides the 'Add Variable' modal overlay without saving any changes.
 * @returns {void}
 */
function closeAddModal() {
    document.getElementById('add-modal').style.display = 'none';
}

/**
 * @function confirmAddVariable
 * @description Ingests data from the active modal, formats the comments to ensure valid `.env` syntax, 
 * calculates the correct array index based on the chosen section, and inserts the new variable into the state.
 * @returns {void}
 */
function confirmAddVariable() {
    const key = document.getElementById('new-var-key').value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const val = document.getElementById('new-var-val').value;
    let comment = document.getElementById('new-var-comment').value.trim();
    const targetIndex = parseInt(document.getElementById('new-var-section').value, 10);

    if (!key) {
        alert("A Key Name is required!");
        return;
    }

    // Auto-prefix multi-line comments with '#' if the user forgot
    if (comment) {
        comment = comment.split('\n').map(l => l.startsWith('#') ? l : `# ${l}`).join('\n');
    }

    const newItem = { type: 'variable', key, value: val, comment };

    if (targetIndex === -1) {
        // Drop at the very top of the document
        envItems.unshift(newItem);
    } else {
        // Insert at the bottom of the chosen section
        let insertAt = targetIndex + 1;
        while (insertAt < envItems.length && envItems[insertAt].type === 'variable') {
            insertAt++;
        }
        envItems.splice(insertAt, 0, newItem);
    }

    closeAddModal();
    render();

    // Scroll to the bottom of the page to show the addition (estimation based on standard document flow)
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
}

/**
 * @function addNewSection
 * @description Appends a new, pre-formatted Section Header template to the bottom of the document flow state.
 * @returns {void}
 */
function addNewSection() {
    envItems.push({
        type: 'section',
        content: "\n# ==========================================\n# NEW SECTION\n# =========================================="
    });
    render();
    window.scrollTo(0, document.body.scrollHeight);
}

/**
 * @function removeItem
 * @description Destroys a specific block (section or variable) from the `envItems` array state and re-renders the UI.
 * Requires user confirmation.
 * @param {number} index - The array index of the item to remove.
 * @returns {void}
 */
function removeItem(index) {
    const item = envItems[index];
    const label = item.type === 'variable' ? item.key : 'this section header';

    if (confirm(`Are you sure you want to delete ${label}?`)) {
        envItems.splice(index, 1);
        render();
    }
}

/**
 * @async
 * @function saveChanges
 * @description Scrapes the current DOM values to rebuild the array state, then executes a POST request to the backend.
 * This reconstructs the `.env` file on disk and triggers a live engine reload.
 * @returns {Promise<void>}
 */
async function saveChanges() {
    const updates = envItems.map((item, index) => {
        if (item.type === 'section') {
            return {
                type: 'section',
                content: document.getElementById(`content-${index}`).value
            };
        } else {
            return {
                type: 'variable',
                key: item.key, // Key is read-only in the UI, grab directly from state
                value: document.getElementById(`val-${index}`).value,
                comment: document.getElementById(`comment-${index}`).value
            };
        }
    });

    const res = await fetch('/api/admin/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });

    if (res.ok) {
        alert("Environment synced! The file structure was preserved and clients are refreshing.");
        // Reload to sync state cleanly and catch any backend formatting normalization
        loadEnv();
    } else {
        alert("Failed to update environment.");
    }
}

// Automatically load environment data when the window finishes loading
window.onload = loadEnv;