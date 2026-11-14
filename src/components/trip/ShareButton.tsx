"use client";

// 확정 일정 공유 링크 만들기(11/14). 누르면 서버(/api/trips)가 검사 후 Supabase에 고른 안만 저장하고 주소를 돌려준다.
// 받은 사람은 로그인 없이 읽기만 한다(/s/{id}). 이동시간·경로·개인정보는 저장하지 않고, 여행 끝 + 7일에 사라진다.
// 같은 화면에서 다시 누르면 새로 만들지 않고 만든 주소를 다시 보여준다.
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toShareDoc } from "@/lib/share/doc";
import type { OptionView, TripView } from "@/lib/trip/view";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; url: string; until: string } | { kind: "error"; text: string };

// 사라지는 시각은 그다음 날 0시 → 화면에는 열려 있는 마지막 날을 쓴다
const untilText = (iso: string) => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(Date.parse(iso) - 1));

export function ShareButton({ trip, o }: { trip: TripView; o: OptionView }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  const make = async () => {
    setOpen(true);
    setCopied(false);
    if (state.kind === "done") return;
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toShareDoc(trip, o)) });
      const body = (await res.json().catch(() => ({}))) as { id?: string; expiresAt?: string; message?: string };
      if (!res.ok || !body.id || !body.expiresAt) throw new Error(body.message ?? "공유 링크를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요");
      setState({ kind: "done", url: `${window.location.origin}/s/${body.id}`, until: untilText(body.expiresAt) });
    } catch (err) {
      setState({ kind: "error", text: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "인터넷 연결을 확인하고 다시 눌러 주세요" });
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <>
      <Button variant="ghost" size="sm" onClick={make}>
        <Share2 aria-hidden="true" />
        공유 링크 만들기
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-1.5rem)] gap-4 rounded-3xl p-5 text-base sm:max-w-[30rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Link2 size={22} className="text-primary" aria-hidden="true" />
              일정 공유 링크
            </DialogTitle>
            <DialogDescription className="text-base text-ink-sub">함께 가는 사람에게 보내면 로그인 없이 지도와 일정을 볼 수 있어요. 받은 사람은 읽기만 해요.</DialogDescription>
          </DialogHeader>

          <div aria-live="polite">
            {state.kind === "busy" && <p className="rounded-xl bg-surface px-4 py-3 text-base text-ink-sub">링크를 만들고 있어요…</p>}
            {state.kind === "error" && (
              <div className="flex flex-col gap-3">
                <p className="rounded-xl bg-caution-bg px-4 py-3 text-base text-caution-ink">
                  <span className="font-bold">! </span>
                  {state.text}
                </p>
                <Button variant="outline" size="sm" onClick={() => { setState({ kind: "idle" }); void make(); }}>
                  다시 만들기
                </Button>
              </div>
            )}
            {state.kind === "done" && (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-bold text-ink-sub">공유 주소</span>
                  <input
                    readOnly
                    value={state.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-h-touch w-full rounded-xl bg-surface px-3 text-base text-ink tabular-nums ring-1 ring-line focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="grow" onClick={() => copy(state.url)}>
                    {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    {copied ? "복사했어요" : "주소 복사"}
                  </Button>
                  {canShare && (
                    <Button variant="outline" size="sm" className="grow" onClick={() => navigator.share({ title: `이음길 일정 · ${o.title}`, url: state.url }).catch(() => {})}>
                      <Share2 aria-hidden="true" />
                      다른 앱으로 보내기
                    </Button>
                  )}
                </div>
                <ul className="list-disc pl-5 text-sm leading-normal text-ink-sub">
                  <li>{state.until}까지 열려요. 그 뒤에는 자동으로 지워져요.</li>
                  <li>장소·순서·머무는 시간만 저장하고, 이름·연락처는 저장하지 않아요.</li>
                  <li>이동시간과 지도 경로는 열 때마다 새로 계산해요.</li>
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
