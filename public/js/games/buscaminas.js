class BuscaminasGame {
  constructor(container, playerName) {
    this.container = container;
    this.playerName = playerName;
    this.renderDifficultySelect();
  }

  renderDifficultySelect() {
    this.container.innerHTML = `
      <div style="text-align:center;margin-top:40px;">
        <h2 style="color:var(--yellow);margin-bottom:20px;">💣 Buscaminas</h2>
        <p style="color:var(--text2);margin-bottom:25px;">Elegí la dificultad:</p>
        <div style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary bm-diff" data-rows="8" data-cols="8" data-mines="10">
            Fácil<br><span style="font-size:.8em;opacity:.8">8×8 · 10 minas</span>
          </button>
          <button class="btn btn-secondary bm-diff" data-rows="10" data-cols="10" data-mines="20">
            Normal<br><span style="font-size:.8em;opacity:.8">10×10 · 20 minas</span>
          </button>
          <button class="btn btn-danger bm-diff" data-rows="12" data-cols="12" data-mines="35">
            Difícil<br><span style="font-size:.8em;opacity:.8">12×12 · 35 minas</span>
          </button>
        </div>
      </div>
    `;

    this.container.querySelectorAll('.bm-diff').forEach(btn => {
      btn.addEventListener('click', () => {
        this.startGame(
          parseInt(btn.dataset.rows),
          parseInt(btn.dataset.cols),
          parseInt(btn.dataset.mines)
        );
      });
    });
  }

  startGame(rows, cols, mineCount) {
    this.rows = rows;
    this.cols = cols;
    this.mineCount = mineCount;
    this.flagMode = false;
    this.gameOver = false;
    this.firstClick = true;
    this.timer = 0;
    this.timerInterval = null;
    this.flagsPlaced = 0;

    // Initialize empty board (mines placed on first click)
    this.board = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        mine: false,
        revealed: false,
        flagged: false,
        count: 0
      }))
    );

    this.render();
  }

  placeMines(safeR, safeC) {
    // Place mines avoiding the first clicked cell and its neighbors
    const safe = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        safe.add(`${safeR + dr},${safeC + dc}`);
      }
    }

    let placed = 0;
    while (placed < this.mineCount) {
      const r = Math.floor(Math.random() * this.rows);
      const c = Math.floor(Math.random() * this.cols);
      if (!this.board[r][c].mine && !safe.has(`${r},${c}`)) {
        this.board[r][c].mine = true;
        placed++;
      }
    }

    // Calculate neighbor counts
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c].mine) continue;
        let count = 0;
        this.forNeighbors(r, c, (nr, nc) => {
          if (this.board[nr][nc].mine) count++;
        });
        this.board[r][c].count = count;
      }
    }
  }

  forNeighbors(r, c, fn) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          fn(nr, nc);
        }
      }
    }
  }

  startTimer() {
    if (this.timerInterval) return;
    this.timerInterval = setInterval(() => {
      this.timer++;
      const el = document.getElementById('bm-timer');
      if (el) {
        const min = Math.floor(this.timer / 60);
        const sec = this.timer % 60;
        el.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="bm-container">
        <div class="bm-stats">
          <span>⏱️ <span id="bm-timer">0:00</span></span>
          <span>💣 <span id="bm-mines-left">${this.mineCount - this.flagsPlaced}</span></span>
          <button class="btn btn-small ${this.flagMode ? 'btn-danger' : 'btn-secondary'}" id="btn-flag-mode">
            ${this.flagMode ? '🚩 Modo bandera ON' : '👆 Modo descubrir'}
          </button>
        </div>
        <div class="bm-grid" id="bm-grid" style="grid-template-columns: repeat(${this.cols}, 1fr);"></div>
        <button class="btn btn-secondary" id="btn-bm-restart" style="margin-top:15px;">🔄 Reiniciar</button>
      </div>
    `;

    this.renderBoard();

    document.getElementById('btn-flag-mode').addEventListener('click', () => {
      this.flagMode = !this.flagMode;
      const btn = document.getElementById('btn-flag-mode');
      btn.textContent = this.flagMode ? '🚩 Modo bandera ON' : '👆 Modo descubrir';
      btn.className = `btn btn-small ${this.flagMode ? 'btn-danger' : 'btn-secondary'}`;
    });

    document.getElementById('btn-bm-restart').addEventListener('click', () => {
      this.stopTimer();
      this.renderDifficultySelect();
    });
  }

  renderBoard() {
    const grid = document.getElementById('bm-grid');
    grid.innerHTML = '';

    const numColors = ['', '#60a5fa', '#4ade80', '#ef4444', '#a855f7', '#f59e0b', '#06b6d4', '#fff', '#888'];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        const el = document.createElement('div');
        el.className = 'bm-cell';

        if (cell.revealed) {
          el.classList.add('revealed');
          if (cell.mine) {
            el.textContent = '💥';
            el.classList.add('mine-hit');
          } else if (cell.count > 0) {
            el.textContent = cell.count;
            el.style.color = numColors[cell.count];
          }
        } else if (cell.flagged) {
          el.textContent = '🚩';
          el.classList.add('flagged');
        }

        el.addEventListener('click', () => this.handleClick(r, c));
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.toggleFlag(r, c);
        });

        grid.appendChild(el);
      }
    }
  }

  handleClick(r, c) {
    if (this.gameOver) return;
    const cell = this.board[r][c];
    if (cell.revealed) return;

    if (this.flagMode) {
      this.toggleFlag(r, c);
      return;
    }

    if (cell.flagged) return;

    if (this.firstClick) {
      this.firstClick = false;
      this.placeMines(r, c);
      this.startTimer();
    }

    if (cell.mine) {
      // Game over - reveal all mines
      this.revealAllMines();
      cell.revealed = true;
      this.gameOver = true;
      this.stopTimer();
      this.renderBoard();
      setTimeout(() => this.showResult(false), 500);
      return;
    }

    this.reveal(r, c);
    this.renderBoard();

    if (this.checkWin()) {
      this.gameOver = true;
      this.stopTimer();
      setTimeout(() => this.showResult(true), 300);
    }
  }

  reveal(r, c) {
    const cell = this.board[r][c];
    if (cell.revealed || cell.flagged || cell.mine) return;

    cell.revealed = true;

    // Flood fill for empty cells
    if (cell.count === 0) {
      this.forNeighbors(r, c, (nr, nc) => {
        this.reveal(nr, nc);
      });
    }
  }

  toggleFlag(r, c) {
    if (this.gameOver) return;
    const cell = this.board[r][c];
    if (cell.revealed) return;

    cell.flagged = !cell.flagged;
    this.flagsPlaced += cell.flagged ? 1 : -1;

    const minesLeft = document.getElementById('bm-mines-left');
    if (minesLeft) minesLeft.textContent = this.mineCount - this.flagsPlaced;

    this.renderBoard();
  }

  revealAllMines() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c].mine) {
          this.board[r][c].revealed = true;
        }
      }
    }
  }

  checkWin() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        if (!cell.mine && !cell.revealed) return false;
      }
    }
    return true;
  }

  showResult(won) {
    const min = Math.floor(this.timer / 60);
    const sec = this.timer % 60;
    const time = `${min}:${sec.toString().padStart(2, '0')}`;

    this.overlay = document.createElement('div');
    this.overlay.className = 'game-over-overlay';
    this.overlay.innerHTML = `
      <div class="game-over-box">
        <h2 class="${won ? 'winner' : 'loser'}">
          ${won ? '🎉 ¡Ganaste!' : '💥 ¡Boom! Pisaste una mina'}
        </h2>
        ${won ? `<p style="color:var(--text2);">Tiempo: <b style="color:var(--yellow)">${time}</b></p>` : ''}
        <div class="buttons" style="margin-top:20px;">
          <button class="btn btn-primary" id="btn-bm-again">Jugar de nuevo</button>
          <button class="btn btn-secondary" id="btn-bm-home">Volver</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.overlay.querySelector('#btn-bm-again').addEventListener('click', () => {
      this.overlay.remove();
      this.renderDifficultySelect();
    });

    this.overlay.querySelector('#btn-bm-home').addEventListener('click', () => {
      this.overlay.remove();
      gameInstance = null;
      showScreen('landing');
    });
  }

  destroy() {
    this.stopTimer();
    if (this.overlay) this.overlay.remove();
  }
}
