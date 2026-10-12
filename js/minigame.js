// 사천성 게임 + 보상 시스템
import { db } from './firebase.js';
import { doc, runTransaction, collection, addDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

// ============ 상수 ============
const MINIGAME_REWARD_AMOUNT = 1;
const MINIGAME_REWARD_LIMIT_PER_DAY = 1;
const ROWS = 8, COLS = 6, PAIRS = ROWS * COLS / 2;
const EMOJIS = ['🍎','🍊','🍋','🍇','🍓','🍒','🥝','🍑','🍉','🥕','🌽','🍄',
                '🐶','🐱','🐰','🐻','🐼','🐸','🦊','🐧','🌸','🌻','⭐','🌙',
                '🍀','🎈','🎀','🔔','🍪','🧸'];

// 이미지 파일 (30장: tile_01.webp ~ tile_30.webp)
const IMAGE_FILES = Array.from({ length: 30 }, (_, i) =>
  './images/sichuan/tile_' + String(i + 1).padStart(2, '0') + '.webp'
);

// ============ 게임 로직 (sichuan-standalone.html에서 가져옴) ============

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeGrid() {
  return Array.from({ length: ROWS + 2 }, () => Array(COLS + 2).fill(null));
}

function createBoard(cards) {
  const pool = shuffleArray(cards.slice());
  const tiles = [];
  for (let i = 0; i < PAIRS; i++) {
    const card = pool[i % pool.length];
    tiles.push({ id: card.id, card: card }, { id: card.id, card: card });
  }
  shuffleArray(tiles);
  const grid = makeGrid();
  let k = 0;
  for (let r = 1; r <= ROWS; r++)
    for (let c = 1; c <= COLS; c++) grid[r][c] = tiles[k++];
  return grid;
}

function isBetweenClear(grid, p, q) {
  if (p.r === q.r) {
    const lo = Math.min(p.c, q.c), hi = Math.max(p.c, q.c);
    for (let c = lo + 1; c < hi; c++) if (grid[p.r][c]) return false;
    return true;
  }
  if (p.c === q.c) {
    const lo = Math.min(p.r, q.r), hi = Math.max(p.r, q.r);
    for (let r = lo + 1; r < hi; r++) if (grid[r][p.c]) return false;
    return true;
  }
  return false;
}

function findPath(grid, a, b) {
  if (a.r === b.r && a.c === b.c) return null;
  const free = p => !grid[p.r][p.c] ||
    (p.r === a.r && p.c === a.c) || (p.r === b.r && p.c === b.c);
  const ok = (...pts) => {
    for (let i = 0; i < pts.length - 1; i++)
      if (!isBetweenClear(grid, pts[i], pts[i + 1])) return false;
    return true;
  };
  const clean = pts => pts.filter((p, i) =>
    i === 0 || p.r !== pts[i - 1].r || p.c !== pts[i - 1].c);

  if ((a.r === b.r || a.c === b.c) && ok(a, b)) return [a, b];
  for (const p of [{ r: a.r, c: b.c }, { r: b.r, c: a.c }])
    if (free(p) && ok(a, p, b)) return clean([a, p, b]);
  for (let c = 0; c <= COLS + 1; c++) {
    const p = { r: a.r, c: c }, q = { r: b.r, c: c };
    if (free(p) && free(q) && ok(a, p, q, b)) return clean([a, p, q, b]);
  }
  for (let r = 0; r <= ROWS + 1; r++) {
    const p = { r: r, c: a.c }, q = { r: r, c: b.c };
    if (free(p) && free(q) && ok(a, p, q, b)) return clean([a, p, q, b]);
  }
  return null;
}

function listTiles(grid) {
  const list = [];
  for (let r = 1; r <= ROWS; r++)
    for (let c = 1; c <= COLS; c++)
      if (grid[r][c]) list.push({ r: r, c: c });
  return list;
}

function findHint(grid) {
  const list = listTiles(grid);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (grid[a.r][a.c].id !== grid[b.r][b.c].id) continue;
      const path = findPath(grid, a, b);
      if (path) return { a: a, b: b, path: path };
    }
  }
  return null;
}

