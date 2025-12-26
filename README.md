# Lair Control - Home Assistant Integration for Foundry VTT

Lair Control brings your tabletop experience into the real world by integrating Foundry VTT with Home Assistant. Automate your smart lights, sounds, and effects directly from your game events.

## Features

- **GM Toggle Control**: A dedicated button in the Scene Controls to quickly pause or resume the integration.
- **Critical Roll Automation**: Trigger specific Home Assistant entities (lights, scripts, etc.) when a Natural 20 or Natural 1 is rolled.
- **Combat Automation**: Automatically activate "battle mode" scenes in your room when combat starts and return to normal when it ends.
- **Scene-Level Integration**: Assign a Home Assistant entity (like a scene or script) to each Foundry Scene. Activating the scene in Foundry triggers the corresponding state in your home.
- **Entity Picker**: A searchable dropdown in the Scene Configuration that fetches your actual Home Assistant entities for easy setup.
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
4. **Automation Entities**: Set the Entity IDs (e.g., `script.lighting_crit`, `scene.combat_mode`) for the events you want to automate.

## Usage

### The Master Toggle
The primary interface is the **Dungeon Door** icon in the left-hand Scene Controls. 
- **Green**: Integration is active.
- **Red**: Integration is paused.

### Scene Sync
Open any **Scene Configuration** and navigate to the **Lair Control** tab. Select a Home Assistant entity from the searchable list. When you activate that scene for your players, the selected HA entity will be "turned on".

## Requirements

- Foundry VTT v11+ (Optimized for v12/v13)
- Home Assistant instance reachable by the GM's browser.
- A Long-Lived Access Token from Home Assistant.

## License
MIT
