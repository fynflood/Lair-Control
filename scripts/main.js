import { HomeAssistantClient } from './api.js';

let haClient;

Hooks.once('init', () => {
    console.log('Home Assistant Integration | Initializing');

    // Register Settings
    game.settings.register('foundry-ha-integration', 'enabled', {
        name: 'Enable Integration',
        hint: 'Toggle the Home Assistant connection on/off.',
        scope: 'client',
        config: false, // We will use the UI button
        type: Boolean,
        default: true,
        onChange: () => ui.controls.render() // Safe re-render when setting changes
    });

    game.settings.register('foundry-ha-integration', 'haUrl', {
        name: 'Home Assistant URL',
        hint: 'e.g., http://192.168.1.5:8123',
        scope: 'world',
        config: true,
        type: String,
        default: "",
        onChange: () => haClient.reloadSettings()
    });

    game.settings.register('foundry-ha-integration', 'haToken', {
        name: 'Long-Lived Access Token',
        hint: 'Generate this in your Home Assistant User Profile',
        scope: 'world',
        config: true,
        type: String,
        default: "",
        onChange: () => haClient.reloadSettings()
    });

    game.settings.register('foundry-ha-integration', 'nat20Entity', {
        name: 'Nat 20 Entity/Script',
        hint: 'Entity ID to turn on (e.g., script.critical_hit_lights) when a Nat 20 is rolled.',
        scope: 'world',
        config: true,
        type: String,
        default: ""
    });

    game.settings.register('foundry-ha-integration', 'nat1Entity', {
        name: 'Nat 1 Entity/Script',
        hint: 'Entity ID to turn on (e.g., script.fumble_lights) when a Nat 1 is rolled.',
        scope: 'world',
        config: true,
        type: String,
        default: ""
    });

    game.settings.register('foundry-ha-integration', 'gameStatusEntity', {
        name: 'Game Status Entity',
        hint: 'Entity ID (input_boolean) to toggle ON when the world is active.',
        scope: 'world',
        config: true,
        type: String,
        default: ""
    });

    game.settings.register('foundry-ha-integration', 'combatStartEntity', {
        name: 'Combat Start Entity/Script',
        hint: 'Entity ID to turn on when combat begins.',
        scope: 'world',
        config: true,
        type: String,
        default: ""
    });

    game.settings.register('foundry-ha-integration', 'combatEndEntity', {
        name: 'Combat End Entity/Script',
        hint: 'Entity ID to turn on when combat ends.',
        scope: 'world',
        config: true,
        type: String,
        default: ""
    });

    haClient = new HomeAssistantClient();
});

Hooks.on('getSceneControlButtons', (controls) => {
    if (!game.user.isGM) return;

    // Prevent duplicates
    // V13 Object check
    if (typeof controls === 'object' && controls !== null && !Array.isArray(controls)) {
        if (controls['lair-control']) return;
    }
    // Array check
    else if (Array.isArray(controls)) {
        if (controls.find(c => c.name === "lair-control")) return;
    }

    const enabled = game.settings.get('foundry-ha-integration', 'enabled');

    const myControl = {
        name: "lair-control",
        title: "Lair Control",
        icon: "fas fa-dungeon", // Fallback if layer icon needed
        layer: "controls",
        tools: [
            {
                name: "toggle-ha",
                title: enabled ? "Disable Home Assistant" : "Enable Home Assistant",
                icon: enabled ? "fas fa-home" : "fas fa-ban",
                toggle: true,
                active: enabled,
                onClick: async (toggled) => {
                    // toggled arg is the NEW state provided by Foundry
                    console.log(`Lair Control | Toggling to ${toggled}`);
                    await game.settings.set('foundry-ha-integration', 'enabled', toggled);
                    // No manual render here; the setting onChange handles it safely
                }
            }
        ]
    };

    // V13+ Object/Map Structure Detection
    if (controls.push) {
        // Legacy/Stable Array support (V10-V12)
        controls.push(myControl);
    } else if (typeof controls === 'object' && controls !== null) {
        // V13+ Object Support (Key assignment)
        console.log("Lair Control | Detected V13 Object-based controls. Injecting via key assignment.");
        // Try to assign using key if it acts like a dictionary
        controls['lair-control'] = myControl;

        // Failsafe: If for some reason the UI relies on 'order', we let core handle it. 
        // In V13, objects in this hook are typically 'ControlGroups'.
    } else {
        console.error("Lair Control | Unknown controls structure. Injection failed.", controls);
    }
});

