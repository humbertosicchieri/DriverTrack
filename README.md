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

6. Acesse: `http://localhost:8000`

> Um único container (Node/Express) serve o frontend e a API. Os arquivos
> estáticos ficam embutidos na imagem. Para atualizar o frontend, faça
> `git pull` e recrie o container: `docker-compose up -d --build`.

## Deploy limpo do zero (servidor)

Se o servidor estiver rodando código/versão antiga (sintomas: tela 404, CSP
`default-src 'none'`, dados não atualizam mesmo após restart), apague
**tudo** do projeto e reconstrua. O script `deploy.sh` remove container e
imagens antigas (eliminando qualquer build velho em cache) e preserva o
volume `drivertrack_db-data` com seus dados:

```bash
git pull
bash deploy.sh
```

Verificação pós-deploy (esperado):
- `/api/health` retorna `"version":"1.2.4"` com o `build` novo.
- CSP da página é `default-src 'self'` (não `'none'`).
- Log do container: `Servidor v1.2.4 (build <timestamp>) rodando na porta 5000`.
- Página abre com os assets `?v=1.2.4` (cache-busting): o navegador sempre baixa o JS/CSS novos.

### Cache no Cloudflare/NPM

O Cloudflare costuma cachear `/js/*` e `/css/*` por até 24h, servindo JS/CSS antigos
mesmo após redeploy (sintoma: dados desatualizados na tela, pois o navegador roda o
JS velho). Para evitar:

1. **Cache-busting** (já implementado): os HTMLs referenciam os assets com `?v=<versao>`,
   criando URLs novas a cada versão. O backend serve JS/CSS com `max-age=31536000`
   (imutável) e HTML/API com `no-store`.
2. **Regra no Cloudflare**: criar uma regra para o path `/js/*` e `/css/*` com
   **Bypass cache** (ou no mínimo verificar que não há "Cache Everything").
3. Depois de cada deploy, **purgar o cache** do Cloudflare (Purge Everything ou
   custom por URL) para limpar os assets antigos que ainda tenham TTL longo.

### Sintoma: "tela não atualiza" após adicionar ganho/despesa

O rate limit agora **só bloqueia gravações** (POST/PUT/DELETE: 300 req / 15min por IP;
`/api/auth/*` = 10 / 15min). **GETs nunca são bloqueados**, então recarregar a página
não trava os dados. Se uma gravação falhar com 429 ("Muitas requisições..."), o
contador é em memória: `docker restart drivertrack-backend-1` zera imediatamente.

## Estrutura do Projeto

```
driver-tracker/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── scripts/
│   │   ├── dedupe.js        # remove despesas duplicadas
│   │   └── diagnose.js      # diagnostica dados vs. cards do dashboard
│   └── src/
│       ├── index.js         # API + serve o frontend estático
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
├── .env.example
├── .gitignore
└── README.md
```

## Segurança

- Senhas criptografadas com Bcrypt (12 rounds)
- Tokens JWT com expiração de 24h
- `JWT_SECRET` obrigatório em produção (falha rápida no boot se ausente)
- Rate limiting para prevenir brute force
- Helmet para headers de segurança HTTP
- CSP restrito (`default-src 'self'`, sem `unsafe-inline` para scripts)
- Validação de entrada em todas as rotas
- Contas desativadas são rejeitadas no login e nos tokens
- JSON malformado retorna 400 sem vazar detalhes internos
- CORS desabilitado por padrão (mesma origem)
- Container Docker com usuário não-root
- Healthcheck no docker-compose

## Licença

MIT
