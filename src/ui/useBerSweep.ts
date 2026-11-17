import { useCallback, useEffect, useRef, useState } from 'react';
import { ModId, modInfo } from '../dsp/modulation/constellation';
import { hasCarrierImpairment, NO_IMPAIRMENTS } from '../dsp/channel/impairments';
import { theoreticalBer } from '../dsp/theory/ber';
import type { BerSweepRequest, BerWorkerMessage } from '../engine/berProtocol';
import type { BerPoint, LinkConfig } from '../engine/link';

export interface BerSeries {
  label: string;
  points: BerPoint[];
}

/** One series per modulation; a new sweep of the same modulation replaces it. */
export type BerResults = Partial<Record<ModId, BerSeries>>;

/** 1 dB grid from -2 dB until theory drops below ~2e-6 (the 2M-bit cap can't resolve lower). */
export function sweepPoints(mod: ModId): number[] {
  const pts: number[] = [];
  for (let db = -2; db <= 32; db += 1) {
    pts.push(db);
    if (theoreticalBer(mod, db) < 2e-6) break;
  }
  return pts;
}

export function configLabel(cfg: LinkConfig): string {
  const imp = cfg.imp ?? NO_IMPAIRMENTS;
  const impaired = hasCarrierImpairment(imp) || imp.timing !== 0;
  const sync = cfg.timingSync || cfg.carrierSync;
  return [modInfo(cfg.mod).label, impaired && 'impaired', sync && 'sync on'].filter(Boolean).join(', ');
}

export function useBerSweep() {
  const [results, setResults] = useState<BerResults>({});
  const [running, setRunning] = useState<ModId | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const runRef = useRef(0);

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    runRef.current++;
    setRunning(null);
  }, []);

  const start = useCallback((cfg: LinkConfig) => {
    workerRef.current?.terminate();
    const runId = ++runRef.current;
    const { mod } = cfg;
    const w = new Worker(new URL('../engine/berWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    setResults((r) => ({ ...r, [mod]: { label: configLabel(cfg), points: [] } }));
    setRunning(mod);

    w.onmessage = (ev: MessageEvent<BerWorkerMessage>) => {
      const m = ev.data;
      if (m.runId !== runRef.current) return;
      if (m.type === 'point') {
        setResults((r) => {
          const s = r[mod];
          return s ? { ...r, [mod]: { ...s, points: [...s.points, m.point] } } : r;
        });
      } else {
        setRunning(null);
        w.terminate();
        if (workerRef.current === w) workerRef.current = null;
      }
    };

    // BER does not depend on the oversampling factor, so the sweep runs at 4 sps for speed.
    const req: BerSweepRequest = {
      runId,
      cfg: { ...cfg, sps: 4 },
      points: sweepPoints(mod),
      targetErrors: 300,
      maxBits: 2_000_000,
    };
    w.postMessage(req);
  }, []);

  const clear = useCallback(() => {
    stop();
    setResults({});
  }, [stop]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  return { results, running, start, stop, clear };
}
