console.log("User plugin initialized. Listening for custom UI actions...");

document.addEventListener('vr:custom_ui_action', (event) => {
    const action = event.detail.actionName;

    // switch (action) {
    //     case 'mute-audio':
    //         console.log("Mute action triggered by user!");
    //         break;

    //     case 'spawn-bird':
    //         console.log("Spawning bird triggered by user!");
    //         break;

    //     default:
    //         console.warn(`Unknown action triggered: ${action}`);
    //         break;
    // }
});