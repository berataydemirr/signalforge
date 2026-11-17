import { MODULATIONS } from '../dsp/modulation/constellation';
import type { LinkParams } from '../engine/link';

export interface Preset {
  title: string;
  text: string;
  params: Partial<LinkParams>;
}

export const PRESETS: Preset[] = [
  {
    title: 'Gray coding at work',
    text: '16-QAM at 7 dB: errors land on neighbours, which differ by one bit, so BER ≈ SER / 4.',
    params: { mod: '16qam', ebN0dB: 7, beta: 0.35 },
  },
  {
    title: 'Bandwidth vs roll-off',
    text: 'β = 1 → wide spectrum, wide-open eye. Drag β to 0.05: spectrum → Rs/2, eye closes in time.',
    params: { mod: 'qpsk', ebN0dB: 25, beta: 1 },
  },
  {
    title: 'Signal below the noise floor',
    text: 'BPSK at 0 dB Eb/N0: the PSD is mostly noise, yet BER is only ~8%.',
    params: { mod: 'bpsk', ebN0dB: 0, beta: 0.35 },
  },
  {
    title: 'The 256-QAM cliff',
    text: '8 bits/symbol needs ~24 dB for clean decisions. Lower Eb/N0 2 dB and watch it collapse.',
    params: { mod: '256qam', ebN0dB: 26, beta: 0.25 },
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
        <h2>Try this</h2>
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
