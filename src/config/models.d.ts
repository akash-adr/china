/** Hand-written types for the generated src/config/models.js. */
export interface ModelAnimation { name: string; duration: number; loop: boolean }
export interface ModelBudget {
  sizeMB: number; triangles: number; textureVramMB: number; drawCalls: number;
}
export interface ModelEntry {
  id: string;
  /** null for entries built in code rather than downloaded. */
  path: string | null;
  component?: string;
  module?: string;
  label: string;
  scale: number;
  baseOffset: number;
  rotationFix: [number, number, number];
  chapter: number;
  alsoIn?: number[];
  /** metres, after scale */
  worldSize: [number, number, number];
  animations: ModelAnimation[];
  budget: ModelBudget;
  note: string;
}
export declare const CHAPTERS: Record<number, string>;
export declare const MODELS: ModelEntry[];
export declare const MODELS_BY_ID: Record<string, ModelEntry>;
export declare const FILE_MODELS: ModelEntry[];
export declare const PROCEDURAL_MODELS: ModelEntry[];
export declare function modelsForChapter(chapter: number): ModelEntry[];
export declare function chapterDownloadMB(chapter: number): number;
export declare function chapterBudget(chapter: number): {
  chapter: number; title: string; models: string[];
  sizeMB: number; triangles: number; textureVramMB: number; drawCalls: number;
};
export declare const TOTAL_MB: number;
