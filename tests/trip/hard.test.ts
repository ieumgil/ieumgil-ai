// 어려운 곳 목록과 대안(기획 '어려운 곳과 대안'): 취향·꼭 가고 싶은 곳·대표 관광지 중 이 조건으로 어려운 곳을 이유와 함께,
// 대안은 같은 분야의 가까운 갈 만한 곳 하나(코드가 고름, 이유는 ② 판단 이유 그대로). AI를 더 부르지 않는다.
import { describe, expect, it } from "vitest";
import { pickHardPlaces, type HardSource } from "@/lib/trip/hard";
import type { Place } from "@/lib/types";

const place = (id: string, category: Place["category"], region: Place["region"], lat: number, lng = 128.9): Place =>
  ({ id, name_ko: id, category, region, lat, lng }) as unknown as Place;

const sea = place("SEA", "바다·해변", "강릉", 37.8);
const museum = place("MUS", "전시·박물관", "강릉", 37.75);
const fam = place("FAM", "자연·산책", "강릉", 37.7);
const far = place("FAR", "바다·해변", "속초", 38.2);
const must = place("MUST", "시장·먹거리", "동해", 37.5);
const ai = place("AIX", "바다·해변", "강릉", 37.79);

const seaAltNear = place("ALT1", "바다·해변", "강릉", 37.801);
const seaAltFar = place("ALT2", "바다·해변", "강릉", 37.9);
const seaAltCheck = place("ALT3", "바다·해변", "강릉", 37.8005);

const src = (over: Partial<HardSource> = {}): HardSource => ({
  excluded: [
    { place: sea, reasons: ["장애인 화장실: 어려워요"], mustVisit: false },
    { place: museum, reasons: ["여행 날짜에 쉬어요(월요일 휴무)"], mustVisit: false },
    { place: fam, reasons: ["진입로: 어려워요"], mustVisit: false },
    { place: far, reasons: ["진입로: 어려워요"], mustVisit: false },
    { place: must, reasons: ["엘리베이터: 어려워요"], mustVisit: true },
  ],
  judgedUnfit: [{ place: ai, reasons: ["모래사장이라 휠체어로 들어가기 어려워요"] }],
  pool: [
    { place: seaAltFar, verdict: "적합" },
    { place: seaAltCheck, verdict: "확인 필요" },
    { place: seaAltNear, verdict: "적합" },
  ],
  categories: ["바다·해변", "전시·박물관"],
  featured: new Set(["FAM"]),
  regions: new Set(["강릉"]),
  inPlan: new Set(),
  ...over,
});

describe("어려운 곳 목록", () => {
  it("꼭 가고 싶은 곳(지역 밖이어도) → 대표 관광지 → 좋아하는 분야 순, 여행 지역 밖·관심 없는 곳은 뺀다", () => {
    const list = pickHardPlaces(src());
    expect(list.map((h) => h.placeId)).toEqual(["MUST", "FAM", "SEA", "MUS", "AIX"]);
  });

  it("이유와 종류(조건·휴무·AI 판단)를 함께 준다", () => {
    const byId = new Map(pickHardPlaces(src()).map((h) => [h.placeId, h]));
    expect(byId.get("SEA")).toMatchObject({ kind: "조건", reasons: ["장애인 화장실: 어려워요"] });
    expect(byId.get("MUS")!.kind).toBe("휴무");
    expect(byId.get("AIX")).toMatchObject({ kind: "AI 판단", reasons: ["모래사장이라 휠체어로 들어가기 어려워요"] });
  });

  it("최대 개수를 넘기지 않는다", () => {
    expect(pickHardPlaces(src(), 2)).toHaveLength(2);
  });
});

describe("대안", () => {
  it("같은 분야에서 적합·주의를 먼저, 그중 가까운 곳 하나", () => {
    const sea = pickHardPlaces(src()).find((h) => h.placeId === "SEA")!;
    expect(sea.altId).toBe("ALT1");
  });

  it("일정에 이미 있는 곳은 대안이 아니고, 15km 넘게 먼 곳뿐이면 대안 없음", () => {
    const sea = pickHardPlaces(src({ inPlan: new Set(["ALT1", "ALT3"]) })).find((h) => h.placeId === "SEA")!;
    expect(sea.altId).toBe("ALT2");
    const museum = pickHardPlaces(src()).find((h) => h.placeId === "MUS")!;
    expect(museum.altId).toBeUndefined(); // 같은 분야 후보 없음
    const none = pickHardPlaces(src({ pool: [{ place: place("FARALT", "바다·해변", "강릉", 38.1), verdict: "적합" }] })).find((h) => h.placeId === "SEA")!;
    expect(none.altId).toBeUndefined();
  });

  it("적합·주의 대안이 없으면 확인 필요라도 대안으로 준다", () => {
    const sea = pickHardPlaces(src({ pool: [{ place: seaAltCheck, verdict: "확인 필요" }] })).find((h) => h.placeId === "SEA")!;
    expect(sea.altId).toBe("ALT3");
  });
});
