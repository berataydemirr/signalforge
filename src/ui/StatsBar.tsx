import type { LinkResult } from '../engine/link';
import { fmtSci } from './plot';

function Metric({ k, v, s }: { k: string; v: string; s: string }) {
  return (
    <div className="metric">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      <div className="s">{s}</div>
    </div>
  );
}

export function StatsBar({ res }: { res: LinkResult }) {
  const { timingSync, carrierSync } = res.params;
  const syncOn = timingSync || carrierSync;
  const mer = res.snrEstDb;
  return (
    <div className="metrics" aria-live="polite">
      <Metric k="BER" v={fmtSci(res.ber)} s={`theory ${fmtSci(res.berTheory)}`} />
      <Metric k="EVM" v={`${res.evmPct.toFixed(1)}%`} s={`MER ${Number.isFinite(mer) ? mer.toFixed(1) : '∞'} dB`} />
      <Metric k="Es/N0" v={`${res.esN0dB.toFixed(1)} dB`} s={`estimated ${Number.isFinite(mer) ? mer.toFixed(1) : '∞'} dB`} />
      <Metric
        k="Sync"
        v={!syncOn ? 'Off' : res.sync.lockAt >= 0 ? 'Locked' : 'Searching'}
        s={syncOn && res.sync.lockAt >= 0 ? `at symbol ${res.sync.lockAt}` : syncOn ? 'no lock in frame' : 'receiver loops disabled'}
      />
    </div>
  );
}
