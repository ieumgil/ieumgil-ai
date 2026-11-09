// "가 글씨 크게" 설정 저장 키. 서버(layout 인라인 스크립트)와 클라이언트(FontSizeToggle)가 함께 쓴다.
// "use client" 파일에서 내보내면 서버 쪽에서는 값이 아니라 참조로 바뀌므로 이 파일에 따로 둔다.
export const FONT_SIZE_KEY = "ieumgil-font-size";
