import type { LinkResult } from '../engine/link';
import { isExactTheory } from '../dsp/theory/ber';
import { fmtCount, fmtSci } from './plot';

export function StatsBar({ res }: { res: LinkResult }) {
  const { params: p, constellation: c } = res;
  const eff = c.k / (1 + p.beta);
  return (
    <div className="stats" aria-live="polite">
      <div className="stat">
        <div className="k">BER (this frame)</div>
        <div className="v">{fmtSci(res.ber)}</div>
        <div className="s">
          {res.bitErrors} errors / {fmtCount(res.nBits)} bits
        </div>
      </div>
      <div className="stat">
        <div className="k">BER (theory)</div>
        <div className="v">{fmtSci(res.berTheory)}</div>
        <div className="s">{isExactTheory(p.mod) ? 'exact' : 'Gray approximation'}</div>
      </div>
      <div className="stat">
        <div className="k">EVM</div>
        <div className="v">{res.evmPct.toFixed(2)}%</div>
        <div className="s">rms, decision-directed</div>
      </div>
      <div className="stat">
        <div className="k">Es/N0 set → est.</div>
        <div className="v">
          {res.esN0dB.toFixed(1)} → {Number.isFinite(res.snrEstDb) ? res.snrEstDb.toFixed(1) : '∞'}
        </div>
        <div className="s">dB, estimated from EVM</div>
      </div>
      <div className="stat">
        <div className="k">Bandwidth</div>
        <div className="v">{(1 + p.beta).toFixed(2)} Rs</div>
        <div className="s">occupied, RRC β = {p.beta.toFixed(2)}</div>
      </div>
      <div className="stat">
        <div className="k">Spectral efficiency</div>
        <div className="v">{eff.toFixed(2)}</div>
        <div className="s">bit/s/Hz = k / (1+β)</div>
      </div>
    </div>
  );
}
