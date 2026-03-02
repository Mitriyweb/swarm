#!/usr/bin/env bash
# Swarm installer
# Usage:
#   curl -sL https://github.com/Mitriyweb/swarm/releases/latest/download/install.sh | bash
#   SWARM_VERSION=v0.2.0 curl -sL ... | bash
#   SWARM_INSTALL_DIR=~/.local/bin curl -sL ... | bash

set -euo pipefail

REPO="Mitriyweb/swarm"
BINARY="swarm"
INSTALL_DIR="${SWARM_INSTALL_DIR:-/usr/local/bin}"
VERSION="${SWARM_VERSION:-latest}"

# ── Terminal colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

log()  { printf "${GREEN}▸${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}!${NC} %s\n" "$*"; }
die()  { printf "${RED}✗${NC} %s\n" "$*" >&2; exit 1; }
ok()   { printf "${GREEN}✓${NC} %s\n" "$*"; }

# ── Detect OS ────────────────────────────────────────────────────────────────
case "$(uname -s)" in
  Linux*)  OS="linux"  ;;
  Darwin*) OS="darwin" ;;
  *)       die "Unsupported OS: $(uname -s). Only Linux and macOS are supported." ;;
esac

# ── Detect architecture ──────────────────────────────────────────────────────
case "$(uname -m)" in
  x86_64|amd64)  ARCH="x64"   ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)             die "Unsupported architecture: $(uname -m)." ;;
esac

ASSET="${BINARY}-${OS}-${ARCH}"

if [ "$VERSION" = "latest" ]; then
  URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"
else
  URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"
fi

# ── Download ─────────────────────────────────────────────────────────────────
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

log "Downloading ${BOLD}swarm${NC} for ${OS}/${ARCH}..."

if command -v curl &>/dev/null; then
  curl -fsSL "$URL" -o "$TMP" \
    || die "Download failed. Is the release available? → https://github.com/${REPO}/releases"
elif command -v wget &>/dev/null; then
  wget -qO "$TMP" "$URL" \
    || die "Download failed. Is the release available? → https://github.com/${REPO}/releases"
else
  die "curl or wget is required. Please install one and retry."
fi

chmod +x "$TMP"

# ── Install ───────────────────────────────────────────────────────────────────
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP" "${INSTALL_DIR}/${BINARY}"
elif command -v sudo &>/dev/null; then
  warn "Writing to ${INSTALL_DIR} requires sudo..."
  sudo mv "$TMP" "${INSTALL_DIR}/${BINARY}"
else
  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR"
  mv "$TMP" "${INSTALL_DIR}/${BINARY}"
  warn "Installed to ~/.local/bin (no sudo available)."
  warn "Make sure it is in your PATH:"
  warn "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
ok "swarm installed → ${INSTALL_DIR}/${BINARY}"
echo
printf "  ${BOLD}swarm init${NC}       ${DIM}# configure a new multi-agent project${NC}\n"
printf "  ${BOLD}swarm --version${NC}  ${DIM}# show installed version${NC}\n"
echo
