import { useMemo, useState } from 'react';
import type { LinkResult } from '../../engine/link';
import { rrcTaps, selfConvolve } from '../../dsp/core/filters';
import { CanvasPlot, FONT, Hover, Rect, Scope, Theme, clipTo, drawAxes, linScale, linTicks } from '../plot';

const PAD = { l: 46, r: 14, t: 10, b: 38 };
const YMIN = -0.3;
const YMAX = 1.15;

function layout(w: number, h: number, X: number) {
  const r: Rect = { x: PAD.l, y: PAD.t, w: Math.max(10, w - PAD.l - PAD.r), h: Math.max(10, h - PAD.t - PAD.b) };
  return { r, sx: linScale(-X, X, r.x, r.x + r.w), sy: linScale(YMIN, YMAX, r.y + r.h, r.y) };
}

export function PulseScope({ res, theme }: { res: LinkResult; theme: Theme }) {
  const [hover, setHover] = useState<Hover | null>(null);
  const { beta, sps, span } = res.params;
  const X = Math.min(span, 6);

  const { h, rc } = useMemo(() => {
    const taps = rrcTaps(beta, sps, span);
    const p = selfConvolve(taps);
    const hPeak = taps[(taps.length - 1) / 2];
    const pPeak = p[taps.length - 1];
    return { h: taps.map((v) => v / hPeak), rc: p.map((v) => v / pPeak) };
  }, [beta, sps, span]);

  const hMid = (h.length - 1) / 2;
  const rcMid = h.length - 1;

  const draw = (ctx: CanvasRenderingContext2D, w: number, hh: number) => {
    const { r, sx, sy } = layout(w, hh, X);
    drawAxes(ctx, r, theme, linTicks(-X, X, 12), linTicks(-0.25, 1, 5), sx, sy, 'Time (symbol periods, T)', 'Amplitude (norm.)');
    ctx.save();
    clipTo(ctx, r);

    ctx.strokeStyle = theme.axis;
    ctx.beginPath();
    ctx.moveTo(r.x, Math.round(sy(0)) + 0.5);
    ctx.lineTo(r.x + r.w, Math.round(sy(0)) + 0.5);
    ctx.stroke();

    const curve = (y: Float64Array, mid: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < y.length; i++) {
        const x = sx((i - mid) / sps);
        if (i === 0) ctx.moveTo(x, sy(y[i]));
        else ctx.lineTo(x, sy(y[i]));
      }
      ctx.stroke();
    };
    curve(h, hMid, theme.series[1]);
    curve(rc, rcMid, theme.series[0]);

    // Overall pulse at the symbol instants: 1 at t = 0, ~0 elsewhere (Nyquist criterion)
    for (let m = -Math.floor(X); m <= Math.floor(X); m++) {
      const i = rcMid + m * sps;
      if (i < 0 || i >= rc.length) continue;
      ctx.beginPath();
      ctx.arc(sx(m), sy(rc[i]), 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = theme.text;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.surface;
      ctx.stroke();
    }
    ctx.fillStyle = theme.text2;
    ctx.font = FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('zero crossings at t = nT', sx(1) + 6, sy(1.05));
    ctx.restore();
  };

  let readout = `${res.nTaps} taps · group delay ${span / 2} T per filter · residual ISI ${res.isiDb.toFixed(1)} dB`;
  if (hover) {
    const { r, sx } = layout(hover.w, hover.h, X);
    if (hover.x >= r.x && hover.x <= r.x + r.w) {
      const t = linScale(sx(-X), sx(X), -X, X)(hover.x);
      const ih = Math.round(t * sps + hMid);
      const ir = Math.round(t * sps + rcMid);
      const hv = ih >= 0 && ih < h.length ? h[ih].toFixed(4) : '0';
      readout = `t = ${t.toFixed(3)} T   RRC ${hv}   RC ${rc[ir]?.toFixed(4) ?? '0'}`;
    }
  }

  return (
    <Scope
      title="Pulse shape"
      subtitle="p(t) = h(t) * h(−t), Nyquist criterion"
      readout={readout}
      legend={
        <>
          <span className="item"><span className="sw" style={{ background: theme.series[1] }} />RRC h(t), TX and RX</span>
          <span className="item"><span className="sw" style={{ background: theme.series[0] }} />Raised cosine p(t), end to end</span>
        </>
      }
    >
      <CanvasPlot draw={draw} deps={[h, rc, theme]} label="RRC and overall raised-cosine impulse responses" onHover={setHover} />
    </Scope>
  );
}
