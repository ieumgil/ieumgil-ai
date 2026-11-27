# 글꼴 파일

## jalnan-gothic-home.woff
- 원본: 여기어때 잘난체 고딕(Jalnan Gothic) v1.000, GC COMPANY(디자인 산돌) http://www.gccompany.co.kr
- 라이선스(글꼴 파일 안 문구): 개인·기업 모두 무료로 쓸 수 있고, 수정·재배포할 수 있다. 지식재산권은 GC COMPANY에 있다.
- 시작 화면 히어로 문구 "지도로 찾아가는 즐거운 영동 여행길"과 바로가기 이름 5개에 쓰는 글자만 남겨 줄였다(fontTools subset, 원본 776KB → 약 4KB).
  문구를 바꾸면 원본에서 다시 만든다:
  `python -m fontTools.subset JalnanGothic.woff --text="문구 전부" --flavor=woff --output-file=src/app/fonts/jalnan-gothic-home.woff`
