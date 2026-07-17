const http = require('http');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 8000;

// Estado global de las descargas
let downloadState = {
  active: false,
  currentIndex: 0,
  total: 0,
  currentUrl: '',
  progress: 0,
  speed: '',
  eta: '',
  error: null,
  completedUrls: []
};

// Cola de descargas
let downloadQueue = [];
let targetFolder = '';
let currentChild = null;

// Iniciar descargas en la cola
function startNextDownload() {
  if (downloadQueue.length === 0) {
    downloadState.active = false;
    downloadState.progress = 100;
    downloadState.speed = 'Completado';
    downloadState.eta = '00:00';
    return;
  }

  downloadState.active = true;
  downloadState.currentIndex = downloadState.total - downloadQueue.length + 1;
  const currentItem = downloadQueue.shift();
  downloadState.currentUrl = currentItem.url;
  downloadState.progress = 0;
  downloadState.speed = 'Iniciando...';
  downloadState.eta = '--:--';
  downloadState.error = null;

  const ytDlpPath = path.join(__dirname, 'yt-dlp.exe');
  
  // Ejecutar yt-dlp.exe
  // -P define la ruta de descarga, -o el formato del nombre
  const urlWithoutQuery = currentItem.url.split('?')[0];
  const urlExtMatch = urlWithoutQuery.match(/\.(zip|rar|7z|pdf|epub|docx|txt)$/i);
  
  let formatTemplate;
  if (urlExtMatch) {
    const detectedExt = urlExtMatch[1];
    formatTemplate = currentItem.addIdInBrackets 
      ? `%(title)s [%(id)s].${detectedExt}` 
      : `%(title)s.${detectedExt}`;
  } else {
    formatTemplate = currentItem.addIdInBrackets 
      ? '%(title)s [%(id)s].%(ext)s' 
      : '%(title)s.%(ext)s';
  }

  const isAudioUrl = urlWithoutQuery.match(/\.(m4a|ogg|wav|aac|flac)$/i);

  const args = [
    currentItem.url,
    '-P', targetFolder,
    '-o', formatTemplate,
    '--ffmpeg-location', __dirname,
    '--merge-output-format', 'mp4',
    '--no-check-certificate',
    '--no-playlist'
  ];

  if (isAudioUrl) {
    args.push('--extract-audio', '--audio-format', 'mp3');
  }

  let tempCookieFile = null;
  if (currentItem.cookies && Array.isArray(currentItem.cookies) && currentItem.cookies.length > 0) {
    tempCookieFile = path.join(__dirname, `cookies_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.txt`);
    let content = "# Netscape HTTP Cookie File\n";
    currentItem.cookies.forEach(c => {
      const domain = c.domain || '';
      const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
      const pathVal = c.path || '/';
      const secure = c.secure ? 'TRUE' : 'FALSE';
      const expiry = c.expirationDate ? Math.round(c.expirationDate) : '0';
      const name = c.name || '';
      const value = c.value || '';
      content += `${domain}\t${includeSubdomains}\t${pathVal}\t${secure}\t${expiry}\t${name}\t${value}\n`;
    });
    try {
      fs.writeFileSync(tempCookieFile, content, 'utf8');
      args.push('--cookies', tempCookieFile);
    } catch (e) {
      console.error('Error al guardar archivo temporal de cookies:', e);
      args.push('--cookies-from-browser', 'chrome');
    }
  } else {
    args.push('--cookies-from-browser', 'chrome');
  }


  if (currentItem.referrer) {
    args.push('--referer', currentItem.referrer);
  }

  console.log(`Iniciando descarga: ${currentItem.url} en ${targetFolder}`);
  console.log(`Comando completo: yt-dlp.exe ${args.join(' ')}`);
  const envVars = Object.assign({}, process.env);
  envVars.PATH = `${__dirname};${envVars.PATH || ''}`;
  currentChild = spawn(ytDlpPath, args, { cwd: __dirname, env: envVars });

  currentChild.stdout.on('data', (data) => {
    const output = data.toString();
    
    // Intentar emparejar porcentaje, velocidad y ETA
    // Formato típico de yt-dlp: [download]  10.5% of 100.00MiB at  5.50MiB/s ETA 00:15
    const progressMatch = output.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i);
    if (progressMatch) {
      downloadState.progress = parseFloat(progressMatch[1]);
    }

    const speedMatch = output.match(/at\s+([^\s]+)/i);
    if (speedMatch) {
      downloadState.speed = speedMatch[1];
    }

    const etaMatch = output.match(/ETA\s+([^\s]+)/i);
    if (etaMatch) {
      downloadState.eta = etaMatch[1];
    }
  });

  currentChild.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('WARNING:')) {
      console.log(`[yt-dlp] ${msg}`);
    } else {
      console.error(`[yt-dlp ERROR] ${msg}`);
    }
  });

  currentChild.on('close', (code) => {
    console.log(`Proceso de descarga terminado con código: ${code}`);
    currentChild = null;

    // Eliminar archivo de cookies temporal si existe
    if (tempCookieFile) {
      try {
        if (fs.existsSync(tempCookieFile)) {
          fs.unlinkSync(tempCookieFile);
        }
      } catch (err) {
        console.error('Error al eliminar archivo temporal de cookies:', err);
      }
    }

    if (code === 0) {
      downloadState.completedUrls.push(currentItem.url);
      // Continuar con el siguiente
      startNextDownload();
    } else {
      // Si fue cancelado a propósito (código no 0, y downloadState.active cambiado a false)
      if (!downloadState.active) {
        downloadState.error = 'Descarga cancelada por el usuario.';
      } else {
        downloadState.error = `Error al descargar el vídeo (Código: ${code})`;
        downloadState.active = false;
      }
    }
  });
}

