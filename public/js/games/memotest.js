class MemotestGame {
  constructor(container, playerName) {
    this.container = container;
    this.playerName = playerName;
    this.difficulty = null; // chosen by player
    this.cards = [];
    this.flipped = [];
    this.matched = new Set();
    this.attempts = 0;
    this.locked = false;
    this.timer = 0;
    this.timerInterval = null;
    this.started = false;

    this.allEmojis = [
      '🐶','🐱','🐸','🦊','🐻','🐼','🐨','🐯','🦁','🐮',
      '🐷','🐵','🐔','🐧','🐦','🦄','🐝','🐢','🐙','🦋',
      '🌸','🌻','🍎','🍕','⚽','🎸','🚀','🌈','⭐','🎂'
    ];

    this.renderDifficultySelect();
  }

  renderDifficultySelect() {
    this.container.innerHTML = `
      <div style="text-align:center;margin-top:40px;">
        <h2 style="color:var(--yellow);margin-bottom:20px;">🧠 Memotest</h2>
        <p style="color:var(--text2);margin-bottom:25px;">Elegí la dificultad:</p>
        <div style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary memo-diff-btn" data-pairs="6" data-cols="4">
            Fácil<br><span style="font-size:.8em;opacity:.8">12 cartas</span>
          </button>
          <button class="btn btn-secondary memo-diff-btn" data-pairs="10" data-cols="5">
            Normal<br><span style="font-size:.8em;opacity:.8">20 cartas</span>
          </button>
          <button class="btn btn-danger memo-diff-btn" data-pairs="15" data-cols="6">
            Difícil<br><span style="font-size:.8em;opacity:.8">30 cartas</span>
          </button>
        </div>
      </div>
    `;

    this.container.querySelectorAll('.memo-diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pairs = parseInt(btn.dataset.pairs);
        const cols = parseInt(btn.dataset.cols);
        this.startGame(pairs, cols);
      });
    });
  }

  startGame(pairs, cols) {
    this.pairs = pairs;
    this.cols = cols;
    this.attempts = 0;
    this.matched = new Set();
    this.flipped = [];
    this.locked = false;
    this.timer = 0;
    this.started = false;

    // Pick random emojis and create pairs
    const shuffledEmojis = [...this.allEmojis].sort(() => Math.random() - 0.5);
    const chosen = shuffledEmojis.slice(0, pairs);
    this.cards = [...chosen, ...chosen].sort(() => Math.random() - 0.5);

    this.render();
  }

  render() {
    const rows = Math.ceil(this.cards.length / this.cols);

    this.container.innerHTML = `
      <div class="memo-container">
        <div class="memo-stats">
          <span>⏱️ <span id="memo-timer">0:00</span></span>
          <span>🎯 Intentos: <span id="memo-attempts">${this.attempts}</span></span>
          <span>✅ Pares: <span id="memo-found">${this.matched.size / 2}</span>/${this.pairs}</span>
        </div>
        <div class="memo-grid" id="memo-grid" style="grid-template-columns: repeat(${this.cols}, 1fr);">
          ${this.cards.map((emoji, i) => {
            const isMatched = this.matched.has(i);
            const isFlipped = this.flipped.includes(i);
            return `
              <div class="memo-card ${isFlipped ? 'flipped' : ''} ${isMatched ? 'matched' : ''}" data-idx="${i}">
                <div class="memo-card-inner">
                  <div class="memo-card-front">?</div>
                  <div class="memo-card-back">${emoji}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <button class="btn btn-secondary" id="btn-memo-restart" style="margin-top:15px;">🔄 Reiniciar</button>
      </div>
    `;

    // Card click handlers
    this.container.querySelectorAll('.memo-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx);
        this.flipCard(idx);
      });
    });

    document.getElementById('btn-memo-restart').addEventListener('click', () => {
      this.stopTimer();
      this.renderDifficultySelect();
    });
  }

  startTimer() {
    if (this.timerInterval) return;
    this.started = true;
    this.timerInterval = setInterval(() => {
      this.timer++;
      const el = document.getElementById('memo-timer');
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

  flipCard(idx) {
    if (this.locked) return;
    if (this.flipped.includes(idx)) return;
    if (this.matched.has(idx)) return;

    if (!this.started) this.startTimer();

    // Flip the card
    this.flipped.push(idx);
    const card = this.container.querySelector(`.memo-card[data-idx="${idx}"]`);
    if (card) card.classList.add('flipped');

    if (this.flipped.length === 2) {
      this.attempts++;
      const attEl = document.getElementById('memo-attempts');
      if (attEl) attEl.textContent = this.attempts;

      const [a, b] = this.flipped;

      if (this.cards[a] === this.cards[b]) {
        // Match!
        this.matched.add(a);
        this.matched.add(b);
        this.flipped = [];

        const foundEl = document.getElementById('memo-found');
        if (foundEl) foundEl.textContent = this.matched.size / 2;

        // Animate match
        setTimeout(() => {
          const cardA = this.container.querySelector(`.memo-card[data-idx="${a}"]`);
          const cardB = this.container.querySelector(`.memo-card[data-idx="${b}"]`);
          if (cardA) cardA.classList.add('matched');
          if (cardB) cardB.classList.add('matched');
        }, 300);

        // Check win
        if (this.matched.size === this.cards.length) {
          this.stopTimer();
          setTimeout(() => this.showWin(), 500);
        }
      } else {
        // No match - flip back
        this.locked = true;
        setTimeout(() => {
          const cardA = this.container.querySelector(`.memo-card[data-idx="${a}"]`);
          const cardB = this.container.querySelector(`.memo-card[data-idx="${b}"]`);
          if (cardA) cardA.classList.remove('flipped');
          if (cardB) cardB.classList.remove('flipped');
          this.flipped = [];
          this.locked = false;
        }, 800);
      }
    }
  }

  showWin() {
    const min = Math.floor(this.timer / 60);
    const sec = this.timer % 60;
    const time = `${min}:${sec.toString().padStart(2, '0')}`;

    let stars = '⭐⭐⭐';
    if (this.attempts > this.pairs * 2) stars = '⭐⭐';
    if (this.attempts > this.pairs * 3) stars = '⭐';

    this.overlay = document.createElement('div');
    this.overlay.className = 'game-over-overlay';
    this.overlay.innerHTML = `
      <div class="game-over-box">
        <h2 class="winner">🎉 ¡Felicitaciones, ${this.playerName}!</h2>
        <p style="font-size:2em;margin:10px 0;">${stars}</p>
        <p style="color:var(--text2);">Encontraste todos los pares en <b style="color:var(--yellow)">${this.attempts}</b> intentos</p>
        <p style="color:var(--text2);">Tiempo: <b style="color:var(--yellow)">${time}</b></p>
        <div class="buttons" style="margin-top:20px;">
          <button class="btn btn-primary" id="btn-memo-again">Jugar de nuevo</button>
          <button class="btn btn-secondary" id="btn-memo-home">Volver</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.overlay.querySelector('#btn-memo-again').addEventListener('click', () => {
      this.overlay.remove();
      this.renderDifficultySelect();
    });

    this.overlay.querySelector('#btn-memo-home').addEventListener('click', () => {
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
