const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 10000,
  pingTimeout: 20000
});

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

  // Keepalive
  socket.on('ping-keep', () => socket.emit('pong-keep'));

  // Rejoin room after reconnect
  socket.on('rejoin-room', (data) => {
    const room = rooms.get(data.code);
    if (!room) return socket.emit('error-msg', 'Sala expirada');

    const pi = room.players.findIndex(p => p.name === data.playerName);
    if (pi === -1) return socket.emit('error-msg', 'No estás en esta sala');

    // Update socket id for this player
    room.players[pi].id = socket.id;
    socket.join(data.code);
    socket.roomCode = data.code;
    socket.playerIndex = pi;
    socket.emit('rejoin-ok', { playerIndex: pi });
    console.log(`${data.playerName} reconectado a sala ${data.code}`);
  });

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

  socket.on('disconnect', (reason) => {
    console.log('Usuario desconectado:', socket.id, reason);
    if (socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        // Don't delete room immediately - give time to reconnect
        const playerName = room.players.find(p => p.id === socket.id)?.name;
        socket.to(socket.roomCode).emit('player-away', { playerName });

        // Delete room after 2 minutes if player doesn't reconnect
        setTimeout(() => {
          const currentRoom = rooms.get(socket.roomCode);
          if (currentRoom) {
            const player = currentRoom.players.find(p => p.id === socket.id);
            if (player) {
              // Player never reconnected (still has old socket id)
              io.to(socket.roomCode).emit('player-disconnected');
              rooms.delete(socket.roomCode);
              console.log(`Sala ${socket.roomCode} eliminada por timeout`);
            }
          }
        }, 120000);
      }
    }
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
