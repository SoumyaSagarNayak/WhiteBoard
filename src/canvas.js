import { S, VP, state } from './state.js';

export const WB = document.getElementById('wb');
export const CX = WB.getContext('2d');

export function resize() {
  WB.width = window.innerWidth;
  WB.height = window.innerHeight;
  redraw();
}

export function s2c(x, y) {
  return { x: (x - VP.ox) / VP.z, y: (y - VP.oy) / VP.z };
}

export function evPos(e) {
  const r = WB.getBoundingClientRect();
  const cx = ((e.clientX ?? e.touches?.[0]?.clientX) ?? 0) - r.left;
  const cy = ((e.clientY ?? e.touches?.[0]?.clientY) ?? 0) - r.top;
  return s2c(cx, cy);
}

export function evRaw(e) {
  return {
    x: (e.clientX ?? e.touches?.[0]?.clientX) ?? 0,
    y: (e.clientY ?? e.touches?.[0]?.clientY) ?? 0
  };
}

export function redraw() {
  if (!CX) return;
  CX.clearRect(0, 0, WB.width, WB.height);

  // Background
  CX.fillStyle = '#111117';
  CX.fillRect(0, 0, WB.width, WB.height);

  CX.save();
  CX.translate(VP.ox, VP.oy);
  CX.scale(VP.z, VP.z);

  // Grid
  drawGrid();

  // Elements
  state.els.forEach(e => drawEl(e));

  // Selection
  if (state.selId) {
    const el = state.els.find(e => e.id === state.selId);
    if (el) drawSel(el);
  }

  // Active preview
  if (state.activeEl) drawEl(state.activeEl);

  // Laser
  const now = Date.now();
  if (state.laserPts.length > 1) drawLaser(state.laserPts, '#ff3344', now);
  Object.values(state.remLasers).forEach(l => {
    if (l.pts.length > 1) drawLaser(l.pts, l.color, now);
  });

  CX.restore();

  // Remote cursors (screen space)
  Object.values(state.remCursors).forEach(c => {
    drawCursor(c.x * VP.z + VP.ox, c.y * VP.z + VP.oy, c.name, c.color);
  });
}

export function drawGrid() {
  const gs = 28;
  const x0 = Math.floor(-VP.ox / VP.z / gs) * gs;
  const y0 = Math.floor(-VP.oy / VP.z / gs) * gs;
  CX.fillStyle = '#1a1a24';
  for (let x = x0; x < x0 + WB.width / VP.z + gs * 2; x += gs) {
    for (let y = y0; y < y0 + WB.height / VP.z + gs * 2; y += gs) {
      CX.beginPath();
      CX.arc(x, y, 1, 0, Math.PI * 2);
      CX.fill();
    }
  }
}

export function drawEl(el) {
  if (!el || !el.type) return;
  CX.save();
  CX.globalAlpha = el.opacity ?? 1;
  CX.strokeStyle = el.strokeColor || '#fff';
  CX.lineWidth = el.strokeWidth || 2;
  CX.lineCap = 'round';
  CX.lineJoin = 'round';

  const fill = el.fillColor && el.fillColor !== 'transparent';

  switch (el.type) {
    case 'rectangle': {
      const w = el.width || 0, h = el.height || 0;
      if (fill) {
        CX.fillStyle = el.fillColor;
        CX.fillRect(el.x, el.y, w, h);
      }
      CX.strokeRect(el.x, el.y, w, h);
      break;
    }

    case 'diamond': {
      const w = el.width || 0, h = el.height || 0;
      const cx = el.x + w / 2, cy = el.y + h / 2;
      CX.beginPath();
      CX.moveTo(cx, el.y);
      CX.lineTo(el.x + w, cy);
      CX.lineTo(cx, el.y + h);
      CX.lineTo(el.x, cy);
      CX.closePath();
      if (fill) {
        CX.fillStyle = el.fillColor;
        CX.fill();
      }
      CX.stroke();
      break;
    }

    case 'circle': {
      const w = el.width || 0, h = el.height || 0;
      const cx = el.x + w / 2, cy = el.y + h / 2;
      CX.beginPath();
      CX.ellipse(cx, cy, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
      CX.closePath();
      if (fill) {
        CX.fillStyle = el.fillColor;
        CX.fill();
      }
      CX.stroke();
      break;
    }

    case 'line': {
      const pts = el.points;
      if (pts && pts.length >= 2) {
        CX.beginPath();
        CX.moveTo(pts[0].x, pts[0].y);
        CX.lineTo(pts[1].x, pts[1].y);
        CX.stroke();
      }
      break;
    }

    case 'arrow': {
      const pts = el.points;
      if (pts && pts.length >= 2) {
        const [p1, p2] = pts;
        CX.beginPath();
        CX.moveTo(p1.x, p1.y);
        CX.lineTo(p2.x, p2.y);
        CX.stroke();
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x), L = 16, A = Math.PI / 6;
        CX.beginPath();
        CX.moveTo(p2.x, p2.y);
        CX.lineTo(p2.x - L * Math.cos(ang - A), p2.y - L * Math.sin(ang - A));
        CX.moveTo(p2.x, p2.y);
        CX.lineTo(p2.x - L * Math.cos(ang + A), p2.y - L * Math.sin(ang + A));
        CX.stroke();
      }
      break;
    }

    case 'pencil': {
      const pts = el.points;
      if (pts && pts.length > 1) {
        CX.beginPath();
        CX.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) CX.lineTo(pts[i].x, pts[i].y);
        CX.stroke();
      }
      break;
    }

    case 'text': {
      if (el.text) {
        CX.font = `${el.fontSize || 18}px ${el.fontFamily || 'sans-serif'}`;
        CX.fillStyle = el.strokeColor || '#fff';
        const lines = el.text.split('\n');
        const lh = (el.fontSize || 18) * 1.4;
        lines.forEach((ln, i) => CX.fillText(ln, el.x, el.y + lh * (i + 1)));
      }
      break;
    }
  }
  CX.restore();
}

