// 지도 아래 설명 문구(고정 문구와 숫자뿐, LLM이 쓰지 않는다). 첫 줄 = 이동 시간·거리(크게), 둘째 줄 = 경로 종류 안내.
// 원칙 6: 지도 경로는 "일반 차량 경로"로만 표현한다(휠체어 안전 경로라고 쓰지 않는다). 항상 둘째 줄에 남는다.

/** line: undefined = 받는 중, null = 못 받음(직선), 값 = 카카오 경로 */
export function mapCaption(line: { km: number; minutes: number } | null | undefined): { head: string; sub: string } {
  if (line === undefined) return { head: "경로를 불러오는 중이에요", sub: "일반 차량 경로 · 번호를 누르면 장소 정보" };
  if (line === null) {
    return { head: "경로를 불러오지 못했어요", sub: "일반 차량 경로는 못 받아 순서대로 직선으로 이었어요 · 번호를 누르면 장소 정보" };
  }
  return { head: `차량 약 ${line.minutes}분 · 약 ${line.km}km`, sub: "일반 차량 경로 · 번호를 누르면 장소 정보" };
}
