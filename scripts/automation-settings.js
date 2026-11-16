import { HomeAssistantClient } from './api.js';

const MODULE_ID = 'foundry-ha-integration';

const ENTITY_SETTINGS = [
    'nat20Entity',
    'nat1Entity',
    'gameStatusEntity',
    'combatStartEntity',
    'combatEndEntity'
];

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AutomationSettingsForm extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: 'lair-control-automation-settings',
        tag: 'form',
        classes: ['lair-control-automation-settings'],
        window: {
            title: 'Lair Control: Automation Entities',
            icon: 'fas fa-dungeon',
            contentClasses: ['standard-form']
        },
        position: { width: 480, height: 'auto' },
        form: {
            handler: AutomationSettingsForm.#onSubmit,
            closeOnSubmit: true
        }
    };

    static PARTS = {
        form: { template: `modules/${MODULE_ID}/templates/automation-settings.html` }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        for (const key of ENTITY_SETTINGS) {
            context[key] = game.settings.get(MODULE_ID, key);
        }
        return context;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        // Fill the picker in the background, so a slow or unreachable Home
        // Assistant never delays the dialog opening.
        new HomeAssistantClient().fetchEntities().then(entities => {
            const datalist = this.element?.querySelector('datalist');
            if (!datalist) return;
            datalist.replaceChildren(...entities.map(id => {
                const option = document.createElement('option');
                option.value = id;
                return option;
            }));
        });
    }

    static async #onSubmit(event, form, formData) {
        for (const key of ENTITY_SETTINGS) {
            await game.settings.set(MODULE_ID, key, (formData.object[key] ?? '').trim());
        }
    }
}
