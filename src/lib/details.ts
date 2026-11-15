// pointTo·지도 번호·앵커 이동 대상이 닫힌 펼치기(details) 안에 있으면 먼저 연다(UI-SPEC 공통 펼치기 규칙).
// 대상에서 가장 가까운 details부터 바깥쪽 details까지 모두 연다. details 밖이거나 null이면 아무것도 하지 않는다.
export function openDetailsAround(el: Element | null): void {
  let details = el?.closest("details") ?? null;
  while (details) {
    if (!details.open) details.open = true;
    details = details.parentElement?.closest("details") ?? null;
  }
}
