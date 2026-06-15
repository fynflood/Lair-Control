import { HomeAssistantClient } from './api.js';

const MODULE_ID = 'foundry-ha-integration';

const ENTITY_SETTINGS = [
    'nat20Entity',
    'nat1Entity',
    'gameStatusEntity',
    'combatStartEntity',
    'combatEndEntity'
];

export class AutomationSettingsForm extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'lair-control-automation-settings',
            title: 'Lair Control: Automation Entities',
            template: `modules/${MODULE_ID}/templates/automation-settings.html`,
            width: 480,
            height: 'auto',
            closeOnSubmit: true
        });
    }

    async getData(options = {}) {
        const data = await super.getData(options);

        const client = new HomeAssistantClient();
        const entities = await client.fetchEntities();
        data.entityOptions = entities.map(e => `<option value="${e}"></option>`).join('');

        for (const key of ENTITY_SETTINGS) {
            data[key] = game.settings.get(MODULE_ID, key);
        }

        return data;
    }

    async _updateObject(event, formData) {
        for (const key of ENTITY_SETTINGS) {
            await game.settings.set(MODULE_ID, key, formData[key] ?? '');
        }
    }
}
