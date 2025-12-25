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

    const enabled = game.settings.get('foundry-ha-integration', 'enabled');

    // Define the Group Button Configuration
    // We use a Group-level onClick to prevent Layer Switching (stateless button)
    const lairGroup = {
        name: "lair-control",
        title: enabled ? "Lair Control: On" : "Lair Control: Off",
        icon: enabled ? "fas fa-dungeon" : "fas fa-dungeon lair-disabled", // Use CSS class for color
        layer: "controls", // Required but ignored due to onClick
        visible: true,
        tools: {}, // Empty tools object for V13 safety
        onClick: async () => {
            const current = game.settings.get('foundry-ha-integration', 'enabled');
            console.log(`Lair Control | Toggling from ${current} to ${!current}`);
            await game.settings.set('foundry-ha-integration', 'enabled', !current);
            // ui.controls.render() is handled by the Setting's onChange callback
        }
    };

    // V13+ Object Structure Support (Strict)
    if (typeof controls === 'object' && controls !== null && !Array.isArray(controls)) {
        controls['lair-control'] = lairGroup;
    }
    // Legacy Array Support (Fallback)
    else if (Array.isArray(controls)) {
        // For array support, tools must be an array
        lairGroup.tools = [];
        controls.push(lairGroup);
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

