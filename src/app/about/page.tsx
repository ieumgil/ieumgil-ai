// 서비스 소개 글(이용자용): 누구를 위한 서비스인지, 무엇을 해 주는지, 판단 표시를 어떻게 읽는지, 알아 둘 것.
// 기획 문서(docs/planning.md)를 바탕으로 이용자가 알아야 할 것만 쉬운 말로 옮겼다. 숫자는 README·data/eval과 같은 값.
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Article, P, Points, Section, Steps, tocOf } from "@/components/about/Article";
import { Phones } from "@/components/about/Figures";
import { StatusChip, type ChipStatus } from "@/components/ui/StatusChip";

export const metadata: Metadata = {
  title: "이음길 소개 · 이음길 AI",
  description: "휠체어, 어르신, 유모차와 함께 가는 강릉·속초·동해 여행. 이음길이 무엇을 해 주는지 소개해요.",
};

const VERDICTS: { status: ChipStatus; label: string; body: string }[] = [
  { status: "ok", label: "적합", body: "꼭 필요한 조건을 공식 정보로 확인했어요." },
  { status: "caution", label: "주의", body: "갈 수는 있지만 일부 구간이 불편할 수 있어요. 어디가 그런지 카드에 적어 두었어요." },
  { status: "caution", label: "확인 필요", body: "공식 정보가 모자라 판단을 끝내지 못했어요. 출발 전에 물어볼 질문과 전화번호를 붙였어요." },
  { status: "blocked", label: "부적합", body: "꼭 필요한 조건에 맞지 않아 일정에 넣지 않아요." },
];

const T = {
  who: "이런 분을 위해 만들었어요",
  why: "여행 준비가 왜 어려울까요",
  what: "이음길이 해 드리는 일",
  verdict: "판단 표시는 이렇게 읽어요",
  unknown: "모르는 건 숨기지 않아요",
  source: "정보는 어디서 오나요",
  notes: "알아 두실 것",
};