function shuffleRemaining(grid) {
  const pos = listTiles(grid);
  const tiles = pos.map(p => grid[p.r][p.c]);
  for (let t = 0; t < 300; t++) {
    shuffleArray(tiles);
    pos.forEach((p, i) => { grid[p.r][p.c] = tiles[i]; });
    if (findHint(grid)) return true;
  }
  return false;
}

// ============ 보상 시스템 ============

function getTodayKST() {
  const now = new Date();
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().split('T')[0];
}

export async function grantMinigameReward(gameId) {
  const stateRef = doc(db, 'state', 'shared');
  const today = getTodayKST();

  try {
    const result = await runTransaction(db, async (transaction) => {
      const stateDoc = await transaction.get(stateRef);
      if (!stateDoc.exists()) {
        throw new Error('게임 상태를 초기화해주세요.');
      }

      const state = stateDoc.data();
      const lastRewardDate = state.minigameRewardDate || null;

      if (lastRewardDate === today) {
        return {
          granted: false,
          message: '오늘 보상은 이미 받았어요.',
        };
      }

      const newTickets = (state.tickets || 0) + MINIGAME_REWARD_AMOUNT;
      transaction.update(stateRef, {
        tickets: newTickets,
        minigameRewardDate: today,
      });

      return {
        granted: true,
        message: `뽄기권 +${MINIGAME_REWARD_AMOUNT}`,
        tickets: newTickets,
        gameId,
        today,
      };
    });

    if (result.granted) {
      try {
        await addDoc(collection(db, 'minigameRewards'), {
          date: result.today,
          gameId: result.gameId,
          amount: MINIGAME_REWARD_AMOUNT,
          grantedAt: Timestamp.now(),
        });
      } catch (recordError) {
        console.warn('보상 기록 저장 실패 (보상 자체는 성공):', recordError);
      }
    }

    return {
      granted: result.granted,
      message: result.message,
      tickets: result.tickets,
    };
  } catch (error) {
    console.error('미니게임 보상 지급 실패:', error);
    throw error;
  }
}

// ============ 게임 상태 관리 ============

