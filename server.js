const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Room management
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.on('create-room', (data) => {
    let code = generateRoomCode();
    while (rooms.has(code)) code = generateRoomCode();

    const room = {
      code,
      game: data.game,
      players: [{ id: socket.id, name: data.playerName }],
      state: null,
      turn: 0
    };
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    socket.playerIndex = 0;
    socket.emit('room-created', { code, playerIndex: 0 });
    console.log(`Sala ${code} creada para ${data.game}`);
  });

  socket.on('join-room', (data) => {
    const room = rooms.get(data.code);
    if (!room) return socket.emit('error-msg', 'Sala no encontrada');
    if (room.players.length >= 2) return socket.emit('error-msg', 'Sala llena');
    if (room.game !== data.game) return socket.emit('error-msg', `Esta sala es de ${room.game}`);

    room.players.push({ id: socket.id, name: data.playerName });
    socket.join(data.code);
    socket.roomCode = data.code;
    socket.playerIndex = 1;
    socket.emit('room-joined', { code: data.code, playerIndex: 1 });

    // Notify both players the game can start
    io.to(data.code).emit('game-start', {
      players: room.players.map(p => p.name),
      game: room.game
    });
    console.log(`${data.playerName} se unió a sala ${data.code}`);
  });

  // Generic game action
  socket.on('game-action', (data) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    // Broadcast to the other player
    socket.to(socket.roomCode).emit('game-action', {
      ...data,
      playerIndex: socket.playerIndex
    });
  });

  // Update shared game state
  socket.on('update-state', (data) => {
    const room = rooms.get(socket.roomCode);
    if (room) {
      room.state = data.state;
      room.turn = data.turn;
    }
  });

  socket.on('disconnect', () => {
    if (socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        io.to(socket.roomCode).emit('player-disconnected');
        rooms.delete(socket.roomCode);
      }
    }
    console.log('Usuario desconectado:', socket.id);
  });

  socket.on('leave-room', () => {
    if (socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        socket.to(socket.roomCode).emit('player-disconnected');
        rooms.delete(socket.roomCode);
      }
      socket.leave(socket.roomCode);
      socket.roomCode = null;
    }
  });

  socket.on('rematch', () => {
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('rematch-request');
    }
  });

  socket.on('rematch-accept', () => {
    if (socket.roomCode) {
      io.to(socket.roomCode).emit('rematch-start');
    }
  });
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`Servidor de juegos corriendo en http://localhost:${PORT}`);
});
