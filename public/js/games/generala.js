class GeneralaGame {
  constructor(container, socket, playerIndex, playerNames) {
    this.container = container;
    this.socket = socket;
    this.me = playerIndex;
    this.names = playerNames;
    this.turn = 0;
    this.rollsLeft = 3;
    this.dice = [0, 0, 0, 0, 0];
    this.held = [false, false, false, false, false];
    this.hasRolled = false;

    this.categories = [
      'Unos', 'Doses', 'Treses', 'Cuatros', 'Cincos', 'Seises',
      'Escalera', 'Full', 'Póker', 'Generala'
    ];

    // scores[playerIndex][categoryIndex] = score or null
    this.scores = [
      Array(this.categories.length).fill(null),
      Array(this.categories.length).fill(null)
    ];

    this.render();
  }

  render() {
    const isMyTurn = this.turn === this.me;
    const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

    this.container.innerHTML = `
      <div class="generala-container">
        <div class="dice-area">
          <div class="turn-indicator ${isMyTurn ? 'your-turn' : 'wait'}" id="gen-turn">
            ${isMyTurn ? '¡Tu turno!' : `Turno de ${this.names[this.turn]}`}
          </div>
          <div class="dice-container" id="dice-container">
            ${this.dice.map((d, i) => `
              <div class="die ${this.held[i] ? 'held' : ''}" data-idx="${i}">
                ${d === 0 ? '?' : diceEmojis[d]}
              </div>
            `).join('')}
          </div>
          <p class="rolls-left">Tiros restantes: ${this.rollsLeft}</p>
          <div style="display:flex;gap:10px;justify-content:center;">
            <button class="btn btn-primary" id="btn-roll" ${!isMyTurn || this.rollsLeft <= 0 ? 'disabled' : ''}>
              ${this.hasRolled ? 'Tirar de nuevo' : 'Tirar dados'}
            </button>
          </div>
          ${isMyTurn && this.hasRolled ? '<p style="color:var(--text2);margin-top:8px;font-size:.85em;">Click en un dado para guardarlo. Elegí categoría en la tabla.</p>' : ''}
        </div>
        <div>
          <table class="score-table" id="score-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>${this.names[0]}</th>
                <th>${this.names[1]}</th>
              </tr>
            </thead>
            <tbody id="score-body"></tbody>
          </table>
        </div>
      </div>
    `;

    this.renderScoreTable();

    // Dice click handlers
    if (isMyTurn && this.hasRolled && this.rollsLeft > 0) {
      this.container.querySelectorAll('.die').forEach(die => {
        die.addEventListener('click', () => {
          const idx = parseInt(die.dataset.idx);
          this.held[idx] = !this.held[idx];
          die.classList.toggle('held');
        });
      });
    }

    document.getElementById('btn-roll').addEventListener('click', () => this.roll());
  }

  renderScoreTable() {
    const body = document.getElementById('score-body');
    const isMyTurn = this.turn === this.me;
    let html = '';

    this.categories.forEach((cat, i) => {
      const s0 = this.scores[0][i];
      const s1 = this.scores[1][i];
      const canScore = isMyTurn && this.hasRolled && this.scores[this.me][i] === null;
      const potential = canScore ? this.calculateScore(i) : '';

      html += `<tr>
        <td>${cat}</td>
        <td class="${s0 !== null ? 'scored' : ''}">${s0 !== null ? s0 : (this.me === 0 && canScore ? `<span class="clickable" data-cat="${i}">${potential}</span>` : '-')}</td>
        <td class="${s1 !== null ? 'scored' : ''}">${s1 !== null ? s1 : (this.me === 1 && canScore ? `<span class="clickable" data-cat="${i}">${potential}</span>` : '-')}</td>
      </tr>`;
    });

    // Totals
    const t0 = this.scores[0].reduce((a, b) => a + (b || 0), 0);
    const t1 = this.scores[1].reduce((a, b) => a + (b || 0), 0);
    html += `<tr class="total-row"><td>TOTAL</td><td>${t0}</td><td>${t1}</td></tr>`;

    body.innerHTML = html;

    // Click handlers for scoring
    body.querySelectorAll('.clickable').forEach(el => {
      el.addEventListener('click', () => {
        const cat = parseInt(el.dataset.cat);
        this.scoreCategory(cat);
      });
    });
  }

  roll() {
    if (this.turn !== this.me || this.rollsLeft <= 0) return;

    for (let i = 0; i < 5; i++) {
      if (!this.held[i]) {
        this.dice[i] = Math.floor(Math.random() * 6) + 1;
      }
    }
    this.rollsLeft--;
    this.hasRolled = true;

    // Check for served generala (first roll, all same)
    if (this.rollsLeft === 2) {
      const allSame = this.dice.every(d => d === this.dice[0]);
      if (allSame && this.scores[this.me][9] === null) {
        // Generala servida - auto score
        this.scores[this.me][9] = 50;
        this.socket.emit('game-action', {
          type: 'scored',
          category: 9,
          score: 50,
          dice: [...this.dice],
          served: true
        });
        this.nextTurn();
        return;
      }
    }

    this.socket.emit('game-action', {
      type: 'roll',
      dice: [...this.dice],
      held: [...this.held],
      rollsLeft: this.rollsLeft
    });

    this.render();

    // Animate dice
    this.container.querySelectorAll('.die').forEach((die, i) => {
      if (!this.held[i]) die.classList.add('rolling');
    });
    setTimeout(() => {
      this.container.querySelectorAll('.rolling').forEach(d => d.classList.remove('rolling'));
    }, 400);

    // If no rolls left, must score
    if (this.rollsLeft === 0) {
      // Player must pick a category
    }
  }

  calculateScore(categoryIndex) {
    const d = this.dice;
    const counts = Array(7).fill(0);
    d.forEach(v => counts[v]++);
    const sorted = [...d].sort();

    switch (categoryIndex) {
      case 0: return counts[1] * 1;
      case 1: return counts[2] * 2;
      case 2: return counts[3] * 3;
      case 3: return counts[4] * 4;
      case 4: return counts[5] * 5;
      case 5: return counts[6] * 6;
      case 6: // Escalera
        const s = sorted.join('');
        if (s === '12345' || s === '23456') return this.rollsLeft === 2 ? 25 : 20;
        return 0;
      case 7: // Full
        const hasThree = counts.some(c => c === 3);
        const hasTwo = counts.some(c => c === 2);
        if (hasThree && hasTwo) return this.rollsLeft === 2 ? 35 : 30;
        return 0;
      case 8: // Póker
        if (counts.some(c => c >= 4)) return this.rollsLeft === 2 ? 45 : 40;
        return 0;
      case 9: // Generala
        if (counts.some(c => c === 5)) return this.rollsLeft === 2 ? 50 : 50;
        return 0;
      default: return 0;
    }
  }

  scoreCategory(catIndex) {
    if (this.scores[this.me][catIndex] !== null) return;
    if (!this.hasRolled) return;

    const score = this.calculateScore(catIndex);
    this.scores[this.me][catIndex] = score;

    this.socket.emit('game-action', {
      type: 'scored',
      category: catIndex,
      score,
      dice: [...this.dice]
    });

    this.nextTurn();
  }

  nextTurn() {
    // Check if game is over
    const allFilled = this.scores.every(s => s.every(v => v !== null));
    if (allFilled) {
      this.render();
      setTimeout(() => this.checkGameOver(), 300);
      return;
    }

    this.turn = 1 - this.turn;
    this.rollsLeft = 3;
    this.dice = [0, 0, 0, 0, 0];
    this.held = [false, false, false, false, false];
    this.hasRolled = false;
    this.render();
  }

  checkGameOver() {
    const t0 = this.scores[0].reduce((a, b) => a + (b || 0), 0);
    const t1 = this.scores[1].reduce((a, b) => a + (b || 0), 0);

    let winnerIdx, msg;
    if (t0 > t1) {
      winnerIdx = 0;
      msg = `${this.names[0]} gana ${t0} a ${t1}!`;
    } else if (t1 > t0) {
      winnerIdx = 1;
      msg = `${this.names[1]} gana ${t1} a ${t0}!`;
    } else {
      winnerIdx = -1;
      msg = `Empate ${t0} a ${t1}!`;
    }

    const isWinner = winnerIdx === this.me;
    this.overlay = createGameOverOverlay(
      (winnerIdx === -1 ? '🤝 ' : isWinner ? '🎉 ' : '😢 ') + msg,
      isWinner || winnerIdx === -1,
      this.socket
    );
  }

  onAction(data) {
    if (data.type === 'roll') {
      this.dice = data.dice;
      this.held = data.held;
      this.rollsLeft = data.rollsLeft;
      this.hasRolled = true;
      this.render();
    } else if (data.type === 'scored') {
      this.scores[data.playerIndex][data.category] = data.score;
      if (data.served) {
        notify(`¡${this.names[data.playerIndex]} sacó Generala servida!`);
      }

      // Check game over
      const allFilled = this.scores.every(s => s.every(v => v !== null));
      if (allFilled) {
        this.render();
        setTimeout(() => this.checkGameOver(), 300);
        return;
      }

      this.turn = 1 - data.playerIndex;
      this.rollsLeft = 3;
      this.dice = [0, 0, 0, 0, 0];
      this.held = [false, false, false, false, false];
      this.hasRolled = false;
      this.render();
    }
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
    this.turn = 0;
    this.rollsLeft = 3;
    this.dice = [0, 0, 0, 0, 0];
    this.held = [false, false, false, false, false];
    this.hasRolled = false;
    this.scores = [
      Array(this.categories.length).fill(null),
      Array(this.categories.length).fill(null)
    ];
    this.render();
  }

  destroy() {
    if (this.overlay) this.overlay.remove();
  }
}
