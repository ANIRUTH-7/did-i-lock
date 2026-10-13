# --- Did I Lock? — production image (Fly.io / Railway / any container host) ---
FROM node:20-slim

# build tools in case better-sqlite3/sharp need to compile (prebuilds usually cover it)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# install production deps only (skips puppeteer/dev tooling)
COPY package*.json ./
RUN PUPPETEER_SKIP_DOWNLOAD=1 npm install --omit=dev

COPY . .

ENV NODE_ENV=production \
    DIL_DATA_DIR=/data \
    PORT=3000

VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/stats').catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
