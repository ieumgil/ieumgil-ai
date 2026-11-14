// 관광지 둘러보기(/places) 화면 값. 서버(page.tsx)가 places.json · AI 한 줄 소개 · 대표 관광지 · 근거 문단으로 만들어 넘긴다.
// 화면에서 '꼭 가고 싶은 곳'으로 담기 전에 어떤 곳인지(소개·볼 거리·사진·운영시간)와 접근성 요약을 먼저 보게 한다.

import type { ConditionInput } from "../engine/conditions";
import { CONDITION_LABELS, resolveConditions } from "../engine/conditions";
import { publicSourceLabel } from "../public/source";
import { ACCESS_KEYS, type AccessKey, type AccessStatus as AccessValue, type Category, type Place, type PlaceHours, type Region } from "../types";
import { firstSentence, isIntroParagraph, type Paragraph, type PlaceSummary } from "./summary";

export interface BrowsePlace {
  id: string;
  name: string;
  region: Region;
  category: Category;
  /** 대표 관광지(기획 조사표) */
  featured: boolean;
  /** 어떤 곳인지 한 문장(AI 정리, 없으면 개요 첫 문장) */
  summary: string;
  /** ai = AI가 정리한 소개, source = 관광공사 개요 첫 문장 그대로 */
  summaryBy: "ai" | "source";
  highlights: string[];
  /** 관광공사 소개 원문(개요 문단) */
  overview: string[];
  phone: string;
  address?: string;
  hours: string;
  /** source: grade public(행정안전부 공중화장실 공공데이터)일 때만 "공공데이터(YYYY-MM 기준)". 화면 출처 표시용 */
  access: Record<AccessKey, { value: AccessValue; note?: string; source?: string }>;
}

const DAY: Record<string, string> = { 월: "월", 화: "화", 수: "수", 목: "목", 금: "금", 토: "토", 일: "일" };

/** 운영시간 한 줄: "상시 개방" / "09:00~18:00(입장 17:00) · 월요일 쉼" / 원문 요약 */
export function hoursText(h: PlaceHours): string {
  const closed = h.closed_weekdays?.length ? ` · ${h.closed_weekdays.map((d) => DAY[d] ?? d).join("·")}요일 쉼` : "";
  if (h.always_open) return `상시 개방${closed}`;
  const s = h.summer ?? h.winter;
  if (s) {
    const w = h.winter && h.summer && (h.winter.open !== h.summer.open || h.winter.close !== h.summer.close) ? ` (겨울 ${h.winter.open}~${h.winter.close})` : "";
    return `${s.open}~${s.close}${s.last_entry ? `, 입장 마감 ${s.last_entry}` : ""}${w}${closed}`;
  }
  return h.note ? `${h.note}${closed}` : `운영시간 정보 없음${closed}`;
}

export function toBrowsePlace(p: Place, summary: PlaceSummary | undefined, featured: boolean, paragraphs: Paragraph[]): BrowsePlace {
  const overview = paragraphs.filter((x) => x.id.startsWith("overview")).map((x) => x.text);
  return {
    id: p.id,
    name: p.name_ko,
    region: p.region,
    category: p.category,
    featured,
    summary: summary?.summary ?? firstSentence(paragraphs),
    summaryBy: summary ? "ai" : "source",
    highlights: summary?.highlights ?? [],
    overview: overview.length ? overview : paragraphs.filter((x) => isIntroParagraph(x.id)).map((x) => x.text).slice(0, 2),
    phone: p.phone,
    address: p.address,
    hours: hoursText(p.hours),
    access: Object.fromEntries(
      ACCESS_KEYS.map((k) => {
        const src = publicSourceLabel(p.access[k]);
        return [k, { value: p.access[k].value, ...(p.access[k].note ? { note: p.access[k].note } : {}), ...(src ? { source: src } : {}) }];
      }),
    ) as BrowsePlace["access"],
  };
}

/** 고른 유형이 없을 때 보여 줄 기본 항목 */
const DEFAULT_KEYS: AccessKey[] = ["step_free_entrance", "accessible_toilet", "elevator", "disabled_parking"];

/** 짧은 이름(카드용) */
const SHORT: Record<AccessKey, string> = {
  step_free_entrance: "단차 없는 진입",
  elevator: "엘리베이터",
  slope: "급경사 없음",
  surface: "포장길·데크",
  accessible_toilet: "장애인 화장실",
  diaper_nursing: "수유실",
  disabled_parking: "장애인 주차",
  rest_area: "쉴 곳",
  rental_wheelchair: "휠체어 대여",
  rental_stroller: "유모차 대여",
};

export interface GlanceItem {
  key: AccessKey;
  label: string;
  /** 자세히 볼 때 쓰는 긴 이름 */
  longLabel: string;
  value: AccessValue;
}

/**
 * 카드의 접근성 요약: 고른 유형의 꼭 필요한 조건(없으면 기본 4개). 값은 관광공사 정보를 AI가 정리한 값(일부는 공공데이터 public)(가능·부분가능·불가·모름).
 * blocked: 꼭 필요한 조건 중 '불가'가 있으면 담을 때 알려 준다(일정을 만들 때 빠질 수 있음).
 */
export function glance(p: Pick<BrowsePlace, "access">, input: ConditionInput | null): { items: GlanceItem[]; blocked: GlanceItem[]; byTraveler: boolean } {
  const must = input && input.travelers.length ? resolveConditions(input).must : [];
  const keys = must.length ? must : DEFAULT_KEYS;
  const items = keys.map((key) => ({ key, label: SHORT[key], longLabel: CONDITION_LABELS[key], value: p.access[key].value }));
  return { items, blocked: must.length ? items.filter((i) => i.value === "불가") : [], byTraveler: must.length > 0 };
}

/** 정렬: 대표 관광지 → 사진 있는 곳 → 이름 */
export function sortPlaces(list: BrowsePlace[], hasPhoto: (id: string) => boolean): BrowsePlace[] {
  return [...list].sort((a, b) => Number(b.featured) - Number(a.featured) || Number(hasPhoto(b.id)) - Number(hasPhoto(a.id)) || a.name.localeCompare(b.name, "ko"));
}

/** 이름·소개·볼 거리에서 찾기(띄어쓰기 무시) */
export function matches(p: BrowsePlace, query: string): boolean {
  const q = query.replace(/\s/g, "");
  if (!q) return true;
  return [p.name, p.summary, ...p.highlights, p.category].some((t) => t.replace(/\s/g, "").includes(q));
}
