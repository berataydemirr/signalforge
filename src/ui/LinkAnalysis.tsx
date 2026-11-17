import type { LinkResult } from '../engine/link';
import { ebN0ForBer } from '../dsp/theory/ber';
import { PREAMBLE_LEN } from '../dsp/sync/carrier';
import { NO_IMPAIRMENTS } from '../dsp/channel/impairments';
import { fmtCount, fmtSci } from './plot';

type Row = [string, string, string?];

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="an-sec">
      <h4>{title}</h4>
      <dl>
        {rows.map(([k, v, note]) => (
          <div key={k} className="an-row">
            <dt>
              {k}
              {note && <span className="note">{note}</span>}
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LinkAnalysis({ res }: { res: LinkResult }) {
  const { params: p, constellation: c } = res;
  const imp = p.imp ?? NO_IMPAIRMENTS;
  const eta = c.k / (1 + p.beta);
  const [lo, hi] = res.berCi;
  const req = ebN0ForBer(p.mod, 1e-5);
  const s = res.sync;

  return (
    <div className="analysis">
      <Section
        title="Signal and noise"
        rows={[
          ['Modulation', `${c.label}`, `M = ${c.M}, k = ${c.k}, Es = 1`],
          ['Eb/N0 · Es/N0', `${p.ebN0dB.toFixed(1)} · ${res.esN0dB.toFixed(1)} dB`],
          ['N0 · σ per dim.', `${fmtSci(res.n0, 2)} · ${res.sigma.toFixed(3)}`],
          ['dmin / 2σ', res.dmin.toFixed(3) + ' / ' + (2 * res.sigma).toFixed(3) + ' = ' + (res.dmin / (2 * res.sigma)).toFixed(2), 'Q-function argument'],
        ]}
      />
      <Section
        title="Errors"
        rows={[
          ['BER', `${fmtSci(res.ber)}`, `95% CI ${fmtSci(lo)} – ${fmtSci(hi)}, ${res.bitErrors} / ${fmtCount(res.nBits)} bits`],
          ['SER meas. · theory', `${fmtSci(res.ser)} · ${fmtSci(res.serTheory)}`],
          ['BER·k / SER', res.symbolErrors ? ((res.ber * c.k) / res.ser).toFixed(3) : '—', '≈ 1 with Gray mapping'],
          ['EVM · MER', `${res.evmPct.toFixed(2)}% · ${res.snrEstDb.toFixed(1)} dB`],
        ]}
      />
      <Section
        title="Synchronization"
        rows={[
          ['Channel', `Δf ${fmtSci(imp.cfo, 1)} Rs · φ ${imp.phaseDeg}° · τ ${imp.timing} T`, `phase noise linewidth ${fmtSci(imp.linewidth, 1)} Rs`],
          ['Timing loop', p.timingSync ? 'Gardner, BnT 0.04 → 0.01' : 'off', 'gear shift after half the preamble'],
          ['Carrier loop', p.carrierSync ? 'PLL, BnT 0.05 → 0.01' : 'off', `data-aided on ${PREAMBLE_LEN}-symbol preamble, then decision-directed`],
          ['Lock · residual', s.lockAt >= 0 ? `symbol ${s.lockAt} · ${s.phaseRmsDeg.toFixed(1)}°, ${s.timingRms.toFixed(3)} T` : 'not locked', 'strong phase noise on dense QAM can cause cycle slips'],
        ]}
      />
      <Section
        title="Pulse shaping and capacity"
        rows={[
          ['RRC', `β ${p.beta.toFixed(2)} · ${res.nTaps} taps · ${p.span} T`],
          ['Residual ISI · stopband', `${res.isiDb.toFixed(1)} · ${res.stopbandDb.toFixed(1)} dB`, 'from filter truncation'],
          ['η · Shannon C/B', `${eta.toFixed(2)} · ${res.capacity.toFixed(2)} bit/s/Hz`],
          ['Gap to Shannon @ 1e-5', `${(req - res.shannonLimitDb).toFixed(2)} dB`, `needs ${req.toFixed(2)} dB vs limit ${res.shannonLimitDb.toFixed(2)} dB`],
        ]}
      />
    </div>
  );
}
