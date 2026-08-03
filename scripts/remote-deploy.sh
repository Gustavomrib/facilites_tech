#!/usr/bin/env bash
# Runs ON the production host (via deploy.yml/rollback.yml over SSH), from the
# directory containing backend/docker-compose.yml and backend/.env — NOT
# meant to run on a dev machine. Pulls the given image tag and restarts the
# api service with it; does not rebuild, does not touch the postgres service.
#
# Usage: remote-deploy.sh <image-ref>
set -euo pipefail

IMAGE="${1:?usage: remote-deploy.sh <image-ref>, e.g. ghcr.io/org/repo-backend:sha}"
COMPOSE_DIR="${COMPOSE_DIR:-$(dirname "$0")/../backend}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health/ready}"

cd "$COMPOSE_DIR"

export IMAGE
echo "Pulling $IMAGE..."
docker compose pull api

echo "Starting $IMAGE (this also runs 'prisma migrate deploy' — see docker-compose.yml's api.command)..."
docker compose up -d api

if ! "$(dirname "$0")/wait-for-http.sh" "$HEALTH_URL" 30 2; then
  echo "New deploy failed its health check. Rolling back to the previously running image is a manual step:" >&2
  echo "  docker compose ps api   # find the previous image tag" >&2
  echo "  IMAGE=<previous-tag> docker compose up -d api" >&2
  echo "...or re-run rollback.yml with the last known-good tag." >&2
  exit 1
fi

echo "Deployed $IMAGE — health check passed."
