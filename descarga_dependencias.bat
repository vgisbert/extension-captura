@echo off
title Descargar Dependencias de Captura de Video
cd /d "%~dp0"

echo ======================================================
echo  Descargando dependencias (yt-dlp y ffmpeg)
echo ======================================================
echo.

:: Descargar yt-dlp.exe si no existe
if not exist yt-dlp.exe (
    echo Descargando yt-dlp.exe...
    curl -L -o yt-dlp.exe https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
    if errorlevel 1 (
        echo [ERROR] No se pudo descargar yt-dlp.exe usando curl. Probando con PowerShell...
        powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile 'yt-dlp.exe'"
    )
) else (
    echo yt-dlp.exe ya existe.
)

:: Descargar ffmpeg si falta alguno de los tres ejecutables
set FFMPEG_MISSING=0
if not exist ffmpeg.exe (
    echo [DETECTOR] Falta ffmpeg.exe
    set FFMPEG_MISSING=1
)
if not exist ffplay.exe (
    echo [DETECTOR] Falta ffplay.exe
    set FFMPEG_MISSING=1
)
if not exist ffprobe.exe (
    echo [DETECTOR] Falta ffprobe.exe
    set FFMPEG_MISSING=1
)

echo [DEBUG] Valor de FFMPEG_MISSING = %FFMPEG_MISSING%

:: Usamos GOTO para evitar errores de sintaxis en CMD al procesar parentesis con pipes "|"
if "%FFMPEG_MISSING%"=="0" goto :ffmpeg_exists

echo.
echo [PROCESO] Iniciando descarga de ffmpeg desde GitHub Releases (BtbN)...
curl -L -o ffmpeg.zip https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip
if errorlevel 1 goto :download_powershell

echo [PROCESO] Descarga con curl completada con exito.
goto :unpack_ffmpeg

:download_powershell
echo [PROCESO] Fallo curl, intentando descargar con PowerShell...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' -OutFile 'ffmpeg.zip'"
echo [PROCESO] Descarga con PowerShell completada.

:unpack_ffmpeg
echo.
echo [PROCESO] Descomprimiendo archivos de ffmpeg...
powershell -Command "Expand-Archive -Path 'ffmpeg.zip' -DestinationPath 'temp_ffmpeg' -Force"
echo [PROCESO] Descompresion finalizada.

echo.
echo [PROCESO] Moviendo ejecutables de ffmpeg...
powershell -Command "Get-ChildItem -Path 'temp_ffmpeg' -Filter '*.exe' -Recurse | ForEach-Object { Move-Item -Path $_.FullName -Destination '.' -Force }"
echo [PROCESO] Movimiento finalizado.

echo.
echo [PROCESO] Limpiando archivos temporales...
if exist ffmpeg.zip del /q /f ffmpeg.zip
if exist temp_ffmpeg rmdir /s /q temp_ffmpeg
goto :end_ffmpeg

:ffmpeg_exists
echo Los ejecutables de ffmpeg (ffmpeg, ffplay, ffprobe) ya existen.

:end_ffmpeg
echo.
echo ======================================================
echo  Verificando archivos descargados:
echo ======================================================
if exist yt-dlp.exe (echo  [OK] yt-dlp.exe) else (echo  [ERROR] Falta yt-dlp.exe)
if exist ffmpeg.exe (echo  [OK] ffmpeg.exe) else (echo  [ERROR] Falta ffmpeg.exe)
if exist ffplay.exe (echo  [OK] ffplay.exe) else (echo  [ERROR] Falta ffplay.exe)
if exist ffprobe.exe (echo  [OK] ffprobe.exe) else (echo  [ERROR] Falta ffprobe.exe)
echo ======================================================
echo.

pause
