# 이음길 AI — 개발 안내

휠체어 이용자, 보행이 불편한 고령자, 유모차 동반 가족이 영동권(강릉·속초·동해) 관광지를
당일~2박 3일 루트로 돌 수 있는지 AI가 공공 무장애 정보를 읽고 판단해, 성격이 다른 일정 2~3안과 현장 안내로 보여주는 웹서비스.
2026 My AI 랩(강릉과학산업진흥원) 과제. 이 파일은 개발할 때 지키는 원칙·구조·명령을 모은 안내다(AI 코딩 도구도 이 파일을 읽는다).

- 기준 문서: `docs/planning.md`(기획 문서) · `docs/impl-plan.md`(구현 순서·진행 상태) · `docs/ai-plan.md`(**AI 설계 v3, 확정 — AI·데이터 관련은 이 문서가 우선**)
  · `docs/design/`(화면별 시안 원본) · `docs/data/`(조사표, `tour-api-fields.md` 공공데이터 조사)
- Next.js 16(App Router, Cache Components)은 예전 버전과 API가 다르다. 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 안내를 먼저 본다.

## 절대 원칙
1. **LLM이 읽고·판단하고·계획하고·풀어준다. 코드는 계산과 검사만 강제한다.** (상세: `docs/ai-plan.md`)
   - LLM 4가지 일: ① 읽기(API 문장 → 접근성 값·운영시간·동선 초안, 미리) ② 판단(이 사람에게 적합/주의/부적합/확인 필요, 요청할 때)
     ③ 계획(성격이 다른 일정 2~3안, 요청할 때) ④ 풀어주기(도착 후 동선, 출발 전 확인할 것) — 미리 읽은 동선 + 체크리스트로 하고, 요청할 때 다시 다듬는 호출·추가 질문 0~3개는 11/14에 뺐다.
   - LLM 출력은 전부 JSON 스키마로 받고(ajv) 코드가 검사한 뒤 화면에 그린다. 근거 id가 없거나 넘겨준 문장 밖이면 버린다.
     입력에 없는 시설·시간·거리를 쓰지 않는다.
   - **시각은 LLM이 쓰지 않는다.** 도착·출발 시각은 코드가 계산한다. 검사를 통과한 안만 화면에 나간다. 날씨(기상청 예보) 문구도 코드가 정한 고정 문구뿐이고 LLM이 쓰지 않는다(11/15).
   - 안전 하한(코드): 필수 항목 '불가' → 부적합, '부분가능' → 최소 주의, 알려진 걷는 거리 초과 → 부적합. '모름'은 판단을 막지 않고 전화로 물어볼 질문 + 공식 전화번호로 붙인다(11/10 개정. 휠체어는 '들어갈 수 있다'는 진입 원문이 없으면 확인 필요. LLM이 실패해 규칙만으로 판단할 때는 엄격: 필수 '모름' → 확인 필요). 화면은 적합·주의여도 물어볼 것이 있으면 '적합 · 전화로 확인할 것 있음'처럼 함께 표시한다. LLM은 더 보수적으로만 바꿀 수 있다.
   - LLM이 실패하면(시간 초과, 형식 오류, 호출 한도) 규칙 일정 1개를 보여준다. 시연이 멈추면 안 된다.
2. **'모름'은 숨기지 않고 확인할 방법을 준다.** access 값은 `가능 | 부분가능 | 불가 | 모름`. 빈칸은 '모름'으로 두고 지어내지 않는다.
   - 확인 방법은 둘(11/14): 엘리베이터·장애인 화장실·장애인 주차·출입구·수유실·걷는 거리는 **전화**, 노면·경사·쉴 곳은 **가서 보기**(코드가 정한 안내 한 줄, `lib/trip/questions.ts`). '전화로 확인할 것 있음' 표시와 체크리스트는 전화 항목만 센다.
   - '모름'에는 물어볼 질문(`ask`), 부분가능에는 메모, 장소에는 공식 전화번호가 반드시 있어야 한다. 하나라도 빠지면 빌드 검사가 실패한다.
   - 값마다 출처 등급: `ai`(LLM이 관광공사 문장을 읽고 정리) / `public`(행정안전부 공중화장실 공공데이터를 코드가 그대로 옮김 — 장애인 화장실·기저귀 교환대를 '가능'으로만 올림, 11/14) / `human`(사람이 전화·현장으로 확인). 우선순위 human > public > ai. 화면에 함께 표시한다(공공데이터는 기준일과 함께).
