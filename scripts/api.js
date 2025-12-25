export class HomeAssistantClient {
    constructor() {
        this.url = game.settings.get('foundry-ha-integration', 'haUrl');
        this.token = game.settings.get('foundry-ha-integration', 'haToken');
    }

    reloadSettings() {
        this.url = game.settings.get('foundry-ha-integration', 'haUrl');
        this.token = game.settings.get('foundry-ha-integration', 'haToken');
    }

    async callService(domain, service, data = {}) {
        const enabled = game.settings.get('foundry-ha-integration', 'enabled');
        console.log(`Lair Control | Enabled: ${enabled}`);
        if (!enabled) {
            console.log("Lair Control | Call skipped (Disabled)");
            return;
        }

        if (!this.url || !this.token) {
            console.warn("Home Assistant Integration: URL or Token not configured.");
            return;
        }

        const endpoint = `${this.url}/api/services/${domain}/${service}`;
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                console.error(`Home Assistant Integration: API Call Failed (${response.status})`, response.statusText);
            } else {
                console.log(`Home Assistant Integration: Triggered ${domain}.${service}`, data);
            }
        } catch (error) {
            console.error("Home Assistant Integration: Network Error", error);
        }
    }

    async setState(entityId, state, attributes = {}) {
        if (!this.url || !this.token) {
            return;
        }
        const endpoint = `${this.url}/api/states/${entityId}`;
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    state: state,
                    attributes: attributes
                })
            });
        } catch (error) {
            console.error("Home Assistant Integration: Failed to set state", error);
        }
    }

    async fetchEntities() {
        if (!this.url || !this.token) {
            console.warn("Home Assistant Integration: URL or Token not configured.");
            return [];
        }

        const endpoint = `${this.url}/api/states`;
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`Home Assistant Integration: Failed to fetch entities (${response.status})`);
                return [];
            }

            const data = await response.json();
            const allowedDomains = ['scene', 'script', 'light', 'switch', 'input_boolean', 'automation'];

            return data
                .map(entity => entity.entity_id)
                .filter(id => {
                    const domain = id.split('.')[0];
                    return allowedDomains.includes(domain);
                })
                .sort();
        } catch (error) {
            console.error("Home Assistant Integration: Network Error during fetchEntities", error);
            return [];
        }
    }
}
