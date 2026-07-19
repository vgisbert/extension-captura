# Capturador de Multimedia (Extensión de Chrome)

Este proyecto es una extensión de Chrome (Manifest V3) de nivel profesional, acompañada por un servidor local en Node.js, diseñada para buscar, listar, copiar en formato de hoja de cálculo y descargar de forma secuencial vídeos y audios utilizando `yt-dlp.exe` y `ffmpeg.exe`.

---

## 🎨 Identidad Visual y Diseño
* **Logotipo Profesional Integrado**: La extensión cuenta con un icono personalizado de alta calidad (`icon128.png`) integrado en su configuración (`manifest.json`) que la hace visible en el navegador.
* **Interfaz de Usuario Premium**: Diseñada en base a una paleta oscura y moderna con transiciones suaves, efectos interactivos y un panel de progreso animado y completo.

---

## 🚀 Características y Funcionalidades Principales

La extensión se divide en múltiples motores de búsqueda especializados que se ejecutan de forma secuencial:

1. **Buscar Vimeo (Scraper Avanzado)**:
   * Detecta automáticamente reproductores integrados e iframes de Vimeo (incluso en contenedores complejos o privados como Google Sites).
   * **Detección de Contraseñas Inteligente**: Al capturar enlaces visibles en la página o desde texto seleccionado, el sistema "camina" por la estructura de la página (DOM) hacia arriba y abajo para buscar líneas que contengan contraseñas (ej. "Contraseña: ..."), emparejando matemáticamente cada clave con su vídeo correspondiente en base a la proximidad física.
   * **Deduplicación Robusta**: Extrae dinámicamente los IDs únicos de Vimeo para evitar duplicados en la lista de resultados, independientemente del formato de la URL (`/video/123` o `vimeo.com/123`).

2. **Captura de Enlaces Genéricos y Multimedia (WhatsApp/Facebook)**:
   * **Filtro Inteligente**: Escanea todos los enlaces visibles en la pantalla (viewport) y filtra silenciosamente anuncios o basura, quedándose únicamente con direcciones multimedia (YouTube, Vimeo, ficheros `.mp4`, `.zip`, etc.).
   * **Limpieza de Parámetros**: Elimina automáticamente rastreadores y parámetros innecesarios de las URLs capturadas (como `?share=copy...`) para garantizar descargas limpias.
   * **Compatibilidad con Texto Seleccionado**: Permite al usuario subrayar texto en la pantalla y la extensión extraerá directamente los enlaces y sus contraseñas asociadas sin necesidad de hacer Ctrl+C.

3. **Buscar Vídeo y Audio Directos**:
   * Escanea la página activa localizando reproductores nativos `<video>`, `<audio>` y enlaces directos a ficheros (`.mp4`, `.mkv`, `.mp3`, `.wav`, etc.).
   * Recupera títulos inteligentes del entorno de la página o de reproductores compatibles.

4. **YOU (YouTube & Shorts)**:
   * Captura de manera instantánea el enlace y el título de la pestaña activa en la que te encuentras (sin inyectar scripts al DOM).
   * Compatible con **vídeos de YouTube** convencionales y **YouTube Shorts**.

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
* **Solución de Retos de JavaScript (Anti-Bot de YouTube)**:
  * El sistema descarga e integra automáticamente **Deno**, el cual es utilizado nativamente por `yt-dlp` para resolver los acertijos JS de YouTube.
  * **Modo Incógnito de Emergencia**: Si YouTube lanza un bloqueo antibots estricto ("HTTP 403: Forbidden") debido al uso de tu sesión (cookies), el servidor intercepta el error, desecha las cookies y reintenta la descarga automáticamente de forma anónima, saltándose la protección en menos de 1 segundo.
* **Descarga Estricta de Vídeos (No-Playlist)**:
  * Ignora de forma automática las listas de reproducción (`&list=`) para garantizar que solo se descarga el vídeo exacto solicitado, evitando descargas múltiples no deseadas.
* **Carpeta de Descargas Inteligente y Selectores Nativos**:
  * Por defecto, detecta dinámicamente la carpeta de *Descargas* de tu usuario de Windows. Además, el botón "Examinar" utiliza PowerShell en Base64 para mostrar siempre el diálogo de selección en primer plano, sin bloqueos.
