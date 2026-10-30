/**
 * @react-three/fiber v9 augments React's JSX namespace from its own module, so
 * the augmentation only applies in files that import it. This pulls it in once
 * for the whole project, so components can use <mesh>, <ambientLight> etc.
 * without importing R3F purely for its types.
 */
import type {} from '@react-three/fiber';
