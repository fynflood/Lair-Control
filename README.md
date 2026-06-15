# Lair Control - Home Assistant Integration for Foundry VTT

Lair Control brings your tabletop experience into the real world by integrating Foundry VTT with Home Assistant. Automate your smart lights, sounds, and effects directly from your game events.

## Features

- **GM Toggle Control**: A dedicated button in the Scene Controls to quickly pause or resume the integration.
- **Critical Roll Automation**: Trigger specific Home Assistant entities (lights, scripts, etc.) when a Natural 20 or Natural 1 is rolled.
- **Combat Automation**: Automatically activate a "Combat" scene in your room when combat starts. When combat ends, the room reverts to whatever Home Assistant entity is configured for the active Foundry Scene (falling back to a global "Combat End" entity if the Scene has none configured).
- **Scene-Level Integration**: Assign a Home Assistant entity (like a scene or script) to each Foundry Scene. Activating the scene in Foundry triggers the corresponding state in your home.
- **Entity Picker**: Searchable dropdowns — in the Scene Configuration and in the module's Automation Entities settings — that fetch your actual Home Assistant entities for easy setup.
- **Game Status Sync**: Toggles a Home Assistant entity (like a "Game Active" boolean) when you start or stop your Foundry session.

## Installation

1. Open the Foundry VTT Setup screen.
2. Go to the **Add-on Modules** tab.
3. Click **Install Module**.
4. Paste the following Manifest URL: `https://github.com/fynflood/Lair-Control/releases/latest/download/module.json`
5. Click **Install**.

## Configuration

Once installed and enabled in your world:

1. Go to **Configure Settings** > **Lair Control**.
2. **Home Assistant URL**: Enter your HA instance URL (e.g., `http://192.168.1.5:8123`).
3. **Long-Lived Access Token**: Generate this in your Home Assistant User Profile (at the bottom of the page) and paste it here.
4. **Configure Automation Entities**: Opens a dialog with searchable dropdowns for the Nat 20, Nat 1, Game Status, Combat Start, and Combat End entities/scenes (e.g., `script.lighting_crit`, `scene.combat_mode`).

## Usage

### The Master Toggle
The primary interface is the **Dungeon Door** icon in the left-hand Scene Controls. 
- **Green**: Integration is active.
- **Red**: Integration is paused.

### Scene Sync
Open any **Scene Configuration** and navigate to the **Lair Control** tab. Select a Home Assistant entity from the searchable list. When you activate that scene for your players, the selected HA entity will be "turned on".

### Combat Sync
When combat starts, the **Combat Start** entity/scene (set under **Configure Automation Entities**) is activated. When combat ends, Lair Control re-activates the active Scene's own Home Assistant entity (from **Scene Sync**, above) so the room returns to that Scene's lighting. If the active Scene has no entity configured, the global **Combat End** entity is used instead.

## Requirements

- Foundry VTT v11+ (Optimized for v12/v13)
- Home Assistant instance reachable by the GM's browser.
- A Long-Lived Access Token from Home Assistant.

## License
MIT
