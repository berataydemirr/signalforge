import type { BerPoint, LinkConfig } from './link';

export interface BerSweepRequest {
  runId: number;
  cfg: LinkConfig;
  points: number[];
  targetErrors: number;
  maxBits: number;
}

export type BerWorkerMessage =
  | { type: 'point'; runId: number; point: BerPoint }
  | { type: 'done'; runId: number };
