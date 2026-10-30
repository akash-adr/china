import { useEffect } from 'react';
import { Scene } from '@/scene/Scene';
import { Overlay } from '@/ui/Overlay';
import { DebugPanel } from '@/ui/DebugPanel';
import { useScrollEngine } from '@/scroll/useScrollEngine';
import { progress } from '@/scroll/progress';
import { CHAPTERS, CHAPTER_RANGES, chapterMarks } from '@/config/chapters';
import { setDebugSettings } from '@/ui/debugStore';
import { auditPath, auditSummary } from '@/scene/audit';
import { cameraAt, lookAtAt, pathT } from '@/scene/path';
import { Vector3 } from 'three';

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
    // Camera + aim at an arbitrary progress, without having to drive the page.
    w.__pathState = (v: number) => {
      const c = cameraAt(v, new Vector3());
      const a = lookAtAt(v, new Vector3());
      return {
        progress: +v.toFixed(3),
        camera: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)],
        lookAt: [+a.x.toFixed(1), +a.y.toFixed(1), +a.z.toFixed(1)],
        pathT: +pathT(v).toFixed(3),
      };
    };
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
