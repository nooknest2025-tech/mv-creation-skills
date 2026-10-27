@echo off
chcp 65001 >nul
cd /d "%~dp0remotion"
echo ==== MV制作パック セットアップ ====
where node >nul 2>nul
if errorlevel 1 (
  echo [x] Node.js が見つかりません。
  echo     https://nodejs.org から LTS 版を入れるか、次を実行してください:
  echo     winget install OpenJS.NodeJS.LTS
  echo     入れたらこのファイルをもう一度ダブルクリック。
  pause
  exit /b 1
)
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [x] npm install に失敗しました。ネット接続を確認して、もう一度実行してください。
  pause
  exit /b 1
)
call npm run setup
call npm run fonts:fetch
if errorlevel 1 echo [!] 追加の書体のダウンロードに失敗しました（なくても動きます。あとで npm run fonts:fetch）
where python >nul 2>nul
if not errorlevel 1 (
  echo 任意の部品（目パチ・口パクの顔検出、歌詞の書き起こし）を入れます。失敗しても MV は作れます。
  python -m pip install -q -r "%~dp0requirements_optional.txt"
)
echo.
echo 準備OK！ input フォルダに曲を入れて start.bat をダブルクリックしてください。
pause
