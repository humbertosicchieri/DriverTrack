let currentPage = 'overview';
let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    if (!api.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }

    initUser();
    initNavigation();
    initDate();
    loadDashboard();
    initModals();
    initSettings();
    initAdmin();
    
    document.getElementById('periodSelect').addEventListener('change', loadDashboard);
});

function initUser() {
    const user = api.getUser();
    if (user) {
        document.getElementById('userName').textContent = user.name;
        document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
        document.getElementById('userRole').textContent = user.role || '';
        
        if (user.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = '';
            });
        }
    }
}

function initDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('pt-BR', options);
    document.getElementById('dailyDate').value = now.toISOString().split('T')[0];
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item, .nav-subitem');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            currentPage = item.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

            if (currentPage === '2fa') {
                document.getElementById('settingsPage').classList.add('active');
                document.querySelector('.nav-item[data-page="settings"]').classList.add('active');
                document.getElementById('pageTitle').textContent = 'Autenticacao 2FA';
                populateSettings();
                return;
            }

            document.getElementById(currentPage + 'Page').classList.add('active');
            
            const titles = {
                overview: 'Visao Geral',
                earnings: 'Ganhos',
                expenses: 'Despesas',
                daily: 'Diario',
                settings: 'Configuracoes',
                admin: 'Admin'
            };
            document.getElementById('pageTitle').textContent = titles[currentPage] || '';
            
            if (currentPage === 'earnings') loadEarnings();
            if (currentPage === 'expenses') loadExpenses();
            if (currentPage === 'daily') loadDaily();
            if (currentPage === 'overview') loadDashboard();
            if (currentPage === 'settings') populateSettings();
            if (currentPage === 'admin') loadAdminData();
        });
    });

    document.getElementById('menuToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
    });

    document.getElementById('logoutBtn').addEventListener('click', () => api.logout());
    
    document.getElementById('prevDay').addEventListener('click', () => changeDay(-1));
    document.getElementById('nextDay').addEventListener('click', () => changeDay(1));
    document.getElementById('dailyDate').addEventListener('change', loadDaily);
}

function changeDay(delta) {
    const dateInput = document.getElementById('dailyDate');
    const date = new Date(dateInput.value);
    date.setDate(date.getDate() + delta);
    dateInput.value = date.toISOString().split('T')[0];
    loadDaily();
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
}

const categoryLabels = {
    combustivel: 'Combustivel',
    manutencao: 'Manutencao',
    seguro: 'Seguro',
    lavagem: 'Lavagem',
    alimentacao: 'Alimentacao',
    estacionamento: 'Estacionamento',
    taxa_plataforma: 'Taxa Plataforma',
    imposto: 'Imposto',
    celular: 'Celular',
    outros: 'Outros'
};

const categoryIcons = {
    combustivel: '\u26FD',
    manutencao: '\uD83D\uDD27',
    seguro: '\uD83D\uDEE1\uFE0F',
    lavagem: '\uD83D\uDEBF',
    alimentacao: '\uD83C\uDF54',
    estacionamento: '\u267F',
    taxa_plataforma: '\uD83D\uDCF1',
    imposto: '\uD83D\uDCCB',
    celular: '\uD83D\uDCDE',
    outros: '\uD83D\uDCE6'
};

// Dashboard
async function loadDashboard() {
    try {
        const period = document.getElementById('periodSelect').value;
        const data = await api.getDashboardSummary(period);
        
        document.getElementById('totalEarnings').textContent = formatCurrency(data.earnings.total);
        document.getElementById('totalExpenses').textContent = formatCurrency(data.expenses.total);
        document.getElementById('netProfit').textContent = formatCurrency(data.stats.netProfit);
        document.getElementById('totalTrips').textContent = data.stats.totalTrips;
        document.getElementById('avgPerTrip').textContent = formatCurrency(data.stats.avgPerTrip);
        document.getElementById('profitMargin').textContent = data.stats.profitMargin.toFixed(1) + '%';
        
        const fixedCategories = ['seguro', 'taxa_plataforma', 'imposto', 'celular'];
        const fixedTotal = data.expenses.byCategory
            .filter(e => fixedCategories.includes(e.category))
            .reduce((sum, e) => sum + e.total, 0);
        document.getElementById('fixedExpenses').textContent = formatCurrency(fixedTotal);
        
        renderExpenseRanking(data.charts.topExpenses);
        renderCharts(data);
        
    } catch (error) {
        showToast('Erro ao carregar dados', 'error');
    }
}

