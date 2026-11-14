# 이음길 AI — Claude Code 작업 안내
@AGENTS.md

휠체어 이용자, 보행이 불편한 고령자, 유모차 동반 가족이 영동권(강릉·속초·동해) 관광지를
당일~2박 3일 루트로 돌 수 있는지 AI가 공공 무장애 정보를 읽고 판단해, 성격이 다른 일정 2~3안과 현장 안내로 보여주는 웹서비스.
2026 My AI 랩(강릉과학산업진흥원) 과제. **12/7까지 GitHub 제출** — 평가는 저장소만 보고 초기 계획서 대비 완성도를 본다(중간평가 없음).

- 기획·설계 문서(참고용, 갱신 중단): https://claude.ai/artifact/TZSUcqLRtTSZst2edEm5L6
- 디자인 시안 v2(참고용, 갱신 중단): https://claude.ai/artifact/S2A6vTW33w69QtFQssuoTu
- 기준 문서(이 저장소): `docs/planning.md`(기획 문서) · `docs/impl-plan.md`(구현 순서·진행 상태) · `docs/ai-plan.md`(**AI 설계 v3, 확정 — AI·데이터 관련은 이 문서가 우선**)
  · `docs/design/`(화면별 시안 원본) · `docs/data/`(조사표, `tour-api-fields.md` 공공데이터 조사) · `docs/handoff.md`(열린 결정 목록)

## 절대 원칙
1. **LLM이 읽고·판단하고·계획하고·풀어준다. 코드는 계산과 검사만 강제한다.** (상세: `docs/ai-plan.md`)
   - LLM 4가지 일: ① 읽기(API 문장 → 접근성 값·운영시간·동선 초안, 미리) ② 판단(이 사람에게 적합/주의/부적합/확인 필요, 요청할 때)
     ③ 계획(성격이 다른 일정 2~3안, 요청할 때) ④ 풀어주기(도착 후 동선, 출발 전 확인할 것) — 미리 읽은 동선 + 체크리스트로 하고, 요청할 때 다시 다듬는 호출·추가 질문 0~3개는 11/14에 뺐다.
   - LLM 출력은 전부 JSON 스키마로 받고(ajv) 코드가 검사한 뒤 화면에 그린다. 근거 id가 없거나 넘겨준 문장 밖이면 버린다.
     입력에 없는 시설·시간·거리를 쓰지 않는다.
   - **시각은 LLM이 쓰지 않는다.** 도착·출발 시각은 코드가 계산한다. 검사를 통과한 안만 화면에 나간다.
   - 안전 하한(코드): 필수 항목 '불가' → 부적합, '부분가능' → 최소 주의, 알려진 걷는 거리 초과 → 부적합. '모름'은 판단을 막지 않고 전화로 물어볼 질문 + 공식 전화번호로 붙인다(11/10 개정. 휠체어는 '들어갈 수 있다'는 진입 원문이 없으면 확인 필요. LLM이 실패해 규칙만으로 판단할 때는 엄격: 필수 '모름' → 확인 필요). 화면은 적합·주의여도 물어볼 것이 있으면 '적합 · 전화로 확인할 것 있음'처럼 함께 표시한다. LLM은 더 보수적으로만 바꿀 수 있다.
   - LLM이 실패하면(시간 초과, 형식 오류, 호출 한도) 규칙 일정 1개를 보여준다. 시연이 멈추면 안 된다.
2. **'모름'은 숨기지 않고 확인할 방법을 준다.** access 값은 `가능 | 부분가능 | 불가 | 모름`. 빈칸은 '모름'으로 두고 지어내지 않는다.
   - 확인 방법은 둘(11/14): 엘리베이터·장애인 화장실·장애인 주차·출입구·수유실·걷는 거리는 **전화**, 노면·경사·쉴 곳은 **가서 보기**(코드가 정한 안내 한 줄, `lib/trip/questions.ts`). '전화로 확인할 것 있음' 표시와 체크리스트는 전화 항목만 센다.
   - '모름'에는 물어볼 질문(`ask`), 부분가능에는 메모, 장소에는 공식 전화번호가 반드시 있어야 한다. 하나라도 빠지면 빌드 검사가 실패한다.
   - 값마다 출처 등급: `ai`(LLM이 관광공사 문장을 읽고 정리) / `human`(사람이 전화·현장으로 확인). 화면에 함께 표시한다.
3. **카카오 길찾기 결과는 저장하지 않는다**(캐싱 금지 정책). 공유 링크에는 장소·순서·체류·이유 같은 안 JSON만 저장하고,
   이동시간·시각·경로는 열 때 다시 계산한다. 검사 위반도 종류와 장소만 저장한다.
   탭에 보관하는 일정(TripView)의 시각도 직선 추정이고, 화면은 열 때 `/api/legs`로 실제 값을 받아 메모리에서만 다시 계산한다(`lib/trip/real-travel.ts`, 11/14).
