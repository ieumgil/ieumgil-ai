// 엘리베이터 조건은 '층이 있는 시설'에만 해당한다(조건표). 관광공사 분류만 봐도 층이 없는 곳은 엘리베이터를 '가능'으로 둔다.
// - 야외 시설: 자연관광(NA) 전체, 도시공원(VE03) — scripts/tour/evidence.ts isOutdoorClass와 같다(날씨 주의에도 쓰임)
// - 층이 없는 시설: 고궁·고택·생가·기타 역사유적지, 탑·비석·불상, 다리·동상, 골목길·문화거리·마을관광지, 체험마을·목장·농장
//   (등대·전망대·박물관·전시관·절·성당·기차역은 층이나 계단이 있을 수 있어 넣지 않는다 → '모름' + 질문)

const SINGLE_LEVEL = /^(HS0101|HS0104|HS0105|HS0112|HS0201|HS0203|VE0103|VE0105|VE0401|VE0402|EX0301|EX0302|EX0303)/;

/** 관광공사 분류 코드(예: HS010500)가 층이 없는 시설이면 true */
export const isSingleLevelClass = (code: string) => SINGLE_LEVEL.test(code);

/** 근거 문단 class-1의 글(예: "역사관광 > 역사유적지 > 생가 (HS010500)")에서 분류 코드를 꺼낸다 */
export function classCodeOf(classText: string | undefined): string | null {
  return classText?.match(/\(([A-Z]{2}\d{6})\)/)?.[1] ?? null;
}
