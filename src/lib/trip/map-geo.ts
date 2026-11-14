// 지도 구간 표시용 계산(화면 전용): 경로 중간 지점(화살표·이동시간 표를 놓을 곳).

export type LatLngPair = [number, number];

/** a → b 방향을 화면 각도로(위도는 위가 +, 화면은 아래가 +) */
export function screenAngle(a: LatLngPair, b: LatLngPair): number {
  const dx = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
  const dy = -(b[0] - a[0]);
  return Math.round((Math.atan2(dy, dx) * 180) / Math.PI) + 0; // -0 → 0
}

const dist = (a: LatLngPair, b: LatLngPair) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180));

/**
 * 경로를 길이 기준 절반에서 나눈다: [앞 절반(끝이 중간 지점), 중간 지점].
 * angle: 가운데에서의 진행 방향(화면 기준 도, 0 = 오른쪽, 90 = 아래). 화살표를 이만큼 돌린다.
 */
export function splitAtMiddle(path: LatLngPair[]): { head: LatLngPair[]; mid: LatLngPair; angle: number } | null {
  if (path.length < 2) return null;
  const total = path.slice(1).reduce((s, p, i) => s + dist(path[i], p), 0);
  if (total === 0) return null;
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i]);
    if (walked + seg >= total / 2) {
      const t = seg === 0 ? 0 : (total / 2 - walked) / seg;
      const mid: LatLngPair = [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
      return { head: [...path.slice(0, i), mid], mid, angle: screenAngle(path[i - 1], path[i]) };
    }
    walked += seg;
  }
  return null;
}
