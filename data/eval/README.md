# data/eval — AI 평가 자료

- `read-v1/` — ① AI 읽기의 **첫 번째 결과**(152곳). 프롬프트에 예시를 더해 다시 읽은 결과가 `data/ai/read/`(지금 서비스가 쓰는 값)이다.
  두 결과를 항목별로 비교한 일치율이 README의 "AI 읽기 일관성 **96.4%**"다(다시 읽기로 경사 '모름' 17곳이 '가능'으로 바뀜, `docs/impl-plan.md`).
  서비스 코드에서는 쓰지 않는다.
- (선택) `human.json` — 사람이 전화·현장으로 확인한 값. 있으면 `npm run data:merge`가 AI 값을 덮어쓴다(등급 `human`). 양식은 `scripts/ai/human-template.ts`.
- `human-check.csv` → `human-check.md` — ① AI 읽기 **정확도**(사람 확인과 비교): 대표 관광지 20곳 × 4항목을 사람이 열린관광·전화·현장으로 확인해 채우고(AI 값은 양식에 없음), `npx tsx scripts/ai/human-check.ts score`로 항목별 일치율·AI 모름·위험한 다름(AI 가능 ↔ 사람 불가)을 낸다.
- `judge-v1.md` · `judge-v1.json` — ② AI 판단 평가(11/14): 여행자 유형·지역이 다른 6개 장면에서 후보 20곳을 3번씩 판단해 3회 일치율·확신도·안전 하한·근거 버림, Gemini와 OpenAI의 판단 일치를 잰 결과. `npx tsx scripts/ai/eval-judge.ts`(실제 AI) · `--report`(저장된 결과로 표만 다시).