4. **키는 서버에서만.** 카카오 REST·Gemini·OpenAI·Supabase 서비스 키·관광공사 키는 서버 코드·스크립트와 환경변수에만.
   카카오 JS 키만 브라우저에 노출(도메인 제한).
5. **개인정보 수집 없음.** 이름·연락처·IP 저장 금지. 저장하는 것은 유형·조건·날짜·순서뿐. Gemini·OpenAI에는 입력 조건과 장소 정보만 보낸다(OpenAI는 `store: false`).
6. 지도 경로는 "일반 차량 경로"로만 표현한다. 휠체어 안전 경로라고 쓰지 않는다.

## 스택
Next.js(App Router) + TypeScript(strict) + Tailwind CSS · 카카오맵 JS SDK(표시) · 카카오모빌리티
다중 목적지/다중 경유지 길찾기(이동시간·경로선) · Gemini(기본 `gemini-3.5-flash-lite`, 먼저) + OpenAI(`gpt-6-luna`, 503·429·30초 넘게 늦으면 같은 요청을 보내 먼저 온 답, 11/14) — 읽기·판단·계획·풀어주기, JSON 응답
· 한국관광공사 무장애 여행정보 API(KorWithService2, 스크립트 전용) · Vercel.
공유 링크·Supabase(`trips`)는 나중에(메인 기능 먼저, `docs/impl-plan.md`). Gemini SDK는 `@google/genai`(`client.interactions.create` + `response_format`), OpenAI는 패키지 없이 fetch로 Responses API(엄격 JSON 스키마, `reasoning.effort: none`).
글꼴 Pretendard.

## 폴더 구조 (지금 · 11/14 정리)
```
src/app/            page.tsx(시작) · places/(관광지 둘러보기: 지역·분야·AI 한 줄 소개·접근성 요약 → 꼭 가고 싶은 곳에 담기) · plan/(입력 4단계 · making/(만드는 중))
                    · trip/[id]/(안 비교 → 상세, id = new | example) · trip/[id]/final(확정 일정 + 지도)
                    · api/plan(전체 흐름 + 스트리밍) · api/route-line(카카오 경로선, 저장 안 함) · (나중에) api/trips
src/components/     ui/(shadcn, 44px·16px로 고친 것) · plan/(입력 단계 부품) · trip/(결과·확정 화면 부품: 장소 카드·안 고르기·바꾸기 창·체크리스트 …)
                    · map/TripMap.tsx(카카오 지도) · photos/PlacePhoto.tsx(사진·크게 보기) · TopBar · Logo · Intro · icons
src/lib/ai/         schemas.ts(LLM 출력 JSON 스키마) · guards.ts(근거·안전 하한) · judge.ts(② + 자기 일관성)
                    · plan.ts(③ 여러 안 + 수정) · review.ts(평가자) · trip.ts(요청 하나의 전체 흐름) · (예정) explain.ts(④)
src/lib/engine/     conditions.ts · filter.ts(후보 거르기) · frames.ts(날짜별 틀) · timeline.ts(시각 계산) · check.ts(일정 검사) · fallback.ts(규칙 일정) · travel.ts
src/lib/trip/       view.ts(화면 값) · store.ts(탭 보관, 예시 칸 분리) · example.ts(예시 루트) · edit.ts(바꾸기) · alternatives.ts · questions.ts · labels.ts · map-points.ts
src/lib/plan/       입력값 types · store · progress · dates · summary   ·   src/lib/places/ 사진·검사·질문
src/lib/            llm.ts(AI 호출은 이 파일 하나로: 제공자 순서 AI_ORDER, 모델 GEMINI_MODEL_FAST/READ · OPENAI_MODEL) · kakao.ts(서버 전용) · types.ts · utils.ts · use-media.ts · intro.ts
data/               places.json · places.schema.json · evidence.json · photos.json · featured.json(대표 관광지) · ai/summary.json(한 줄 소개) · docs/places/{id}.md(근거 문장) · ai/read/(① 읽기 결과)
                    · eval/(read-v1 · 선택 human.json) · raw/·build/(API 원본·중간 산출물, 커밋 안 함)
scripts/            tour/(관광공사 API 수집·보고서·사진) · ai/(① 읽기·합치기·예시·고정 결과) · readme/(캡처·구조도) · dev/(연결 확인·시험) — scripts/README.md
tests/engine/       시나리오 10개(기획 문서 표) — 목표: 필수 조건 위반 0건
tests/ai/           가짜 LLM으로 가드 검사(근거 없는 판단 버림, 모름≠적합, 시각은 코드 값, 실패 시 규칙 일정)
tests/…             src와 같은 폴더(lib·places·plan·text·trip·api) · tests/e2e/ Playwright 화면 흐름
```

