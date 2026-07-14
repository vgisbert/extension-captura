document.addEventListener('DOMContentLoaded', () => {
  const btnVimeo = document.getElementById('btn-vimeo');
  const btnVideo = document.getElementById('btn-video');
  const btnYoutube = document.getElementById('btn-youtube');
  const btnAudio = document.getElementById('btn-audio');
  const btnZip = document.getElementById('btn-zip');
  const btnTodo = document.getElementById('btn-todo');
  const btnCopyAll = document.getElementById('btn-copy-all');
  const btnStartDownload = document.getElementById('btn-start-download');
  const btnOpenFolder = document.getElementById('btn-open-folder');
  const selectAllCheckbox = document.getElementById('select-all');
  const resultsList = document.getElementById('results-list');
  const resultsCount = document.getElementById('results-count');
  const instructionDisplay = document.getElementById('instruction-display');
  const downloadDirInput = document.getElementById('download-dir');
  
  // Elementos de progreso
  const progressContainer = document.getElementById('progress-container');
  const progressStatus = document.getElementById('progress-status');
  const progressPercentage = document.getElementById('progress-percentage');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressSpeed = document.getElementById('progress-speed');
  const progressEta = document.getElementById('progress-eta');
  const btnCancelDownload = document.getElementById('btn-cancel-download');

  let currentResults = []; // Todos los vídeos encontrados
  let statusInterval = null; // Intervalo para consultar progreso al servidor local
  let currentSearchType = 'vimeo'; // 'vimeo' o 'direct'
  
  // Cargar carpeta de descargas guardada
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['downloadDir'], (result) => {
      if (result && result.downloadDir && downloadDirInput) {
        downloadDirInput.value = result.downloadDir;
      }
    });
  }

  // Guardar carpeta al cambiar el input
  if (downloadDirInput) {
    downloadDirInput.addEventListener('change', () => {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ downloadDir: downloadDirInput.value });
      }
    });
  }

  // Botón para examinar y abrir el diálogo de selección de carpeta nativo
  const btnBrowseFolder = document.getElementById('btn-browse-folder');
  if (btnBrowseFolder) {
    btnBrowseFolder.addEventListener('click', async () => {
      try {
        btnBrowseFolder.disabled = true;
        btnBrowseFolder.textContent = 'Abriendo...';
        
        const response = await fetch('http://localhost:8000/api/select-folder', {
          method: 'POST'
        });
        
        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (jsonErr) {
          throw new Error(`Respuesta no válida del servidor local (no es JSON): "${responseText.substring(0, 100)}"`);
        }

        if (data && data.folder && downloadDirInput) {
          downloadDirInput.value = data.folder;
          if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ downloadDir: data.folder });
          }
        }
      } catch (err) {
        alert(`No se pudo conectar con el servidor local para abrir el examinador. Detalles: ${err.message}`);
      } finally {
        if (btnBrowseFolder) {
          btnBrowseFolder.disabled = false;
          btnBrowseFolder.textContent = 'Examinar...';
        }
      }
    });
  }

  // Habilitar/Deshabilitar botón de descargar según los checks marcados
  function updateDownloadButtonState() {
    const checkedBoxes = resultsList.querySelectorAll('.item-checkbox:checked');
    btnStartDownload.disabled = (checkedBoxes.length === 0);
  }

  // Checkbox de seleccionar todos
  selectAllCheckbox.addEventListener('change', () => {
    const isChecked = selectAllCheckbox.checked;
    const checkboxes = resultsList.querySelectorAll('.item-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = isChecked;
    });
    updateDownloadButtonState();
  });

  // Evento buscar Vimeo
  btnVimeo.addEventListener('click', async () => {
    currentSearchType = 'vimeo';
    if (instructionDisplay) instructionDisplay.textContent = 'Buscando vídeos de Vimeo en la página activa...';
    if (resultsList) resultsList.innerHTML = '<li class="empty-state">Buscando...</li>';
    if (resultsCount) resultsCount.textContent = '0';
    if (btnCopyAll) btnCopyAll.style.display = 'none';
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.disabled = true;
    }
    if (btnStartDownload) btnStartDownload.disabled = true;
    currentResults = [];

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        showError('No se pudo acceder a la pestaña activa.');
        return;
      }

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        showError('No se pueden buscar vídeos en páginas internas del navegador.');
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: findVimeoVideosWithTitles
      }, (results) => {
        if (chrome.runtime.lastError) {
          showError('Error al escanear la página: ' + chrome.runtime.lastError.message);
          return;
        }

        const accumulated = [];
        const addResults = (list) => {
          if (list && Array.isArray(list)) {
            list.forEach(item => {
              const urlLower = item.url.toLowerCase();
              let vimeoId = null;
              if (urlLower.includes('player.vimeo.com/video/')) {
                const match = urlLower.match(/\/video\/(\d+)/i);
                if (match) vimeoId = match[1];
              }

              const isGeneric = title => !title || title === 'Vídeo de Vimeo' || title === 'vimeo' || title.includes('player') || title === 'Enlace de Vimeo';

              const existingIndex = accumulated.findIndex(x => {
                if (vimeoId && x.url.toLowerCase().includes('/video/' + vimeoId)) return true;
                return x.url.toLowerCase() === urlLower;
              });

              if (existingIndex === -1) {
                accumulated.push({
                  title: item.title,
                  url: item.url
                });
              } else {
                const existingItem = accumulated[existingIndex];
                if (isGeneric(existingItem.title) && !isGeneric(item.title)) {
                  existingItem.title = item.title;
                }
              }
            });
          }
        };

        if (results && Array.isArray(results)) {
          results.forEach(frameRes => {
            if (frameRes && frameRes.result) {
              addResults(frameRes.result);
            }
          });
        }

        currentResults = accumulated;
        displayResults(accumulated);
      });

    } catch (error) {
      showError('Ocurrió un error inesperado: ' + error.message);
    }
  });

  // Evento buscar Vídeo directo
  if (btnVideo) {
    btnVideo.addEventListener('click', async () => {
      currentSearchType = 'direct';
      if (instructionDisplay) instructionDisplay.textContent = 'Buscando enlaces de vídeo directos (MP4, MKV, MOV...) en la página activa...';
      if (resultsList) resultsList.innerHTML = '<li class="empty-state">Buscando...</li>';
      if (resultsCount) resultsCount.textContent = '0';
      if (btnCopyAll) btnCopyAll.style.display = 'none';
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.disabled = true;
      }
      if (btnStartDownload) btnStartDownload.disabled = true;
      currentResults = [];

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          showError('No se pudo acceder a la pestaña activa.');
          return;
        }

        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          showError('No se pueden buscar vídeos en páginas internas del navegador.');
          return;
        }

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: findDirectVideos
        }, (results) => {
          if (chrome.runtime.lastError) {
            showError('Error al escanear la página: ' + chrome.runtime.lastError.message);
            return;
          }

          if (results && results[0] && results[0].result) {
            currentResults = results[0].result;
            displayResults(currentResults);
          } else {
            currentResults = [];
            displayResults([]);
          }
        });

      } catch (error) {
        showError('Ocurrió un error inesperado: ' + error.message);
      }
    });
  }

  // Evento buscar YouTube (YOU)
  if (btnYoutube) {
    btnYoutube.addEventListener('click', async () => {
      currentSearchType = 'youtube';
      if (instructionDisplay) instructionDisplay.textContent = 'Cargando enlace de YouTube de la pestaña activa...';
      if (resultsList) resultsList.innerHTML = '<li class="empty-state">Cargando...</li>';
      if (resultsCount) resultsCount.textContent = '0';
      if (btnCopyAll) btnCopyAll.style.display = 'none';
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.disabled = true;
      }
      if (btnStartDownload) btnStartDownload.disabled = true;
      currentResults = [];

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          showError('No se pudo acceder a la pestaña activa.');
          return;
        }

        const url = tab.url || '';
        // Limpiar el título quitando el sufijo " - YouTube"
        const title = tab.title ? tab.title.replace(/\s*-\s*YouTube$/i, '') : 'Vídeo de YouTube';

        if (url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('youtube.com/shorts/')) {
          currentResults = [{ title, url }];
          displayResults(currentResults);
        } else {
          showError('La pestaña activa no contiene un vídeo o Short de YouTube válido.');
          displayResults([]);
        }
      } catch (error) {
        showError('Ocurrió un error al obtener la pestaña activa: ' + error.message);
      }
    });
  }

  // Evento buscar Audio directo
  if (btnAudio) {
    btnAudio.addEventListener('click', async () => {
      currentSearchType = 'audio';
      if (instructionDisplay) instructionDisplay.textContent = 'Buscando enlaces de audio directos (MP3, WAV, M4A...) en la página activa...';
      if (resultsList) resultsList.innerHTML = '<li class="empty-state">Buscando...</li>';
      if (resultsCount) resultsCount.textContent = '0';
      if (btnCopyAll) btnCopyAll.style.display = 'none';
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.disabled = true;
      }
      if (btnStartDownload) btnStartDownload.disabled = true;
      currentResults = [];

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          showError('No se pudo acceder a la pestaña activa.');
          return;
        }

        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          showError('No se pueden buscar archivos de audio en páginas internas del navegador.');
          return;
        }

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: findAudioLinks
        }, (results) => {
          if (chrome.runtime.lastError) {
            showError('Error al escanear la página: ' + chrome.runtime.lastError.message);
            return;
          }

          if (results && results[0] && results[0].result) {
            currentResults = results[0].result;
            displayResults(currentResults);
          } else {
            currentResults = [];
            displayResults([]);
          }
        });

      } catch (error) {
        showError('Ocurrió un error inesperado: ' + error.message);
      }
    });
  }

  // Evento buscar Zip/Otros
  if (btnZip) {
    btnZip.addEventListener('click', async () => {
      currentSearchType = 'zip';
      if (instructionDisplay) instructionDisplay.textContent = 'Buscando descargas de archivos Zip, RAR, PDF... en la página activa...';
      if (resultsList) resultsList.innerHTML = '<li class="empty-state">Buscando...</li>';
      if (resultsCount) resultsCount.textContent = '0';
      if (btnCopyAll) btnCopyAll.style.display = 'none';
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.disabled = true;
      }
      if (btnStartDownload) btnStartDownload.disabled = true;
      currentResults = [];

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          showError('No se pudo acceder a la pestaña activa.');
          return;
        }

        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          showError('No se pueden buscar archivos en páginas internas del navegador.');
          return;
        }

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: findZipDocs
        }, (results) => {
          if (chrome.runtime.lastError) {
            showError('Error al escanear la página: ' + chrome.runtime.lastError.message);
            return;
          }

          if (results && results[0] && results[0].result) {
            currentResults = results[0].result;
            displayResults(currentResults);
          } else {
            currentResults = [];
            displayResults([]);
          }
        });

      } catch (error) {
        showError('Ocurrió un error inesperado: ' + error.message);
      }
    });
  }

  // Evento buscar TODO
  if (btnTodo) {
    btnTodo.addEventListener('click', async () => {
      currentSearchType = 'todo';
      if (instructionDisplay) instructionDisplay.textContent = 'Buscando todo (Vimeo, YouTube, Vídeo, Audio, Documentos)...';
      if (resultsList) resultsList.innerHTML = '<li class="empty-state">Buscando...</li>';
      if (resultsCount) resultsCount.textContent = '0';
      if (btnCopyAll) btnCopyAll.style.display = 'none';
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.disabled = true;
      }
      if (btnStartDownload) btnStartDownload.disabled = true;
      currentResults = [];

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          showError('No se pudo acceder a la pestaña activa.');
          return;
        }

        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          showError('No se pueden buscar archivos en páginas internas del navegador.');
          return;
        }

        const tabId = tab.id;
        const accumulated = [];
        const seenUrls = new Set();
        const addResults = (list, searchType) => {
          if (list && Array.isArray(list)) {
            list.forEach(item => {
              const urlLower = item.url.toLowerCase();
              let vimeoId = null;
              if (urlLower.includes('player.vimeo.com/video/')) {
                const match = urlLower.match(/\/video\/(\d+)/i);
                if (match) vimeoId = match[1];
              }

              const isGeneric = title => !title || title === 'Vídeo de Vimeo' || title === 'vimeo' || title.includes('player') || title === 'Enlace de Vimeo' || title.includes('Portapapeles');

              const existingIndex = accumulated.findIndex(x => {
                if (vimeoId && x.url.toLowerCase().includes('/video/' + vimeoId)) return true;
                return x.url.toLowerCase() === urlLower;
              });

              if (existingIndex === -1) {
                accumulated.push({
                  title: item.title,
                  url: item.url,
                  isVimeo: (searchType === 'vimeo' || item.isVimeo || urlLower.includes('vimeo.com')),
                  searchType: searchType || item.searchType || 'todo'
                });
              } else {
                const existingItem = accumulated[existingIndex];
                if (isGeneric(existingItem.title) && !isGeneric(item.title)) {
                  existingItem.title = item.title;
                }
              }
            });
          }
        };

        // 0. Portapapeles (analizar enlaces multimedia, Vimeo o YouTube del portapapeles)
        try {
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText) {
            const urlRegex = /(https?:\/\/[^\s"'>]+)/gi;
            const urls = clipboardText.match(urlRegex) || [];
            const clipboardItems = [];
            
            const videoExtensions = /\.(mp4|m4v|mkv|mov|webm|avi|flv|ogv)(?:\?.*)?$/i;
            const audioExtensions = /\.(mp3|wav|m4a|ogg|aac|flac)(?:\?.*)?$/i;
            const docExtensions = /\.(zip|rar|7z|pdf|epub|docx|txt)(?:\?.*)?$/i;

            urls.forEach(url => {
              const urlLower = url.toLowerCase();
              if (urlLower.includes('youtube.com/watch') || urlLower.includes('youtu.be/') || urlLower.includes('youtube.com/shorts/')) {
                clipboardItems.push({
                  title: 'Enlace de YouTube (Portapapeles)',
                  url: url,
                  searchType: 'youtube'
                });
              } else if (urlLower.includes('vimeo.com')) {
                clipboardItems.push({
                  title: 'Enlace de Vimeo (Portapapeles)',
                  url: url,
                  searchType: 'vimeo',
                  isVimeo: true
                });
              } else if (urlLower.match(videoExtensions)) {
                clipboardItems.push({
                  title: 'Vídeo Directo (Portapapeles)',
                  url: url,
                  searchType: 'direct'
                });
              } else if (urlLower.match(audioExtensions)) {
                clipboardItems.push({
                  title: 'Audio Directo (Portapapeles)',
                  url: url,
                  searchType: 'audio'
                });
              } else if (urlLower.match(docExtensions)) {
                clipboardItems.push({
                  title: 'Archivo/Documento (Portapapeles)',
                  url: url,
                  searchType: 'zip'
                });
              }
            });

            if (clipboardItems.length > 0) {
              addResults(clipboardItems);
            }
          }
        } catch (clipErr) {
          console.warn('No se pudo acceder al portapapeles o no contiene texto:', clipErr);
        }

        // 1. YouTube (desde la pestaña)
        const tabUrl = tab.url || '';
        if (tabUrl.includes('youtube.com/watch') || tabUrl.includes('youtu.be/') || tabUrl.includes('youtube.com/shorts/')) {
          const ytTitle = tab.title ? tab.title.replace(/\s*-\s*YouTube$/i, '') : 'Vídeo de YouTube';
          addResults([{ title: ytTitle, url: tabUrl }], 'youtube');
        }

        // Ejecutar los escaneos secuenciales e ir acumulando
        // 2. Vimeo
        try {
          const vimeoRes = await new Promise((resolve) => {
            chrome.scripting.executeScript({ 
              target: { tabId, allFrames: true }, 
              func: findVimeoVideosWithTitles 
            }, resolve);
          });
          if (vimeoRes && Array.isArray(vimeoRes)) {
            vimeoRes.forEach(frame => {
              if (frame && frame.result) addResults(frame.result, 'vimeo');
            });
          }
        } catch (e) { console.error('Error Vimeo:', e); }

        // 3. Vídeos Directos
        try {
          const videoRes = await new Promise((resolve) => {
            chrome.scripting.executeScript({ target: { tabId }, func: findDirectVideos }, resolve);
          });
          if (videoRes && videoRes[0]) addResults(videoRes[0].result, 'direct');
        } catch (e) { console.error('Error Vídeos:', e); }

        // 4. Audios Directos
        try {
          const audioRes = await new Promise((resolve) => {
            chrome.scripting.executeScript({ target: { tabId }, func: findAudioLinks }, resolve);
          });
          if (audioRes && audioRes[0]) addResults(audioRes[0].result, 'audio');
        } catch (e) { console.error('Error Audios:', e); }

        // 5. Zip / Otros Documentos
        try {
          const zipRes = await new Promise((resolve) => {
            chrome.scripting.executeScript({ target: { tabId }, func: findZipDocs }, resolve);
          });
          if (zipRes && zipRes[0]) addResults(zipRes[0].result, 'zip');
        } catch (e) { console.error('Error Zip:', e); }

        currentResults = accumulated;
        displayResults(accumulated);

      } catch (error) {
        showError('Ocurrió un error inesperado: ' + error.message);
      }
    });
  }

  // Copiar todo a TSV (solo los marcados)
  btnCopyAll.addEventListener('click', () => {
    const checkedBoxes = resultsList.querySelectorAll('.item-checkbox:checked');
    if (checkedBoxes.length === 0) return;

    const urlsToCopy = [];
    checkedBoxes.forEach(cb => {
      const index = parseInt(cb.dataset.index);
      urlsToCopy.push(currentResults[index]);
    });

    const tsvContent = urlsToCopy
      .map(item => `${item.title}\t\t${item.url}`)
      .join('\n');

    // Función auxiliar de copia robusta con fallback
    const performCopy = (text) => {
      return new Promise((resolve, reject) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text)
            .then(resolve)
            .catch(err => {
              console.warn('Fallo Clipboard API, usando fallback:', err);
              executeFallbackCopy(text) ? resolve() : reject();
            });
        } else {
          executeFallbackCopy(text) ? resolve() : reject();
        }
      });
    };

    const executeFallbackCopy = (text) => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful;
      } catch (err) {
        console.error('Fallo de copia por fallback:', err);
        return false;
      }
    };

    performCopy(tsvContent).then(() => {
      const originalText = btnCopyAll.textContent;
      btnCopyAll.textContent = '¡Copiado!';
      btnCopyAll.style.backgroundColor = '#10b981';
      btnCopyAll.style.borderColor = '#10b981';
      btnCopyAll.style.color = '#ffffff';

      setTimeout(() => {
        btnCopyAll.textContent = originalText;
        btnCopyAll.style.backgroundColor = '';
        btnCopyAll.style.borderColor = '';
        btnCopyAll.style.color = '';
      }, 2000);
    }).catch(() => {
      alert('No se pudo copiar al portapapeles. Por favor, vuelve a intentarlo.');
    });
  });

  // Comenzar descarga
  btnStartDownload.addEventListener('click', async () => {
    const checkedBoxes = resultsList.querySelectorAll('.item-checkbox:checked');
    if (checkedBoxes.length === 0) return;

    const urlsToDownload = [];
    checkedBoxes.forEach(cb => {
      const index = parseInt(cb.dataset.index);
      const item = currentResults[index];
      urlsToDownload.push({
        url: item.url,
        addIdInBrackets: !!item.isVimeo || (currentSearchType === 'vimeo')
      });
    });

    const downloadDir = downloadDirInput.value.trim();
    if (!downloadDir) {
      alert('Por favor, indica una carpeta de descarga válida.');
      return;
    }

    btnStartDownload.disabled = true;
    if (btnVimeo) btnVimeo.disabled = true;
    if (btnVideo) btnVideo.disabled = true;
    if (btnYoutube) btnYoutube.disabled = true;
    if (btnAudio) btnAudio.disabled = true;
    if (btnZip) btnZip.disabled = true;
    if (btnTodo) btnTodo.disabled = true;
    progressContainer.style.display = 'block';
    progressStatus.textContent = 'Iniciando conexión con el servidor...';
    progressBarFill.style.width = '0%';
    progressPercentage.textContent = '0%';

    let referrer = '';
    let cookiesPayload = [];
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        referrer = tab.url;
        try {
          cookiesPayload = await chrome.cookies.getAll({ url: tab.url });
        } catch (cookieErr) {
          console.warn('No se pudieron obtener las cookies via chrome.cookies:', cookieErr);
        }
      }
    } catch (tabErr) {
      console.warn('No se pudo obtener la pestaña activa:', tabErr);
    }

    try {
      const response = await fetch('http://localhost:8000/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          urls: urlsToDownload,
          downloadDir: downloadDir,
          addIdInBrackets: (currentSearchType === 'vimeo'),
          referrer: referrer,
          cookies: cookiesPayload
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al iniciar la descarga.');
      }

      // Empezar a monitorear el progreso
      startPollingProgress();

    } catch (err) {
      alert(`Servidor local no disponible. Asegúrate de ejecutar "node server.js" en la carpeta del proyecto. Detalles: ${err.message}`);
      progressContainer.style.display = 'none';
      btnStartDownload.disabled = false;
      if (btnVimeo) btnVimeo.disabled = false;
      if (btnVideo) btnVideo.disabled = false;
      if (btnYoutube) btnYoutube.disabled = false;
      if (btnAudio) btnAudio.disabled = false;
      if (btnZip) btnZip.disabled = false;
      if (btnTodo) btnTodo.disabled = false;
    }
  });

  // Cancelar descarga
  if (btnCancelDownload) {
    btnCancelDownload.addEventListener('click', async () => {
      btnCancelDownload.disabled = true;
      if (progressStatus) progressStatus.textContent = 'Cancelando descargas...';
      try {
        await fetch('http://localhost:8000/api/cancel', { method: 'POST' });
      } catch (err) {
        console.error('Error al solicitar cancelación:', err);
      }
    });
  }

  // Abrir carpeta de descargas
  if (btnOpenFolder) {
    btnOpenFolder.addEventListener('click', async () => {
      const downloadDir = downloadDirInput.value.trim();
      if (!downloadDir) {
        alert('Por favor, indica una carpeta de descarga válida.');
        return;
      }
      try {
        await fetch('http://localhost:8000/api/open-folder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ downloadDir })
        });
      } catch (err) {
        alert(`No se pudo conectar con el servidor local para abrir la carpeta. Detalles: ${err.message}`);
      }
    });
  }

  // Consultar estado de la descarga secuencial periódicamente
  function startPollingProgress() {
    if (statusInterval) clearInterval(statusInterval);

    statusInterval = setInterval(async () => {
      try {
        const response = await fetch('http://localhost:8000/api/status');
        const state = await response.json();

        if (state.active) {
          if (btnCancelDownload) btnCancelDownload.disabled = false;
          progressStatus.textContent = `Descargando ${state.currentIndex} de ${state.total}...`;
          progressPercentage.textContent = `${Math.floor(state.progress)}%`;
          progressBarFill.style.width = `${state.progress}%`;
          progressSpeed.textContent = `Velocidad: ${state.speed || '--'}`;
          progressEta.textContent = `ETA: ${state.eta || '--'}`;
        } else {
          // Si ya no está activo
          clearInterval(statusInterval);
          if (btnVimeo) btnVimeo.disabled = false;
          if (btnVideo) btnVideo.disabled = false;
          if (btnYoutube) btnYoutube.disabled = false;
          if (btnAudio) btnAudio.disabled = false;
          if (btnZip) btnZip.disabled = false;
          if (btnTodo) btnTodo.disabled = false;
          btnStartDownload.disabled = false;
          if (btnCancelDownload) btnCancelDownload.disabled = true;

          if (state.error) {
            progressStatus.textContent = `Error: ${state.error}`;
            progressBarFill.style.backgroundColor = '#ef4444';
          } else if (state.progress === 100) {
            progressStatus.textContent = '¡Descarga completada con éxito!';
            progressBarFill.style.width = '100%';
            progressPercentage.textContent = '100%';
            progressSpeed.textContent = 'Finalizado';
            progressEta.textContent = '00:00';
          }
        }
      } catch (err) {
        console.error('Error al obtener estado:', err);
        progressStatus.textContent = 'Error de conexión con el servidor local.';
      }
    }, 1000);
  }

  // Función inyectada en la pestaña activa para extraer los enlaces y títulos
  function findVimeoVideosWithTitles() {
    const vimeoRegex = /https:\/\/player\.vimeo\.com\/video\/\d+(?:\?[^\s"'>]+)?/gi;
    const results = [];
    const seenUrls = new Set();

    function cleanText(text) {
      if (!text) return '';
      return text.replace(/\s+/g, ' ').trim();
    }

    function getVimeoKey(url) {
      const match = url.match(/\/video\/(\d+)/i);
      return match ? match[1] : url.toLowerCase();
    }

    // 0. Detectar si estamos ejecutando DENTRO del propio iframe de Vimeo
    const currentUrl = window.location.href;
    if (currentUrl.includes('player.vimeo.com/video/')) {
      const match = currentUrl.match(vimeoRegex);
      if (match) {
        const url = match[0].replace(/&amp;/g, '&');
        let title = document.title;
        if (title) {
          title = title.replace(/\s*on\s*Vimeo\s*$/i, '');
        }
        const titleEl = document.getElementById('title-text') || document.querySelector('[class*="titleText"]');
        if (titleEl && titleEl.textContent) {
          title = titleEl.textContent.trim();
        }
        title = cleanText(title) || 'Vídeo de Vimeo';
        return [{ title, url }];
      }
    }

    function getPrecedingText(element) {
      // 1. Check if the element or its parent has a descriptive attribute
      const titleAttr = element.getAttribute('title');
      if (titleAttr && titleAttr !== 'Vídeo de Vimeo' && titleAttr !== 'vimeo' && !titleAttr.includes('player')) {
        return cleanText(titleAttr);
      }

      // Walk up the parent chain up to 4 levels
      let current = element;
      for (let depth = 0; depth < 4; depth++) {
        const parent = current.parentElement;
        if (!parent) break;

        // Try to find a heading in this container before the current element
        const headings = parent.querySelectorAll('h1, h2, h3, h4, h5, h6, p, .title, .video-title, .video-name');
        for (const heading of headings) {
          const comparison = heading.compareDocumentPosition(element);
          if (comparison & 2) { // heading is preceding element
            const text = cleanText(heading.innerText || heading.textContent);
            if (text && text.length > 2 && text !== 'Vídeo de Vimeo') {
              return text;
            }
          }
        }

        // If not found, look at the text contents of preceding siblings of this parent
        let sibling = current.previousElementSibling;
        while (sibling) {
          if (sibling.matches('h1, h2, h3, h4, h5, h6, .title, .video-title')) {
            const text = cleanText(sibling.innerText || sibling.textContent);
            if (text && text !== 'Vídeo de Vimeo') return text;
          }
          const text = cleanText(sibling.innerText || sibling.textContent);
          if (text && text.length > 2 && text !== 'Vídeo de Vimeo') {
            return text;
          }
          sibling = sibling.previousElementSibling;
        }

        current = parent;
      }

      return '';
    }

    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      const src = iframe.getAttribute('src') || '';
      const match = src.match(vimeoRegex);
      if (match) {
        const url = match[0].replace(/&amp;/g, '&');
        const key = getVimeoKey(url);
        if (!seenUrls.has(key)) {
          seenUrls.add(key);
          const title = getPrecedingText(iframe) || iframe.getAttribute('title') || 'Vídeo de Vimeo';
          results.push({ title, url });
        }
      }
    });

    const anchors = document.querySelectorAll('a');
    anchors.forEach(a => {
      const href = a.getAttribute('href') || '';
      const match = href.match(vimeoRegex);
      if (match) {
        const url = match[0].replace(/&amp;/g, '&');
        const key = getVimeoKey(url);
        if (!seenUrls.has(key)) {
          seenUrls.add(key);
          const title = getPrecedingText(a) || cleanText(a.innerText || a.textContent) || 'Enlace de Vimeo';
          results.push({ title, url });
        }
      }
    });

    // 3. Escanear atributos de todos los elementos (útil para plataformas como Google Sites)
    const allElements = document.getElementsByTagName('*');
    for (let el of allElements) {
      if (el.hasAttributes()) {
        const attrs = el.attributes;
        for (let i = 0; i < attrs.length; i++) {
          const attrVal = attrs[i].value;
          const match = attrVal.match(vimeoRegex);
          if (match) {
            match.forEach(rawUrl => {
              const url = rawUrl.replace(/&amp;/g, '&');
              const key = getVimeoKey(url);
              if (!seenUrls.has(key)) {
                seenUrls.add(key);
                const title = getPrecedingText(el) || el.getAttribute('title') || document.title || 'Vídeo de Vimeo';
                results.push({ title, url });
              }
            });
          }
        }
      }
    }

    // 4. Búsqueda en texto plano HTML completo (último recurso)
    const bodyHtml = document.body.innerHTML;
    const generalMatches = bodyHtml.match(vimeoRegex);
    if (generalMatches) {
      generalMatches.forEach(rawUrl => {
        const url = rawUrl.replace(/&amp;/g, '&');
        const key = getVimeoKey(url);
        if (!seenUrls.has(key)) {
          seenUrls.add(key);
          results.push({ title: 'Vídeo de Vimeo (Detectado en HTML)', url });
        }
      });
    }

    return results;
  }

  // Función inyectada para buscar enlaces directos de vídeo (.mp4, .mkv, .mov, etc.)
  function findDirectVideos() {
    const videoExtensions = /\.(mp4|m4v|mkv|mov|webm|avi|flv|ogv)(?:\?.*)?$/i;
    const results = [];
    const seenUrls = new Set();

    function cleanText(text) {
      if (!text) return '';
      return text.replace(/\s+/g, ' ').trim();
    }

    function getPrecedingText(element) {
      const parent = element.parentElement;
      if (!parent) return '';
      
      // Buscar si el reproductor tiene algún contenedor con etiqueta descriptiva (ej. jwplayer)
      const jwPlayer = element.closest('.jwplayer');
      if (jwPlayer && jwPlayer.getAttribute('aria-label')) {
        return cleanText(jwPlayer.getAttribute('aria-label').replace('Video Player - ', ''));
      }
      
      const titleAttr = element.getAttribute('title');
      if (titleAttr) return cleanText(titleAttr);

      // Buscar si hay alguna cabecera descriptiva en el entorno cercano
      const heading = parent.querySelector('h1, h2, h3, h4');
      if (heading) {
        return cleanText(heading.innerText || heading.textContent);
      }

      // Si no, buscar texto anterior
      const childNodes = Array.from(parent.childNodes);
      const targetIndex = childNodes.indexOf(element);
      if (targetIndex !== -1) {
        let textParts = [];
        for (let i = targetIndex - 1; i >= 0; i--) {
          const node = childNodes[i];
          if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'VIDEO' || node.tagName === 'IFRAME')) {
            break;
          }
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) textParts.unshift(node.textContent);
          }
        }
        const textFound = cleanText(textParts.join(' '));
        if (textFound) return textFound;
      }

      return '';
    }

    function getPageBaseUrl() {
      const isGood = url => url && url.startsWith('http') && !url.includes('handle.net');
      const base = document.querySelector('base');
      if (base && isGood(base.getAttribute('href'))) return base.getAttribute('href');
      
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && isGood(canonical.getAttribute('href'))) return canonical.getAttribute('href');

      const dcIdentifier = document.querySelector('meta[name="DC.identifier"]');
      if (dcIdentifier && isGood(dcIdentifier.getAttribute('content'))) return dcIdentifier.getAttribute('content');

      if (window.location.protocol.startsWith('http') && !window.location.hostname.includes('handle.net')) {
        return window.location.href;
      }

      const elements = [
        ...document.querySelectorAll('link[href]'),
        ...document.querySelectorAll('script[src]'),
        ...document.querySelectorAll('img[src]'),
        ...document.querySelectorAll('a[href]')
      ];
      for (const el of elements) {
        const url = el.getAttribute('href') || el.getAttribute('src');
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          try {
            const parsed = new URL(url);
            if (parsed.hostname && parsed.hostname !== 'localhost' && 
                !parsed.hostname.includes('handle.net') && 
                !parsed.hostname.includes('zencdn.net') && 
                !parsed.hostname.includes('googleapis.com') && 
                !parsed.hostname.includes('gstatic.com')) {
              return parsed.origin;
            }
          } catch (e) {}
        }
      }
      return '';
    }

    const basePageUrl = getPageBaseUrl();

    function resolveUrl(url) {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
      }
      if (url.startsWith('file://')) {
        try {
          const parsed = new URL(url);
          const path = parsed.pathname;
          if (basePageUrl) {
            return new URL(path, basePageUrl).href;
          }
        } catch (e) {}
      }
      if (basePageUrl) {
        try {
          return new URL(url, basePageUrl).href;
        } catch (e) {}
      }
      return url;
    }

    // 1. Escanear elementos <video>
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
      const src = resolveUrl(v.getAttribute('src') || v.src || '');
      if (src && !src.startsWith('blob:') && !src.startsWith('file://')) {
        if (src.match(videoExtensions) || src.includes('cdn') || src.includes('video')) {
          const url = src;
          if (!seenUrls.has(url.toLowerCase())) {
            seenUrls.add(url.toLowerCase());
            let title = getPrecedingText(v) || document.title || 'Vídeo Directo';
            results.push({ title, url });
          }
        }
      }
    });

    // 2. Escanear elementos <source> (dentro de videos)
    const sources = document.querySelectorAll('source');
    sources.forEach(s => {
      const src = resolveUrl(s.getAttribute('src') || s.src || '');
      if (src && !src.startsWith('blob:') && !src.startsWith('file://')) {
        if (src.match(videoExtensions)) {
          const url = src;
          if (!seenUrls.has(url.toLowerCase())) {
            seenUrls.add(url.toLowerCase());
            const parentVideo = s.closest('video');
            let title = '';
            if (parentVideo) {
              title = getPrecedingText(parentVideo);
            }
            title = title || getPrecedingText(s) || document.title || 'Vídeo Directo';
            results.push({ title, url });
          }
        }
      }
    });

    // 3. Escanear enlaces <a> apuntando a ficheros de vídeo
    const anchors = document.querySelectorAll('a');
    anchors.forEach(a => {
      const href = resolveUrl(a.getAttribute('href') || a.href || '');
      if (href && !href.startsWith('file://')) {
        if (href.match(videoExtensions)) {
          const url = href;
          if (!seenUrls.has(url.toLowerCase())) {
            seenUrls.add(url.toLowerCase());
            const title = cleanText(a.innerText || a.textContent) || 'Enlace de Vídeo';
            results.push({ title, url });
          }
        }
      }
    });

    // 4. Escanear atributos de todos los elementos (para vídeos directos ocultos en plataformas)
    const targetAttrs = ['href', 'src', 'data-src', 'data-video-src', 'data-video', 'data-href', 'data-url', 'video-url', 'url'];
    const allElements = document.getElementsByTagName('*');
    for (let el of allElements) {
      for (const attrName of targetAttrs) {
        const attrVal = el.getAttribute(attrName);
        if (attrVal && attrVal.match(videoExtensions)) {
          const url = resolveUrl(attrVal);
          if (url && !url.startsWith('file://')) {
            if (!seenUrls.has(url.toLowerCase())) {
              seenUrls.add(url.toLowerCase());
              let title = getPrecedingText(el) || el.getAttribute('title') || document.title || 'Vídeo Directo';
              results.push({ title, url });
            }
          }
        }
      }
    }

    return results;
  }

  // Función inyectada para buscar enlaces directos de audio (.mp3, .wav, .m4a, etc.)
  function findAudioLinks() {
    const audioExtensions = /\.(mp3|wav|m4a|ogg|flac|aac)(?:\?.*)?$/i;
    const results = [];
    const seenUrls = new Set();

    function cleanText(text) {
      if (!text) return '';
      return text.replace(/\s+/g, ' ').trim();
    }

    function getPrecedingText(element) {
      const parent = element.parentElement;
      if (!parent) return '';

      const titleAttr = element.getAttribute('title');
      if (titleAttr) return cleanText(titleAttr);

      // Buscar cabecera descriptiva en el entorno cercano
      const heading = parent.querySelector('h1, h2, h3, h4');
      if (heading) {
        return cleanText(heading.innerText || heading.textContent);
      }

      // Si no, buscar texto anterior
      const childNodes = Array.from(parent.childNodes);
      const targetIndex = childNodes.indexOf(element);
      if (targetIndex !== -1) {
        let textParts = [];
        for (let i = targetIndex - 1; i >= 0; i--) {
          const node = childNodes[i];
          if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'AUDIO' || node.tagName === 'VIDEO' || node.tagName === 'IFRAME')) {
            break;
          }
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) textParts.unshift(node.textContent);
          }
        }
        const textFound = cleanText(textParts.join(' '));
        if (textFound) return textFound;
      }

      return '';
    }

    function getPageBaseUrl() {
      const isGood = url => url && url.startsWith('http') && !url.includes('handle.net');
      const base = document.querySelector('base');
      if (base && isGood(base.getAttribute('href'))) return base.getAttribute('href');
      
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && isGood(canonical.getAttribute('href'))) return canonical.getAttribute('href');

      const dcIdentifier = document.querySelector('meta[name="DC.identifier"]');
      if (dcIdentifier && isGood(dcIdentifier.getAttribute('content'))) return dcIdentifier.getAttribute('content');

      if (window.location.protocol.startsWith('http') && !window.location.hostname.includes('handle.net')) {
        return window.location.href;
      }

      const elements = [
        ...document.querySelectorAll('link[href]'),
        ...document.querySelectorAll('script[src]'),
        ...document.querySelectorAll('img[src]'),
        ...document.querySelectorAll('a[href]')
      ];
      for (const el of elements) {
        const url = el.getAttribute('href') || el.getAttribute('src');
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          try {
            const parsed = new URL(url);
            if (parsed.hostname && parsed.hostname !== 'localhost' && 
                !parsed.hostname.includes('handle.net') && 
                !parsed.hostname.includes('zencdn.net') && 
                !parsed.hostname.includes('googleapis.com') && 
                !parsed.hostname.includes('gstatic.com')) {
              return parsed.origin;
            }
          } catch (e) {}
        }
      }
      return '';
    }

    const basePageUrl = getPageBaseUrl();

    function resolveUrl(url) {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
      }
      if (url.startsWith('file://')) {
        try {
          const parsed = new URL(url);
          const path = parsed.pathname;
          if (basePageUrl) {
            return new URL(path, basePageUrl).href;
          }
        } catch (e) {}
      }
      if (basePageUrl) {
        try {
          return new URL(url, basePageUrl).href;
        } catch (e) {}
      }
      return url;
    }

    // 1. Escanear elementos <audio>
    const audios = document.querySelectorAll('audio');
    audios.forEach(a => {
      const src = resolveUrl(a.getAttribute('src') || a.src || '');
      if (src && !src.startsWith('blob:') && !src.startsWith('file://')) {
        if (src.match(audioExtensions) || src.includes('cdn') || src.includes('audio')) {
          const url = src;
          if (!seenUrls.has(url.toLowerCase())) {
            seenUrls.add(url.toLowerCase());
            let title = getPrecedingText(a) || document.title || 'Audio Directo';
            results.push({ title, url });
          }
        }
      }
    });

    // 2. Escanear elementos <source> (dentro de audios)
    const sources = document.querySelectorAll('source');
    sources.forEach(s => {
      const src = resolveUrl(s.getAttribute('src') || s.src || '');
      if (src && !src.startsWith('blob:') && !src.startsWith('file://')) {
        if (src.match(audioExtensions)) {
          const url = src;
          if (!seenUrls.has(url.toLowerCase())) {
            seenUrls.add(url.toLowerCase());
            const parentAudio = s.closest('audio');
            let title = '';
            if (parentAudio) {
              title = getPrecedingText(parentAudio);
            }
            title = title || getPrecedingText(s) || document.title || 'Audio Directo';
            results.push({ title, url });
          }
        }
      }
    });

    // 3. Escanear enlaces <a> apuntando a ficheros de audio
    const anchors = document.querySelectorAll('a');
    anchors.forEach(a => {
      const href = resolveUrl(a.getAttribute('href') || a.href || '');
      if (href && !href.startsWith('file://')) {
        if (href.match(audioExtensions)) {
          const url = href;
          if (!seenUrls.has(url.toLowerCase())) {
            seenUrls.add(url.toLowerCase());
            const title = cleanText(a.innerText || a.textContent) || 'Enlace de Audio';
            results.push({ title, url });
          }
        }
      }
    });

    // 4. Escanear atributos de todos los elementos (para audios ocultos en plataformas)
    const targetAttrs = ['href', 'src', 'data-src', 'data-audio-src', 'data-audio', 'data-href', 'data-url', 'audio-url', 'url'];
    const allElements = document.getElementsByTagName('*');
    for (let el of allElements) {
      for (const attrName of targetAttrs) {
        const attrVal = el.getAttribute(attrName);
        if (attrVal && attrVal.match(audioExtensions)) {
          const url = resolveUrl(attrVal);
          if (url && !url.startsWith('file://')) {
            if (!seenUrls.has(url.toLowerCase())) {
              seenUrls.add(url.toLowerCase());
              let title = getPrecedingText(el) || el.getAttribute('title') || document.title || 'Audio Directo';
              results.push({ title, url });
            }
          }
        }
      }
    }

    return results;
  }

  // Función inyectada para buscar archivos zip/rar/pdf/etc.
  function findZipDocs() {
    const docExtensions = /\.(zip|rar|7z|pdf|epub|docx|txt)(?:\?.*)?$/i;
    const results = [];
    const seenUrls = new Set();

    function cleanText(text) {
      if (!text) return '';
      return text.replace(/\s+/g, ' ').trim();
    }

    function getPrecedingText(element) {
      const parent = element.parentElement;
      if (!parent) return '';
      
      const titleAttr = element.getAttribute('title');
      if (titleAttr) return cleanText(titleAttr);

      const heading = parent.querySelector('h1, h2, h3, h4');
      if (heading) {
        return cleanText(heading.innerText || heading.textContent);
      }

      const childNodes = Array.from(parent.childNodes);
      const targetIndex = childNodes.indexOf(element);
      if (targetIndex !== -1) {
        let textParts = [];
        for (let i = targetIndex - 1; i >= 0; i--) {
          const node = childNodes[i];
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) textParts.unshift(node.textContent);
          }
        }
        const textFound = cleanText(textParts.join(' '));
        if (textFound) return textFound;
      }
      return '';
    }

    function getPageBaseUrl() {
      const isGood = url => url && url.startsWith('http') && !url.includes('handle.net');
      const base = document.querySelector('base');
      if (base && isGood(base.getAttribute('href'))) return base.getAttribute('href');
      
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && isGood(canonical.getAttribute('href'))) return canonical.getAttribute('href');

      const dcIdentifier = document.querySelector('meta[name="DC.identifier"]');
      if (dcIdentifier && isGood(dcIdentifier.getAttribute('content'))) return dcIdentifier.getAttribute('content');

      if (window.location.protocol.startsWith('http') && !window.location.hostname.includes('handle.net')) {
        return window.location.href;
      }

      const elements = [
        ...document.querySelectorAll('link[href]'),
        ...document.querySelectorAll('script[src]'),
        ...document.querySelectorAll('img[src]'),
        ...document.querySelectorAll('a[href]')
      ];
      for (const el of elements) {
        const url = el.getAttribute('href') || el.getAttribute('src');
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          try {
            const parsed = new URL(url);
            if (parsed.hostname && parsed.hostname !== 'localhost' && 
                !parsed.hostname.includes('handle.net') && 
                !parsed.hostname.includes('zencdn.net') && 
                !parsed.hostname.includes('googleapis.com') && 
                !parsed.hostname.includes('gstatic.com')) {
              return parsed.origin;
            }
          } catch (e) {}
        }
      }
      return '';
    }

    const basePageUrl = getPageBaseUrl();

    function resolveUrl(url) {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
      }
      if (url.startsWith('file://')) {
        try {
          const parsed = new URL(url);
          const path = parsed.pathname;
          if (basePageUrl) {
            return new URL(path, basePageUrl).href;
          }
        } catch (e) {}
      }
      if (basePageUrl) {
        try {
          return new URL(url, basePageUrl).href;
        } catch (e) {}
      }
      return url;
    }

    // 1. Escanear enlaces <a> apuntando a ficheros zip/pdf/etc.
    const anchors = document.querySelectorAll('a');
    anchors.forEach(a => {
      const rawHref = a.getAttribute('href') || a.href || '';
      const href = resolveUrl(rawHref);
      if (href && !href.startsWith('file://')) {
        if (href.match(docExtensions)) {
          const url = href;
          if (!seenUrls.has(url.toLowerCase())) {
            seenUrls.add(url.toLowerCase());
            const textContent = cleanText(a.innerText || a.textContent);
            const title = textContent || getPrecedingText(a) || 'Archivo Zip/Documento';
            results.push({ title, url });
          }
        }
      }
    });

    // 2. Escanear atributos de todos los elementos
    const targetAttrs = ['href', 'src', 'data-src', 'data-href', 'data-url', 'url'];
    const allElements = document.getElementsByTagName('*');
    for (let el of allElements) {
      for (const attrName of targetAttrs) {
        const attrVal = el.getAttribute(attrName);
        if (attrVal && attrVal.match(docExtensions)) {
          const url = resolveUrl(attrVal);
          if (url && !url.startsWith('file://')) {
            if (!seenUrls.has(url.toLowerCase())) {
              seenUrls.add(url.toLowerCase());
              let title = el.getAttribute('title') || getPrecedingText(el) || document.title || 'Archivo Zip/Documento';
              results.push({ title, url });
            }
          }
        }
      }
    }

    return results;
  }

  // Muestra los resultados en el listado del popup
  function displayResults(videos) {
    if (resultsList) resultsList.innerHTML = '';
    if (resultsCount) resultsCount.textContent = videos.length;

    if (videos.length === 0) {
      if (resultsList) resultsList.innerHTML = '<li class="empty-state">No se encontraron vídeos en esta página.</li>';
      if (instructionDisplay) instructionDisplay.textContent = 'Búsqueda completada. No se encontraron resultados.';
      if (btnCopyAll) btnCopyAll.style.display = 'none';
      if (selectAllCheckbox) {
        selectAllCheckbox.disabled = true;
        selectAllCheckbox.checked = false;
      }
      return;
    }

    instructionDisplay.textContent = `Búsqueda completada. Selecciona los vídeos que deseas copiar o descargar.`;
    btnCopyAll.style.display = 'inline-block';
    selectAllCheckbox.disabled = false;
    selectAllCheckbox.checked = true; // Por defecto marcar todos

    videos.forEach((video, index) => {
      const li = document.createElement('li');

      // Checkbox para selección
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'item-checkbox';
      cb.checked = true; // Por defecto todos marcados
      cb.dataset.index = index;
      cb.addEventListener('change', () => {
        updateDownloadButtonState();
        // Sincronizar checkbox superior (todos)
        const totalChecks = resultsList.querySelectorAll('.item-checkbox').length;
        const checkedChecks = resultsList.querySelectorAll('.item-checkbox:checked').length;
        selectAllCheckbox.checked = (totalChecks === checkedChecks);
        selectAllCheckbox.indeterminate = (checkedChecks > 0 && checkedChecks < totalChecks);
      });

      // Contenedor del contenido
      const contentEl = document.createElement('div');
      contentEl.className = 'item-content';

      const titleEl = document.createElement('div');
      titleEl.className = 'result-title';
      titleEl.textContent = video.title || 'Vídeo sin título';

      const linkEl = document.createElement('a');
      linkEl.href = video.url;
      linkEl.target = '_blank';
      linkEl.className = 'result-link';
      linkEl.textContent = video.url;
      
      const externalIcon = document.createElement('span');
      externalIcon.innerHTML = ' ↗';
      linkEl.appendChild(externalIcon);

      contentEl.appendChild(titleEl);
      contentEl.appendChild(linkEl);
      
      li.appendChild(cb);
      li.appendChild(contentEl);
      resultsList.appendChild(li);
    });

    updateDownloadButtonState();
  }

  function showError(message) {
    if (resultsList) resultsList.innerHTML = `<li class="empty-state" style="color: #ef4444;">${message}</li>`;
    if (resultsCount) resultsCount.textContent = '0';
    if (instructionDisplay) instructionDisplay.textContent = 'Ocurrió un error al realizar la operación.';
    if (btnCopyAll) btnCopyAll.style.display = 'none';
    if (selectAllCheckbox) {
      selectAllCheckbox.disabled = true;
      selectAllCheckbox.checked = false;
    }
    if (btnStartDownload) btnStartDownload.disabled = true;
  }

  // Comprobar si hay una descarga en curso al abrir el popup
  async function checkInitialDownloadStatus() {
    try {
      const response = await fetch('http://localhost:8000/api/status');
      if (!response.ok) return;
      const state = await response.json();
      if (state && state.active) {
        // Deshabilitar botones de búsqueda y descarga
        if (btnVimeo) btnVimeo.disabled = true;
        if (btnVideo) btnVideo.disabled = true;
        if (btnYoutube) btnYoutube.disabled = true;
        if (btnAudio) btnAudio.disabled = true;
        if (btnZip) btnZip.disabled = true;
        if (btnTodo) btnTodo.disabled = true;
        if (btnStartDownload) btnStartDownload.disabled = true;
        
        // Mostrar contenedor de progreso
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressStatus) progressStatus.textContent = `Descargando ${state.currentIndex} de ${state.total}...`;
        if (progressPercentage) progressPercentage.textContent = `${Math.floor(state.progress)}%`;
        if (progressBarFill) {
          progressBarFill.style.width = `${state.progress}%`;
          progressBarFill.style.backgroundColor = ''; // Restablecer color por si había error anterior
        }
        if (progressSpeed) progressSpeed.textContent = `Velocidad: ${state.speed || '--'}`;
        if (progressEta) progressEta.textContent = `ETA: ${state.eta || '--'}`;
        
        // Comenzar monitoreo
        startPollingProgress();
      }
    } catch (err) {
      console.warn('No se pudo conectar con el servidor local al iniciar:', err);
    }
  }

  // Ejecutar comprobación inicial
  checkInitialDownloadStatus();
});
