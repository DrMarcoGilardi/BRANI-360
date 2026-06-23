# ABBA-360 `.env` Variables Editor Guide

**It is strongly recommended to use the editor to avoid accidentally deleting environment variables required for the core workflow.**

## What is the `.env` Editor Dashboard?
The **ABBA-360 `.env` Variables Editor** is a secure, graphical web interface designed to help developers visually manage, organize, and document server environment variables. 

Directly editing raw `.env` files can often lead to syntax errors, accidental deletions, or disorganized configurations. This dashboard solves those issues by providing a structured layout where you can group variables, add live documentation, safely edit complex multi-line strings, and instantly sync changes back to the live server.

### Key Features
* **Visual Grouping:** Organize variables into logical, collapsible sections (e.g., Database configs, API keys, SMTP settings).
* **Safe Formatting:** Automatically sanitizes keys (forcing uppercase and restricting special characters) and safely escapes HTML characters to prevent layout breakage.
* **Smart UI Elements:** Text areas dynamically auto-expand to fit their content exactly, removing internal scrollbars for massive multi-line keys (like RSA certificates).
* **Drag-and-Drop Structure:** Move individual variables or entire clustered sections up and down your `.env` architecture effortlessly.
---
## Accessing the Editor Dashboard

To access the editor dashboard start the server then go to http://localhost:3000/admin where 3000 is the port used by your server.
If you changed the port change that value to your port.
The server console will give the correct address at start in a message coloured in cyan.  
Example: <span style="color: #3a96dd;"> [09:24:31] [Server] For the .env admin dashboard open http://localhost:3000/admin </span>

---

## Core Configuration Protection
To prevent accidental damage to the server architecture, certain fundamental parameters have been permanently locked by the system. 

While **you can freely change the values** of these core variables, you **cannot rename their keys or delete them**, nor can you delete their containing section headers. Protected elements will appear slightly dimmed in the dashboard, and their trash bin icons will be disabled.

**Protected Sections:**
* `CORE CONFIG`
* `SERVER STRATEGIES`
* `CLIENT STRATEGIES`
* `AUDIO PARAMS`

**Protected Variables:**
* `PORT`, `DB_PATH`, `AUDIO_FORMAT`, `LOCAL_MODE`, `ALLOWED_ORIGIN`
* `IMAGE_PROVIDER`, `CONTEXT_PROVIDER`, `VISION_PROVIDER`, `AUDIO_PROVIDER`
* `CLIENT_VIEWER_PROVIDER`, `CLIENT_TOPOLOGY_PROVIDER`, `CLIENT_VR_LOADER_PROVIDER`, `CLIENT_NODE_SELECTION_STRATEGY`, `CLIENT_SEMANTIC_PROVIDER`, `CLIENT_SEMANTIC_LAYERS`
* `SPATIALLY_CONTINUOUS`, `NEIGHBOR_GAIN`, `LOCAL_GAIN`, `OBJECT_GAIN`

---

## How to Add Elements

### Adding a New Environment Variable
1. Click the **`+ Add Variable`** button located in the top control bar.
2. A modal overlay will appear on your screen.
3. **Placement (Target Section):** Select the section where you want this variable to be housed from the dropdown menu. If it doesn't belong to a group, select *-- Top of File (No Section) --*.
4. **Key Name:** Enter your variable name (e.g., `STRIPE_SECRET_KEY`). The dashboard will automatically format this into uppercase alphanumeric text.
5. **Initial Value:** Type or paste your variable's value here.
6. **Documentation (Comment):** *(Optional)* Add a description of what this variable does. The system will automatically prepend a `#` symbol to save it as a valid `.env` comment.
7. Click the green **`Add Variable`** button to append it to your selected section.

### Adding a New Section Header
1. Click the green **`+ Add Section Header`** button.
2. A new formatted block will be instantly added to the absolute bottom of your environment document, and your screen will scroll down to it.
3. Click into the text area and rename the section to fit your organizational needs (e.g., `# = AWS S3 CONFIGURATION =`).

---

## How to Remove Elements

