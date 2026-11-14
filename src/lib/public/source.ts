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

export interface DiaperDisplay {
  /** 화면에 보이는 한 줄: "기저귀 교환대 있음 · 여자화장실에만" */
  headline: string;
  /** 줄 아래 보조 설명(어느 화장실인지 등). 비면 없음 */
  note?: string;
  /** 합친 값이 공공데이터뿐이라 수유실은 정보가 없다는 뜻 */
  noNursing: boolean;
}

// restrooms.ts의 DIAPER_PLACE_TEXT 값과 같아야 한다(여기서 가져오면 서로 불러오는 순환이라 글을 따로 둔다).
const DIAPER_NOTE = /^기저귀 교환대 · (공중화장실 '.*?') (남녀 화장실 모두|남자화장실에만|여자화장실에만|위치 정보 없음)(.*)$/;
const NO_NURSING_TAIL = " · 수유실 정보 없음";

/**
 * 공공데이터 diaper_nursing 값의 화면 문장. 공공데이터는 기저귀 교환대만 말하므로
 * '수유실 · 가능'이 아니라 '기저귀 교환대 있음 · 위치'로 쓰고, 수유실은 따로 정보가 없다고 알린다.
 * 데이터 값(value·note)은 바꾸지 않고 note 글에서 읽어 올 뿐이다.
 */
export function diaperDisplay(note: string | undefined): DiaperDisplay {
  const text = note?.trim() ?? "";
  const m = DIAPER_NOTE.exec(text);
  if (!m) return { headline: "기저귀 교환대 있음", ...(text ? { note: text } : {}), noNursing: text.includes("수유실 정보 없음") };
  const [, place, where, rest] = m;
  const noNursing = rest.includes(NO_NURSING_TAIL);
  return { headline: `기저귀 교환대 있음 · ${where}`, note: `${place}${rest.replace(NO_NURSING_TAIL, "")}`, noNursing };
}

/** 화면에 붙이는 출처 문구. 공공데이터 값이 아니면 undefined (예: "공공데이터(2024-12 기준)") */
export function publicSourceLabel(item: Pick<AccessItem, "grade" | "verified_at">): string | undefined {
  if (item.grade !== "public") return undefined;
  return `공공데이터(${item.verified_at.slice(0, 7)} 기준)`;
}
