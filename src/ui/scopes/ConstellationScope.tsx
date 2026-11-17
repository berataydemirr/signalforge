import { useState } from 'react';
import type { LinkResult } from '../../engine/link';
import { CanvasPlot, FONT, Hover, Rect, Scope, Theme, clipTo, drawAxes, linScale, linTicks } from '../plot';

const PAD = { l: 46, r: 14, t: 10, b: 38 };

function layout(w: number, h: number, R: number) {
  const side = Math.max(10, Math.min(w - PAD.l - PAD.r, h - PAD.t - PAD.b));
  const r: Rect = { x: PAD.l + (w - PAD.l - PAD.r - side) / 2, y: PAD.t, w: side, h: side };
  return { r, sx: linScale(-R, R, r.x, r.x + r.w), sy: linScale(-R, R, r.y + r.h, r.y) };
}

export function ConstellationScope({ res, theme }: { res: LinkResult; theme: Theme }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const c = res.constellation;
  let maxAxis = 0;
  for (let b = 0; b < c.M; b++) maxAxis = Math.max(maxAxis, Math.abs(c.re[b]), Math.abs(c.im[b]));
  const R = maxAxis * 1.5;

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const { r, sx, sy } = layout(w, h, R);
    const ticks = linTicks(-R, R, 4);
    drawAxes(ctx, r, theme, ticks, ticks, sx, sy, 'In-phase (I)', 'Quadrature (Q)');

    ctx.save();
    clipTo(ctx, r);

    // Decision boundaries of the minimum-distance slicer
    ctx.strokeStyle = theme.axis;
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (c.kind === 'qam') {
      const L = Math.round(Math.sqrt(c.M));
      for (let j = 1; j < L; j++) {
        const t = (2 * j - L) * c.param;
        ctx.moveTo(sx(t), r.y);
        ctx.lineTo(sx(t), r.y + r.h);
        ctx.moveTo(r.x, sy(t));
        ctx.lineTo(r.x + r.w, sy(t));
      }
    } else {
      for (let m = 0; m < c.M; m++) {
        const a = c.param + ((2 * m + 1) * Math.PI) / c.M;
        ctx.moveTo(sx(0), sy(0));
        ctx.lineTo(sx(2 * R * Math.cos(a)), sy(2 * R * Math.sin(a)));
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Received symbols (matched-filter output at the sampling instants)
    ctx.fillStyle = theme.series[0];
    ctx.globalAlpha = c.M >= 64 ? 0.35 : 0.5;
    const { re, im } = res.rxSym;
    for (let i = 0; i < re.length; i++) ctx.fillRect(sx(re[i]) - 1, sy(im[i]) - 1, 2.2, 2.2);
    ctx.globalAlpha = 1;

    // Ideal points + Gray labels
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 1.5;
    const ring = c.M >= 64 ? 2.5 : 4.5;
    for (let b = 0; b < c.M; b++) {
      ctx.beginPath();
      ctx.arc(sx(c.re[b]), sy(c.im[b]), ring, 0, 2 * Math.PI);
      ctx.stroke();
    }
    if (c.M <= 16) {
      ctx.fillStyle = theme.text2;
      ctx.font = FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (let b = 0; b < c.M; b++) {
        ctx.fillText(b.toString(2).padStart(c.k, '0'), sx(c.re[b]), sy(c.im[b]) - 7);
      }
    }
    ctx.restore();
  };

  let readout = `${res.rxSym.re.length} payload symbols after the receiver · dashed: decision boundaries`;
  if (hover) {
    const { r, sx, sy } = layout(hover.w, hover.h, R);
    if (hover.x >= r.x && hover.x <= r.x + r.w && hover.y >= r.y && hover.y <= r.y + r.h) {
      const I = linScale(sx(-R), sx(R), -R, R)(hover.x);
      const Q = linScale(sy(-R), sy(R), -R, R)(hover.y);
      readout = `I = ${I.toFixed(3)}   Q = ${Q.toFixed(3)}   |r| = ${Math.hypot(I, Q).toFixed(3)}`;
    }
  }

  return (
    <Scope readout={readout}>
      <CanvasPlot
        draw={draw}
        deps={[res, theme]}
        label={`Constellation diagram of received ${c.label} symbols`}
        onHover={setHover}
      />
    </Scope>
  );
}
