#!/usr/bin/env bash
# 最初の確認（Node.js も Python も不要）。Node.js があれば詳しいチェック（npm run doctor）に進みます。
cd "$(dirname "$0")"
echo "🔍 MV スキルパック 環境チェック（最初の確認）"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "❌ Node.js（必須・無料）が見つかりません。このパックの本体を動かすのに必要です。"
  if [ "$(uname)" = "Darwin" ]; then CMD="brew install node"; command -v brew >/dev/null || echo "   （Homebrew が無ければ https://brew.sh の1行で入れられます）"
  else CMD="sudo apt install -y nodejs npm"; fi
  echo "   入れ方: $CMD   または公式 https://nodejs.org/ja から LTS 版"
  read -r -p "   今このコマンドを実行しますか？ [y/N] " a
  if [ "${a,,}" = "y" ]; then eval "$CMD" || { echo "   失敗しました。公式サイトから入れてください。"; exit 1; }; else exit 1; fi
fi
[ -d remotion/node_modules/remotion ] || { echo "📦 部品をインストールします（npm install、数分）"; (cd remotion && npm install) || exit 1; }
cd remotion && npm run --silent doctor -- "$@"
