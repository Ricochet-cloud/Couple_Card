// 2048 미니게임: 4×4 판에서 밀어서 같은 숫자를 합치고, 2048 을 만들면 승리 (그 뒤로 계속할 수 있어요)
// 최고기록은 minigameScores/2048, 뽑기권 보상은 512 를 만들면 하루 1장 (사천성 보상과는 따로 계산해요)
import { db } from './firebase.js';
import * as firebaseModule from './firebase.js';
import * as authModule from './auth.js';
import {
  doc, runTransaction, collection, addDoc, getDoc, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

// ============ 설정 (숫자는 여기서만 바꾸면 돼요) ============
const SIZE = 4;
const REWARD_TILE = 512;        // 이 타일을 만들면 뽑기권 1장 (하루 1번)
const REWARD_AMOUNT = 1;
const WIN_TILE = 2048;
const SWIPE_MIN = 24;           // 이 거리(px) 이상 밀어야 스와이프로 인정
const ANIM_MS = 110;            // 타일 이동 시간
const FOUR_RATE = 0.1;          // 새 타일이 4 로 나올 확률
const BEST_COLLECTION = 'minigameScores';
const BEST_DOC = '2048';
const REWARD_FIELD = 'minigameRewardDate2048';
// 타일 이미지 (나중에 에셋이 생기면 여기만 채우면 돼요. 비워 두면 색깔 숫자 타일이 나와요)
// 예) 2: './images/2048/2.webp', 4: './images/2048/4.webp', ... 2048: './images/2048/2048.webp'
// 2048 을 넘는 타일 이미지는 big 에 넣어요. 이미지가 있는 타일은 숫자가 왼쪽 아래에 작게 남아요.
const TILE_IMAGES = {
  // 2: './images/2048/2.webp',
};
const IS_DEV = /[?&]dev=1/.test(location.search);

const $ = (id) => document.getElementById(id);

// ============ 날짜 · 계정 · 기록 · 보상 ============
function getTodayKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function getPlayerId() {
  try {
    const auth = firebaseModule.auth || getAuth();
    if (auth && auth.currentUser && auth.currentUser.uid) return auth.currentUser.uid;
  } catch (e) { console.warn('계정 확인 실패:', e); }
  try {
    if (typeof authModule.isAdmin === 'function') return authModule.isAdmin() ? 'admin' : 'shared';
  } catch (e) { console.warn('관리자 여부 확인 실패:', e); }
  return 'shared';
}

async function loadRecords() {
  const snap = await getDoc(doc(db, BEST_COLLECTION, BEST_DOC));
  return snap.exists() ? (snap.data().records || {}) : {};
}

async function saveBestIfHigher(myId, score, tile) {
  const ref = doc(db, BEST_COLLECTION, BEST_DOC);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const records = snap.exists() ? (snap.data().records || {}) : {};
    const prev = records[myId] || null;
    if (prev && (prev.score || 0) >= score) return { updated: false, best: prev.score };
    tx.set(ref, { records: { [myId]: { score, tile, date: getTodayKST() } } }, { merge: true });
    return { updated: true, best: score };
  });
}

// 512 타일 보상: 하루에 한 번만 (사천성 보상과 날짜 필드가 달라서 서로 영향이 없어요)
async function grantReward() {
  const stateRef = doc(db, 'state', 'shared');
  const today = getTodayKST();
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef);
    if (!snap.exists()) throw new Error('게임 상태를 초기화해주세요.');
    const s = snap.data();
    if (s[REWARD_FIELD] === today) return { granted: false, message: '오늘 2048 보상은 이미 받았어요.' };
    const tickets = (s.tickets || 0) + REWARD_AMOUNT;
    tx.update(stateRef, { tickets, [REWARD_FIELD]: today });
    return { granted: true, message: `🎟️ 뽑기권 +${REWARD_AMOUNT}`, today };
  });
  if (result.granted) {
    try {
      await addDoc(collection(db, 'minigameRewards'), {
        date: result.today, gameId: '2048', amount: REWARD_AMOUNT, grantedAt: Timestamp.now(),
      });
    } catch (e) { console.warn('보상 기록 저장 실패 (보상 자체는 성공):', e); }
  }
  return result;
}

// ============ 게임 ============
const DIRS = { left: [0, -1], up: [-1, 0], right: [0, 1], down: [1, 0] };

let tiles = [];          // { id, v, r, c, el }
let nextId = 1;
let score = 0;
let maxTile = 0;
let over = false;
let locked = false;
let winShown = false;
let rewardTried = false;
let rewardMsg = '';
let undoSnap = null;
let undoLeft = 1;
let myId = null;
let recordsCache = {};
let persistedScore = 0;
let toastTimer = null;

