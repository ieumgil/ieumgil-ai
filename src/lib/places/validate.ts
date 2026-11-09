// 장소 데이터 검사. scripts/validate-places.ts(빌드 전)와 테스트가 함께 쓴다.
// 1단계: JSON Schema 형식 검사 / 2단계: 스키마로 표현하기 어려운 운영 규칙 검사.

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "../../../data/places.schema.json";
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

export function validatePlaces(data: unknown): ValidationResult {
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

  const ids = new Set<string>();
  const seen = new Set<string>();
  for (const p of places) {
    if (seen.has(p.id)) ids.add(p.id); // 중복 id 기록
    seen.add(p.id);
  }

  places.forEach((p, i) => {
    if (ids.has(p.id)) add(p, i, ".id", `id가 중복돼요: ${p.id}`);

    if (!p.id.startsWith(ID_PREFIX[p.region])) {
      add(p, i, ".id", `${p.region} 장소의 id는 ${ID_PREFIX[p.region]}로 시작해야 해요.`);
    }

    // '정보 없음' 금지 원칙
    for (const key of ACCESS_KEYS) {
      if (p.access[key].value === "미확인") {
        add(p, i, `.access.${key}.value`, "미확인 값이 남아 있어요. 조사하거나 후보에서 빼야 해요.");
      }
    }

    if (p.stay_min > p.stay_max) {
      add(p, i, ".stay_min", `권장 체류 최소(${p.stay_min}분)가 최대(${p.stay_max}분)보다 커요.`);
    }

    for (const season of ["summer", "winter"] as const) {
      const h = p.hours[season];
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
