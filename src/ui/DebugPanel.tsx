import { useEffect } from 'react';
import { Leva, useControls, button } from 'leva';
import { progress } from '@/scroll/progress';
import { CHAPTERS } from '@/config/chapters';
import { readout, setDebugSettings } from './debugStore';

/**
 * leva panel: live scroll/camera readouts, plus toggles for the spline overlay
 * and the FPS meter. Hidden by default; press D to show it.
 */
export function DebugPanel() {
  const [values, set] = useControls(() => ({
    progress: { value: '0.000', editable: false },
    chapter: { value: '—', editable: false },
    pathT: { value: '0.000', editable: false },
    camera: { value: '0.0, 0.0, 0.0', editable: false },
    fps: { value: '0', editable: false },
    showSpline: { value: false, label: 'draw camera spline' },
    showStats: { value: true, label: 'fps meter' },
    'jump to chapter': button(() => {
      const i = (progress.chapter + 1) % CHAPTERS.length;
      const el = document.getElementById(CHAPTERS[i].id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }),
  }));

  // Push toggles out to the scene.
  useEffect(() => {
    setDebugSettings({
      showSpline: values.showSpline as boolean,
      showStats: values.showStats as boolean,
    });
  }, [values.showSpline, values.showStats]);

  // Sample readouts at ~10 Hz. Reading them every frame would re-render the
  // panel 60 times a second to display numbers nobody can read that fast.
  useEffect(() => {
    const id = window.setInterval(() => {
      const c = CHAPTERS[progress.chapter];
      set({
        progress: progress.value.toFixed(3),
        chapter: `${c.index}. ${c.subtitle}`,
        pathT: readout.pathT.toFixed(3),
        camera: `${readout.x.toFixed(1)}, ${readout.y.toFixed(1)}, ${readout.z.toFixed(1)}`,
        fps: String(readout.fps),
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [set]);

  // D toggles the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        const el = document.querySelector<HTMLElement>('#leva__root');
        if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <Leva collapsed titleBar={{ title: "debug (D)" }} hidden={!import.meta.env.DEV} />;
}
