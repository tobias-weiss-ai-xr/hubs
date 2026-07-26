import { useEffect, useRef, useCallback } from "react";

export default function useProgressTracker(channel, elementSlug, elementType) {
  const startTime = useRef(null);
  const currentSlug = useRef(null);

  const track = useCallback(
    (slug, type, data = {}) => {
      if (!channel || !slug) return;
      channel.trackProgress(slug, type, data).catch(() => {});
    },
    [channel]
  );

  useEffect(() => {
    if (!channel) return;

    if (elementSlug && elementSlug !== currentSlug.current) {
      if (currentSlug.current) {
        const elapsed = startTime.current ? Date.now() - startTime.current : 0;
        track(currentSlug.current, elementType, {
          status: "visited",
          time_spent_ms: elapsed
        });
      }
      currentSlug.current = elementSlug;
      startTime.current = Date.now();
      track(elementSlug, elementType, { status: "started" });
    }

    return () => {
      if (currentSlug.current && startTime.current) {
        const elapsed = Date.now() - startTime.current;
        track(currentSlug.current, elementType, {
          status: "visited",
          time_spent_ms: elapsed
        });
      }
    };
  }, [channel, elementSlug, elementType, track]);

  return { track };
}
