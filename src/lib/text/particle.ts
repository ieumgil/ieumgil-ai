// 한국어 조사 고르기: 앞말 끝 글자의 받침에 따라 '으로/로'. 한글이 아니면(숫자·영문·괄호) '(으)로'로 둔다.
export function euro(word: string): string {
  const last = word.trim().at(-1) ?? "";
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}(으)로`;
  const jong = code % 28;
  // 받침 없음 또는 ㄹ 받침(8)이면 '로'
  return `${word}${jong === 0 || jong === 8 ? "로" : "으로"}`;
}
