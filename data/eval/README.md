# data/eval — AI 평가 자료

- `read-v1/` — ① AI 읽기의 **첫 번째 결과**(152곳). 프롬프트에 예시를 더해 다시 읽은 결과가 `data/ai/read/`(지금 서비스가 쓰는 값)이다.
  두 결과를 항목별로 비교한 일치율이 README의 "AI 읽기 일관성 **96.4%**"다(다시 읽기로 경사 '모름' 17곳이 '가능'으로 바뀜, `docs/impl-plan.md`).
  서비스 코드에서는 쓰지 않는다.
- (선택) `human.json` — 사람이 전화·현장으로 확인한 값. 있으면 `npm run data:merge`가 AI 값을 덮어쓴다(등급 `human`). 양식은 `scripts/ai/human-template.ts`.
