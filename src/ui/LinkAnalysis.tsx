import type { LinkResult } from '../engine/link';
import { ebN0ForBer } from '../dsp/theory/ber';
import { fmtCount, fmtSci } from './plot';

type Row = [string, string, string?];

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="an-sec">
      <h4>{title}</h4>
      <dl>
        {rows.map(([k, v, note]) => (
          <div key={k} className="an-row">
            <dt>{k}</dt>
            <dd>
              {v}
              {note && <span className="note">{note}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LinkAnalysis({ res }: { res: LinkResult }) {
  const { params: p, constellation: c } = res;
  const eta = c.k / (1 + p.beta);
  const qArg = res.dmin / (2 * res.sigma);
  const [lo, hi] = res.berCi;
  const req = ebN0ForBer(p.mod, 1e-5);

  return (
    <section className="scope analysis">
      <header>
        <h3>Link analysis</h3>
        <span className="sub">current frame, {p.nSym} symbols</span>
      </header>
      <div className="an-grid">
        <Section
          title="Signal"
          rows={[
            ['Modulation', `${c.label}`, `M = ${c.M}, k = ${c.k}`],
            ['Symbol energy Es', '1.000', 'normalized'],
            ['Min. distance dmin', res.dmin.toFixed(4)],
            ['dmin / 2σ', qArg.toFixed(3), 'Q-function argument'],
          ]}
        />
        <Section
          title="Noise"
          rows={[
            ['Eb/N0', `${p.ebN0dB.toFixed(2)} dB`],
            ['Es/N0', `${res.esN0dB.toFixed(2)} dB`],
            ['N0', fmtSci(res.n0, 3), 'per complex sample'],
            ['σ per dimension', res.sigma.toFixed(4)],
          ]}
        />
        <Section
          title="Errors"
          rows={[
            ['Bit errors', `${res.bitErrors} / ${fmtCount(res.nBits)}`],
            ['BER (95% CI)', fmtSci(res.ber), `[${fmtSci(lo)}, ${fmtSci(hi)}]`],
            ['SER meas. / theory', `${fmtSci(res.ser)} / ${fmtSci(res.serTheory)}`],
            ['BER·k / SER', res.symbolErrors ? ((res.ber * c.k) / res.ser).toFixed(3) : '—', '→ 1 with Gray coding'],
          ]}
        />
        <Section
          title="Pulse shaping"
          rows={[
            ['RRC roll-off β', p.beta.toFixed(2)],
            ['Taps / span', `${res.nTaps} / ${p.span} T`, `${p.sps} samples/symbol`],
            ['Residual ISI', `${res.isiDb.toFixed(1)} dB`, 'from truncation'],
            ['Stopband level', `${res.stopbandDb.toFixed(1)} dB`, 'TX PSD outside band'],
          ]}
        />
        <Section
          title="Capacity"
          rows={[
            ['Spectral efficiency η', `${eta.toFixed(3)} bit/s/Hz`, 'k / (1+β)'],
            ['Shannon C / B', `${res.capacity.toFixed(3)} bit/s/Hz`, 'log2(1 + SNR)'],
            ['Shannon limit, η = k', `${res.shannonLimitDb.toFixed(2)} dB`, '(2^k − 1) / k'],
            ['Eb/N0 for BER 1e-5', `${req.toFixed(2)} dB`, 'uncoded, theory'],
            ['Gap to Shannon', `${(req - res.shannonLimitDb).toFixed(2)} dB`, 'at BER 1e-5, room for coding'],
          ]}
        />
      </div>
    </section>
  );
}
