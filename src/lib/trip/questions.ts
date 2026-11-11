// 출발 전 전화로 물어볼 것 정리(코드). AI 질문과 안전 하한 질문이 같은 내용을 다른 말로 물을 때가 있어
// ("장애인 화장실이 구비되어 있나요?" / "장애인 화장실이 있나요?") 장소마다 주제로 묶어 하나만 남긴다.
// 주제를 모르는 질문은 글자 그대로 비교해 중복만 뺀다.

import type { OptionView } from "./view";

const TOPICS: [string, RegExp][] = [
  ["toilet", /화장실/],
  ["elevator", /엘리베이터|승강기/],
  ["surface", /노면|포장|재질|모래|자갈|데크/],
  ["slope", /경사|오르막|비탈/],
  ["parking", /주차/],
  ["nursing", /수유|기저귀/],
  ["entrance", /출입구|입구|턱|계단|단차|진입/],
  ["distance", /몇\s*m|거리|동선/],
  ["rest", /쉴\s*곳|벤치|쉼터/],
  ["rental", /대여/],
];

function topicOf(q: string): string {
  const hit = TOPICS.find(([, re]) => re.test(q));
  return hit ? hit[0] : `text:${q.replace(/\s+/g, "")}`;
}

/** 장소별 질문(주제가 같으면 먼저 나온 것 하나만) */
export function questionsByPlace(o: Pick<OptionView, "checkBeforeGo">): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const seen = new Map<string, Set<string>>();
  for (const { placeId, question } of o.checkBeforeGo) {
    const topics = seen.get(placeId) ?? new Set<string>();
    const t = topicOf(question);
    if (topics.has(t)) continue;
    topics.add(t);
    seen.set(placeId, topics);
    out.set(placeId, [...(out.get(placeId) ?? []), question]);
  }
  return out;
}

/** 일정 순서대로, 전화로 물어볼 것이 있는 장소 id */
export function callPlaces(o: Pick<OptionView, "checkBeforeGo" | "days">): string[] {
  const qs = questionsByPlace(o);
  const order = o.days.flatMap((d) => d.items.flatMap((i) => (i.kind === "visit" ? [i.placeId] : [])));
  return order.filter((id) => (qs.get(id)?.length ?? 0) > 0);
}