### Deleting a Variable or Section
1. Locate the specific variable or section header you want to remove. *(Note: Protected elements cannot be deleted).*
2. Click the **Red Trash Bin Icon** on the far right of that row.
3. A confirmation popup will ask: *"Are you sure you want to delete [Item Name]?"*
4. Click **OK** to permanently remove the item from the dashboard layout.

> **Warning on Deleting Sections:** If you delete a Section Header, the variables nested beneath it will **not** be deleted. Instead, they will become "orphaned" and will visually merge with whatever section was located above them.

---

## Organizing Your Workspace

### Moving Items Up & Down
* Click the **`▲` (Move Up)** or **`▼` (Move Down)** buttons on any variable or section.
* *Powerful Feature:* If you click Move Up/Down on a **Section Header**, the system will calculate and move the entire block—the header and all of its child variables—in one swift motion!

### Moving a Variable to a Different Section (Long-Distance Move)
Instead of clicking "Up" repeatedly to move a variable across a massive configuration file:
1. Click the **`↹` (Move to Section)** button next to the variable.
2. A modal will display asking for a "New Placement".
3. Select your desired target section from the dropdown menu and click **`Move Variable`**. The item will be instantly relocated to the bottom of the target group.

### Collapsing Sections
If your file is getting too long, you can click the **`➖` / `➕` (Toggle Visibility)** button on any section header to hide or reveal all the variables contained within it, keeping your active workspace clean. *(Protected sections can be collapsed without issue).*

---

## Saving Your Changes
> **Important**: Changes made visually in the dashboard are **NOT** automatically saved to your server! To make your configurations live:
1. Click the green **`Save & Sync Server`** button in the top right corner.
2. The dashboard will scrape all current inputs and push a structured JSON payload to the backend.
3. Upon success, you will receive an alert stating: *"Environment synced! The file structure was preserved and clients are refreshing."*

---

## Environment Variables Dictionary

This section provides a detailed explanation of every configuration variable available in the `.env` editor. 

> **Note on Core Variables:** Sections marked as **[CORE]** are essential to the architecture of the application. While you can change their values and add new variables to suit your environment, the admin editor system prevents you from renaming or deleting the **[CORE]** variables listed below, and you cannot delete the section header itself.

---
### Core variables
The variables below are core and are used by the core infrastructure classes to initialise the system

### CORE CONFIG [CORE]
*These variables dictate the fundamental network and file system behavior of the server.*

* **`PORT`**: The connection port your server will run on (e.g., `3000`).
* **`DB_PATH`**: The relative path to the cache database. **Important:** To prevent the Live Server (like in VS Code) from constantly reloading, ensure this path is located *outside* the root of the server folder. Ensure the server has write permissions here.
* **`AUDIO_FORMAT`**: The file format used to transcode the AI generated audio. Valid options are `wav`, `ogg`, `mp3`, or `webm`.
* **`GPU_MAX_WORKERS`**: Limits the maximum number of parallel AI generations your hardware will attempt simultaneously.
* **`LOCAL_MODE`**: A boolean flag (`true` or `false`). Set to `true` if you are running the server locally.
* **`ALLOWED_ORIGIN`**: The Cross-Origin Resource Sharing (CORS) setup. If `LOCAL_MODE` is set to `false`, this must be set to the exact URL where your client is hosted (e.g., `https://example.com`) to ensure secure communication.

### SERVER STRATEGIES [CORE]
*These variables define which backend providers the server uses for processing images, locations, and AI generation.*

* **`IMAGE_PROVIDER`**: The service used to fetch 360° images (e.g., `MarzipanoImageSource` or `MapillarySource`).
* **`CONTEXT_PROVIDER`**: The service used for reverse geolocation, converting longitude/latitude coordinates into a readable address (e.g., `MarzipanoContextProvider` or `GeoapifyContextProvider`).
* **`VISION_PROVIDER`**: The Vision Language Model (VLM) provider used to analyze images (e.g., `LMStudioVisionProvider`).
* **`AUDIO_PROVIDER`**: The AI audio generator used to create the soundscapes (e.g., `StableAudioGradioProvider`).

### CLIENT STRATEGIES [CORE]
*These variables control the frontend behavior, dictating how the client renders the tour and interprets topological data.*

