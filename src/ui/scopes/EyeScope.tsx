import { useState } from 'react';
import type { LinkResult } from '../../engine/link';
import { CanvasPlot, FONT, Hover, Rect, Scope, Theme, clipTo, drawAxes, linScale, linTicks } from '../plot';

const PAD = { l: 46, r: 14, t: 10, b: 38 };

function layout(w: number, h: number, Y: number) {
  const r: Rect = { x: PAD.l, y: PAD.t, w: Math.max(10, w - PAD.l - PAD.r), h: Math.max(10, h - PAD.t - PAD.b) };
  return { r, sx: linScale(-1, 1, r.x, r.x + r.w), sy: linScale(-Y, Y, r.y + r.h, r.y) };
}

export function EyeScope({ res, theme }: { res: LinkResult; theme: Theme }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const { sps } = res.params;
  const c = res.constellation;
  let maxAxis = 0;
  for (let b = 0; b < c.M; b++) maxAxis = Math.max(maxAxis, Math.abs(c.re[b]));
  const Y = maxAxis * 1.6;

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const { r, sx, sy } = layout(w, h, Y);
    drawAxes(ctx, r, theme, linTicks(-1, 1, 4), linTicks(-Y, Y, 4), sx, sy, 'Time (symbol periods, T)', 'I amplitude');

    ctx.save();
    clipTo(ctx, r);

    // Ideal sample levels
    const levels = Array.from(new Set(Array.from(c.re, (v) => Math.round(v * 1e6) / 1e6)));
    ctx.strokeStyle = theme.axis;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    for (const lv of levels) {
      ctx.moveTo(r.x, sy(lv));
      ctx.lineTo(r.x + r.w, sy(lv));
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Traces with persistence
    ctx.strokeStyle = theme.series[0];
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.16;
    ctx.lineJoin = 'round';
    for (const t of res.eye) {
      ctx.beginPath();
      for (let i = 0; i < t.length; i++) {
        const x = sx(i / sps - 1);
        const y = sy(t[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Optimum sampling instant
    ctx.strokeStyle = theme.text2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sx(0) + 0.5, r.y);
    ctx.lineTo(sx(0) + 0.5, r.y + r.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = theme.text2;
    ctx.font = FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('sampling instant', sx(0) + 6, r.y + 4);
    ctx.restore();
  };

  let readout = `${res.eye.length} traces · matched-filter output, ${sps} samples/symbol`;
  if (hover) {
    const { r, sx, sy } = layout(hover.w, hover.h, Y);
    if (hover.x >= r.x && hover.x <= r.x + r.w && hover.y >= r.y && hover.y <= r.y + r.h) {
      const t = linScale(sx(-1), sx(1), -1, 1)(hover.x);
      const a = linScale(sy(-Y), sy(Y), -Y, Y)(hover.y);
      readout = `t = ${t.toFixed(2)} T   amplitude = ${a.toFixed(3)}`;
    }
  }

  return (
    <Scope title="Eye diagram" subtitle={`RRC β = ${res.params.beta.toFixed(2)} → raised-cosine overall`} readout={readout}>
      <CanvasPlot draw={draw} deps={[res, theme]} label="Eye diagram of the matched filter output" onHover={setHover} />
    </Scope>
  );
}
