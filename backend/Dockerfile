FROM node:18-alpine
WORKDIR /app

# Install deps. .npmrc disables audit/fund noise. If a package-lock.json is
# added later, switch to `npm ci` for fully reproducible builds.
COPY backend/.npmrc ./
COPY backend/package.json ./
RUN npm install --omit=dev

# Mirror the repo layout so relative paths resolve the same as in local dev:
# /app/backend/src/index.js -> ../../frontend -> /app/frontend
COPY backend/src/ ./backend/src/
COPY backend/scripts/ ./backend/scripts/
COPY frontend/ ./frontend/
RUN echo "$(date -u +%s)" > /app/BUILD.txt
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    mkdir -p /data && \
    chown -R appuser:appgroup /app /data
USER appuser
EXPOSE 5000
CMD ["node", "backend/src/index.js"]
