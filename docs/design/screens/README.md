# 시안 v2 화면 이미지

`docs/design/*.dc.html` 원본을 그대로 그린 화면이다(모바일 390px 기준 2배 해상도, PC 1440px).
구조·문구·간격·색은 이 이미지와 원본 파일을 함께 보고 맞춘다. 색은 `src/app/globals.css` 토큰을 쓴다.

| 이미지 | 원본 | 라우트(목표) |
|---|---|---|
| 01-start.png | Main.dc.html | `/` |
| 02-step1-when.png | When.dc.html | `/plan` 1단계 |
| 03-step2-who.png | Who.dc.html | `/plan` 2단계 |
| 04-step3-conditions.png | Conditions.dc.html | `/plan` 3단계 |
| 05-step4-taste.png | Taste.dc.html | `/plan` 4단계 |
| 06-result-mobile.png | ResultMobile.dc.html | `/trip/[id]` (모바일) |
| 07-result-desktop.png | ResultDesktop.dc.html | `/trip/[id]` (PC) |
| 08-share-card.png | ShareCard.dc.html | 공유 이미지 (지도 그림·사진 썸네일 추가 예정) |

구현할 때 바로잡을 점
- 회색 카드 안의 보조 버튼(전화로 확인, 2일차로 옮기기)은 카드와 같은 회색이라 경계가 안 보인다 → 흰 배경 버튼으로.
- 결과 카드의 카테고리 `바다·자연`은 스키마 기준 `바다·해변` 또는 `자연·산책`으로.
- 관광지 이름 [관광지 A]와 시간·거리·주의 문구는 형식 예시다. 실제 화면은 데이터와 엔진 결과로 채운다.
- 3단계 화면은 목록이 길어 아래가 잘려 보인다. 실제 화면은 세로 스크롤.
