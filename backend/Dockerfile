FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src/ ./src/
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    mkdir -p /data && \
    chown -R appuser:appgroup /app /data
USER appuser
EXPOSE 5000
CMD ["node", "src/index.js"]
