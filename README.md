# DriverTrack - Controle Financeiro para Motoristas

Aplicativo web profissional para controle de ganhos e despesas de motoristas de aplicativo (Uber e 99).

## Funcionalidades

- 📊 Dashboard completo com gráficos interativos
- 💰 Controle de ganhos por plataforma (Uber/99)
- 💸 Controle de despesas categorizadas
- 📅 Visão diária detalhada
- 🔐 Autenticação segura com JWT
- 📱 Design responsivo e moderno
- 🐳 Docker pronto para produção

## Categorias de Despesas

- Combustível
- Manutenção
- Seguro
- Lavagem
- Alimentação
- Estacionamento
- Taxa Plataforma
- Imposto
- Celular
- Outros

## Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Node.js, Express.js
- **Banco:** SQLite (via better-sqlite3)
- **Gráficos:** Chart.js
- **Segurança:** Helmet, JWT, Bcrypt, Rate Limiting

## Instalação com Docker

1. Clone o repositório:
```bash
git clone https://github.com/SEU-USER/driver-tracker.git
cd driver-tracker
```

2. Crie o arquivo `.env`:
```bash
cp .env.example .env
```

3. Gere um JWT_SECRET seguro:
```bash
# Linux/Mac
openssl rand -hex 32

# Windows (PowerShell)
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

4. Atualize o `.env` com o secret gerado.

5. Execute com Docker Compose:
```bash
docker-compose up -d
```

6. Acesse: `http://localhost`

## Estrutura do Projeto

```
driver-tracker/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── routes/
│       │   ├── auth.js
│       │   ├── dashboard.js
│       │   ├── earnings.js
│       │   └── expenses.js
│       └── utils/
│           ├── auth.js
│           └── database.js
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js
│       ├── auth.js
│       └── dashboard.js
├── docker-compose.yml
├── nginx.conf
├── .env.example
├── .gitignore
└── README.md
```

## Segurança

- Senhas criptografadas com Bcrypt (12 rounds)
- Tokens JWT com expiração de 24h
- Rate limiting para prevenir brute force
- Helmet para headers de segurança HTTP
- Validação de entrada em todas as rotas
- CORS configurado
- Container Docker com usuário não-root

## Licença

MIT
