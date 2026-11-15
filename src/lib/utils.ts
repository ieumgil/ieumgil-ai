// 클래스 이름 합치기(shadcn의 cn 패키지: clsx + tailwind-merge 대체).
// 우리 글자 크기 토큰(display·title·heading·lead)을 '글자 크기'로 알려 준다. 알려 주지 않으면 글자색으로 오해해서
// 글자 크기와 흰 글자색을 함께 합칠 때 흰 글자색을 지워 버린다(파란 버튼 글자가 어두워지던 문제).
// display·lead는 아직 쓰는 화면이 있어 남겨 둔다(11번 계획에서 정리).
import { createCn } from "cn/config";

export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["display", "title", "heading", "lead"] }] } },
});
