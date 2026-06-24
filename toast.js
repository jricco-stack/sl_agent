import axios from "axios";

const TOAST_BASE = "https://ws-api.toasttab.com";

export class ToastClient {
    constructor() {
        this.clientId = process.env.TOAST_CLIENT_ID;
        this.clientSecret = process.env.TOAST_CLIENT_SECRET;
        this.locationGuid = process.env.TOAST_LOCATION_GUID;
        this.token = null;
        this.tokenExpiry = null;
    }

    async authenticate() {
        const response = await axios.post(`${TOAST_BASE}/authentication/v1/authentication/login`, {
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            userAccessType: "TOAST_MACHINE_CLIENT",
        });
        this.token = response.data.token.accessToken;
        this.tokenExpiry = Date.now() + (response.data.token.expiresIn * 1000);
    }

    async ensureAuth() {
        if (!this.token || Date.now() >= this.tokenExpiry - 60000) {
            await this.authenticate();
        }
    }

    get headers() {
        return {
            Authorization: `Bearer ${this.token}`,
            "Toast-Restaurant-External-ID": this.locationGuid,
        };
    }

    async getOrders(startDate, endDate) {
        await this.ensureAuth();
        const response = await axios.get(`${TOAST_BASE}/orders/v2/orders`, {
            headers: this.headers,
            params: { startDate, endDate },
        });
        return response.data;
    }

    async getMenuItems() {
        await this.ensureAuth();
        const response = await axios.get(`${TOAST_BASE}/config/v2/menus`, {
            headers: this.headers,
        });
        return response.data;
    }

    async getLaborEntries(startDate, endDate) {
        await this.ensureAuth();
        const response = await axios.get(`${TOAST_BASE}/labor/v1/timeEntries`, {
            headers: this.headers,
            params: { startDate, endDate },
        });
        return response.data;
    }
}