export default function AboutPage() {
  return (
    <Article
      title="이음길은 이런 서비스예요"
      lead="휠체어를 타는 분, 오래 걷기 힘든 어르신, 유모차를 끄는 가족과 함께 강릉·속초·동해를 여행할 때, 갈 수 있는 곳을 골라 일정으로 엮어 드려요."
      toc={tocOf(T)}
      hero={
        <Phones
          label="이음길 결과 화면"
          shots={[
            { src: "/about/compare.webp", alt: "일정 비교 화면: 성격이 다른 일정 세 가지와 장소 수, 이동 시간, 전화로 확인할 곳 수", caption: "성격이 다른 일정 비교" },
            { src: "/about/final.webp", alt: "확정한 일정 화면: 카카오 지도에 장소 번호와 일반 차량 경로선, 날짜별 날씨, 시간순 일정", caption: "확정한 일정과 지도" },
          ]}
        />
      }
      next={{ href: "/about/how", label: "이음길은 이렇게 작동해요", body: "AI가 무엇을 판단하고, 코드가 무엇을 검사하는지 궁금하다면" }}
    >
      <Section id="who" title={T.who}>
        <Points
          items={[
            { head: "휠체어를 타는 분과 함께 가는 가족·친구", body: "계단 없이 들어갈 수 있는지, 장애인 화장실과 주차장이 있는지 봐요." },
            { head: "보행이 불편한 어르신을 모시고 가는 가족", body: "주차장에서 입구까지, 안을 둘러보는 길까지 한 번에 걸을 수 있는 거리를 넘지 않는지 봐요." },
            { head: "유모차를 끌고 가는 가족", body: "엘리베이터가 있는지 보고, 수유실과 기저귀 교환대도 챙겨요." },
          ]}
        />
        <P>여러 유형을 함께 고를 수 있어요. 어르신과 유모차를 함께 고르면 걷는 거리와 수유실을 모두 봐요.</P>
      </Section>

      <Section id="why" title={T.why}>
        <P>
          관광지마다 계단이 있는지, 장애인 화장실이 있는지, 주차장에서 얼마나 걸어야 하는지 따로 찾아봐야 해요. 공식 정보도 &ldquo;출입구까지 경사로가 설치되어
          있음&rdquo; 같은 짧은 문장이라, 우리 가족이 갈 수 있는지는 직접 판단해야 해요.
        </P>
        <P>갈 곳을 고른 뒤에도 일이 남아요. 이동 시간과 운영시간을 맞춰 순서를 짜야 하고, 짠 일정을 함께 가는 사람에게 따로 전해야 해요.</P>
      </Section>

      <Section id="what" title={T.what}>
        <Steps
          items={[
            {
              head: "네 가지만 골라 주세요",
              body: "언제·어디서, 누구와, 꼭 필요한 조건, 좋아하는 곳까지 네 단계를 차례로 물어요. 고르기만 하면 되고, 글을 써야 하는 칸은 없어요. 지금 몇 단계인지 화면 위 점선 길로 보여 드려요.",
            },
            {
              head: "AI가 장소마다 판단해요",
              body: "한국관광공사 무장애 정보를 읽고, 함께 가는 사람 기준으로 갈 수 있는지 판단해요. 꼭 필요한 조건에 맞지 않는 곳은 일정에 넣지 않아요.",
            },
            {
              head: "성격이 다른 일정을 2~3개 보여 드려요",
              body: "여유롭게 둘러보는 일정, 좋아하는 곳 위주의 일정처럼 방향이 다른 일정을 나란히 놓고 비교할 수 있어요. 제목에는 실제로 들르는 곳을 적어요(예: '오죽헌과 솔숲 사이를 천천히 거니는 여행'). 도착 시각과 이동 시간은 계산해서 '약'을 붙여요. 2박 3일은 일정 하나를 꼼꼼하게 짜요.",
            },
            {
              head: "마음에 들게 고쳐요",
              body: "장소를 근처 다른 곳으로 바꾸거나, 순서를 옮기거나 뺄 수 있어요. 운영시간이나 하루 일정을 넘으면 고치지 않고 이유를 알려 드려요.",
            },
            {
              head: "정하고, 나누고, 들고 가요",
              body: "정한 일정은 지도, 날짜별 날씨와 함께 봐요. 공유 링크로 함께 가는 사람에게 보내거나 A4 한 장으로 인쇄할 수 있어요. 여행 당일에는 휴대폰으로 다시 열어요.",
            },
          ]}
        />
        <Phones
          label="단계별 실제 화면"
          shots={[
            { src: "/about/conditions.webp", alt: "꼭 필요한 조건 화면: 휠체어를 고르면 켜지는 필수 조건 목록", caption: "1 · 조건 고르기" },
            { src: "/about/detail.webp", alt: "장소 카드: 사진, 도착 시각, 판단 칩, 한 줄 이유, 전화, 바꾸기와 자세히", caption: "2 · 장소마다 판단" },
            { src: "/about/compare.webp", alt: "일정 비교: 실제 장소가 드러나는 제목의 일정 세 가지", caption: "3 · 일정 비교" },
            { src: "/about/swap.webp", alt: "장소 바꾸기: 근처 후보 세 곳과 판단, 거리, 이유", caption: "4 · 장소 바꾸기" },
            { src: "/about/share.webp", alt: "공유 링크 창: 공유 주소, 주소 복사, 사라지는 날짜, 이름·연락처는 저장하지 않는다는 안내", caption: "5 · 공유 링크" },
          ]}
        />
        <P>
          결과부터 보고 싶다면 시작 화면의 &lsquo;누구와 함께 가세요?&rsquo; 카드를 눌러 보세요. 휠체어·강릉 1박 2일, 어르신·속초 당일, 유모차·동해 당일 일정을 AI가
          미리 만들어 두어 입력 없이 바로 열려요.
        </P>
        <P>
          꼭 가고 싶은 곳이 있다면 &lsquo;관광지 둘러보기&rsquo;에서 152곳을 사진과 접근성 표시로 살펴보세요. 휠체어 진입, 장애인 화장실 같은 시설로 거를 수 있고,
          담아 둔 곳은 조건에 맞으면 모든 일정에 넣어요.
        </P>
      </Section>

      <Section id="verdict" title={T.verdict}>
        <P>장소마다 판단을 하나 붙여요. 색만 보지 않아도 되도록 기호와 글자를 함께 써요.</P>
        <dl className="flex flex-col border-t border-line lg:grid lg:grid-cols-2 lg:gap-x-8 lg:border-t-0">
          {VERDICTS.map((v, i) => (
            <div key={v.label} className="flex flex-col gap-2 border-b border-line py-3 lg:border-t lg:border-b-0 lg:py-4" data-reveal="" style={{ "--reveal-i": i % 2 } as CSSProperties}>
              <dt>
                <StatusChip status={v.status}>{v.label}</StatusChip>
              </dt>
              <dd className="text-base text-pretty">{v.body}</dd>
            </div>
          ))}
        </dl>
        <P>적합이나 주의라도 전화로 물어볼 것이 남아 있으면 &lsquo;적합 · 전화로 확인할 것 있음&rsquo;처럼 함께 적어요.</P>
      </Section>

      <Section
        id="unknown"
        title={T.unknown}
        aside={
          <Phones
            label="출발 전 전화 확인 화면"
            shots={[{ src: "/about/checklist.webp", alt: "출발 전 전화로 확인할 곳: 장소마다 물어볼 것과 전화번호, 괜찮대요·어렵대요 버튼", caption: "출발 전 전화로 확인할 곳" }]}
          />
        }
      >
        <P>
          공식 정보에는 빈칸이 많아요. 152곳의 접근성 항목 가운데 절반쯤이 비어 있어요. 이음길은 빈칸을 &lsquo;괜찮을 거예요&rsquo;로 채우지 않고, 확인할 방법을
          붙여요.
        </P>
        <Points
          items={[
            { head: "전화로 물어볼 것", body: "엘리베이터, 장애인 화장실, 장애인 주차, 출입구, 수유실, 걷는 거리. 물어볼 질문과 관광지 공식 전화번호를 함께 드려요." },
            { head: "가서 보고 확인할 것", body: "바닥(모래·자갈·흙길), 경사, 쉴 곳. 도착하면 바로 보이는 것이라 무엇을 보면 되는지 한 줄로 알려 드려요." },
          ]}
        />
        <P>확정한 일정에서 전화한 결과를 [괜찮대요] / [어렵대요]로 남길 수 있어요. 어렵다는 답을 들으면 다른 곳으로 바꾸기를 권해요.</P>
      </Section>

      <Section id="source" title={T.source}>
        <Points
          items={[
            { head: "한국관광공사 무장애 여행정보", body: "강릉·속초·동해 관광지 152곳의 무장애 정보, 운영시간, 전화번호, 사진" },
            { head: "행정안전부 공중화장실 표준데이터", body: "장애인 화장실과 기저귀 교환대 정보를 더했어요. 데이터 기준일을 함께 보여 드려요." },
            { head: "기상청 예보", body: "확정한 일정의 날짜별 날씨와 화면 맨 위의 오늘 영동 날씨. 비나 눈 예보가 있으면 바깥 장소에 주의를 붙여요." },
            { head: "카카오맵", body: "지도와 차량 이동 시간, 경로선" },
          ]}
        />
        <P>장소 카드에는 정보마다 출처를 적어요. AI가 관광공사 문장을 정리한 값인지, 공공데이터를 그대로 옮긴 값인지 구분해서 보여 드려요.</P>
      </Section>

      <Section id="notes" title={T.notes}>
        <Points
          items={[
            {
              head: "이름과 연락처를 받지 않아요",
              body: "회원가입이 없어요. 만든 일정은 지금 쓰는 브라우저 탭에만 남아요. 공유 링크를 만들 때만 고른 일정을 서버에 저장하고, 여행 마지막 날부터 7일이 지나면 지워요.",
            },
            { head: "지도의 경로는 일반 차량 경로예요", body: "휠체어로 다니기 안전한 길을 알려 주는 경로가 아니에요." },
            { head: "공식 정보와 현장이 다를 수 있어요", body: "꼭 필요한 시설은 출발 전에 전화로 한 번 더 확인해 주세요." },
            { head: "관광지만 추천해요", body: "음식점·카페·숙소는 추천하지 않아요. 점심시간은 일정에 비워 두고, 숙소는 지역만 물어요." },
          ]}
        />
      </Section>
    </Article>
  );
}
