/**
 * Which chapters have their geometry mounted.
 *
 * Chapter 1 is mounted before the first frame. Every other chapter mounts when
 * the viewer is halfway through the one before it, which starts its downloads
 * roughly a chapter ahead of when they are needed. Nothing is ever unmounted
 * yet — disposal comes later, once there is a reason to pay for it.
 */
import { useEffect, useState } from 'react';
import { CHAPTERS, CHAPTER_RANGES, modelsForChapterIndex } from '@/config/chapters';
import { progress, onProgress } from './progress';
import { preloadModels } from '@/scene/models/useModel';

/** How far into a chapter the next one starts loading. */
export const PRELOAD_AT = 0.5;

export function useChapterLoading(loadAll = false): Set<number> {
  const [mounted, setMounted] = useState<Set<number>>(
    () => new Set(loadAll ? CHAPTERS.map((_, i) => i) : [0]));

  useEffect(() => {
    if (loadAll) return;
    // Warm chapter 2 immediately after chapter 1 is on screen, so the first
    // scroll is never the thing that triggers a cold fetch.
    preloadModels(modelsForChapterIndex(1));

    return onProgress(() => {
      const p = progress.value;
      let i = CHAPTER_RANGES.length - 1;
      while (i > 0 && p < CHAPTER_RANGES[i].start) i--;
      const { start, end } = CHAPTER_RANGES[i];
      const u = end > start ? (p - start) / (end - start) : 0;

      const want = new Set<number>();
      for (let k = 0; k <= i; k++) want.add(k);          // anything already passed
      if (u >= PRELOAD_AT) want.add(Math.min(CHAPTERS.length - 1, i + 1));

      setMounted((prev) => {
        let changed = false;
        for (const k of want) if (!prev.has(k)) { changed = true; break; }
        if (!changed) return prev;
        const next = new Set(prev);
        for (const k of want) next.add(k);
        // Start the fetch for the chapter after the newest one too.
        const newest = Math.max(...next);
        if (newest + 1 < CHAPTERS.length) preloadModels(modelsForChapterIndex(newest + 1));
        return next;
      });
    });
  }, [loadAll]);

  return mounted;
}
