class NavalGame {
  constructor(container, socket, playerIndex, playerNames) {
    this.container = container;
    this.socket = socket;
    this.me = playerIndex;
    this.names = playerNames;
    this.phase = 'setup'; // setup, battle
    this.turn = 0;
    this.ready = [false, false];

    this.ships = [
      { name: 'Portaaviones', size: 5, placed: false },
      { name: 'Acorazado', size: 4, placed: false },
      { name: 'Crucero', size: 3, placed: false },
      { name: 'Submarino', size: 3, placed: false },
      { name: 'Destructor', size: 2, placed: false }
    ];
    this.selectedShip = 0;
    this.horizontal = true;

    // Boards: 0=empty, 1=ship, 2=hit, 3=miss, 4=sunk
    this.myBoard = Array.from({ length: 10 }, () => Array(10).fill(0));
    this.enemyBoard = Array.from({ length: 10 }, () => Array(10).fill(0));
    this.myShipCells = [];
    this.enemyHits = 0;
    this.myHits = 0;
    this.totalShipCells = 5 + 4 + 3 + 3 + 2; // 17

    this.render();
  }

  render() {
    if (this.phase === 'setup') {
      this.renderSetup();
    } else if (this.phase === 'waiting') {
      this.renderWaiting();
    } else {
      this.renderBattle();
    }
  }

  renderSetup() {
    this.container.innerHTML = `
      <div class="naval-container" style="flex-direction:column;align-items:center;">
        <h2 style="color:var(--yellow);margin-bottom:10px;">Ubicá tus barcos</h2>
        <p style="color:var(--text2);font-size:.85em;margin-bottom:8px;">Los barcos no pueden tocarse entre sí (ni en diagonal)</p>
        <div class="naval-ships-list" id="ships-list"></div>
        <div style="margin:10px 0;">
          <button class="btn btn-secondary btn-small" id="btn-rotate">Rotar (${this.horizontal ? 'Horizontal' : 'Vertical'})</button>
          <button class="btn btn-success btn-small" id="btn-ready" disabled>¡Listo!</button>
        </div>
        <div class="naval-board-wrapper">
          <h3>Tu tablero</h3>
          <div class="naval-board" id="setup-board"></div>
        </div>
      </div>
    `;

    this.renderShipsList();
    this.renderSetupBoard();

    document.getElementById('btn-rotate').addEventListener('click', () => {
      this.horizontal = !this.horizontal;
      document.getElementById('btn-rotate').textContent = `Rotar (${this.horizontal ? 'Horizontal' : 'Vertical'})`;
    });

    document.getElementById('btn-ready').addEventListener('click', () => {
      this.ready[this.me] = true;
      this.socket.emit('game-action', { type: 'ready' });
      if (this.ready[1 - this.me]) {
        // Other player already ready
        this.phase = 'battle';
        this.render();
      } else {
        this.phase = 'waiting';
        this.render();
      }
    });
  }

  renderWaiting() {
    this.container.innerHTML = `
      <div style="text-align:center;margin-top:80px;">
        <h2 style="color:var(--yellow);">¡Listo!</h2>
        <p style="color:var(--text2);">Esperando al rival...</p>
        <div class="loader" style="margin:20px auto;"></div>
      </div>
    `;
  }

  renderShipsList() {
    const list = document.getElementById('ships-list');
    list.innerHTML = this.ships.map((s, i) => `
      <div class="ship-option ${i === this.selectedShip ? 'selected' : ''} ${s.placed ? 'placed' : ''}" data-idx="${i}">
        ${s.name} (${'■'.repeat(s.size)})
      </div>
    `).join('');

    list.querySelectorAll('.ship-option:not(.placed)').forEach(el => {
      el.addEventListener('click', () => {
        this.selectedShip = parseInt(el.dataset.idx);
        this.renderShipsList();
      });
    });
  }

