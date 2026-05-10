#!/bin/sh
set -e
cd "$(dirname "$0")"
exec node dev-server.js "${1:-8081}"
