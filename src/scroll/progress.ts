/**
 * Scroll progress as a tiny external store.
 *
 * The camera reads this every frame inside useFrame, so it must never go
 * through React state — that would re-render the tree 60 times a second. UI
 * that genuinely needs to re-render (the chapter dots) subscribes instead, and
 * only acts when the value it cares about actually changes.
 */
import { chapterAt } from '@/config/chapters';

type Listener = (progress: number) => void;

const listeners = new Set<Listener>();

export const progress = {
  /** 0 at the top of the page, 1 at the bottom. */
  value: 0,
  /** 0-based chapter index derived from `value`. */
  chapter: 0,
  /**
   * Incremented to tell the camera to jump rather than ease to the new value.
   * Used by the capture harness, where damping would mean every frame is a
   * picture of the camera still on its way somewhere.
   */
  snapToken: 0,
  snap() { this.snapToken++; },
  /** Set by the scroll driver; also by the debug/test hook. */
  set(v: number) {
    const clamped = Math.min(1, Math.max(0, v));
    this.value = clamped;
    this.chapter = chapterAt(clamped);
    for (const l of listeners) l(clamped);
  },
};

export function onProgress(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