// Crear servidor HTTP
const server = http.createServer((req, res) => {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Ruta para obtener el estado de la descarga
  if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(downloadState));
    return;
  }

  // Ruta para abrir el diálogo nativo de Windows y seleccionar carpeta
  if (req.url === '/api/select-folder' && req.method === 'POST') {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = 'Selecciona la carpeta de descarga'
$f.ShowNewFolderButton = $true
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = 'Minimized'
$form.Show()
$form.BringToFront()
if ($f.ShowDialog($form) -eq 'OK') {
  Write-Output $f.SelectedPath
}
$form.Dispose()
`;
    const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
    
    exec(`powershell -Sta -NoProfile -WindowStyle Hidden -EncodedCommand ${b64}`, (error, stdout, stderr) => {
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
      const selectedPath = stdout.trim();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ folder: selectedPath }));
    });
    return;
  }

  // Ruta para obtener la carpeta de descargas por defecto
  if (req.url === '/api/default-folder' && req.method === 'GET') {
    const downloadsPath = path.join(require('os').homedir(), 'Downloads');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ folder: downloadsPath }));
    return;
  }

  // Ruta para iniciar las descargas
  if (req.url === '/api/download' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.urls || !Array.isArray(data.urls) || data.urls.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Lista de URLs inválida' }));
          return;
        }

        if (!data.downloadDir) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Ruta de descarga no especificada' }));
          return;
        }

        // Validar si la carpeta existe o crearla
        const resolvedFolder = path.resolve(data.downloadDir);
        if (!fs.existsSync(resolvedFolder)) {
          fs.mkdirSync(resolvedFolder, { recursive: true });
        }

        if (downloadState.active) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Ya hay una descarga en curso' }));
          return;
        }

        // Configurar cola
        targetFolder = resolvedFolder;
        downloadQueue = data.urls.map(item => {
          const itemUrl = (typeof item === 'string') ? item : item.url;
          const addId = (typeof item === 'string') ? !!data.addIdInBrackets : !!item.addIdInBrackets;
          return {
            url: itemUrl,
            addIdInBrackets: addId,
            referrer: data.referrer || '',
            cookies: data.cookies || ''
          };
        });
        downloadState.total = downloadQueue.length;
        downloadState.currentIndex = 0;
        downloadState.completedUrls = [];
        downloadState.active = true;

        // Comenzar proceso secuencial
        startNextDownload();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Descargas iniciadas correctamente' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

// Limpiar archivos temporales (.part, .ytdl, etc.) en caso de cancelación
function cleanTempFiles() {
  if (!targetFolder || !fs.existsSync(targetFolder)) return;
  try {
    const files = fs.readdirSync(targetFolder);
    files.forEach(file => {
      if (file.endsWith('.part') || file.endsWith('.ytdl') || file.endsWith('.temp') || file.includes('.part.')) {
        const filePath = path.join(targetFolder, file);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Archivo temporal eliminado: ${file}`);
          }
        } catch (e) {
          console.error(`Error al eliminar archivo temporal ${file}:`, e.message);
        }
      }
    });
  } catch (err) {
    console.error('Error al escanear la carpeta para limpiar temporales:', err);
  }
}

  // Ruta para cancelar descargas
  if (req.url === '/api/cancel' && req.method === 'POST') {
    downloadQueue = [];
    downloadState.active = false;
    downloadState.progress = 0;
    downloadState.speed = '';
    downloadState.eta = '';
    downloadState.error = 'Descarga cancelada por el usuario.';

    if (currentChild) {
      console.log(`Cancelando descarga del proceso PID: ${currentChild.pid}`);
      const { exec } = require('child_process');
      exec(`taskkill /pid ${currentChild.pid} /f /t`, (err) => {
        if (err) {
          console.error('Error al matar el proceso de descarga:', err);
        }
        // Esperar un instante para asegurar la liberación del archivo antes de borrar
        setTimeout(cleanTempFiles, 200);
      });
      currentChild = null;
    } else {
      cleanTempFiles();
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Descargas canceladas' }));
    return;
  }

  // Ruta para abrir la carpeta de descargas en el explorador
  if (req.url === '/api/open-folder' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.downloadDir) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Ruta no especificada' }));
          return;
        }

        const resolvedFolder = path.resolve(data.downloadDir);
        // Si no existe la carpeta, la creamos
        if (!fs.existsSync(resolvedFolder)) {
          fs.mkdirSync(resolvedFolder, { recursive: true });
        }

        console.log(`Abriendo explorador en: ${resolvedFolder}`);
        const { exec } = require('child_process');
        // Comando nativo de Windows para abrir la carpeta
        exec(`start "" "${resolvedFolder}"`, (err) => {
          if (err) {
            console.error('Error al abrir el explorador:', err);
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Explorador abierto' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 404 Not Found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

server.listen(PORT, () => {
  console.log(`Servidor de descargas ejecutándose en http://localhost:${PORT}`);
});
