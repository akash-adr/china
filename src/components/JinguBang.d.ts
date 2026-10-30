import * as THREE from 'three';

export interface JinguBangOptions {
  length?: number;
  radius?: number;
  capFraction?: number;
  maxExtend?: number;
  radialSegments?: number;
}

export declare class JinguBang extends THREE.Group {
  constructor(options?: JinguBangOptions);
  baseLength: number;
  radius: number;
  capLength: number;
  maxExtend: number;
  /** rad/sec about its own axis. */
  spin: number;
  /** 0-1, drives the inscription and cap rims. */
  glow: number;
  /** 0-1, grows the shaft up to maxExtend with the caps staying at the ends. */
  extend: number;
  readonly length: number;
  update(dt: number): void;
  getSize(): THREE.Vector3;
  dispose(): void;
}

export declare function createJinguBang(options?: JinguBangOptions): JinguBang;
