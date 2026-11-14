// 관광지 한 줄 소개(AI): 근거는 그 장소 소개 문단만, 원문에 없는 볼 거리는 버리고, 지어낸 문장이면 요약 전체를 버린다.
import { describe, expect, it } from "vitest";
import { checkSummary, firstSentence, grounded } from "@/lib/places/summary";

const paragraphs = [
  { id: "route-1", text: "출입구까지 경사로" },
  { id: "overview-1", text: "율곡 이이가 태어난 오죽헌은 조선 초기 건축물로 보물로 지정되었다. 경내에는 율곡기념관과 사랑채가 있다." },
  { id: "overview-2", text: "시립박물관은 영동지방의 민속자료와 향토 유물을 전시한다." },
];

describe("관광지 한 줄 소개 검사", () => {
  it("원문에 있는 낱말이면 통과(앞 두 글자 기준이라 조사가 붙어도 된다)", () => {
    expect(grounded("율곡기념관", paragraphs[1].text)).toBe(true);
    expect(grounded("향토 유물", paragraphs[2].text)).toBe(true);
    expect(grounded("케이블카", paragraphs[1].text)).toBe(false);
  });

  it("근거는 소개 문단만, 원문에 없는 볼 거리는 빼고 3개까지", () => {
    const r = checkSummary(
      { summary: "율곡 이이가 태어난 조선 건축물과 향토 박물관이에요", highlights: ["율곡기념관", "케이블카 전망", "사랑채", "향토 유물", "민속자료"], evidence: ["overview-1", "overview-2", "route-1"] },
      paragraphs,
    );
    expect(r?.evidence).toEqual(["overview-1", "overview-2"]);
    expect(r?.highlights).toEqual(["율곡기념관", "사랑채", "향토 유물"]);
  });

  it("근거가 소개 문단이 아니거나, 너무 길거나, 원문과 동떨어진 문장이면 버린다(null)", () => {
    expect(checkSummary({ summary: "율곡 이이가 태어난 곳이에요", highlights: [], evidence: ["route-1"] }, paragraphs)).toBeNull();
    expect(checkSummary({ summary: "율곡".repeat(40), highlights: [], evidence: ["overview-1"] }, paragraphs)).toBeNull();
    expect(checkSummary({ summary: "바다 위 케이블카와 스카이워크 전망대가 있는 해변 공원이에요", highlights: [], evidence: ["overview-1"] }, paragraphs)).toBeNull();
  });

  it("요약이 없을 때는 개요 첫 문장", () => {
    expect(firstSentence(paragraphs)).toBe("율곡 이이가 태어난 오죽헌은 조선 초기 건축물로 보물로 지정되었다.");
  });
});
