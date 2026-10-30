import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import './LoadingScreen.css';

/**
 * Initial load only. Black void, one gold hairline, a percentage.
 *
 * It waits a beat after reaching 100% before dismissing: drei reports progress
 * from the loading manager, which finishes before the first frame with that
 * geometry on screen is actually drawn. Dismissing immediately shows a blank
 * canvas for a few frames.
 */
export function LoadingScreen() {
  const { progress, active } = useProgress();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done || active || progress < 100) return;
    const id = window.setTimeout(() => setDone(true), 450);
    return () => window.clearTimeout(id);
  }, [progress, active, done]);

  return (
    <div className="loading-screen" data-done={done} aria-hidden={done}>
      <div className="track">
        <div className="fill" style={{ transform: `scaleX(${Math.min(1, progress / 100)})` }} />
      </div>
      <div className="pct">{Math.round(progress)}%</div>
    </div>
  );
}
