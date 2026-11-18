// 사진 자르기: 관리자가 카드 사진·일러스트를 고를 때, 카드의 사진 칸 모양(가로로 넓은 칸)에 맞춰 직접 잘라요.
// 손가락·마우스로 끌어서 위치를 맞추고, 슬라이더·휠·두 손가락으로 크기를 맞춰요. 끝나면 잘린 사진이 원래 파일 칸에 들어가요.
// 취소하면 사진 선택이 비워지고, '원본 그대로'를 누르면 자르지 않고 올려요(그러면 카드가 가운데를 알아서 잘라 보여줘요).

// 카드 사진 칸의 가로:세로 비율. 카드(5:7)의 54% 높이가 사진 칸이에요 → 5 : (7 × 0.54)
export const PHOTO_ASPECT = 5 / (7 * 0.54);
const MAX_OUT_WIDTH = 1280;   // 잘라낸 사진의 가로 최대 픽셀 (이후 올릴 때 한 번 더 줄여요)
const MAX_ZOOM = 4;

function loadImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없습니다.')); };
    img.src = url;
  });
}

/**
 * 자르기 창을 열어요.
 * @returns {Promise<{file: File}|{original: true}|null>} 잘린 파일 / 원본 그대로 / 취소(null)
 */
export function openCropper(file, aspect = PHOTO_ASPECT) {
  return new Promise(async (resolve) => {
    let img;
    try { img = await loadImg(file); } catch (e) { resolve({ original: true }); return; }
    const iw = img.naturalWidth, ih = img.naturalHeight;

    const root = document.createElement('div');
    root.className = 'crop-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `
      <div class="crop-box">
        <div class="crop-title">✂️ 사진 자르기</div>
        <div class="crop-hint">끌어서 위치를, 아래 막대로 크기를 맞춰요</div>
        <div class="crop-view" id="cropView"><img alt="" draggable="false"><div class="crop-grid"></div></div>
        <input class="crop-zoom" id="cropZoom" type="range" min="100" max="${MAX_ZOOM * 100}" value="100" step="1" aria-label="크기">
        <div class="crop-actions">
          <button type="button" class="crop-btn" data-act="cancel">취소</button>
          <button type="button" class="crop-btn" data-act="original">원본 그대로</button>
          <button type="button" class="crop-btn crop-btn--ok" data-act="ok">자르기 완료</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const view = root.querySelector('#cropView');
    const el = view.querySelector('img');
    const slider = root.querySelector('#cropZoom');
    const shownUrl = URL.createObjectURL(file);   // 화면에 보여 줄 사진 (닫을 때 정리해요)
    el.src = shownUrl;

    let VW = 0, VH = 0, base = 1;       // 자르는 칸 크기, 칸을 꽉 채우는 기본 배율
    let zoom = 1, tx = 0, ty = 0;       // 확대 배수, 이미지 중심이 칸 중심에서 벗어난 정도(px)

    const clamp = () => {
      const w = iw * base * zoom, h = ih * base * zoom;
      const mx = Math.max(0, (w - VW) / 2), my = Math.max(0, (h - VH) / 2);
      tx = Math.min(mx, Math.max(-mx, tx));
      ty = Math.min(my, Math.max(-my, ty));
    };
    const paint = () => {
      clamp();
      const s = base * zoom;
      el.style.width = `${iw * s}px`;
      el.style.height = `${ih * s}px`;
      el.style.transform = `translate(${VW / 2 + tx - (iw * s) / 2}px, ${VH / 2 + ty - (ih * s) / 2}px)`;
      slider.value = String(Math.round(zoom * 100));
    };
    const measure = () => {
      const r = view.getBoundingClientRect();
      VW = r.width; VH = r.height;
      base = Math.max(VW / iw, VH / ih);
      paint();
    };
    // 칸 크기가 정해진 뒤에 계산해요
    requestAnimationFrame(measure);
    const onResize = () => measure();
    window.addEventListener('resize', onResize);

    const setZoom = (z, anchorX = VW / 2, anchorY = VH / 2) => {
      const nz = Math.min(MAX_ZOOM, Math.max(1, z));
      // 손가락/커서 위치가 가리키던 사진 지점이 그대로 있도록 위치를 보정해요
      const k = nz / zoom;
      tx = (tx - (anchorX - VW / 2)) * k + (anchorX - VW / 2);
      ty = (ty - (anchorY - VH / 2)) * k + (anchorY - VH / 2);
      zoom = nz;
      paint();
    };

    // 끌기 + 두 손가락 확대
    const pts = new Map();
    let pinch0 = 0, zoom0 = 1;
    view.addEventListener('pointerdown', (e) => {
      view.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        zoom0 = zoom;
      }
    });
    view.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      if (pts.size === 1) {
        tx += e.clientX - p.x;
        ty += e.clientY - p.y;
        paint();
      }
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const r = view.getBoundingClientRect();
        setZoom(zoom0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch0), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      }
    });
    const up = (e) => { pts.delete(e.pointerId); };
    view.addEventListener('pointerup', up);
    view.addEventListener('pointercancel', up);
    view.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = view.getBoundingClientRect();
      setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    slider.addEventListener('input', () => setZoom(Number(slider.value) / 100));

    // 마무리
    const close = (result) => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      URL.revokeObjectURL(shownUrl);
      root.remove();
      resolve(result);
    };
    const finish = async () => {
      const s = base * zoom;
      const sw = VW / s, sh = VH / s;
      const sx = (iw * s / 2 - VW / 2 - tx) / s, sy = (ih * s / 2 - VH / 2 - ty) / s;
      const outW = Math.max(1, Math.min(Math.round(sw), MAX_OUT_WIDTH));
      const outH = Math.max(1, Math.round(outW / aspect));
      const canvas = document.createElement('canvas');
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { close({ original: true }); return; }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, Math.max(0, sx), Math.max(0, sy), Math.min(sw, iw), Math.min(sh, ih), 0, 0, outW, outH);
      canvas.toBlob((blob) => {
        if (!blob) { close({ original: true }); return; }
        close({ file: new File([blob], 'crop.png', { type: 'image/png' }) });
      }, 'image/png');
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
    document.addEventListener('keydown', onKey, true);
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'cancel') close(null);
      else if (act === 'original') close({ original: true });
      else if (act === 'ok') finish();
    });
  });
}

/**
 * 파일 입력 칸에 '고르면 자르기 창이 뜨는' 동작을 붙여요.
 * 이 함수는 그 칸의 다른 change 처리(미리보기 등)보다 먼저 불러야 해요. 자르기가 끝난 뒤에 그 처리들이 잘린 사진으로 이어져요.
 */
export function attachCrop(input, aspect = PHOTO_ASPECT) {
  input.addEventListener('change', async (e) => {
    if (e.cropDone) return;                  // 자르기를 마치고 다시 보낸 신호는 그대로 통과
    e.stopImmediatePropagation();            // 원본 사진으로 미리보기 등이 먼저 돌지 않게
    const file = input.files[0];
    if (!file) { passOn(input); return; }
    const out = await openCropper(file, aspect);
    if (out === null) { input.value = ''; passOn(input); return; }          // 취소
    if (out.file) {
      try {
        const dt = new DataTransfer();
        dt.items.add(out.file);
        input.files = dt.files;
      } catch (err) { /* 파일 칸을 못 바꾸는 브라우저면 원본 그대로 써요 */ }
    }
    passOn(input);
  });
}

function passOn(input) {
  const ev = new Event('change', { bubbles: true });
  ev.cropDone = true;
  input.dispatchEvent(ev);
}