function toast(msg) {
  const t = $('g2048-toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

function setPos(t) {
  t.el.style.setProperty('--r', t.r);
  t.el.style.setProperty('--c', t.c);
}

function paint(t) {
  t.el.dataset.v = t.v > WIN_TILE ? 'big' : String(t.v);
  t.el.firstChild.textContent = t.v;
  t.el.classList.toggle('long', String(t.v).length >= 4);
  const img = TILE_IMAGES[t.v > WIN_TILE ? 'big' : t.v];
  t.el.classList.toggle('has-img', !!img);
  if (img) t.el.style.setProperty('--img', `url("${img}")`);
  else t.el.style.removeProperty('--img');
}

function makeTile(v, r, c, cls) {
  const el = document.createElement('div');
  el.className = 'g2048-tile' + (cls ? ' ' + cls : '');
  el.appendChild(document.createElement('span'));
  const t = { id: nextId++, v, r, c, el };
  paint(t); setPos(t);
  $('g2048-tiles').appendChild(el);
  tiles.push(t);
  if (v > maxTile) maxTile = v;
  return t;
}

function cellMap() {
  const m = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  tiles.forEach((t) => { m[t.r][t.c] = t; });
  return m;
}

function addRandomTile() {
  const m = cellMap();
  const empty = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!m[r][c]) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  makeTile(Math.random() < FOUR_RATE ? 4 : 2, r, c, 'is-new');
}

function canMove() {
  const m = cellMap();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!m[r][c]) return true;
      if (c + 1 < SIZE && m[r][c + 1] && m[r][c + 1].v === m[r][c].v) return true;
      if (r + 1 < SIZE && m[r + 1][c] && m[r + 1][c].v === m[r][c].v) return true;
    }
  }
  return false;
}

function snapshot() {
  return { tiles: tiles.map((t) => ({ v: t.v, r: t.r, c: t.c })), score, maxTile };
}

function restore(s) {
  $('g2048-tiles').innerHTML = '';
  tiles = [];
  maxTile = 0;
  s.tiles.forEach((t) => makeTile(t.v, t.r, t.c));
  score = s.score;
  maxTile = s.maxTile;
}

// 한 줄(가장자리에서 시작하는 순서)을 합치고 목표 칸을 정해요
function move(dirName) {
  if (locked || over) return;
  const [dr, dc] = DIRS[dirName];
  const m = cellMap();
  const before = snapshot();
  let moved = false;
  const dead = [];     // 합쳐져서 사라질 타일
  const grown = [];    // 합쳐져서 커질 타일

  for (let i = 0; i < SIZE; i++) {
    const line = [];
    for (let k = 0; k < SIZE; k++) {
      // 움직이는 방향의 가장자리 쪽 칸부터 차례로
      const idx = (dr + dc > 0) ? SIZE - 1 - k : k;
      line.push(dr === 0 ? [i, idx] : [idx, i]);
    }
    const out = [];   // 이번 줄에서 자리 잡은 타일
    let merged = null;
    line.forEach(([r, c]) => {
      const t = m[r][c];
      if (!t) return;
      const last = out[out.length - 1];
      if (last && last.v === t.v && merged !== last) {
        t.r = last.r; t.c = last.c;
        dead.push(t);
        last.v *= 2;
        grown.push(last);
        merged = last;
        score += last.v;
        moved = true;
      } else {
        const [tr, tc] = line[out.length];
        if (t.r !== tr || t.c !== tc) moved = true;
        t.r = tr; t.c = tc;
        out.push(t);
      }
    });
  }

  if (!moved) return;
  undoSnap = before;
  locked = true;
  tiles.forEach(setPos);
  updateHud();

  setTimeout(() => {
    dead.forEach((t) => { t.el.remove(); });
    tiles = tiles.filter((t) => !dead.includes(t));
    grown.forEach((t) => {
      paint(t);
      if (t.v > maxTile) maxTile = t.v;
      t.el.classList.remove('is-pop'); void t.el.offsetWidth; t.el.classList.add('is-pop');
    });
    addRandomTile();
    locked = false;
    afterMove();
  }, ANIM_MS);
}

