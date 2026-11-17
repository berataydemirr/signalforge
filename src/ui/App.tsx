import { useEffect, useMemo, useState } from 'react';
import { LinkParams, LinkResult, simulateLink } from '../engine/link';
import { Controls } from './Controls';
import { StatsBar } from './StatsBar';
import { LinkAnalysis } from './LinkAnalysis';
import { fmtSci, readTheme } from './plot';
import { useBerSweep } from './useBerSweep';
import { paramsFromUrl, writeParamsToUrl } from './urlState';
import { ConstellationScope } from './scopes/ConstellationScope';
import { EyeScope } from './scopes/EyeScope';
import { PsdScope } from './scopes/PsdScope';
import { PulseScope } from './scopes/PulseScope';
import { BerScope } from './scopes/BerScope';

const DEFAULTS: LinkParams = { mod: '16qam', ebN0dB: 12, beta: 0.35, sps: 8, span: 10, nSym: 2000, seed: 1 };
const REPO = 'https://github.com/berataydemirr/signalforge';
const initial = paramsFromUrl(DEFAULTS);

function chain(res: LinkResult): Array<{ name: string; detail: string; channel?: boolean }> {
  const { params: p, constellation: c } = res;
  return [
    { name: 'Bit source', detail: `PRBS, ${res.nBits} bits` },
    { name: 'Mapper', detail: `${c.label}, Gray` },
    { name: 'TX filter', detail: `RRC β=${p.beta.toFixed(2)}, ${res.nTaps} taps` },
    { name: 'AWGN', detail: `Es/N0 ${res.esN0dB.toFixed(1)} dB`, channel: true },
    { name: 'RX filter', detail: 'matched RRC' },
    { name: 'Sampler', detail: `1/${p.sps}, delay ${p.span} T` },
    { name: 'Slicer', detail: `min. distance, dmin ${res.dmin.toFixed(3)}` },
    { name: 'Metrics', detail: `BER ${fmtSci(res.ber)}` },
  ];
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export default function App() {
  const [params, setParams] = useState<LinkParams>(initial.params);
  const [live, setLive] = useState(() => !prefersReducedMotion());
  const [themeName, setThemeName] = useState(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  );
  // Re-read CSS tokens whenever the theme flips (the attribute is set before the state update).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const theme = useMemo(() => readTheme(), [themeName]);
  const sweep = useBerSweep();

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setParams((p) => ({ ...p, seed: (p.seed + 1) >>> 0 })), 120);
    return () => window.clearInterval(id);
  }, [live]);

  const res = useMemo(() => simulateLink(params), [params]);

  const { mod, ebN0dB, beta, sps, span } = params;
  useEffect(() => {
    writeParamsToUrl(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod, ebN0dB, beta, sps, span]);

  useEffect(() => {
    if (initial.autoSweep) sweep.start(initial.params.mod, initial.params.beta, initial.params.span);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<LinkParams>) => setParams((p) => ({ ...p, ...patch }));

  const toggleTheme = () => {
    const next = themeName === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('sf-theme', next);
    } catch {
      /* ignore */
    }
    setThemeName(next);
  };

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="var(--surface-2)" />
            <path d="M4 16c3-9 5-9 8 0s5 9 8 0 5-9 8 0" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <h1>SignalForge</h1>
          <span className="tag">Digital communication link simulator</span>
        </div>
        <span className="badge">M1 · baseband, AWGN</span>
        <span className="spacer" />
        <a className="toplink" href={REPO} target="_blank" rel="noreferrer">
          Source
        </a>
        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle light and dark theme">
          {themeName === 'dark' ? 'Light' : 'Dark'}
        </button>
      </header>

      <nav className="chain" aria-label="Signal chain">
        {chain(res).map((b, i) => (
          <span key={b.name} className="chain-item">
            {i > 0 && <span className="arrow" aria-hidden="true" />}
            <span className={b.channel ? 'blk ch' : 'blk'}>
              <span className="n">{b.name}</span>
              <span className="d">{b.detail}</span>
            </span>
          </span>
        ))}
      </nav>

      <main className="layout">
        <Controls
          params={params}
          update={update}
          live={live}
          setLive={setLive}
          onReseed={() => update({ seed: (params.seed + 1) >>> 0 })}
        />
        <div className="content">
          <StatsBar res={res} />
          <div className="grid">
            <ConstellationScope res={res} theme={theme} />
            <EyeScope res={res} theme={theme} />
            <PsdScope res={res} theme={theme} />
            <PulseScope res={res} theme={theme} />
            <BerScope
              res={res}
              theme={theme}
              results={sweep.results}
              running={sweep.running}
              onRun={() => sweep.start(params.mod, params.beta, params.span)}
              onStop={sweep.stop}
              onClear={sweep.clear}
            />
            <LinkAnalysis res={res} />
          </div>
        </div>
      </main>

      <footer className="foot">
        Complex baseband, Es = 1, unit-energy RRC. DSP implemented from first principles in TypeScript; BER and SER
        validated against closed-form results in CI. <a href={REPO}>Source</a>
      </footer>
    </>
  );
}