export function drawSel(el) {
  const pad = 10;
  let x = el.x - pad, y = el.y - pad, w = (el.width || 0) + pad * 2, h = (el.height || 0) + pad * 2;
  if (el.points && el.points.length) {
    const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y);
    x = Math.min(...xs) - pad;
    y = Math.min(...ys) - pad;
    w = Math.max(...xs) - Math.min(...xs) + pad * 2;
    h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  }
  CX.save();
  CX.strokeStyle = '#5c6bc0';
  CX.lineWidth = 1.5 / VP.z;
  CX.setLineDash([5 / VP.z, 3 / VP.z]);
  CX.strokeRect(x, y, w, h);
  CX.setLineDash([]);
  CX.fillStyle = '#5c6bc0';
  [
    [x, y],
    [x + w / 2, y],
    [x + w, y],
    [x, y + h / 2],
    [x + w, y + h / 2],
    [x, y + h],
    [x + w / 2, y + h],
    [x + w, y + h]
  ].forEach(([hx, hy]) => CX.fillRect(hx - 4 / VP.z, hy - 4 / VP.z, 8 / VP.z, 8 / VP.z));
  CX.restore();
}

export function drawLaser(pts, color, now) {
  if (pts.length < 2) return;
  CX.save();
  CX.lineCap = 'round';
  CX.lineJoin = 'round';
  for (let i = 1; i < pts.length; i++) {
    CX.globalAlpha = Math.max(0, 1 - (now - (pts[i].t || now)) / 2000);
    CX.strokeStyle = color;
    CX.lineWidth = 4 / VP.z;
    CX.beginPath();
    CX.moveTo(pts[i - 1].x, pts[i - 1].y);
    CX.lineTo(pts[i].x, pts[i].y);
    CX.stroke();
  }
  CX.restore();
}

export function drawCursor(sx, sy, name, color) {
  CX.save();
  CX.fillStyle = color;
  CX.strokeStyle = '#fff';
  CX.lineWidth = 1;
  CX.beginPath();
  CX.moveTo(sx, sy);
  CX.lineTo(sx + 10, sy + 14);
  CX.lineTo(sx + 4, sy + 12);
  CX.lineTo(sx + 2, sy + 18);
  CX.lineTo(sx, sy + 16);
  CX.lineTo(sx + 2, sy + 10);
  CX.closePath();
  CX.fill();
  CX.stroke();
  const tw = CX.measureText(name).width;
  CX.fillStyle = color;
  CX.fillRect(sx + 12, sy + 14, tw + 8, 18);
  CX.fillStyle = '#fff';
  CX.font = '11px sans-serif';
  CX.fillText(name, sx + 16, sy + 27);
  CX.restore();
}

export function hitTest(px, py, el) {
  const pad = 10;
  if (el.points && el.points.length) {
    const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y);
    return (
      px >= Math.min(...xs) - pad &&
      px <= Math.max(...xs) + pad &&
      py >= Math.min(...ys) - pad &&
      py <= Math.max(...ys) + pad
    );
  }
  return (
    px >= Math.min(el.x, el.x + (el.width || 0)) - pad &&
    px <= Math.max(el.x, el.x + (el.width || 0)) + pad &&
    py >= Math.min(el.y, el.y + (el.height || 0)) - pad &&
    py <= Math.max(el.y, el.y + (el.height || 0)) + pad
  );
}
