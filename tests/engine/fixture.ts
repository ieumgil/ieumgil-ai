// 엔진 테스트용 가짜 장소 만들기(실제 관광지 아님). 기본값은 모든 항목 '가능'(사람 확인), 강릉역 근처.
import { EMPTY_PLAN, type PlanInput } from "@/lib/plan/types";
import { ACCESS_KEYS, type AccessItem, type AccessKey, type Place } from "@/lib/types";

const ok: AccessItem = { value: "가능", grade: "human", method: "현장 확인", verified_at: "2026-11-10" };

export function makePlace(id: string, patch: Partial<Place> & { set?: Partial<Record<AccessKey, Partial<AccessItem>>> } = {}): Place {
  const { set, ...rest } = patch;
  const access = Object.fromEntries(ACCESS_KEYS.map((k) => [k, { ...ok, ...(set?.[k] ?? {}) }])) as Record<AccessKey, AccessItem>;
  return {
    id,
    name_ko: `[샘플] ${id}`,
    region: id.startsWith("SC") ? "속초" : id.startsWith("DH") ? "동해" : "강릉",
    category: "역사·문화",
    lat: 37.77,
    lng: 128.89,
    phone: "000-0000-0000",
    hours: { summer: { open: "09:00", close: "18:00", last_entry: "17:00" }, winter: { open: "09:00", close: "17:00", last_entry: "16:00" } },
    stay_min: 40,
    stay_max: 60,
    parking_to_entrance: { meters: 100 },
    route_length: { meters: 200 },
    access,
    ...rest,
  };
}

const unknown = (ask: string): Partial<AccessItem> => ({ value: "모름", ask });

/** 시나리오에 쓰는 장소 10곳 */
export function scenarioPlaces(): Place[] {
  return [
    makePlace("GN91", { lat: 37.771, lng: 128.89, hours: { summer: { open: "09:00", close: "18:00", last_entry: "17:00" }, winter: { open: "09:00", close: "17:00", last_entry: "16:00" }, closed_weekdays: ["월"] } }),
    makePlace("GN92", { lat: 37.772, lng: 128.9, category: "전시·박물관", set: { disabled_parking: { value: "불가" } } }),
    makePlace("GN93", { lat: 37.79, lng: 128.91, category: "바다·해변", set: { step_free_entrance: { value: "불가" } } }),
    makePlace("GN94", { lat: 37.785, lng: 128.92, category: "바다·해변", hours: { always_open: true }, set: { surface: unknown("해변 데크까지 휠체어로 갈 수 있나요?") } }),
    makePlace("GN95", { lat: 37.76, lng: 128.88, category: "자연·산책", route_length: { meters: 600 } }),
    makePlace("GN96", { lat: 37.775, lng: 128.895, category: "전시·박물관", set: {} }),
    makePlace("GN97", { lat: 37.78, lng: 128.88, category: "전시·박물관", hours: { summer: { open: "09:00", close: "18:00", last_entry: "17:30" }, winter: { open: "10:00", close: "16:00", last_entry: "15:00" } }, set: { diaper_nursing: { value: "불가" } } }),
    makePlace("SC91", { lat: 38.205, lng: 128.59, category: "바다·해변", hours: { always_open: true } }),
    makePlace("SC92", { lat: 38.19, lng: 128.6, category: "전시·박물관" }),
    makePlace("DH91", { lat: 37.49, lng: 129.12, category: "자연·산책", hours: { always_open: true } }),
  ];
}

export function input(patch: Partial<PlanInput>): PlanInput {
  return {
    ...EMPTY_PLAN,
    startDate: "2026-11-21",
    endDate: "2026-11-21",
    arrival: "gangneung-station",
    transport: "taxi",
    startTime: "10:00",
    endTime: "17:00",
    categories: ["역사·문화"],
    ...patch,
  };
}
