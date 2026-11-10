import type { Metadata } from "next";
import { MakingStep } from "./MakingStep";

export const metadata: Metadata = { title: "일정 만드는 중 · 이음길 AI" };

export default function Page() {
  return <MakingStep />;
}
