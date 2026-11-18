// 층이 없는 시설의 엘리베이터: 분류 규칙과 data/places.json 결과를 함께 본다.
// '허난설헌 생가터'에 "엘리베이터가 있나요?"가 붙던 문제(11/18): 생가·고택·거리·마을처럼 층이 없는 곳은 '가능',
// 그래도 '모름'인 곳은 "층이 나뉜 곳이 있나요? 있다면 엘리베이터로 오갈 수 있나요?"로 묻는다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_ASK } from "@/lib/places/asks";
import { classCodeOf, isSingleLevelClass } from "@/lib/places/floors";

type Item = { value: string; ask?: string; note?: string; grade?: string; evidence?: string[] };
type Place = { id: string; name_ko: string; access: Record<string, Item> };
const places = JSON.parse(readFileSync("data/places.json", "utf8")) as Place[];
const evidence = JSON.parse(readFileSync("data/evidence.json", "utf8")) as Record<string, { id: string; text: string }[]>;
const codeOf = (id: string) => classCodeOf(evidence[id]?.find((e) => e.id === "class-1")?.text);

describe("isSingleLevelClass", () => {
  it("생가·고택·고궁·유적지·탑·불상·다리·동상·거리·마을·체험마을은 층이 없는 시설", () => {
    for (const c of ["HS010500", "HS010400", "HS010100", "HS011200", "HS020100", "HS020300", "VE010300", "VE010500", "VE040100", "VE040200", "EX030100", "EX030200", "EX030300"]) {
      expect(isSingleLevelClass(c), c).toBe(true);
    }
  });
  it("박물관·전시관·미술관·절·성당·등대·전망대·기차역은 넣지 않는다(층·계단이 있을 수 있음)", () => {
    for (const c of ["VE070100", "VE070300", "VE070600", "HS030100", "HS030400", "VE010800", "VE010200", "VE110200", "VE010100"]) {
      expect(isSingleLevelClass(c), c).toBe(false);
    }
  });
  it("classCodeOf는 근거 글에서 코드를 꺼낸다", () => {
    expect(classCodeOf("역사관광 > 역사유적지 > 생가 (HS010500)")).toBe("HS010500");
    expect(classCodeOf("자연관광 > 자연공원 > 생태관광지 (NA040500) · 야외 시설")).toBe("NA040500");
    expect(classCodeOf(undefined)).toBeNull();
  });
});

describe("data/places.json 엘리베이터", () => {
  it("층이 없는 시설은 엘리베이터가 '모름'이 아니다(사람 확인 값은 그대로)", () => {
    const bad = places.filter((p) => {
      const code = codeOf(p.id);
      const e = p.access.elevator;
      return code && isSingleLevelClass(code) && e.value === "모름" && e.grade !== "human";
    });
    expect(bad.map((p) => `${p.id} ${p.name_ko}`)).toEqual([]);
  });

  it("허난설헌 생가터는 엘리베이터 '가능'(층이 없는 시설, 근거 class-1)", () => {
    const p = places.find((x) => x.name_ko === "허난설헌 생가터")!;
    expect(p.access.elevator).toMatchObject({ value: "가능", evidence: ["class-1"] });
    expect(p.access.elevator.note).toContain("층이 없는");
  });

  it("엘리베이터가 '모름'이면 질문은 '층이 나뉜 곳이 있나요? 있다면 엘리베이터로…'", () => {
    const off = places.filter((p) => p.access.elevator.value === "모름" && p.access.elevator.ask !== DEFAULT_ASK.elevator);
    expect(off.map((p) => `${p.id} ${p.access.elevator.ask}`)).toEqual([]);
  });
});
