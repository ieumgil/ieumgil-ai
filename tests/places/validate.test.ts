import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validatePlaces } from "@/lib/places/validate";
import { loadSamplePlaces } from "../helpers";

describe("장소 데이터 검사", () => {
  it("샘플 데이터는 통과한다", () => {
    expect(validatePlaces(loadSamplePlaces())).toEqual({ ok: true, issues: [] });
  });

  it("실제 데이터(data/places.json)는 통과한다", () => {
    const real = JSON.parse(readFileSync(resolve(__dirname, "../../data/places.json"), "utf8"));
    const result = validatePlaces(real);
    expect(result.issues).toEqual([]);
  });

  it("미확인 값이 하나라도 있으면 실패한다", () => {
    const places = loadSamplePlaces();
    places[1].access.elevator.value = "미확인";
    const result = validatePlaces(places);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({ placeId: "GN92", path: "[1].access.elevator.value" }),
    ]);
  });

  it("부분가능인데 메모가 없으면 실패한다", () => {
    const places = loadSamplePlaces();
    delete places[0].access.surface.note;
    const result = validatePlaces(places);
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({ placeId: "GN91", path: "[0].access.surface" });
  });

  it("access 항목이 빠지면 실패한다", () => {
    const places = loadSamplePlaces();
    delete (places[0].access as Partial<typeof places[0]["access"]>).accessible_toilet;
    expect(validatePlaces(places).ok).toBe(false);
  });

  it("조사표의 옛 카테고리(바다·자연)는 거부한다", () => {
    const places = loadSamplePlaces();
    (places[2] as { category: string }).category = "바다·자연";
    const result = validatePlaces(places);
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain("바다·해변");
  });

  it("id 중복, 지역과 다른 접두어를 잡는다", () => {
    const places = loadSamplePlaces();
    places[1].id = "GN91";
    places[2].region = "속초";
    const messages = validatePlaces(places).issues.map((i) => i.message).join("\n");
    expect(messages).toContain("중복");
    expect(messages).toContain("SC로 시작");
  });

  it("체류 범위, 운영시간, 입장 마감 오류를 잡는다", () => {
    const places = loadSamplePlaces();
    places[0].stay_min = 90;
    places[0].hours.winter = { open: "18:00", close: "09:00" };
    places[1].hours.summer.last_entry = "20:00";
    const messages = validatePlaces(places).issues.map((i) => i.message).join("\n");
    expect(messages).toContain("권장 체류");
    expect(messages).toContain("여는 시각");
    expect(messages).toContain("입장 마감");
  });

  it("영동권 밖 좌표(위도·경도 뒤바뀜)를 잡는다", () => {
    const places = loadSamplePlaces();
    [places[0].lat, places[0].lng] = [places[0].lng, places[0].lat];
    expect(validatePlaces(places).issues[0].message).toContain("영동권 밖");
  });

  it("없는 장소를 대안으로 넣으면 실패한다", () => {
    const places = loadSamplePlaces();
    places[2].alternatives = ["GN99"];
    expect(validatePlaces(places).issues[0].message).toContain("GN99");
  });
});
