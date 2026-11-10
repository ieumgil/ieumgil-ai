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
| 1. 장소 스키마 v3 | 11/11 | `types.ts`, `places.schema.json`, `validate.ts`, 샘플 데이터: `모름`+`ask`, 등급 `ai/human`, 근거 id, `on_site`, 전화 필수, `tour_content_id` | '모름'에 질문 없음·부분가능 메모 없음·전화 없음 → 검사 실패 | |
| 2. AI 기반 | 11/12 | `llm.ts`(Gemini/가짜 교체, 시간 제한, 재시도, 예비 모델), `ai/schemas.ts`(근거 id enum), `ai/guards.ts` | `tests/ai`: 근거 없는 답 버림, 모름≠적합, 불가→부적합, 형식 오류 재시도 후 버림 | |
| 3. 장소 데이터 | 11/13~14 | `scripts/tour/build-places.ts`(기본 정보·전화·1유형 사진·카테고리, 관광지 아닌 곳 제외, 근거 문서), `scripts/ai/read-places.ts`(① 읽기, 묶음·이어 받기), 사람 판정 40곳 양식 | `places.json` 검사 통과, '모름' 비율 보고, 양식 전달 | |
| 4. 코드 엔진 | 11/15~17 | `filter.ts`, `timeline.ts`, `check.ts`, `fallback.ts` | 엔진 시나리오 10개 통과(필수 조건 위반 0건) | |
| 5. ② 판단 | 11/18~19 | `ai/judge.ts` + 프롬프트, 3회 비교·확신도 | 가짜 LLM 테스트, 실제 Gemini 시나리오 5개 | |
| 6. ③ 계획 | 11/20~22 | `ai/plan.ts`(2~3안), 걸린 안만 수정, `ai/review.ts` | 검사 통과한 안만 남음, 실패 시 규칙 일정 1안 | |
| 7. 연결 + 화면 | 11/23~26 | `kakao.ts`, `/api/plan` 스트리밍, `/plan/making`, `/trip/[id]` 안 비교 → 상세 | E2E 입력 → 비교 → 상세. 비교 화면 시안 먼저 | |
| 8. 풀어주기·추가 질문 | 11/27~29 | `ai/explain.ts`, `ai/ask.ts` + `/plan/ask`, 예시 루트 JSON | 예시 루트가 LLM 없이 열림 | |
| 9. 평가·마무리 | 11/30~12/3 | `scripts/eval-ai.ts`, `docs/eval/`, 사용자 테스트, README 숫자, 배포 | README에 정확도·위반 0건 | |
| 나중에 | — | 공유 링크, Supabase `trips`, 요약 이미지 | | |

## 필요한 키·사람 일

- Gemini `GEMINI_API_KEY` ✅ · 관광공사 `TOUR_API_KEY` ✅ · 카카오 JS·REST 키(7단계 전, 11/22까지) · 강환일 님 사람 판정 40곳(3단계 후)
