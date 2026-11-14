// 관광지 한 줄 소개(AI가 미리 읽어 정리, 둘러보기 화면용). 만드는 곳: scripts/ai/summarize-places.ts
// 원칙: 관광공사 문단(개요·소개)에 없는 내용을 쓰지 않는다 → 근거 id가 그 장소의 소개 문단이어야 하고,
// '볼 거리'는 낱말이 원문에 실제로 있어야 남긴다. 검사를 못 통과하면 요약을 버리고 화면은 원문 첫 문장을 쓴다.

export interface PlaceSummary {
  /** 어떤 곳인지 한 문장(쉬운 말) */
  summary: string;
  /** 볼 거리·할 거리 0~3개(짧은 말) */
  highlights: string[];
  /** 근거 문단 id(관광공사 개요·소개) */
  evidence: string[];
}

export interface Paragraph {
  id: string;
  text: string;
}

/** 소개로 쓸 수 있는 문단(개요·소개 안내) */
export const isIntroParagraph = (id: string) => id.startsWith("overview") || id.startsWith("info-") || id.startsWith("intro-");

const squash = (s: string) => s.replace(/[\s·,.()'"“”‘’\-~]/g, "");

/** 낱말(두 글자 이상)마다 앞 두 글자가 원문에 있는지 — 원문에 없는 시설·볼 거리를 지어내지 않게 */
export function grounded(phrase: string, source: string): boolean {
  const src = squash(source);
  const words = phrase.split(/\s+/).map(squash).filter((w) => w.length >= 2);
  return words.length > 0 && words.every((w) => src.includes(w.slice(0, 2)));
}

/** 문장의 낱말(두 글자 이상) 중 앞 두 글자가 원문에 있는 비율 */
export function groundedRatio(sentence: string, source: string): number {
  const src = squash(source);
  const words = sentence.split(/\s+/).map(squash).filter((w) => w.length >= 2);
  return words.length === 0 ? 0 : words.filter((w) => src.includes(w.slice(0, 2))).length / words.length;
}

const MAX_SUMMARY = 60;
const MAX_HIGHLIGHT = 18;

/** AI 답 검사: 근거가 그 장소 소개 문단인지, 길이, 볼 거리가 원문에 있는지. 못 쓰면 null */
export function checkSummary(raw: PlaceSummary, paragraphs: Paragraph[]): PlaceSummary | null {
  const allowed = new Map(paragraphs.filter((p) => isIntroParagraph(p.id)).map((p) => [p.id, p.text]));
  const evidence = [...new Set(raw.evidence)].filter((id) => allowed.has(id));
  if (evidence.length === 0) return null;
  const summary = raw.summary.trim();
  if (!summary || summary.length > MAX_SUMMARY) return null;
  const source = evidence.map((id) => allowed.get(id)).join(" ");
  // 요약 문장: 낱말의 절반 이상이 원문에 있어야(조사·어미가 붙어 있어 앞 두 글자로 본다). 아니면 지어낸 문장으로 보고 버린다
  if (groundedRatio(summary, [...allowed.values()].join(" ")) < 0.5) return null;
  const highlights = raw.highlights
    .map((h) => h.trim())
    .filter((h) => h && h.length <= MAX_HIGHLIGHT && grounded(h, source))
    .slice(0, 3);
  return { summary, highlights, evidence };
}

/** 요약이 없을 때: 개요 첫 문장(길면 자름) */
export function firstSentence(paragraphs: Paragraph[], max = 80): string {
  const text = paragraphs.find((p) => p.id.startsWith("overview"))?.text ?? "";
  const s = text.split(/(?<=[.다])\s/)[0]?.trim() ?? "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
