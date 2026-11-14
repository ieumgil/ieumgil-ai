// 기상청 연결 확인 프로브(키 값은 어디에도 출력·저장하지 않는다).
// 사용: npx tsx scripts/dev/weather-probe.ts [--dry-run] [--save]
//  목적: 이 키가 공공데이터포털(apis.data.go.kr, serviceKey)과 기상청 API허브(apihub.kma.go.kr, authKey) 중 어느 쪽에서 되는지,
//        그리고 응답 모양이 tests/fixtures/weather/의 가정(연구 A1·A2·A8)과 같은지를 단기·중기 세 오퍼레이션으로 확인한다(D-14).
//  --dry-run : 네트워크·키 없이 부를 목록만 보여 준다(키 파라미터는 목록에 없다).
//  --save    : 성공한 응답에서 키를 지운 JSON을 tests/fixtures/weather/live/{게이트웨이}-{오퍼레이션}.json에 쓴다.
//              지운 뒤에도 키의 어떤 모양(원래·정규화·encodeURIComponent)이 남아 있으면 쓰지 않고 멈춘다. 커밋은 사용자가 정한다.
// 키는 .env.local의 KMA_API_KEY(공공데이터포털에서 단기 15084084·중기 15059468 활용신청). 요청 URL·키·응답 원문은 출력하지 않는다.
// 서버 코드와 같은 호출(kmaGet)을 쓰지만 next/*를 끌어오는 service.ts는 가져오지 않는다.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KMA_GATEWAYS, KmaError, kmaGet, maskKey, normalizeKey, readEnvelope, type KmaGatewayName, type KmaOperation } from "../../src/lib/weather/kma";
import { kstDate, pickMidTmFc, pickShortBase } from "../../src/lib/weather/kst";
import { MID_LAND_REG_ID, WEATHER_REGIONS } from "../../src/lib/weather/regions";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경변수로 이미 설정된 경우
}

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const SAVE = args.has("--save");

const now = new Date();
const short = pickShortBase(now);
const tmFc = pickMidTmFc(now);
const gn = WEATHER_REGIONS.강릉;

const OPS: { op: KmaOperation; name: string; label: string; params: Record<string, string> }[] = [
  {
    op: "VilageFcstInfoService_2.0/getVilageFcst",
    name: "getVilageFcst",
    label: "단기예보",
    params: { numOfRows: "1000", pageNo: "1", base_date: short.baseDate, base_time: short.baseTime, nx: String(gn.nx), ny: String(gn.ny) },
  },
  {
    op: "MidFcstInfoService/getMidLandFcst",
    name: "getMidLandFcst",
    label: "중기 육상(하늘·강수확률)",
    params: { numOfRows: "10", pageNo: "1", regId: MID_LAND_REG_ID, tmFc },
  },
  {
    op: "MidFcstInfoService/getMidTa",
    name: "getMidTa",
    label: "중기 기온",
    params: { numOfRows: "10", pageNo: "1", regId: gn.midTaRegId, tmFc },
  },
];

const GATEWAY_NAMES = Object.keys(KMA_GATEWAYS) as KmaGatewayName[];
const hostOf = (g: KmaGatewayName) => new URL(KMA_GATEWAYS[g].base).host;

function printPlan() {
  console.log(`기준: 오늘 ${kstDate(now)} · 단기 발표 ${short.baseDate} ${short.baseTime} · 중기 발표 tmFc ${tmFc}`);
  console.log(`부를 목록 ${GATEWAY_NAMES.length * OPS.length}개 (게이트웨이 ${GATEWAY_NAMES.length} × 오퍼레이션 ${OPS.length}), 키 파라미터(${GATEWAY_NAMES.map((g) => KMA_GATEWAYS[g].keyParam).join("·")})는 값을 출력하지 않음`);
  for (const g of GATEWAY_NAMES) {
    for (const o of OPS) {
      const params = Object.entries(o.params)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      console.log(`  [${g} ${hostOf(g)}] ${o.name} (${o.label}) · ${params}`);
    }
  }
}

