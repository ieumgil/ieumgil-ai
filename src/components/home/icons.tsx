// 시작 화면 아이콘 모음. [임시] 지금은 lucide 아이콘이고, 직접 만든 아이콘이 오면 이 파일만 바꾼다(11/23).
// 아이콘은 장식이라 화면 읽기 프로그램은 건너뛴다(옆에 글자가 있다).
import { BookOpen, Info, Map, MapPinned, Route, type LucideIcon } from "lucide-react";

export type HomeIconName = "route" | "example" | "places" | "about" | "how";

const ICONS: Record<HomeIconName, LucideIcon> = { route: Route, example: Map, places: MapPinned, about: Info, how: BookOpen };

export function HomeIcon({ name, size = 32 }: { name: HomeIconName; size?: number }) {
  const Icon = ICONS[name];
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
