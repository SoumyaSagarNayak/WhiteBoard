import { S, VP, state, undo, redo, pushH, onRedraw, onSyncUR, onSyncInfo, triggerRedraw } from './state.js';
import { WB, resize, redraw, evPos, evRaw, hitTest } from './canvas.js';
import { initUI, setTool, getCursor, showText, syncUR, syncInfo, TI } from './ui.js';
import { initClip } from './clip.js';
import { initCollab, sendCursorUpdate, emitDrawingOperation, emitLaserPoint, emitLaserClear } from './collab.js';

// Setup state listeners
onRedraw(redraw);
onSyncUR(syncUR);
onSyncInfo(syncInfo);

// Register event listeners
WB.addEventListener('mousedown', onDown);
WB.addEventListener('mousemove', onMove);
WB.addEventListener('mouseup', onUp);
WB.addEventListener('mouseleave', onUp);

WB.addEventListener('touchstart', e => {
  e.preventDefault();
  onDown(e);
}, { passive: false });

WB.addEventListener('touchmove', e => {
  e.preventDefault();
  onMove(e);
}, { passive: false });

WB.addEventListener('touchend', e => {
  e.preventDefault();
  onUp(e);
}, { passive: false });

WB.addEventListener('wheel', onWheel, { passive: false });

window.addEventListener('resize', resize);

// Collaboration Cursor Updates
WB.addEventListener('mousemove', sendCursorUpdate);

function onDown(e) {
  const raw = evRaw(e);
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    state.panning = true;
    state.panX = raw.x;
    state.panY = raw.y;
    WB.style.cursor = 'grabbing';
    return;
  }
  const pos = evPos(e);
  state.sx = pos.x;
  state.sy = pos.y;

  if (S.tool === 'select') {
    const h = [...state.els].reverse().find(el => hitTest(pos.x, pos.y, el));
    state.selId = h ? h.id : null;
    state.activeEl = null;
    redraw();
    return;
  }
  if (S.tool === 'eraser') {
    const h = [...state.els].reverse().find(el => hitTest(pos.x, pos.y, el));
    if (h) {
      state.els = state.els.filter(e => e.id !== h.id);
      pushH(state.els);
      redraw();
      syncInfo();
      emitDrawingOperation({ type: 'delete', elementId: h.id });
    }
    return;
  }
  if (S.tool === 'text') {
    showText(e);
    return;
  }

  state.drawing = true;

  if (S.tool === 'laser') {
    state.laserPts = [{ x: pos.x, y: pos.y, t: Date.now() }];
    emitLaserPoint({ x: pos.x, y: pos.y });
    return;
  }

  const usePts = ['line', 'arrow', 'pencil'].includes(S.tool);
  state.activeEl = {
    id: Math.random().toString(36).slice(2),
    type: S.tool,
    x: pos.x,
    y: pos.y,
    width: 0,
    height: 0,
    strokeColor: S.strokeColor,
    fillColor: S.fillColor,
    strokeWidth: S.strokeWidth,
    roughness: S.roughness,
    opacity: S.opacity,
    fontSize: S.fontSize,
    fontFamily: S.fontFamily,
    points: usePts ? [{ x: pos.x, y: pos.y }] : undefined
  };
  if (S.tool === 'pencil') state.ppts = [{ x: pos.x, y: pos.y }];
}

function onMove(e) {
  if (state.panning) {
    const raw = evRaw(e);
    VP.ox += raw.x - state.panX;
    VP.oy += raw.y - state.panY;
    state.panX = raw.x;
    state.panY = raw.y;
    redraw();
    syncInfo();
    return;
  }

  const pos = evPos(e);

  if (S.tool === 'laser' && state.drawing) {
    state.laserPts.push({ x: pos.x, y: pos.y, t: Date.now() });
    if (state.laserPts.length > 80) state.laserPts.shift();
    redraw();
    emitLaserPoint({ x: pos.x, y: pos.y });
    return;
  }

  if (!state.drawing || !state.activeEl) return;

  if (S.tool === 'pencil') {
    state.ppts.push({ x: pos.x, y: pos.y });
    state.activeEl = { ...state.activeEl, points: state.ppts.slice() };
  } else if (S.tool === 'line' || S.tool === 'arrow') {
    state.activeEl = { ...state.activeEl, points: [{ x: state.sx, y: state.sy }, { x: pos.x, y: pos.y }] };
  } else {
    state.activeEl = { ...state.activeEl, width: pos.x - state.sx, height: pos.y - state.sy };
  }
  redraw();
}

function onUp() {
  state.panning = false;
  WB.style.cursor = getCursor();
  if (S.tool === 'laser') {
    state.drawing = false;
    state.laserPts = [];
    redraw();
    emitLaserClear();
    return;
  }
  if (!state.drawing) return;
  state.drawing = false;
  if (!state.activeEl) return;
  if (state.activeEl.type === 'pencil' && (!state.activeEl.points || state.activeEl.points.length < 2)) {
    state.activeEl = null;
    return;
  }
  const finalEl = {
    ...state.activeEl,
    points: state.activeEl.points ? state.activeEl.points.map(p => ({ ...p })) : undefined
  };
  state.els.push(finalEl);
  state.activeEl = null;
  state.ppts = [];
  pushH(state.els);
  redraw();
  syncInfo();
  emitDrawingOperation({ type: 'add', element: finalEl });
}

function onWheel(e) {
  e.preventDefault();
  const r = WB.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  const d = e.deltaY > 0 ? 0.9 : 1.1;
  const nz = Math.min(Math.max(VP.z * d, 0.05), 10);
  VP.ox = mx - (mx - VP.ox) * (nz / VP.z);
  VP.oy = my - (my - VP.oy) * (nz / VP.z);
  VP.z = nz;
  redraw();
  syncInfo();
}

// Document shortcuts
document.addEventListener('keydown', e => {
  if (e.target === TI || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault();
    redo();
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selId) {
    const deletedId = state.selId;
    state.els = state.els.filter(el => el.id !== state.selId);
    state.selId = null;
    pushH(state.els);
    redraw();
    syncInfo();
    emitDrawingOperation({ type: 'delete', elementId: deletedId });
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const map = {
    v: 'select',
    r: 'rectangle',
    d: 'diamond',
    c: 'circle',
    a: 'arrow',
    l: 'line',
    p: 'pencil',
    t: 'text',
    e: 'eraser',
    z: 'laser'
  };
  if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
});

// Laser fade out loop
let lastRaf = 0;
(function loop(ts) {
  if (state.laserPts.length > 0 || Object.keys(state.remLasers).length > 0) {
    if (ts - lastRaf > 16) {
      redraw();
      lastRaf = ts;
    }
  }
  requestAnimationFrame(loop);
})(0);

// Initialize application modules
resize();
initUI();
initClip();
initCollab();
