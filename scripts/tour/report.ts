// 받은 상세 원본(data/raw/tour/places/*.json)으로 "무엇을 얼마나 받을 수 있는지" 보고서를 만든다.
// 사용: npx tsx scripts/tour/report.ts
// 결과: docs/data/tour-api-fields.md(필드별 채움 비율·예시, 장소별 점수, 조사표 대응) · data/raw/tour/coverage.csv

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import type { TourItem } from "./client";

interface Raw {
  fetchedAt: string;
  city: string;
  list: TourItem;
  common: TourItem | null;
  intro: TourItem | null;
  info: TourItem[];
  images: TourItem[];
  withTour: TourItem | null;
}

const DIR = "data/raw/tour/places";
const places: Raw[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")) as Raw);
const N = places.length;

// 매뉴얼 v4.3의 국문 항목명(자주 쓰는 것만)
const LABEL: Record<string, string> = {
  title: "이름", tel: "전화", telname: "전화 담당", homepage: "홈페이지", firstimage: "대표 사진", cpyrhtDivCd: "사진 저작권 유형",
  addr1: "주소", addr2: "상세주소", zipcode: "우편번호", mapx: "경도", mapy: "위도", overview: "개요(설명 글)",
  lclsSystm1: "분류체계 대", lclsSystm2: "분류체계 중", lclsSystm3: "분류체계 소", cat1: "옛 분류 대", cat2: "옛 분류 중", cat3: "옛 분류 소",
  usetime: "이용시간", usetimeculture: "이용시간", restdate: "쉬는 날", restdateculture: "쉬는 날", infocenter: "문의·안내", infocenterculture: "문의·안내",
  parking: "주차", parkingculture: "주차", parkingfee: "주차 요금", usefee: "이용 요금", spendtime: "관람 소요시간", expagerange: "체험 가능 연령",
  chkbabycarriage: "유모차 대여", chkbabycarriageculture: "유모차 대여", chkpet: "반려동물", chkpetculture: "반려동물", chkcreditcard: "신용카드", chkcreditcardculture: "신용카드",
  opendate: "개장일", useseason: "이용 시기", expguide: "체험 안내", heritage1: "세계유산", accomcount: "수용 인원", accomcountculture: "수용 인원", scale: "규모", discountinfo: "할인",
  publictransport: "대중교통", route: "접근로", ticketoffice: "매표소", promotion: "홍보물", wheelchair: "휠체어", exit: "출입통로", elevator: "엘리베이터",
  restroom: "화장실", auditorium: "관람석", room: "객실", handicapetc: "지체장애 기타", braileblock: "점자블록", helpdog: "보조견", guidehuman: "안내요원",
  audioguide: "오디오 가이드", bigprint: "큰 활자 홍보물", brailepromotion: "점자 홍보물", guidesystem: "유도 안내 설비", blindhandicapetc: "시각장애 기타",
  signguide: "수화 안내", videoguide: "자막 영상", hearingroom: "객실(청각)", hearinghandicapetc: "청각장애 기타", stroller: "유모차", lactationroom: "수유실",
  babysparechair: "유아용 보조의자", infantsfamilyetc: "영유아가족 기타",
};
const SKIP = new Set(["contentid", "contenttypeid", "createdtime", "modifiedtime", "areacode", "sigungucode", "lDongRegnCd", "lDongSignguCd", "mlevel", "firstimage2"]);

const clean = (v: unknown) =>
  String(v ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const filled = (v: unknown) => clean(v) !== "" && clean(v) !== "0";
const short = (s: string, n = 50) => (s.length > n ? `${s.slice(0, n)}…` : s).replace(/\|/g, "/");
const pct = (k: number) => `${Math.round((k / N) * 100)}%`;

function fieldTable(pick: (p: Raw) => TourItem | null) {
  const keys = new Set<string>();
  places.forEach((p) => Object.keys(pick(p) ?? {}).forEach((k) => keys.add(k)));
  const rows = [...keys]
    .filter((k) => !SKIP.has(k))
    .map((k) => {
      const vals = places.map((p) => clean(pick(p)?.[k])).filter((v) => v && v !== "0");
      const examples = [...new Set(vals)].slice(0, 2).map((v) => `"${short(v)}"`).join(" · ");
      return { k, n: vals.length, examples };
    })
    .sort((a, b) => b.n - a.n);
  return [
    "| 필드 | 뜻 | 채워진 곳 | 예시 |",
    "|---|---|---:|---|",
    ...rows.map((r) => `| \`${r.k}\` | ${LABEL[r.k] ?? ""} | ${r.n} (${pct(r.n)}) | ${r.examples} |`),
  ].join("\n");
}

// 우리 access 항목과 연결되는 무장애 필드
const ACCESS = ["parking", "route", "exit", "elevator", "restroom", "wheelchair", "stroller", "lactationroom"] as const;
const intro = (p: Raw, base: string) => clean(p.intro?.[base] ?? p.intro?.[`${base}culture`]);

// 조사표 대응: 이름 토큰이 API 이름에 들어 있으면 후보로 본다(사람이 확인)
const survey: { id: string; name: string }[] = existsSync("data/raw/tour/survey.json")
  ? JSON.parse(readFileSync("data/raw/tour/survey.json", "utf8"))
  : [];
// 흔한 단어만으로는 맞추지 않는다(박물관·해변 등). 해수욕장은 해변과 같은 말로 본다.
const STOP = new Set(["강릉", "속초", "동해", "박물관", "해변", "기념공원", "공원", "일대", "시장", "거리", "전망대", "습지", "포함", "수산시장", "출렁다리", "전망", "갯배"]);
const norm = (s: string) => s.replace(/\(.*?\)/g, "").replace(/해수욕장/g, "해변").replace(/[\s·&]/g, "");
const stripCity = (s: string) => s.replace(/^(강릉|속초|동해)(시립)?/, "");
const tokens = (s: string) =>
  s
    .split(/[·()\s/,]+/)
    // 긴 이름은 앞 3글자로도 본다(예: 참소리축음기 ↔ 참소리에디슨…)
    .flatMap((t) => [norm(t), stripCity(norm(t)), ...(norm(t).length >= 5 ? [norm(t).slice(0, 3)] : [])])
    .filter((t) => t.length >= 2 && !STOP.has(t));
function surveyIds(title: string) {
  const t = norm(title);
  return survey.filter((s) => tokens(s.name).some((tok) => t.includes(tok))).map((s) => s.id);
}

const scored = places
  .map((p) => {
    const w = p.withTour ?? {};
    const acc = ACCESS.filter((k) => filled(w[k])).length;
    const wheel = [filled(w.route) || filled(w.exit), filled(w.restroom), filled(w.elevator)];
    const type1 = p.images.filter((i) => i.cpyrhtDivCd === "Type1").length;
    return {
      title: clean(p.list.title),
      id: String(p.list.contentid),
      city: p.city,
      type: String(p.list.contenttypeid) === "12" ? "관광지" : "문화시설",
      acc,
      wheel: wheel.filter(Boolean).length,
      hours: filled(intro(p, "usetime")),
      rest: filled(intro(p, "restdate")),
      tel: filled(p.common?.tel) || filled(intro(p, "infocenter")),
      overview: filled(p.common?.overview),
      photos: p.images.length,
      type1,
      survey: surveyIds(clean(p.list.title)).join(" "),
    };
  })
  .sort((a, b) => b.acc - a.acc || b.wheel - a.wheel || Number(b.hours) - Number(a.hours));

const yes = (b: boolean) => (b ? "✓" : "—");
const dist = Array.from({ length: ACCESS.length + 1 }, (_, i) => scored.filter((s) => s.acc === i).length);
const imgCount = places.reduce((a, p) => a + p.images.length, 0);
const imgType1 = places.reduce((a, p) => a + p.images.filter((i) => i.cpyrhtDivCd === "Type1").length, 0);
const infoNames = new Map<string, number>();
places.forEach((p) => p.info.forEach((i) => infoNames.set(clean(i.infoname), (infoNames.get(clean(i.infoname)) ?? 0) + 1)));

const md = `# 무장애 여행정보 API로 받을 수 있는 정보

> \`scripts/tour/report.ts\`가 만든 문서. 기준: 한국관광공사 무장애 여행정보 API(KorWithService2), ${places[0]?.fetchedAt.slice(0, 10)} 조회,
> 강릉·속초·동해의 관광지(12)·문화시설(14) **${N}곳**. 원본은 \`data/raw/tour/places/\`(커밋 안 함), 장소별 표는 \`data/raw/tour/coverage.csv\`.
> 값은 관광공사가 등록한 문장 그대로라 검수 전에는 \`places.json\`에 넣지 않는다.

## 요약

- 장소 수: 강릉 ${scored.filter((s) => s.city === "강릉시").length} · 속초 ${scored.filter((s) => s.city === "속초시").length} · 동해 ${scored.filter((s) => s.city === "동해시").length}
- 우리 access 항목과 연결되는 무장애 필드 ${ACCESS.length}개(${ACCESS.join(", ")}) 중 채워진 개수별 장소 수:
  ${dist.map((n, i) => `${i}개 ${n}곳`).join(" · ")}
- 휠체어 핵심 3개(진입: route 또는 exit · 화장실 · 엘리베이터)가 모두 있는 곳: ${scored.filter((s) => s.wheel === 3).length}곳 · 2개 이상: ${scored.filter((s) => s.wheel >= 2).length}곳
- 이용시간 있음 ${scored.filter((s) => s.hours).length}곳 · 쉬는 날 있음 ${scored.filter((s) => s.rest).length}곳 · 전화/문의 있음 ${scored.filter((s) => s.tel).length}곳 · 개요 있음 ${scored.filter((s) => s.overview).length}곳
- 사진 ${imgCount}장 중 공공누리 1유형(Type1) ${imgType1}장
- API에 **없는** 우리 항목: 쉴 곳(벤치·쉼터), 주차장→입구 거리(m), 관람 동선 길이(m), 경사·노면은 route/exit 문장에서 해석해야 함 → 전화·현장 확인 대상

## 무장애 상세 (\`detailWithTour2\`)

${fieldTable((p) => p.withTour)}

## 소개정보 (\`detailIntro2\`, 관광지·문화시설은 필드 이름이 다름: \`usetime\` / \`usetimeculture\`)

${fieldTable((p) => p.intro)}

## 공통정보 (\`detailCommon2\`)

${fieldTable((p) => p.common)}

## 반복정보 (\`detailInfo2\`) 항목 이름

${[...infoNames].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}(${n})`).join(" · ") || "없음"}

