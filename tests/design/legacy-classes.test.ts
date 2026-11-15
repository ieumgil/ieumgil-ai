// 정리 감시 테스트(03단계 디자인 다듬기): 'AI 티' 나는 옛 클래스·효과가 새로 들어오거나 되살아나지 않게 src 아래 파일을 훑는다.
// 규칙은 03-UI-SPEC.md의 글자(크기 4단계·굵기 2단계) · 면(유리 효과·떠오름·카드 그림자·반지름 3단계) · 간격(금지 값) · 움직임(단계 지연)이다.
// 아직 고치지 않은 파일은 PENDING에만 적어 건너뛴다. 각 화면 계획이 자기 파일을 지운다 · 11번 계획에서 목록이 비어야 한다.
// 목록 밖 파일이 규칙을 어기면 실패하고, 이미 깨끗해진 파일이 목록에 남아 있어도 실패한다(지울 때를 알려 주려고).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/** 아직 고치지 않은 파일(저장소 루트 기준, 정렬). 각 화면 계획이 자기 파일을 지운다 */
const PENDING: string[] = [
  "src/app/page.tsx",
  "src/app/places/PlacesBrowser.tsx",
  "src/app/plan/conditions/ConditionsStep.tsx",
  "src/app/plan/making/MakingStep.tsx",
  "src/app/plan/taste/TasteStep.tsx",
  "src/app/plan/when/WhenStep.tsx",
  "src/app/plan/who/WhoStep.tsx",
  "src/app/s/[id]/SharedScreen.tsx",
  "src/app/s/[id]/page.tsx",
  "src/app/trip/[id]/TripScreen.tsx",
  "src/app/trip/[id]/final/FinalScreen.tsx",
  "src/components/Intro.tsx",
  "src/components/Logo.tsx",
  "src/components/map/TripMap.tsx",
  "src/components/photos/PlacePhoto.tsx",
  "src/components/plan/Calendar.tsx",
  "src/components/plan/IncompleteNotice.tsx",
  "src/components/plan/PlanSummary.tsx",
  "src/components/plan/StepShell.tsx",
  "src/components/plan/choices.tsx",
  "src/components/trip/Checklist.tsx",
  "src/components/trip/ConfirmSheet.tsx",
  "src/components/trip/ExampleBanner.tsx",
  "src/components/trip/FinalDayList.tsx",
  "src/components/trip/Footnotes.tsx",
  "src/components/trip/HardPlaces.tsx",
  "src/components/trip/OptionDetail.tsx",
  "src/components/trip/OptionPicker.tsx",
  "src/components/trip/PlaceCard.tsx",
  "src/components/trip/ShareButton.tsx",
  "src/components/trip/Summary.tsx",
  "src/components/trip/SwapSheet.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/sheet.tsx",
  "src/components/ui/tabs.tsx",
];

const root = process.cwd();
const SRC = join(root, "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx|css)$/.test(name) ? [p] : [];
  });
}

const files = walk(SRC).map((p) => ({ path: relative(root, p).replace(/\\/g, "/"), text: readFileSync(p, "utf8").replace(/\r\n/g, "\n") }));

// ---- 규칙 ------------------------------------------------------------------------------
// 클래스 이름은 앞이 글자·숫자·'-'가 아닐 때만 한 덩어리로 본다(접두어 lg: hover: 는 ':'라 통과, '--text-…' 같은 변수 이름은 걸리지 않음)
const B = "(?<![\\w-])";
const SPACING = "(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)";

type Rule = {
  id: string;
  label: string;
  /** 이 규칙을 보는 파일 */
  applies: (path: string) => boolean;
  /** 어긴 곳(문자열)들 */
  find: (path: string, text: string) => string[];
};

const all = (re: RegExp, text: string) => [...text.matchAll(re)].map((m) => m[0]);

const inScreens = (path: string) => (path.startsWith("src/app/") || path.startsWith("src/components/")) && !path.startsWith("src/components/ui/") && !path.endsWith("/PrintSheet.tsx") && !path.endsWith("/MakingStep.tsx");

