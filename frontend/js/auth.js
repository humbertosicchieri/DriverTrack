let loginTempToken = null;

document.addEventListener('DOMContentLoaded', () => {
    if (api.isAuthenticated()) {
        window.location.href = 'dashboard.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const errorDiv = document.getElementById('authError');

    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            btn.classList.toggle('active');
        });
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.style.display = 'none';

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const totpCode = document.getElementById('loginTotp').value.trim();

        if (loginTempToken) {
            try {
                const btn = document.getElementById('loginBtn');
                btn.disabled = true;
                btn.innerHTML = '<span>Verificando...</span>';

                await api.login2FA(loginTempToken, totpCode);
                window.location.href = 'dashboard.html';
            } catch (error) {
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
                resetLoginBtn();
            }
            return;
        }

        try {
            const btn = document.getElementById('loginBtn');
            btn.disabled = true;
            btn.innerHTML = '<span>Entrando...</span>';

            const data = await api.login(email, password);

            if (data.requires2FA) {
                loginTempToken = data.tempToken;
                document.getElementById('passwordGroup').style.display = 'none';
                document.getElementById('totpGroup').style.display = 'block';
                document.getElementById('loginTotp').focus();
                resetLoginBtn('Verificar Codigo');
                return;
            }

            window.location.href = 'dashboard.html';
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
            resetLoginBtn();
        }
    });
});

function resetLoginBtn(text) {
    const btn = document.getElementById('loginBtn');
    btn.disabled = false;
    btn.innerHTML = `<span>${text || 'Entrar'}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
}
