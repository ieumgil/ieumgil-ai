// 만든 방법 글: README·docs/ai-plan.md 내용을 이용자도 읽을 수 있게 풀었다.
// AI와 코드의 역할, 미리 읽어 둔 데이터, 일정 한 번이 만들어지는 과정, 안전 기준, 멈추지 않게, 저장하지 않는 것, 숫자.
// 숫자는 README·data/eval(read-v1, judge-v1, cost-v1)과 같은 값. 테스트 개수처럼 자주 바뀌는 값은 쓰지 않는다.
import type { Metadata } from "next";
import { AccessChart } from "@/components/about/AccessChart";
import { Article, Numbers, P, Points, Section, Steps, tocOf } from "@/components/about/Article";
import { Architecture, Phones } from "@/components/about/Figures";

export const metadata: Metadata = {
  title: "이음길은 이렇게 만들었어요 · 이음길 AI",
  description: "AI가 공공 무장애 정보를 읽고 판단하면, 코드가 시각을 계산하고 안전 기준을 검사해요. 이음길을 만든 방법을 소개해요.",
};

const REPO = "https://github.com/ieumgil/ieumgil-ai";

const NUMBERS: { label: string; value: string; note: string }[] = [
  { label: "관광지", value: "152곳", note: "강릉 101 · 속초 30 · 동해 21" },
  { label: "꼭 필요한 조건을 어긴 일정", value: "0건", note: "엔진 시나리오 10개와 유형 조합 14가지" },
  { label: "근거 없이 채운 접근성 값", value: "0건", note: "AI가 읽은 1,520항목" },
  { label: "같은 152곳을 두 번 읽었을 때 일치", value: "96.4%", note: "항목 값이 같은 비율" },
  { label: "같은 후보를 세 번 판단했을 때 셋 다 같음", value: "85.7%", note: "Gemini 기준(OpenAI 78.3%), 두 모델이 정반대로 판단한 경우 0건" },
  { label: "일정 한 번 만드는 비용", value: "약 50원", note: "AI 5회, 유료 단가로 계산(조건 5가지 실측)" },
];

const LINES: { text: string; by: "AI" | "코드" }[] = [
  { text: "10:00 강릉역 출발 → 차량 약 11분", by: "코드" },
  { text: "약 10:11~11:36 강릉 오죽헌·시립박물관", by: "코드" },
  { text: "적합 · 확신 높음", by: "AI" },
  { text: "경사로와 엘리베이터가 있어 이동하기 편리해서 골랐어요.", by: "AI" },
  { text: "가서 볼 것: 모래·자갈·흙길이 보이면 포장길이나 데크로만 다니세요.", by: "코드" },
  { text: "11:36~11:56 쉬는 시간 → 차량 약 5분", by: "코드" },
  { text: "약 12:01~13:26 강릉자수박물관", by: "코드" },
  { text: "13:26~14:26 점심·휴식", by: "코드" },
];

