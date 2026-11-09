import type { Metadata } from "next";
import { WhoStep } from "./WhoStep";

export const metadata: Metadata = { title: "누구와 · 이음길 AI" };

export default function Page() {
  return <WhoStep />;
}
