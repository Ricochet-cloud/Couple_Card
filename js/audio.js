(() => {
  "use strict";

  const STORAGE_KEY = "coupleCardMusicState";
  const MUSIC_SRC = "./audio/bgm.mp3";

  // 이전 페이지에서 저장한 재생 상태 불러오기
  let savedState = {};

  try {
    savedState = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}"
    );
  } catch {
    savedState = {};
  }

  // 오디오 객체 생성
  const audio = new Audio(MUSIC_SRC);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.35;

  // 재생 상태
  let shouldPlay = savedState.shouldPlay === true;
  let restored = false;

  // 재생 버튼 생성
  const player = document.createElement("div");
  player.className = "cc-music-player";

  const button = document.createElement("button");
  button.className = "cc-music-button";
  button.type = "button";
  button.setAttribute("aria-label", "배경음악 재생");
  button.innerHTML = `
    <span class="cc-music-icon">▶</span>
    <span class="cc-music-label">MUSIC OFF</span>
  `;

  player.appendChild(button);

  function updateButton() {
    const playing = !audio.paused;

    button.classList.toggle("is-playing", playing);
    button.querySelector(".cc-music-icon").textContent =
      playing ? "Ⅱ" : "▶";

    button.querySelector(".cc-music-label").textContent =
      playing ? "MUSIC ON" : "MUSIC OFF";

    button.setAttribute(
      "aria-label",
      playing ? "배경음악 정지" : "배경음악 재생"
    );
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentTime: audio.currentTime || 0,
          shouldPlay
        })
      );
    } catch {
      // 저장이 불가능해도 플레이어는 계속 작동
    }
  }

  async function playMusic() {
    shouldPlay = true;
    saveState();

    try {
      await audio.play();
    } catch (error) {
      // 브라우저가 자동 재생을 차단하면 버튼으로 재생
      console.info("음악 재생을 위해 버튼 클릭이 필요할 수 있습니다.");
    }

    updateButton();
  }

  function pauseMusic() {
    shouldPlay = false;
    audio.pause();
    saveState();
    updateButton();
  }

  button.addEventListener("click", () => {
    if (audio.paused) {
      playMusic();
    } else {
      pauseMusic();
    }
  });

  // 저장된 재생 위치 복원
  audio.addEventListener("loadedmetadata", async () => {
    if (restored) return;
    restored = true;

    const duration = audio.duration;
    const savedTime = Number(savedState.currentTime);

    if (
      Number.isFinite(savedTime) &&
      savedTime >= 0 &&
      Number.isFinite(duration) &&
      duration > 0
    ) {
      // 반복 재생 중 저장된 위치가 곡 길이를 넘는 경우 처리
      audio.currentTime = savedTime % duration;
    }

    if (shouldPlay) {
      await playMusic();
    } else {
      updateButton();
    }
  });

  // 재생 위치를 주기적으로 저장
  audio.addEventListener("timeupdate", saveState);

  audio.addEventListener("play", updateButton);
  audio.addEventListener("pause", updateButton);
  audio.addEventListener("ended", updateButton);

  // 페이지 이동 직전에 마지막 상태 저장
  window.addEventListener("pagehide", saveState);

  // 버튼을 페이지에 추가
  function mountPlayer() {
    if (!document.body.contains(player)) {
      document.body.appendChild(player);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountPlayer, {
      once: true
    });
  } else {
    mountPlayer();
  }

  updateButton();
})();