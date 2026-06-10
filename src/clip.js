import { state, pushH, triggerRedraw } from './state.js';
import { WB } from './canvas.js';
import { syncInfo } from './ui.js';
import { emitDrawingOperation } from './collab.js';

const CLOV = document.getElementById('clov');
const CLCV = document.getElementById('clcv');
const CLCTX = CLCV?.getContext('2d');
const CLHINT = document.getElementById('clhint');
const PVM = document.getElementById('pvm');
const PVI = document.getElementById('pvi');

let clipping = false;
let clStart = null;
let clR = null;
let capUrl = null;

export function startClip() {
  CLOV.style.display = 'block';
  CLCV.width = window.innerWidth;
  CLCV.height = window.innerHeight;
  clR = null;
  clStart = null;
  drawClipOv();
}

function drawClipOv() {
  if (!CLCTX) return;
  CLCTX.clearRect(0, 0, CLCV.width, CLCV.height);
  CLCTX.fillStyle = 'rgba(0,0,0,0.5)';
  CLCTX.fillRect(0, 0, CLCV.width, CLCV.height);
  if (clR && clR.w > 0 && clR.h > 0) {
    CLCTX.clearRect(clR.x, clR.y, clR.w, clR.h);
    CLCTX.strokeStyle = '#5c6bc0';
    CLCTX.lineWidth = 2;
    CLCTX.setLineDash([6, 3]);
    CLCTX.strokeRect(clR.x, clR.y, clR.w, clR.h);
    CLCTX.setLineDash([]);
    CLCTX.fillStyle = '#5c6bc0';
    CLCTX.fillRect(clR.x, clR.y - 24, 90, 20);
    CLCTX.fillStyle = '#fff';
    CLCTX.font = '11px monospace';
    CLCTX.fillText(`${Math.round(clR.w)} × ${Math.round(clR.h)}`, clR.x + 5, clR.y - 9);
    CLHINT.style.display = 'none';
  } else {
    CLHINT.style.display = 'block';
  }
}

function doCapture() {
  CLOV.style.display = 'none';
  const r = clR;
  const off = document.createElement('canvas');
  off.width = r.w;
  off.height = r.h;
  const oc = off.getContext('2d');
  const cr = WB.getBoundingClientRect();
  oc.drawImage(
    WB,
    r.x * (WB.width / cr.width),
    r.y * (WB.height / cr.height),
    r.w * (WB.width / cr.width),
    r.h * (WB.height / cr.height),
    0,
    0,
    r.w,
    r.h
  );
  capUrl = off.toDataURL('image/png');
  PVI.src = capUrl;
  PVM.style.display = 'flex';
}

export function exportPng() {
  const a = document.createElement('a');
  a.download = 'whiteboard.png';
  a.href = WB.toDataURL();
  a.click();
}

export function clearAll() {
  if (!confirm('Clear the entire canvas?')) return;
  state.els = [];
  state.selId = null;
  state.activeEl = null;
  state.drawing = false;
  pushH(state.els);
  triggerRedraw();
  syncInfo();
  emitDrawingOperation({ type: 'clear' });
}

export function initClip() {
  if (!CLCV) return;

  CLCV.onmousedown = e => {
    clStart = { x: e.clientX, y: e.clientY };
    clipping = true;
    clR = null;
  };

  CLCV.onmousemove = e => {
    if (!clipping || !clStart) return;
    clR = {
      x: Math.min(clStart.x, e.clientX),
      y: Math.min(clStart.y, e.clientY),
      w: Math.abs(e.clientX - clStart.x),
      h: Math.abs(e.clientY - clStart.y)
    };
    drawClipOv();
  };

  CLCV.onmouseup = () => {
    clipping = false;
    if (clR && clR.w > 10 && clR.h > 10) doCapture();
  };

  document.getElementById('clx').onclick = () => {
    CLOV.style.display = 'none';
  };

  document.getElementById('pvx').onclick = () => {
    PVM.style.display = 'none';
  };

  document.getElementById('pvre').onclick = () => {
    PVM.style.display = 'none';
    startClip();
  };

  document.getElementById('pvdl').onclick = () => {
    if (!capUrl) return;
    const a = document.createElement('a');
    a.download = `clip-${Date.now()}.png`;
    a.href = capUrl;
    a.click();
  };

  document.getElementById('pvcopy').onclick = async () => {
    if (!capUrl) return;
    try {
      const b = await (await fetch(capUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
      const btn = document.getElementById('pvcopy');
      btn.className = 'pb ok';
      btn.textContent = '✓ Copied!';
      setTimeout(() => {
        btn.className = 'pb';
        btn.innerHTML = '📋 Copy Image';
      }, 2000);
    } catch {
      alert('Copy failed — use Download.');
    }
  };
}
