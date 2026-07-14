# Capturador de Multimedia (Extensión de Chrome)

Este proyecto es una extensión de Chrome (Manifest V3) de nivel profesional, acompañada por un servidor local en Node.js, diseñada para buscar, listar, copiar en formato de hoja de cálculo y descargar de forma secuencial vídeos y audios utilizando `yt-dlp.exe` y `ffmpeg.exe`.

---

## 🎨 Identidad Visual y Diseño
* **Logotipo Profesional Integrado**: La extensión cuenta con un icono personalizado de alta calidad (`icon128.png`) integrado en su configuración (`manifest.json`) que la hace visible en el navegador.
* **Interfaz de Usuario Premium**: Diseñada en base a una paleta oscura y moderna con transiciones suaves, efectos interactivos y un panel de progreso animado y completo.

---

## 🚀 Características y Funcionalidades Principales

La extensión se divide en cuatro motores de búsqueda especializados:

1. **Buscar Vimeo (Scraper Avanzado)**:
   * Detecta automáticamente reproductores integrados e iframes de Vimeo (incluso en contenedores complejos o privados como Google Sites).
   * Extrae de forma inteligente el título del vídeo buscando etiquetas de cabecera o textos inmediatamente anteriores en el DOM.
   * Decodifica entidades HTML (como `&amp;` por `&`) en las URLs capturadas para garantizar enlaces limpios compatibles con `yt-dlp`.

2. **Buscar Vídeo (Vídeos Directos)**:
   * Escanea la página activa localizando reproductores nativos `<video>`, etiquetas `<source>` y enlaces directos a ficheros de vídeo (`.mp4`, `.m4v`, `.mkv`, `.mov`, `.webm`, `.avi`, `.flv`, `.ogv`).
   * Recupera títulos inteligentes del entorno de la página o de reproductores compatibles como `JWPlayer`.
   * **Nombre Limpio**: Para vídeos directos, el archivo de descarga se guarda en formato limpio (`Título.ext`) sin añadir IDs entre corchetes.

3. **Buscar Audio (Audios Directos)**:
   * Localiza reproductores de audio `<audio>`, etiquetas `<source>` y enlaces de descarga a archivos de audio comunes (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.aac`).
   * Reutiliza de manera optimizada el mismo motor de descarga secuencial de `yt-dlp` para ofrecer la barra de progreso y descarga limpia de archivos de audio.

4. **YOU (YouTube & Shorts)**:
   * Captura de manera instantánea el enlace y el título de la pestaña activa en la que te encuentras (sin inyectar scripts al DOM).
   * Compatible con **vídeos de YouTube** convencionales y con **YouTube Shorts** (`youtube.com/shorts/...`).
   * Limpia el título del vídeo eliminando de forma automática el sufijo `" - YouTube"`.

---

## 🛠️ Controles Adicionales y Flujo de Descargas

* **Descargas Secuenciales e Indicadores de Progreso**:
  * Las descargas de la cola se procesan de una en una para optimizar tu conexión.
  * La interfaz muestra el progreso en tiempo real de cada archivo indicando el **porcentaje, velocidad de transferencia y tiempo restante estimado (ETA)**.
* **Fijar Ruta y Abrir Carpeta (Botón 📁)**:
  * Escribe o examina la carpeta local en la que deseas guardar tus archivos.
  * Pulsa el botón de carpeta al lado de iniciar descarga para **abrir directamente el explorador de archivos en la carpeta de destino** (creándola de forma automática si no existe).
* **Fusión Garantizada a MP4**:
  * El servidor local llama a `yt-dlp` configurándolo con la opción `--merge-output-format mp4` para empaquetar de forma transparente el mejor audio y vídeo disponible utilizando `ffmpeg.exe`.
* **Solución de Avisos de JavaScript**:
  * Utiliza la ruta de Node.js local (`process.execPath`) pasándosela a `yt-dlp` con `--js-runtimes` para evitar avisos sobre la ausencia de motor JS en descargas de YouTube.
* **Cancelar Descarga**:
  * Detiene de manera inmediata el proceso de descarga activo limpiando la cola restante mediante la finalización forzada del árbol de procesos (`taskkill /pid [pid] /f /t` en Windows).
  * **Limpieza Automática**: Borra automáticamente los archivos temporales e incompletos (como extensiones `.part`, `.ytdl`, `.temp`, etc.) generados por la descarga activa para no dejar basura en tu carpeta.
* **Copiar a Portapapeles (TSV)**:
  * Permite copiar de golpe los elementos marcados con un formato especial de tabuladores (`Título \t \t URL`) ideal para pegar de manera directa y ordenada en Microsoft Excel o Google Sheets.

---

## 📁 Estructura del Proyecto

* **manifest.json**: Manifiesto de extensión Chrome con permisos mínimos y el icono enlazado.
* **popup.html** y **popup.css**: Estilo visual y estructura del panel de la extensión.
* **popup.js**: Lógica del popup, inyección del scraper en la pestaña y comunicación de red.
* **server.js**: Servidor Node.js local que recibe las peticiones, gestiona la cola y controla el ciclo de vida de los subprocesos de descarga.
* **icon128.png**: Logotipo oficial de la extensión.
* **Servidor_descargas.bat**: Archivo por lotes que abre y levanta el servidor local Node.js.
* **Actualizar_yt-dlp.bat**: Script de Windows que actualiza `yt-dlp.exe` automáticamente a la última versión.
* **yt-dlp.exe**: Motor de descarga de media.
* **ffmpeg.exe, ffplay.exe, ffprobe.exe**: Utilidades de procesamiento de audio y vídeo de `yt-dlp`.
* **backup/**: Carpeta que contiene una copia de seguridad exacta de todo el código del proyecto antes de aplicar ajustes experimentales.

---

## 📖 Instrucciones de Uso Rápido

1. **Arranca el Servidor**: Haz doble clic sobre **[Servidor_descargas.bat](file:///d:/Documentos/Antigravity/Extensi%C3%B3n%20de%20captura/Servidor_descargas.bat)**. Verás la consola confirmando que se ejecuta en el puerto `8000`. Mantén esta ventana abierta.
2. **Carga la Extensión**: Accede a `chrome://extensions/` en Chrome, activa el *Modo de desarrollador* (esquina superior derecha), pulsa *Cargar descomprimida* y selecciona la carpeta: `d:\Documentos\Antigravity\Extensión de captura`.
3. **Fija la extensión**: Haz clic en el rompecabezas 🧩 de la barra de Chrome y pincha la chincheta 📌 del capturador.
4. **¡Prueba y descarga!**: Navega a cualquier página con contenidos multimedia, pulsa el botón del scraper correspondiente, selecciona la carpeta de descarga, marca los casilleros de los archivos que te interesen y pulsa **Comenzar Descarga**.
