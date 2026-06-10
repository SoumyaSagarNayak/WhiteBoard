import { S, VP, state, undo, redo, pushH, triggerRedraw } from './state.js';
import { WB, s2c, redraw } from './canvas.js';
import { startClip, exportPng, clearAll } from './clip.js';
import { emitDrawingOperation } from './collab.js';

export const TOOLS = [
  { id: 'select', label: 'Select', key: 'V', svg: '<polyline points="5 3 19 12 12 13 8 20"/>' },
  { id: 'rectangle', label: 'Rect', key: 'R', svg: '<rect x="3" y="3" width="18" height="18" rx="2"/>' },
  { id: 'diamond', label: 'Diamond', key: 'D', svg: '<polygon points="12 2 22 12 12 22 2 12"/>' },
  { id: 'circle', label: 'Circle', key: 'C', svg: '<circle cx="12" cy="12" r="9"/>' },
  { id: 'arrow', label: 'Arrow', key: 'A', svg: '<line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/>' },
  { id: 'line', label: 'Line', key: 'L', svg: '<line x1="5" y1="19" x2="19" y2="5"/>' },
  { id: 'pencil', label: 'Pencil', key: 'P', svg: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>' },
  { id: 'text', label: 'Text', key: 'T', svg: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>' },
  { id: 'eraser', label: 'Eraser', key: 'E', svg: '<path d="M20 20H7L3 16l11-11 8 8z"/><path d="M6 11l5 5"/>' },
  { id: 'laser', label: 'Laser', key: 'Z', svg: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' }
];

const SCOLS = ['#e8e8f0', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bff', '#ff9f43', '#a29bfe'];
const FCOLS = ['transparent', '#ff6b6b33', '#ffd93d33', '#6bcb7733', '#4d96ff33', '#ff6bff33', '#ff9f4333', '#a29bfe33'];
const WIDTHS = [1, 2, 4, 7];
const ROUGH = [{ l: 'Clean', v: 0 }, { l: 'Rough', v: 1 }, { l: 'Very', v: 2.5 }];
const FONTS = [
  { n: 'System', f: 'Segoe UI, system-ui, sans-serif' },
  { n: 'Georgia', f: 'Georgia, serif' },
  { n: 'Courier', f: 'Courier New, monospace' },
  { n: 'Arial', f: 'Arial, sans-serif' }
];
const FSIZES = [12, 16, 20, 24, 32, 48];

export const TI = document.getElementById('tinput');
let txPos = null;
let sbTab = null;
const sbEl = document.getElementById('sidebar');

export function getCursor() {
  if (S.tool === 'select') return 'default';
  if (S.tool === 'text') return 'text';
  if (S.tool === 'eraser') return 'cell';
  return 'crosshair';
}

export function setTool(id) {
  S.tool = id;
  state.selId = null;
  state.activeEl = null;
  state.drawing = false;
  document.querySelectorAll('#tbtns .tbtn').forEach(b => b.classList.remove('active'));
  const b = document.getElementById('t-' + id);
  if (b) b.classList.add('active');
  WB.style.cursor = getCursor();
  document.getElementById('tt').textContent = TOOLS.find(t => t.id === id)?.label || id;
  triggerRedraw();
}

export function closeSB() {
  sbEl.style.width = '0';
  sbTab = null;
  ['tools', 'style', 'texttab', 'actions'].forEach(id => {
    document.getElementById('b' + id).classList.remove('active');
  });
}

export function openSB(tab) {
  if (sbTab === tab && sbEl.clientWidth > 0) {
    closeSB();
    return;
  }
  sbTab = tab;
  sbEl.style.width = '258px';
  ['tools', 'style', 'texttab', 'actions'].forEach(id => {
    document.getElementById('b' + id).classList.toggle('active', id === tab);
  });
  renderSB(tab);
}

function ic(svg) {
  return `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">${svg}</svg>`;
}

export function renderSB(tab) {
  const titles = { tools: 'Tools', style: 'Style', texttab: 'Text', actions: 'Actions' };
  document.getElementById('sbtitle').textContent = titles[tab];
  const B = document.getElementById('sbbody');
  if (!B) return;

  if (tab === 'tools') {
    B.innerHTML = `<div class="sec"><span class="lbl">Drawing Tools</span><div class="tgrid" id="tg"></div></div>
    <div style="background:#161620;border-radius:10px;padding:10px;border:1px solid #2a2a38">
      <span class="lbl">Shortcuts</span>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px">
        ${TOOLS.map(t => `<div style="display:flex;justify-content:space-between;align-items:center"><span style="color:#777799;font-size:11px">${t.label}</span><kbd style="background:#2a2a38;color:#a29bfe;font-size:10px;padding:1px 5px;border-radius:4px">${t.key}</kbd></div>`).join('')}
      </div>
    </div>`;
    const G = document.getElementById('tg');
    TOOLS.forEach(t => {
      const b = document.createElement('button');
      b.className = 'tc' + (S.tool === t.id ? ' on' : '');
      b.innerHTML = ic(t.svg) + `<span>${t.label}</span>`;
      b.onclick = () => {
        setTool(t.id);
        renderSB('tools');
      };
      G.appendChild(b);
    });
  }

  if (tab === 'style') {
    B.innerHTML = `
    <div class="sec"><span class="lbl">Stroke Color</span><div class="row" id="sc"></div></div>
    <div class="sec" style="margin-top:14px"><span class="lbl">Fill Color</span><div class="row" id="fc"></div></div>
    <div class="sec" style="margin-top:14px"><span class="lbl">Stroke Width</span><div class="row" id="sw"></div></div>
    <div class="sec" style="margin-top:14px"><span class="lbl">Style</span><div class="row" id="rl"></div></div>
    <div class="sec" style="margin-top:14px">
      <span class="lbl">Opacity — <span id="ov">${Math.round(S.opacity * 100)}%</span></span>
      <div style="display:flex;align-items:center;gap:10px">
        <input type="range" min="0.1" max="1" step="0.05" value="${S.opacity}" id="or" style="flex:1;accent-color:#5c6bc0">
        <span style="color:#777799;font-size:11px;min-width:32px;font-family:monospace" id="ol">${Math.round(S.opacity * 100)}%</span>
      </div>
    </div>`;

    SCOLS.forEach(c => {
      const b = document.createElement('button');
      b.className = 'cdot' + (S.strokeColor === c ? ' on' : '');
      b.style.background = c;
      b.onclick = () => {
        S.strokeColor = c;
        renderSB('style');
      };
      document.getElementById('sc').appendChild(b);
    });

    FCOLS.forEach(c => {
      const b = document.createElement('button');
      b.className = 'csq' + (S.fillColor === c ? ' on' : '');
      b.style.background = c === 'transparent' ? 'transparent' : c;
      if (c === 'transparent') {
        b.innerHTML = '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#44445a">∅</span>';
      }
      b.onclick = () => {
        S.fillColor = c;
        renderSB('style');
      };
      document.getElementById('fc').appendChild(b);
    });

    WIDTHS.forEach(w => {
      const b = document.createElement('button');
      b.className = 'swb' + (S.strokeWidth === w ? ' on' : '');
      b.innerHTML = `<div style="width:65%;height:${w}px;border-radius:${w}px;background:${S.strokeWidth === w ? '#5c6bc0' : '#6a6a88'}"></div>`;
      b.onclick = () => {
        S.strokeWidth = w;
        renderSB('style');
      };
      document.getElementById('sw').appendChild(b);
    });

    ROUGH.forEach(r => {
      const b = document.createElement('button');
      b.className = 'rb' + (S.roughness === r.v ? ' on' : '');
      b.textContent = r.l;
      b.onclick = () => {
        S.roughness = r.v;
        renderSB('style');
      };
      document.getElementById('rl').appendChild(b);
    });

    document.getElementById('or').oninput = e => {
      S.opacity = parseFloat(e.target.value);
      const pct = Math.round(S.opacity * 100) + '%';
      document.getElementById('ov').textContent = pct;
      document.getElementById('ol').textContent = pct;
    };
  }

  if (tab === 'texttab') {
    B.innerHTML = `
    <div class="sec"><span class="lbl">Font</span><div id="ff"></div></div>
    <div class="sec" style="margin-top:14px"><span class="lbl">Size</span><div class="row" id="fs"></div></div>
    <div style="background:#161620;border-radius:10px;padding:12px;border:1px solid #2a2a38;margin-top:14px">
      <span class="lbl">Preview</span>
      <span style="color:${S.strokeColor};font-size:${Math.min(S.fontSize, 24)}px;font-family:${S.fontFamily}">Hello, World!</span>
    </div>`;

    FONTS.forEach(f => {
      const b = document.createElement('button');
      b.className = 'fb' + (S.fontFamily === f.f ? ' on' : '');
      b.style.fontFamily = f.f;
      b.textContent = f.n;
      b.onclick = () => {
        S.fontFamily = f.f;
        renderSB('texttab');
      };
      document.getElementById('ff').appendChild(b);
    });

    FSIZES.forEach(s => {
      const b = document.createElement('button');
      b.className = 'szb' + (S.fontSize === s ? ' on' : '');
      b.textContent = s;
      b.onclick = () => {
        S.fontSize = s;
        renderSB('texttab');
      };
      document.getElementById('fs').appendChild(b);
    });
  }

  if (tab === 'actions') {
    B.innerHTML = `
    <div class="sec"><span class="lbl">Zoom — ${Math.round(VP.z * 100)}%</span>
      <div style="display:flex;gap:5px">
        <button class="zb" id="zo">${ic('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>')}Out</button>
        <button class="zb" id="zr">${ic('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>')}100%</button>
        <button class="zb" id="zi">${ic('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>')}In</button>
      </div>
    </div>
    <div class="sec" style="margin-top:14px"><span class="lbl">History</span>
      <div style="display:flex;gap:5px">
        <button class="zb" id="su">${ic('<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>')}Undo</button>
        <button class="zb" id="sr">${ic('<polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>')}Redo</button>
      </div>
    </div>
    <div class="sec" style="margin-top:14px"><span class="lbl">Export & Share</span>
      <button class="ab pr" id="sbclip">${ic('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>')} Clip & Share Region</button>
      <button class="ab" id="sbexp">${ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')} Export Full Canvas</button>
      <button class="ab dn" id="sbclr">${ic('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>')} Clear Canvas</button>
    </div>`;

    document.getElementById('zo').onclick = () => {
      VP.z = Math.max(VP.z / 1.2, 0.05);
      triggerRedraw();
      renderSB('actions');
      syncInfo();
    };
    document.getElementById('zr').onclick = () => {
      VP.z = 1;
      VP.ox = 0;
      VP.oy = 0;
      triggerRedraw();
      renderSB('actions');
      syncInfo();
    };
    document.getElementById('zi').onclick = () => {
      VP.z = Math.min(VP.z * 1.2, 10);
      triggerRedraw();
      renderSB('actions');
      syncInfo();
    };
    document.getElementById('su').onclick = () => {
      undo();
      renderSB('actions');
    };
    document.getElementById('sr').onclick = () => {
      redo();
      renderSB('actions');
    };
    document.getElementById('sbclip').onclick = () => {
      closeSB();
      startClip();
    };
    document.getElementById('sbexp').onclick = exportPng;
    document.getElementById('sbclr').onclick = clearAll;
  }
}

export function syncUR() {
  document.getElementById('bundo').disabled = state.hi <= 0;
  document.getElementById('bredo').disabled = state.hi >= state.hist.length - 1;
}

export function syncInfo() {
  document.getElementById('ti').textContent = `${state.els.length} element${state.els.length !== 1 ? 's' : ''} · ${Math.round(VP.z * 100)}%`;
}

export function showText(e) {
  const r = WB.getBoundingClientRect();
  const cx = ((e.clientX ?? e.touches?.[0]?.clientX) ?? 0) - r.left;
  const cy = ((e.clientY ?? e.touches?.[0]?.clientY) ?? 0) - r.top;
  txPos = s2c(cx, cy);
  TI.style.cssText = `display:block;left:${cx}px;top:${cy}px;font-size:${S.fontSize}px;font-family:${S.fontFamily};color:${S.strokeColor};min-width:160px;`;
  TI.value = '';
  setTimeout(() => TI.focus(), 10);
}

export function commitText() {
  const t = TI.value.trim();
  TI.style.display = 'none';
  if (!t || !txPos) return;
  const newEl = {
    id: Math.random().toString(36).slice(2),
    type: 'text',
    x: txPos.x,
    y: txPos.y,
    width: 0,
    height: 0,
    strokeColor: S.strokeColor,
    fillColor: 'transparent',
    strokeWidth: 1,
    roughness: 0,
    opacity: S.opacity,
    fontSize: S.fontSize,
    fontFamily: S.fontFamily,
    text: t
  };
  state.els.push(newEl);
  pushH(state.els);
  triggerRedraw();
  syncInfo();
  txPos = null;
  TI.value = '';
  emitDrawingOperation({ type: 'add', element: newEl });
}

export function initUI() {
  // Render rail buttons
  const tbContainer = document.getElementById('tbtns');
  tbContainer.innerHTML = '';
  TOOLS.forEach(t => {
    const b = document.createElement('button');
    b.className = 'tbtn' + (t.id === S.tool ? ' active' : '');
    b.id = 't-' + t.id;
    b.title = `${t.label} (${t.key})`;
    b.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">${t.svg}</svg>`;
    b.addEventListener('click', () => setTool(t.id));
    tbContainer.appendChild(b);
  });

  // Sidebar toggle buttons
  ['tools', 'style', 'texttab', 'actions'].forEach(id => {
    document.getElementById('b' + id).onclick = () => openSB(id);
  });
  document.getElementById('sbclose').onclick = closeSB;

  // Text input listeners
  TI.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      TI.style.display = 'none';
      TI.value = '';
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitText();
    }
  });
  TI.addEventListener('blur', commitText);

  // Undo/Redo/Clip rail buttons
  document.getElementById('bundo').onclick = undo;
  document.getElementById('bredo').onclick = redo;
  document.getElementById('bclip').onclick = startClip;

  setTool(S.tool);
  syncUR();
  syncInfo();
}
