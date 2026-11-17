/// <reference lib="webworker" />
import { simulateBerPoint } from './link';
import type { BerSweepRequest, BerWorkerMessage } from './berProtocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<BerSweepRequest>) => {
  const { cfg, points, targetErrors, maxBits, runId } = ev.data;
  for (const ebN0dB of points) {
    const point = simulateBerPoint(cfg, ebN0dB, { targetErrors, maxBits }, runId + 1);
    ctx.postMessage({ type: 'point', runId, point } satisfies BerWorkerMessage);
    // Past the cap with zero errors: the remaining points would be zero too.
    if (point.errors === 0) break;
  }
  ctx.postMessage({ type: 'done', runId } satisfies BerWorkerMessage);
};
