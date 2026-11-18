import { useState } from "react";

/**
 * 마지막으로 비어 있지 않던 값. 시트·창이 닫히는 움직임(160ms) 동안 안의 내용이 먼저 사라져
 * 빈 상자만 내려가지 않게, 닫히는 동안에는 직전 내용을 그대로 그린다.
 */
export function useLast<T>(value: T | null): T | null {
  const [last, setLast] = useState<T | null>(value);
  if (value !== null && value !== last) setLast(value);
  return value ?? last;
}