* **`CLIENT_VIEWER_PROVIDER`**: The provider handling the frontend landing page and the rendering of 360° images (e.g., `MarzipanoViewerProvider`or `MarzipanoViewerProvider`).
* **`CLIENT_TOPOLOGY_PROVIDER`**: The provider responsible for mapping and discovering how different 360° image nodes connect to one another.
* **`CLIENT_VR_LOADER_PROVIDER`**: The provider responsible for loading the 360° images specifically for WebVR environments.
* **`CLIENT_NODE_SELECTION_STRATEGY`**: The logic used to determine which nodes trigger background sound generation (e.g., `AcousticHorizonStrategy`).
* **`CLIENT_SEMANTIC_PROVIDER`**: The provider that dictates the semantic meaning extracted for audio generation.
* **`CLIENT_SEMANTIC_LAYERS`**: A comma-separated list of the semantic layers utilized by the semantic provider (e.g., `spatial, horizon`).

### AUDIO PARAMETERS  [CORE] 
*Variables for AcousticTreadmil, SpatialAudioPlayer, and strategies. These variables set the default volume levels within the client's Spatial Audio Player and the spatial coninuity of the 360 images.*  

* **`SPATIALLY_CONTINUOUS`**: (`true`/`false`) Determines if the nodes represent a contiguous physical walkthrough, or disconnected jumps between different locations. Used by the Acoustic Treadmill and Horizon strategies.
* **`NEIGHBOR_GAIN`**: The volume level for ambient, background soundscapes.
* **`LOCAL_GAIN`**: The volume level for immediate, foreground sounds.
* **`OBJECT_GAIN`**: The volume level for 3D mapped, point-source spatial audio objects.
---
### **Non [CORE] variables**
The variables below are non-core and are used by the concrete strategies implementations, these can be renamed and/or deleted based on your own implementation needs

### KEYS AND TOKENS
*Authentication credentials and local file paths.*

* **`MAPILLARY_TOKEN`**: Your API token for authenticating with Mapillary.
* **`GEOAPIFY_TOKEN`**: Your API token for authenticating with the Geoapify Geocoding API.
* **`TOUR_PATH`**: The relative file path to the local 360° tour assets (e.g., `../../../local360_example/app-files`).

### AI APIS AND PROMPTS
*Configuration for your Vision and Audio AI endpoints, including the strict system prompts used to instruct the models.*

* **`LM_STUDIO_PORT`**: The local port used to communicate with LM Studio for vision tasks.
* **`VLM_MODEL_ID`**: The specific VLM model loaded into LM Studio (e.g., `qwen/qwen3.5-9b`).
* **`VLM_PROMPT_AMBIENT`**: The complex system prompt instructing the AI to act as an Acoustic Ecologist. It dictates how to analyze an image to generate a JSON payload describing the ambient soundscape (reverb, background texture, and environment type).
* **`VLM_PROMPT_SPATIAL`**: The system prompt instructing the AI to identify distinct, point-source objects (like a car or a bird) within a 1m–50m range, map them in 3D space (horizontal and vertical pitch), and label them using specific Foley terminology.
* **`STABLE_AUDIO_API`**: The local URL endpoint for the Stable Audio synthesis service (e.g., `http://127.0.0.1:7860/`).

### CLIENT STRATEGY PARAMETERS
*Variables prefixed with `CLIENT_PARAM_` are arbitrary parameters passed directly into the client strategy constructor.*

* **`CLIENT_PARAM_MIN_SPACING`**: The minimum number of visual nodes the user must pass before a new background audio node is triggered.
* **`CLIENT_PARAM_MAX_GAP`**: The maximum number of visual nodes allowed before the system is forced to generate a new background audio node.

### PYTHON SCRIPTS [OPTIONAL]
*File names and execution paths for the out-of-the-box Python adapter scripts.*

* **`PYTHON_VISION_SCRIPT`**: The filename of the mockup/adapter script for vision tasks (e.g., `vision_adapter.py`).
* **`PYTHON_AUDIO_SCRIPT`**: The filename of the mockup/adapter script for audio tasks (e.g., `audio_adapter.py`).
* **`PYTHON_EXEC`**: The command used to run Python scripts on your server. Usually `python3` on Mac/Linux, `python` on Windows, or the absolute path to a virtual environment (e.g., `/venv/bin/python`).
