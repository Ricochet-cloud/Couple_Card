// 뽑기 특별 연출: 전설·울트라 카드가 나올 때만 써요 (다른 등급은 예전 그대로예요)
//   charge(): 카드 뒷면이 점점 세게 떨리고 뒤에서 빛줄기가 돌기 시작해요
//   burst():  카드가 뒤집히는 순간 섬광·충격파·반짝이 조각이 터지고 '전설!' 배너가 떠요 (울트라는 색종이도 내려요)
//   clear():  연출을 걷어 내요 (다음 뽑기 전에 불러요)
const CONFIG = {
  legend: { label: '전설', charge: 1200, particles: 26, confetti: 0, colors: ['#ffcf4a', '#fff3b0', '#ffffff', '#ffb12b'] },
  ultra: { label: '울트라', charge: 1500, particles: 44, confetti: 36, colors: ['#ff6b8b', '#ffd96b', '#6bffb0', '#6bd5ff', '#c58bff', '#ffffff'] },
};

let token = 0;               // clear() 때마다 올라가요. 오래 걸리는 연출이 뒤늦게 끼어들지 않게 해요
let nodes = [];              // 연출 때문에 만든 요소들
let activeStage = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function add(parent, cls, html = '') {
  const el = document.createElement('div');
  el.className = cls;
  if (html) el.innerHTML = html;
  parent.appendChild(el);
  nodes.push(el);
  return el;
}

/** 이 카드에 특별 연출을 쓸지: 'legend' | 'ultra' | null */
export function fxRarityOf(card) {
  return card && CONFIG[card.rarity] ? card.rarity : null;
}

export function clear() {
  token += 1;
  for (const el of nodes) el.remove();
  nodes = [];
  if (activeStage) {
    activeStage.classList.remove('fx-on');
    activeStage.querySelector('.card-back')?.classList.remove('fx-shake-1', 'fx-shake-2', 'fx-shake-3');
  }
  activeStage = null;
}

function setup(stage, key) {
  clear();
  activeStage = stage;
  stage.classList.add('fx-on');
  add(document.body, 'fx-dim');
  const layer = add(stage, `fx-layer fx-${key}`);
  layer.innerHTML = '<div class="fx-rays"></div><div class="fx-aura"></div>';
  return layer;
}

/** 뒤집기 전의 '뜸 들이기'. 끝나면 이어서 뒤집으면 돼요. */
export async function charge(stage, key) {
  const layer = setup(stage, key);
  const my = token;
  const back = stage.querySelector('.card-back');
  const total = CONFIG[key].charge;
  layer.classList.add('fx-charging');
  back?.classList.add('fx-shake-1');
  await sleep(total * 0.4);
  if (my !== token) return;
  back?.classList.replace('fx-shake-1', 'fx-shake-2');
  await sleep(total * 0.35);
  if (my !== token) return;
  back?.classList.replace('fx-shake-2', 'fx-shake-3');
  await sleep(total * 0.25);
  if (my !== token) return;
  back?.classList.remove('fx-shake-3');
}

/**
 * 카드가 뒤집히는 순간의 폭발 연출. charge 없이 바로 불러도 돼요(변신 카드가 정체를 드러낼 때).
 * reduced: 움직임을 줄이는 설정이면 섬광·조각 없이 배너만 잠깐 보여줘요.
 */
export function burst(stage, key, { reduced = false } = {}) {
  const cfg = CONFIG[key];
  let layer = stage.querySelector('.fx-layer');
  if (!layer || !layer.classList.contains(`fx-${key}`)) layer = setup(stage, key);
  const my = token;
  layer.classList.remove('fx-charging');
  layer.classList.add('fx-burst');

  add(layer, 'fx-banner', `<span>★ ${cfg.label}! ★</span>`);
  if (!reduced) {
    add(document.body, 'fx-flash');
    add(layer, 'fx-ring');
    const w = stage.getBoundingClientRect().width || 240;
    for (let i = 0; i < cfg.particles; i += 1) {
      const a = (Math.PI * 2 * i) / cfg.particles + rand(-0.2, 0.2);
      const d = rand(0.55, 1.25) * w;
      const p = add(layer, 'fx-bit');
      const s = Math.round(rand(5, 10));
      p.style.cssText = `--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;--r:${Math.round(rand(-180, 180))}deg;width:${s}px;height:${s}px;background:${pick(cfg.colors)};animation-delay:${Math.round(rand(0, 120))}ms`;
    }
    if (cfg.confetti) {
      const box = add(document.body, 'fx-confetti');
      for (let i = 0; i < cfg.confetti; i += 1) {
        const c = document.createElement('i');
        c.style.cssText = `left:${rand(0, 100).toFixed(1)}%;--sw:${Math.round(rand(-60, 60))}px;background:${pick(cfg.colors)};animation-delay:${Math.round(rand(0, 700))}ms;animation-duration:${Math.round(rand(1800, 2800))}ms`;
        box.appendChild(c);
      }
    }
  }

  // 잠시 뒤 배너·어두운 막·조각은 걷고, 카드 뒤의 빛(후광)만 남겨요
  setTimeout(() => {
    if (my !== token) return;
    for (const el of [...nodes]) {
      if (el.matches('.fx-banner, .fx-dim, .fx-bit, .fx-ring, .fx-flash, .fx-confetti')) {
        el.remove();
        nodes = nodes.filter((n) => n !== el);
      }
    }
  }, 3000);
}
