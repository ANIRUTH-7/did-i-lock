# --- Did I Lock? — production image (Fly.io / Railway / any container host) ---
FROM node:22-slim

# build tools in case better-sqlite3/sharp need to compile (prebuilds usually cover it);
# gosu lets the entrypoint drop from root to the app user (managed volumes can be root-owned)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# install production deps only (skips puppeteer/dev tooling)
COPY package*.json ./
RUN PUPPETEER_SKIP_DOWNLOAD=1 npm ci --omit=dev

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh # exec bit must not depend on the checkout (Windows strips it)
COPY . .

ENV NODE_ENV=production \
    DIL_DATA_DIR=/data \
    PORT=3000

# /data must be created and owned BEFORE VOLUME — Docker discards changes made after it,
# which would leave the volume root-owned and crash the non-root server at startup
RUN mkdir -p /data && chown -R node:node /app /data

VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# the entrypoint starts as root ONLY to fix volume ownership, then drops to `node` via gosu
ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["node", "server/index.js"]
