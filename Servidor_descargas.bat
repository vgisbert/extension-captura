@echo off
title Servidor de Descargas - Capturador de Vimeo
cd /d "%~dp0"

echo ======================================================
echo  Iniciando Servidor de Descargas para Chrome Extension
echo ======================================================
echo.

:: Verificar si Node.js está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor, instala Node.js desde https://nodejs.org/ e intentalo de nuevo.
    echo.
    pause
    exit /b
)

:: Ejecutar el servidor Node.js
node server.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] El servidor se ha detenido inesperadamente con codigo de salida %errorlevel%.
    pause
)