const RULES: Rule[] = [
  {
    id: "R1",
    label: "글자: 크기 4단계(28/20/16/14)·굵기 2단계(400/700) 밖",
    applies: () => true,
    find: (path, text) => [
      ...all(new RegExp(`${B}text-(?:xs|lg|xl|2xl|3xl|4xl|5xl|lead|display)(?![\\w-])`, "g"), text),
      // 숫자로 시작하는 대괄호 임의 글자 크기. 인쇄 일정표는 종이 크기(pt)를 쓰므로 이 규칙에서만 뺀다
      ...(path.endsWith("/PrintSheet.tsx") ? [] : all(new RegExp(`${B}text-\\[\\d[^\\]\\s]*\\]`, "g"), text)),
      ...all(new RegExp(`${B}font-(?:medium|semibold)(?![\\w-])`, "g"), text),
    ],
  },
  {
    id: "R2",
    label: "효과: 유리(반투명 흰 바탕+흐림)·호버 떠오름·정지 상태 카드 그림자",
    applies: () => true,
    find: (_path, text) => [
      ...all(/bg-white\/\d+[^"'`]*backdrop-blur|backdrop-blur[^"'`]*bg-white\/\d+/g, text),
      ...all(new RegExp(`${B}(?:[a-z-]+:)*hover:-translate-y-[\\w./]+`, "g"), text),
      ...all(/(?<![\w-])LIFT(?![\w-])/g, text),
      ...all(/shadow-\[0_1px_3px[^\]]*\]/g, text),
    ],
  },
  {
    id: "R3",
    label: "간격: 금지 값(10·14·18·20px = 2.5·3.5·4.5·5)과 대괄호 임의 간격",
    applies: inScreens,
    find: (_path, text) => [
      ...all(new RegExp(`${B}-?${SPACING}-(?:2\\.5|3\\.5|4\\.5|5)(?![\\w]|\\.\\d)`, "g"), text),
      // 대괄호 임의 간격. 안전 영역(env()) 계산은 허용
      ...all(new RegExp(`${B}-?${SPACING}-\\[[^\\]\\s]+\\]`, "g"), text).filter((m) => !m.includes("env(")),
    ],
  },
  {
    id: "R4",
    label: "반지름: 컨트롤 xl · 카드 2xl · 시트 3xl · 알약 full 밖",
    applies: inScreens,
    find: (path, text) => {
      const hits = [
        ...all(new RegExp(`${B}rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee))?-(?:sm|md|lg|4xl)(?![\\w-])`, "g"), text),
        ...all(new RegExp(`${B}rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e))?(?![\\w-])`, "g"), text),
        ...all(new RegExp(`${B}rounded(?:-[a-z]+)?-\\[[^\\]\\s]+\\]`, "g"), text),
      ];
      // 허용: 시작 화면 PC 미리보기의 휴대폰 틀(2.25rem)·뒤 면(3rem)만
      return path === "src/app/page.tsx" ? hits.filter((h) => h !== "rounded-[2.25rem]" && h !== "rounded-[3rem]") : hits;
    },
  },
  {
    id: "R5",
    label: "움직임: 목록 항목마다 단계 지연(animationDelay)",
    applies: (path) => !path.endsWith("/MakingStep.tsx"),
    find: (_path, text) => [...all(/animationDelay/g, text), ...all(/\[animation-delay:[^\]]*\]/g, text)],
  },
];

/** 파일 → 어긴 규칙 번호들 */
function violations() {
  const out = new Map<string, string[]>();
  for (const f of files) {
    for (const r of RULES) {
      if (r.applies(f.path) && r.find(f.path, f.text).length > 0) out.set(f.path, [...(out.get(f.path) ?? []), r.id]);
    }
  }
  return out;
}

const found = violations();
const pending = new Set(PENDING);

describe("정리 감시: PENDING 밖 파일은 새 규칙을 지킨다", () => {
  it("규칙을 어기는 파일이 목록 밖에 없다", () => {
    const outside = [...found].filter(([path]) => !pending.has(path)).map(([path, ids]) => `${path} (${ids.join(",")})`);
    expect(outside.sort(), `PENDING에 없는 파일이 규칙을 어김:\n${outside.join("\n")}`).toEqual([]);
  });

  for (const r of RULES) {
    it(`${r.id} ${r.label}: 이 규칙을 어기는 곳이 PENDING 밖에 없다`, () => {
      const lines = files
        .filter((f) => !pending.has(f.path) && r.applies(f.path))
        .flatMap((f) => r.find(f.path, f.text).map((hit) => `${f.path}: ${hit}`));
      expect(lines, lines.join("\n")).toEqual([]);
    });
  }
});

