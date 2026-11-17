import { ReactNode, useEffect, useRef, useState } from 'react';

/* ---------- Theme ---------- */

export interface Theme {
  surface: string;
  grid: string;
  axis: string;
  muted: string;
  text: string;
  text2: string;
  series: string[];
}

export function readTheme(): Theme {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    surface: v('--surface-1'),
    grid: v('--grid'),
    axis: v('--axis'),
    muted: v('--text-muted'),
    text: v('--text-primary'),
    text2: v('--text-secondary'),
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--series-${i}`)),
  };
}

export const FONT = '11px system-ui, -apple-system, "Segoe UI", sans-serif';

/* ---------- Geometry ---------- */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Scale = (v: number) => number;

export function linScale(d0: number, d1: number, r0: number, r1: number): Scale {
  const k = (r1 - r0) / (d1 - d0);
  return (v) => r0 + (v - d0) * k;
}

export interface Tick {
  v: number;
  label: string;
}

export function linTicks(min: number, max: number, target = 5): Tick[] {
  const span = max - min;
  if (!(span > 0)) return [];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const err = raw / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const out: Tick[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) {
    const vv = Math.abs(v) < step * 1e-9 ? 0 : v;
    out.push({ v: vv, label: vv.toFixed(decimals).replace('-', '−') });
  }
  return out;
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export const pow10Label = (e: number) => (e === 0 ? '1' : '10' + String(e).split('').map((c) => SUP[c] ?? c).join(''));

/* ---------- Drawing ---------- */

export function drawAxes(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  th: Theme,
  xt: Tick[],
  yt: Tick[],
  sx: Scale,
  sy: Scale,
  xTitle: string,
  yTitle: string,
): void {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = th.grid;
  ctx.beginPath();
  for (const t of yt) {
    const y = Math.round(sy(t.v)) + 0.5;
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
  }
  for (const t of xt) {
    const x = Math.round(sx(t.v)) + 0.5;
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.h);
  }
  ctx.stroke();

  ctx.strokeStyle = th.axis;
  ctx.beginPath();
  ctx.moveTo(r.x + 0.5, r.y);
  ctx.lineTo(r.x + 0.5, r.y + r.h + 0.5);
  ctx.lineTo(r.x + r.w, r.y + r.h + 0.5);
  ctx.stroke();

  ctx.fillStyle = th.muted;
  ctx.font = FONT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of yt) ctx.fillText(t.label, r.x - 6, sy(t.v));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of xt) ctx.fillText(t.label, sx(t.v), r.y + r.h + 6);

  ctx.fillStyle = th.text2;
  ctx.fillText(xTitle, r.x + r.w / 2, r.y + r.h + 21);
  ctx.save();
  ctx.translate(12, r.y + r.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'middle';
  ctx.fillText(yTitle, 0, 0);
  ctx.restore();
  ctx.restore();
}

export function clipTo(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
}

/* ---------- Components ---------- */

export interface Hover {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CanvasPlotProps {
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  deps: unknown[];
  label: string;
  onHover?: (h: Hover | null) => void;
  children?: ReactNode;
}

/** HiDPI-aware canvas that fills its container and redraws on resize or when `deps` change. */
export function CanvasPlot({ draw, deps, label, onHover, children }: CanvasPlotProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || size.w === 0 || size.h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(size.w * dpr);
    const H = Math.round(size.h * dpr);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
      c.style.width = `${size.w}px`;
      c.style.height = `${size.h}px`;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    draw(ctx, size.w, size.h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, ...deps]);

  return (
    <div className="plot" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onHover?.({ x: e.clientX - r.left, y: e.clientY - r.top, w: size.w, h: size.h });
        }}
        onPointerLeave={() => onHover?.(null)}
      />
      {children}
    </div>
  );
}

interface ScopeProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  legend?: ReactNode;
  readout?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function Scope({ title, subtitle, actions, legend, readout, children, footer }: ScopeProps) {
  return (
    <section className="scope">
      <header>
        <h3>{title}</h3>
        {subtitle && <span className="sub">{subtitle}</span>}
        {actions && <div className="end">{actions}</div>}
      </header>
      {legend && <div className="legend">{legend}</div>}
      {children}
      <div className="readout">{readout ?? ' '}</div>
      {footer}
    </section>
  );
}

/* ---------- Formatting ---------- */

export function fmtSci(x: number, digits = 2): string {
  if (x === 0) return '0';
  if (!Number.isFinite(x)) return '—';
  const [m, e] = x.toExponential(digits).split('e');
  return `${m}e${e.replace('+', '')}`;
}

export function fmtCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
  return String(n);
}
