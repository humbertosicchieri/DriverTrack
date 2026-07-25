document.addEventListener('DOMContentLoaded', () => {
    if (api.isAuthenticated()) {
        window.location.href = 'dashboard.html';
        return;
    }

    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const errorDiv = document.getElementById('authError');

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            forms.forEach(f => f.classList.remove('active'));
            
            tab.classList.add('active');
            const formId = tab.dataset.tab + 'Form';
            document.getElementById(formId).classList.add('active');
            errorDiv.style.display = 'none';
        });
    });

    // Toggle password visibility
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            btn.classList.toggle('active');
        });
    });

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.style.display = 'none';
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            const btn = loginForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<span>Entrando...</span>';
            
            await api.login(email, password);
            window.location.href = 'dashboard.html';
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
            
            const btn = loginForm.querySelector('button[type="submit"]');
            btn.disabled = false;
            btn.innerHTML = '<span>Entrar</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        }
    });

    // Register
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.style.display = 'none';
        
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirm = document.getElementById('registerConfirm').value;

        if (password !== confirm) {
            errorDiv.textContent = 'As senhas não coincidem';
            errorDiv.style.display = 'block';
            return;
        }

        try {
            const btn = registerForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<span>Criando conta...</span>';
            
            await api.register(name, email, password);
            window.location.href = 'dashboard.html';
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
            
            const btn = registerForm.querySelector('button[type="submit"]');
            btn.disabled = false;
            btn.innerHTML = '<span>Criar Conta</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
        }
    });
});