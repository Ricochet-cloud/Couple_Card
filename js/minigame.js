// 사천성 게임 (2분 타임어택) + 보상 시스템 + 콤보/점수/최고기록
import { db } from './firebase.js';
import * as firebaseModule from './firebase.js';
import * as authModule from './auth.js';
import {
  doc, runTransaction, collection, addDoc, getDoc, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

// ============ 상수 ============
const MINIGAME_REWARD_AMOUNT = 1;
const MINIGAME_REWARD_LIMIT_PER_DAY = 1;
const ROWS = 8, COLS = 6, PAIRS = ROWS * COLS / 2;

// ============ 2분 타임어택 설정 (숫자는 여기서만 바꾸면 돼요) ============
const TIME_LIMIT_SEC = 120;        // 제한 시간(초). 첫 클릭 때 카운트다운 시작
const TIME_LIMIT_MS = TIME_LIMIT_SEC * 1000;
const WARN_SEC = 10;               // 남은 시간이 이 이하면 시간 표시를 빨갛게
const REFILL_DELAY_MS = 700;       // 판을 다 지운 뒤 새 판이 채워지기까지 잠깐 멈추는 시간
const REWARD_MIN_SCORE = 500;      // 이 점수 이상이어야 뽑기권 지급 (하루 1번 제한은 그대로)
const EMOJIS = ['🍎','🍊','🍋','🍇','🍓','🍒','🥝','🍑','🍉','🥕','🌽','🍄',
                '🐶','🐱','🐰','🐻','🐼','🐸','🦊','🐧','🌸','🌻','⭐','🌙',
                '🍀','🎈','🎀','🔔','🍪','🧸'];

// 이미지 파일 (30장: tile_01.webp ~ tile_29.webp)
const IMAGE_FILES = Array.from({ length: 29 }, (_, i) =>
  './images/sichuan/tile_' + String(i + 1).padStart(2, '0') + '.webp'
);

// ============ 점수 규칙 (숫자는 여기서만 바꾸면 돼요) ============
const SCORE = {
  BASE: 100,                 // 짝 하나 제거 기본 점수
  COMBO_STEP: 20,            // 콤보가 이어질 때마다 늘어나는 점수
  COMBO_MAX_BONUS: 200,      // 콤보 보너스 상한
  COMBO_WINDOW_MS: 3000,     // 이 시간 안에 다음 짝을 지우면 콤보 이어짐
  HINT_PENALTY: 50,          // 힌트 1회 감점
  SHUFFLE_PENALTY: 100,      // 섞기(수동) 1회 감점. 자동 섞기는 감점 없음
};

const BEST_COLLECTION = 'minigameScores';
// 2분 타임어택은 점수 규모가 기존(한 판 클리어 방식)과 달라서 기록 문서를 새로 쓴다.
// 예전 기록은 minigameScores/sichuan 에 그대로 남아 있다.
const BEST_DOC = 'sichuan-2min';
const IS_DEV = /[?&]dev=1/.test(location.search);

// ===== SCORE LOGIC START (화면과 상관없는 계산 부분) =====
function calcComboBonus(chain) {
  // chain = 연속으로 지운 횟수 (첫 제거 = 1). 2번째부터 콤보 보너스가 붙는다.
  return Math.min(Math.max(chain - 1, 0) * SCORE.COMBO_STEP, SCORE.COMBO_MAX_BONUS);
}

function calcTotal(s) {
  return Math.max(0, s.base + s.combo - s.penalty);
}

// 지금 제거 성공 시 콤보를 이어갈지 판단해서 새 chain을 돌려준다.
function nextChain(chain, lastRemoveAt, now) {
  if (chain > 0 && lastRemoveAt && now - lastRemoveAt <= SCORE.COMBO_WINDOW_MS) return chain + 1;
  return 1;
}
// ===== SCORE LOGIC END =====

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
        message: `뽑기권 +${MINIGAME_REWARD_AMOUNT}`,
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

// ============ 최고기록 (Firebase) ============
// 문서 하나(minigameScores/sichuan)에 계정별 기록을 담는다.
// { records: { [계정 uid]: { score, time, date } } }

function getPlayerId() {
  try {
    const auth = firebaseModule.auth || getAuth();
    if (auth && auth.currentUser && auth.currentUser.uid) return auth.currentUser.uid;
  } catch (e) {
    console.warn('계정 확인 실패:', e);
  }
  // uid를 못 얻으면 관리자 여부로라도 두 계정을 구분한다.
  try {
    if (typeof authModule.isAdmin === 'function') return authModule.isAdmin() ? 'admin' : 'shared';
  } catch (e) {
    console.warn('관리자 여부 확인 실패:', e);
  }
  return 'shared';
}

async function loadRecords() {
  const snap = await getDoc(doc(db, BEST_COLLECTION, BEST_DOC));
  return snap.exists() ? (snap.data().records || {}) : {};
}

// 내 기록(mine)과 상대 기록 중 가장 높은 것(other)으로 나눈다.
function splitRecords(records, myId) {
  const mine = records[myId] || null;
  let other = null;
  Object.keys(records).forEach((k) => {
    if (k === myId) return;
    if (!other || (records[k].score || 0) > (other.score || 0)) other = records[k];
  });
  return { mine, other };
}

// 기존 최고 점수보다 높을 때만 갱신한다.
async function saveBestIfHigher(myId, score, timeSec) {
  const ref = doc(db, BEST_COLLECTION, BEST_DOC);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const records = snap.exists() ? (snap.data().records || {}) : {};
    const prev = records[myId] || null;
    if (prev && (prev.score || 0) >= score) {
      return { updated: false, prevScore: prev.score, best: prev.score };
    }
    tx.set(ref, {
      records: { [myId]: { score: score, time: timeSec, date: getTodayKST() } },
    }, { merge: true });
    return { updated: true, prevScore: prev ? prev.score : null, best: score };
  });
}

