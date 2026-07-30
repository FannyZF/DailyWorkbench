@echo off
chcp 65001 >nul
title 工作台 - 服务控制台
echo ============================================
echo            工作台
echo ============================================
echo.
echo   服务地址: http://localhost:3001
echo   默认账号: admin / admin123
echo   首次登录请立即修改密码
echo ============================================
echo.

cd /d "%~dp0server"

echo [启动] 正在初始化数据库...
if not exist "data" mkdir data
if not exist "uploads\originals" mkdir "uploads\originals"
if not exist "uploads\thumbnails" mkdir "uploads\thumbnails"

echo [启动] 正在启动后端服务...
start "工作台-服务" cmd /c "title 工作台-后端服务 && node src\index.js"

echo [等待] 服务启动中...
timeout /t 3 /nobreak >nul

echo [启动] 打开浏览器...
start http://localhost:3001

echo.
echo ============================================
echo  后台服务已启动！浏览器将自动打开。
echo.
echo  关闭此窗口不会停止服务。
echo  要停止服务，请关闭"工作台-服务"窗口。
echo ============================================
echo.
pause
