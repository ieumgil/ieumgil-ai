# 글꼴 파일

## cafe24-syongsyong-hero.woff
- 원본: 카페24 숑숑 v2.0(Cafe24 Syongsyong), 카페24(주) https://fonts.cafe24.com
- 라이선스: SIL Open Font License 1.1 (수정·재배포 가능, 글꼴 자체 유료 판매 금지)
- 시작 화면 히어로 문구 "지도로 찾아가는 즐거운 영동 여행길"에 쓰는 글자만 남겨 줄였다(fontTools subset, 약 9KB).
  문구를 바꾸면 공식 TTF에서 다시 만든다:
  `python -m fontTools.subset Cafe24Syongsyong-v2.0.ttf --text="문구" --flavor=woff --output-file=src/app/fonts/cafe24-syongsyong-hero.woff`
- 이 페이지에는 카페24(주)가 제공한 "카페24 숑숑"이 적용되어 있습니다.
