#!/bin/sh
# Fly.io / Railway / other managed hosts can mount /data root-owned no matter what the
# image says. Standard pattern: start as root, hand /data to the app user, drop privileges.
# If the runtime starts us as a non-root user already, we just exec the server as-is.
if [ "$(id -u)" = "0" ] && command -v gosu >/dev/null 2>&1; then
  chown -R node:node /data 2>/dev/null || true
  exec gosu node "$@"
fi
exec "$@"
