// 아이폰 사파리에서 한번 확대된 화면이 안 돌아올 때, 배율을 1로 되돌려요.
// (사파리는 JS로 줌을 직접 못 바꿔서, viewport 메타를 잠깐 바꿨다가 되돌리는 방법을 써요)
export function resetZoom() {
  const vv = window.visualViewport;
  if (!vv || vv.scale <= 1.01) return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const original = meta.getAttribute('content');
  meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1');
  setTimeout(() => meta.setAttribute('content', original), 300);
}