Hooks.once('ready', () => {
    console.log('Home Assistant Integration | Ready');

    // Trigger Game Status
    const statusEntity = game.settings.get('foundry-ha-integration', 'gameStatusEntity');
    if (statusEntity) {
        // We use turn_on service which works for input_boolean, light, switch, script, etc.
        const domain = statusEntity.split('.')[0];
        const service = 'turn_on';
        haClient.callService(domain, service, { entity_id: statusEntity });
    }
});

Hooks.on('createChatMessage', async (message) => {
    // Only the GM (who presumably has the HA connection) should trigger the lights
    // This prevents remote players (off-VPN) from getting Network Errors
    if (!game.user.isGM) return;

    if (!message.isRoll || !message.rolls || message.rolls.length === 0) return;

    for (let roll of message.rolls) {
        // Find d20 rolls
        const d20Term = roll.terms.find(t => t.faces === 20);
        if (d20Term) {
            // Check results for 20 or 1
            for (let result of d20Term.results) {
                if (result.result === 20) {
                    console.log('Home Assistant Integration | Nat 20 Detected!');
                    const entity = game.settings.get('foundry-ha-integration', 'nat20Entity');
                    if (entity) {
                        const domain = entity.split('.')[0];
                        haClient.callService(domain, 'turn_on', { entity_id: entity });
                    }
                } else if (result.result === 1) {
                    console.log('Home Assistant Integration | Nat 1 Detected!');
                    const entity = game.settings.get('foundry-ha-integration', 'nat1Entity');
                    if (entity) {
                        const domain = entity.split('.')[0];
                        haClient.callService(domain, 'turn_on', { entity_id: entity });
                    }
                }
            }
        }
    }
});

Hooks.on('updateCombat', (combat, updateData, options, userId) => {
    if (!game.user.isGM) return;

    // Check if combat started
    if (updateData.round === 1 && updateData.turn === 0 && combat.previous.round === 0) {
        console.log('Home Assistant Integration | Combat Started');
        const entity = game.settings.get('foundry-ha-integration', 'combatStartEntity');
        if (entity) {
            const domain = entity.split('.')[0];
            haClient.callService(domain, 'turn_on', { entity_id: entity });
        }
    }
});

Hooks.on('deleteCombat', (combat, options, userId) => {
    if (!game.user.isGM) return;

    console.log('Home Assistant Integration | Combat Ended');
    const entity = game.settings.get('foundry-ha-integration', 'combatEndEntity');
    if (entity) {
        const domain = entity.split('.')[0];
        haClient.callService(domain, 'turn_on', { entity_id: entity });
    }
});

Hooks.on('renderSceneConfig', (app, html, data) => {
    const scene = app.object;
    const haEntity = scene.getFlag('foundry-ha-integration', 'haEntity') || "";

    const formGroup = `
    <div class="form-group">
        <label>Home Assistant Entity</label>
        <div class="form-fields">
            <input type="text" name="flags.foundry-ha-integration.haEntity" value="${haEntity}" placeholder="scene.my_dungeon_scene">
        </div>
        <p class="notes">Enter the Entity ID (scene, script, light) to turn on when this Scene is activated.</p>
    </div>
    `;

    html.find('button[type="submit"]').before(formGroup);
    app.setPosition({ height: "auto" });
});

Hooks.on('canvasReady', async (canvas) => {
    if (!game.user.isGM) return;

    const scene = canvas.scene;
    if (!scene) return;

    const entity = scene.getFlag('foundry-ha-integration', 'haEntity');
    if (entity) {
        console.log(`Home Assistant Integration | Activating Scene Entity: ${entity}`);
        const domain = entity.split('.')[0];
        haClient.callService(domain, 'turn_on', { entity_id: entity });
    }
});

