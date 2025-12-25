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
        if (!enabled) return;

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
                console.log(`Home Assistant Integration: Triggered ${domain}.${service}`);
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
}
