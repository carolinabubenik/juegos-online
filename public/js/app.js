const socket = io({
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

let currentGame = null;
let playerIndex = -1;
let playerNames = [];
let gameInstance = null;
let currentRoomCode = null;

// DOM
const $ = id => document.getElementById(id);

// --- LocalStorage for name ---
const savedName = localStorage.getItem('playerName');
if (savedName) $('player-name').value = savedName;

$('player-name').addEventListener('input', () => {
  localStorage.setItem('playerName', $('player-name').value.trim());
});

// --- Keepalive (prevents Render free tier from sleeping the connection) ---
setInterval(() => {
  if (socket.connected) socket.emit('ping-keep');
}, 15000);

// --- Connection status ---
socket.on('connect', () => {
  // If we were in a room, try to rejoin
  if (currentRoomCode && playerNames.length) {
    const name = $('player-name').value.trim();
    socket.emit('rejoin-room', { code: currentRoomCode, playerName: name });
  }
});

socket.on('rejoin-ok', (data) => {
  playerIndex = data.playerIndex;
  notify('Reconectado', 'success');
});

socket.on('disconnect', () => {
  if (currentRoomCode) {
    notify('Conexión perdida, reconectando...', 'error');
  }
});

socket.on('player-away', (data) => {
  if (data.playerName) {
    notify(`${data.playerName} se desconectó, esperando reconexión...`, 'error');
  }
});

const screens = {
  landing: $('landing'),
  lobby: $('lobby'),
  waiting: $('waiting'),
  game: $('game-container')
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function notify(msg, type = '') {
  const el = $('notification');
  el.textContent = msg;
  el.className = 'notification show ' + type;
  setTimeout(() => el.classList.remove('show'), 3000);
}

const instructions = {
  serpientes: {
    title: '🐍🪜 Túneles y Toboganes',
    body: `
      <h3>Objetivo</h3>
      <p>Ser el primero en llegar a la casilla 100.</p>
      <h3>Cómo jugar</h3>
      <ul>
        <li>Cada jugador tira un dado en su turno y avanza esa cantidad de casillas</li>
        <li>Si caés en una <b style="color:#4ade80">escalera (verde)</b>, subís automáticamente</li>
        <li>Si caés en un <b style="color:#e94560">tobogán (rojo)</b>, bajás automáticamente</li>
        <li>Necesitás el número exacto para llegar a 100</li>
        <li>¡El primero en llegar gana!</li>
      </ul>
    `
  },
  ahorcado: {
    title: '💀 Ahorcado',
    body: `
      <h3>Objetivo</h3>
      <p>Un jugador elige una palabra y el otro debe adivinarla.</p>
      <h3>Cómo jugar</h3>
      <ul>
        <li>El Jugador 1 escribe una palabra secreta</li>
        <li>El Jugador 2 va eligiendo letras para intentar adivinarla</li>
        <li>Cada letra incorrecta agrega una parte al muñeco (6 errores = pierde)</li>
        <li>Si adivina la palabra completa, gana el Jugador 2</li>
        <li>Luego se intercambian los roles</li>
      </ul>
    `
  },
  naval: {
    title: '🚢 Batalla Naval',
    body: `
      <h3>Objetivo</h3>
      <p>Hundir todos los barcos del rival antes de que hunda los tuyos.</p>
      <h3>Cómo jugar</h3>
      <ul>
        <li>Cada jugador ubica sus barcos en un tablero de 10×10</li>
        <li>Barcos: Portaaviones (5), Acorazado (4), Crucero (3), Submarino (3), Destructor (2)</li>
        <li>Click derecho o botón para rotar el barco al ubicarlo</li>
        <li>Por turnos, elegí una casilla del tablero rival para disparar</li>
        <li>Rojo = impacto, Azul oscuro = agua</li>
        <li>¡El primero en hundir todos los barcos enemigos gana!</li>
      </ul>
    `
  },
  memotest: {
    title: '🧠 Memotest',
    body: `
      <h3>Objetivo</h3>
      <p>Encontrar todos los pares de cartas iguales en la menor cantidad de intentos.</p>
      <h3>Cómo jugar</h3>
      <ul>
        <li>Hacé click en una carta para darla vuelta</li>
        <li>Luego hacé click en otra carta para buscar su par</li>
        <li>Si las dos cartas son iguales, ¡quedan descubiertas!</li>
        <li>Si no son iguales, se vuelven a dar vuelta</li>
        <li>Intentá recordar dónde está cada carta</li>
        <li>¡Ganás cuando encontrás todos los pares!</li>
      </ul>
      <h3>Dificultad</h3>
      <ul>
        <li><b>Fácil:</b> 12 cartas (6 pares)</li>
        <li><b>Normal:</b> 20 cartas (10 pares)</li>
        <li><b>Difícil:</b> 30 cartas (15 pares)</li>
      </ul>
    `
  },
  buscaminas: {
    title: '💣 Buscaminas',
    body: `
      <h3>Objetivo</h3>
      <p>Descubrir todas las casillas que no tienen minas.</p>
      <h3>Cómo jugar</h3>
      <ul>
        <li>Hacé click en una casilla para descubrirla</li>
        <li>El número indica cuántas minas hay alrededor</li>
        <li>Si la casilla está vacía, se abren automáticamente las vecinas</li>
        <li>Click derecho (o botón 🚩) para marcar donde creés que hay una mina</li>
        <li>¡Si pisás una mina, perdés!</li>
        <li>Ganás cuando descubrís todas las casillas sin minas</li>
      </ul>
      <h3>Dificultad</h3>
      <ul>
        <li><b>Fácil:</b> 8×8 con 10 minas</li>
        <li><b>Normal:</b> 10×10 con 20 minas</li>
        <li><b>Difícil:</b> 12×12 con 35 minas</li>
      </ul>
    `
  },
  generala: {
    title: '🎲 Generala',
    body: `
      <h3>Objetivo</h3>
      <p>Obtener el mayor puntaje combinando dados.</p>
      <h3>Cómo jugar</h3>
      <ul>
        <li>Cada turno tirás 5 dados, con hasta 3 tiros por turno</li>
        <li>Podés guardar dados entre tiros haciendo click en ellos</li>
        <li>Al final del turno, elegí dónde anotar el puntaje</li>
      </ul>
      <h3>Categorías</h3>
      <ul>
        <li><b>1s a 6s:</b> Suma de los dados del número elegido</li>
        <li><b>Escalera:</b> 1-2-3-4-5 o 2-3-4-5-6 (20 pts, servida 25)</li>
        <li><b>Full:</b> Trío + par (30 pts, servido 35)</li>
        <li><b>Póker:</b> 4 iguales (40 pts, servido 45)</li>
        <li><b>Generala:</b> 5 iguales (50 pts, servida cierra el juego)</li>
      </ul>
    `
  }
};

// Game card clicks
document.querySelectorAll('.game-card:not(.coming-soon)').forEach(card => {
  card.addEventListener('click', () => {
    const name = $('player-name').value.trim();
    if (!name) {
      notify('Ingresá tu nombre primero', 'error');
      $('player-name').focus();
      return;
    }
    // Save name
    localStorage.setItem('playerName', name);
    currentGame = card.dataset.game;

    // Solo games go directly to the game
    if (card.dataset.mode === 'solo') {
      const soloGames = { memotest: MemotestGame, buscaminas: BuscaminasGame };
      const info = instructions[currentGame];
      $('game-title-bar').textContent = info.title;
      $('game-players').textContent = name;
      $('game-area').innerHTML = '';
      showScreen('game');
      gameInstance = new soloGames[currentGame]($('game-area'), name);
      return;
    }

    $('lobby-game-title').textContent = instructions[currentGame].title;
    showScreen('lobby');
  });
});

// Create room
$('btn-create').addEventListener('click', () => {
  socket.emit('create-room', { game: currentGame, playerName: $('player-name').value.trim() });
});

// Join room
$('btn-join').addEventListener('click', () => {
  const code = $('room-code-input').value.trim().toUpperCase();
  if (code.length !== 4) return notify('El código debe tener 4 caracteres', 'error');
  socket.emit('join-room', { code, game: currentGame, playerName: $('player-name').value.trim() });
});

$('room-code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('btn-join').click();
});

// Instructions
$('btn-instructions').addEventListener('click', () => {
  const inst = instructions[currentGame];
  $('instructions-title').textContent = inst.title;
  $('instructions-body').innerHTML = inst.body;
  $('instructions-modal').classList.add('active');
});
$('close-instructions').addEventListener('click', () => {
  $('instructions-modal').classList.remove('active');
});

// Back
$('btn-back-lobby').addEventListener('click', () => showScreen('landing'));

// Cancel wait
$('btn-cancel-wait').addEventListener('click', () => {
  socket.emit('leave-room');
  currentRoomCode = null;
  showScreen('lobby');
});

// Leave game
$('btn-leave').addEventListener('click', () => {
  if (gameInstance && gameInstance.destroy) gameInstance.destroy();
  gameInstance = null;
  socket.emit('leave-room');
  currentRoomCode = null;
  showScreen('landing');
});

// Socket events
socket.on('room-created', (data) => {
  playerIndex = data.playerIndex;
  currentRoomCode = data.code;
  $('display-room-code').textContent = data.code;
  showScreen('waiting');
});

socket.on('room-joined', (data) => {
  playerIndex = data.playerIndex;
  currentRoomCode = data.code;
});

socket.on('error-msg', (msg) => notify(msg, 'error'));

socket.on('game-start', (data) => {
  playerNames = data.players;
  $('game-title-bar').textContent = instructions[data.game].title;
  $('game-players').textContent = `${playerNames[0]} vs ${playerNames[1]}`;
  $('game-area').innerHTML = '';
  showScreen('game');

  // Initialize the game
  const games = { serpientes: SerpientesGame, ahorcado: AhorcadoGame, naval: NavalGame, generala: GeneralaGame };
  gameInstance = new games[data.game]($('game-area'), socket, playerIndex, playerNames);
});

socket.on('player-disconnected', () => {
  notify('El otro jugador se desconectó', 'error');
  if (gameInstance && gameInstance.destroy) gameInstance.destroy();
  gameInstance = null;
  currentRoomCode = null;
  setTimeout(() => showScreen('landing'), 2000);
});

socket.on('game-action', (data) => {
  if (gameInstance && gameInstance.onAction) gameInstance.onAction(data);
});

socket.on('rematch-request', () => {
  notify('El rival quiere revancha!');
  if (gameInstance && gameInstance.onRematchRequest) gameInstance.onRematchRequest();
});

socket.on('rematch-start', () => {
  if (gameInstance && gameInstance.onRematchStart) gameInstance.onRematchStart();
});

// Utility used by games
function createGameOverOverlay(msg, isWinner, socket) {
  const overlay = document.createElement('div');
  overlay.className = 'game-over-overlay';
  overlay.innerHTML = `
    <div class="game-over-box">
      <h2 class="${isWinner ? 'winner' : 'loser'}">${msg}</h2>
      <div class="buttons">
        <button class="btn btn-primary" id="btn-rematch">Revancha</button>
        <button class="btn btn-secondary" id="btn-go-home">Volver</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#btn-rematch').addEventListener('click', () => {
    socket.emit('rematch');
    overlay.querySelector('#btn-rematch').textContent = 'Esperando...';
    overlay.querySelector('#btn-rematch').disabled = true;
  });

  overlay.querySelector('#btn-go-home').addEventListener('click', () => {
    overlay.remove();
    if (gameInstance && gameInstance.destroy) gameInstance.destroy();
    gameInstance = null;
    socket.emit('leave-room');
    currentRoomCode = null;
    showScreen('landing');
  });

  return overlay;
}
