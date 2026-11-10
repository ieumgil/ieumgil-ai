// 규칙 일정을 실제 장소 데이터로 돌려 보는 확인용 스크립트(카카오 대신 직선거리 추정).
// 사용: npx tsx scripts/engine/try-plan.ts [wheelchair|elder|stroller ...] [--car --permit] [--nights 0|1|2] [--lodging 강릉]
import places from "../../data/places.json";
import { rulePlan } from "../../src/lib/engine/fallback";
import { estimateLeg } from "../../src/lib/engine/travel";
import { toHHMM } from "../../src/lib/engine/types";
import { EMPTY_PLAN, type PlanInput, type TravelerType } from "../../src/lib/plan/types";
import type { Place } from "../../src/lib/types";

const a = process.argv.slice(2);
const opt = (k: string) => (a.includes(`--${k}`) ? a[a.indexOf(`--${k}`) + 1] : undefined);
const travelers = a.filter((x) => ["wheelchair", "elder", "stroller"].includes(x)) as TravelerType[];
const nights = Number(opt("nights") ?? 0);
const end = ["2026-11-21", "2026-11-22", "2026-11-23"][nights];
const input: PlanInput = {
  ...EMPTY_PLAN,
  startDate: "2026-11-21",
  endDate: end,
  arrival: "gangneung-station",
  transport: a.includes("--car") ? "car" : "taxi",
  disabledPermit: a.includes("--permit"),
  travelers: travelers.length ? travelers : ["wheelchair"],
  lodging: nights ? ((opt("lodging") as PlanInput["lodging"]) ?? "강릉") : null,
  categories: ["바다·해변", "역사·문화"],
  pace: (opt("pace") as PlanInput["pace"]) ?? "normal",
};
const r = rulePlan(input, places as unknown as Place[], estimateLeg);
const byId = new Map((places as unknown as Place[]).map((p) => [p.id, p]));
console.log(`유형 ${input.travelers.join("+")} · ${input.transport}${input.disabledPermit ? "+표지" : ""} · ${nights}박`);
console.log(`후보 ${r.filter.candidates.length}곳(적합·주의 ${r.filter.candidates.filter((c) => c.tier === 0).length}) · 제외 ${r.filter.excluded.length}곳 · 검사 ${r.check.ok ? "통과" : "위반 " + r.check.violations.length}`);
r.check.timelines.forEach((tl, i) => {
  console.log(`\n${i + 1}일째 ${tl.date} · ${r.check.fits[i]} · 이동 ${tl.travelMin}분`);
  for (const it of tl.items) {
    if (it.kind === "visit") {
      const c = r.filter.candidates.find((x) => x.place.id === it.placeId)!;
      console.log(`  ${toHHMM(it.arriveMin)}~${toHHMM(it.departMin)} ${byId.get(it.placeId)!.name_ko} [${c.rule}] 체류 ${it.stayMin}+여유 ${it.extraMin}분`);
    } else if (it.kind === "travel") console.log(`    ↓ ${it.leg.minutes}분 · ${it.leg.km}km${it.leg.estimated ? "(추정)" : ""} → ${it.to.name}`);
    else console.log(`  ${toHHMM(it.startMin)}~${toHHMM(it.endMin)} ${it.kind === "lunch" ? "점심·휴식" : it.kind === "wait" ? "개장 대기" : "휴식"}`);
  }
});
r.notes.forEach((n) => console.log(`안내: ${n}`));
r.check.violations.forEach((v) => console.log(`위반: ${v.message}`));
[...new Set(r.check.warnings.filter((w) => w.kind !== "추정 이동시간").map((w) => w.message))].slice(0, 8).forEach((w) => console.log(`경고: ${w}`));
