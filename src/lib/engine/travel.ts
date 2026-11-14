// 출발·도착 지점 좌표와 이동시간 추정.
// 카카오 길찾기를 붙이기 전(그리고 카카오가 실패했을 때) 쓰는 "추정치". 화면에는 반드시 '추정'으로 표시한다.

import type { ArrivalId, LodgingRegion } from "../plan/types";
import type { Leg, Point } from "./types";

/** 도착 지점 좌표(대략값, 공개 지도 기준. 카카오 연결 때 다시 확인) */
export const ARRIVAL_COORDS: Record<ArrivalId, Point> = {
  "gangneung-station": { id: "gangneung-station", name: "강릉역", lat: 37.7646, lng: 128.8996 },
  "gangneung-bus": { id: "gangneung-bus", name: "강릉 고속버스터미널", lat: 37.7637, lng: 128.8904 },
  "sokcho-bus": { id: "sokcho-bus", name: "속초 고속버스터미널", lat: 38.1903, lng: 128.6018 },
  "donghae-station": { id: "donghae-station", name: "동해역", lat: 37.4969, lng: 129.124 },
};

/** 숙소 지역의 기준점(숙소는 추천하지 않고 지역만 받는다) */
export const LODGING_COORDS: Record<Exclude<LodgingRegion, "미정">, Point> = {
  강릉: { id: "lodging-강릉", name: "강릉 숙소(지역 기준점)", lat: 37.7646, lng: 128.8996 },
  속초: { id: "lodging-속초", name: "속초 숙소(지역 기준점)", lat: 38.207, lng: 128.5918 },
  동해: { id: "lodging-동해", name: "동해 숙소(지역 기준점)", lat: 37.5247, lng: 129.1143 },
};

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 구간마다 더하는 주차·승하차 시간(분). 카카오 실제 이동시간에도 같은 값을 더한다 */
export const PARK_MIN = 5;

/**
 * 직선거리로 차량 이동시간 어림. 도로 우회 1.35배, 가까운 거리(10km 미만)는 시속 30km, 먼 거리는 시속 55km,
 * 주차·승하차 기본 5분. 카카오 시험값(강릉역→오죽헌 실제 8분·2.9km)과 비슷한 수준으로 맞췄다.
 */
export function estimateLeg(from: Point, to: Point): Leg {
  if (from.id === to.id) return { minutes: 0, km: 0, estimated: true };
  const km = haversineKm(from, to) * 1.35;
  const speed = km < 10 ? 30 : 55;
  return { minutes: Math.max(PARK_MIN, Math.round((km / speed) * 60) + PARK_MIN), km: Math.round(km * 10) / 10, estimated: true };
}
