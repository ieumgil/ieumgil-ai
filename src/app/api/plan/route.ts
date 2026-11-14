// POST /api/plan — 입력 4단계 값으로 일정 2~3안을 만든다(docs/ai-plan.md v3 '일정 흐름').
// 응답은 줄마다 JSON 하나(NDJSON) 스트림: {"stage":"judge"} · {"stage":"log","text":…,"tone":…} · {"stage":"candidates","names":[…]}
// … 마지막에 {"stage":"done","trip":{…}} 또는 {"stage":"error","message":…}
// 서버에 아무것도 저장하지 않는다(개인정보·카카오 결과 저장 없음). 키는 서버 환경변수에서만 읽는다.

import evidence from "../../../../data/evidence.json";
import places from "../../../../data/places.json";
import { makeTrip, type TripEvent } from "@/lib/ai/trip";
import { estimateLeg } from "@/lib/engine/travel";
import { routeLegs } from "@/lib/kakao";
import { getLlm } from "@/lib/llm";
import { nightsOf, tasteDone, whenDone, whoDone } from "@/lib/plan/progress";
import { EMPTY_PLAN, type PlanInput } from "@/lib/plan/types";
import { toTripView } from "@/lib/trip/view";
import type { Place } from "@/lib/types";

export const maxDuration = 120;

const PLACES = places as unknown as Place[];

/** 화면에서 온 값 중 우리가 아는 필드만 받는다(자유 입력 없음) */
function readInput(body: unknown): PlanInput | string {
  if (!body || typeof body !== "object") return "입력이 비어 있어요";
  const b = body as Partial<PlanInput>;
  const input: PlanInput = {
    ...EMPTY_PLAN,
    startDate: b.startDate ?? null,
    endDate: b.endDate ?? null,
    arrival: b.arrival ?? null,
    departure: b.departure ?? "same",
    transport: b.transport ?? null,
    disabledPermit: !!b.disabledPermit,
    startTime: b.startTime ?? EMPTY_PLAN.startTime,
    endTime: b.endTime ?? EMPTY_PLAN.endTime,
    lodging: b.lodging ?? null,
    lodging2: b.lodging2 && ["same", "강릉", "속초", "동해", "미정"].includes(b.lodging2) ? b.lodging2 : "same",
    travelers: Array.isArray(b.travelers) ? b.travelers.filter((t) => ["wheelchair", "elder", "stroller"].includes(t)) : [],
    conditionOverrides: b.conditionOverrides && typeof b.conditionOverrides === "object" ? b.conditionOverrides : {},
    walkLimit: b.walkLimit === undefined ? EMPTY_PLAN.walkLimit : b.walkLimit,
    categories: Array.isArray(b.categories) ? b.categories : [],
    pace: b.pace && ["slow", "normal", "busy"].includes(b.pace) ? b.pace : "normal",
    mustVisit: Array.isArray(b.mustVisit) ? b.mustVisit.filter((id) => PLACES.some((p) => p.id === id)) : [],
  };
  if (!whenDone(input)) return "1단계(언제·어디서)를 먼저 채워 주세요";
  if (!whoDone(input)) return "2단계(누구와)를 먼저 골라 주세요";
  if (!tasteDone(input)) return "4단계(좋아하는 곳)를 먼저 골라 주세요";
  if ((nightsOf(input) ?? 0) > 2) return "최대 2박 3일까지 만들 수 있어요";
  return input;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "입력 형식이 맞지 않아요" }, { status: 400 });
  }
  const input = readInput(body);
  if (typeof input === "string") return Response.json({ message: input }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const llm = getLlm();
        // 카카오 실제 이동시간은 검사·시간 맞추기에만 쓰고 결과에는 넣지 않는다(화면은 열 때 /api/legs로 다시 받는다)
        const realLegs = (days: { lat: number; lng: number }[][]) => Promise.all(days.map((pts) => routeLegs(pts)));
        const trip = await makeTrip(llm, input, PLACES, evidence, estimateLeg, (ev: TripEvent) => send(ev), { realLegs });
        send({ stage: "done", trip: toTripView(trip, input, PLACES, evidence) });
      } catch (err) {
        console.error("[api/plan]", err);
        send({ stage: "error", message: "일정을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
