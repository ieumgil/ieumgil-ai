import type { Metadata } from "next";
import { ConditionsStep } from "./ConditionsStep";

export const metadata: Metadata = { title: "꼭 필요한 조건 · 이음길 AI" };

export default function Page() {
  return <ConditionsStep />;
}
