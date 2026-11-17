import type { ModId } from '../dsp/modulation/constellation';
import type { BerPoint } from './link';

export interface BerSweepRequest {
  runId: number;
  mod: ModId;
  beta: number;
  sps: number;
  span: number;
  points: number[];
  targetErrors: number;
  maxBits: number;
}

export type BerWorkerMessage =
  | { type: 'point'; runId: number; point: BerPoint }
  | { type: 'done'; runId: number };
