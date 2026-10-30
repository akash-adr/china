/**
 * Lenis smooth scroll driving GSAP ScrollTrigger, which in turn drives the
 * single progress value the whole scene reads.
 *
 * Lenis is told to stop running its own RAF loop and is stepped from GSAP's
 * ticker instead. Two independent loops would otherwise drift against each
 * other and the camera would judder against the DOM overlay.
 */
import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { progress } from './progress';

gsap.registerPlugin(ScrollTrigger);

export function useScrollEngine(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const lenis = new Lenis({
      // A long duration plus a steep ease-out gives weight: the page keeps
      // moving after the gesture stops, the way a camera dolly would.
      duration: reduced ? 0 : 1.25,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: !reduced,
      syncTouch: false,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const trigger = ScrollTrigger.create({
      trigger: '.scroll-root',
      start: 'top top',
      end: 'bottom bottom',
      // A numeric scrub adds a second of catch-up on top of Lenis, which is
      // what stops the camera snapping to the scrollbar one-to-one.
      scrub: reduced ? true : 1.1,
      onUpdate: (self) => progress.set(self.progress),
    });

    // Fonts change layout height, which changes every trigger's end point.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => {
      trigger.kill();
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [enabled]);
}