/** 키의 모든 모양(원래·정규화·encodeURIComponent)이 글에 남아 있는지 */
function leaksKey(text: string, key: string): boolean {
  const forms = new Set<string>();
  for (const k of [key.trim(), normalizeKey(key)]) {
    if (k === "") continue;
    forms.add(k);
    forms.add(encodeURIComponent(k));
  }
  return [...forms].some((f) => text.includes(f));
}

async function main() {
  printPlan();
  if (DRY) {
    console.log("\n--dry-run: 네트워크를 쓰지 않았어요.");
    return;
  }

  const key = process.env.KMA_API_KEY?.trim() ?? "";
  if (key === "") {
    console.error("\n✕ KMA_API_KEY가 비어 있어요. 공공데이터포털에서 단기(15084084)·중기(15059468) 활용신청 후 .env.local에 넣어 주세요.");
    process.exit(1);
  }

  const works: Record<string, KmaGatewayName[]> = Object.fromEntries(OPS.map((o) => [o.name, []]));
  const saved: string[] = [];
  console.log("");
  for (const g of GATEWAY_NAMES) {
    for (const o of OPS) {
      try {
        const { status, json } = await kmaGet(o.op, o.params, { gateway: g, key });
        const env = readEnvelope(json);
        const keys = Object.keys(env.items[0] ?? {}).join(",");
        console.log(`✓ [${g}] ${o.name} · HTTP ${status} · 항목 ${env.items.length} · totalCount ${env.totalCount} · 첫 항목 필드 ${keys}`);
        works[o.name].push(g);

        if (SAVE) {
          const body = typeof json === "object" && json !== null ? { _source: `[VERIFIED live ${kstDate(now)} 프로브, 키 지움]`, ...(json as Record<string, unknown>) } : json;
          const masked = maskKey(JSON.stringify(body, null, 2), key);
          if (leaksKey(masked, key)) {
            console.error(`✕ ${g}-${o.name}: 키를 지운 뒤에도 키 모양이 남아 있어 저장하지 않고 멈춰요.`);
            process.exit(1);
          }
          const dir = join("tests", "fixtures", "weather", "live");
          mkdirSync(dir, { recursive: true });
          const file = join(dir, `${g}-${o.name}.json`);
          writeFileSync(file, masked + "\n");
          saved.push(file.replace(/\\/g, "/"));
        }
      } catch (e) {
        const code = e instanceof KmaError ? `코드 ${e.code}` : "알 수 없는 오류";
        console.log(`✕ [${g}] ${o.name} · ${code}`);
      }
    }
  }

  console.log("\n요약(오퍼레이션별로 되는 게이트웨이)");
  for (const o of OPS) {
    const ok = works[o.name];
    console.log(`  ${o.name}: ${ok.length ? ok.join(", ") : "없음"}`);
  }
  const allOps = OPS.length;
  const portalAll = OPS.every((o) => works[o.name].includes("portal"));
  const hubAll = OPS.every((o) => works[o.name].includes("apihub"));
  if (portalAll) {
    console.log("\n포털에서 세 오퍼레이션이 모두 됩니다. 기본값(portal) 그대로 쓰면 돼요.");
  } else if (hubAll) {
    console.log("\n포털은 안 되고 API허브에서 세 오퍼레이션이 모두 됩니다. .env.local에 KMA_GATEWAY=apihub를 넣어 주세요.");
  } else if (OPS.some((o) => works[o.name].length === 0)) {
    console.log(`\n세 오퍼레이션(${allOps}개) 중 어느 게이트웨이에서도 안 되는 것이 있어요. 코드 30은 키 미등록·이중 인코딩, 코드 12·20은 해당 API 활용신청 누락을 뜻해요. 단기·중기 둘 다 활용신청했는지 확인해 주세요.`);
  } else {
    console.log("\n오퍼레이션마다 되는 게이트웨이가 달라요. 위 요약을 보고 알려 주세요(한 게이트웨이로 맞출 수 없는 상태).");
  }
  if (saved.length) {
    console.log(`\n저장한 파일(키 지움, 커밋 여부는 직접 정하세요): ${saved.length}개`);
    saved.forEach((f) => console.log(`  ${f}`));
  }
}

main().catch(() => {
  // 원래 오류 글에 요청 주소(키)가 섞일 수 있어 내용은 출력하지 않는다
  console.error("✕ 프로브가 예기치 않게 멈췄어요.");
  process.exit(1);
});
