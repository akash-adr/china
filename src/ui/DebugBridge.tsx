import { useFrame, useThree } from '@react-three/fiber';
import { progress } from '@/scroll/progress';
import { pathT } from '@/scene/path';
import { readout } from './debugStore';

/** Lives inside the Canvas so it can read the live camera. Renders nothing. */
export function DebugBridge() {
  const camera = useThree((s) => s.camera);
  let frames = 0;
  let last = performance.now();

  useFrame(() => {
    readout.x = camera.position.x;
    readout.y = camera.position.y;
    readout.z = camera.position.z;
    readout.pathT = pathT(progress.value);

    frames++;
    const now = performance.now();
    if (now - last >= 500) {
      readout.fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
    }
  });
  return null;
}
