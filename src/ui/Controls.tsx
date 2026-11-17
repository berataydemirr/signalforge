import { MODULATIONS } from '../dsp/modulation/constellation';
import type { LinkParams } from '../engine/link';

export interface Preset {
  title: string;
  text: string;
  params: Partial<LinkParams>;
}

export const PRESETS: Preset[] = [
  {
    title: 'Gray mapping',
    text: '16-QAM, 7 dB. Most symbol errors flip one bit: BER·k/SER ≈ 1.',
    params: { mod: '16qam', ebN0dB: 7, beta: 0.35, span: 10 },
  },
  {
    title: 'Roll-off trade-off',
    text: 'QPSK, β = 1. Lower β: bandwidth → Rs, eye opening narrows in time.',
    params: { mod: 'qpsk', ebN0dB: 25, beta: 1, span: 10 },
  },
  {
    title: 'Low SNR',
    text: 'BPSK, 0 dB. In-band SNR below 0 dB, BER = Q(√2) ≈ 7.9e-2.',
    params: { mod: 'bpsk', ebN0dB: 0, beta: 0.35, span: 10 },
  },
  {
    title: 'Short filter',
    text: '16-QAM, span 4 T. Truncated RRC: higher sidelobes and residual ISI.',
    params: { mod: '16qam', ebN0dB: 30, beta: 0.2, span: 4 },
  },
  {
    title: '256-QAM threshold',
    text: '24 dB. Dropping 2 dB raises BER by about 100×.',
    params: { mod: '256qam', ebN0dB: 24, beta: 0.25, span: 10 },
  },
];

interface Props {
  params: LinkParams;
  update: (p: Partial<LinkParams>) => void;
  live: boolean;
  setLive: (v: boolean) => void;
  onReseed: () => void;
}

export function Controls({ params, update, live, setLive, onReseed }: Props) {
  return (
    <aside className="panel" aria-label="Link parameters">
      <div className="field">
        <span className="label">Modulation</span>
        <div className="seg" role="group" aria-label="Modulation">
          {MODULATIONS.map((m) => (
            <button key={m.id} aria-pressed={params.mod === m.id} onClick={() => update({ mod: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="ebn0">
          Eb/N0 <span className="val">{params.ebN0dB.toFixed(1)} dB</span>
        </label>
        <input
          id="ebn0"
          type="range"
          min={-4}
          max={34}
          step={0.5}
          value={params.ebN0dB}
          onChange={(e) => update({ ebN0dB: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label htmlFor="beta">
          RRC roll-off β <span className="val">{params.beta.toFixed(2)}</span>
        </label>
        <input
          id="beta"
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={params.beta}
          onChange={(e) => update({ beta: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label htmlFor="span">
          Filter span <span className="val">{params.span} symbols</span>
        </label>
        <input
          id="span"
          type="range"
          min={4}
          max={16}
          step={2}
          value={params.span}
          onChange={(e) => update({ span: Number(e.target.value) })}
        />
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="sps">Samples / symbol</label>
          <select id="sps" value={params.sps} onChange={(e) => update({ sps: Number(e.target.value) })}>
            {[4, 8, 16].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nsym">Frame</label>
          <select id="nsym" value={params.nSym} onChange={(e) => update({ nSym: Number(e.target.value) })}>
            {[1000, 2000, 4000, 8000].map((v) => (
              <option key={v} value={v}>
                {v} sym
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <label className="toggle">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          Live noise
        </label>
        <button className="btn" onClick={onReseed} disabled={live}>
          New frame
        </button>
      </div>

      <div className="presets">
        <h2>Presets</h2>
        {PRESETS.map((p) => (
          <button key={p.title} className="preset" onClick={() => update(p.params)}>
            <strong>{p.title}</strong>
            <span>{p.text}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
