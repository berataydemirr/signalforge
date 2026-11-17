import { useState } from 'react';
import type { BerPoint, LinkResult } from '../../engine/link';
import { MODULATIONS, ModId, modInfo } from '../../dsp/modulation/constellation';
import { shannonEbN0LimitDb, theoreticalBer } from '../../dsp/theory/ber';
import { wilsonInterval } from '../../dsp/metrics/metrics';
import {
  CanvasPlot,
  FONT,
  Hover,
  Rect,
  Scope,
  Theme,
  Tick,
  clipTo,
  drawAxes,
  fmtCount,
  fmtSci,
  linScale,
  linTicks,
  pow10Label,
} from '../plot';

const PAD = { l: 50, r: 14, t: 10, b: 38 };
const DEC_MIN = -6;
const XMIN = -2;
/** Below this many errors a point is drawn hollow: its estimate is statistically loose. */
export const LOW_CONFIDENCE_ERRORS = 50;

export type BerResults = Partial<Record<ModId, BerPoint[]>>;

export const modColor = (theme: Theme, id: ModId) => theme.series[MODULATIONS.findIndex((m) => m.id === id)];

function reach(id: ModId): number {
  for (let db = XMIN; db <= 34; db += 0.25) if (theoreticalBer(id, db) < 10 ** DEC_MIN) return db;
  return 34;
}

function layout(w: number, h: number, xmax: number) {
  const r: Rect = { x: PAD.l, y: PAD.t, w: Math.max(10, w - PAD.l - PAD.r), h: Math.max(10, h - PAD.t - PAD.b) };
  return { r, sx: linScale(XMIN, xmax, r.x, r.x + r.w), sy: linScale(DEC_MIN, 0, r.y + r.h, r.y) };
}

interface Props {
  res: LinkResult;
  theme: Theme;
  results: BerResults;
  running: ModId | null;
  onRun: () => void;
  onStop: () => void;
  onClear: () => void;
}