## 장소별 점수 (무장애 필드 채움 순)

무장애 = ${ACCESS.length}개 중 채워진 수 · 휠체어 = 진입/화장실/엘리베이터 중 채워진 수 · 조사표 = 이름이 비슷한 조사표 id(자동 대응, 확인 필요)

| 장소 | 시 | 유형 | 무장애 | 휠체어 | 이용시간 | 쉬는 날 | 전화 | 사진(1유형) | 조사표 |
|---|---|---|---:|---:|:---:|:---:|:---:|---:|---|
${scored.map((s) => `| ${s.title} | ${s.city.replace("시", "")} | ${s.type} | ${s.acc} | ${s.wheel} | ${yes(s.hours)} | ${yes(s.rest)} | ${yes(s.tel)} | ${s.photos}(${s.type1}) | ${s.survey} |`).join("\n")}

## 조사표 32곳 대응

${survey
  .map((s) => {
    const hits = scored.filter((p) => p.survey.split(" ").includes(s.id));
    return `- ${s.id} ${s.name}: ${hits.length ? hits.map((h) => `${h.title}(무장애 ${h.acc})`).join(", ") : "**API에서 못 찾음**"}`;
  })
  .join("\n")}
`;

writeFileSync("docs/data/tour-api-fields.md", md);
const csvHead = "장소,contentid,시,유형,무장애,휠체어,이용시간,쉬는날,전화,개요,사진,사진1유형,조사표";
const csv = [csvHead, ...scored.map((s) => [s.title, s.id, s.city, s.type, s.acc, s.wheel, s.hours, s.rest, s.tel, s.overview, s.photos, s.type1, s.survey].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
writeFileSync("data/raw/tour/coverage.csv", "﻿" + csv);
console.log(`✓ docs/data/tour-api-fields.md · data/raw/tour/coverage.csv (${N}곳)`);
