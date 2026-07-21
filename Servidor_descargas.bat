@echo off
title Servidor de Descargas - Capturador de Vimeo
cd /d "%~dp0"

echo ======================================================
echo  Iniciando Servidor de Descargas para Chrome Extension
echo ======================================================
echo.

echo Buscando actualizaciones de yt-dlp...
yt-dlp.exe -U
echo.

:: Verificar si Node.js está instalado global o localmente
set NODE_CMD=node
if exist node.exe (
    set NODE_CMD=.\node.exe
) else (
    where node >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH ni localmente.
        echo Por favor, ejecuta descarga_dependencias.bat primero o instala Node.js desde https://nodejs.org/.
        echo.
        pause
        exit /b
    )
)

:: Ejecutar el servidor Node.js
%NODE_CMD% server.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] El servidor se ha detenido inesperadamente con codigo de salida %errorlevel%.
    pause
)
