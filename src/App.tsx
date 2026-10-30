import { useEffect } from 'react';
import { Scene } from '@/scene/Scene';
import { Overlay } from '@/ui/Overlay';
import { DebugPanel } from '@/ui/DebugPanel';
import { useScrollEngine } from '@/scroll/useScrollEngine';
import { progress } from '@/scroll/progress';
import { CHAPTERS, CHAPTER_RANGES, chapterMarks } from '@/config/chapters';
import { setDebugSettings } from '@/ui/debugStore';
import { auditPath, auditSummary } from '@/scene/audit';

/**
 * `?capture=1` hands control of progress to the test hook and stops the scroll
 * engine, so a frame grab is of exactly the requested point on the path rather
 * than of the camera still easing toward it.
 */
const CAPTURE = new URLSearchParams(location.search).has('capture');

export default function App() {
  useScrollEngine(!CAPTURE);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__gotoProgress = (p: number) => { progress.set(p); progress.snap(); };
    w.__setProgress = (p: number) => progress.set(p);
    w.__chapters = CHAPTERS.map((c, i) => ({
      index: c.index, id: c.id, title: c.title, subtitle: c.subtitle,
      range: CHAPTER_RANGES[i], marks: chapterMarks(i),
    }));
    w.__setSpline = (on: boolean) => setDebugSettings({ showSpline: !!on });
    w.__captureMode = CAPTURE;
    w.__auditPath = auditPath;
    w.__auditSummary = auditSummary;
    if (CAPTURE) {
      setDebugSettings({ showStats: false });
      document.documentElement.dataset.capture = '1';
    }
  }, []);

  return (
    <>
      <Scene />
      <Overlay />
      <DebugPanel />
    </>
  );
}