describe("PENDING 목록 관리", () => {
  it("목록의 모든 경로가 실제로 있다(지운 파일이 남지 않게)", () => {
    const missing = PENDING.filter((p) => !existsSync(join(root, p)));
    expect(missing).toEqual([]);
  });

  it("목록이 정렬돼 있고 겹치지 않는다", () => {
    expect([...PENDING]).toEqual([...new Set(PENDING)].sort());
  });

  it("목록의 파일은 아직 규칙을 어긴다(깨끗해졌으면 목록에서 지운다)", () => {
    const clean = PENDING.filter((p) => !found.has(p));
    expect(clean, `이미 깨끗한 파일은 PENDING에서 지운다:\n${clean.join("\n")}`).toEqual([]);
  });
});

describe("규칙이 실제로 잡아낸다(검사 자체의 시험)", () => {
  const hit = (id: string, path: string, text: string) => RULES.find((r) => r.id === id)!.find(path, text);

  it("R1: text-lg · text-[1.1rem] · font-medium을 잡고 text-base · text-title · text-heading은 안 잡는다", () => {
    expect(hit("R1", "src/x.tsx", `"text-lg text-[1.1rem] font-medium lg:text-xl"`)).toHaveLength(4);
    expect(hit("R1", "src/x.tsx", `"text-base text-sm text-title text-heading font-bold"`)).toEqual([]);
    expect(hit("R1", "src/x.css", "--text-lead: 1rem; --text-display: 2rem;")).toEqual([]); // 변수 정의는 규칙 대상이 아님
  });

  it("R1: 인쇄 일정표의 pt 크기는 허용", () => {
    expect(hit("R1", "src/components/trip/PrintSheet.tsx", `"text-[10.5pt]"`)).toEqual([]);
  });

  it("R2: 유리 효과 · 호버 떠오름 · 카드 그림자를 잡는다(가운데 맞춤 translate는 아님)", () => {
    expect(hit("R2", "src/x.tsx", `"bg-white/95 px-5 backdrop-blur"`)).toHaveLength(1);
    expect(hit("R2", "src/x.tsx", `"motion-safe:hover:-translate-y-0.5"`)).toHaveLength(1);
    expect(hit("R2", "src/x.tsx", `"shadow-[0_1px_3px_rgb(25_31_40/0.08),0_4px_16px_rgb(25_31_40/0.06)]"`)).toHaveLength(1);
    expect(hit("R2", "src/x.tsx", `"lg:-translate-y-1/2 bg-black/10 backdrop-blur-xs"`)).toEqual([]);
  });

  it("R3: 금지 간격 값을 잡고(음수·접두어 포함) 4px 배수와 env() 계산은 허용", () => {
    expect(hit("R3", "src/app/x.tsx", `"gap-2.5 px-3.5 lg:pt-5 -mt-4.5 space-y-5 p-[1.125rem]"`)).toHaveLength(6);
    expect(hit("R3", "src/app/x.tsx", `"gap-2 px-4 pt-6 mt-8 top-5 size-5 pb-[calc(1rem+env(safe-area-inset-bottom))]"`)).toEqual([]);
  });

  it("R4: rounded 단독·sm·md·lg·임의 값을 잡고 xl·2xl·3xl·full은 허용(page.tsx 미리보기 틀은 예외)", () => {
    expect(hit("R4", "src/app/x.tsx", `"rounded rounded-md rounded-lg rounded-t-lg rounded-[2.25rem]"`)).toHaveLength(5);
    expect(hit("R4", "src/app/x.tsx", `"rounded-xl rounded-2xl rounded-3xl rounded-t-3xl rounded-full"`)).toEqual([]);
    expect(hit("R4", "src/app/page.tsx", `"rounded-[2.25rem] rounded-[3rem]"`)).toEqual([]);
    expect(hit("R4", "src/app/page.tsx", `"rounded-[1rem]"`)).toHaveLength(1);
  });

  it("R5: 단계 지연을 잡는다", () => {
    expect(hit("R5", "src/x.tsx", "style={{ animationDelay: `${i * 70}ms` }}")).toHaveLength(1);
    expect(hit("R5", "src/x.tsx", `"[animation-delay:340ms]"`)).toHaveLength(1);
  });
});
