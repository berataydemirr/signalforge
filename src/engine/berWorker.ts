/// <reference lib="webworker" />
import { simulateBerPoint } from './link';
import type { BerSweepRequest, BerWorkerMessage } from './berProtocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<BerSweepRequest>) => {
  const req = ev.data;
  const { mod, beta, sps, span, points, targetErrors, maxBits, runId } = req;
  for (const ebN0dB of points) {
    const p = simulateBerPoint({ mod, beta, sps, span }, ebN0dB, { targetErrors, maxBits }, runId + 1);
    const msg: BerWorkerMessage = { type: 'point', runId, point: p };
    ctx.postMessage(msg);
    // Past the cap with zero errors: the remaining points would be zero too.
    if (p.errors === 0) break;
  }
  const done: BerWorkerMessage = { type: 'done', runId };
  ctx.postMessage(done);
};
