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

// Replaced data-based injection with DOM-based injection (V13 Safe)
Hooks.on('renderSceneControls', (app, html, data) => {
    if (!game.user.isGM) return;

    const enabled = game.settings.get('foundry-ha-integration', 'enabled');
    const border = enabled ? "#00ff00" : "#ff4444"; // Green for ON, Red for OFF
    const color = enabled ? "#00ff00" : "#ff4444";
    const icon = "fas fa-dungeon";
    const title = enabled ? "Lair Control: On" : "Lair Control: Off";

    // Create the button HTML manually (IRLMod Pattern)
    // We add 'lair-control-btn' class for easy finding later
    const buttonHtml = $(`
        <li class="scene-control lair-control-btn" data-control="lair-control" data-tooltip="${title}">
            <button type="button" class="control ui-control layer icon" style="color: ${color}; border-color: ${border}">
                <i class="${icon}"></i>
            </button>
        </li>
    `);

    // Find the main controls list (Left Sidebar)
    // We attempt to find the V13/Theme specific menu first, then fallback to standard OL
    const jqSceneControlsRoot = $(html);
    let toolsMenu = jqSceneControlsRoot.find('menu#scene-controls-layers').first();

    if (!toolsMenu.length) {
        toolsMenu = jqSceneControlsRoot.find('ol.main-controls').first();
    }

    if (!toolsMenu.length) {
        console.warn("Lair Control | Could not find 'menu#scene-controls-layers' OR 'ol.main-controls'. Button injection failed.");
        return;
    }

    // Avoid duplicate injection
    if (toolsMenu.find('.lair-control-btn').length === 0) {
        // Append to the end of the main groups list (First Row)
        toolsMenu.append(buttonHtml);
    }

    // Attach Click Listener using robust namespace pattern
    // We target the *Button* specifically, unbind any previous listeners, and re-bind.
    const btn = jqSceneControlsRoot.find('.lair-control-btn button');
    btn.off('click.lairControl').on('click.lairControl', async (event) => {
        event.preventDefault();
        event.stopPropagation(); // Stop Foundry from processing this as a layer switch

        const current = game.settings.get('foundry-ha-integration', 'enabled');
        console.log(`Lair Control | Button Clicked! Toggling from ${current} to ${!current}`);

        await game.settings.set('foundry-ha-integration', 'enabled', !current);
        // Setting onChange triggers ui.controls.render(), which re-runs this hook
    });
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

Hooks.on('renderSceneConfig', async (app, html, data) => {
    const scene = app.document ?? app.object;
    if (!scene) {
        console.warn("Lair Control | Scene Config opened but scene document is missing", app);
        return;
    }

    // Handle HTML element (V13/V12 compatibility) - ensure we have a jQuery object or raw Element
    // If html is not a jQuery object, allow jQuery to wrap it if available, else usage native.
    // However, Foundry VTT core exposes jQuery as global `$`.
    let $html = html;
    if (typeof html.find !== 'function') {
        $html = $(html);
    }

    const haEntity = scene.getFlag('foundry-ha-integration', 'haEntity') || "";

    // Fetch entities from HA
    let options = "";
    const entities = await haClient.fetchEntities();
    if (entities && entities.length > 0) {
        options = entities.map(e => `<option value="${e}"></option>`).join('');
    }

    // 1. Inject Tab Navigation
    const tabNav = `
    <a class="item" data-tab="lair-control">
        <i class="fas fa-dungeon"></i> Lair Control
    </a>`;

    const nav = $html.find('nav.sheet-tabs');
    nav.append(tabNav);

    // 2. Inject Tab Content
    const tabContent = `
    <div class="tab" data-tab="lair-control">
        <p class="notes">Configure automation triggers for this Scene.</p>
        <div class="form-group">
            <label>Home Assistant Entity</label>
            <div class="form-fields">
                <input type="text" name="flags.foundry-ha-integration.haEntity" value="${haEntity}" list="ha-entities-list" placeholder="scene.my_dungeon_scene">
                <datalist id="ha-entities-list">
                    ${options}
                </datalist>
            </div>
            <p class="notes">Select or enter the Entity ID to turn on when this Scene is activated.</p>
        </div>
    </div>
    `;

    // Foundry SceneConfig usually has a .sheet-body or we can just append to the form
    // Appending to the same parent as other .tab elements is best.
    let contentContainer = $html.find('.sheet-body');
    if (!contentContainer.length) {
        // Fallback: Find the parent of the first tab
        const firstTab = $html.find('.tab').first();
        if (firstTab.length) {
            contentContainer = firstTab.parent();
        } else {
            // Last resort: before the buttons
            contentContainer = $html.find('button[type="submit"]').parent();
        }
    }

    contentContainer.append(tabContent);

    // 3. Tab Handling Logic
    nav.find('a[data-tab="lair-control"]').on('click', (event) => {
        event.preventDefault();

        // Deactivate all nav items and tabs in this sheet
        $html.find('nav.sheet-tabs .item').removeClass('active');
        $html.find('.tab').each((i, el) => {
            $(el).removeClass('active');
            if ($(el).data('tab') !== 'lair-control') {
                $(el).hide(); // Force hide others
            }
        });

        // Activate Lair Control
        $(event.currentTarget).addClass('active');
        const ourTab = $html.find('.tab[data-tab="lair-control"]');
        ourTab.addClass('active').show();

        // Use Foundry's native position update if possible
        setTimeout(() => {
            app.setPosition({ height: "auto" });
        }, 100);
    });

    // If another tab is clicked, make sure ours is hidden
    nav.find('.item').not('[data-tab="lair-control"]').on('click', () => {
        const ourTab = $html.find('.tab[data-tab="lair-control"]');
        ourTab.removeClass('active').hide();
        setTimeout(() => {
            app.setPosition({ height: "auto" });
        }, 100);
    });

    // Initial resize if we happen to be active (unlikely on open)
    if (nav.find('a[data-tab="lair-control"]').hasClass('active')) {
        setTimeout(() => app.setPosition({ height: "auto" }), 100);
    }
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

