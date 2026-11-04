/* 이벤트 게임 ↔ 사이트 연결 도우미 (일반 스크립트, import 필요 없음)

   게임 HTML 의 <head> 나 <body> 끝에 한 줄만 넣으세요. (event 폴더 안의 게임이면)
     <script src="event-bridge.js"></script>

   쓰는 법
     EventBridge.difficulty          // 'EASY' | 'NORMAL' | 'HARD' ... (사이트가 주소 ?d= 로 알려줌)
                                     // 난이도가 하나뿐인 게임이거나 혼자 열었으면 null
     EventBridge.report(true)        // 클리어! → 사이트가 보상(카드·뽑기권)을 줘요
     EventBridge.report(false)       // 실패 (사이트는 무시해요. 로그용)
     EventBridge.report(true, { survived: 60, duration: 60 })
                                     // 시간이 있는 게임이면 버틴 시간도 같이 (선택)

   사이트 없이 게임 파일만 열었을 때는 아무 일도 하지 않아요. (에러도 안 나요) */
(function () {
  'use strict';

  var raw = new URLSearchParams(location.search).get('d');
  var difficulty = raw && /^[A-Za-z0-9_]{1,20}$/.test(raw) ? raw.toUpperCase() : null;

  var inSite = window.parent !== window;

  function report(isWin, extra) {
    if (!inSite) return false;
    var msg = { type: 'gameResult', difficulty: difficulty, isWin: isWin === true, timestamp: Date.now() };
    if (extra && typeof extra === 'object') {
      if (Number.isFinite(extra.survived)) msg.survived = extra.survived;
      if (Number.isFinite(extra.duration)) msg.duration = extra.duration;
    }
    // file:// 로 열면 origin 이 'null' 이라 대상 지정이 안 돼서 '*' 를 써요
    window.parent.postMessage(msg, location.origin === 'null' ? '*' : location.origin);
    return true;
  }

  window.EventBridge = {
    difficulty: difficulty,
    inSite: inSite,
    report: report
  };
})();
