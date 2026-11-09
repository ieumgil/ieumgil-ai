import { redirect } from "next/navigation";

// /plan으로 들어오면 1단계부터 시작한다.
export default function PlanPage() {
  redirect("/plan/when");
}
