const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

// Serve the whiteboard HTML
app.use(express.static(path.join(__dirname, '..')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../whiteboard.html')));

// In-memory rooms: { roomId: { elements: [], users: {} } }
const rooms = {};

io.on('connection', socket => {
  let currentRoom = null;
  let currentUser = null;

  socket.on('join_room', ({ roomId, user }) => {
    if (currentRoom) socket.leave(currentRoom);
    currentRoom = roomId;
    currentUser = user;

    if (!rooms[roomId]) rooms[roomId] = { elements: [], users: {} };
    rooms[roomId].users[user.id] = { ...user, socketId: socket.id };
    socket.join(roomId);

    socket.emit('room_joined', {
      roomId,
      elements: rooms[roomId].elements,
      collaborators: Object.values(rooms[roomId].users),
    });

    socket.to(roomId).emit('collaborators_updated', {
      collaborators: Object.values(rooms[roomId].users),
    });
  });

  socket.on('drawing_operation', ({ roomId, operation }) => {
    if (!rooms[roomId]) return;
    if (operation.type === 'add' && operation.element)
      rooms[roomId].elements.push(operation.element);
    if (operation.type === 'delete' && operation.elementId)
      rooms[roomId].elements = rooms[roomId].elements.filter(e => e.id !== operation.elementId);
    if (operation.type === 'clear')
      rooms[roomId].elements = [];
    socket.to(roomId).emit('operation_applied', operation);
  });

  socket.on('cursor_update', ({ roomId, position, user }) => {
    socket.to(roomId).emit('cursor_moved', { userId: user?.id || currentUser?.id, position, user: user || currentUser });
  });

  socket.on('laser_point', data => {
    socket.to(data.roomId).emit('laser_point', data);
  });

  socket.on('laser_clear', data => {
    socket.to(data.roomId).emit('laser_clear', data);
  });

  socket.on('leave_room', ({ roomId }) => {
    handleLeave(roomId);
  });

  socket.on('disconnect', () => {
    if (currentRoom) handleLeave(currentRoom);
  });

  function handleLeave(roomId) {
    if (!rooms[roomId] || !currentUser) return;
    delete rooms[roomId].users[currentUser.id];
    socket.leave(roomId);
    if (Object.keys(rooms[roomId].users).length === 0) {
      delete rooms[roomId];
    } else {
      io.to(roomId).emit('collaborators_updated', {
        collaborators: Object.values(rooms[roomId].users),
      });
    }
    currentRoom = null;
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`\n✅ Whiteboard running at http://localhost:${PORT}\n`));
