import type { LinkResult } from '../engine/link';
import { isExactTheory } from '../dsp/theory/ber';
import { fmtSci } from './plot';

export function StatsBar({ res }: { res: LinkResult }) {
  const { params: p, constellation: c } = res;
  const [lo, hi] = res.berCi;
  const mer = -20 * Math.log10(res.evmPct / 100);
  return (
    <div className="stats" aria-live="polite">
      <div className="stat">
        <div className="k">BER, frame</div>
        <div className="v">{fmtSci(res.ber)}</div>
        <div className="s">
          95% CI {fmtSci(lo, 1)} – {fmtSci(hi, 1)}
        </div>
      </div>
      <div className="stat">
        <div className="k">BER, theory</div>
        <div className="v">{fmtSci(res.berTheory)}</div>
        <div className="s">{isExactTheory(p.mod) ? 'exact' : 'Gray approximation'}</div>
      </div>
      <div className="stat">
        <div className="k">SER, frame</div>
        <div className="v">{fmtSci(res.ser)}</div>
        <div className="s">theory {fmtSci(res.serTheory)}</div>
      </div>
      <div className="stat">
        <div className="k">EVM</div>
        <div className="v">{res.evmPct.toFixed(2)}%</div>
        <div className="s">MER {Number.isFinite(mer) ? mer.toFixed(1) : '∞'} dB</div>
      </div>
      <div className="stat">
        <div className="k">Es/N0, set / est.</div>
        <div className="v">
          {res.esN0dB.toFixed(1)} / {Number.isFinite(res.snrEstDb) ? res.snrEstDb.toFixed(1) : '∞'}
        </div>
        <div className="s">dB, estimate from EVM</div>
      </div>
      <div className="stat">
        <div className="k">Efficiency / capacity</div>
        <div className="v">
          {(c.k / (1 + p.beta)).toFixed(2)} / {res.capacity.toFixed(2)}
        </div>
        <div className="s">bit/s/Hz in (1+β)Rs</div>
      </div>
    </div>
  );
}
