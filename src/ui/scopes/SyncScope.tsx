import { useState } from 'react';
import type { LinkResult } from '../../engine/link';
import { PREAMBLE_LEN } from '../../dsp/sync/carrier';
import { CanvasPlot, FONT, Hover, Rect, Scale, Scope, Theme, clipTo, drawAxes, linScale, linTicks } from '../plot';

const PAD = { l: 50, r: 14, t: 10, b: 38 };
const GAP = 34;

/** Smallest of +-20/45/90/180 deg that holds the trace with some headroom. */
function phaseRange(err: Float64Array): number {
  let m = 0;
  for (const v of err) m = Math.max(m, Math.abs(v));
  const d = (m * 180) / Math.PI * 1.15;
  return [20, 45, 90, 180].find((r) => r >= d) ?? 180;
}

function layout(w: number, h: number, n: number, P: number) {
  const pw = Math.max(10, w - PAD.l - PAD.r);
  const ph = Math.max(10, (h - PAD.t - PAD.b - GAP) / 2);
  const top: Rect = { x: PAD.l, y: PAD.t, w: pw, h: ph };
  const bot: Rect = { x: PAD.l, y: PAD.t + ph + GAP, w: pw, h: ph };
  const sx = linScale(0, n - 1, top.x, top.x + top.w);
  return { top, bot, sx, syP: linScale(-P, P, top.y + top.h, top.y), syT: linScale(-0.5, 0.5, bot.y + bot.h, bot.y) };
}

function trace(ctx: CanvasRenderingContext2D, y: Float64Array, scale: number, sx: Scale, sy: Scale, wrapJump?: number) {
  ctx.beginPath();
  let prev = NaN;
  for (let k = 0; k < y.length; k++) {
    const v = y[k] * scale;
    const X = sx(k);
    const Y = sy(v);
    // Don't draw a vertical line across a +-180 deg wrap.
    if (k === 0 || (wrapJump !== undefined && Math.abs(v - prev) > wrapJump)) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
    prev = v;
  }
  ctx.stroke();
}

export function SyncScope({ res, theme }: { res: LinkResult; theme: Theme }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const n = res.phaseErr.length;
  const { timingSync, carrierSync } = res.params;
  const deg = 180 / Math.PI;
  const P = phaseRange(res.phaseErr);

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const { top, bot, sx, syP, syT } = layout(w, h, n, P);
    const xt = linTicks(0, n - 1, 6);
    drawAxes(ctx, top, theme, xt, linTicks(-P, P, 4), sx, syP, '', 'Phase error (°)');
    drawAxes(ctx, bot, theme, xt, linTicks(-0.5, 0.5, 4), sx, syT, 'Symbol index', 'Timing error (T)');

    for (const [r, sy, y, scale, jump, color, label] of [
      [top, syP, res.phaseErr, deg, 180, theme.series[0], carrierSync ? 'carrier PLL' : 'carrier recovery off'],
      [bot, syT, res.timingErr, 1, undefined, theme.series[2], timingSync ? 'Gardner loop' : 'timing recovery off'],
    ] as const) {
      ctx.save();
      clipTo(ctx, r);
      // Preamble (data-aided acquisition) region
      ctx.fillStyle = theme.grid;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(r.x, r.y, sx(PREAMBLE_LEN) - r.x, r.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = theme.axis;
      ctx.beginPath();
      ctx.moveTo(r.x, Math.round(sy(0)) + 0.5);
      ctx.lineTo(r.x + r.w, Math.round(sy(0)) + 0.5);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      trace(ctx, y, scale, sx, sy, jump);
      ctx.fillStyle = theme.text2;
      ctx.font = FONT;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(label, r.x + r.w - 6, r.y + 4);
      ctx.restore();
    }
    ctx.fillStyle = theme.muted;
    ctx.font = FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('preamble', top.x + 4, top.y + 4);

    if (res.sync.lockAt > 0) {
      const x = Math.round(sx(res.sync.lockAt)) + 0.5;
      ctx.strokeStyle = theme.text2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, top.y);
      ctx.lineTo(x, bot.y + bot.h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const s = res.sync;
  let readout =
    s.lockAt >= 0
      ? `Locked at symbol ${s.lockAt} · residual rms: phase ${s.phaseRmsDeg.toFixed(2)}°, timing ${s.timingRms.toFixed(3)} T`
      : `Not locked · residual rms: phase ${s.phaseRmsDeg.toFixed(1)}°, timing ${s.timingRms.toFixed(3)} T`;
  if (hover) {
    const { top, sx } = layout(hover.w, hover.h, n, P);
    if (hover.x >= top.x && hover.x <= top.x + top.w) {
      const k = Math.round(linScale(sx(0), sx(n - 1), 0, n - 1)(hover.x));
      readout = `symbol ${k}   phase error ${(res.phaseErr[k] * deg).toFixed(2)}°   timing error ${res.timingErr[k].toFixed(3)} T`;
    }
  }

  return (
    <Scope subtitle="Receiver estimate minus true channel value, per symbol" readout={readout}>
      <CanvasPlot draw={draw} deps={[res, theme]} label="Phase and timing error of the receiver versus symbol index" onHover={setHover} />
    </Scope>
  );
}
