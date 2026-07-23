# Solución al problema de yt-dlp con vídeos privados de Vimeo (macOS API JSON)

## Descripción del problema

Recientemente, Vimeo ha modificado sus sistemas de seguridad, lo que ha provocado que la herramienta **yt-dlp** empiece a fallar al intentar extraer vídeos o subtítulos protegidos por contraseña. 

El error suele manifestarse en los registros de yt-dlp con mensajes como:
* `Unable to download macos API JSON`
* `Failed to fetch macos OAuth token: HTTP Error 401: Unauthorized`
* `HTTP Error 404: Not Found`
* `The web client only works when logged-in.`

Esto ocurre porque yt-dlp utiliza por defecto una clave API (conocida internamente como la de "macOS") que Vimeo ha bloqueado o desactivado para solicitudes no autenticadas, impidiendo obtener la información necesaria (como los subtítulos de un vídeo con contraseña).

## La Solución Definitiva

Para solucionar este inconveniente y lograr que yt-dlp vuelva a procesar enlaces de Vimeo con contraseña, es necesario aplicar **dos modificaciones** al flujo de trabajo:

### 1. Transformar la URL original al formato del reproductor incrustado ("Player URL")

El extractor principal de la página `https://vimeo.com/ID` se encuentra fuertemente protegido y restringido. Sin embargo, el reproductor embebido de Vimeo sigue permitiendo el acceso directo al vídeo mediante la contraseña proporcionada.

Antes de pasar la URL a yt-dlp, debes analizar la URL insertada por el usuario y extraer únicamente el ID numérico del vídeo, para después reconstruirla con este formato:
`https://player.vimeo.com/video/ID`

**Ejemplo de implementación en Python (usando Regex):**
```python
import re

url_original = "https://vimeo.com/1212109694?share=copy"

# Extraemos el patrón básico
link_match = re.search(r'(https://vimeo\.com/\d+)', url_original)

if link_match:
    # Extraemos sólo los dígitos (el ID)
    video_id = re.search(r'\d+', link_match.group(1)).group()
    
    # Reconstruimos la URL hacia el reproductor (player)
    url_procesada = f"https://player.vimeo.com/video/{video_id}"
```

### 2. Especificar parámetros de configuración adicionales en yt-dlp (`--extractor-args`)

Aunque la URL del reproductor suele ser suficiente, para mayor robustez es imprescindible añadir un parámetro especial `--extractor-args` en la llamada a `yt-dlp`. Este parámetro fuerza a yt-dlp a limpiar la clave API defectuosa y a utilizar el cliente web estándar, evitando cualquier intento de usar la API obsoleta.

El comando que debes ejecutar en consola o a través de subprocesos queda de la siguiente manera:

```bash
yt-dlp --video-password "CONTRASEÑA" --extractor-args "vimeo:client=web;api_key=" "https://player.vimeo.com/video/ID"
```

**Ejemplo de implementación en Python (`subprocess`):**
```python
cmd = [
    "yt-dlp",
    "-U", "-v",                        # -U actualiza yt-dlp a la última versión
    "--write-subs",                    # Descargar subtítulos
    "--skip-download",                 # No descargar el video, sólo el subtítulo
    "--video-password", "sesion13",    # La contraseña del vídeo
    "--extractor-args", "vimeo:client=web;api_key=", # ¡El Fix para la API bloqueada!
    url_procesada                      # La URL generada en el paso 1
]

resultado = subprocess.run(cmd, capture_output=True, text=True)
```

## Resumen

Al combinar el cambio a la **URL del reproductor embebido (`player.vimeo.com`)** y añadir **`vimeo:client=web;api_key=`** en los argumentos del extractor, se logra evadir los bloqueos recientes de la API de Vimeo, permitiendo a tu aplicación seguir interactuando con los vídeos privados sin requerir inicio de sesión mediante cookies.
