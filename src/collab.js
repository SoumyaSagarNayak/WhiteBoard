import { io } from 'socket.io-client';
import { state, pushH, triggerRedraw } from './state.js';
import { evPos } from './canvas.js';
import { syncInfo } from './ui.js';

export const UCOLS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bff', '#ff9f43', '#a29bfe', '#00d2d3'];
export const myId = Math.random().toString(36).slice(2);
export const myCol = UCOLS[Math.floor(Math.random() * UCOLS.length)];

export let sock = null;
export let connected = false;
export let roomId = null;
let myName = 'Me';
let collabs = [];

export function emitDrawingOperation(operation) {
  if (sock && connected && roomId) {
    sock.emit('drawing_operation', { roomId, operation: { ...operation, userId: myId } });
  }
}

export function emitLaserPoint(point) {
  if (sock && connected && roomId) {
    sock.emit('laser_point', { roomId, point, timestamp: Date.now(), color: myCol, userId: myId });
  }
}

export function emitLaserClear() {
  if (sock && connected && roomId) {
    sock.emit('laser_clear', { roomId, userId: myId });
  }
}

export function sendCursorUpdate(e) {
  if (!sock || !connected || !roomId) return;
  sock.emit('cursor_update', {
    roomId,
    position: evPos(e),
    user: { id: myId, name: myName, color: myCol }
  });
}

export function renderCollab() {
  const body = document.getElementById('cpbody');
  const btn = document.getElementById('cbtn');
  if (!body || !btn) return;

  document.getElementById('cbtnl').textContent = connected ? collabs.length + ' online' : 'Collaborate';
  btn.className = connected ? 'on' : '';
  document.getElementById('cptitle').textContent = connected ? 'Room: ' + roomId : 'Collaborate';

  if (!connected) {
    body.innerHTML = `
      <input class="ci" id="cn" placeholder="Your name"/>
      <input class="ci" id="cr" placeholder="Room ID (blank = new room)"/>
      <button class="cj" id="cjoin">Join / Create Room →</button>
      <p class="cn" style="color:#44445a;font-size:11px;text-align:center;margin-top:6px">Share Room ID with teammates</p>
    `;
    document.getElementById('cjoin').onclick = doJoin;
    document.getElementById('cn').onkeydown = e => { if (e.key === 'Enter') doJoin(); };
    document.getElementById('cr').onkeydown = e => { if (e.key === 'Enter') doJoin(); };
  } else {
    body.innerHTML = `
      <button class="cc" id="ccopy">🔗 Copy invite link</button>
      <div style="margin-bottom:8px">
        <span class="lbl">In this room</span>
        <div id="ulist"></div>
      </div>
      <button class="cl" id="cleave">Leave Room</button>
    `;
    const ul = document.getElementById('ulist');
    collabs.forEach(u => {
      const d = document.createElement('div');
      d.className = 'ur';
      d.innerHTML = `
        <div class="ua" style="background:${u.color}">${u.name[0].toUpperCase()}</div>
        <span class="un">${u.name}${u.id === myId ? '<span class="uy">you</span>' : ''}</span>
      `;
      ul.appendChild(d);
    });

    document.getElementById('ccopy').onclick = () => {
      navigator.clipboard.writeText(`${location.href.split('?')[0]}?room=${roomId}`).catch(() => {});
      const b = document.getElementById('ccopy');
      b.className = 'cc ok';
      b.textContent = '✓ Link copied!';
      setTimeout(renderCollab, 2000);
    };
    document.getElementById('cleave').onclick = doLeave;
  }
}

function doJoin() {
  myName = document.getElementById('cn')?.value.trim() || 'Anonymous';
  const target = document.getElementById('cr')?.value.trim() || Math.random().toString(36).slice(2, 8).toUpperCase();
  connectSock(target);
}

function connectSock(target) {
  if (sock) sock.disconnect();

  const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : window.location.origin;

  sock = io(serverUrl, { transports: ['websocket', 'polling'] });

  sock.on('connect', () => {
    sock.emit('join_room', { roomId: target, user: { id: myId, name: myName, color: myCol } });
  });

  sock.on('room_joined', d => {
    roomId = d.roomId;
    collabs = d.collaborators || [];
    connected = true;
    if (d.elements?.length) {
      state.els = d.elements;
      pushH(state.els);
      triggerRedraw();
      syncInfo();
    }
    renderCollab();
  });

  sock.on('collaborators_updated', d => {
    collabs = d.collaborators || [];
    renderCollab();
  });

  sock.on('operation_applied', op => {
    if (op.userId === myId) return;
    if (op.type === 'add' && op.element) {
      state.els.push(op.element);
      triggerRedraw();
      syncInfo();
    }
    if (op.type === 'delete' && op.elementId) {
      state.els = state.els.filter(e => e.id !== op.elementId);
      triggerRedraw();
      syncInfo();
    }
    if (op.type === 'clear') {
      state.els = [];
      triggerRedraw();
      syncInfo();
    }
  });

  sock.on('cursor_moved', d => {
    if (d.userId === myId) return;
    state.remCursors[d.userId] = {
      x: d.position.x,
      y: d.position.y,
      name: d.user?.name || '?',
      color: d.user?.color || '#a29bfe'
    };
    triggerRedraw();
  });

  sock.on('laser_point', d => {
    if (d.userId === myId) return;
    if (!state.remLasers[d.userId]) {
      state.remLasers[d.userId] = { pts: [], color: d.color || '#ff6b6b' };
    }
    state.remLasers[d.userId].pts.push({ x: d.point.x, y: d.point.y, t: d.timestamp });
    if (state.remLasers[d.userId].pts.length > 60) {
      state.remLasers[d.userId].pts.shift();
    }
    triggerRedraw();
  });

  sock.on('laser_clear', d => {
    delete state.remLasers[d.userId];
    triggerRedraw();
  });

  sock.on('disconnect', () => {
    connected = false;
    renderCollab();
  });
}

function doLeave() {
  if (sock) {
    sock.emit('leave_room', { roomId });
    sock.disconnect();
    sock = null;
  }
  roomId = null;
  connected = false;
  collabs = [];
  state.remCursors = {};
  document.getElementById('cpan').style.display = 'none';
  renderCollab();
}

export function initCollab() {
  document.getElementById('cbtn').onclick = () => {
    const p = document.getElementById('cpan');
    const vis = p.style.display === 'block';
    p.style.display = vis ? 'none' : 'block';
    if (!vis) renderCollab();
  };

  document.getElementById('cpx').onclick = () => {
    document.getElementById('cpan').style.display = 'none';
  };

  document.addEventListener('mousedown', e => {
    if (!document.getElementById('cw').contains(e.target)) {
      document.getElementById('cpan').style.display = 'none';
    }
  });

  // URL room
  const urlRoom = new URLSearchParams(location.search).get('room');
  if (urlRoom) {
    setTimeout(() => {
      document.getElementById('cpan').style.display = 'block';
      renderCollab();
      const ri = document.getElementById('cr');
      if (ri) ri.value = urlRoom;
    }, 200);
  }

  renderCollab();
}
