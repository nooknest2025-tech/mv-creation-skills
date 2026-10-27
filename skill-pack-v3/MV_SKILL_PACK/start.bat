@echo off
chcp 65001 >nul
cd /d "%~dp0remotion"
if not exist node_modules (
  echo 初回なのでセットアップします（数分）...
  call "%~dp0setup.bat"
)
call npm run start
echo.
echo 出来上がりは projects フォルダの中の out フォルダにあります。
start "" "%~dp0projects"
pause
