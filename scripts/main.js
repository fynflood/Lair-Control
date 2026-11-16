import { HomeAssistantClient } from './api.js';
import { AutomationSettingsForm } from './automation-settings.js';

const MODULE_ID = 'foundry-ha-integration';
const TAB_ID = 'lair-control';

let haClient;

/**
 * True on exactly one client: the "active GM" Foundry elects among connected
 * GMs. Gating on this (rather than game.user.isGM) stops every logged-in GM
 * from firing the same Home Assistant call.
 */
function isPrimaryGM() {
    if (!game.user.isGM) return false;
    const activeGM = game.users.activeGM;
    return activeGM ? activeGM.isSelf : true;
}

Hooks.once('init', () => {
    console.log('Lair Control | Initializing');

    game.settings.register(MODULE_ID, 'enabled', {
        name: 'Enable Integration',
        hint: 'Toggle the Home Assistant connection on/off.',
        scope: 'client',
        config: false, // We will use the UI button
        type: Boolean,
        default: true,
        onChange: () => ui.controls.render() // Safe re-render when setting changes
    });

    game.settings.register(MODULE_ID, 'haUrl', {
        name: 'Home Assistant URL',
        hint: 'e.g., http://192.168.1.5:8123',
        scope: 'world',
        config: true,
        type: String,
        default: "",
        onChange: () => haClient.reloadSettings()
    });

    // Client scope on purpose: world-scope settings are sent to every
    // connected player, which would hand them the Home Assistant token.
    // A client setting lives only in this browser's local storage.
    game.settings.register(MODULE_ID, 'haToken', {
        name: 'Long-Lived Access Token',
        hint: 'Generate this in your Home Assistant User Profile. Stored only in this browser, so each GM device needs it entered once.',
        scope: 'client',
        config: true,
        type: String,
        default: "",
        onChange: () => haClient.reloadSettings()
    });

    game.settings.register(MODULE_ID, 'nat20Entity', {
        name: 'Nat 20 Entity/Script',
        hint: 'Entity ID to turn on (e.g., script.critical_hit_lights) when a Nat 20 is rolled.',
        scope: 'world',
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, 'nat1Entity', {
        name: 'Nat 1 Entity/Script',
        hint: 'Entity ID to turn on (e.g., script.fumble_lights) when a Nat 1 is rolled.',
        scope: 'world',
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, 'gameStatusEntity', {
        name: 'Game Status Entity',
        hint: 'Entity ID (input_boolean) to toggle ON when the world is active.',
        scope: 'world',
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, 'combatStartEntity', {
        name: 'Combat Start Entity/Script',
        hint: 'Entity ID to turn on when combat begins.',
        scope: 'world',
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, 'combatEndEntity', {
        name: 'Combat End Entity/Script',
        hint: 'Entity ID to turn on when combat ends, used only if the active Scene has no Lair Control entity configured.',
        scope: 'world',
        config: false,
        type: String,
        default: ""
    });

    // Custom menu with searchable HA entity pickers for the settings above
    game.settings.registerMenu(MODULE_ID, 'automationSettingsMenu', {
        name: 'Automation Entities',
        label: 'Configure Automation Entities',
        hint: 'Choose the Home Assistant entities/scenes triggered by Nat 20/Nat 1 rolls, game status, and combat start/end.',
        icon: 'fas fa-dungeon',
        type: AutomationSettingsForm,
        restricted: true
    });

    haClient = new HomeAssistantClient();
});

/**
 * Versions up to 1.4.0 stored the token as a world setting, which every
 * player's client could read. Move it into this GM's client storage and
 * delete the world copy so it stops being sent to players.
 */
async function migrateWorldToken() {
    if (!game.user.isGM) return;

    const stored = game.settings.storage.get('world')?.getSetting?.(`${MODULE_ID}.haToken`);
    if (!stored) return;

    // Depending on the Foundry version the raw value is the string itself
    // or its JSON encoding.
    let oldToken = stored.value;
    if (typeof oldToken === 'string') {
        try {
            const parsed = JSON.parse(oldToken);
            if (typeof parsed === 'string') oldToken = parsed;
        } catch (e) { /* raw string, use as is */ }
    }

    try {
        if (typeof oldToken === 'string' && oldToken && !game.settings.get(MODULE_ID, 'haToken')) {
            await game.settings.set(MODULE_ID, 'haToken', oldToken);
        }
        await stored.delete();
        ui.notifications.warn(
            'Lair Control: your Home Assistant token was previously visible to all players. '
            + 'It is now stored only in this browser. Consider replacing it with a new token in Home Assistant.',
            { permanent: true }
        );
    } catch (error) {
        console.error('Lair Control | Failed to migrate the world-scope token', error);
    }
}

Hooks.on('renderSceneControls', (app, html) => {
    if (!game.user.isGM) return;

    const menu = html.querySelector('#scene-controls-layers');
    if (!menu) {
        console.warn("Lair Control | Could not find '#scene-controls-layers'. Button injection failed.");
        return;
    }

    // The layers list is re-rendered whenever controls change, so rebuild
    // the button each time rather than trying to patch a stale one.
    menu.querySelector('.lair-control-btn')?.remove();

    const enabled = game.settings.get(MODULE_ID, 'enabled');
    const color = enabled ? "#00ff00" : "#ff4444"; // Green for ON, Red for OFF

    const item = document.createElement('li');
    item.classList.add('lair-control-btn');
    item.innerHTML = `
        <button type="button" class="control ui-control layer icon fas fa-dungeon"
            style="color: ${color}; border-color: ${color}"></button>
    `;
    const button = item.querySelector('button');
    button.dataset.tooltip = enabled ? "Lair Control: On" : "Lair Control: Off";
    button.setAttribute('aria-label', button.dataset.tooltip);
    button.setAttribute('aria-pressed', String(enabled));

    // No data-action/data-control on purpose, so Foundry doesn't treat this
    // as a layer switch.
    button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const current = game.settings.get(MODULE_ID, 'enabled');
        await game.settings.set(MODULE_ID, 'enabled', !current);
        // Setting onChange triggers ui.controls.render(), which re-runs this hook
    });

    menu.append(item);
});

Hooks.once('ready', async () => {
    await migrateWorldToken();

    // Only a GM talks to Home Assistant; players never have the token.
    if (!game.user.isGM) return;

    // Game Status ON. Deliberately isGM rather than isPrimaryGM: turning an
    // already-on entity on again is harmless, and it keeps the status correct
    // if a second GM joins later.
    haClient.activate(game.settings.get(MODULE_ID, 'gameStatusEntity'));

    // Game Status OFF when the last GM closes or reloads the tab. keepalive
    // lets the request outlive the page.
    window.addEventListener('pagehide', () => {
        const otherGMs = game.users.filter(u => u.active && u.isGM && !u.isSelf);
        if (otherGMs.length) return;
        haClient.deactivate(game.settings.get(MODULE_ID, 'gameStatusEntity'), { keepalive: true });
    });
});

/**
 * Report whether a chat message contains a natural 20 and/or natural 1 on a
 * d20 that actually counted. Dice dropped by advantage/disadvantage or
 * replaced by a reroll have `active: false` and are ignored.
 */
function findNaturals(message) {
    let nat20 = false;
    let nat1 = false;

    for (const roll of message.rolls ?? []) {
        // roll.dice flattens every die term, including ones nested in
        // parentheses or pools, unlike roll.terms.
        for (const die of roll.dice ?? []) {
            if (die.faces !== 20) continue;
            for (const result of die.results ?? []) {
                if (result.active === false || result.discarded) continue;
                if (result.result === 20) nat20 = true;
                else if (result.result === 1) nat1 = true;
            }
        }
    }

    return { nat20, nat1 };
}

Hooks.on('createChatMessage', (message) => {
    if (!isPrimaryGM()) return;
    if (!message.isRoll) return;

    // Blind and whispered rolls are hidden from the table; flashing the room
    // lights would give them away.
    if (message.blind || message.whisper?.length) return;

    const { nat20, nat1 } = findNaturals(message);
    if (nat20) haClient.activate(game.settings.get(MODULE_ID, 'nat20Entity'));
    if (nat1) haClient.activate(game.settings.get(MODULE_ID, 'nat1Entity'));
});

Hooks.on('updateCombat', (combat, updateData, options, userId) => {
    if (!isPrimaryGM()) return;

    // Check if combat started
    if (updateData.round === 1 && updateData.turn === 0 && combat.previous.round === 0) {
        haClient.activate(game.settings.get(MODULE_ID, 'combatStartEntity'));
    }
});

Hooks.on('deleteCombat', (combat, options, userId) => {
    if (!isPrimaryGM()) return;

    // An encounter that was created but never begun never triggered the
    // Combat Start entity, so there is nothing to revert.
    if (!combat.started) return;

    // Prefer reverting to the Scene's own Lair Control entity, so the room
    // returns to whatever that Scene set up. Fall back to the global Combat
    // End entity if the Scene has nothing configured. For an unlinked
    // encounter use the Scene that is live for players, not whichever one
    // the GM happens to be viewing.
    const scene = combat.scene ?? game.scenes.active;
    const sceneEntity = scene?.getFlag(MODULE_ID, 'haEntity');
    haClient.activate(sceneEntity || game.settings.get(MODULE_ID, 'combatEndEntity'));
});

Hooks.on('renderSceneConfig', (app, root) => {
    const scene = app.document;
    if (!scene) return;

    const nav = root.querySelector('nav.sheet-tabs');
    const sampleNavItem = nav?.querySelector('[data-action="tab"][data-tab]');
    const group = sampleNavItem?.dataset.group;
    const existingTabs = group
        ? [...root.querySelectorAll(`.tab[data-group="${group}"]`)].filter(el => el.dataset.tab !== TAB_ID)
        : [];
    if (!nav || !existingTabs.length) {
        console.warn("Lair Control | Could not find the Scene Config tabs. Tab injection failed.");
        return;
    }

    // The hook runs on every render, and partial re-renders can replace the
    // nav while leaving our panel behind. Start clean so we never duplicate.
    root.querySelectorAll(`[data-tab="${TAB_ID}"]`).forEach(el => el.remove());

    // Matching the native markup (data-action="tab" + data-group) means the
    // sheet's own changeTab() switches to and from our tab; no listeners
    // of our own are needed.
    const navItem = document.createElement('a');
    navItem.dataset.action = 'tab';
    navItem.dataset.group = group;
    navItem.dataset.tab = TAB_ID;
    navItem.innerHTML = '<i class="fas fa-dungeon" inert></i> <span>Lair Control</span>';
    nav.append(navItem);

    const listId = `lair-control-entities-${scene.id}`;
    const panel = document.createElement('section');
    panel.classList.add('tab');
    panel.dataset.group = group;
    panel.dataset.tab = TAB_ID;
    panel.innerHTML = `
        <div class="form-group">
            <label>Home Assistant Entity</label>
            <div class="form-fields">
                <input type="text" name="flags.${MODULE_ID}.haEntity" list="${listId}" placeholder="scene.my_dungeon_scene">
                <datalist id="${listId}"></datalist>
            </div>
            <p class="hint">Select or enter the Entity ID to turn on when this Scene is activated.</p>
        </div>
    `;
    // Set via the DOM rather than the template so the value can't break out
    // of the attribute.
    panel.querySelector('input').value = scene.getFlag(MODULE_ID, 'haEntity') || "";

    // Sit alongside the native panels (and above the footer).
    existingTabs[existingTabs.length - 1].after(panel);

    // If a re-render happened while our tab was open, keep it open.
    if (app.tabGroups?.[group] === TAB_ID) {
        navItem.classList.add('active');
        panel.classList.add('active');
    }

    // Fill the picker in the background, so a slow or unreachable Home
    // Assistant never delays or blocks the dialog.
    haClient.fetchEntities().then(entities => {
        const datalist = panel.querySelector('datalist');
        datalist.replaceChildren(...entities.map(id => {
            const option = document.createElement('option');
            option.value = id;
            return option;
        }));
    });
});

Hooks.on('updateScene', (scene, changed, options, userId) => {
    if (!isPrimaryGM()) return;

    // Only fire when this Scene is being made the active/live Scene for
    // players (the "Activate Scene" button) - not on every edit, and not
    // just because the GM is browsing/previewing a Scene on their canvas.
    if (changed.active !== true) return;

    haClient.activate(scene.getFlag(MODULE_ID, 'haEntity'));
});
