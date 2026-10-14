FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ARG BUILD_SHA
ARG RELEASE_VERSION
LABEL org.opencontainers.image.source="https://github.com/YGM-Studio/dashui-club" \
      org.opencontainers.image.revision=$BUILD_SHA \
      org.opencontainers.image.version=$RELEASE_VERSION
ENV BUILD_SHA=$BUILD_SHA RELEASE_VERSION=$RELEASE_VERSION
ENV NODE_ENV=production PORT=3001 DB_PATH=/app/data/community.sqlite
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