3. **카카오 길찾기 결과는 저장하지 않는다**(캐싱 금지 정책). 공유 링크에는 장소·순서·체류·이유 같은 안 JSON만 저장하고,
   이동시간·시각·경로는 열 때 다시 계산한다. 검사 위반도 종류와 장소만 저장한다.
   탭에 보관하는 일정(TripView)의 시각도 직선 추정이고, 화면은 열 때 `/api/legs`로 실제 값을 받아 메모리에서만 다시 계산한다(`lib/trip/real-travel.ts`, 11/14).
   날씨(기상청 예보)도 저장하지 않는다 — 열 때 `/api/weather`로 받아 메모리에서만 쓰고, 서버는 발표 시각 기준 짧은 캐시만 둔다(11/15).
4. **키는 서버에서만.** 카카오 REST·Gemini·OpenAI·Supabase 서비스 키·관광공사 키·기상청(공공데이터포털) 키 `KMA_API_KEY`는 서버 코드·스크립트와 환경변수에만.
   카카오 JS 키만 브라우저에 노출(도메인 제한).
5. **개인정보 수집 없음.** 이름·연락처·IP 저장 금지. 저장하는 것은 유형·조건·날짜·순서뿐. Gemini·OpenAI에는 입력 조건과 장소 정보만 보낸다(OpenAI는 `store: false`).
6. 지도 경로는 "일반 차량 경로"로만 표현한다. 휠체어 안전 경로라고 쓰지 않는다.

## 스택
Next.js(App Router) + TypeScript(strict) + Tailwind CSS · 카카오맵 JS SDK(표시) · 카카오모빌리티
다중 경유지 길찾기(실제 이동시간·경로선, 날짜마다 1회 — 다중 목적지는 출발점 10km 밖을 못 재서 안 씀) · Gemini(기본 `gemini-3.5-flash-lite`, 먼저) + OpenAI(`gpt-6-luna`, 503·429·30초 넘게 늦으면 같은 요청을 보내 먼저 온 답, 11/14) — 읽기·판단·계획·풀어주기, JSON 응답
· 한국관광공사 무장애 여행정보 API(KorWithService2, 스크립트 전용) · 행정안전부 전국공중화장실표준데이터(CSV, 스크립트 전용, 원본 커밋 안 함) · 기상청 단기·중기예보(공공데이터포털 15084084·15059468, 서버 전용 `/api/weather`, 11/15) · Vercel.
공유 링크는 Supabase(`trips`, 서버 키로 REST, RLS, 11/14 구현) · 인쇄는 A4 한 장 일정표(`components/trip/PrintSheet.tsx`). Gemini SDK는 `@google/genai`(`client.interactions.create` + `response_format`), OpenAI는 패키지 없이 fetch로 Responses API(엄격 JSON 스키마, `reasoning.effort: none`).
글꼴 2개만(11/27 시작 화면 새 시안): Pretendard(본문·제목·숫자 전부, SIL OFL 1.1) + 여기어때 잘난체 고딕(시작 화면 히어로 문구·바로가기 이름만, GC COMPANY 무료 글꼴 — 수정·재배포 허용). 둘 다 자체 호스팅.

