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

/** 운영 데이터에서는 '미확인'이 하나라도 있으면 검사가 실패한다. */
export type AccessStatus = "가능" | "부분가능" | "불가" | "미확인";

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
  | "기타";

export interface AccessItem {
  value: AccessStatus;
  /** 부분가능이면 필수 */
  note?: string;
  source_url: string;
  /** yyyy-mm-dd */
  verified_at: string;
  method?: AccessMethod;
}

export interface OpeningHours {
  /** HH:MM */
  open: string;
  close: string;
  last_entry?: string;
}

export type Weekday = "일" | "월" | "화" | "수" | "목" | "금" | "토";

export interface PlaceHours {
  summer: OpeningHours;
  winter: OpeningHours;
  closed_weekdays?: Weekday[];
  /** 예: "설날 당일", "2027-02-17" */
  closed_dates?: string[];
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
  /** GN01, SC03, DH07 */
  id: string;
  name_ko: string;
  name_en?: string;
  region: Region;
  category: Category;
  lat: number;
  lng: number;
  parking_lat?: number;
  parking_lng?: number;
  address?: string;
  phone: string;
  hours: PlaceHours;
  /** 권장 체류 범위(분) */
  stay_min: number;
  stay_max: number;
  parking_to_entrance?: DistanceNote;
  route_length?: DistanceNote;
  access: Record<AccessKey, AccessItem>;
  photos?: Photo[];
  /** 불가일 때 추천할 대안 장소 id */
  alternatives?: string[];
}