export const SichuanGame = (function () {
  let grid, cellEls = [], selected = null, locked = false, cleared = false;
  let moves = 0, hints = 0, shuffles = 0;
  let startTime = 0, elapsedMs = 0, timerId = null, hintTimer = null, toastTimer = null;
  let currentCards = null;

  const getEl = (id) => document.getElementById(id);

  function defaultCards() {
    if (IMAGE_FILES.length > 0)
      return IMAGE_FILES.map((src, i) => ({ id: 'img' + i, img: src }));
    return EMOJIS.map((e, i) => ({ id: 'emo' + i, emoji: e }));
  }

  function toast(msg) {
    const t = getEl('sichuan-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function updateHud() {
    const boardEl = getEl('sichuan-board');
    if (!boardEl) return;
    getEl('sichuan-pairsLeft').textContent = listTiles(grid).length / 2;
    getEl('sichuan-movesText').textContent = moves;
    getEl('sichuan-timeText').textContent = fmtTime(elapsedMs);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  function startTimer() {
    if (timerId || cleared) return;
    startTime = Date.now() - elapsedMs;
    timerId = setInterval(() => {
      elapsedMs = Date.now() - startTime;
      getEl('sichuan-timeText').textContent = fmtTime(elapsedMs);
    }, 250);
  }

  function fit() {
    const boardEl = getEl('sichuan-board');
    if (!boardEl) return;
    const unit = boardEl.clientWidth / (COLS + 1);
    boardEl.style.setProperty('--emoji-size', Math.round(unit * 0.55) + 'px');
  }

  function buildBoardDom() {
    const boardEl = getEl('sichuan-board');
    if (!boardEl) return;
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = '0.5fr repeat(' + COLS + ', 1fr) 0.5fr';
    boardEl.style.gridTemplateRows = '0.5fr repeat(' + ROWS + ', 1fr) 0.5fr';
    boardEl.style.aspectRatio = (COLS + 1) + ' / ' + (ROWS + 1);
    cellEls = [];
    for (let r = 0; r < ROWS + 2; r++) {
      const row = [];
      for (let c = 0; c < COLS + 2; c++) {
        const cell = document.createElement('div');
        const ring = r === 0 || c === 0 || r === ROWS + 1 || c === COLS + 1;
        cell.className = 'sichuan-cell' + (ring ? ' ring' : '');
        cell.dataset.r = r;
        cell.dataset.c = c;
        boardEl.appendChild(cell);
        row.push(cell);
      }
      cellEls.push(row);
    }
    fit();
  }

  function makeTileEl(tile) {
    const el = document.createElement('div');
    el.className = 'sichuan-tile';
    if (tile.card.img) {
      const img = document.createElement('img');
      img.src = tile.card.img;
      img.alt = '';
      img.draggable = false;
      el.appendChild(img);
    } else {
      el.textContent = tile.card.emoji || '❓';
    }
    return el;
  }

  function renderTiles() {
    for (let r = 1; r <= ROWS; r++) {
      for (let c = 1; c <= COLS; c++) {
        const cell = cellEls[r][c];
        cell.innerHTML = '';
        if (grid[r][c]) cell.appendChild(makeTileEl(grid[r][c]));
      }
    }
  }

  function tileEl(p) {
    return cellEls[p.r][p.c].firstElementChild;
  }

  function clearHint() {
    clearTimeout(hintTimer);
    const boardEl = getEl('sichuan-board');
    if (!boardEl) return;
    boardEl.querySelectorAll('.sichuan-tile.hint').forEach(el => el.classList.remove('hint'));
  }

  function select(p) {
    selected = p;
    const el = tileEl(p);
    if (el) el.classList.add('selected');
  }

  function unselect() {
    if (selected) {
      const el = tileEl(selected);
      if (el) el.classList.remove('selected');
    }
    selected = null;
  }

  function shake(p) {
    const el = tileEl(p);
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  function centerOf(p) {
    const boardEl = getEl('sichuan-board');
    const svgEl = getEl('sichuan-lines');
    if (!boardEl || !svgEl) return { x: 0, y: 0 };
    const br = boardEl.getBoundingClientRect();
    const r = cellEls[p.r][p.c].getBoundingClientRect();
    return { x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2 };
  }

  function drawPath(path) {
    const svgEl = getEl('sichuan-lines');
    if (!svgEl) return;
    const pts = path.map(p => { const c = centerOf(p); return c.x + ',' + c.y; }).join(' ');
    svgEl.innerHTML = '<polyline points="' + pts + '"></polyline>';
  }

  function clearPath() {
    const svgEl = getEl('sichuan-lines');
    if (!svgEl) return;
    svgEl.innerHTML = '';
  }

  function onTileClick(r, c) {
    if (locked || cleared || !grid[r][c]) return;
    startTimer();
    clearHint();
    const p = { r: r, c: c };

    if (!selected) {
      select(p);
      return;
    }
    if (selected.r === r && selected.c === c) {
      unselect();
      return;
    }

    const a = selected;
    moves++;
    getEl('sichuan-movesText').textContent = moves;

    if (grid[a.r][a.c].id !== grid[r][c].id) {
      shake(a);
      shake(p);
      unselect();
      select(p);
      return;
    }

    const path = findPath(grid, a, p);
    if (!path) {
      shake(a);
      shake(p);
      unselect();
      select(p);
      return;
    }

    locked = true;
    select(p);
    drawPath(path);
    setTimeout(() => {
      tileEl(a).classList.add('removing');
      tileEl(p).classList.add('removing');
    }, 180);
    setTimeout(() => {
      grid[a.r][a.c] = null;
      grid[p.r][p.c] = null;
      cellEls[a.r][a.c].innerHTML = '';
      cellEls[p.r][p.c].innerHTML = '';
      clearPath();
      selected = null;
      locked = false;
      updateHud();
      afterRemove();
    }, 380);
  }

  function afterRemove() {
    if (listTiles(grid).length === 0) {
      win();
      return;
    }
    if (!findHint(grid)) {
      shuffleRemaining(grid);
      renderTiles();
      toast('이어질 짝이 없어서 자동으로 섞었어요');
    }
  }

  function win() {
    stopTimer();
    cleared = true;
    const result = {
      time: Math.round(elapsedMs / 1000),
      moves: moves,
      hints: hints,
      shuffles: shuffles,
    };
    getEl('sichuan-stats').innerHTML =
      '걸린 시간 <b>' + fmtTime(elapsedMs) + '</b><br>시도 <b>' + moves + '</b>번 · ' +
      '힌트 <b>' + hints + '</b>번 · 섞기 <b>' + shuffles + '</b>번';
    getEl('sichuan-rewardMsg').textContent = '';
    getEl('sichuan-modal').classList.add('show');

    if (typeof window.onSichuanClear === 'function') {
      Promise.resolve()
        .then(() => window.onSichuanClear(result))
        .then(msg => {
          if (typeof msg === 'string') {
            getEl('sichuan-rewardMsg').textContent = msg;
          }
        })
        .catch(err => {
          console.error('클리어 콜백 오류:', err);
          getEl('sichuan-rewardMsg').textContent = '보상 처리 중 오류가 났어요. 다시 시도해 주세요.';
        });
    }
  }

  function startGame(cards) {
    currentCards = (cards && cards.length) ? cards : defaultCards();
    stopTimer();
    clearHint();
    clearPath();
    const modalEl = getEl('sichuan-modal');
    if (modalEl) modalEl.classList.remove('show');
    selected = null;
    locked = false;
    cleared = false;
    moves = 0;
    hints = 0;
    shuffles = 0;
    elapsedMs = 0;

    for (let i = 0; i < 50; i++) {
      grid = createBoard(currentCards);
      if (findHint(grid)) break;
    }
    buildBoardDom();
    renderTiles();
    updateHud();
  }

  return {
    startGame: startGame,
    defaultCards: defaultCards,
    setOnClear: (fn) => { window.onSichuanClear = fn; },
    attachEventListeners: function () {
      const boardEl = getEl('sichuan-board');
      if (boardEl) {
        boardEl.addEventListener('click', (e) => {
          const tile = e.target.closest('.sichuan-tile');
          if (!tile) return;
          const cell = tile.parentNode;
          onTileClick(+cell.dataset.r, +cell.dataset.c);
        });
      }

      const hintBtn = getEl('sichuan-hintBtn');
      if (hintBtn) {
        hintBtn.addEventListener('click', () => {
          if (locked || cleared) return;
          clearHint();
          const h = findHint(grid);
          if (!h) {
            toast('이어질 짝이 없어요. 섞기를 눌러 보세요');
            return;
          }
          startTimer();
          hints++;
          const el_a = tileEl(h.a);
          const el_b = tileEl(h.b);
          if (el_a) el_a.classList.add('hint');
          if (el_b) el_b.classList.add('hint');
          hintTimer = setTimeout(clearHint, 1800);
        });
      }

      const shuffleBtn = getEl('sichuan-shuffleBtn');
      if (shuffleBtn) {
        shuffleBtn.addEventListener('click', () => {
          if (locked || cleared) return;
          clearHint();
          unselect();
          startTimer();
          shuffleRemaining(grid);
          shuffles++;
          renderTiles();
          toast('남은 카드를 섞었어요');
        });
      }

      const restartBtn = getEl('sichuan-restartBtn');
      if (restartBtn) {
        restartBtn.addEventListener('click', () => startGame(currentCards));
      }

      const againBtn = getEl('sichuan-againBtn');
      if (againBtn) {
        againBtn.addEventListener('click', () => startGame(currentCards));
      }

      window.addEventListener('resize', fit);
    },
  };
})();

export const MINIGAME_CONSTANTS = {
  REWARD_AMOUNT: MINIGAME_REWARD_AMOUNT,
  REWARD_LIMIT_PER_DAY: MINIGAME_REWARD_LIMIT_PER_DAY,
};
