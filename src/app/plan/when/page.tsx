import type { Metadata } from "next";
import { WhenStep } from "./WhenStep";

export const metadata: Metadata = { title: "언제, 어디서 · 이음길 AI" };

export default function Page() {
  return <WhenStep />;
}
