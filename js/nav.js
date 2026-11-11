// 하단 메뉴 (모든 페이지 공통): 홈 · 도감 · 상점 + "더보기"(재조합 · 도전과제 · 관리)
// 메뉴를 바꿀 땐 이 파일만 고치면 돼요. 페이지에는 <nav class="bottom-nav" id="bottomNav"></nav> 와 이 스크립트만 있어요.
import { initAuth, isAdmin } from './auth.js';

const MAIN = [
  { page: 'home', href: './index.html', icon: '🏠', label: '홈' },
  { page: 'collection', href: './collection.html', icon: '📖', label: '도감' },
  { page: 'shop', href: './shop.html', icon: '🛒', label: '상점' },
];
const MORE = [
  { page: 'recombine', href: './recombine.html', icon: '✨', label: '재조합' },
  { page: 'achievements', href: './achievements.html', icon: '🏆', label: '도전과제' },
  { page: 'admin', href: './admin.html', icon: '⚙️', label: '관리', id: 'adminNav', hidden: true },
];

// 지금 보고 있는 페이지 (index.html 은 홈)
const file = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
const current = file === 'index' ? 'home' : file;
const inMore = MORE.some((m) => m.page === current);

const STYLE = `
.bottom-nav button.nav-item { background: none; border: none; border-right: none; cursor: pointer; font: inherit; font-family: 'Galmuri'; padding: 0; box-shadow: none; color: var(--text-muted); }
.bottom-nav button.nav-item.is-current { color: var(--grass-green); font-weight: 700; transform: translateY(-2px); }
.more-sheet { position: fixed; inset: 0; z-index: 19; display: none; }
.more-sheet.show { display: block; }
.more-sheet__back { position: absolute; inset: 0; background: rgba(30, 20, 10, 0.45); }
.more-sheet__panel {
  position: absolute; left: 0; right: 0; bottom: calc(60px + env(safe-area-inset-bottom, 0px));
  display: flex; gap: 10px; padding: 14px 16px 16px; background: var(--bg-cream);
  border-top: 3px solid var(--wood-dark); box-shadow: 0 -3px 0 rgba(0, 0, 0, 0.1);
  animation: moreUp 0.18s steps(4);
}
.more-item {
  flex: 1; max-width: 140px; min-height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  background: #fff; border: 2px solid var(--wood-dark); box-shadow: 2px 2px 0 rgba(61, 40, 23, 0.2);
  text-decoration: none; color: var(--text-dark); font-family: 'Galmuri'; font-size: 11px;
}
.more-item:active { transform: translateY(2px); box-shadow: none; }
.more-item.active { background: #e6f0d6; color: var(--grass-green); font-weight: 700; }
.more-item__icon { font-size: 22px; }
@keyframes moreUp { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .more-sheet__panel { animation: none; } }
`;

function render() {
  const nav = document.getElementById('bottomNav');
  if (!nav) return;

  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  nav.innerHTML = MAIN.map((m) => `
    <a href="${m.href}" class="nav-item${m.page === current ? ' active' : ''}" data-page="${m.page}">
      <span class="nav-icon">${m.icon}</span><span class="nav-label">${m.label}</span>
    </a>`).join('') + `
    <button type="button" class="nav-item${inMore ? ' is-current' : ''}" id="navMore" aria-haspopup="true" aria-expanded="false">
      <span class="nav-icon">⋯</span><span class="nav-label">더보기</span>
    </button>`;

  const sheet = document.createElement('div');
  sheet.className = 'more-sheet';
  sheet.innerHTML = `<div class="more-sheet__back"></div><div class="more-sheet__panel" role="menu">` + MORE.map((m) => `
    <a href="${m.href}" role="menuitem" class="more-item${m.page === current ? ' active' : ''}" data-page="${m.page}"${m.id ? ` id="${m.id}"` : ''}${m.hidden ? ' style="display: none;"' : ''}>
      <span class="more-item__icon">${m.icon}</span><span>${m.label}</span>
    </a>`).join('') + '</div>';
  document.body.appendChild(sheet);

  const btn = document.getElementById('navMore');
  const set = (open) => { sheet.classList.toggle('show', open); btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', () => set(!sheet.classList.contains('show')));
  sheet.querySelector('.more-sheet__back').addEventListener('click', () => set(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });

  // 관리자만 '관리'가 보여요
  initAuth(() => { if (isAdmin()) document.getElementById('adminNav').style.display = 'flex'; });
}

render();
