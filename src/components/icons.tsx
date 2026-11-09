// 시안(docs/design)에서 가져온 선 아이콘. 모두 장식용이라 aria-hidden.
import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Line({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M4 12.5l5 5L20 6.5" />
  </Line>
);

export const DocumentIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M7 3h7l5 5v13H7z" />
    <path d="M14 3v5h5" />
    <path d="M10 13h6M10 17h6" />
  </Line>
);

export const ChatIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M8 9h8M8 12h5" />
  </Line>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Line>
);

export const InfoIcon = (p: IconProps) => (
  <Line {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 10.5v6M12 7.2v.3" />
  </Line>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M9 5l7 7-7 7" />
  </Line>
);

export const SearchIcon = (p: IconProps) => (
  <Line {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Line>
);

export const CloseIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Line>
);

export const WheelchairIcon = (p: IconProps) => (
  <Line strokeWidth={1.8} {...p}>
    <circle cx="11" cy="4" r="2" />
    <path d="M11 7v6h5l2 5" />
    <path d="M11 10h4" />
    <path d="M8 11.5a5 5 0 1 0 7 6" />
  </Line>
);

export const ElderIcon = (p: IconProps) => (
  <Line strokeWidth={1.8} {...p}>
    <circle cx="10" cy="4" r="2" />
    <path d="M10 7l-1.5 6 2.5 3v5" />
    <path d="M8.5 13l-2.5 8" />
    <path d="M10 9l3 2" />
    <path d="M16 10v11" />
    <path d="M16 10a1.5 1.5 0 0 0-3 0" />
  </Line>
);

export const StrollerIcon = (p: IconProps) => (
  <Line strokeWidth={1.8} {...p}>
    <path d="M3 5h2.5l2 9h10l2-6h-12" />
    <path d="M13 8V3a5 5 0 0 1 5 5" />
    <circle cx="9" cy="18.5" r="1.8" />
    <circle cx="16" cy="18.5" r="1.8" />
  </Line>
);

export const LockIcon = (p: IconProps) => (
  <Line {...p}>
    <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2" />
    <path d="M8.2 10.5v-3a3.8 3.8 0 0 1 7.6 0v3" />
  </Line>
);
