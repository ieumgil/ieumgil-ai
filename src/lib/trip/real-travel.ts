"use client";

// 화면을 열 때 카카오 실제 이동시간을 받아 시각을 다시 계산한다(원칙 3: 카카오 결과는 저장하지 않고 열 때 다시 계산).
// - 탭에 보관하는 일정(TripView)은 그대로 추정 시각이다. 실제 값은 이 모듈의 메모리에만 두고(새로고침하면 사라짐) 화면에만 쓴다.
// - 안·날짜마다 지점 순서(출발 → 장소 → 도착)로 /api/legs에 한 번에 묻고, 받기 전·못 받은 날은 추정 그대로 보여준다.
// - 장소를 바꾸면(초안이 바뀌면) 바뀐 날만 다시 묻는다.
// - 실제 시간으로 다시 검사해 넘치는 날은 realIssue로 알린다(서버가 만들 때 이미 맞추므로 드물다).

import { useEffect, useMemo, useState } from "react";
import { checkPlan } from "../engine/check";
import { addLegs, dayPoints, tableTravel, type LegTable, type RealLeg } from "../engine/real-travel";
import { timelineOptions } from "../engine/timeline";
import { estimateLeg } from "../engine/travel";
import type { Point } from "../engine/types";
import { toDayView, type OptionView, type TripView } from "./view";

/** 지점 순서 → 구간 값(못 받았으면 null). 메모리에만 */
const memory = new Map<string, RealLeg[] | null>();
const seqKey = (pts: Point[]) => pts.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");

/** 시험용: 메모리 비우기 */
export function clearRealLegs() {
  memory.clear();
}

/** 안들의 날짜를 실제 이동시간으로 다시 계산한 안(못 받았으면 받은 안 그대로) */
export function useRealTravel(trip: TripView, options: OptionView[]): OptionView[] {
  const placesById = useMemo(() => new Map(Object.entries(trip.placeData)), [trip.placeData]);
  const seqs = useMemo(() => options.map((o) => o.draft.days.map((d, i) => dayPoints(trip.frames[i], d, placesById))), [options, trip.frames, placesById]);
  const wanted = seqs.flat();
  const wantedKey = wanted.map(seqKey).join("#");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const seen = new Set<string>();
    const missing = wanted.filter((pts) => {
      const k = seqKey(pts);
      if (memory.has(k) || seen.has(k) || pts.length < 2) return false;
      seen.add(k);
      return true;
    });
    if (!missing.length) return;
    let alive = true;
    fetch("/api/legs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: missing.map((pts) => ({ points: pts.map((p) => ({ lat: p.lat, lng: p.lng })) })) }),
    })
      .then((r) => (r.ok ? r.json() : { days: [] }))
      .catch(() => ({ days: [] }))
      .then((body: { days?: (RealLeg[] | null)[] }) => {
        missing.forEach((pts, i) => memory.set(seqKey(pts), body.days?.[i] ?? null));
        if (alive) setVersion((v) => v + 1);
      });
    return () => {
      alive = false;
    };
    // wantedKey가 바뀔 때(안·초안이 바뀔 때)만 다시 묻는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey]);

  return useMemo(() => {
    const table: LegTable = new Map();
    for (const pts of wanted) {
      const legs = memory.get(seqKey(pts));
      if (legs) addLegs(table, pts, legs);
    }
    if (table.size === 0) return options;
    const verdicts = new Map(Object.entries(trip.judgments).map(([id, j]) => [id, j.verdict]));
    const ctx = { frames: trip.frames, placesById, travel: tableTravel(table, estimateLeg), options: timelineOptions(trip.input), verdicts };
    return options.map((o) => {
      const check = checkPlan(o.draft, ctx);
      const days = check.timelines.map((tl, i) => {
        const issue = check.violations.find((v) => v.day === i + 1 && (v.kind === "운영시간" || v.kind === "하루범위"));
        return { ...toDayView(tl, trip.frames[i], check.fits[i], o.draft.days[i]), ...(issue ? { realIssue: issue.message } : {}) };
      });
      return { ...o, days, stats: { ...o.stats, travelMin: days.reduce((a, d) => a + d.travelMin, 0) } };
    });
    // version: 메모리에 새 값이 들어오면 다시 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, trip, placesById, version, wantedKey]);
}
