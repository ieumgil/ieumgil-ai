// 카카오 키 연결 확인(저장하지 않고 화면에만 출력: 카카오 길찾기 결과 캐싱 금지 원칙).
// 사용: npx tsx scripts/dev/kakao-smoke.ts
//  1) REST 키: 장소 검색(dapi.kakao.com), 길찾기(apis-navi.kakaomobility.com) 1:1, 다중 목적지
//  2) JavaScript 키: Playwright로 http://localhost:3000 주소에서 지도 SDK를 띄운다(등록한 도메인에서만 동작)
// 키는 .env.local의 KAKAO_REST_API_KEY, NEXT_PUBLIC_KAKAO_JS_KEY. 키 값은 출력하지 않는다.

import { chromium } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경변수로 이미 설정된 경우
}
const REST = process.env.KAKAO_REST_API_KEY?.trim();
const JS = process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim();

// 강릉역 → 오죽헌·경포대·안목해변·속초 국립산악박물관(약 60km)
const ORIGIN = { name: "강릉역", x: 128.8996, y: 37.7646 };
const DESTS = [
  { key: "ojukheon", name: "오죽헌", x: 128.8788, y: 37.7791 },
  { key: "gyeongpodae", name: "경포대", x: 128.8961, y: 37.7953 },
  { key: "anmok", name: "안목해변", x: 128.9474, y: 37.7717 },
  { key: "sokcho", name: "국립산악박물관(속초)", x: 128.5617, y: 38.1725 },
];

async function rest(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `KakaoAK ${REST}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // 그대로
  }
  return { status: res.status, body: body as Record<string, unknown> };
}

async function main() {
  console.log(`키: REST ${REST ? "있음" : "없음"} · JavaScript ${JS ? "있음" : "없음"}`);

  if (REST) {
    const s = await rest(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent("강릉 오죽헌")}&size=1`);
    const doc = (s.body.documents as { place_name: string; address_name: string }[] | undefined)?.[0];
    console.log(`\n[장소 검색] HTTP ${s.status} · ${doc ? `${doc.place_name} (${doc.address_name})` : JSON.stringify(s.body).slice(0, 200)}`);

    const d = await rest(`https://apis-navi.kakaomobility.com/v1/directions?origin=${ORIGIN.x},${ORIGIN.y}&destination=${DESTS[0].x},${DESTS[0].y}`);
    const route = (d.body.routes as { result_code: number; result_msg: string; summary?: { distance: number; duration: number } }[] | undefined)?.[0];
    console.log(
      `[길찾기 1:1] HTTP ${d.status} · ${ORIGIN.name} → ${DESTS[0].name} · ${route?.summary ? `약 ${Math.round(route.summary.duration / 60)}분 · ${(route.summary.distance / 1000).toFixed(1)}km` : `${route?.result_code ?? ""} ${route?.result_msg ?? JSON.stringify(d.body).slice(0, 200)}`}`,
    );

    const m = await rest("https://apis-navi.kakaomobility.com/v1/destinations/directions", {
      method: "POST",
      body: JSON.stringify({ origin: { x: String(ORIGIN.x), y: String(ORIGIN.y) }, destinations: DESTS.map((t) => ({ key: t.key, x: String(t.x), y: String(t.y) })), radius: 10000 }),
    });
    console.log(`[다중 목적지] HTTP ${m.status}`);
    const routes = (m.body.routes as { key: string; result_code: number; result_msg: string; summary?: { distance: number; duration: number } }[] | undefined) ?? [];
    if (!routes.length) console.log(`  ${JSON.stringify(m.body).slice(0, 300)}`);
    for (const r of routes) {
      const name = DESTS.find((t) => t.key === r.key)?.name ?? r.key;
      console.log(`  ${name}: ${r.summary ? `약 ${Math.round(r.summary.duration / 60)}분 · ${(r.summary.distance / 1000).toFixed(1)}km` : `${r.result_code} ${r.result_msg}`}`);
    }
  }

  if (JS) {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`.slice(0, 200)));
    page.on("requestfailed", (r) => logs.push(`실패 ${r.failure()?.errorText} ${r.url().replace(/appkey=[^&]+/, "appkey=***").slice(0, 120)}`));
    page.on("response", (r) => {
      if (r.url().includes("dapi.kakao.com")) logs.push(`HTTP ${r.status()} ${r.url().replace(/appkey=[^&]+/, "appkey=***").slice(0, 120)}`);
    });
    // 실제 서버 없이 localhost:3000 주소로 시험 페이지를 띄운다(카카오는 요청한 페이지 주소로 도메인을 확인)
    await page.route("http://localhost:3000/__kakao-smoke", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><meta charset="utf-8"><div id="map" style="width:400px;height:300px"></div>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JS}&autoload=false"></script>
<script>
  if (!window.kakao) { window.__result = "SDK를 불러오지 못함"; }
  else kakao.maps.load(function () {
    var map = new kakao.maps.Map(document.getElementById("map"), { center: new kakao.maps.LatLng(37.7791, 128.8788), level: 5 });
    window.__result = "지도 생성 성공 · 확대 수준 " + map.getLevel();
  });
</script>`,
      }),
    );
    await page.goto("http://localhost:3000/__kakao-smoke");
    const result = await page.waitForFunction(() => (window as unknown as { __result?: string }).__result, null, { timeout: 15_000 }).then((h) => h.jsonValue()).catch(() => "시간 초과(15초)");
    console.log(`\n[지도 SDK, http://localhost:3000] ${result}`);
    logs.forEach((l) => console.log(`  ${l}`));
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
