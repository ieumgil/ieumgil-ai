import { Fragment } from "react";

// 전화번호 글자: 하이픈 뒤에서만 줄을 바꿀 수 있게 한다(033-660-3301 → 033- / 660- / 3301).
// 글자 자체는 그대로라 textContent·tel: 링크·접근 이름('공식 전화 033-… 걸기')이 바뀌지 않는다.
// UI-SPEC은 &#8203;(보이지 않는 공백)을 말하지만 그 글자는 접근 이름과 검색 정규식에 섞여 들어가므로 wbr을 쓴다.
export function PhoneText({ phone }: { phone: string }) {
  const parts = phone.split("-");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <>
              -<wbr />
            </>
          )}
        </Fragment>
      ))}
    </>
  );
}
