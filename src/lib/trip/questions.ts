// 출발 전 확인할 것 정리(코드). AI 질문과 안전 하한 질문이 같은 내용을 다른 말로 물을 때가 있어
// ("장애인 화장실이 구비되어 있나요?" / "장애인 화장실이 있나요?") 장소마다 주제로 묶어 하나만 남긴다.
// 주제를 모르는 질문은 글자 그대로 비교해 중복만 뺀다.
//
// 전화로 물을 것과 가서 볼 것을 나눈다(11/14): 엘리베이터·화장실·장애인 주차·출입구처럼 직원이 바로 답할 수 있고
// 가서 안 되면 되돌아와야 하는 것만 전화로 묻는다. 노면·경사·쉴 곳은 직원도 답하기 어렵고 도착하면 눈으로 보이므로
// '모름'을 숨기지 않되 확인 방법을 '가서 보기'로 주고, 문장은 코드가 정해 둔 쉬운 안내로 바꾼다.

import type { OptionView } from "./view";

const TOPICS: [string, RegExp][] = [
  ["toilet", /화장실/],
  ["elevator", /엘리베이터|승강기/],
  ["entrance", /출입구|경사로|턱|계단|단차|진입/],
  ["surface", /노면|포장|재질|모래|자갈|데크|바닥|흙길/],
  ["slope", /경사|오르막|비탈/],
  ["distance", /몇\s*m|거리|동선|몇\s*분/],
  ["parking", /주차/],
  ["nursing", /수유|기저귀/],
  ["rest", /쉴\s*곳|벤치|쉼터/],
  ["rental", /대여|빌릴/],
];

/** 가서 보면 아는 주제와 그 안내(질문 대신 보여줄 문장) */
const ON_SITE: Record<string, string> = {
  surface: "바닥: 모래·자갈·흙길이 보이면 포장길이나 데크로만 다니세요.",
  slope: "경사: 급한 오르막·내리막이 보이면 무리하지 말고 돌아가거나 함께 간 사람의 도움을 받으세요.",
  rest: "쉴 곳: 도착하면 벤치나 쉼터가 어디 있는지 먼저 봐 두세요.",
};

/** 가서 보면 아는 접근성 항목('모름'이어도 전화로 확인할 것으로 세지 않는다) */
export const ON_SITE_KEYS: ReadonlySet<string> = new Set(["surface", "slope", "rest_area"]);

function topicOf(q: string): string {
  const hit = TOPICS.find(([, re]) => re.test(q));
  return hit ? hit[0] : `text:${q.replace(/\s+/g, "")}`;
}

/** 전화로 물을 만한 질문인가(가서 보면 아는 노면·경사·쉴 곳이 아니면 전화) */
export function isPhoneQuestion(q: string): boolean {
  return !(topicOf(q) in ON_SITE);
}

function byPlace(o: Pick<OptionView, "checkBeforeGo">, pick: (topic: string, question: string) => string | null): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const seen = new Map<string, Set<string>>();
  for (const { placeId, question } of o.checkBeforeGo) {
    const topics = seen.get(placeId) ?? new Set<string>();
    const t = topicOf(question);
    if (topics.has(t)) continue;
    const text = pick(t, question);
    if (text === null) continue;
    topics.add(t);
    seen.set(placeId, topics);
    out.set(placeId, [...(out.get(placeId) ?? []), text]);
  }
  return out;
}

/** 장소별 전화로 물어볼 질문(주제가 같으면 먼저 나온 것 하나만) */
export function questionsByPlace(o: Pick<OptionView, "checkBeforeGo">): Map<string, string[]> {
  return byPlace(o, (t, q) => (t in ON_SITE ? null : q));
}

/** 장소별 가서 볼 것(주제마다 정해 둔 안내 한 줄) */
export function onSiteByPlace(o: Pick<OptionView, "checkBeforeGo">): Map<string, string[]> {
  return byPlace(o, (t) => ON_SITE[t] ?? null);
}

/** 일정 순서대로, 전화로 물어볼 것이 있는 장소 id */
export function callPlaces(o: Pick<OptionView, "checkBeforeGo" | "days">): string[] {
  const qs = questionsByPlace(o);
  const order = o.days.flatMap((d) => d.items.flatMap((i) => (i.kind === "visit" ? [i.placeId] : [])));
  return order.filter((id) => (qs.get(id)?.length ?? 0) > 0);
}
