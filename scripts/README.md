# scripts — 데이터 만들기·확인용 스크립트

서비스가 요청을 받을 때는 이 스크립트들을 쓰지 않습니다. 데이터를 미리 만들거나, 연결을 확인하거나, README 그림을 만들 때만 씁니다.
키는 모두 `.env.local`(커밋 안 함)에서 읽습니다: `TOUR_API_KEY`(관광공사), `GEMINI_API_KEY`, `KAKAO_REST_API_KEY`.

## 1. 장소 데이터 만들기 (순서대로)

| 순서 | 명령 | 하는 일 | 결과 |
|---|---|---|---|
| 1 | `npx tsx scripts/tour/probe.ts` | 관광공사 API로 강릉·속초·동해 목록 받기(약 10~20회 호출) | `data/raw/tour/list-*.json`(커밋 안 함) |
| 2 | `npx tsx scripts/tour/fetch-all.ts` | 182곳 상세 5종 받기(약 910회, 끊겨도 이어서) | `data/raw/tour/places/*.json`(커밋 안 함) |
| 3 | `npm run data:build` | 관광지 아닌 곳·전화 없는 곳 제외 → 152곳 기본 정보 + 근거 문단 | `data/build/`, `data/docs/places/*.md`, `data/evidence.json` |
| 4 | `npm run data:read` | **① AI 읽기**(Gemini): 문장 → 접근성 10항목·근거·모르면 질문·운영시간·동선 | `data/ai/read/*.json` |
| 5 | `npm run data:merge` | 기본 정보 + AI 읽기 + 사람 확인 값 합치기(근거 없는 값은 '모름'+질문으로) | `data/places.json` |
| 6 | `npm run validate:places` | 빌드 검사('모름'엔 질문, 부분가능엔 메모, 장소엔 전화) — `npm run build` 전에 자동 | — |
| 7 | `npm run data:photos` | 사진 분류 결과로 대표 사진 고르기·작은 사진 만들기 | `data/photos.json`, `public/photos/`, `src/lib/places/photo-index.json` |

- `scripts/tour/report.ts` — 받은 원본으로 "무엇을 얼마나 받을 수 있는지" 보고서 → `docs/data/tour-api-fields.md`
- `scripts/tour/lookup.ts "장소명"` — 장소 하나의 API 상세를 화면에 바로 보기(저장 안 함)
- `scripts/tour/client.ts`, `scripts/tour/evidence.ts` — 위 스크립트들이 같이 쓰는 API 호출·근거 문단 함수
- `scripts/ai/human-template.ts` → `scripts/ai/human-import.ts` — (선택) 사람이 전화·현장으로 확인한 값을 양식으로 받아 `data/eval/human.json`에 넣기(5단계에서 등급 `human`으로 반영)

## 2. 결과 데이터 만들기 (실제 Gemini)

| 명령 | 하는 일 | 결과 |
|---|---|---|
| `npm run example:make` | 시작 화면 '예시 루트'용 결과를 실제 AI로 한 번 만들기(안 3개가 나올 때까지 최대 3번) | `src/lib/trip/example-trip.json` |
| `npx tsx scripts/ai/eval-judge.ts` | ② AI 판단 평가: 6개 장면 × 3회 판단으로 일치율·확신도·안전 하한·근거 버림, Gemini vs OpenAI(`--report`는 AI 없이 표만) | `data/eval/judge-v1.md`, `judge-v1.json` |
| `npx tsx scripts/ai/save-trip-view.ts` | 화면 흐름 테스트(E2E)·README 캡처용 결과 만들기 | `tests/e2e/fixtures/trip-view.json` |

## 3. README 그림

| 명령 | 하는 일 | 결과 |
|---|---|---|
| `npm run readme:capture` | 화면 캡처 15장(개발 서버 `npm run dev`가 켜져 있어야 함). 시작 화면 미리보기도 함께 갱신 | `docs/readme/*.png`, `public/preview/` |
| `npm run readme:architecture` | 구조도(글을 고치고 다시 실행) | `docs/readme/architecture.png` |

## 4. 확인·시험용 (`scripts/dev/`)

| 명령 | 하는 일 |
|---|---|
| `npx tsx scripts/dev/gemini-smoke.ts` | Gemini 키·모델 연결 확인(문장 하나를 JSON으로 읽혀 보기) |
| `npx tsx scripts/dev/kakao-smoke.ts` | 카카오 REST·JS 키 확인(결과는 화면에만, 저장 안 함) |
| `npx tsx scripts/dev/try-rule-plan.ts wheelchair --nights 1` | AI 없이 규칙 일정만 실제 152곳으로 돌려 보기 |
| `npx tsx scripts/dev/try-trip.ts wheelchair --cat "바다·해변"` | 실제 Gemini로 전체 흐름 돌려 보기(규칙 일정 vs AI 일정) |
| `npx tsx scripts/dev/time-trip.ts 1박` | 일정 만들기 시간 재기(AI 호출마다 시간·시도 횟수) — 느려졌을 때 원인 가르기 |
