@echo off
title Actualizar yt-dlp.exe
cd /d "%~dp0"

echo ======================================================
echo  Actualizando yt-dlp.exe a la ultima version
echo ======================================================
echo.

if not exist yt-dlp.exe (
    echo [ERROR] No se encuentra yt-dlp.exe en esta carpeta.
    echo Por favor, coloca yt-dlp.exe aqui antes de ejecutar este script.
    echo.
    pause
    exit /b
)

:: Ejecutar actualización
yt-dlp.exe -U

echo.
echo Proceso finalizado.
pause