export function BerScope({ res, theme, results, running, onRun, onStop, onClear }: Props) {
  const [hover, setHover] = useState<Hover | null>(null);
  const cur = res.params.mod;
  const shown = MODULATIONS.map((m) => m.id).filter((id) => id === cur || (results[id]?.length ?? 0) > 0);
  const xmax = Math.min(32, Math.max(10, Math.ceil(Math.max(...shown.map(reach)) + 1)));

  const points = shown.flatMap((id) => (results[id] ?? []).filter((p) => p.errors > 0));

  const nearest = (() => {
    if (!hover) return null;
    const { sx, sy } = layout(hover.w, hover.h, xmax);
    let best: BerPoint | null = null;
    let bd = 14 * 14;
    for (const p of points) {
      const d = (sx(p.ebN0dB) - hover.x) ** 2 + (sy(Math.log10(p.ber)) - hover.y) ** 2;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  })();

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const { r, sx, sy } = layout(w, h, xmax);
    const yt: Tick[] = [];
    for (let e = DEC_MIN; e <= 0; e++) yt.push({ v: e, label: pow10Label(e) });
    drawAxes(ctx, r, theme, linTicks(XMIN, xmax, 8), yt, sx, sy, 'Eb/N0 (dB)', 'Bit error rate');

    ctx.save();
    clipTo(ctx, r);

    // Theory curves
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    for (const id of shown) {
      ctx.strokeStyle = modColor(theme, id);
      ctx.globalAlpha = id === cur || results[id]?.length ? 1 : 0.6;
      ctx.beginPath();
      let first = true;
      for (let db = XMIN; db <= xmax + 0.05; db += 0.1) {
        const y = sy(Math.log10(Math.max(theoreticalBer(id, db), 1e-9)));
        if (first) ctx.moveTo(sx(db), y);
        else ctx.lineTo(sx(db), y);
        first = false;
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Shannon limit for the current spectral efficiency (eta = k, Nyquist band)
    const shX = sx(shannonEbN0LimitDb(res.constellation.k));
    ctx.strokeStyle = theme.text2;
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(shX) + 0.5, r.y);
    ctx.lineTo(Math.round(shX) + 0.5, r.y + r.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = theme.text2;
    ctx.font = FONT;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`Shannon limit, η = ${res.constellation.k}`, shX - 5, r.y + 4);

    // Current operating point
    const opX = sx(res.params.ebN0dB);
    ctx.strokeStyle = theme.text2;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(Math.round(opX) + 0.5, r.y);
    ctx.lineTo(Math.round(opX) + 0.5, r.y + r.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = theme.text2;
    ctx.font = FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('operating point', opX + 5, r.y + r.h - 4);
    if (res.ber > 0) {
      const y = sy(Math.log10(res.ber));
      ctx.strokeStyle = theme.text;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(opX, y - 6);
      ctx.lineTo(opX + 6, y);
      ctx.lineTo(opX, y + 6);
      ctx.lineTo(opX - 6, y);
      ctx.closePath();
      ctx.stroke();
    }

    // 95% Wilson confidence intervals
    ctx.lineWidth = 1.5;
    for (const p of points) {
      const [lo, hi] = wilsonInterval(p.errors, p.bits);
      const x = Math.round(sx(p.ebN0dB)) + 0.5;
      const y0 = sy(Math.log10(Math.max(lo, 1e-9)));
      const y1 = sy(Math.log10(hi));
      ctx.strokeStyle = modColor(theme, p.mod);
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.moveTo(x - 4, y0);
      ctx.lineTo(x + 4, y0);
      ctx.moveTo(x - 4, y1);
      ctx.lineTo(x + 4, y1);
      ctx.stroke();
    }

    // Simulated points
    for (const p of points) {
      const x = sx(p.ebN0dB);
      const y = sy(Math.log10(p.ber));
      const col = modColor(theme, p.mod);
      const solid = p.errors >= LOW_CONFIDENCE_ERRORS;
      const rad = p === nearest ? 6 : 4.5;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, 2 * Math.PI);
      ctx.fillStyle = solid ? col : theme.surface;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = solid ? theme.surface : col;
      ctx.stroke();
    }
    ctx.restore();
  };

  let tip = null;
  if (hover && nearest) {
    const { sx, sy } = layout(hover.w, hover.h, xmax);
    const th = theoreticalBer(nearest.mod, nearest.ebN0dB);
    const x = sx(nearest.ebN0dB);
    const y = sy(Math.log10(nearest.ber));
    const left = x > hover.w * 0.6;
    tip = (
      <div
        className="tooltip"
        style={{ left: left ? undefined : x + 12, right: left ? hover.w - x + 12 : undefined, top: Math.max(4, y - 30) }}
      >
        <div className="t">
          {modInfo(nearest.mod).label} @ {nearest.ebN0dB.toFixed(1)} dB
        </div>
        <div className="m">
          BER {fmtSci(nearest.ber)} · theory {fmtSci(th)}
        </div>
        <div className="m">
          {nearest.errors} errors / {fmtCount(nearest.bits)} bits
          {nearest.errors < LOW_CONFIDENCE_ERRORS ? ' · low confidence' : ''}
        </div>
      </div>
    );
  }

  const rows = shown.flatMap((id) => results[id] ?? []);
  const curLabel = modInfo(cur).label;

  return (
    <Scope
      title="BER vs Eb/N0"
      subtitle="Monte Carlo on the full waveform link vs closed-form theory"
      actions={
        running ? (
          <button className="btn" onClick={onStop}>
            Stop ({modInfo(running).label}…)
          </button>
        ) : (
          <>
            <button className="btn primary" onClick={onRun}>
              Run sweep: {curLabel}
            </button>
            {rows.length > 0 && (
              <button className="btn" onClick={onClear}>
                Clear
              </button>
            )}
          </>
        )
      }
      legend={
        <>
          {shown.map((id) => (
            <span className="item" key={id}>
              <span className="sw" style={{ background: modColor(theme, id) }} />
              {modInfo(id).label}
            </span>
          ))}
          <span className="item">line: theory</span>
          <span className="item">dot: simulated, 95% CI (hollow: &lt; {LOW_CONFIDENCE_ERRORS} errors)</span>
          <span className="item">diamond: live frame</span>
        </>
      }
      readout={
        rows.length === 0
          ? 'No sweep yet. Each point runs to 300 errors or 2M bits.'
          : `${rows.length} simulated points · ${fmtCount(rows.reduce((a, p) => a + p.bits, 0))} bits total`
      }
      footer={
        rows.length > 0 && (
          <details className="table">
            <summary>Data table</summary>
            <table>
              <thead>
                <tr>
                  <th>Modulation</th>
                  <th>Eb/N0 (dB)</th>
                  <th>Errors</th>
                  <th>Bits</th>
                  <th>BER (sim)</th>
                  <th>95% CI</th>
                  <th>BER (theory)</th>
                  <th>Sim / theory</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const th = theoreticalBer(p.mod, p.ebN0dB);
                  const [lo, hi] = wilsonInterval(p.errors, p.bits);
                  return (
                    <tr key={`${p.mod}-${p.ebN0dB}`}>
                      <td>{modInfo(p.mod).label}</td>
                      <td>{p.ebN0dB.toFixed(1)}</td>
                      <td>{p.errors}</td>
                      <td>{fmtCount(p.bits)}</td>
                      <td>{fmtSci(p.ber)}</td>
                      <td>
                        {fmtSci(lo)} – {fmtSci(hi)}
                      </td>
                      <td>{fmtSci(th)}</td>
                      <td>{p.errors ? (p.ber / th).toFixed(3) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        )
      }
    >
      <CanvasPlot
        draw={draw}
        deps={[res, theme, results, nearest, xmax]}
        label="Bit error rate versus Eb/N0, simulated points and theoretical curves"
        onHover={setHover}
      >
        {tip}
      </CanvasPlot>
    </Scope>
  );
}
