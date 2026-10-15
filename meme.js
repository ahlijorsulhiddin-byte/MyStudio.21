/**
 * MEME GENERATOR
 */
window.MPS = window.MPS || {};

MPS.MemeEditor = (() => {
  const TEMPLATES = [
    { id: 'blank', name: 'Пустой', color: '#1a1a2e' },
    { id: 'dark', name: 'Тёмный', color: '#0f0f0f' },
    { id: 'blue', name: 'Синий', color: '#0a1628' },
    { id: 'purple', name: 'Фиолетовый', color: '#1a0a2e' },
    { id: 'gradient1', name: 'Неон', gradient: ['#7657FF', '#21C8F6'] },
    { id: 'gradient2', name: 'Закат', gradient: ['#FF4FC8', '#FF8A00'] },
    { id: 'green', name: 'Зелёный', color: '#0a2e1a' },
    { id: 'red', name: 'Красный', color: '#2e0a0a' }
  ];

  const CAPTIONS = [
    { top: 'КОГДА ЗАДЕПЛОИЛ', bottom: 'И НИЧЕГО НЕ СЛОМАЛОСЬ' },
    { top: 'Я:', bottom: 'ЭТО НА 5 МИНУТ' },
    { top: 'ОЖИДАНИЕ', bottom: 'РЕАЛЬНОСТЬ' },
    { top: 'ПОНЕДЕЛЬНИК', bottom: 'БУДТО ЗАНОВО' },
    { top: 'КОГДА КОД РАБОТАЕТ', bottom: 'НО ТЫ НЕ ЗНАЕШЬ ПОЧЕМУ' },
    { top: 'ПЛАН', bottom: 'ФАКТ' },
    { top: 'ДО КОФЕ', bottom: 'ПОСЛЕ КОФЕ' },
    { top: 'Я — ПРОФЕССИОНАЛ', bottom: 'ГУгл — МОЙ ДРУГ' }
  ];

  let state = {
    image: null, objectURL: null, topText: '', bottomText: '',
    fontSize: 48, color: '#ffffff', strokeColor: '#000000', strokeWidth: 4,
    stickers: [], width: 800, height: 600, projectName: 'Новый мем'
  };
  let canvas, ctx;

  function init() {
    canvas = document.getElementById('meme-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    buildTemplates();
    bindUI();
    selectTemplate(TEMPLATES[0]);
  }

  function buildTemplates() {
    const grid = document.getElementById('meme-templates');
    if (!grid) return;
    grid.innerHTML = '';
    TEMPLATES.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'template-thumb';
      btn.dataset.id = t.id;
      btn.title = t.name;
      btn.style.background = t.gradient
        ? `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})`
        : t.color;
      btn.textContent = t.name;
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.template-thumb').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectTemplate(t);
      });
      grid.appendChild(btn);
    });
  }

  function selectTemplate(t) {
    state.image = null;
    MPS.utils.revoke(state.objectURL);
    state.objectURL = null;
    state.width = 800;
    state.height = 600;
    document.getElementById('meme-placeholder')?.classList.add('hidden');
    render();
  }

  function bindUI() {
    const $ = MPS.utils.$;
    const on = MPS.utils.on;

    on($('#meme-upload-btn'), 'click', () => $('#meme-file-input').click());
    on($('#meme-file-input'), 'change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        MPS.utils.revoke(state.objectURL);
        state.objectURL = URL.createObjectURL(f);
        state.image = await MPS.utils.loadImage(state.objectURL);
        state.width = state.image.naturalWidth;
        state.height = state.image.naturalHeight;
        document.getElementById('meme-placeholder')?.classList.add('hidden');
        render();
        MPS.toast('Изображение загружено', 'success');
      } catch (err) {
        MPS.toast('Ошибка загрузки', 'error');
      }
      e.target.value = '';
    });

    on($('#meme-top-text'), 'input', (e) => { state.topText = e.target.value; render(); });
    on($('#meme-bottom-text'), 'input', (e) => { state.bottomText = e.target.value; render(); });
    on($('#meme-font-size'), 'input', (e) => {
      state.fontSize = parseInt(e.target.value, 10);
      document.getElementById('val-meme-size').textContent = state.fontSize;
      render();
    });
    on($('#meme-text-color'), 'input', (e) => { state.color = e.target.value; render(); });
    on($('#meme-stroke-color'), 'input', (e) => { state.strokeColor = e.target.value; render(); });
    on($('#meme-stroke-width'), 'input', (e) => {
      state.strokeWidth = parseInt(e.target.value, 10);
      document.getElementById('val-meme-stroke').textContent = state.strokeWidth;
      render();
    });

    MPS.utils.$$('.sticker-btn').forEach(btn => {
      on(btn, 'click', () => {
        state.stickers.push({
          id: MPS.utils.generateId(),
          emoji: btn.dataset.emoji,
          x: 0.5 + (Math.random() - 0.5) * 0.3,
          y: 0.5 + (Math.random() - 0.5) * 0.3,
          size: 48
        });
        render();
        renderLayers();
      });
    });

    on($('#meme-random-btn'), 'click', randomMeme);
    on($('#meme-save'), 'click', saveProject);
    on($('#meme-export-btn'), 'click', () => {
      const modal = document.getElementById('export-modal');
      modal?.classList.remove('hidden');
      modal.dataset.editor = 'meme';
      document.getElementById('export-format').innerHTML = '<option value="png">PNG</option><option value="jpeg">JPG</option>';
      document.getElementById('export-quality-group')?.classList.remove('hidden');
      document.getElementById('export-dims').textContent = `${state.width} × ${state.height}`;
    });
    on($('#meme-project-name'), 'change', (e) => { state.projectName = e.target.value; });
  }

  function drawWrappedText(c, text, x, y, maxWidth, lineHeight, fontSize) {
    if (!text) return;
    const words = text.toUpperCase().split(/\s+/);
    let line = '';
    const lines = [];
    words.forEach(w => {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    });
    if (line) lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((ln, i) => {
      const ly = startY + i * lineHeight;
      if (state.strokeWidth > 0) {
        c.strokeStyle = state.strokeColor;
        c.lineWidth = state.strokeWidth;
        c.lineJoin = 'round';
        c.strokeText(ln, x, ly);
      }
      c.fillStyle = state.color;
      c.fillText(ln, x, ly);
    });
  }

  function render() {
    const maxW = 800;
    const scale = Math.min(1, maxW / state.width);
    canvas.width = Math.round(state.width * scale);
    canvas.height = Math.round(state.height * scale);
    const s = scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state.image) {
      ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);
    } else {
      const active = document.querySelector('#meme-templates .template-thumb.active');
      const tid = active?.dataset.id || 'blank';
      const t = TEMPLATES.find(x => x.id === tid) || TEMPLATES[0];
      if (t.gradient) {
        const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        g.addColorStop(0, t.gradient[0]);
        g.addColorStop(1, t.gradient[1]);
        ctx.fillStyle = g;
      } else ctx.fillStyle = t.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${state.fontSize * s}px Impact, Arial Black, sans-serif`;
    const pad = 20 * s;
    drawWrappedText(ctx, state.topText, canvas.width / 2, pad + state.fontSize * s * 0.6, canvas.width - pad * 2, state.fontSize * s * 1.15);
    drawWrappedText(ctx, state.bottomText, canvas.width / 2, canvas.height - pad - state.fontSize * s * 0.6, canvas.width - pad * 2, state.fontSize * s * 1.15);

    state.stickers.forEach(st => {
      ctx.font = `${st.size * s}px serif`;
      ctx.fillText(st.emoji, st.x * canvas.width, st.y * canvas.height);
    });
  }

  function renderLayers() {
    const list = document.getElementById('meme-layers');
    if (!list) return;
    list.innerHTML = state.stickers.map(s => `
      <div class="layer-item" data-id="${s.id}">
        <span class="layer-name">${s.emoji}</span>
        <button class="icon-btn" data-action="del"><i data-lucide="trash-2"></i></button>
      </div>`).join('');
    if (window.lucide) lucide.createIcons({ nodes: list.querySelectorAll('[data-lucide]') });
    list.querySelectorAll('[data-action="del"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.layer-item').dataset.id;
        state.stickers = state.stickers.filter(s => s.id !== id);
        render();
        renderLayers();
      });
    });
  }

  function randomMeme() {
    const t = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const c = CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];
    document.querySelectorAll('#meme-templates .template-thumb').forEach(b => {
      b.classList.toggle('active', b.dataset.id === t.id);
    });
    selectTemplate(t);
    state.topText = c.top;
    state.bottomText = c.bottom;
    document.getElementById('meme-top-text').value = c.top;
    document.getElementById('meme-bottom-text').value = c.bottom;
    render();
    MPS.toast('Случайный мем создан', 'success');
  }

  function buildExportCanvas() {
    const off = document.createElement('canvas');
    off.width = state.width;
    off.height = state.height;
    const c = off.getContext('2d');
    if (state.image) {
      c.drawImage(state.image, 0, 0, off.width, off.height);
    } else {
      const active = document.querySelector('#meme-templates .template-thumb.active');
      const tid = active?.dataset.id || 'blank';
      const t = TEMPLATES.find(x => x.id === tid) || TEMPLATES[0];
      if (t.gradient) {
        const g = c.createLinearGradient(0, 0, off.width, off.height);
        g.addColorStop(0, t.gradient[0]);
        g.addColorStop(1, t.gradient[1]);
        c.fillStyle = g;
      } else c.fillStyle = t.color;
      c.fillRect(0, 0, off.width, off.height);
    }
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${state.fontSize}px Impact, Arial Black, sans-serif`;
    drawWrappedText(c, state.topText, off.width / 2, 30 + state.fontSize * 0.6, off.width - 40, state.fontSize * 1.15);
    drawWrappedText(c, state.bottomText, off.width / 2, off.height - 30 - state.fontSize * 0.6, off.width - 40, state.fontSize * 1.15);
    state.stickers.forEach(st => {
      c.font = `${st.size}px serif`;
      c.fillText(st.emoji, st.x * off.width, st.y * off.height);
    });
    return off;
  }

  async function doExport(format, quality) {
    const off = buildExportCanvas();
    return new Promise(resolve => {
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      off.toBlob(blob => {
        if (!blob) { MPS.toast('Ошибка экспорта', 'error'); resolve(null); return; }
        const name = (state.projectName || 'meme').replace(/[^\w\u0400-\u04FF\-]+/g, '_') + (format === 'jpeg' ? '.jpg' : '.png');
        MPS.utils.downloadBlob(blob, name);
        MPS.toast('Мем сохранён', 'success');
        resolve(blob);
      }, mime, format === 'jpeg' ? quality / 100 : undefined);
    });
  }

  async function saveProject() {
    try {
      const off = buildExportCanvas();
      const thumb = off.toDataURL('image/jpeg', 0.7);
      const project = {
        id: state.projectId || MPS.utils.generateId(),
        type: 'meme',
        name: state.projectName || 'Мем',
        thumbnail: thumb,
        data: { topText: state.topText, bottomText: state.bottomText, stickers: state.stickers },
        updatedAt: Date.now()
      };
      state.projectId = project.id;
      await MPS.storage.saveProject(project);
      MPS.toast('Проект сохранён', 'success');
    } catch (e) {
      MPS.toast('Ошибка сохранения', 'error');
    }
  }

  return { init, doExport, saveProject, randomMeme };
})();
