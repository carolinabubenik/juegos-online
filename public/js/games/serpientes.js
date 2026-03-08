class SerpientesGame {
  constructor(container, socket, playerIndex, playerNames) {
    this.container = container;
    this.socket = socket;
    this.me = playerIndex;
    this.names = playerNames;
    this.positions = [0, 0]; // 0 = not on board yet, 1-100
    this.turn = 0;
    this.rolling = false;

    // Snakes (head -> tail) and Ladders (bottom -> top)
    this.snakes = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
    this.ladders = { 2: 38, 7: 14, 8: 31, 15: 26, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98 };

    this.render();
  }

  posToGrid(pos) {
    // Convert position 1-100 to row,col (board is 10x10, bottom-left = 1)
    const p = pos - 1;
    const row = 9 - Math.floor(p / 10);
    const rowFromBottom = Math.floor(p / 10);
    const col = rowFromBottom % 2 === 0 ? p % 10 : 9 - (p % 10);
    return { row, col };
  }

  render() {
    this.container.innerHTML = `
      <div class="syt-container">
        <div class="syt-board" id="syt-board"></div>
        <div class="syt-panel">
          <div class="turn-indicator ${this.turn === this.me ? 'your-turn' : 'wait'}" id="syt-turn">
            ${this.turn === this.me ? '¡Tu turno!' : 'Esperá...'}
          </div>
          <div class="syt-dice" id="syt-dice">🎲</div>
          <button class="btn btn-primary" id="syt-roll" ${this.turn !== this.me ? 'disabled' : ''}>Tirar dado</button>
          <div style="margin-top:20px;">
            <p><span style="color:var(--accent)">●</span> ${this.names[0]}: casilla <span id="syt-pos0">0</span></p>
            <p><span style="color:var(--blue)">●</span> ${this.names[1]}: casilla <span id="syt-pos1">0</span></p>
          </div>
          <div id="syt-log" style="margin-top:15px;color:var(--text2);font-size:.85em;max-height:150px;overflow-y:auto;"></div>
        </div>
      </div>
    `;

    this.renderBoard();

    document.getElementById('syt-roll').addEventListener('click', () => this.rollDice());
  }

  renderBoard() {
    const board = document.getElementById('syt-board');
    board.innerHTML = '';

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const rowFromBottom = 9 - row;
        const pos = rowFromBottom % 2 === 0
          ? rowFromBottom * 10 + col + 1
          : rowFromBottom * 10 + (9 - col) + 1;

        const cell = document.createElement('div');
        cell.className = 'syt-cell';
        cell.dataset.pos = pos;

        if (this.snakes[pos]) cell.classList.add('snake-start');
        if (Object.values(this.snakes).includes(pos)) cell.classList.add('snake-end');
        if (this.ladders[pos]) cell.classList.add('ladder-start');
        if (Object.values(this.ladders).includes(pos)) cell.classList.add('ladder-end');

        let label = pos;
        if (this.snakes[pos]) label = `${pos}🐍`;
        if (this.ladders[pos]) label = `${pos}🪜`;

        cell.innerHTML = `<span>${label}</span>`;

        // Player markers
        for (let p = 0; p < 2; p++) {
          if (this.positions[p] === pos) {
            const marker = document.createElement('div');
            marker.className = `player-marker p${p}`;
            cell.appendChild(marker);
          }
        }

        board.appendChild(cell);
      }
    }
  }

  async rollDice() {
    if (this.turn !== this.me || this.rolling) return;
    this.rolling = true;

    const roll = Math.floor(Math.random() * 6) + 1;
    const diceEl = document.getElementById('syt-dice');
    const diceChars = ['⚀','⚁','⚂','⚃','⚄','⚅'];

    // Animation
    diceEl.classList.add('rolling');
    document.getElementById('syt-roll').disabled = true;

    await new Promise(r => setTimeout(r, 600));
    diceEl.classList.remove('rolling');
    diceEl.textContent = diceChars[roll - 1];

    // Move
    let newPos = this.positions[this.me] + roll;
    let log = `${this.names[this.me]} sacó ${roll}`;

    if (newPos > 100) {
      log += ' (necesitás exacto para 100)';
      newPos = this.positions[this.me];
    } else {
      if (this.snakes[newPos]) {
        log += ` → casilla ${newPos} 🐍 baja a ${this.snakes[newPos]}`;
        newPos = this.snakes[newPos];
      } else if (this.ladders[newPos]) {
        log += ` → casilla ${newPos} 🪜 sube a ${this.ladders[newPos]}`;
        newPos = this.ladders[newPos];
      }
    }

    this.positions[this.me] = newPos;
    this.addLog(log);

    // Check win
    if (newPos === 100) {
      this.socket.emit('game-action', { type: 'move', roll, newPos, winner: true });
      this.renderBoard();
      this.updateUI();
      this.gameOver(this.me);
      return;
    }

    this.turn = 1 - this.turn;
    this.socket.emit('game-action', { type: 'move', roll, newPos });
    this.renderBoard();
    this.updateUI();
    this.rolling = false;
  }

  updateUI() {
    document.getElementById('syt-pos0').textContent = this.positions[0];
    document.getElementById('syt-pos1').textContent = this.positions[1];
    const turnEl = document.getElementById('syt-turn');
    if (turnEl) {
      turnEl.textContent = this.turn === this.me ? '¡Tu turno!' : 'Esperá...';
      turnEl.className = `turn-indicator ${this.turn === this.me ? 'your-turn' : 'wait'}`;
    }
    const rollBtn = document.getElementById('syt-roll');
    if (rollBtn) rollBtn.disabled = this.turn !== this.me;
  }

  addLog(msg) {
    const log = document.getElementById('syt-log');
    if (log) {
      log.innerHTML = `<div>${msg}</div>` + log.innerHTML;
    }
  }

  onAction(data) {
    if (data.type === 'move') {
      const pi = data.playerIndex;
      const diceChars = ['⚀','⚁','⚂','⚃','⚄','⚅'];
      document.getElementById('syt-dice').textContent = diceChars[data.roll - 1];

      this.positions[pi] = data.newPos;
      let log = `${this.names[pi]} sacó ${data.roll} → casilla ${data.newPos}`;
      this.addLog(log);

      if (data.winner) {
        this.renderBoard();
        this.updateUI();
        this.gameOver(pi);
        return;
      }

      this.turn = 1 - pi;
      this.renderBoard();
      this.updateUI();
    }
  }

  gameOver(winnerIndex) {
    const isWinner = winnerIndex === this.me;
    const msg = isWinner ? '🎉 ¡Ganaste!' : `😢 Ganó ${this.names[winnerIndex]}`;
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
    this.positions = [0, 0];
    this.turn = 0;
    this.rolling = false;
    this.render();
  }

  destroy() {
    if (this.overlay) this.overlay.remove();
  }
}
