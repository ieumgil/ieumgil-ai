// 장소 데이터 타입. data/places.schema.json과 1:1로 맞춘다.

export const REGIONS = ["강릉", "속초", "동해"] as const;
export type Region = (typeof REGIONS)[number];

export const CATEGORIES = [
  "바다·해변",
  "자연·산책",
  "역사·문화",
  "전시·박물관",
  "시장·먹거리",
  "전망·체험",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** '모름'은 허용하되 물어볼 질문(ask)이 반드시 있어야 한다(원칙 2, docs/ai-plan.md v3). */
export type AccessStatus = "가능" | "부분가능" | "불가" | "모름";

/**
 * 값의 출처 등급: ai = LLM이 관광공사 문장을 읽고 정리, public = 행정안전부 공중화장실 공공데이터를 코드가 그대로 옮김(AI 정리 아님),
 * human = 사람이 전화·현장으로 확인. 우선순위는 human > public > ai.
 */
export type Grade = "ai" | "public" | "human";

export const ACCESS_KEYS = [
  "step_free_entrance", // 계단·단차 없는 진입
  "elevator", // 엘리베이터(층이 있는 시설)
  "slope", // 경사로 기울기
  "surface", // 노면
  "accessible_toilet", // 장애인 화장실
  "diaper_nursing", // 기저귀 교환대·수유실
  "disabled_parking", // 장애인 전용 주차구역
  "rest_area", // 휴식 공간
  "rental_wheelchair", // 휠체어 대여
  "rental_stroller", // 유모차 대여
] as const;
export type AccessKey = (typeof ACCESS_KEYS)[number];

export type AccessMethod =
  | "관광공사 API"
  | "지자체 누리집"
  | "열린관광"
  | "전화 확인"
  | "현장 확인"
  | "공공데이터"
  | "기타";

export interface AccessItem {
  value: AccessStatus;
  /** 부분가능이면 필수 */
  note?: string;
  /** 모름이면 필수: 출발 전에 전화로 물어볼 질문 */
  ask?: string;
  /** 근거 문장 id(data/docs/places/{id}.md의 문단 id, 예: "route-1"). 등급 ai이고 모름이 아니면 1개 이상. public이면 public-화장실-N 문단 id */
  evidence?: string[];
  grade: Grade;
  method: AccessMethod;
  /** yyyy-mm-dd: ai면 API 조회일, public이면 공공데이터 기준일, human이면 확인한 날 */
  verified_at: string;
  source_url?: string;
}

/** 도착 후 동선 초안(① 읽기). 요청할 때 사용자 유형에 맞춰 다듬는다 */
export interface OnSite {
  text: string;
  evidence: string[];
  grade: Grade;
}

export interface OpeningHours {
  /** HH:MM */
  open: string;
  close: string;
  last_entry?: string;
}

export type Weekday = "일" | "월" | "화" | "수" | "목" | "금" | "토";

/** 운영시간. 모르면 summer/winter를 비우고 ask(물어볼 질문)를 넣는다. 상시 개방이면 always_open */
export interface PlaceHours {
  summer?: OpeningHours;
  winter?: OpeningHours;
  always_open?: boolean;
  closed_weekdays?: Weekday[];
  /** 예: "설날 당일", "2027-02-17" */
  closed_dates?: string[];
  /** 원문 요약(예: "매표 09:00~17:00, 관람 09:00~18:00") */
  note?: string;
  ask?: string;
  evidence?: string[];
  grade?: Grade;
}

export interface DistanceNote {
  meters?: number;
  note?: string;
}

export interface Photo {
  url: string;
  provider: string;
  /** 공공누리 유형(0 = 해당 없음) */
  kogl_type: 0 | 1 | 2 | 3 | 4;
  credit?: string;
}

export interface Place {
  /** GN01, SC03, DH07, GN120 */
  id: string;
  /** 한국관광공사 contentid */
  tour_content_id?: string;
  name_ko: string;
  name_en?: string;
  region: Region;
  category: Category;
  lat: number;
  lng: number;
  parking_lat?: number;
  parking_lng?: number;
  address?: string;
  /** 공식 문의 전화(필수, '출발 전 확인' 버튼) */
  phone: string;
  hours: PlaceHours;
  /** 권장 체류 범위(분) */
  stay_min: number;
  stay_max: number;
  parking_to_entrance?: DistanceNote;
  route_length?: DistanceNote;
  access: Record<AccessKey, AccessItem>;
  on_site?: OnSite;
  photos?: Photo[];
  /** 불가일 때 추천할 대안 장소 id */
  alternatives?: string[];
}
