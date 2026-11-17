import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModId } from '../dsp/modulation/constellation';
import { theoreticalBer } from '../dsp/theory/ber';
import type { BerSweepRequest, BerWorkerMessage } from '../engine/berProtocol';
import type { BerResults } from './scopes/BerScope';

/** 1 dB grid from -2 dB until theory drops below ~2e-6 (the 2M-bit cap can't resolve lower). */
export function sweepPoints(mod: ModId): number[] {
  const pts: number[] = [];
  for (let db = -2; db <= 32; db += 1) {
    pts.push(db);
    if (theoreticalBer(mod, db) < 2e-6) break;
  }
  return pts;
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

  const start = useCallback((mod: ModId, beta: number, span: number) => {
    workerRef.current?.terminate();
    const runId = ++runRef.current;
    const w = new Worker(new URL('../engine/berWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    setResults((r) => ({ ...r, [mod]: [] }));
    setRunning(mod);

    w.onmessage = (ev: MessageEvent<BerWorkerMessage>) => {
      const m = ev.data;
      if (m.runId !== runRef.current) return;
      if (m.type === 'point') {
        setResults((r) => ({ ...r, [mod]: [...(r[mod] ?? []), m.point] }));
      } else {
        setRunning(null);
        w.terminate();
        if (workerRef.current === w) workerRef.current = null;
      }
    };

    // BER is independent of the oversampling factor, so the sweep runs at 4 sps for speed.
    const req: BerSweepRequest = {
      runId,
      mod,
      beta,
      sps: 4,
      span,
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
