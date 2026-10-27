@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 🔍 MV スキルパック 環境チェック（最初の確認）
where node >nul 2>nul
if errorlevel 1 (
  echo ❌ Node.js（必須・無料）が見つかりません。このパックの本体を動かすのに必要です。
  echo    入れ方: winget install OpenJS.NodeJS.LTS   または公式 https://nodejs.org/ja から LTS 版
  set /p A="   今このコマンドを実行しますか？ [y/N] "
  if /i "%A%"=="y" ( winget install OpenJS.NodeJS.LTS && echo 入れ終わったら、このウィンドウを閉じて doctor.bat をもう一度ダブルクリックしてください。 )
  pause
  exit /b 1
)
if not exist remotion\node_modules\remotion ( echo 📦 部品をインストールします（npm install、数分） & pushd remotion & call npm install & popd )
pushd remotion
call npm run --silent doctor -- %*
popd
pause
