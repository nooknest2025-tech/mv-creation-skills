#!/usr/bin/env bash
# MV制作パック 起動（macOS / Linux）
cd "$(dirname "$0")"
if [ ! -d remotion/node_modules ]; then echo "初回なのでセットアップします（数分）..."; ./setup.sh || exit 1; fi
cd remotion && npm run start
echo; echo "出来上がりは projects/<曲名>/out/ にあります。"
