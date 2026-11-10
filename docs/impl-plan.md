# 구현 계획 (2026-11-10 → 개발 마감 12/4)

> AI 설계는 `docs/ai-plan.md` v3가 기준이다. 이 문서는 만드는 순서와 완료 조건만 다룬다. 단계가 끝나면 체크하고 결과를 한 줄 적는다.

## 정한 것 (11/10)

- **Gemini 무료 등급으로 시작**(당분간 개발자 혼자 사용). 한도가 부족하면 유료 Tier 1로 바꾼다.
- 모델은 환경변수로 둔다.
  - `GEMINI_MODEL_FAST`(요청할 때 ②③④, 기본 `gemini-3.5-flash-lite`)
  - `GEMINI_MODEL_READ`(미리 하는 ① 읽기, 기본 `gemini-3.8-flash`, 실패 시 FAST로 대체)
  - 무료 한도는 공식 수치가 없고 AI Studio 화면에서 확인한다(비공식 10월 측정: Flash 5 RPM·20 RPD, Flash-Lite 15 RPM·500 RPD).
- **공유 링크·Supabase는 나중에.** 메인 기능(입력 → AI 판단 → 일정 2~3안 → 비교·상세)에 집중한다. 예시 루트는 저장소의 JSON 파일로 둔다.
- SDK: `@google/genai` 3.0.0, `client.interactions.create({ response_format: { type: "text", mime_type: "application/json", schema } })`.
  스키마는 일부 키워드만 지킨다(`minLength` 등은 무시) → 앱에서 ajv로 다시 검사한다.

## 0단계에서 확인한 것 (`scripts/ai/smoke.ts`)

- `gemini-3.5-flash-lite`: 2.4초, 입력 231·출력 332 토큰. 원문에 없는 엘리베이터·쉴 곳을 '모름' + 질문으로 답함(지어내지 않음).
- 근거를 id(`route-1`)가 아니라 문장 전체로 돌려줌 → **호출마다 근거 id 목록을 스키마 `enum`으로 고정**한다.
- `gemini-3.8-flash`: 503(수요 과다) → `llm.ts`에 재시도(지수 대기)와 예비 모델을 둔다.

## 단계

| 단계 | 기간 | 만들 것 | 완료 조건 | 상태 |
|---|---|---|---|---|
| 0. AI 연결 확인 | 11/10 | Gemini 키, SDK, `scripts/ai/smoke.ts` | JSON 스키마 응답 성공 | ✅ |
| 1. 장소 스키마 v3 | 11/10 | `types.ts`, `places.schema.json`, `validate.ts`, 샘플 데이터: `모름`+`ask`, 등급 `ai/human`, 근거 id, `on_site`, 전화 필수, `tour_content_id` | '모름'에 질문 없음·부분가능 메모 없음·전화 없음 → 검사 실패 | ✅ 검사 테스트 21개 |
| 2. AI 기반 | 11/10 | `llm.ts`(Gemini/가짜 교체, 시간 제한, 재시도, 예비 모델), `ai/schemas.ts`(근거 id enum), `ai/guards.ts` | `tests/ai`: 근거 없는 답 버림, 모름≠적합, 불가→부적합, 형식 오류 재시도 후 버림 | ✅ 테스트 24개, 실제 Gemini로 판단 스키마 확인(3.7초) |
| 3. 장소 데이터 | 11/10 | `scripts/tour/build-places.ts`(기본 정보·전화·1유형 사진·카테고리, 관광지 아닌 곳 제외, 근거 문서), `scripts/ai/read-places.ts`(① 읽기, 묶음·이어 받기) | `places.json` 검사 통과, '모름' 비율 보고 | ✅ 152곳 · 모름 58% (사람 판정은 하지 않기로 함) |
| 4. 코드 엔진 | 11/10 | `filter.ts`, `timeline.ts`, `check.ts`, `fallback.ts` | 엔진 시나리오 10개 통과(필수 조건 위반 0건) | ✅ 시나리오 10개 + 유형 조합 14개 위반 0건. `scripts/engine/try-plan.ts`로 실제 152곳 확인 |
| 5. ② 판단 | 11/10 | `ai/judge.ts` + 프롬프트, 3회 비교·확신도 | 가짜 LLM 테스트, 실제 Gemini 시나리오 5개 | ✅ 가짜 LLM 4개 + 실제 Gemini 2개 시나리오(판단 3회 합치기) |
| 6. ③ 계획 | 11/10 | `ai/plan.ts`(2~3안), 걸린 안만 수정, `ai/review.ts` | 검사 통과한 안만 남음, 실패 시 규칙 일정 1안 | ✅ 가짜 LLM 5개, 실제 Gemini로 2~3안 검사 통과(요청당 호출 5회·약 25초) |
| 7. 연결 + 화면 | 11/23~26 | `kakao.ts`, `/api/plan` 스트리밍, `/plan/making`, `/trip/[id]` 안 비교 → 상세 | E2E 입력 → 비교 → 상세. 비교 화면 시안 먼저 | |
| 8. 풀어주기·추가 질문 | 11/27~29 | `ai/explain.ts`, `ai/ask.ts` + `/plan/ask`, 예시 루트 JSON | 예시 루트가 LLM 없이 열림 | |
| 9. 평가·마무리 | 11/30~12/3 | `scripts/eval-ai.ts`, `docs/eval/`, 사용자 테스트, README 숫자, 배포 | README에 정확도·위반 0건 | |
| 나중에 | — | 공유 링크, Supabase `trips`, 요약 이미지 | | |

## 카카오 시험 결과 (11/10, `scripts/kakao/smoke.ts`)

- REST 키: 장소 검색 ✅, 1:1 길찾기 ✅(강릉역→오죽헌 8분·2.9km), 다중 목적지 ✅ — 단 **출발점 반경 10km 밖은 계산 안 됨**(강릉역→속초 실패). 7단계 `kakao.ts`: 10km 안은 다중 목적지, 밖은 1:1 또는 추정치.
- JavaScript 키: 처음엔 `domain mismatched!` → 사이트 도메인에 `http://localhost:3000` 등록 후 지도 생성 확인 ✅. 배포할 때 Vercel 주소도 등록.

## 판단 규칙 개정 (11/10)

질문은 "이 사람이 여기서 관광할 수 있나" 하나. 코드는 원문상 '불가'(부적합)·'부분가능'(최소 주의)·알려진 걷는 거리 초과만 강제하고,
'모름'은 판단을 막지 않고 출발 전 확인 질문으로 붙인다. 휠체어는 '들어갈 수 있다'는 원문(진입)이 있어야 적합.
LLM이 실패했을 때의 규칙 판단은 엄격(필수 '모름'이 있으면 확인 필요). ① 다시 읽기(예시 추가)로 경사 '모름' 17곳이 '가능'으로, 이전 결과와 항목 일치율 96.4%.

## 순서 조정 (11/10)

지도·결과 화면보다 **루트가 제대로 나오는지**를 먼저 본다: 4 → 5·6(AI 판단·AI 일정) → 결과 확인은 스크립트·간단한 목록 화면 → 지도·카카오 연결(7)은 그다음.
이동시간은 카카오를 붙이기 전까지 직선거리 추정(`engine/travel.ts`, 화면에 '추정' 표시).

## 필요한 키·사람 일

- Gemini `GEMINI_API_KEY` ✅ · 관광공사 `TOUR_API_KEY` ✅ · 카카오 REST 키 ✅ · 카카오 JS 키 ✅(localhost:3000 등록, 지도 생성 확인)
