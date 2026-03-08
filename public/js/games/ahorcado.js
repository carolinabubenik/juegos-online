class AhorcadoGame {
  constructor(container, socket, playerIndex, playerNames) {
    this.container = container;
    this.socket = socket;
    this.me = playerIndex;
    this.names = playerNames;
    this.phase = 'choose'; // choose, guess
    this.chooser = 0; // player who picks word
    this.word = '';
    this.guessed = [];
    this.errors = 0;
    this.maxErrors = 6;

    this.render();
  }

  render() {
    if (this.phase === 'choose') {
      this.renderChoosePhase();
    } else {
      this.renderGuessPhase();
    }
  }

  renderChoosePhase() {
    const isChooser = this.chooser === this.me;
    this.container.innerHTML = `
      <div class="ahorcado-container" style="justify-content:center;">
        <div class="ahorcado-panel">
          <h2 style="color:var(--yellow);margin-bottom:20px;">
            ${isChooser ? '¡Elegí una palabra!' : `${this.names[this.chooser]} está eligiendo una palabra...`}
          </h2>
          ${isChooser ? `
            <div class="ahorcado-input-section">
              <input type="text" id="word-input" placeholder="Escribí la palabra secreta" autocomplete="off" maxlength="20">
              <br><br>
              <button class="btn btn-primary" id="btn-set-word">Confirmar</button>
              <p style="color:var(--text2);margin-top:10px;font-size:.85em;">Solo letras, sin espacios ni acentos</p>
            </div>
          ` : '<div class="loader"></div>'}
        </div>
      </div>
    `;

    if (isChooser) {
      const input = document.getElementById('word-input');
      input.addEventListener('input', () => {
        input.value = input.value.replace(/[^a-záéíóúñ]/gi, '').toUpperCase();
      });
      document.getElementById('btn-set-word').addEventListener('click', () => {
        const w = input.value.trim().toUpperCase();
        if (w.length < 2) return notify('La palabra debe tener al menos 2 letras', 'error');
        this.word = w;
        this.phase = 'guess';
        this.guessed = [];
        this.errors = 0;
        this.socket.emit('game-action', { type: 'word-set', wordLength: w.length });
        this.render();
      });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btn-set-word').click(); });
      input.focus();
    }
  }

  renderGuessPhase() {
    const isGuesser = this.chooser !== this.me;
    const maskedWord = this.word
      ? this.word.split('').map(l => this.guessed.includes(l) ? l : '_').join('')
      : '_'.repeat(this.wordLength || 5);

    this.container.innerHTML = `
      <div class="ahorcado-container">
        <div>
          <div class="hangman-drawing" id="hangman-svg"></div>
          <p style="margin-top:10px;color:var(--text2);">Errores: ${this.errors}/${this.maxErrors}</p>
        </div>
        <div class="ahorcado-panel">
          <div class="turn-indicator ${isGuesser ? 'your-turn' : 'wait'}">
            ${isGuesser ? '¡Adiviná la letra!' : 'El rival está adivinando...'}
          </div>
          <div class="word-display">${maskedWord.split('').join(' ')}</div>
          ${isGuesser ? this.renderKeyboard() : `<p style="color:var(--text2);">Tu palabra: <b style="color:var(--yellow)">${this.word}</b></p>`}
          <div id="ahorcado-log" style="margin-top:15px;color:var(--text2);font-size:.85em;"></div>
        </div>
      </div>
    `;

    this.drawHangman(this.errors);

    if (isGuesser) {
      this.container.querySelectorAll('.key-btn').forEach(btn => {
        btn.addEventListener('click', () => this.guessLetter(btn.dataset.letter));
      });
    }
  }

  renderKeyboard() {
    const letters = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
    let html = '<div class="keyboard">';
    for (const l of letters) {
      const used = this.guessed.includes(l);
      const correct = used && this.word && this.word.includes(l);
      const cls = used ? (correct ? 'correct' : 'wrong') : '';
      html += `<button class="key-btn ${cls}" data-letter="${l}" ${used ? 'disabled' : ''}>${l}</button>`;
    }
    html += '</div>';
    return html;
  }

  guessLetter(letter) {
    if (this.guessed.includes(letter)) return;
    this.guessed.push(letter);
    this.socket.emit('game-action', { type: 'guess', letter });
    // We don't know the word yet, wait for response
  }

  drawHangman(errors) {
    const svg = document.getElementById('hangman-svg');
    if (!svg) return;
    const parts = [
      '<circle cx="100" cy="40" r="15"/>', // head
      '<line x1="100" y1="55" x2="100" y2="110"/>', // body
      '<line x1="100" y1="70" x2="70" y2="95"/>', // left arm
      '<line x1="100" y1="70" x2="130" y2="95"/>', // right arm
      '<line x1="100" y1="110" x2="75" y2="145"/>', // left leg
      '<line x1="100" y1="110" x2="125" y2="145"/>', // right leg
    ];
    const base = `
      <line x1="20" y1="180" x2="140" y2="180"/>
      <line x1="60" y1="180" x2="60" y2="10"/>
      <line x1="60" y1="10" x2="100" y2="10"/>
      <line x1="100" y1="10" x2="100" y2="25"/>
    `;
    svg.innerHTML = `<svg viewBox="0 0 160 190">${base}${parts.slice(0, errors).join('')}</svg>`;
  }

  onAction(data) {
    if (data.type === 'word-set') {
      this.wordLength = data.wordLength;
      this.phase = 'guess';
      this.guessed = [];
      this.errors = 0;
      this.render();
    } else if (data.type === 'guess') {
      // I'm the chooser, check the letter
      const letter = data.letter;
      this.guessed.push(letter);
      const hit = this.word.includes(letter);
      if (!hit) this.errors++;

      // Check win/lose
      const allFound = this.word.split('').every(l => this.guessed.includes(l));

      this.socket.emit('game-action', {
        type: 'guess-result',
        letter,
        hit,
        errors: this.errors,
        revealed: allFound ? this.word : null,
        gameOver: allFound || this.errors >= this.maxErrors,
        guesserWins: allFound
      });

      this.render();

      if (allFound || this.errors >= this.maxErrors) {
        setTimeout(() => {
          if (allFound) {
            this.gameOver(1 - this.chooser, `¡${this.names[1 - this.chooser]} adivinó: ${this.word}!`);
          } else {
            this.gameOver(this.chooser, `La palabra era: ${this.word}`);
          }
        }, 500);
      }
    } else if (data.type === 'guess-result') {
      // I'm the guesser
      if (data.hit) {
        // Need to know which positions - we reconstruct from guessed letters
      }
      if (!data.hit) this.errors = data.errors;
      if (data.revealed) this.word = data.revealed;
      // Mark letter
      const btn = this.container.querySelector(`.key-btn[data-letter="${data.letter}"]`);
      if (btn) {
        btn.classList.add(data.hit ? 'correct' : 'wrong');
        btn.disabled = true;
      }

      this.render();

      if (data.gameOver) {
        setTimeout(() => {
          if (data.guesserWins) {
            this.gameOver(this.me, `¡Adivinaste: ${data.revealed}!`);
          } else {
            this.gameOver(1 - this.me, `La palabra era: ${data.revealed || '???'}`);
          }
        }, 500);
      }
    }
  }

  gameOver(winnerIndex, msg) {
    const isWinner = winnerIndex === this.me;
    this.overlay = createGameOverOverlay(
      (isWinner ? '🎉 ' : '😢 ') + msg,
      isWinner,
      this.socket
    );
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
    this.chooser = 1 - this.chooser; // swap roles
    this.phase = 'choose';
    this.word = '';
    this.guessed = [];
    this.errors = 0;
    this.render();
  }

  destroy() {
    if (this.overlay) this.overlay.remove();
  }
}