/** 예시 루트 A안 첫째 날을 줄마다 누가 썼는지 표시(README '실제 응답 예'와 같은 값) */
function Annotated() {
  return (
    <ol className="flex flex-col rounded-2xl border border-line">
      {LINES.map((l, i) => (
        <li key={i} className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
          <span className="min-w-0 text-base text-pretty">{l.text}</span>
          <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${l.by === "AI" ? "bg-primary-soft text-primary-ink" : "bg-surface text-ink-sub"}`}>
            {l.by === "AI" ? "AI가 씀" : "코드가 계산"}
          </span>
        </li>
      ))}
    </ol>
  );
}

const T = {
  start: "출발점은 문장으로 된 공공데이터였어요",
  roles: "AI와 코드가 나눠 맡아요",
  read: "152곳은 미리 읽어 두었어요",
  flow: "일정 한 번은 이렇게 만들어져요",
  lines: "AI가 쓴 것과 코드가 쓴 것",
  safety: "안전 기준은 코드가 정해요",
  fallback: "멈추지 않게 대비했어요",
  nostore: "저장하지 않는 것",
  a11y: "누구나 쓰기 쉽게",
  numbers: "숫자로 보면",
  more: "더 자세히 보기",
};

export default function HowPage() {
  return (
    <Article
      title="이음길은 이렇게 만들었어요"
      toc={tocOf(T)}
      lead="AI는 공공 무장애 정보를 읽고 판단하고 일정을 짜요. 시각 계산과 안전 검사는 코드가 맡아요. 역할을 이렇게 나눈 이유와 방법을 정리했어요."
      next={{ href: "/about", label: "이음길은 이런 서비스예요", body: "누구를 위한 서비스인지, 판단 표시를 어떻게 읽는지 먼저 보고 싶다면" }}
    >
      <Section id="start" title={T.start}>
        <P>
          한국관광공사 무장애 여행정보는 항목마다 &ldquo;출입구까지 경사로가 설치되어 있음(완만함)&rdquo; 같은 짧은 문장으로 되어 있어요. 이 문장만으로는 코드가
          &lsquo;갈 수 있다&rsquo;와 &lsquo;갈 수 없다&rsquo;를 가를 수 없어요. 기존 서비스도 문장을 그대로 보여 주고, 판단은 여행자에게 맡겨요.
        </P>
        <P>
          그래서 문장을 읽고 판단하는 일은 AI(대규모 언어 모델)에게 맡겼어요. 대신 AI가 틀려도 위험한 일정이 나가지 않게, 계산과 검사는 코드가 하도록 나눴어요.
        </P>
      </Section>

      <Section id="roles" title={T.roles}>
        <Points
          items={[
            { head: "AI가 하는 일", body: "관광공사 문장 읽기, 이 사람에게 맞는지 판단하기, 성격이 다른 일정 짜기, 짠 일정 평가하기" },
            { head: "코드가 하는 일", body: "후보 거르기, 도착·출발 시각 계산, 운영시간과 하루 범위 검사, 안전 기준 지키기, AI가 실패했을 때 대신 일정 짜기" },
          ]}
        />
        <P>
          AI의 답은 모두 정해진 JSON 형식으로 받아요. 코드가 형식과 근거를 검사하고, 통과한 답만 화면에 보여 드려요. 넘겨준 원문에 근거가 없는 판단은 버려요. 도착
          시각, 이동 시간, 날씨 문구는 AI가 쓰지 않아요.
        </P>
        <Architecture />
      </Section>

      <Section id="read" title={T.read}>
        <P>
          관광공사 API에서 강릉·속초·동해 182곳을 받아, 화장실이나 문화원처럼 관광지가 아닌 곳을 빼고 152곳을 남겼어요. AI가 장소마다 문장을 읽어 접근성 10항목을
          가능 / 부분가능 / 불가 / 모름으로 정리했어요. 값마다 근거가 된 원문 문단을 함께 적어 두었어요.
        </P>
        <AccessChart />
        <Points
          items={[
            { head: "빈칸은 '모름'으로 둬요", body: "1,520항목 가운데 828개(54%)가 '모름'이에요. 지어내지 않고 물어볼 질문을 붙여요. 질문이나 공식 전화번호가 빠지면 빌드가 멈춰요." },
            { head: "공공데이터로 보충했어요", body: "행정안전부 공중화장실 표준데이터와 짝지어 31곳의 장애인 화장실·기저귀 교환대 정보를 채웠어요. 이 값은 '있음'일 때만 '가능'으로 올려요." },
            { head: "층이 없는 시설은 분류로 판단해요", body: "생가·고택·마을처럼 층이 없는 곳은 관광공사 분류를 보고 엘리베이터 조건을 '가능'으로 둬요." },
          ]}
        />
      </Section>

      <Section
        id="flow"
        title={T.flow}
        aside={
          <Phones
            label="만드는 중 화면"
            shots={[{ src: "/about/making.webp", alt: "AI가 일정을 만들고 있어요: 진행률, 단계 목록, AI가 살펴보는 장소, 진행 기록", caption: "만드는 중 화면의 진행 기록" }]}
          />
        }
      >
        <Steps
          items={[
            { head: "후보 거르기(코드)", body: "지역 밖, 그날 쉬는 곳, 꼭 필요한 조건이 '불가'인 곳을 빼고 최대 20곳을 골라요. 2박 3일은 30곳이에요." },
            { head: "장소 판단(AI 3번)", body: "후보를 한꺼번에 세 번 판단해요. 세 번의 답이 얼마나 같은지로 확신도를 정하고, 코드가 안전 기준을 덧씌워요." },
            { head: "일정 짜기(AI 1번)", body: "방향이 다른 일정 2~3개를 한 번에 받아요. 장소, 순서, 머무는 시간, 이유만 받고 시각은 받지 않아요. 제목은 실제로 넣은 장소가 드러나게 쓰게 했어요." },
            {
              head: "시각 계산과 검사(코드)",
              body: "이동 시간, 머무는 시간, 휠체어·어르신 여유 25%, 승하차 여유, 12~14시 점심 60분을 더해 시각을 계산해요. 다 짠 일정은 카카오 길찾기로 실제 이동 시간을 받아 한 번 더 검사해요.",
            },
            { head: "다시 받기와 평가", body: "검사에 걸린 일정만 이유를 알려 주고 다시 받아요(최대 2번). 평가 AI가 피로도·여유·취향을 1~5점으로 매기고, 2점 이하면 한 번 고쳐요." },
          ]}
        />
        <P>요청 한 번에 AI를 보통 5~8번 부르고, 10~40초쯤 걸려요. 만드는 중 화면에 나오는 진행 기록은 서버가 보낸 그대로예요.</P>
      </Section>

      <Section id="lines" title={T.lines}>
        <P>예시 루트의 첫째 날 일부예요. 이유와 판단은 AI가 썼고, 시각과 이동 시간은 코드와 카카오 길찾기가 채웠어요.</P>
        <Annotated />
      </Section>

      <Section id="safety" title={T.safety}>
        <Points
          items={[
            { head: "꼭 필요한 조건이 '불가'면 부적합", body: "'부분가능'이면 적어도 주의예요. 걷는 거리를 알고 있는데 입력한 거리를 넘어도 부적합이에요." },
            { head: "휠체어는 들어갈 수 있다는 원문이 있어야 적합", body: "그런 문장이 없으면 확인 필요로 두고 물어볼 질문을 붙여요." },
            { head: "AI는 더 조심스러운 쪽으로만 바꿀 수 있어요", body: "코드가 정한 기준보다 낙관적인 판단은 받아들이지 않아요." },
          ]}
        />
      </Section>

      <Section id="fallback" title={T.fallback}>
        <Points
          items={[
            { head: "AI가 늦으면 다른 AI에도 물어요", body: "Gemini를 먼저 쓰고, 붐비거나 30초 넘게 답이 없으면 같은 요청을 OpenAI에도 보내 먼저 온 답을 써요." },
            { head: "둘 다 안 되면 규칙 일정", body: "AI 없이 규칙만으로 일정 하나를 짜요. 꼭 필요한 조건과 시간 검사는 똑같이 해요." },
            { head: "길찾기나 날씨가 실패해도", body: "길찾기를 못 받으면 직선거리로 어림해 '추정'으로 표시해요. 날씨를 못 받으면 날씨 칸만 숨겨요." },
          ]}
        />
      </Section>

      <Section id="nostore" title={T.nostore}>
        <Points
          items={[
            { head: "이름·연락처·IP", body: "받지도 저장하지도 않아요. 글을 쓰는 칸이 없어서 들어올 길도 없어요. AI에는 고른 조건과 장소 정보만 보내요." },
            { head: "카카오 길찾기 결과", body: "카카오는 결과를 저장해 두고 다시 쓰는 것을 막아요. 그래서 일정을 열 때마다 이동 시간과 경로를 새로 받아요." },
            { head: "날씨", body: "열 때 기상청 예보를 받아 화면에만 써요." },
            { head: "공유 링크", body: "고른 일정(장소·순서·머무는 시간·이유)만 저장해요. 여행 마지막 날부터 7일, 길어도 만든 날부터 30일이 지나면 자동으로 지워요." },
          ]}
        />
      </Section>

      <Section id="a11y" title={T.a11y}>
        <P>
          본문 글자는 16px 이상, 누르는 곳은 44px 이상이에요. 글자 크기는 휴대폰과 브라우저의 글자 크기 설정을 그대로 따라요. 판단은 색과 기호와 글자로 함께
          나타내요. 웹 접근성 자동 검사(WCAG 2.2 A·AA)를 주요 화면마다 돌려 위반 0건을 지켜요. 시작 화면 루트 카드와 &lsquo;여행 루트 만들기&rsquo; 버튼은 팀이 직접 정한 색이라 글자 대비만 예외로 두었어요. 팀원이 실제 이용자 입장에서 화면을 계속 써 보며 불편한 점을 찾아
          고쳤어요. 시작 화면은 디자인 시안과 지자체 관광 사이트들을 참고해 다시 만들었어요.
        </P>
      </Section>

      <Section id="numbers" title={T.numbers}>
        <Numbers items={NUMBERS} />
        <P>AI 숫자는 정답과 맞춰 본 정확도가 아니에요. 같은 일을 여러 번 시켰을 때 얼마나 같은 답을 내는지 본 일관성이에요.</P>
      </Section>

      <Section id="more" title={T.more}>
        <P>코드와 데이터, 테스트를 모두 공개했어요. 장소마다 근거가 된 관광공사 원문과 AI가 읽은 결과도 저장소에서 볼 수 있어요.</P>
        <ul className="flex flex-col">
          {[
            { href: REPO, label: "GitHub 저장소" },
            { href: `${REPO}/blob/main/docs/planning.md`, label: "기획 문서" },
            { href: `${REPO}/blob/main/docs/ai-plan.md`, label: "AI 설계 문서" },
          ].map((l) => (
            <li key={l.href}>
              <a href={l.href} target="_blank" rel="noreferrer" className="inline-flex min-h-touch items-center text-base font-medium text-primary underline-offset-4 hover:underline">
                {l.label}
                <span className="sr-only"> (새 탭)</span>
              </a>
            </li>
          ))}
        </ul>
        <P>만든 곳: 팀 이음길(공지혁, 강환일) · 2026 My AI 랩(강릉과학산업진흥원) 과제</P>
      </Section>
    </Article>
  );
}
