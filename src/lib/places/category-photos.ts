// 좋아하는 곳 분야 카드의 옅은 배경 사진: 분야를 대표하는 장소의 1유형 대표 사진(public/photos/{id}.webp).
// 사람이 확인 페이지에서 고른 값. 바꾸려면 id만 바꾸면 된다(그 장소에 1유형 대표 사진이 있어야 한다 — 테스트가 검사).
import type { Category } from "../types";

export const CATEGORY_PHOTO: Record<Category, { id: string; name: string }> = {
  "바다·해변": { id: "DH05", name: "망상해변" },
  "자연·산책": { id: "GN34", name: "경포호" },
  "역사·문화": { id: "GN03", name: "강릉 경포대" },
  "전시·박물관": { id: "SC01", name: "국립산악박물관" },
  "시장·먹거리": { id: "GN22", name: "강릉커피거리" },
  "전망·체험": { id: "DH03", name: "도째비골스카이밸리" },
};

export const categoryThumb = (c: Category) => `/photos/${CATEGORY_PHOTO[c].id}.webp`;
