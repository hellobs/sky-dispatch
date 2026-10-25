@echo off
rem SkyDispatch 本地预览启动器：起服务器并打开浏览器
rem 也可以不用它：直接双击 index.html 同样能玩（纯静态无构建）
cd /d "%~dp0.."
start "SkyDispatch preview" cmd /k python -m http.server 8765 --bind 127.0.0.1
timeout /t 1 >nul
start "" http://127.0.0.1:8765/
echo 预览已启动：http://127.0.0.1:8765/
