import type { ReactNode } from 'react';
import { MODULATIONS } from '../dsp/modulation/constellation';
import { Impairments, NO_IMPAIRMENTS } from '../dsp/channel/impairments';
import type { LinkParams } from '../engine/link';

interface Props {
  params: LinkParams;
  update: (p: Partial<LinkParams>) => void;
  live: boolean;
  setLive: (v: boolean) => void;
}

const EXAMPLE: Impairments = { cfo: 0.002, phaseDeg: 35, linewidth: 1e-5, timing: 0.3 };

function Slider(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>
        {props.label} <span className="val">{props.display}</span>
      </label>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Group({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="group">
      <div className="group-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden="true" />
      {label}
    </label>
  );
}

export function Controls({ params, update, live, setLive }: Props) {
  const imp = params.imp ?? NO_IMPAIRMENTS;
  const setImp = (m: Partial<Impairments>) => update({ imp: { ...imp, ...m } });
  const impaired = imp.cfo !== 0 || imp.phaseDeg !== 0 || imp.linewidth > 0 || imp.timing !== 0;

  return (
    <aside className="panel" aria-label="Link parameters">
      <Group title="Signal">
        <div className="seg" role="group" aria-label="Modulation">
          {MODULATIONS.map((m) => (
            <button key={m.id} aria-pressed={params.mod === m.id} onClick={() => update({ mod: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
        <Slider
          id="ebn0"
          label="Eb/N0"
          value={params.ebN0dB}
          min={-4}
          max={34}
          step={0.5}
          display={`${params.ebN0dB.toFixed(1)} dB`}
          onChange={(v) => update({ ebN0dB: v })}
        />
      </Group>

      <Group
        title="Channel"
        action={
          <button
            className="link-btn"
            onClick={() =>
              impaired ? update({ imp: NO_IMPAIRMENTS }) : update({ imp: EXAMPLE, timingSync: true, carrierSync: true })
            }
          >
            {impaired ? 'Reset' : 'Example'}
          </button>
        }
      >
        <Slider
          id="cfo"
          label="Frequency offset"
          value={imp.cfo * 1000}
          min={-10}
          max={10}
          step={0.5}
          display={`${(imp.cfo * 1000).toFixed(1)}e-3 Rs`}
          onChange={(v) => setImp({ cfo: v / 1000 })}
        />
        <Slider
          id="phase"
          label="Phase offset"
          value={imp.phaseDeg}
          min={-180}
          max={180}
          step={5}
          display={`${imp.phaseDeg}°`}
          onChange={(v) => setImp({ phaseDeg: v })}
        />
        <Slider
          id="pn"
          label="Phase noise linewidth"
          value={imp.linewidth * 1e6}
          min={0}
          max={100}
          step={1}
          display={imp.linewidth ? `${(imp.linewidth * 1e6).toFixed(0)}e-6 Rs` : 'off'}
          onChange={(v) => setImp({ linewidth: v / 1e6 })}
        />
        <Slider
          id="tau"
          label="Timing offset"
          value={imp.timing}
          min={-0.5}
          max={0.5}
          step={0.05}
          display={`${imp.timing.toFixed(2)} T`}
          onChange={(v) => setImp({ timing: v })}
        />
      </Group>

      <Group title="Receiver">
        <Switch checked={!!params.timingSync} onChange={(v) => update({ timingSync: v })} label="Timing recovery (Gardner)" />
        <Switch checked={!!params.carrierSync} onChange={(v) => update({ carrierSync: v })} label="Carrier recovery (PLL)" />
      </Group>

      <details className="advanced">
        <summary>Advanced</summary>
        <div className="group">
          <Slider
            id="beta"
            label="RRC roll-off β"
            value={params.beta}
            min={0.05}
            max={1}
            step={0.05}
            display={params.beta.toFixed(2)}
            onChange={(v) => update({ beta: v })}
          />
          <Slider
            id="span"
            label="Filter span"
            value={params.span}
            min={4}
            max={16}
            step={2}
            display={`${params.span} T`}
            onChange={(v) => update({ span: v })}
          />
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
              <label htmlFor="nsym">Payload</label>
              <select id="nsym" value={params.nSym} onChange={(e) => update({ nSym: Number(e.target.value) })}>
                {[1000, 2000, 4000, 8000].map((v) => (
                  <option key={v} value={v}>
                    {v} sym
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Switch checked={live} onChange={setLive} label="Live noise (new frame every 120 ms)" />
        </div>
      </details>
    </aside>
  );
}
