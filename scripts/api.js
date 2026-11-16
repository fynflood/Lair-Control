const MODULE_ID = 'foundry-ha-integration';

// How long to wait on Home Assistant before giving up, so an unreachable
// instance can never leave a Foundry dialog hanging.
const REQUEST_TIMEOUT_MS = 8000;

// Domains where "turn_off" is the natural opposite of "turn_on". Scenes have
// no turn_off, and script.turn_off means "abort the running script".
const REVERSIBLE_DOMAINS = ['input_boolean', 'light', 'switch'];

export class HomeAssistantClient {
    constructor() {
        this.reloadSettings();
    }

    reloadSettings() {
        // Strip trailing slashes so "http://ha:8123/" doesn't produce "//api/..."
        this.url = (game.settings.get(MODULE_ID, 'haUrl') || '').trim().replace(/\/+$/, '');
        this.token = (game.settings.get(MODULE_ID, 'haToken') || '').trim();
    }

    get configured() {
        return Boolean(this.url && this.token);
    }

    _headers() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    async callService(domain, service, data = {}, { keepalive = false } = {}) {
        if (!game.settings.get(MODULE_ID, 'enabled')) return;

        if (!this.configured) {
            console.warn('Lair Control | URL or Token not configured.');
            return;
        }

        const endpoint = `${this.url}/api/services/${domain}/${service}`;
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: this._headers(),
                body: JSON.stringify(data),
                keepalive,
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
            });

            if (!response.ok) {
                console.error(`Lair Control | API call failed (${response.status})`, response.statusText);
            } else {
                console.log(`Lair Control | Triggered ${domain}.${service}`, data);
            }
        } catch (error) {
            console.error('Lair Control | Network error', error);
        }
    }

    /**
     * "Fire" an entity, using the service that actually runs it for its domain.
     * automation.turn_on only *enables* an automation, so those use
     * automation.trigger instead.
     */
    async activate(entityId, options = {}) {
        if (!entityId) return;
        const domain = entityId.split('.')[0];
        const service = domain === 'automation' ? 'trigger' : 'turn_on';
        return this.callService(domain, service, { entity_id: entityId }, options);
    }

    /**
     * Turn an entity back off, for domains where that is meaningful.
     * Silently does nothing for scenes, scripts and automations.
     */
    async deactivate(entityId, options = {}) {
        if (!entityId) return;
        const domain = entityId.split('.')[0];
        if (!REVERSIBLE_DOMAINS.includes(domain)) return;
        return this.callService(domain, 'turn_off', { entity_id: entityId }, options);
    }

    async fetchEntities() {
        if (!this.configured) {
            console.warn('Lair Control | URL or Token not configured.');
            return [];
        }

        const endpoint = `${this.url}/api/states`;
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: this._headers(),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
            });

            if (!response.ok) {
                console.error(`Lair Control | Failed to fetch entities (${response.status})`);
                return [];
            }

            const data = await response.json();
            const allowedDomains = ['scene', 'script', 'light', 'switch', 'input_boolean', 'automation'];

            return data
                .map(entity => entity.entity_id)
                .filter(id => allowedDomains.includes(id.split('.')[0]))
                .sort();
        } catch (error) {
            console.error('Lair Control | Network error during fetchEntities', error);
            return [];
        }
    }
}