function renderCharts(data) {
    Object.values(charts).forEach(c => c.destroy());
    charts = {};
    
    const chartColors = {
        uber: '#276ef1',
        nine9: '#7B2FBE',
        profit: '#00d4aa',
        expense: '#ff6b6b'
    };

    const platformCtx = document.getElementById('platformChart').getContext('2d');
    charts.platform = new Chart(platformCtx, {
        type: 'doughnut',
        data: {
            labels: ['Uber', '99'],
            datasets: [{
                data: [data.earnings.uber, data.earnings.nine9],
                backgroundColor: [chartColors.uber, chartColors.nine9],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            cutout: '70%'
        }
    });

    if (data.expenses.byCategory.length > 0) {
        const expensesCtx = document.getElementById('expensesChart').getContext('2d');
        charts.expenses = new Chart(expensesCtx, {
            type: 'bar',
            data: {
                labels: data.expenses.byCategory.map(e => categoryLabels[e.category] || e.category),
                datasets: [{
                    data: data.expenses.byCategory.map(e => e.total),
                    backgroundColor: [
                        '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff',
                        '#5f27cd', '#01a3a4', '#f368e0', '#ff6348', '#7bed9f'
                    ],
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#888' }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: '#888' }
                    }
                }
            }
        });
    }

    if (data.charts.dailyEarnings.length > 0) {
        const dailyCtx = document.getElementById('dailyChart').getContext('2d');
        const allDates = [...new Set([
            ...data.charts.dailyEarnings.map(d => d.date),
            ...data.charts.dailyExpenses.map(d => d.date)
        ])].sort();

        const uberData = allDates.map(d => {
            const found = data.charts.dailyEarnings.find(e => e.date === d);
            return found ? found.uber : 0;
        });
        const nine9Data = allDates.map(d => {
            const found = data.charts.dailyEarnings.find(e => e.date === d);
            return found ? found.nine9 : 0;
        });
        const expenseData = allDates.map(d => {
            const found = data.charts.dailyExpenses.find(e => e.date === d);
            return found ? found.total : 0;
        });

        charts.daily = new Chart(dailyCtx, {
            type: 'line',
            data: {
                labels: allDates.map(d => formatDate(d)),
                datasets: [
                    {
                        label: 'Uber',
                        data: uberData,
                        borderColor: chartColors.uber,
                        backgroundColor: chartColors.uber + '20',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 3
                    },
                    {
                        label: '99',
                        data: nine9Data,
                        borderColor: chartColors.nine9,
                        backgroundColor: chartColors.nine9 + '20',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 3
                    },
                    {
                        label: 'Despesas',
                        data: expenseData,
                        borderColor: chartColors.expense,
                        backgroundColor: chartColors.expense + '20',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: {
                        labels: { color: '#888' }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#888' }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: '#888', maxTicksLimit: 10 }
                    }
                }
            }
        });
    }
}

function renderExpenseRanking(expenses) {
    const container = document.getElementById('expenseRanking');
    if (expenses.length === 0) {
        container.innerHTML = '<p class="empty-state-text">Nenhuma despesa registrada</p>';
        return;
    }

    container.innerHTML = expenses.map((e, i) => `
        <div class="ranking-item">
            <span class="ranking-position">${i + 1}</span>
            <span class="ranking-icon">${categoryIcons[e.category] || '\uD83D\uDCE6'}</span>
            <span class="ranking-name">${categoryLabels[e.category] || e.category}</span>
            <div class="ranking-bar-bg">
                <div class="ranking-bar" style="width: ${(e.total / expenses[0].total * 100)}%"></div>
            </div>
            <span class="ranking-value">${formatCurrency(e.total)}</span>
        </div>
    `).join('');
}

// Earnings
async function loadEarnings() {
    try {
        const earnings = await api.getEarnings();
        const tbody = document.getElementById('earningsTableBody');
        const empty = document.getElementById('earningsEmpty');
        
        if (earnings.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'flex';
            return;
        }
        
        empty.style.display = 'none';
        tbody.innerHTML = earnings.map(e => `
            <tr>
                <td>${formatDate(e.date)}</td>
                <td><span class="platform-badge ${e.platform}">${e.platform.toUpperCase()}</span></td>
                <td>${formatCurrency(e.gross_amount)}</td>
                <td>${e.trips}</td>
                <td>${formatCurrency(e.bonus)}</td>
                <td>${formatCurrency(e.tips)}</td>
                <td class="total-cell">${formatCurrency(e.gross_amount + e.bonus + e.tips)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon-sm" onclick="editEarning('${e.id}')" title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon-sm danger" onclick="deleteEarning('${e.id}')" title="Excluir">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Erro ao carregar ganhos', 'error');
    }
}

// Expenses
async function loadExpenses() {
    try {
        const expenses = await api.getExpenses();
        const tbody = document.getElementById('expensesTableBody');
        const empty = document.getElementById('expensesEmpty');
        
        if (expenses.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'flex';
            return;
        }
        
        empty.style.display = 'none';
        tbody.innerHTML = expenses.map(e => `
            <tr>
                <td>${formatDate(e.date)}</td>
                <td><span class="category-badge">${categoryIcons[e.category] || ''} ${categoryLabels[e.category] || e.category}</span></td>
                <td>${e.description || '-'}</td>
                <td class="expense-value">${formatCurrency(e.amount)}</td>
                <td>${e.recurring ? 'Sim' : 'Nao'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon-sm" onclick="editExpense('${e.id}')" title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon-sm danger" onclick="deleteExpense('${e.id}')" title="Excluir">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Erro ao carregar despesas', 'error');
    }
}

// Daily
async function loadDaily() {
    try {
        const date = document.getElementById('dailyDate').value;
        const data = await api.getDailyDetails(date);
        
        document.getElementById('dailyEarnings').textContent = formatCurrency(data.totalEarnings);
        document.getElementById('dailyExpenses').textContent = formatCurrency(data.totalExpenses);
        document.getElementById('dailyProfit').textContent = formatCurrency(data.netProfit);
        
        const earningsList = document.getElementById('dailyEarningsList');
        if (data.earnings.length === 0) {
            earningsList.innerHTML = '<p class="empty-state-text">Sem ganhos neste dia</p>';
        } else {
            earningsList.innerHTML = data.earnings.map(e => `
                <div class="daily-item">
                    <span class="platform-badge ${e.platform}">${e.platform.toUpperCase()}</span>
                    <span>${e.trips} viagens</span>
                    <span class="daily-item-amount">${formatCurrency(e.gross_amount + e.bonus + e.tips)}</span>
                </div>
            `).join('');
        }
        
        const expensesList = document.getElementById('dailyExpensesList');
        if (data.expenses.length === 0) {
            expensesList.innerHTML = '<p class="empty-state-text">Sem despesas neste dia</p>';
        } else {
            expensesList.innerHTML = data.expenses.map(e => `
                <div class="daily-item">
                    <span>${categoryIcons[e.category] || ''} ${categoryLabels[e.category] || e.category}</span>
                    <span>${e.description || ''}</span>
                    <span class="daily-item-amount expense">${formatCurrency(e.amount)}</span>
                </div>
            `).join('');
        }
    } catch (error) {
        showToast('Erro ao carregar dados diarios', 'error');
    }
}

// Modals
function initModals() {
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    
    document.getElementById('addEarningBtn').addEventListener('click', () => showEarningModal());
    document.getElementById('addExpenseBtn').addEventListener('click', () => showExpenseModal());
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

function showModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modalOverlay').classList.add('active');
}

function showEarningModal(data = null) {
    const isEdit = !!data;
    const today = new Date().toISOString().split('T')[0];
    
    const html = `
        <form id="earningForm" class="modal-form">
            <div class="form-row">
                <div class="form-group">
                    <label>Plataforma</label>
                    <div class="platform-selector">
                        <label class="platform-option">
                            <input type="radio" name="platform" value="uber" ${(data?.platform === 'uber' || !data) ? 'checked' : ''}>
                            <span class="platform-label uber">Uber</span>
                        </label>
                        <label class="platform-option">
                            <input type="radio" name="platform" value="99" ${data?.platform === '99' ? 'checked' : ''}>
                            <span class="platform-label nine9">99</span>
                        </label>
                    </div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="earningDate">Data</label>
                    <input type="date" id="earningDate" value="${data?.date || today}" required>
                </div>
                <div class="form-group">
                    <label for="earningTrips">Viagens</label>
                    <input type="number" id="earningTrips" value="${data?.trips || ''}" min="0" placeholder="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="earningAmount">Valor Bruto (R$)</label>
                    <input type="number" id="earningAmount" value="${data?.gross_amount || ''}" step="0.01" min="0" placeholder="0.00" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="earningBonus">Bonus (R$)</label>
                    <input type="number" id="earningBonus" value="${data?.bonus || ''}" step="0.01" min="0" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label for="earningTips">Gorjetas (R$)</label>
                    <input type="number" id="earningTips" value="${data?.tips || ''}" step="0.01" min="0" placeholder="0.00">
                </div>
            </div>
            <div class="form-group">
                <label for="earningNotes">Observacoes</label>
                <textarea id="earningNotes" rows="2" placeholder="Opcional">${data?.notes || ''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-full">
                ${isEdit ? 'Salvar Alteracoes' : 'Adicionar Ganhos'}
            </button>
        </form>
    `;
    
    showModal(isEdit ? 'Editar Ganhos' : 'Adicionar Ganhos', html);
    
    document.getElementById('earningForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            platform: document.querySelector('input[name="platform"]:checked').value,
            date: document.getElementById('earningDate').value,
            gross_amount: parseFloat(document.getElementById('earningAmount').value),
            trips: parseInt(document.getElementById('earningTrips').value) || 0,
            bonus: parseFloat(document.getElementById('earningBonus').value) || 0,
            tips: parseFloat(document.getElementById('earningTips').value) || 0,
            notes: document.getElementById('earningNotes').value
        };
        
        try {
            if (isEdit) {
                await api.updateEarning(data.id, formData);
                showToast('Ganho atualizado com sucesso', 'success');
            } else {
                await api.addEarning(formData);
                showToast('Ganho adicionado com sucesso', 'success');
            }
            closeModal();
            loadEarnings();
            loadDashboard();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

function showExpenseModal(data = null) {
    const isEdit = !!data;
    const today = new Date().toISOString().split('T')[0];
    
    const categories = Object.entries(categoryLabels).map(([key, label]) => 
        `<option value="${key}" ${data?.category === key ? 'selected' : ''}>${categoryIcons[key]} ${label}</option>`
    ).join('');
    
    const html = `
        <form id="expenseForm" class="modal-form">
            <div class="form-row">
                <div class="form-group">
                    <label for="expenseDate">Data</label>
                    <input type="date" id="expenseDate" value="${data?.date || today}" required>
                </div>
                <div class="form-group">
                    <label for="expenseCategory">Categoria</label>
                    <select id="expenseCategory" required>
                        <option value="">Selecione...</option>
                        ${categories}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="expenseAmount">Valor (R$)</label>
                    <input type="number" id="expenseAmount" value="${data?.amount || ''}" step="0.01" min="0.01" placeholder="0.00" required>
                </div>
            </div>
            <div class="form-group">
                <label for="expenseDescription">Descricao</label>
                <input type="text" id="expenseDescription" value="${data?.description || ''}" placeholder="Ex: Gasolina Shell">
            </div>
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="expenseRecurring" ${data?.recurring ? 'checked' : ''}>
                    <span>Despesa recorrente</span>
                </label>
            </div>
            <button type="submit" class="btn btn-primary btn-full">
                ${isEdit ? 'Salvar Alteracoes' : 'Adicionar Despesa'}
            </button>
        </form>
    `;
    
    showModal(isEdit ? 'Editar Despesa' : 'Adicionar Despesa', html);
    
    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            date: document.getElementById('expenseDate').value,
            category: document.getElementById('expenseCategory').value,
            amount: parseFloat(document.getElementById('expenseAmount').value),
            description: document.getElementById('expenseDescription').value,
            recurring: document.getElementById('expenseRecurring').checked
        };
        
        try {
            if (isEdit) {
                await api.updateExpense(data.id, formData);
                showToast('Despesa atualizada com sucesso', 'success');
            } else {
                await api.addExpense(formData);
                showToast('Despesa adicionada com sucesso', 'success');
            }
            closeModal();
            loadExpenses();
            loadDashboard();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

async function editEarning(id) {
    try {
        const earnings = await api.getEarnings();
        const earning = earnings.find(e => e.id === id);
        if (earning) showEarningModal(earning);
    } catch (error) {
        showToast('Erro ao carregar dados', 'error');
    }
}

async function deleteEarning(id) {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
        await api.deleteEarning(id);
        showToast('Registro excluido', 'success');
        loadEarnings();
        loadDashboard();
    } catch (error) {
        showToast('Erro ao excluir', 'error');
    }
}

async function editExpense(id) {
    try {
        const expenses = await api.getExpenses();
        const expense = expenses.find(e => e.id === id);
        if (expense) showExpenseModal(expense);
    } catch (error) {
        showToast('Erro ao carregar dados', 'error');
    }
}

async function deleteExpense(id) {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
        await api.deleteExpense(id);
        showToast('Registro excluido', 'success');
        loadExpenses();
        loadDashboard();
    } catch (error) {
        showToast('Erro ao excluir', 'error');
    }
}

// Settings
function initSettings() {
    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        
        if (newPassword !== confirmNewPassword) {
            showToast('As senhas nao coincidem', 'error');
            return;
        }
        
        if (newPassword.length < 8) {
            showToast('A nova senha deve ter pelo menos 8 caracteres', 'error');
            return;
        }
        
        try {
            await api.changePassword(currentPassword, newPassword);
            showToast('Senha alterada com sucesso', 'success');
            document.getElementById('changePasswordForm').reset();
            document.getElementById('passwordStrength').style.display = 'none';
            updatePasswordRequirements('');
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    document.getElementById('newPassword').addEventListener('input', async (e) => {
        const password = e.target.value;
        updatePasswordRequirements(password);
        if (password.length > 0) {
            try {
                const result = await api.checkPasswordStrength(password);
                const strengthEl = document.getElementById('passwordStrength');
                const fillEl = document.getElementById('strengthFill');
                const textEl = document.getElementById('strengthText');
                strengthEl.style.display = 'block';
                const colors = { fraca: '#ff6b6b', media: '#feca57', forte: '#00d4aa', muito_forte: '#276ef1' };
                const width = { fraca: '25%', media: '50%', forte: '75%', muito_forte: '100%' };
                fillEl.style.width = width[result.level] || '0%';
                fillEl.style.background = colors[result.level] || '#666';
                textEl.textContent = result.level.replace('_', ' ').toUpperCase();
                textEl.style.color = colors[result.level] || '#666';
            } catch (err) {}
        } else {
            document.getElementById('passwordStrength').style.display = 'none';
        }
    });

    document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('settingsNameInput').value.trim();
        const email = document.getElementById('settingsEmailInput').value.trim();
        
        try {
            await api.updateProfile(name, email);
            showToast('Perfil atualizado com sucesso', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    document.getElementById('deleteAccountBtn').addEventListener('click', async () => {
        if (!confirm('Tem certeza que deseja excluir sua conta? Esta acao e irreversivel.')) return;
        try {
            await api.deleteAccount();
            showToast('Conta excluida com sucesso', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    // 2FA Setup
    document.getElementById('enable2faBtn').addEventListener('click', async () => {
        try {
            const data = await api.setup2FA();
            document.getElementById('qrContainer').innerHTML = `<img src="${data.qrCode}" alt="QR Code 2FA" width="200">`;
            document.getElementById('totpSecret').textContent = data.secret;
            document.getElementById('2faSetupSection').style.display = 'none';
            document.getElementById('2faQrSection').style.display = 'block';
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    document.getElementById('confirm2faBtn').addEventListener('click', async () => {
        const code = document.getElementById('verify2faCode').value.trim();
        if (code.length !== 6) {
            showToast('Codigo deve ter 6 digitos', 'error');
            return;
        }
        try {
            await api.verify2FA(code);
            showToast('2FA habilitado com sucesso', 'success');
            document.getElementById('2faQrSection').style.display = 'none';
            document.getElementById('2faSetupSection').style.display = 'none';
            document.getElementById('2faDisableSection').style.display = 'block';
            document.getElementById('2faBadge').textContent = 'Habilitado';
            document.getElementById('2faBadge').classList.add('active');
            const user = api.getUser();
            user.totp_enabled = 1;
            api.setUser(user);
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    document.getElementById('cancel2faBtn').addEventListener('click', () => {
        document.getElementById('2faQrSection').style.display = 'none';
        document.getElementById('2faSetupSection').style.display = 'block';
        document.getElementById('verify2faCode').value = '';
    });

    // 2FA Disable
    document.getElementById('disable2faBtn').addEventListener('click', async () => {
        const password = document.getElementById('disable2faPassword').value;
        const code = document.getElementById('disable2faCode').value.trim();
        if (!password) {
            showToast('Digite sua senha', 'error');
            return;
        }
        if (code.length !== 6) {
            showToast('Codigo deve ter 6 digitos', 'error');
            return;
        }
        try {
            await api.disable2FA(password, code);
            showToast('2FA desabilitado com sucesso', 'success');
            document.getElementById('2faDisableSection').style.display = 'none';
            document.getElementById('2faSetupSection').style.display = 'block';
            document.getElementById('2faBadge').textContent = 'Desabilitado';
            document.getElementById('2faBadge').classList.remove('active');
            document.getElementById('disable2faPassword').value = '';
            document.getElementById('disable2faCode').value = '';
            const user = api.getUser();
            user.totp_enabled = 0;
            api.setUser(user);
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

function updatePasswordRequirements(password) {
    const checks = {
        reqLength: password.length >= 8,
        reqUpper: /[A-Z]/.test(password),
        reqLower: /[a-z]/.test(password),
        reqNumber: /[0-9]/.test(password),
        reqSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)
    };
    Object.entries(checks).forEach(([id, passed]) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.toggle('met', passed);
        }
    });
}

function populateSettings() {
    const user = api.getUser();
    if (user) {
        document.getElementById('settingsNameInput').value = user.name || '';
        document.getElementById('settingsEmailInput').value = user.email || '';
        document.getElementById('settingsRoleDisplay').value = user.role === 'admin' ? 'Administrador' : 'Motorista';
        document.getElementById('settingsSinceDisplay').value = user.created_at 
            ? new Date(user.created_at).toLocaleDateString('pt-BR') 
            : '-';
        
        if (user.totp_enabled) {
            document.getElementById('2faBadge').textContent = 'Habilitado';
            document.getElementById('2faBadge').classList.add('active');
            document.getElementById('2faSetupSection').style.display = 'none';
            document.getElementById('2faDisableSection').style.display = 'block';
        } else {
            document.getElementById('2faBadge').textContent = 'Desabilitado';
            document.getElementById('2faBadge').classList.remove('active');
            document.getElementById('2faSetupSection').style.display = 'block';
            document.getElementById('2faDisableSection').style.display = 'none';
        }
    }
}

// Admin
function initAdmin() {
    document.getElementById('addUserBtn').addEventListener('click', () => showUserModal());
}

async function loadAdminData() {
    try {
        const stats = await api.adminGetStats();
        document.getElementById('adminTotalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('adminTotalEarnings').textContent = formatCurrency(stats.totalEarnings || 0);
        document.getElementById('adminTotalExpenses').textContent = formatCurrency(stats.totalExpenses || 0);
        document.getElementById('adminTotalTrips').textContent = stats.totalTrips || 0;
    } catch (error) {
        // Stats endpoint may not exist
    }
    
    try {
        const users = await api.adminGetUsers();
        const tbody = document.getElementById('usersTableBody');
        const empty = document.getElementById('usersEmpty');
        
        if (users.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'flex';
            return;
        }
        
        empty.style.display = 'none';
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${escapeHtml(u.name)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td><span class="role-badge ${u.role}">${u.role === 'admin' ? 'Admin' : 'User'}</span></td>
                <td>${u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon-sm" onclick="showUserModal(${JSON.stringify(u).replace(/"/g, '&quot;')})" title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon-sm" onclick="showResetPasswordModal('${u.id}')" title="Resetar Senha">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                        </button>
                        <button class="btn-icon-sm danger" onclick="deleteUser('${u.id}')" title="Excluir">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Erro ao carregar usuarios', 'error');
    }
}

function showUserModal(data = null) {
    const isEdit = !!data;
    const name = data ? escapeHtml(data.name || '') : '';
    const email = data ? escapeHtml(data.email || '') : '';
    
    const html = `
        <form id="userForm" class="modal-form">
            <div class="form-group">
                <label for="userName">Nome</label>
                <input type="text" id="userNameInput" value="${name}" required placeholder="Nome completo">
            </div>
            <div class="form-group">
                <label for="userEmail">Email</label>
                <input type="email" id="userEmailInput" value="${email}" required placeholder="email@exemplo.com" ${isEdit ? 'readonly style="opacity:0.6"' : ''}>
            </div>
            ${!isEdit ? `
            <div class="form-group">
                <label for="userPassword">Senha</label>
                <input type="password" id="userPasswordInput" required minlength="8" placeholder="Minimo 8 caracteres (maiuscula, minuscula, numero, especial)">
            </div>
            ` : ''}
            <div class="form-group">
                <label for="userRole">Funcao</label>
                <select id="userRoleInput">
                    <option value="user" ${data?.role === 'user' || !data ? 'selected' : ''}>Motorista</option>
                    <option value="admin" ${data?.role === 'admin' ? 'selected' : ''}>Administrador</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-full">
                ${isEdit ? 'Salvar Alteracoes' : 'Criar Usuario'}
            </button>
        </form>
    `;
    
    showModal(isEdit ? 'Editar Usuario' : 'Novo Usuario', html);
    
    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            name: document.getElementById('userNameInput').value,
            email: document.getElementById('userEmailInput').value,
            role: document.getElementById('userRoleInput').value
        };
        
        if (!isEdit) {
            formData.password = document.getElementById('userPasswordInput').value;
        }
        
        try {
            if (isEdit) {
                await api.adminUpdateUser(data.id, formData);
                showToast('Usuario atualizado com sucesso', 'success');
            } else {
                await api.adminCreateUser(formData);
                showToast('Usuario criado com sucesso', 'success');
            }
            closeModal();
            loadAdminData();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

function showResetPasswordModal(userId) {
    const html = `
        <form id="resetPasswordForm" class="modal-form">
            <div class="form-group">
                <label for="resetPassword">Nova Senha</label>
                <input type="password" id="resetPasswordInput" required minlength="8" placeholder="Minimo 8 caracteres">
            </div>
            <div class="form-group">
                <label for="resetPasswordConfirm">Confirmar Senha</label>
                <input type="password" id="resetPasswordConfirmInput" required minlength="6">
            </div>
            <button type="submit" class="btn btn-primary btn-full">Resetar Senha</button>
        </form>
    `;
    
    showModal('Resetar Senha', html);
    
    document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('resetPasswordInput').value;
        const confirm = document.getElementById('resetPasswordConfirmInput').value;
        
        if (password !== confirm) {
            showToast('As senhas nao coincidem', 'error');
            return;
        }
        
        try {
            await api.adminResetPassword(userId, password);
            showToast('Senha resetada com sucesso', 'success');
            closeModal();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

async function deleteUser(id) {
    if (!confirm('Tem certeza que deseja excluir este usuario?')) return;
    try {
        await api.adminDeleteUser(id);
        showToast('Usuario excluido', 'success');
        loadAdminData();
    } catch (error) {
        showToast('Erro ao excluir usuario', 'error');
    }
}

// Toast notifications
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
