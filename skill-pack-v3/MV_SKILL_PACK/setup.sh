#!/usr/bin/env bash
# MV制作パック セットアップ（macOS / Linux）
set -e
cd "$(dirname "$0")/remotion"
echo "==== MV制作パック セットアップ ===="
if ! command -v node >/dev/null 2>&1; then
  echo "[x] Node.js が見つかりません。https://nodejs.org から LTS 版（18 以上）を入れてください。"
  echo "    mac: brew install node / Ubuntu: sudo apt install nodejs npm（古い場合は nodesource 等）"
  exit 1
fi
npm install --no-audit --no-fund
npm run setup || true
npm run fonts:fetch || echo "[!] 追加の書体のダウンロードに失敗しました（なくても動きます。あとで npm run fonts:fetch）"
PY=$(command -v python3 || command -v python || true)
if [ -n "$PY" ]; then
  echo "任意の部品（目パチ・口パクの顔検出、歌詞の書き起こし）を入れます。失敗しても MV は作れます。"
  # Homebrew の Python（Mac）や最近の Linux は「システムに直接 pip で入れる」ことを禁止しています（PEP 668）。
  # その場合はパックの中に専用の環境（.python-deps/venv）を作って入れます。パックは自動でそちらを使います。
  if ! "$PY" -m pip install -q -r ../requirements_optional.txt 2>/dev/null; then
    VENV="../.python-deps/venv"
    if [ -x "$VENV/bin/python" ] || "$PY" -m venv "$VENV"; then
      "$VENV/bin/python" -m pip install -q --upgrade pip >/dev/null 2>&1 || true
      "$VENV/bin/python" -m pip install -q -r ../requirements_optional.txt && echo "[OK] 任意部品をパック専用の Python 環境（.python-deps/venv）に入れました" || echo "[!] pip での任意部品のインストールに失敗（スキップ。MV は作れます）"
    else
      echo "[!] Python の専用環境を作れませんでした（Ubuntu なら sudo apt install python3-venv）。任意部品はスキップします"
    fi
  fi
fi
echo
echo "準備OK！ input フォルダに曲を入れて ./start.sh を実行してください（試すだけなら: cd remotion && npm run sample）。"