## 사용자 입력 (4단계)
1. 언제·어디서: 날짜 범위(당일~2박 3일), 도착 지점, 이동수단(자가용·렌터카 / 택시), 자가용이면 장애인 표지 여부,
   첫날 시작·마지막 날 마치는 시각, 마지막 날 떠나는 곳(기본: 도착 지점), 1박 이상이면 숙소 지역(강릉·속초·동해·미정, 2박 3일은 밤마다: 둘째 밤 기본 '첫째 밤과 같음')
2. 누구와: 휠체어 / 보행 불편 고령자 / 유모차 (중복)
3. 꼭 필요한 조건: 유형별 필수 조건이 기본으로 켜짐. 고령자면 한 번에 걸을 수 있는 거리(100/300/500m/제한 없음)
4. 좋아하는 곳: 바다·해변 / 자연·산책 / 역사·문화 / 전시·박물관 / 시장·먹거리 / 전망·체험, 일정 밀도, 꼭 가고 싶은 곳
- 그다음 `/plan/making`(진행 단계 스트리밍) → `/trip/[id]`(안 2~3개 비교 → 고른 안 상세)
  → 장소별 [바꾸기](AI가 판단한 근처 후보, 코드가 다시 계산·검사, AI 호출 없음) · 날짜마다 [순서 고치기](위·아래·빼기, 11/14) → 이 일정으로 정하기 → `/trip/[id]/final`(확정 일정 + 지도)

## 유형별 필수 조건 (요약, 상세는 기획 문서)
- 휠체어: 계단·단차 없는 진입, 엘리베이터(층 있는 곳), 급경사 없음, 포장·데크 노면, 장애인 화장실,
  장애인 전용 주차(**자가용 + 표지 차량일 때만**)
- 유모차: 엘리베이터 필수, 단차·노면·수유실은 주의/선호
- 고령자: 주차장→입구 거리와 관람 동선이 입력한 거리 이하
- 여러 유형 선택 시 항목마다 가장 엄격한 값

## 일정 흐름 (`POST /api/plan`, 상세: `docs/ai-plan.md`)
미리(스크립트): ① 읽기로 152곳의 access·운영시간·동선 초안을 `places.json`에 만들어 둔다. 사람 판정은 하지 않는다(11/10). 사람이 확인한 값이 생기면 `human`으로 덮어쓴다.
요청할 때:
1. 후보 거르기(코드): 지역·휴무·필수 조건 '불가' 제외, 최대 20곳
2. ② 판단(LLM, 후보를 한 호출에 묶어 3번): 적합/주의/부적합/확인 필요 + 이유 + 근거 + 확신도 → 안전 하한(코드)
3. 이동시간 표(카카오 다중 목적지, 날짜마다 ≤6회)
4. ③ 계획(LLM 1회로 2~3안, 안마다 전략 지정, 후보는 적합·주의 우선 + 모자라면 확인 필요를 표시해서): 장소·순서·날짜·체류·쉬는 곳·이유·주의·확인 질문. 시각 없음
5. 시각 계산 + 검사(코드): 이동 + 체류 + 유형별 여유 + 승하차 여유 + 12~14시 점심 60분, 운영시간·하루 범위, 꼭 가고 싶은 곳이 모든 안에 있는지(11/14, 겹침 계산에서는 뺌)
6. 위반 → 걸린 안만 다시 요청(최대 2회), 못 통과한 안은 뺀다 → 평가자(LLM): 피로도·여유·취향·화장실 간격, 2점 이하면 1회 수정
7. ④ 풀어주기: 도착 후 동선은 ① 읽기 결과, 출발 전 확인할 것(질문 + 전화)은 체크리스트, 대안은 코드가 고르고 ② 판단 이유를 그대로(요청할 때 AI 호출 없음, 11/14)
8. 실패 시 규칙 일정 1개 → 경로선(다중 경유지 1회)
- LLM 호출은 요청당 약 5~8회. 후보가 적으면 안 1개만 만들고 그렇다고 알린다. **2박 3일은 1안**(고른 밀도 + 좋아하는 곳 중심, 11/14 결정) — 비교 대신 [바꾸기]로 고친다. 후보는 당일·1박 20곳, 2박 3일 30곳.
- 시간만 조금 넘친 안은 코드가 맞춘다(`engine/repair.ts`: 체류를 권장 최소로 → 뒤쪽 장소 빼기 최대 2곳, 꼭 가고 싶은 곳은 남김). 휠체어·어르신 '많이'는 하루 4곳까지.

