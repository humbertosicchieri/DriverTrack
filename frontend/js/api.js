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
        if (data.requires2FA) {
            return data;
        }
        this.setToken(data.token);
        this.setUser(data.user);
        return data;
    }

    async login2FA(tempToken, totpCode) {
        const data = await this.request('/auth/login/2fa', {
            method: 'POST',
            body: JSON.stringify({ tempToken, totpCode })
        });
        this.setToken(data.token);
        this.setUser(data.user);
        return data;
    }

    async getMe() {
        return this.request('/auth/me');
    }

    async changePassword(currentPassword, newPassword) {
        return this.request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    }

    async updateProfile(name, email) {
        const data = await this.request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify({ name, email })
        });
        this.setUser(data);
        return data;
    }

    async deleteAccount() {
        const data = await this.request('/auth/account', { method: 'DELETE' });
        this.clearToken();
        return data;
    }

    // 2FA
    async setup2FA() {
        return this.request('/auth/2fa/setup', { method: 'POST' });
    }

    async verify2FA(code) {
        return this.request('/auth/2fa/verify', {
            method: 'POST',
            body: JSON.stringify({ code })
        });
    }

    async disable2FA(password, code) {
        return this.request('/auth/2fa/disable', {
            method: 'POST',
            body: JSON.stringify({ password, code })
        });
    }

    // Password strength
    async checkPasswordStrength(password) {
        return this.request('/auth/password-strength', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
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

    async getMonthlyHistory(months = 6) {
        return this.request(`/dashboard/history?months=${months}`);
    }

    // Admin
    async adminGetUsers() {
        return this.request('/admin/users');
    }

    async adminGetUser(id) {
        return this.request(`/admin/users/${id}`);
    }

    async adminCreateUser(data) {
        return this.request('/admin/users', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async adminUpdateUser(id, data) {
        return this.request(`/admin/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async adminDeleteUser(id) {
        return this.request(`/admin/users/${id}`, {
            method: 'DELETE'
        });
    }

    async adminResetPassword(id, password) {
        return this.request(`/admin/users/${id}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ password })
        });
    }

    async adminGetStats() {
        return this.request('/admin/stats');
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