* **Cancelar Descarga**:
  * Detiene de manera inmediata el proceso de descarga activo limpiando la cola restante mediante la finalización forzada del árbol de procesos (`taskkill /pid [pid] /f /t` en Windows).
  * **Limpieza Automática**: Borra automáticamente los archivos temporales e incompletos (como extensiones `.part`, `.ytdl`, `.temp`, etc.) generados por la descarga activa para no dejar basura en tu carpeta.
* **Copiar a Portapapeles (TSV) Avanzado**:
  * Permite copiar de golpe los elementos marcados con un formato de tabuladores inteligente para Microsoft Excel o Google Sheets.
  * Respeta rígidamente 4 columnas básicas: `Título limpio (sin saltos de línea)` \t `URL de la Página` \t `URL de Descarga` \t `Nombre del archivo (.mp4, .zip, etc.)`.
  * **Motor de Extracción de Descripción**: Si la página web origen contiene un campo "Descripción:", el sistema lo detectará automáticamente y añadirá una 5ª columna con la descripción plana (sin saltos de línea) para mantener tus bases de datos perfectamente documentadas.
* **Interfaz Simplificada y Portapapeles**:
  * Un único botón naranja ("ANALIZAR") agrupa de manera inteligente todas las búsquedas.
  * Dispone de un botón secundario (Icono Papelera) para limpiar el portapapeles con un clic antes de iniciar el trabajo de captura.
* **Compatibilidad Universal de Caracteres**:
  * Integración mejorada que soporta carpetas, nombres de archivo y enlaces con acentos, tildes (é, í, ñ) o caracteres especiales mediante el uso nativo de UTF-8 entre Windows y Node.js.
* **Registro (Log) Global**:
  * El servidor genera y mantiene un archivo `server.log` con todo el historial de operaciones y posibles errores, lo que facilita enormemente el diagnóstico de fallos.

---

## 📁 Estructura del Proyecto

* **manifest.json**: Manifiesto de extensión Chrome con permisos mínimos y el icono enlazado.
* **popup.html** y **popup.css**: Estilo visual y estructura del panel de la extensión.
* **popup.js**: Lógica del popup, inyección del scraper en la pestaña y comunicación de red.
* **server.js**: Servidor Node.js local que recibe las peticiones, gestiona la cola y controla el ciclo de vida de los subprocesos de descarga.
* **icon128.png**: Logotipo oficial de la extensión.
* **descarga_dependencias.bat**: Script inicial que comprueba y descarga automáticamente Node.js, Deno, yt-dlp y ffmpeg para que todo funcione de forma portátil sin requerir instalación global en Windows.
* **Servidor_descargas.bat**: Archivo por lotes que abre y levanta el servidor local Node.js.
* **Actualizar_yt-dlp.bat**: Script de Windows que actualiza `yt-dlp.exe` automáticamente a la última versión.
* **yt-dlp.exe, deno.exe**: Motor de descarga de medios y su intérprete JavaScript auxiliar para YouTube.
* **ffmpeg.exe, ffplay.exe, ffprobe.exe**: Utilidades de procesamiento de audio y vídeo de `yt-dlp`.
* **backup/**: Carpeta que contiene copias de seguridad del proyecto.

---

## 📖 Instrucciones de Uso Rápido

1. **Arranca el Servidor**: Haz doble clic sobre **Servidor_descargas.bat**. Verás la consola confirmando que se ejecuta en el puerto `8000`. Mantén esta ventana abierta.
2. **Carga la Extensión**: Accede a `chrome://extensions/` en Chrome, activa el *Modo de desarrollador* (esquina superior derecha), pulsa *Cargar descomprimida* y selecciona la carpeta de esta extensión (la carpeta donde se encuentra este archivo README).
3. **Fija la extensión**: Haz clic en el rompecabezas 🧩 de la barra de Chrome y pincha la chincheta 📌 del capturador.
4. **¡Prueba y descarga!**: Navega a cualquier página con contenidos multimedia, pulsa el botón del scraper correspondiente, selecciona la carpeta de descarga, marca los casilleros de los archivos que te interesen y pulsa **Comenzar Descarga**.
