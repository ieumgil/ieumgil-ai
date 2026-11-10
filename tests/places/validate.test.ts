import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validatePlaces } from "@/lib/places/validate";
import { loadSamplePlaces } from "../helpers";

const messagesOf = (data: unknown) =>
  validatePlaces(data)
    .issues.map((i) => i.message)
    .join("\n");

describe("장소 데이터 검사", () => {
  it("샘플 데이터는 통과한다", () => {
    expect(validatePlaces(loadSamplePlaces())).toEqual({ ok: true, issues: [] });
  });

  it("실제 데이터(data/places.json)는 통과한다", () => {
    const real = JSON.parse(readFileSync(resolve(__dirname, "../../data/places.json"), "utf8"));
    const result = validatePlaces(real);
    expect(result.issues).toEqual([]);
  });

  describe("'모름'은 숨기지 않고 확인할 방법을 준다 (원칙 2)", () => {
    it("'모름'이어도 질문이 있으면 통과한다", () => {
      const places = loadSamplePlaces();
      places[1].access.elevator = { value: "모름", ask: "2층 전시실에 엘리베이터로 갈 수 있나요?", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10" };
      expect(validatePlaces(places)).toEqual({ ok: true, issues: [] });
    });

    it("'모름'인데 질문이 없으면 실패한다", () => {
      const places = loadSamplePlaces();
      places[1].access.elevator = { value: "모름", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10" };
      const result = validatePlaces(places);
      expect(result.ok).toBe(false);
      expect(result.issues[0]).toMatchObject({ placeId: "GN92", path: "[1].access.elevator" });
    });

    it("질문이 빈 문자열이어도 실패한다", () => {
      const places = loadSamplePlaces();
      places[1].access.elevator = { value: "모름", ask: "  ", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10" };
      expect(messagesOf(places)).toContain("질문");
    });

    it("예전 값 '미확인'은 거부한다", () => {
      const places = loadSamplePlaces();
      (places[1].access.elevator as { value: string }).value = "미확인";
      expect(messagesOf(places)).toContain("모름");
    });

    it("전화번호가 없으면 실패한다", () => {
      const places = loadSamplePlaces();
      delete (places[0] as { phone?: string }).phone;
      expect(messagesOf(places)).toContain("phone");
    });

    it("전화번호에 숫자가 없으면 실패한다", () => {
      const places = loadSamplePlaces();
      places[1].phone = "문의 바람";
      expect(messagesOf(places)).toContain("전화번호");
    });

    it("운영시간을 모르면 질문이 있어야 한다", () => {
      const places = loadSamplePlaces();
      places[0].hours = { closed_weekdays: ["월"] };
      expect(messagesOf(places)).toContain("운영시간");
      places[0].hours.ask = "평일 몇 시부터 몇 시까지 여나요?";
      expect(validatePlaces(places).ok).toBe(true);
    });
  });

  describe("AI 정리 값의 근거", () => {
    it("AI가 정리한 값(모름 제외)은 근거 id가 있어야 한다", () => {
      const places = loadSamplePlaces();
      places[0].access.slope = { value: "가능", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10", evidence: [] };
      expect(validatePlaces(places).issues[0]).toMatchObject({ placeId: "GN91", path: "[0].access.slope" });
    });

    it("사람이 확인한 값은 근거 id가 없어도 된다", () => {
      const places = loadSamplePlaces();
      places[0].access.slope = { value: "가능", grade: "human", method: "전화 확인", verified_at: "2026-11-12" };
      expect(validatePlaces(places).ok).toBe(true);
    });

    it("등급(ai/human)이 없으면 실패한다", () => {
      const places = loadSamplePlaces();
      delete (places[0].access.slope as { grade?: string }).grade;
      expect(validatePlaces(places).ok).toBe(false);
    });

    it("도착 후 동선(on_site)도 근거 id가 있어야 한다", () => {
      const places = loadSamplePlaces();
      places[0].on_site = { text: "주차장에서 경사로로 정문", evidence: [], grade: "ai" };
      expect(messagesOf(places)).toContain("동선");
    });
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
    delete (places[0].access as Partial<(typeof places)[0]["access"]>).accessible_toilet;
    expect(validatePlaces(places).ok).toBe(false);
  });

  it("조사표의 옛 카테고리(바다·자연)는 거부한다", () => {
    const places = loadSamplePlaces();
    (places[2] as { category: string }).category = "바다·자연";
    const result = validatePlaces(places);
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain("바다·해변");
  });

  it("id는 세 자리 번호까지 받는다(강릉 100곳 이상)", () => {
    const places = loadSamplePlaces();
    places[0].id = "GN120";
    expect(validatePlaces(places).ok).toBe(true);
  });

  it("id 중복, 지역과 다른 접두어, 관광공사 contentid 중복을 잡는다", () => {
    const places = loadSamplePlaces();
    places[1].id = "GN91";
    places[2].region = "속초";
    places[2].tour_content_id = places[0].tour_content_id;
    const messages = messagesOf(places);
    expect(messages).toContain("중복");
    expect(messages).toContain("SC로 시작");
    expect(messages).toContain("contentid");
  });

  it("체류 범위, 운영시간, 입장 마감 오류를 잡는다", () => {
    const places = loadSamplePlaces();
    places[0].stay_min = 90;
    places[0].hours.winter = { open: "18:00", close: "09:00" };
    places[1].hours.summer = { open: "10:00", close: "19:00", last_entry: "20:00" };
    const messages = messagesOf(places);
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