## 디자인 토큰 (시안 v2)
기본 #1E6FD0 · 연한 기본 #EAF2FD · 기본 위 글자 #1450A3 · 면 #F2F4F6 · 글자 #191F28 · 보조 글자 #4E5968
· 경로선 #E8743B · 주의 #FFF4E5/#7A4A00 · 불가 #FBEAE7/#8A2A1C · 본문 16px 이상 · 터치 영역 44px 이상
· 상태는 색만이 아니라 기호(✓ ! ✕)와 글자로 함께 표시 · 모바일 우선(시안 390px), PC는 왼쪽 지도 + 오른쪽 루트(시안 1440px)
· 글자 크기는 rem 단위 → 휴대폰·브라우저의 글자 크기 설정과 확대를 그대로 따른다("가 글씨 크게" 버튼은 11/11 실사용 피드백으로 뺐다)
· Tailwind v4라 토큰은 `src/app/globals.css`의 `@theme`에 있다(`bg-primary`, `text-ink-sub`, `bg-caution-bg`, `min-h-touch` 등)
· 결과 '안 비교' 화면은 시안에 없다 → 새로 그린다(`docs/ai-plan.md` 화면 표)
· **shadcn/ui**(Radix, `components.json`): `src/components/ui/`에 button·card·dialog·tabs·sheet·toggle-group·toggle.
  shadcn 변수(--primary, --background, --border…)는 `globals.css` `:root`에서 우리 토큰을 가리킨다 — 토큰 값은 `@theme static`에서만 고친다.
  `--color-primary`는 우리 토큰 이름이라 `@theme inline`에 다시 잇지 않는다(잇으면 shadcn 기본 검정으로 바뀜).
  `button.tsx`는 우리 규칙(16px 이상·44px 이상)으로 고쳐 둔 파일 → `npx shadcn add button`이나 `--overwrite` 금지.
  새 컴포넌트를 넣으면 기본 크기(h-8, text-sm)를 44px·16px 규칙으로 고치고 영어 문구(Close 등)를 한국어로 바꾼다.
  파일 이름은 소문자(Linux CI·Vercel은 대소문자를 구분한다).

## 데이터와 테스트
- 1차 출처: 한국관광공사 무장애 여행정보 API. 강릉·속초·동해 182곳 → 관광지 152곳(`build-places.ts`가 관광지 아닌 곳·전화 없는 곳 제외).
  수집은 `scripts/tour/`, 필드 조사는 `docs/data/tour-api-fields.md`. 열린관광 사이트(access.visitkorea.or.kr)는 사람 검수 때 보는 출처로만 쓴다(자동 수집 안 함).
- `data/photos.json`: 관광지 사진 분류(풍경/편의시설/기타, 공공누리 유형). 대표는 풍경만, 1유형은 `public/photos/`에 줄여 저장, 3유형은 원본 통째로(변경 금지). `scripts/tour/classify-photos.ts --build-only`로 다시 만든다.
- `data/places.json`: API 기본 정보 + ① 읽기 결과(등급 `ai`) + (선택) 사람 확인 값(등급 `human`). 만드는 순서: `scripts/tour/build-places.ts` → `scripts/ai/read-places.ts` → `scripts/ai/merge-places.ts`.
- 휠체어·어르신은 노면·경사·거리 '모름'이 많아 대부분 '확인 필요' → 일정에 넣되 질문 + 전화번호로 표시한다(11/10 결정). 사람 판정은 하지 않는다. 조사표 32곳은 '유명한 곳' 판단 기준으로 쓴다.
- `tests/fixtures/places.sample.json`: 테스트 전용 가짜 장소(`[샘플] 관광지 A`, id `GN91~`). 화면·README 수치에 쓰지 않는다.
- 카테고리는 스키마의 6개만 쓴다. 조사표의 `바다·자연`은 `바다·해변` 또는 `자연·산책`으로 나눠서 옮긴다.
- 명령: `npm test`(vitest) · `npm run test:e2e`(Playwright) · `npm run validate:places [-- 파일]` · `npm run build`(prebuild에서 장소 검사가 먼저 돈다)
  · `npx tsx scripts/tour/lookup.ts "장소명"`(API 상세 바로 보기)

## 작업 방식
- 작은 단위로 자주 커밋한다. 커밋 메시지는 한국어, `feat: / fix: / docs: / chore: / test:` 접두어.
- UI 문구는 한국어, 쉬운 말. 관광지 이름은 데이터의 공식 표기를 쓴다.
- 새 기능 전에 테스트를 먼저 깨지게 만들고 고친다(특히 조건 위반 0건, 가짜 LLM 가드 테스트).
