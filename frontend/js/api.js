const API_BASE = '/api';

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('drivertrack_token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('drivertrack_token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('drivertrack_token');
        localStorage.removeItem('drivertrack_user');
    }

    getUser() {
        const user = localStorage.getItem('drivertrack_user');
        return user ? JSON.parse(user) : null;
    }

    setUser(user) {
        localStorage.setItem('drivertrack_user', JSON.stringify(user));
    }

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.errors?.[0]?.msg || 'Erro na requisição');
        }

        return data;
    }

    // Auth
    async login(email, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        this.setToken(data.token);
        this.setUser(data.user);
        return data;
    }

    async register(name, email, password) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
        this.setToken(data.token);
        this.setUser(data.user);
        return data;
    }

    async getMe() {
        return this.request('/auth/me');
    }

    // Earnings
    async getEarnings(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/earnings?${query}`);
    }

    async addEarning(data) {
        return this.request('/earnings', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateEarning(id, data) {
        return this.request(`/earnings/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteEarning(id) {
        return this.request(`/earnings/${id}`, {
            method: 'DELETE'
        });
    }

    // Expenses
    async getExpenses(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/expenses?${query}`);
    }

    async addExpense(data) {
        return this.request('/expenses', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateExpense(id, data) {
        return this.request(`/expenses/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteExpense(id) {
        return this.request(`/expenses/${id}`, {
            method: 'DELETE'
        });
    }

    async getCategories() {
        return this.request('/expenses/categories');
    }

    // Dashboard
    async getDashboardSummary(period = 'month') {
        return this.request(`/dashboard/summary?period=${period}`);
    }

    async getDailyDetails(date) {
        return this.request(`/dashboard/daily?date=${date}`);
    }

    logout() {
        this.clearToken();
        window.location.href = 'index.html';
    }

    isAuthenticated() {
        return !!this.token;
    }
}

const api = new ApiClient();