function afterMove() {
  updateHud();
  if (maxTile >= REWARD_TILE && !rewardTried) {
    rewardTried = true;
    grantReward().then((r) => { rewardMsg = r.message; toast(r.message); })
      .catch((e) => { console.error('보상 지급 오류:', e); rewardMsg = '보상 처리 중 오류가 났어요.'; });
  }
  if (maxTile >= WIN_TILE && !winShown) {
    winShown = true;
    persist();
    showModal('🎉 2048 달성!', true);
    return;
  }
  if (!canMove()) {
    over = true;
    persist();
    showModal('게임 오버', false);
  }
}

// ============ 화면 ============
function updateHud() {
  $('g2048-score').textContent = score;
  $('g2048-maxTile').textContent = maxTile || '-';
  const mine = recordsCache[myId];
  let other = null;
  Object.keys(recordsCache).forEach((k) => {
    if (k === myId) return;
    if (!other || (recordsCache[k].score || 0) > (other.score || 0)) other = recordsCache[k];
  });
  const mineScore = Math.max(mine ? mine.score || 0 : 0, score);
  $('g2048-bestMine').textContent = mineScore || '-';
  $('g2048-bestOther').textContent = other ? other.score : '-';
  $('g2048-undoBtn').textContent = `↩ 되돌리기 (${undoLeft})`;
  $('g2048-undoBtn').disabled = undoLeft <= 0 || !undoSnap || over;
}

function showModal(title, win) {
  $('g2048-modalTitle').textContent = title;
  $('g2048-stats').innerHTML = `점수 <b>${score}</b> · 최고 타일 <b>${maxTile}</b>`;
  $('g2048-rewardMsg').textContent = rewardMsg ||
    (maxTile >= REWARD_TILE ? '' : `${REWARD_TILE} 타일을 만들면 뽑기권을 받아요`);
  $('g2048-continueBtn').style.display = win ? '' : 'none';
  $('g2048-modal').classList.add('show');
}

async function persist() {
  if (!score || score <= persistedScore) return;
  persistedScore = score;
  try {
    const r = await saveBestIfHigher(myId, score, maxTile);
    if (r.updated) {
      recordsCache[myId] = { score, tile: maxTile, date: getTodayKST() };
      updateHud();
    }
  } catch (e) { console.warn('최고기록 저장 실패:', e); }
}

function newGame() {
  persist();
  $('g2048-modal').classList.remove('show');
  $('g2048-tiles').innerHTML = '';
  tiles = []; score = 0; maxTile = 0; over = false; locked = false;
  winShown = false; rewardTried = false; rewardMsg = '';
  undoSnap = null; undoLeft = 1; persistedScore = 0;
  addRandomTile(); addRandomTile();
  updateHud();
}

function undo() {
  if (locked || over || undoLeft <= 0 || !undoSnap) return;
  restore(undoSnap);
  undoSnap = null;
  undoLeft--;
  updateHud();
}

// 개발 모드: 256 두 장을 나란히 놓아 512(보상) 확인
function devSetup() {
  restore({ tiles: [{ v: 256, r: 0, c: 0 }, { v: 256, r: 0, c: 1 }, { v: 2, r: 3, c: 3 }], score: 0, maxTile: 256 });
  updateHud();
}

export const Game2048 = {
  async start() {
    myId = getPlayerId();
    // 칸 배경 16개
    const bg = $('g2048-cells');
    bg.innerHTML = '';
    for (let i = 0; i < SIZE * SIZE; i++) bg.appendChild(Object.assign(document.createElement('div'), { className: 'g2048-cell' }));

    newGame();
    try { recordsCache = await loadRecords(); updateHud(); } catch (e) { console.warn('최고기록 불러오기 실패:', e); }

    // 키보드
    window.addEventListener('keydown', (e) => {
      const map = { ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', a: 'left', w: 'up', d: 'right', s: 'down' };
      const d = map[e.key];
      if (!d || $('g2048-modal').classList.contains('show')) return;
      e.preventDefault();
      move(d);
    });

    // 스와이프 (판 위에서만 화면이 스크롤되지 않아요)
    const board = $('g2048-board');
    let sx = 0, sy = 0, tracking = false;
    board.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; tracking = true; });
    board.addEventListener('pointercancel', () => { tracking = false; });
    board.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });

    $('g2048-undoBtn').addEventListener('click', undo);
    $('g2048-restartBtn').addEventListener('click', newGame);
    $('g2048-againBtn').addEventListener('click', newGame);
    $('g2048-continueBtn').addEventListener('click', () => $('g2048-modal').classList.remove('show'));
    document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

    if (IS_DEV) {
      const b = $('g2048-devBtn');
      b.style.display = 'block';
      b.addEventListener('click', devSetup);
    }
  },
};
