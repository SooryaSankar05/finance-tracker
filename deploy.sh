#!/bin/bash
# ─────────────────────────────────────────────────────────────
# deploy.sh  —  run from the ROOT of your finance-tracker repo
# Usage:
#   ./deploy.sh           → deploys both client (Firebase) and server (Git push)
#   ./deploy.sh client    → only Firebase deploy
#   ./deploy.sh server    → only git push (triggers Render auto-deploy)
# ─────────────────────────────────────────────────────────────

set -e   # stop on any error

ROOT_DIR=$(pwd)
TARGET=${1:-"both"}   # default: deploy both

deploy_server() {
  echo ""
  echo "════════════════════════════════════"
  echo " 🚀  Pushing server to Render via Git"
  echo "════════════════════════════════════"
  cd "$ROOT_DIR"
  git add .
  git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')" || echo "  (nothing new to commit)"
  git push
  echo "  ✅  Git push done — Render will auto-deploy in ~1 min"
}

deploy_client() {
  echo ""
  echo "════════════════════════════════════"
  echo " 🔥  Building & deploying to Firebase"
  echo "════════════════════════════════════"
  cd "$ROOT_DIR/client"
  echo "  → npm run build..."
  npm run build --silent
  echo "  → firebase deploy..."
  firebase deploy --only hosting
  echo "  ✅  Firebase deploy done"
  cd "$ROOT_DIR"
}

case "$TARGET" in
  client)
    deploy_client
    ;;
  server)
    deploy_server
    ;;
  *)
    deploy_server
    deploy_client
    echo ""
    echo "🎉  All done! Your app is live."
    echo "   Client: https://finance-tracker-f62de.web.app"
    echo "   Server: https://finance-tracker-server-2sjy.onrender.com"
    ;;
esac