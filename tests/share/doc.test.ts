// 공유 링크에 저장할 값(원칙 3·5): 고른 안의 장소·순서·체류·이유·주의·확인 질문과 날짜·유형·하루 틀만.
// 카카오 이동시간·시각·경로와 개인정보는 넣지 않는다. 서버는 형식·알려진 장소·크기를 검사하고, 여행 끝 + 7일(최대 30일)에 사라진다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkShareDoc, expiresAt, newShareId, SHARE_MAX_BYTES, toShareDoc } from "@/lib/share/doc";
import type { TripView } from "@/lib/trip/view";

const trip = JSON.parse(readFileSync(resolve(__dirname, "../e2e/fixtures/trip-view.json"), "utf8")) as TripView;
const option = trip.options[0];
const known = new Set(Object.keys(trip.placeData));

describe("공유할 값 만들기", () => {
  it("고른 안의 장소·순서·체류·이유와 하루 틀·유형만 담는다", () => {
    const doc = toShareDoc(trip, option);
    expect(doc.v).toBe(1);
    expect(doc.option.draft).toEqual(option.draft);
    expect(doc.frames).toEqual(trip.frames);
    expect(doc.input.travelers).toEqual(trip.input.travelers);
    const ids = option.draft.days.flatMap((d) => d.stops.map((s) => s.placeId));
    expect(Object.keys(doc.judgments).sort()).toEqual([...ids].sort());
    expect(doc.option.checkBeforeGo.every((q) => ids.includes(q.placeId))).toBe(true);
  });

  it("카카오 이동시간·시각·경로와 화면 계산 값은 넣지 않는다", () => {
    const text = JSON.stringify(toShareDoc(trip, option));
    for (const key of ["arriveMin", "departMin", "minutes", "travelMin", "path", "km", "estimated", "createdAt", "calls"]) {
      expect(text, key).not.toContain(`"${key}"`);
    }
  });
});

describe("서버 검사", () => {
  it("통과: 만든 그대로의 값", () => {
    expect(checkShareDoc(toShareDoc(trip, option), known)).toBeNull();
  });

  it("알려진 장소가 아니거나 형식이 틀리면 거절", () => {
    const doc = toShareDoc(trip, option);
    const bad = structuredClone(doc);
    bad.option.draft.days[0].stops[0].placeId = "XX99";
    expect(checkShareDoc(bad, known)).toMatch(/장소/);
    expect(checkShareDoc({ ...doc, v: 2 }, known)).not.toBeNull();
    expect(checkShareDoc({ ...doc, extra: "이름 홍길동" }, known)).not.toBeNull(); // 정해진 칸 말고는 받지 않음
    expect(checkShareDoc(null, known)).not.toBeNull();
  });

  it("너무 크면 거절", () => {
    const doc = toShareDoc(trip, option);
    const big = structuredClone(doc);
    big.option.summary = "가".repeat(SHARE_MAX_BYTES);
    expect(checkShareDoc(big, known)).not.toBeNull();
  });
});

describe("사라지는 날·주소", () => {
  it("여행 마지막 날 + 7일 끝(한국 시각), 그보다 늦어도 만든 날부터 30일까지", () => {
    const now = new Date("2026-11-14T03:00:00Z");
    expect(expiresAt("2026-11-22", now).toISOString()).toBe("2026-11-29T15:00:00.000Z"); // 11/29 24:00 KST
    expect(expiresAt("2027-03-01", now).toISOString()).toBe(new Date(now.getTime() + 30 * 86_400_000).toISOString());
  });

  it("공유 주소 id는 추측하기 어려운 10글자", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newShareId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9A-Za-z]{10}$/);
  });
});
