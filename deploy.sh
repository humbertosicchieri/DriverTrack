#!/usr/bin/env bash
# =============================================================================
# DriverTrack - Deploy limpo do zero (container único)
#
# Remove QUALQUER container/imagem antiga do projeto e reconstrói tudo.
# Preserva o volume nomeado `drivertrack_db-data` (seus dados).
#
# Uso:
#   bash deploy.sh
#
# Requisitos: docker compose v2 (ou docker-compose v1.29+ com os bugs da v1).
# Se a v1 estiver instalada, use:  docker-compose up -d --build --force-recreate
# =============================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "==> Diretorio do projeto: $PROJECT_DIR"

# -----------------------------------------------------------------------------
# 1. Pré-checagens
# -----------------------------------------------------------------------------
if [ ! -f .env ]; then
  echo "ERRO: arquivo .env nao encontrado. Copie .env.example e ajuste o JWT_SECRET."
  exit 1
fi

if grep -q '^JWT_SECRET=change-this\|^JWT_SECRET=$' .env; then
  echo "ERRO: JWT_SECRET nao configurado corretamente no .env."
  exit 1
fi

# Detecta compose disponível (v2 preferível; v1 tem bugs ao recriar container)
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "ERRO: docker compose nao encontrado."
  exit 1
fi

# -----------------------------------------------------------------------------
# 2. Remove o container atual e TODAS as imagens antigas do projeto.
#    (O mistério de servir código velho/404 morre aqui: nada sobra em cache.)
# -----------------------------------------------------------------------------
echo "==> Parando e removendo container antigo..."
"${COMPOSE[@]}" down --remove-orphans 2>/dev/null || true

echo "==> Removendo containers do projeto (se sobraram)..."
docker ps -a --format '{{.Names}}' | grep -E '^drivertrack' | while read -r c; do
  echo "    removendo container $c"
  docker rm -f "$c" || true
done || true

echo "==> Removendo imagens antigas do projeto..."
docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^drivertrack' | while read -r img; do
  echo "    removendo imagem $img"
  docker rmi -f "$img" || true
done || true

# -----------------------------------------------------------------------------
# 3. Build limpo (sem cache) e subida
# -----------------------------------------------------------------------------
echo "==> Build limpo (--no-cache)..."
"${COMPOSE[@]}" build --no-cache

echo "==> Subindo container..."
"${COMPOSE[@]}" up -d --force-recreate

# -----------------------------------------------------------------------------
# 4. Verificação
# -----------------------------------------------------------------------------
echo "==> Aguardando o container ficar saudavel..."
CONTAINER="$(docker ps --format '{{.Names}}' | grep -E '^drivertrack' | head -n1)"
if [ -z "$CONTAINER" ]; then
  echo "ERRO: nenhum container drivertrack em execucao."
  exit 1
fi
echo "    container: $CONTAINER"

for i in $(seq 1 12); do
  HEALTH="$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo starting)"
  if [ "$HEALTH" = "healthy" ]; then
    echo "    status: healthy"
    break
  fi
  sleep 5
done

echo "==> Teste interno (porta 5000, sem passar por proxy):"
docker exec "$CONTAINER" node -e "fetch('http://127.0.0.1:5000/').then(async r=>{console.log('    status:',r.status);console.log('    CSP:',r.headers.get('content-security-policy'));}).catch(e=>console.error('    erro:',e.message))"

echo "==> Healthcheck via porta publicada (8000):"
curl -sf http://127.0.0.1:8000/api/health || echo "    (sem curl direto na porta 8000 - ok se o proxy faz o roteamento)"

echo
echo "==> Deploy concluido. Logs do container:"
"${COMPOSE[@]}" logs --tail=20
