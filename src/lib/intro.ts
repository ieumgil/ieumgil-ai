// 첫 접속 인트로 설정(서버 layout과 클라이언트 Intro가 함께 쓴다 — "use client" 파일에 두면 서버에서 문자열로 못 읽는다)
export const INTRO_KEY = "ieumgil-intro-seen";

/** layout <head>에 넣는 인라인 스크립트: 시작 화면이고, 이 탭에서 처음이고, 움직임 줄이기가 아니면 인트로를 켠다 */
export const INTRO_SCRIPT = `(function(){try{if(location.pathname==="/"&&!sessionStorage.getItem(${JSON.stringify(INTRO_KEY)})&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.intro="on"}catch(e){}})()`;
