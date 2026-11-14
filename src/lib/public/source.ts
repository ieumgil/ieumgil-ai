// 공공데이터(행정안전부 전국공중화장실표준데이터) 출처 상수와 화면용 출처 문구.
// 클라이언트 컴포넌트도 import하므로 node 모듈을 쓰지 않는다.

import type { AccessItem } from "../types";

export const PUBLIC_RESTROOM_SOURCE = {
  dataset: "전국공중화장실표준데이터",
  provider: "행정안전부",
  url: "https://www.data.go.kr/data/15012892/standard.do",
  license: "이용허락범위 제한 없음",
} as const;

/** 공공데이터 근거 문단 id의 접두어(public-화장실-1) */
export const PUBLIC_EVIDENCE_PREFIX = "public-";

/** 근거 문단 label */
export const PUBLIC_EVIDENCE_LABEL = "공공데이터·공중화장실";

export function isPublicEvidenceId(id: string): boolean {
  return id.startsWith(PUBLIC_EVIDENCE_PREFIX);
}

/** 화면에 붙이는 출처 문구. 공공데이터 값이 아니면 undefined (예: "공공데이터(2024-12 기준)") */
export function publicSourceLabel(item: Pick<AccessItem, "grade" | "verified_at">): string | undefined {
  if (item.grade !== "public") return undefined;
  return `공공데이터(${item.verified_at.slice(0, 7)} 기준)`;
}
