import { useEffect, useMemo, useState } from 'react';
import { LinkConfig, LinkParams, simulateLink } from '../engine/link';
import { NO_IMPAIRMENTS } from '../dsp/channel/impairments';
import { Controls } from './Controls';
import { StatsBar } from './StatsBar';
import { LinkAnalysis } from './LinkAnalysis';
import { readTheme } from './plot';
import { useBerSweep } from './useBerSweep';
import { paramsFromUrl, writeParamsToUrl } from './urlState';
import { ConstellationScope } from './scopes/ConstellationScope';
import { EyeScope } from './scopes/EyeScope';
import { PsdScope } from './scopes/PsdScope';
import { PulseScope } from './scopes/PulseScope';
import { SyncScope } from './scopes/SyncScope';
import { BerScope } from './scopes/BerScope';

const DEFAULTS: LinkParams = {
  mod: '16qam',
  ebN0dB: 14,
  beta: 0.35,
  sps: 8,
  span: 10,
  nSym: 2000,
  seed: 1,
  imp: NO_IMPAIRMENTS,
  timingSync: false,
  carrierSync: false,
};
const REPO = 'https://github.com/berataydemirr/signalforge';

const TABS = [
  { id: 'eye', label: 'Eye' },
  { id: 'psd', label: 'Spectrum' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'sync', label: 'Sync' },
  { id: 'ber', label: 'BER' },
  { id: 'details', label: 'Details' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const initial = paramsFromUrl(DEFAULTS);
const initialTab: TabId = TABS.some((t) => t.id === initial.tab) ? (initial.tab as TabId) : initial.autoSweep ? 'ber' : 'eye';

/** The parts of the parameters that define the link (what a BER sweep runs on). */
function configOf(p: LinkParams): LinkConfig {
  return { mod: p.mod, beta: p.beta, sps: p.sps, span: p.span, imp: p.imp, timingSync: p.timingSync, carrierSync: p.carrierSync };
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
  const [tab, setTab] = useState<TabId>(initialTab);
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

  const urlKey = JSON.stringify([configOf(params), params.ebN0dB]);
  useEffect(() => {
    writeParamsToUrl(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  const runSweep = () => sweep.start(configOf(params));

  useEffect(() => {
    if (initial.autoSweep) sweep.start(configOf(initial.params));
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
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M3 16c3.2-9 5.4-9 8.6 0s5.4 9 8.6 0 5.4-9 8.6 0" fill="none" stroke="var(--accent)" strokeWidth="3.2" strokeLinecap="round" />
          </svg>
          <h1>SignalForge</h1>
          <span className="tag">Digital link simulator</span>
        </div>
        <nav className="top-actions">
          <a href={REPO} target="_blank" rel="noreferrer">
            Source
          </a>
          <button className="text-btn" onClick={toggleTheme} aria-label="Toggle light and dark theme">
            {themeName === 'dark' ? 'Light' : 'Dark'}
          </button>
        </nav>
      </header>

      <main className="layout">
        <Controls params={params} update={update} live={live} setLive={setLive} />

        <div className="content">
          <StatsBar res={res} />
          <div className="views">
            <section className="card">
              <header className="card-head">
                <h2>Constellation</h2>
                <span className="hint">{res.constellation.label}</span>
              </header>
              <ConstellationScope res={res} theme={theme} />
            </section>

            <section className="card">
              <header className="card-head tabs" role="tablist" aria-label="Views">
                {TABS.map((t) => (
                  <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                    {t.label}
                  </button>
                ))}
              </header>
              <div role="tabpanel">
                {tab === 'eye' && <EyeScope res={res} theme={theme} />}
                {tab === 'psd' && <PsdScope res={res} theme={theme} />}
                {tab === 'pulse' && <PulseScope res={res} theme={theme} />}
                {tab === 'sync' && <SyncScope res={res} theme={theme} />}
                {tab === 'ber' && (
                  <BerScope
                    res={res}
                    theme={theme}
                    results={sweep.results}
                    running={sweep.running}
                    onRun={runSweep}
                    onStop={sweep.stop}
                    onClear={sweep.clear}
                  />
                )}
                {tab === 'details' && <LinkAnalysis res={res} />}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
