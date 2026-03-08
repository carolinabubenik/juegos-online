class SerpientesGame {
  constructor(container, socket, playerIndex, playerNames) {
    this.container = container;
    this.socket = socket;
    this.me = playerIndex;
    this.names = playerNames;
    this.positions = [0, 0]; // 0 = not on board yet, 1-100
    this.turn = 0;
    this.rolling = false;
    this.animating = false;

    // Snakes (head -> tail) and Ladders (bottom -> top)
    this.snakes = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
    this.ladders = { 2: 38, 7: 14, 8: 31, 15: 26, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98 };

    this.render();
  }

  posToGrid(pos) {
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
            <p><span style="color:var(--accent)">●</span> ${this.names[0]}: casilla <span id="syt-pos0">${this.positions[0]}</span></p>
            <p><span style="color:var(--blue)">●</span> ${this.names[1]}: casilla <span id="syt-pos1">${this.positions[1]}</span></p>
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
        cell.id = `syt-cell-${pos}`;

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
            marker.id = `marker-p${p}`;
            cell.appendChild(marker);
          }
        }

        board.appendChild(cell);
      }
    }
  }

  // Animate movement step by step
  async animateMove(playerIdx, fromPos, toPos, specialDest) {
    this.animating = true;
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    // Step-by-step normal movement
    const direction = toPos > fromPos ? 1 : -1;
    let current = fromPos;

    while (current !== toPos) {
      current += direction;
      this.positions[playerIdx] = current;
      this.renderBoard();
      this.updateUI();

      // Highlight current cell
      const cell = document.getElementById(`syt-cell-${current}`);
      if (cell) {
        cell.style.boxShadow = playerIdx === 0 ? '0 0 12px var(--accent)' : '0 0 12px var(--blue)';
        cell.style.transform = 'scale(1.15)';
        cell.style.zIndex = '5';
      }

      await delay(150);

      if (cell) {
        cell.style.boxShadow = '';
        cell.style.transform = '';
        cell.style.zIndex = '';
      }
    }

    // Snake or ladder animation
    if (specialDest !== undefined && specialDest !== toPos) {
      await delay(300);

      const isSnake = this.snakes[toPos] !== undefined;
      // Flash the cell
      const startCell = document.getElementById(`syt-cell-${toPos}`);
      if (startCell) {
        startCell.style.transform = 'scale(1.3)';
        startCell.style.boxShadow = isSnake ? '0 0 20px #ef4444' : '0 0 20px #4ade80';
      }
      await delay(400);
      if (startCell) {
        startCell.style.transform = '';
        startCell.style.boxShadow = '';
      }

      // Slide to destination
      const steps = Math.abs(specialDest - toPos);
      const slideSteps = Math.min(steps, 8); // max 8 animation frames for long slides
      const increment = (specialDest - toPos) / slideSteps;

      for (let i = 1; i <= slideSteps; i++) {
        const intermediatePos = Math.round(toPos + increment * i);
        this.positions[playerIdx] = Math.max(1, Math.min(100, intermediatePos));
        this.renderBoard();
        this.updateUI();
        await delay(100);
      }

      // Ensure final position is exact
      this.positions[playerIdx] = specialDest;
      this.renderBoard();
      this.updateUI();

      // Flash destination
      const destCell = document.getElementById(`syt-cell-${specialDest}`);
      if (destCell) {
        destCell.style.transform = 'scale(1.2)';
        destCell.style.boxShadow = isSnake ? '0 0 15px #ef4444' : '0 0 15px #4ade80';
        await delay(300);
        destCell.style.transform = '';
        destCell.style.boxShadow = '';
      }
    }

    this.animating = false;
  }

  async rollDice() {
    if (this.turn !== this.me || this.rolling || this.animating) return;
    this.rolling = true;

    const roll = Math.floor(Math.random() * 6) + 1;
    const diceEl = document.getElementById('syt-dice');
    const diceChars = ['⚀','⚁','⚂','⚃','⚄','⚅'];

    // Dice animation
    diceEl.classList.add('rolling');
    document.getElementById('syt-roll').disabled = true;

    await new Promise(r => setTimeout(r, 600));
    diceEl.classList.remove('rolling');
    diceEl.textContent = diceChars[roll - 1];

    const oldPos = this.positions[this.me];
    let moveToPos = oldPos + roll;
    let log = `${this.names[this.me]} sacó ${roll}`;
    let finalPos = moveToPos;
    let specialDest = undefined;

    if (moveToPos > 100) {
      log += ' (necesitás exacto para 100)';
      finalPos = oldPos;
      this.rolling = false;
      this.turn = 1 - this.turn;
      this.addLog(log);
      this.socket.emit('game-action', { type: 'move', roll, moveToPos: oldPos, finalPos: oldPos });
      this.updateUI();
      return;
    }

    if (this.snakes[moveToPos]) {
      specialDest = this.snakes[moveToPos];
      log += ` → casilla ${moveToPos} 🐍 baja a ${specialDest}`;
      finalPos = specialDest;
    } else if (this.ladders[moveToPos]) {
      specialDest = this.ladders[moveToPos];
      log += ` → casilla ${moveToPos} 🪜 sube a ${specialDest}`;
      finalPos = specialDest;
    }

    this.addLog(log);

    // Animate step by step
    await this.animateMove(this.me, oldPos, moveToPos, specialDest);

    this.positions[this.me] = finalPos;
    this.renderBoard();
    this.updateUI();

    // Check win
    if (finalPos === 100) {
      this.socket.emit('game-action', { type: 'move', roll, moveToPos, finalPos, specialDest, winner: true });
      this.gameOver(this.me);
      return;
    }

    this.turn = 1 - this.turn;
    this.socket.emit('game-action', { type: 'move', roll, moveToPos, finalPos, specialDest });
    this.updateUI();
    this.rolling = false;
  }

  updateUI() {
    const p0 = document.getElementById('syt-pos0');
    const p1 = document.getElementById('syt-pos1');
    if (p0) p0.textContent = this.positions[0];
    if (p1) p1.textContent = this.positions[1];
    const turnEl = document.getElementById('syt-turn');
    if (turnEl) {
      turnEl.textContent = this.turn === this.me ? '¡Tu turno!' : 'Esperá...';
      turnEl.className = `turn-indicator ${this.turn === this.me ? 'your-turn' : 'wait'}`;
    }
    const rollBtn = document.getElementById('syt-roll');
    if (rollBtn) rollBtn.disabled = this.turn !== this.me || this.animating;
  }

  addLog(msg) {
    const log = document.getElementById('syt-log');
    if (log) {
      log.innerHTML = `<div>${msg}</div>` + log.innerHTML;
    }
  }

  async onAction(data) {
    if (data.type === 'move') {
      const pi = data.playerIndex;
      const diceChars = ['⚀','⚁','⚂','⚃','⚄','⚅'];
      document.getElementById('syt-dice').textContent = diceChars[data.roll - 1];

      const oldPos = this.positions[pi];
      let log = `${this.names[pi]} sacó ${data.roll}`;

      if (data.finalPos === oldPos) {
        // Couldn't move (over 100)
        log += ' (necesita exacto para 100)';
        this.addLog(log);
        this.turn = 1 - pi;
        this.updateUI();
        return;
      }

      if (data.specialDest !== undefined) {
        const isSnake = this.snakes[data.moveToPos] !== undefined;
        log += ` → casilla ${data.moveToPos} ${isSnake ? '🐍 baja' : '🪜 sube'} a ${data.specialDest}`;
      } else {
        log += ` → casilla ${data.finalPos}`;
      }
      this.addLog(log);

      // Animate the opponent's move too
      await this.animateMove(pi, oldPos, data.moveToPos, data.specialDest);

      this.positions[pi] = data.finalPos;
      this.renderBoard();
      this.updateUI();

      if (data.winner) {
        this.gameOver(pi);
        return;
      }

      this.turn = 1 - pi;
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
    this.animating = false;
    this.render();
  }

  destroy() {
    if (this.overlay) this.overlay.remove();
  }
}
