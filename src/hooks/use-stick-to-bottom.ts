"use client";

import { useEffect, useRef, type RefObject } from "react";

const STICK_THRESHOLD_PX = 80;

/**
 * Follow the bottom of a scroll container when new content lands, but only
 * if the user is already near the bottom. Scrolling up to inspect earlier
 * rows must not be hijacked.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useStickToBottom(ref, items);
 *   return <div ref={ref} className="overflow-y-auto">…</div>
 */
export function useStickToBottom(
  ref: RefObject<HTMLElement | null>,
  trigger: unknown,
): void {
  // Track whether the user was pinned to the bottom at the moment the
  // trigger changed. We read this synchronously before the DOM may
  // reflow to the new content's size; otherwise appending a new row
  // would immediately un-stick us.
  const wasStickyRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      wasStickyRef.current =
        el.scrollHeight - el.clientHeight - el.scrollTop < STICK_THRESHOLD_PX;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!wasStickyRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [ref, trigger]);
}
