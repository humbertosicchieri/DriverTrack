function validatePasswordComplexity(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Senha deve ter pelo menos 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Senha deve conter pelo menos 1 letra maiuscula');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Senha deve conter pelo menos 1 letra minuscula');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Senha deve conter pelo menos 1 numero');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push('Senha deve conter pelo menos 1 caractere especial (!@#$%^&* etc)');
  }
  
  return errors;
}

function getPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) score++;
  if (password.length >= 16) score++;

  if (score <= 2) return { level: 'fraca', score };
  if (score <= 4) return { level: 'media', score };
  if (score <= 5) return { level: 'forte', score };
  return { level: 'muito_forte', score };
}

module.exports = { validatePasswordComplexity, getPasswordStrength };
