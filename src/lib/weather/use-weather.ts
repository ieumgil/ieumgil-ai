"use client";

// 화면을 열 때 /api/weather를 한 번 불러 날씨 표를 받는다. 값은 이 모듈의 메모리에만 두고(새로고침하면 사라짐)
// sessionStorage·localStorage·공유 문서에는 쓰지 않는다(D-04, 원칙 3 — lib/trip/real-travel.ts와 같은 정신).
// 못 받으면(키 없음·실패·형식 오류) null — 화면은 날씨 줄만 빠진다(D-05).

import { useEffect, useState } from "react";
import { readPayload, type WeatherPayload } from "./types";

/** 같은 화면에서 여러 번 불러도 요청은 하나. 실패하면 비워서 다음 화면에서 다시 묻는다 */
let pending: Promise<WeatherPayload | null> | null = null;

function loadWeather(): Promise<WeatherPayload | null> {
  if (!pending) {
    pending = fetch("/api/weather")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => readPayload(json))
      .catch(() => null)
      .then((payload) => {
        if (!payload) pending = null;
        return payload;
      });
  }
  return pending;
}

/** 시험용: 메모리 비우기 */
export function clearWeather() {
  pending = null;
}

export function useWeather(): WeatherPayload | null {
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  useEffect(() => {
    let alive = true;
    loadWeather().then((p) => {
      if (alive) setWeather(p);
    });
    return () => {
      alive = false;
    };
  }, []);
  return weather;
}