  renderSetupBoard() {
    const board = document.getElementById('setup-board');
    board.innerHTML = '';
    const cols = ' ABCDEFGHIJ';

    for (let c = 0; c <= 10; c++) {
      const h = document.createElement('div');
      h.className = 'naval-header';
      h.textContent = c === 0 ? '' : cols[c];
      board.appendChild(h);
    }

    for (let r = 0; r < 10; r++) {
      const rh = document.createElement('div');
      rh.className = 'naval-header';
      rh.textContent = r + 1;
      board.appendChild(rh);

      for (let c = 0; c < 10; c++) {
        const cell = document.createElement('div');
        cell.className = 'naval-cell';
        if (this.myBoard[r][c] === 1) cell.classList.add('ship');
        cell.dataset.r = r;
        cell.dataset.c = c;

        cell.addEventListener('click', () => this.placeShip(r, c));
        cell.addEventListener('mouseenter', () => this.previewShip(r, c));
        cell.addEventListener('mouseleave', () => this.clearPreview());
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.horizontal = !this.horizontal;
          const btn = document.getElementById('btn-rotate');
          if (btn) btn.textContent = `Rotar (${this.horizontal ? 'Horizontal' : 'Vertical'})`;
          this.previewShip(r, c);
        });

        board.appendChild(cell);
      }
    }
  }

  previewShip(r, c) {
    this.clearPreview();
    const ship = this.ships[this.selectedShip];
    if (!ship || ship.placed) return;

    const cells = this.getShipCells(r, c, ship.size, this.horizontal);
    const valid = this.canPlace(cells);

    cells.forEach(([cr, cc]) => {
      if (cr >= 0 && cr < 10 && cc >= 0 && cc < 10) {
        const cell = document.querySelector(`#setup-board .naval-cell[data-r="${cr}"][data-c="${cc}"]`);
        if (cell) cell.classList.add(valid ? 'preview' : 'preview-invalid');
      }
    });
  }

  clearPreview() {
    document.querySelectorAll('.preview, .preview-invalid').forEach(c => {
      c.classList.remove('preview', 'preview-invalid');
    });
  }

  getShipCells(r, c, size, horiz) {
    const cells = [];
    for (let i = 0; i < size; i++) {
      cells.push(horiz ? [r, c + i] : [r + i, c]);
    }
    return cells;
  }

  // Check adjacency: no ship can touch another (including diagonals)
  hasAdjacentShip(cells) {
    for (const [r, c] of cells) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) {
            if (this.myBoard[nr][nc] === 1) {
              // Check it's not one of the cells we're placing
              const isSelf = cells.some(([cr, cc]) => cr === nr && cc === nc);
              if (!isSelf) return true;
            }
          }
        }
      }
    }
    return false;
  }

  canPlace(cells) {
    const inBounds = cells.every(([r, c]) => r >= 0 && r < 10 && c >= 0 && c < 10 && this.myBoard[r][c] === 0);
    if (!inBounds) return false;
    return !this.hasAdjacentShip(cells);
  }

  placeShip(r, c) {
    const ship = this.ships[this.selectedShip];
    if (!ship || ship.placed) return;

    const cells = this.getShipCells(r, c, ship.size, this.horizontal);
    if (!this.canPlace(cells)) return;

    cells.forEach(([cr, cc]) => this.myBoard[cr][cc] = 1);
    ship.placed = true;
    this.myShipCells.push({ cells, size: ship.size, sunk: false });

    const next = this.ships.findIndex(s => !s.placed);
    if (next >= 0) this.selectedShip = next;

    this.renderShipsList();
    this.renderSetupBoard();

    if (this.ships.every(s => s.placed)) {
      document.getElementById('btn-ready').disabled = false;
    }
  }

  renderBattle() {
    this.container.innerHTML = `
      <div style="text-align:center;margin-bottom:10px;">
        <div class="turn-indicator ${this.turn === this.me ? 'your-turn' : 'wait'}" id="naval-turn">
          ${this.turn === this.me ? '¡Tu turno! Elegí dónde disparar' : 'Esperá tu turno...'}
        </div>
      </div>
      <div class="naval-container">
        <div class="naval-board-wrapper">
          <h3>Tablero rival</h3>
          <div class="naval-board" id="enemy-board"></div>
        </div>
        <div class="naval-board-wrapper">
          <h3>Tu tablero</h3>
          <div class="naval-board" id="my-board"></div>
        </div>
      </div>
    `;

    this.renderBattleBoard('enemy-board', this.enemyBoard, true);
    this.renderBattleBoard('my-board', this.myBoard, false);
  }

  renderBattleBoard(boardId, boardData, isEnemy) {
    const board = document.getElementById(boardId);
    board.innerHTML = '';
    const cols = ' ABCDEFGHIJ';

    for (let c = 0; c <= 10; c++) {
      const h = document.createElement('div');
      h.className = 'naval-header';
      h.textContent = c === 0 ? '' : cols[c];
      board.appendChild(h);
    }

    for (let r = 0; r < 10; r++) {
      const rh = document.createElement('div');
      rh.className = 'naval-header';
      rh.textContent = r + 1;
      board.appendChild(rh);

      for (let c = 0; c < 10; c++) {
        const cell = document.createElement('div');
        cell.className = 'naval-cell';
        const val = boardData[r][c];

        if (!isEnemy && val === 1) cell.classList.add('ship');
        if (val === 2) { cell.classList.add('hit'); cell.textContent = '🔥'; }
        if (val === 3) { cell.classList.add('miss'); cell.textContent = '•'; }
        if (val === 4) { cell.classList.add('sunk'); cell.textContent = '💀'; }

        if (isEnemy && val === 0 && this.turn === this.me) {
          cell.addEventListener('click', () => this.shoot(r, c));
        }

        board.appendChild(cell);
      }
    }
  }

  shoot(r, c) {
    if (this.turn !== this.me) return;
    if (this.enemyBoard[r][c] !== 0) return;

    this.socket.emit('game-action', { type: 'shoot', r, c });
    this.turn = -1; // wait for result
    this.updateTurnUI();
  }

  updateTurnUI() {
    const el = document.getElementById('naval-turn');
    if (el) {
      el.textContent = this.turn === this.me ? '¡Tu turno! Elegí dónde disparar' : 'Esperá tu turno...';
      el.className = `turn-indicator ${this.turn === this.me ? 'your-turn' : 'wait'}`;
    }
  }

  onAction(data) {
    if (data.type === 'ready') {
      this.ready[data.playerIndex] = true;
      // If I'm already ready and opponent just got ready, start battle
      if (this.ready[this.me] && this.ready[1 - this.me]) {
        this.phase = 'battle';
        this.render();
      }
    } else if (data.type === 'shoot') {
      // Enemy is shooting at my board
      const { r, c } = data;
      const hit = this.myBoard[r][c] === 1;
      this.myBoard[r][c] = hit ? 2 : 3;

      let sunkShip = null;
      if (hit) {
        this.enemyHits++;
        for (const ship of this.myShipCells) {
          if (!ship.sunk && ship.cells.some(([sr, sc]) => sr === r && sc === c)) {
            if (ship.cells.every(([sr, sc]) => this.myBoard[sr][sc] === 2)) {
              ship.sunk = true;
              ship.cells.forEach(([sr, sc]) => this.myBoard[sr][sc] = 4);
              sunkShip = ship.size;
            }
          }
        }
      }

      const gameOver = this.enemyHits >= this.totalShipCells;
      this.turn = gameOver ? -1 : (hit ? data.playerIndex : this.me);

      this.socket.emit('game-action', {
        type: 'shoot-result', r, c, hit, sunkShip, gameOver
      });

      this.render();

      if (gameOver) {
        setTimeout(() => this.gameOver(data.playerIndex), 500);
      }
    } else if (data.type === 'shoot-result') {
      const { r, c, hit, sunkShip, gameOver } = data;
      if (sunkShip) {
        this.markSunk(r, c);
      } else {
        this.enemyBoard[r][c] = hit ? 2 : 3;
      }
      if (hit) this.myHits++;

      this.turn = gameOver ? -1 : (hit ? this.me : 1 - this.me);
      this.render();

      if (gameOver) {
        setTimeout(() => this.gameOver(this.me), 500);
      }
    }
  }

  markSunk(r, c) {
    const visited = new Set();
    const queue = [[r, c]];
    this.enemyBoard[r][c] = 4;
    visited.add(`${r},${c}`);

    while (queue.length) {
      const [cr, cc] = queue.shift();
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const nr = cr + dr, nc = cc + dc;
        const key = `${nr},${nc}`;
        if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && !visited.has(key) && this.enemyBoard[nr][nc] === 2) {
          visited.add(key);
          this.enemyBoard[nr][nc] = 4;
          queue.push([nr, nc]);
        }
      }
    }
  }

  gameOver(winnerIndex) {
    const isWinner = winnerIndex === this.me;
    const msg = isWinner ? '🎉 ¡Hundiste toda la flota!' : '😢 Tu flota fue hundida';
    this.overlay = createGameOverOverlay(msg, isWinner, this.socket);
  }

  onRematchRequest() {
    if (this.overlay) {
      const btn = this.overlay.querySelector('#btn-rematch');
      btn.textContent = 'Aceptar revancha';
      btn.disabled = false;
      btn.onclick = () => this.socket.emit('rematch-accept');
    }
  }

  onRematchStart() {
    if (this.overlay) this.overlay.remove();
    this.phase = 'setup';
    this.turn = 0;
    this.ready = [false, false];
    this.ships.forEach(s => s.placed = false);
    this.selectedShip = 0;
    this.horizontal = true;
    this.myBoard = Array.from({ length: 10 }, () => Array(10).fill(0));
    this.enemyBoard = Array.from({ length: 10 }, () => Array(10).fill(0));
    this.myShipCells = [];
    this.enemyHits = 0;
    this.myHits = 0;
    this.render();
  }

  destroy() {
    if (this.overlay) this.overlay.remove();
  }
}
