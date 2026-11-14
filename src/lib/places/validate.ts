// 장소 데이터 검사. scripts/validate-places.ts(빌드 전)와 테스트가 함께 쓴다.
// 1단계: JSON Schema 형식 검사 / 2단계: 스키마로 표현하기 어려운 운영 규칙 검사.
// 공공데이터 값(grade public)은 '가능'으로만 올릴 수 있고, public- 근거 id와 원본 주소(source_url)가 있어야 한다.
// 근거 목록(data/evidence.json)을 함께 주면 근거 id가 실제 문단에 있는지도 본다.
// 공공데이터 요약(data/public/restrooms.json)까지 주면 public- 근거 문단이 그 요약이 만드는 글과 같은지(오래되지 않았는지)도 본다.

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "../../../data/places.schema.json";
import { publicParagraphs, type RestroomsFile } from "../public/restrooms";
import { isPublicEvidenceId } from "../public/source";
import { ACCESS_KEYS, type Place } from "../types";

export interface ValidationIssue {
  /** 문제가 난 장소 id(알 수 있을 때) */
  placeId?: string;
  /** 예: "[0].access.elevator.value" */
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const schemaValidate = ajv.compile(schema);

const ID_PREFIX: Record<Place["region"], string> = {
  강릉: "GN",
  속초: "SC",
  동해: "DH",
};

// 영동권(강릉·속초·동해)을 넉넉히 감싼 범위. 위도·경도를 바꿔 적는 실수를 잡는다.
const BOUNDS = { latMin: 37.3, latMax: 38.4, lngMin: 128.4, lngMax: 129.3 };

/** "/0/access/elevator/value" → "[0].access.elevator.value" */
function toPath(pointer: string): string {
  return pointer
    .split("/")
    .slice(1)
    .map((seg) => (/^\d+$/.test(seg) ? `[${seg}]` : `.${seg}`))
    .join("")
    .replace(/^\./, "");
}

function idAt(data: unknown, pointer: string): string | undefined {
  const index = Number(pointer.split("/")[1]);
  if (!Array.isArray(data) || Number.isNaN(index)) return undefined;
  const item = data[index] as { id?: unknown } | undefined;
  return typeof item?.id === "string" ? item.id : undefined;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 장소 id → 근거 문단 목록(data/evidence.json의 모양). id만 쓰고, 공공데이터 문단이 최신인지 볼 때만 label·text도 쓴다 */
export type EvidenceIds = Record<string, { id: string; label?: string; text?: string }[]>;

export const STALE_PUBLIC_MESSAGE =
  "공공데이터 근거 문단(data/evidence.json의 public-…)이 data/public/restrooms.json이 만드는 글과 달라요. 근거 문단이 오래된 것이니 npm run data:build 를 먼저 다시 실행하고, 이어서 npm run data:merge 를 실행해 주세요.";

export function validatePlaces(data: unknown, evidence?: EvidenceIds, publicRestrooms?: Pick<RestroomsFile, "places">): ValidationResult {
  if (!schemaValidate(data)) {
    const issues = (schemaValidate.errors ?? []).map((err) => {
      const path = toPath(err.instancePath) || "(루트)";
      const extra =
        err.keyword === "enum"
          ? ` (허용 값: ${(err.params as { allowedValues: unknown[] }).allowedValues.join(", ")})`
          : "";
      return {
        placeId: idAt(data, err.instancePath),
        path,
        message: `형식 오류: ${err.message ?? err.keyword}${extra}`,
      };
    });
    return { ok: false, issues };
  }

  const places = data as Place[];
  const issues: ValidationIssue[] = [];
  const add = (place: Place, i: number, sub: string, message: string) =>
    issues.push({ placeId: place.id, path: `[${i}]${sub}`, message });

  const dupIds = new Set<string>();
  const seen = new Set<string>();
  const dupContent = new Set<string>();
  const seenContent = new Set<string>();
  for (const p of places) {
    if (seen.has(p.id)) dupIds.add(p.id);
    seen.add(p.id);
    if (p.tour_content_id) {
      if (seenContent.has(p.tour_content_id)) dupContent.add(p.tour_content_id);
      seenContent.add(p.tour_content_id);
    }
  }

  const blank = (s: string | undefined) => !s || s.trim() === "";

  places.forEach((p, i) => {
    if (dupIds.has(p.id)) add(p, i, ".id", `id가 중복돼요: ${p.id}`);
    if (p.tour_content_id && dupContent.has(p.tour_content_id)) {
      add(p, i, ".tour_content_id", `관광공사 contentid가 중복돼요: ${p.tour_content_id}`);
    }

    if (!p.id.startsWith(ID_PREFIX[p.region])) {
      add(p, i, ".id", `${p.region} 장소의 id는 ${ID_PREFIX[p.region]}로 시작해야 해요.`);
    }

    // 원칙 2: '모름'은 숨기지 않고 확인할 방법(질문 + 공식 전화번호)을 준다
    if (!/\d/.test(p.phone)) add(p, i, ".phone", `공식 전화번호가 필요해요(지금: "${p.phone}").`);

    for (const key of ACCESS_KEYS) {
      const a = p.access[key];
      if (a.value === "모름" && blank(a.ask)) {
        add(p, i, `.access.${key}`, "'모름'이면 출발 전에 물어볼 질문(ask)이 있어야 해요.");
      }
      if (a.value === "부분가능" && blank(a.note)) {
        add(p, i, `.access.${key}`, "부분가능이면 어떤 부분인지 메모(note)가 있어야 해요.");
      }
      // AI가 정리한 값은 근거 문장이 있어야 한다(근거 없는 판단 금지)
      if (a.grade === "ai" && a.value !== "모름" && !(a.evidence && a.evidence.length > 0)) {
        add(p, i, `.access.${key}`, "AI가 정리한 값에 근거 id(evidence)가 없어요. 근거가 없으면 '모름'이어야 해요.");
      }
      // 공공데이터 값: 가능으로만 올릴 수 있고(더 엄격하게 바꾸지 않음), 공공데이터 근거·원본 주소·방법이 있어야 한다
      if (a.grade === "public") {
        if (a.value !== "가능") add(p, i, `.access.${key}`, "공공데이터 값은 '가능'으로만 올릴 수 있어요(더 엄격하게 바꾸지 않음).");
        if (!(a.evidence && a.evidence.some(isPublicEvidenceId))) {
          add(p, i, `.access.${key}`, "공공데이터 값에 공공데이터 근거 id(public-…)가 없어요.");
        }
        if (blank(a.source_url)) add(p, i, `.access.${key}`, "공공데이터 값에 원본 주소(source_url)가 없어요.");
        if (a.method !== "공공데이터") add(p, i, `.access.${key}`, "공공데이터 값의 확인 방법(method)은 '공공데이터'여야 해요.");
      }
    }

    if (p.on_site && p.on_site.grade === "ai" && p.on_site.evidence.length === 0) {
      add(p, i, ".on_site", "도착 후 동선에 근거 id(evidence)가 없어요.");
    }

    // 근거 id는 그 장소의 근거 문단(data/evidence.json)에 실제로 있어야 한다(근거 목록을 줬을 때만 검사)
    if (evidence) {
      const known = new Set((evidence[p.id] ?? []).map((e) => e.id));
      const missing = (ids: readonly string[] | undefined, sub: string) => {
        for (const id of ids ?? []) {
          if (!known.has(id)) add(p, i, sub, `근거 id ${id}가 근거 문단(data/evidence.json)에 없어요.`);
        }
      };
      for (const key of ACCESS_KEYS) missing(p.access[key].evidence, `.access.${key}`);
      missing(p.hours.evidence, ".hours");
      missing(p.on_site?.evidence, ".on_site");

      // 공공데이터 근거 문단이 restrooms.json이 지금 만드는 글과 같아야 한다(화장실 목록이 바뀐 뒤 data:build를 빠뜨리면 번호가 다른 화장실을 가리킨다)
      if (publicRestrooms) {
        const shape = (e: { id: string; label?: string; text?: string }) => JSON.stringify([e.id, e.label, e.text]);
        const expected = publicParagraphs(publicRestrooms.places[p.id]).map(shape);
        const actual = (evidence[p.id] ?? []).filter((e) => isPublicEvidenceId(e.id)).map(shape);
        if (expected.length !== actual.length || expected.some((x, n) => x !== actual[n])) {
          add(p, i, ".evidence", STALE_PUBLIC_MESSAGE);
        }
      }
    }

    const h = p.hours;
    if (!h.summer && !h.winter && !h.always_open && blank(h.ask)) {
      add(p, i, ".hours", "운영시간을 모르면 물어볼 질문(hours.ask)이 있어야 해요.");
    }

    if (p.stay_min > p.stay_max) {
      add(p, i, ".stay_min", `권장 체류 최소(${p.stay_min}분)가 최대(${p.stay_max}분)보다 커요.`);
    }

    for (const season of ["summer", "winter"] as const) {
      const h = p.hours[season];
      if (!h) continue;
      if (minutes(h.open) >= minutes(h.close)) {
        add(p, i, `.hours.${season}`, `여는 시각(${h.open})이 닫는 시각(${h.close})보다 늦거나 같아요.`);
      }
      if (h.last_entry && (minutes(h.last_entry) < minutes(h.open) || minutes(h.last_entry) > minutes(h.close))) {
        add(p, i, `.hours.${season}.last_entry`, `입장 마감(${h.last_entry})이 운영시간 밖이에요.`);
      }
    }

    const coords: [string, number | undefined, number | undefined][] = [
      ["", p.lat, p.lng],
      [" (주차장)", p.parking_lat, p.parking_lng],
    ];
    for (const [label, lat, lng] of coords) {
      if (lat === undefined || lng === undefined) continue;
      if (lat < BOUNDS.latMin || lat > BOUNDS.latMax || lng < BOUNDS.lngMin || lng > BOUNDS.lngMax) {
        add(p, i, ".lat", `좌표${label}가 영동권 밖이에요 (${lat}, ${lng}). 위도·경도가 바뀌지 않았는지 확인해 주세요.`);
      }
    }

    if ((p.parking_lat === undefined) !== (p.parking_lng === undefined)) {
      add(p, i, ".parking_lat", "주차장 좌표는 위도·경도를 함께 넣어야 해요.");
    }

    for (const alt of p.alternatives ?? []) {
      if (alt === p.id) add(p, i, ".alternatives", "자기 자신을 대안으로 넣었어요.");
      else if (!seen.has(alt)) add(p, i, ".alternatives", `대안 장소 ${alt}가 데이터에 없어요.`);
    }
  });

  return { ok: issues.length === 0, issues };
}