## 폴더 구조 (지금 · 11/24 정리)
```
src/app/            page.tsx(시작: 히어로 · 바로가기 5칸 · 단계 소개 · 루트 카드 3장 · 대표 관광지) · about/(서비스 소개 · how 만든 방법) · fonts/(잘난체 고딕 부분 글꼴) · places/(관광지 둘러보기: 지역·분야·AI 한 줄 소개·접근성 요약 → 꼭 가고 싶은 곳에 담기) · plan/(입력 4단계 · making/(만드는 중))
                    · trip/[id]/(안 비교 → 상세, id = new | example | route-wheelchair·elder·stroller = 루트 카드, 안 하나만) · trip/[id]/final(확정 일정 + 지도)
                    · api/plan(전체 흐름 + 스트리밍) · api/route-line(카카오 경로선, 저장 안 함) · api/legs · api/trips(공유 링크 저장, 11/14) · api/weather(기상청 예보, 저장 안 함, 11/15) · s/[id](공유 읽기 전용, 서버가 Supabase에서 읽음)
src/components/     ui/(shadcn, 44px·16px로 고친 것) · plan/(입력 단계 부품) · trip/(결과·확정 화면 부품: 장소 카드·안 고르기·바꾸기 창·체크리스트 · DayWeather 날짜별 날씨 …)
                    · trip/TimelineProgress(시간표 스크롤 진행 원·클리어) · home/(시작 화면: IntroSteps 단계 소개·화면 고정 스크롤 · HomeHero(사진 카드 4장 + 문구 상자, public/home/hero) · QuickMenu(바로가기 5칸, public/home/quick) · FeaturedPlaces) · about/(소개 글 틀 Article · PC 차례 Toc · Figures · AccessChart) · Motion(스크롤 등장·숫자 올라가기 — 소개 글 · 시작 화면 · 관광지 둘러보기, 화면 고정 스크롤에는 안 씀)
                    · WeatherTicker(머리줄 오늘 날씨, 11/25) · map/TripMap.tsx(카카오 지도) · photos/PlacePhoto.tsx(사진·크게 보기) · SiteHeader(모든 화면 머리줄) · PageHeader(내부 화면 공용 머리 띠: 하늘색이 아래로 흐려짐, 11/25) · plan/StepTrail(입력 점선 진행 표시) · plan/MakingScene(만드는 중 점 찍힘) · SiteFooter · TopBar · Logo · Intro · icons
src/lib/ai/         schemas.ts(LLM 출력 JSON 스키마) · guards.ts(근거·안전 하한) · judge.ts(② + 자기 일관성)
                    · plan.ts(③ 여러 안 + 수정) · review.ts(평가자) · trip.ts(요청 하나의 전체 흐름) · (예정) explain.ts(④)
src/lib/engine/     conditions.ts · filter.ts(후보 거르기) · frames.ts(날짜별 틀) · timeline.ts(시각 계산) · check.ts(일정 검사) · fallback.ts(규칙 일정) · travel.ts
src/lib/trip/       view.ts(화면 값) · store.ts(탭 보관, 예시 칸 분리) · example.ts(예시 루트) · route-cards.ts(시작 화면 루트 카드 3장) · edit.ts(바꾸기) · alternatives.ts · questions.ts · labels.ts · map-points.ts
src/lib/share/      doc.ts(공유할 값·검사·사라지는 날) · supabase.ts(서버 전용 REST, 서비스 키) · view.ts(열 때 화면 값으로)   ·   supabase/migrations/(trips 테이블·RLS·pg_cron SQL)
src/lib/plan/       입력값 types · store · progress · dates · summary   ·   src/lib/places/ 사진·검사·질문   ·   src/lib/public/(공중화장실 공공데이터 짝짓기·합치기·출처 표시)
src/lib/weather/    kma.ts(기상청 호출, 서버 전용) · service.ts(캐시) · kst·summary·mid(날짜·하루 값) · day-view·caution·labels(화면 값·주의·문구) · use-weather
src/lib/            llm.ts(AI 호출은 이 파일 하나로: 제공자 순서 AI_ORDER, 모델 GEMINI_MODEL_FAST/READ · OPENAI_MODEL) · kakao.ts(서버 전용) · types.ts · utils.ts · use-media.ts · intro.ts
data/               places.json · places.schema.json · evidence.json · photos.json · featured.json(대표 관광지) · ai/summary.json(한 줄 소개) · docs/places/{id}.md(근거 문장) · ai/read/(① 읽기 결과) · public/restrooms.json(짝지은 공중화장실 요약)
                    · eval/(read-v1 · 선택 human.json) · raw/·build/(API 원본·중간 산출물, 커밋 안 함)
scripts/            tour/(관광공사 API 수집·보고서·사진) · public/(공중화장실 공공데이터) · ai/(① 읽기·합치기·예시·고정 결과) · readme/(캡처) · dev/(연결 확인·시험, weather-probe 기상청 키·게이트웨이 확인) — scripts/README.md
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
미리(스크립트): ① 읽기로 152곳의 access·운영시간·동선 초안을 `places.json`에 만들어 둔다. 사람 판정은 하지 않는다(11/10). 사람이 확인한 값이 생기면 `human`으로 덮어쓴다. 공중화장실 공공데이터가 '있음'이면 장애인 화장실·기저귀 교환대를 `public` 가능으로 올린다(11/14).
요청할 때:
1. 후보 거르기(코드): 지역·휴무·필수 조건 '불가' 제외, 최대 20곳
2. ② 판단(LLM, 후보를 한 호출에 묶어 3번): 적합/주의/부적합/확인 필요 + 이유 + 근거 + 확신도 → 안전 하한(코드)
3. 이동시간 표: 계획에는 직선거리 추정 표를 주고, 다 짠 안만 카카오 다중 경유지 길찾기 날짜마다 1회로 실제 구간 시간을 받아 다시 검사(카카오 값은 버림)
4. ③ 계획(LLM 1회로 2~3안, 안마다 전략 지정, 후보는 적합·주의 우선 + 모자라면 확인 필요를 표시해서): 장소·순서·날짜·체류·쉬는 곳·이유·주의·확인 질문. 시각 없음
5. 시각 계산 + 검사(코드): 이동 + 체류 + 유형별 여유 + 승하차 여유 + 12~14시 점심 60분, 운영시간·하루 범위, 꼭 가고 싶은 곳이 모든 안에 있는지(11/14, 겹침 계산에서는 뺌)
6. 위반 → 걸린 안만 다시 요청(최대 2회), 못 통과한 안은 뺀다 → 평가자(LLM): 피로도·여유·취향·화장실 간격, 2점 이하면 1회 수정
7. ④ 풀어주기: 도착 후 동선은 ① 읽기 결과, 출발 전 확인할 것(질문 + 전화)은 체크리스트, 대안은 코드가 고르고 ② 판단 이유를 그대로(요청할 때 AI 호출 없음, 11/14)
8. 실패 시 규칙 일정 1개 → 경로선(다중 경유지 1회)
- LLM 호출은 요청당 약 5~8회. 후보가 적으면 안 1개만 만들고 그렇다고 알린다. **2박 3일은 1안**(고른 밀도 + 좋아하는 곳 중심, 11/14 결정) — 비교 대신 [바꾸기]로 고친다. 후보는 당일·1박 20곳, 2박 3일 30곳.
- 시간만 조금 넘친 안은 코드가 맞춘다(`engine/repair.ts`: 체류를 권장 최소로 → 뒤쪽 장소 빼기 최대 2곳, 꼭 가고 싶은 곳은 남김). 휠체어·어르신 '많이'는 하루 4곳까지.

## 디자인 토큰 (시안 v2 + 11/15 다듬기)
**색은 파랑 #3580db · 초록 #3daa7e 두 가지만(11/24 팀 결정, 다른 강조색을 새로 쓰지 않는다)** — 예외: 시작 화면 히어로·바로가기는 11/27 새 시안 색(파랑 #1553a3 · 초록 #2f993b · 주황 #ed7049, `--color-home-*`, 그 두 구역에만) · 기본 #3580db · 연한 기본 #EBF3FC · 기본 위 글자 #3580db · 면 #F2F4F6 · 글자 #191F28 · 보조 글자 #4E5968
· 경로선 #E8743B · 주의 #FFF4E5/#7A4A00 · 불가 #FBEAE7/#8A2A1C · 본문 16px 이상 · 터치 영역 44px 이상
· 상태는 색만이 아니라 기호(✓ ! ✕)와 글자로 함께 표시 · 모바일 우선(시안 390px), PC는 왼쪽 지도 + 오른쪽 루트(시안 1440px)
· 글자 크기는 rem 단위 → 휴대폰·브라우저의 글자 크기 설정과 확대를 그대로 따른다("가 글씨 크게" 버튼은 11/11 실사용 피드백으로 뺐다)
· Tailwind v4라 토큰은 `src/app/globals.css`의 `@theme`에 있다(`bg-primary`, `text-ink-sub`, `bg-caution-bg`, `min-h-touch` 등)
· 결과 '안 비교' 화면은 시안에 없다 → 새로 그린다(`docs/ai-plan.md` 화면 표)
· **11/15 다듬기(03단계, 'AI가 만든 티' 줄이기)** — 값은 모두 `globals.css` `@theme static`:
  - 보조색 초록 `--color-pine` #3daa7e · 연한 면 `--color-pine-soft` #ecf7f2(11/24부터, 이전 솔숲 #2A6A50) — **장소·지역·일차 정체성에만**(`강릉 · 역사·문화` 같은 지역·분류 글자, 날짜 탭 활성 밑줄·일차 제목).
    버튼·링크·선택 상태·상태 칩·경고·지도에는 쓰지 않는다(상태 칩은 계속 파랑 ✓ ! ✕). 예외 하나: 결과 '안 비교' 카드 위쪽 4px 장식 띠(안 정체성, 파랑·초록 번갈아, 11/25). 입력 4단계에서는 쓰지 않는다. 초록이 혼자 뜻을 나르지 않는다(항상 글자와 함께).
  - 선택 컨트롤 테두리 `--color-line-control` #8B95A1 — **흰 바탕 위**의 안 고른 타일·select·검색칸 테두리(대비 3:1). 회색 면 위에는 쓰지 않는다.
  - 글꼴 **2개만**(11/23 시작 화면 개편 — 11/18 Noto Sans KR에서 바꿈, 11/27 숑숑 → 잘난체 고딕): 본문·제목·숫자·버튼 전부 **Pretendard**(`next/font/local`, 패키지 `pretendard`),
    시작 화면 히어로 문구 '지도로 찾아가는 즐거운 영동 여행길'과 바로가기 이름 5개만 **여기어때 잘난체 고딕**(`src/app/fonts/`, 쓰는 글자만 남긴 4KB, `--font-point`). Pretendard는 SIL OFL 1.1, 잘난체 고딕은 GC COMPANY 무료 글꼴. 외부 CDN 없음.
    구분은 크기·굵기로만. 제목 글꼴 `--font-display`는 `var(--font-sans)`. 본문 자간 0 · 줄 간격 1.6 · 숫자 폭 고정(`tabular-nums`).
  - 글자 크기 4단계 28/20/16/14px(화면 제목·구역 제목·본문·보조, rem). 시작 화면 히어로·바로가기는 시안 크기를 그대로 쓴다(`.home-hero`·`.home-quick`, 바로가기 이름은 휴대폰에서도 16px 이상). 굵기 3단계 400/500/700만 쓴다: 본문 400, 장소 이름·버튼·칩·강조 500(`font-medium`), 700(`font-bold`)은 제목만(h1·h2·h3, 인쇄 일정표는 예외). 그 밖의 크기·굵기 클래스는 정리 감시 테스트(`tests/design/legacy-classes.test.ts`)가 막는다.
  - 사이트 머리줄(`SiteHeader`, 로고 · '이음길' · '즐거운 영동 여행길' · 글자 메뉴 3개 + [여행 루트 만들기] 버튼 — 버튼은 시작 화면·입력 화면에서 숨김, 메뉴·버튼은 `SiteNav.tsx`, 11/25)은 **모든 화면** 맨 위(11/23). 내용 폭은 `SITE_WIDTH`(내용 1360px) — 머리줄·시작 화면·바닥글이 같은 좌우 끝.
  - 시작 화면 히어로·바로가기는 팀이 만든 새 시안(11/27, PSD → `components/home/HomeHero.tsx` · `QuickMenu.tsx` · `public/home/hero` · `public/home/quick`): 영동 사진 카드 4장(대체 글 있음) + 옅은 점선 길(장식) + 반투명 0.5 민트 문구 상자, 그 아래 연회색 판 위 바로가기 5칸. 자리는 시안 1920px 기준(`--u`), 1200px 미만은 문구 → 사진 순서로 쌓고 휴대폰은 사진을 옆으로 넘긴다. 사진에 마우스를 올리면 카드만 30px 떠오르고 사진은 확대하지 않는다(루트 카드와 같은 움직임). 히어로에는 버튼이 없고 바로가기 첫 칸 '여행 루트 만들기'가 주 버튼 역할. 하늘색 `--color-sky` #e3f3f3은 내부 화면 머리 띠에만.
  - **내부 화면 머리 띠(11/25, 단계 4)**: 입력 4단계·만드는 중·결과·확정·공유·둘러보기·소개 글 맨 위는 공용 `PageHeader`(`.page-band`) — 하늘색 `--color-sky`가 아래로 흐려져 흰 바탕에 녹고(강진군문화관광재단 하위 화면 기법), 팀이 그린 점선 길·언덕 선 무늬(`public/hero/band-motif.svg`)를 옅게. 곡선으로 자르지 않고 제목 옆 그림 없음, 제목은 본문 왼쪽 끝. 시간표 세로선은 1px 점선(`.timeline-rail`, 예산 문화관광 코스 기법), 장소 번호 동그라미는 그대로. 입력 단계 진행은 점 4개 + 점선(파랑만). 움직임은 만드는 중 점 찍힘 하나뿐.
  - 시작 화면 레퍼런스(웹쟁이 '관광' 검색): 물결 = 소곳소곳 김포, 루트 카드 = 예당 캠핑장 CSS(`.route-card`, 마우스·초점에 30px 떠오름 — 11/23부터 허용). 옮긴 CSS는 `globals.css`에 출처와 바꾼 점을 주석으로 남긴다.
  - 시작 화면 루트 카드 3색 `--color-card-blue` #3580db · `--color-card-green` #3daa7e · `--color-card-brown` #d5875a, '여행 루트 만들기' 버튼 `--color-cta-green` #3daa7e(11/24 팀이 직접 정함). **글자 대비(axe color-contrast)는 검사하지 않는다**(11/24 팀 결정 — 파랑 3.99·초록 2.90:1이지만 실제로 잘 보인다고 판단). 다른 접근성 규칙은 그대로 검사한다.
  - 간격은 4px 배수. 카드 안 묶음 사이만 12px(compact), 카드·목록 항목 사이 16px, 구역 사이 32px(PC 48px). 모바일 좌우 여백 16px.
  - 반지름 3단계 12·16·24px: 컨트롤 12 · 카드·타일 16 · 시트 24(알약은 `rounded-full`).
  - 면 규칙: S0 평면(구역 대부분, 카드·그림자 없이 간격과 구분선) · S1 선택(11/25 웹쟁이 레퍼런스로 다시 그림 — `.planning/research/selection-controls-2026-11-25.md`, 요소마다 한 가지 변화 + ✓는 항상: 하나 고르는 분할 칸 = 흰 칸 + 1px `line-control` → 2px 파랑 테두리 + 파랑 글자 500 · 알약·타일 = 연회색 면 → 파랑 면 + 흰 글자 · 좋아하는 곳 사진 타일 = 연회색 면 → 옅은 파랑(파랑 15%) + 진한 글자 + 파랑 ✓(큰 면이라 진한 파랑은 너무 셈, 11/25 사용자) · 목록(누구와·조건) = 상자 없는 행 + 구분선, 왼쪽 24px 네모 → 파랑 채움 + 글자 진해짐. 테두리 + 연한 파랑 면 + 원 배지를 함께 쓰지 않는다) · S2 개별 항목(1px 테두리, 그림자 없음, 안에 면 최대 1개) · S3 떠 있는 면(시트·대화상자·아래 고정 바, 불투명 + 위쪽 그림자 — **그림자는 여기만**). 카드 안에 카드를 넣지 않는다. 첫 화면 색 띠는 1개(내부 화면 하늘색 머리 띠 `.page-band`는 화면 배경으로 보고 세지 않는다).
  - 펼치기는 `Disclosure`(`src/components/ui/disclosure.tsx`, 네이티브 `<details>`). 접힌 상태에서도 판정 칩·'전화로 확인할 것 있음'·'공식 정보 없음'·'일반 차량 경로' 문구·개인정보 문구는 밖에 둔다(접어서 숨기지 않는다).
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
- `data/hires-photos.json`(11/25): 관광지 40곳 고화질 대표 사진(위키미디어 공용·공유마당·pxhere, CC0 · CC BY · CC BY-SA · 공공누리 1유형만). `scripts/tour/featured-photos.ts --data data/hires-photos.json --out public/photos/hires`로 4:3 1200×900 WebP. 화면(`lib/places/client-photos.ts`)은 이 사진(과 시작 화면 6곳 `featured-photos.json`)을 대표·크게 보기 첫 장으로 쓰고 작가·원본·라이선스를 표시. 출처 목록 `docs/data/photo-credits.md`. 라이선스·출처 누락은 `tests/places/hires-photos.test.ts`가 막는다.
- `data/places.json`: API 기본 정보 + ① 읽기 결과(등급 `ai`) + 공중화장실 공공데이터(등급 `public`) + (선택) 사람 확인 값(등급 `human`). 만드는 순서: `scripts/public/build-restrooms.ts` → `scripts/tour/build-places.ts` → `scripts/ai/read-places.ts` → `scripts/ai/merge-places.ts`.
- 공중화장실 원본은 `data/raw/public/`(cp949, 커밋 안 함). 짝 규칙: 화장실명에 관광지 이름이 들어 있고 같은 시일 때만, 주유소 제외, 주소만 같다고 짝짓지 않음. 결과는 `data/public/restrooms.json`·`docs/data/public-restrooms.md`, 근거 문단 id는 `public-화장실-N`.
- 휠체어·어르신은 노면·경사·거리 '모름'이 많아 대부분 '확인 필요' → 일정에 넣되 질문 + 전화번호로 표시한다(11/10 결정). 사람 판정은 하지 않는다. 조사표 32곳은 '유명한 곳' 판단 기준으로 쓴다.
- `tests/fixtures/places.sample.json`: 테스트 전용 가짜 장소(`[샘플] 관광지 A`, id `GN91~`). 화면·README 수치에 쓰지 않는다.
- 카테고리는 스키마의 6개만 쓴다. 조사표의 `바다·자연`은 `바다·해변` 또는 `자연·산책`으로 나눠서 옮긴다.
- 명령: `npm test`(vitest) · `npm run test:e2e`(Playwright) · `npm run validate:places [-- 파일]` · `npm run build`(prebuild에서 장소 검사가 먼저 돈다)
  · `npx tsx scripts/tour/lookup.ts "장소명"`(API 상세 바로 보기)

## 작업 방식
- 작은 단위로 자주 커밋한다. 커밋 메시지는 한국어, `feat: / fix: / docs: / chore: / test:` 접두어.
- UI 문구는 한국어, 쉬운 말. 관광지 이름은 데이터의 공식 표기를 쓴다.
- 새 기능 전에 테스트를 먼저 깨지게 만들고 고친다(특히 조건 위반 0건, 가짜 LLM 가드 테스트).
