import { useState } from 'react';
import type { LinkResult } from '../../engine/link';
import type { Psd } from '../../dsp/metrics/metrics';
import { CanvasPlot, FONT, Hover, Rect, Scope, Scale, Theme, clipTo, drawAxes, linScale, linTicks } from '../plot';

const PAD = { l: 46, r: 14, t: 10, b: 38 };
const YMIN = -70;
const YMAX = 5;

function layout(w: number, h: number, X: number) {
  const r: Rect = { x: PAD.l, y: PAD.t, w: Math.max(10, w - PAD.l - PAD.r), h: Math.max(10, h - PAD.t - PAD.b) };
  return { r, sx: linScale(-X, X, r.x, r.x + r.w), sy: linScale(YMIN, YMAX, r.y + r.h, r.y) };
}

function line(ctx: CanvasRenderingContext2D, p: Psd, sps: number, sx: Scale, sy: Scale) {
  ctx.beginPath();
  for (let i = 0; i < p.freq.length; i++) {
    const x = sx(p.freq[i] * sps);
    const y = sy(Math.max(p.db[i], YMIN - 10));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function PsdScope({ res, theme }: { res: LinkResult; theme: Theme }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const { sps, beta } = res.params;
  const X = Math.min(sps / 2, 2);
  const edge = (1 + beta) / 2;

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const { r, sx, sy } = layout(w, h, X);
    drawAxes(ctx, r, theme, linTicks(-X, X, 8), linTicks(YMIN, YMAX - 5, 7), sx, sy, 'Frequency (f / Rs)', 'PSD (dB, rel.)');
    ctx.save();
    clipTo(ctx, r);

    // Occupied bandwidth markers
    ctx.strokeStyle = theme.text2;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const f of [-edge, edge]) {
      ctx.moveTo(sx(f) + 0.5, r.y);
      ctx.lineTo(sx(f) + 0.5, r.y + r.h);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = theme.text2;
    ctx.font = FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('(1+β)Rs/2', sx(edge) + 5, r.y + 4);

    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = theme.series[0];
    line(ctx, res.psdRx, sps, sx, sy);
    ctx.strokeStyle = theme.series[1];
    line(ctx, res.psdTx, sps, sx, sy);

    if (hover) {
      const hx = Math.min(Math.max(hover.x, r.x), r.x + r.w);
      ctx.strokeStyle = theme.axis;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(hx) + 0.5, r.y);
      ctx.lineTo(Math.round(hx) + 0.5, r.y + r.h);
      ctx.stroke();
    }
    ctx.restore();
  };

  let readout = `Welch, Hann, 512-pt · occupied BW = (1+β)Rs = ${(1 + beta).toFixed(2)} Rs`;
  if (hover) {
    const { r, sx } = layout(hover.w, hover.h, X);
    if (hover.x >= r.x && hover.x <= r.x + r.w) {
      const f = linScale(sx(-X), sx(X), -X, X)(hover.x);
      const n = res.psdTx.freq.length;
      const i = Math.min(n - 1, Math.max(0, Math.round((f / sps + 0.5) * n)));
      readout = `f = ${f.toFixed(3)} Rs   TX ${res.psdTx.db[i].toFixed(1)} dB   RX ${res.psdRx.db[i].toFixed(1)} dB`;
    }
  }

  return (
    <Scope
      readout={readout}
      legend={
        <>
          <span className="item"><span className="sw" style={{ background: theme.series[1] }} />Transmitted</span>
          <span className="item"><span className="sw" style={{ background: theme.series[0] }} />Received (signal + noise)</span>
        </>
      }
    >
      <CanvasPlot draw={draw} deps={[res, theme, hover]} label="Power spectral density of the transmitted and received signals" onHover={setHover} />
    </Scope>
  );
}
