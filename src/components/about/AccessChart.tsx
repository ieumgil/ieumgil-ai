// 접근성 10항목 값 분포(data/places.json 152곳을 빌드할 때 센다): 항목마다 가로 100% 막대 + 숫자 글.
// 색: 가능 = 기본 파랑, 부분가능 = 주황, 불가 = 빨강, 모름 = 회색(범주가 아니라 '값 없음'이라 중립색).
// 색만으로 읽지 않게 행마다 숫자를 글로 적고, 막대는 장식(aria-hidden). 조각 사이 2px 흰 틈.
import places from "../../../data/places.json";
import { UNKNOWN_LABEL } from "@/lib/trip/labels";
import { ACCESS_KEYS } from "@/lib/types";

const VALUES = [
  { v: "가능", color: "bg-primary" },
  { v: "부분가능", color: "bg-[#E8A33D]" },
  { v: "불가", color: "bg-[#C0392B]" },
  { v: "모름", color: "bg-[#B0B8C1]" },
] as const;

type Row = { key: string; label: string; counts: Record<string, number>; total: number };

function rows(): Row[] {
  const list = places as unknown as { access: Record<string, { value: string }> }[];
  return ACCESS_KEYS.map((key) => {
    const counts: Record<string, number> = {};
    for (const p of list) {
      const v = p.access[key]?.value ?? "모름";
      counts[v] = (counts[v] ?? 0) + 1;
    }
    return { key, label: UNKNOWN_LABEL[key] ?? key, counts, total: list.length };
  }).sort((a, b) => (b.counts["모름"] ?? 0) - (a.counts["모름"] ?? 0));
}

export function AccessChart() {
  const data = rows();
  const unknown = data.reduce((s, r) => s + (r.counts["모름"] ?? 0), 0);
  const all = data.reduce((s, r) => s + r.total, 0);
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-col gap-1">
        <span className="text-base font-medium">항목마다 공식 정보가 있는 곳과 없는 곳 (152곳)</span>
        <span className="text-sm text-ink-sub">
          전체 {all.toLocaleString()}항목 가운데 &lsquo;모름&rsquo; {unknown.toLocaleString()}개({Math.round((unknown / all) * 100)}%) · 모름이 많은 항목부터
        </span>
      </figcaption>
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="색 설명">
        {VALUES.map((x) => (
          <li key={x.v} className="flex items-center gap-2 text-sm text-ink-sub">
            <span aria-hidden="true" className={`size-3 rounded-full ${x.color}`} />
            {x.v}
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-3">
        {data.map((r) => (
          <li key={r.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{r.label}</span>
              <span className="text-sm text-ink-sub">
                {VALUES.filter((x) => r.counts[x.v]).map((x) => `${x.v} ${r.counts[x.v]}`).join(" · ")}
              </span>
            </div>
            <div aria-hidden="true" className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
              {VALUES.filter((x) => r.counts[x.v]).map((x) => (
                <span key={x.v} className={`h-full ${x.color}`} style={{ width: `${(r.counts[x.v] / r.total) * 100}%` }} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}
