export const S = {
  tool: 'pencil',
  strokeColor: '#e8e8f0',
  fillColor: 'transparent',
  strokeWidth: 2,
  roughness: 1,
  fontSize: 18,
  fontFamily: 'Segoe UI, system-ui, sans-serif',
  opacity: 1
};

export const VP = {
  ox: 0,
  oy: 0,
  z: 1
};

export const state = {
  els: [],
  hist: [[]],
  hi: 0,
  selId: null,
  drawing: false,
  panning: false,
  activeEl: null,
  sx: 0,
  sy: 0,
  panX: 0,
  panY: 0,
  ppts: [],
  laserPts: [],
  remLasers: {},
  remCursors: {}
};

let redrawCallback = () => {};
let syncURCallback = () => {};
let syncInfoCallback = () => {};

export function onRedraw(fn) {
  redrawCallback = fn;
}

export function onSyncUR(fn) {
  syncURCallback = fn;
}

export function onSyncInfo(fn) {
  syncInfoCallback = fn;
}

export function triggerRedraw() {
  redrawCallback();
}

export function triggerSyncUR() {
  syncURCallback();
}

export function triggerSyncInfo() {
  syncInfoCallback();
}

export function cp(arr) {
  return arr.map(e => ({
    ...e,
    points: e.points ? e.points.map(p => ({ ...p })) : undefined
  }));
}

export function pushH(arr) {
  state.hist = [...state.hist.slice(0, state.hi + 1), cp(arr)];
  state.hi = state.hist.length - 1;
  triggerSyncUR();
}

export function undo() {
  if (state.hi > 0) {
    state.hi--;
    state.els = cp(state.hist[state.hi]);
    triggerRedraw();
    triggerSyncUR();
    triggerSyncInfo();
  }
}

export function redo() {
  if (state.hi < state.hist.length - 1) {
    state.hi++;
    state.els = cp(state.hist[state.hi]);
    triggerRedraw();
    triggerSyncUR();
    triggerSyncInfo();
  }
}