// ============ 게임 상태 관리 ============

export const SichuanGame = (function () {
  let grid, cellEls = [], selected = null, locked = false, gameOver = false;
  let moves = 0, hints = 0, shuffles = 0;
  let pairsRemoved = 0, boardsCleared = 0; // 지운 쌍 수, 판을 전부 지워서 새로 채운 횟수
  let startTime = 0, elapsedMs = 0, timerId = null, hintTimer = null, toastTimer = null;
  let currentCards = null;

  // 점수/콤보 상태
  let scoreBase = 0, scoreCombo = 0, scorePenalty = 0;
  let chain = 0, maxChain = 0, lastRemoveAt = 0, comboDeadline = 0, comboTimerId = null;
  let extraUiReady = false;
  let recordsCache = {};
  let runId = 0; // 판이 바뀌었을 때 늦게 도착한 기록 응답을 무시하기 위한 번호

  const getEl = (id) => document.getElementById(id);

  function currentScore() {
    return calcTotal({ base: scoreBase, combo: scoreCombo, penalty: scorePenalty });
  }

  // ---------- 점수/콤보 화면 (HTML/CSS를 건드리지 않고 JS가 직접 붙임) ----------
  function ensureExtraUi() {
    if (extraUiReady) return;
    const pairsEl = getEl('sichuan-pairsLeft');
    const boardEl = getEl('sichuan-board');
    if (!pairsEl || !boardEl) return;

    const box = pairsEl.parentElement;
    const hud = box && box.parentElement;
    if (box && hud) {
      const row = document.createElement('div');
      row.className = hud.className;
      row.id = 'sichuan-scoreRow';
      const mk = (label, id) => {
        const c = box.cloneNode(true);
        const b = c.querySelector('b');
        if (b) { b.id = id; b.textContent = '0'; }
        if (c.firstChild && c.firstChild.nodeType === 3) c.firstChild.textContent = label;
        return c;
      };
      row.appendChild(mk('점수', 'sichuan-scoreText'));
      row.appendChild(mk('콤보', 'sichuan-comboText'));
      row.appendChild(mk('내 최고', 'sichuan-bestMine'));
      row.appendChild(mk('상대 최고', 'sichuan-bestOther'));
      hud.parentNode.insertBefore(row, hud.nextSibling);

      // 콤보 게이지
      const gauge = document.createElement('div');
      gauge.id = 'sichuan-comboGauge';
      gauge.style.cssText = 'height:6px;margin:-4px 0 10px;border-radius:3px;background:rgba(0,0,0,.12);overflow:hidden;';
      const bar = document.createElement('div');
      bar.id = 'sichuan-comboBar';
      bar.style.cssText = 'height:100%;width:0%;background:#ffb703;transition:width .1s linear;';
      gauge.appendChild(bar);
      row.parentNode.insertBefore(gauge, row.nextSibling);
    }

    // 점수가 떠오르는 연출을 놓을 자리
    const wrap = boardEl.parentElement;
    if (wrap && getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';

    // 클리어 창의 점수 메시지 자리
    const rewardEl = getEl('sichuan-rewardMsg');
    if (rewardEl && !getEl('sichuan-scoreMsg')) {
      const m = document.createElement('p');
      m.id = 'sichuan-scoreMsg';
      m.style.cssText = 'margin:0 0 10px;font-size:14px;font-weight:700;color:#c2410c;word-break:keep-all;';
      rewardEl.parentNode.insertBefore(m, rewardEl);
    }
    extraUiReady = true;
  }

  function updateScoreUi() {
    const s = getEl('sichuan-scoreText');
    if (s) s.textContent = currentScore();
    const c = getEl('sichuan-comboText');
    if (c) c.textContent = chain >= 2 ? chain : '-';
    const bar = getEl('sichuan-comboBar');
    if (bar) {
      if (chain > 0) {
        const left = Math.max(0, comboDeadline - Date.now());
        bar.style.width = Math.round(left / SCORE.COMBO_WINDOW_MS * 100) + '%';
      } else {
        bar.style.width = '0%';
      }
    }
  }

  function refreshBestUi() {
    const { mine, other } = splitRecords(recordsCache, getPlayerId());
    const m = getEl('sichuan-bestMine');
    const o = getEl('sichuan-bestOther');
    if (m) m.textContent = mine ? mine.score : '-';
    if (o) o.textContent = other ? other.score : '-';
  }

  async function loadBestUi() {
    const myRun = runId;
    try {
      const records = await loadRecords();
      if (myRun !== runId) return;
      recordsCache = records;
    } catch (e) {
      console.warn('최고기록 불러오기 실패:', e);
    }
    refreshBestUi();
  }

  function popup(p, text, big) {
    const boardEl = getEl('sichuan-board');
    const wrap = boardEl && boardEl.parentElement;
    if (!wrap || !cellEls[p.r] || !cellEls[p.r][p.c]) return;
    const wr = wrap.getBoundingClientRect();
    const cr = cellEls[p.r][p.c].getBoundingClientRect();
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText =
      'position:absolute;pointer-events:none;z-index:5;font-weight:800;white-space:nowrap;' +
      'transform:translate(-50%,0);transition:transform .7s ease-out,opacity .7s ease-out;' +
      'text-shadow:0 1px 0 #fff,0 0 4px #fff;color:' + (big ? '#e11d48' : '#7c3a00') + ';' +
      'font-size:' + (big ? '20px' : '16px') + ';' +
      'left:' + (cr.left - wr.left + cr.width / 2) + 'px;top:' + (cr.top - wr.top) + 'px;';
    wrap.appendChild(el);
    void el.offsetWidth;
    el.style.transform = 'translate(-50%,-34px)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 800);
  }

  // 콤보 시간이 끝나면 콤보를 끊는다
  function tickCombo() {
    if (chain > 0 && Date.now() > comboDeadline) chain = 0;
    updateScoreUi();
  }
  function startComboTimer() {
    clearInterval(comboTimerId);
    comboTimerId = setInterval(tickCombo, 100);
  }
  function stopComboTimer() {
    clearInterval(comboTimerId);
    comboTimerId = null;
  }

  function breakCombo() {
    chain = 0;
    updateScoreUi();
  }

  // ---------- 기존 화면 ----------
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

  // 남은 시간을 보여준다 (올림해서 0초가 되는 순간에만 00:00)
  function showTime() {
    const el = getEl('sichuan-timeText');
    if (!el) return;
    const leftMs = Math.max(0, TIME_LIMIT_MS - elapsedMs);
    el.textContent = fmtTime(Math.ceil(leftMs / 1000) * 1000);
    el.style.color = leftMs <= WARN_SEC * 1000 ? '#e11d48' : '';
  }

  function updateHud() {
    const boardEl = getEl('sichuan-board');
    if (!boardEl) return;
    getEl('sichuan-pairsLeft').textContent = listTiles(grid).length / 2;
    getEl('sichuan-movesText').textContent = moves;
    showTime();
    updateScoreUi();
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  function startTimer() {
    if (timerId || gameOver) return;
    startTime = Date.now() - elapsedMs;
    timerId = setInterval(() => {
      elapsedMs = Date.now() - startTime;
      showTime();
      if (elapsedMs >= TIME_LIMIT_MS) endGame();
    }, 100);
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
    if (locked || gameOver || !grid[r][c]) return;
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
      breakCombo();
      unselect();
      select(p);
      return;
    }

    const path = findPath(grid, a, p);
    if (!path) {
      shake(a);
      shake(p);
      breakCombo();
      unselect();
      select(p);
      return;
    }

    // 연결 성공: 점수/콤보 계산 (클릭한 시점 기준)
    const now = Date.now();
    chain = nextChain(chain, lastRemoveAt, now);
    lastRemoveAt = now;
    comboDeadline = now + SCORE.COMBO_WINDOW_MS;
    if (chain > maxChain) maxChain = chain;
    const comboBonus = calcComboBonus(chain);
    scoreBase += SCORE.BASE;
    scoreCombo += comboBonus;
    pairsRemoved++;
    popup(p, '+' + (SCORE.BASE + comboBonus), false);
    if (chain >= 2) popup(a, chain + ' COMBO!', true);
    updateScoreUi();

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

  // 새 판을 만든다. 처음부터 이어질 짝이 하나는 있도록 여러 번 시도한다.
  function makeSolvableGrid() {
    let g;
    for (let i = 0; i < 50; i++) {
      g = createBoard(currentCards);
      if (findHint(g)) break;
    }
    return g;
  }

  // 판을 전부 지웠을 때: 잠깐 멈췄다가 새 판을 채우고 계속 진행 (시간은 계속 흐른다)
  function refillBoard() {
    boardsCleared++;
    locked = true;
    toast('🎉 전부 제거! 새 판이 채워져요');
    const myRun = runId;
    setTimeout(() => {
      if (myRun !== runId || gameOver) return; // 그 사이 다시 시작했거나 시간이 끝났으면 무시
      grid = makeSolvableGrid();
      renderTiles();
      locked = false;
      updateHud();
    }, REFILL_DELAY_MS);
  }

  function afterRemove() {
    if (gameOver) return;
    if (listTiles(grid).length === 0) {
      refillBoard();
      return;
    }
    if (!findHint(grid)) {
      shuffleRemaining(grid);
      renderTiles();
      toast('이어질 짝이 없어서 자동으로 섞었어요');
    }
  }

  // 시간 종료: 점수를 확정하고 결과 창을 띄운다 (뽑기권/최고기록 처리 포함)
  function endGame() {
    if (gameOver) return;
    stopTimer();
    stopComboTimer();
    gameOver = true;
    elapsedMs = Math.min(elapsedMs, TIME_LIMIT_MS);
    showTime();
    unselect();
    clearHint();
    clearPath();

    const timeSec = Math.round(elapsedMs / 1000);
    const finalScore = calcTotal({
      base: scoreBase, combo: scoreCombo, penalty: scorePenalty,
    });
    const result = {
      time: timeSec,
      moves: moves,
      hints: hints,
      shuffles: shuffles,
      score: finalScore,
      maxCombo: maxChain,
      pairs: pairsRemoved,
      boards: boardsCleared,
    };

    getEl('sichuan-stats').innerHTML =
      '제거한 짝 <b>' + pairsRemoved + '</b>쌍 · 새로 채운 판 <b>' + boardsCleared + '</b>번<br>' +
      '시도 <b>' + moves + '</b>번 · ' +
      '힌트 <b>' + hints + '</b>번 · 섞기 <b>' + shuffles + '</b>번<br>' +
      '최고 콤보 <b>' + maxChain + '</b><br>' +
      '기본 ' + scoreBase + ' + 콤보 ' + scoreCombo +
      ' - 감점 ' + scorePenalty + '<br>' +
      '<span style="font-size:20px">최종 점수 <b>' + finalScore + '</b>점</span>';
    getEl('sichuan-rewardMsg').textContent = '';
    const scoreMsgEl = getEl('sichuan-scoreMsg');
    if (scoreMsgEl) scoreMsgEl.textContent = '';
    getEl('sichuan-modal').classList.add('show');

    // 보상 지급: 기준 점수 이상일 때만 (하루 1번 제한은 grantMinigameReward 안에서 처리)
    if (finalScore < REWARD_MIN_SCORE) {
      getEl('sichuan-rewardMsg').textContent =
        REWARD_MIN_SCORE + '점 이상이면 뽑기권을 받아요. 한 판 더 해볼까요?';
    } else if (typeof window.onSichuanClear === 'function') {
      Promise.resolve()
        .then(() => window.onSichuanClear(result))
        .then(msg => {
          if (typeof msg === 'string') {
            getEl('sichuan-rewardMsg').textContent = msg;
          }
        })
        .catch(err => {
          console.error('보상 콜백 오류:', err);
          getEl('sichuan-rewardMsg').textContent = '보상 처리 중 오류가 났어요. 다시 시도해 주세요.';
        });
    }

    // 최고기록 저장 (실패해도 게임과 보상에는 영향 없음)
    const myRun = runId;
    const setScoreMsg = (text) => {
      const el = getEl('sichuan-scoreMsg');
      if (el && myRun === runId) el.textContent = text;
    };
    if (IS_DEV) {
      setScoreMsg('개발 모드라서 점수는 저장하지 않았어요.');
      return;
    }
    const myId = getPlayerId();
    saveBestIfHigher(myId, finalScore, timeSec)
      .then((res) => {
        recordsCache = Object.assign({}, recordsCache, {
          [myId]: { score: res.best, time: res.updated ? timeSec : (recordsCache[myId] || {}).time, date: getTodayKST() },
        });
        refreshBestUi();
        if (res.updated) {
          setScoreMsg(res.prevScore == null
            ? '🏆 첫 기록이에요!'
            : '🏆 최고기록 갱신! (이전 ' + res.prevScore + '점)');
        } else {
          setScoreMsg('내 최고 기록은 ' + res.best + '점이에요.');
        }
      })
      .catch((err) => {
        console.error('최고기록 저장 실패:', err);
        setScoreMsg('점수 기록 저장에 실패했어요. (게임과 보상은 정상이에요)');
      });
  }

  function startGame(cards) {
    currentCards = (cards && cards.length) ? cards : defaultCards();
    runId++;
    stopTimer();
    stopComboTimer();
    clearHint();
    clearPath();
    ensureExtraUi();
    const modalEl = getEl('sichuan-modal');
    if (modalEl) modalEl.classList.remove('show');
    selected = null;
    locked = false;
    gameOver = false;
    moves = 0;
    hints = 0;
    shuffles = 0;
    elapsedMs = 0;
    pairsRemoved = 0;
    boardsCleared = 0;
    scoreBase = 0;
    scoreCombo = 0;
    scorePenalty = 0;
    chain = 0;
    maxChain = 0;
    lastRemoveAt = 0;
    comboDeadline = 0;

    grid = makeSolvableGrid();
    buildBoardDom();
    renderTiles();
    updateHud();
    startComboTimer();
    refreshBestUi();
    loadBestUi();
  }

  return {
    startGame: startGame,
    defaultCards: defaultCards,
    setOnClear: (fn) => { window.onSichuanClear = fn; },
    // ?dev=1 테스트용: 시간이 다 된 것처럼 바로 종료 (점수는 현재까지 쌓인 값)
    devClear: function () { if (!gameOver) endGame(); },
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
          if (locked || gameOver) return;
          clearHint();
          const h = findHint(grid);
          if (!h) {
            toast('이어질 짝이 없어요. 섞기를 눌러 보세요');
            return;
          }
          startTimer();
          hints++;
          scorePenalty += SCORE.HINT_PENALTY;
          updateScoreUi();
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
          if (locked || gameOver) return;
          clearHint();
          unselect();
          startTimer();
          shuffleRemaining(grid);
          shuffles++;
          scorePenalty += SCORE.SHUFFLE_PENALTY;
          updateScoreUi();
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
