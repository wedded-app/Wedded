import { useMemo } from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Image as SvgImage,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from 'react-native-svg';

/**
 * The one drawing each website design has, as plain shapes (no artwork
 * files): embroidered diamond bands for Heirloom, marigold strings for
 * Marigold, a fine arch for Palace and Noor, gold stars for Noor and henna
 * line-work for Mehndi. Decorative: no words, so screen readers pass over them.
 */

/** A band of phulkari-style diamonds between two thin lines. */
export function Bands({
  width,
  height,
  accent,
  accent2,
  paper,
}: {
  width: number;
  height: number;
  accent: string;
  accent2: string;
  paper: string;
}) {
  const tile = Math.max(8, height - 4);
  const half = tile / 2;
  const cy = 2 + half;
  const diamond = (cx: number, r: number) =>
    `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
  const centres = Array.from({ length: Math.ceil(width / tile) + 1 }, (_, i) => i * tile + half);
  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={1} fill={accent2} />
      {centres.map((cx) => (
        <Polygon key={`o${cx}`} points={diamond(cx, half)} fill={accent} />
      ))}
      {centres.map((cx) => (
        <Polygon key={`i${cx}`} points={diamond(cx, half * 0.55)} fill={accent2} />
      ))}
      {centres.map((cx) => (
        <Polygon key={`d${cx}`} points={diamond(cx, half * 0.18)} fill={paper} />
      ))}
      <Rect x={0} y={height - 1} width={width} height={1} fill={accent2} />
    </Svg>
  );
}

/** Strings of marigolds swagging across the top, with strands at the joins. */
export function Garland({
  width,
  accent,
  accent2,
}: {
  width: number;
  accent: string;
  accent2: string;
}) {
  const height = (width * 70) / 240;
  const dots = useMemo(() => {
    const out: { x: number; y: number; r: number; second: boolean }[] = [];
    let n = 0;
    for (let k = 0; k < 3; k++) {
      const x0 = k * 80;
      const x2 = x0 + 80;
      const cx = x0 + 40;
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x2;
        const y = (1 - t) * (1 - t) * 8 + 2 * (1 - t) * t * 52 + t * t * 8;
        out.push({ x, y, r: 4.3, second: n++ % 2 === 1 });
      }
    }
    for (const sx of [0, 80, 160, 240]) {
      for (let i = 1; i <= 4; i++) out.push({ x: sx, y: 8 + i * 8, r: 3.4, second: i % 2 === 0 });
    }
    return out;
  }, []);
  return (
    <Svg width={width} height={height} viewBox="0 0 240 70">
      {[0, 80, 160].map((x0) => (
        <Path
          key={x0}
          d={`M${x0} 8 Q${x0 + 40} 52 ${x0 + 80} 8`}
          stroke={accent2}
          strokeWidth={0.6}
          strokeOpacity={0.6}
          fill="none"
        />
      ))}
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.second ? accent2 : accent} />
      ))}
    </Svg>
  );
}

/**
 * A pointed (Mughal) arch from x0 to x1 whose top is at y0, down to
 * `bottom`. The shape is the same at any width; only its legs grow.
 */
export function archPath(x0: number, x1: number, y0: number, bottom: number): string {
  const s = (x1 - x0) / 180;
  const X = (x: number) => (x0 + (x - 10) * s).toFixed(2);
  const Y = (y: number) => (y0 + (y - 2) * s).toFixed(2);
  return [
    `M${X(10)} ${bottom.toFixed(2)}`,
    `V${Y(100)}`,
    `C${X(10)} ${Y(62)} ${X(38)} ${Y(40)} ${X(68)} ${Y(26)}`,
    `C${X(84)} ${Y(18)} ${X(95)} ${Y(10)} ${X(100)} ${Y(2)}`,
    `C${X(105)} ${Y(10)} ${X(116)} ${Y(18)} ${X(132)} ${Y(26)}`,
    `C${X(162)} ${Y(40)} ${X(190)} ${Y(62)} ${X(190)} ${Y(100)}`,
    `V${bottom.toFixed(2)}`,
  ].join(' ');
}

/** The cover photo inside a fine arch, or a soft wash of the palette before there's one. */
export function ArchPhoto({
  width,
  photoUri,
  accent,
  washFrom,
  washTo,
  id,
}: {
  width: number;
  photoUri: string | null;
  accent: string;
  washFrom: string;
  washTo: string;
  /** Unique per drawing on the page (clip and gradient ids are global on the web). */
  id: string;
}) {
  const height = width * 1.22;
  const inner = archPath(width * 0.06, width * 0.94, width * 0.07, height);
  const outer = archPath(0, width, 0, height);
  return (
    <Svg width={width} height={height}>
      <Defs>
        <ClipPath id={`clip-${id}`}>
          <Path d={`${inner} Z`} />
        </ClipPath>
        <LinearGradient id={`wash-${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={washFrom} />
          <Stop offset="1" stopColor={washTo} />
        </LinearGradient>
      </Defs>
      {photoUri ? (
        <SvgImage
          href={{ uri: photoUri }}
          x={0}
          y={0}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#clip-${id})`}
        />
      ) : (
        <Path d={`${inner} Z`} fill={`url(#wash-${id})`} />
      )}
      <Path d={outer} stroke={accent} strokeWidth={1.2} fill="none" />
    </Svg>
  );
}

/** Two fine arches around the names (Noor). Fills its box. */
export function ArchLines({
  width,
  height,
  accent,
}: {
  width: number;
  height: number;
  accent: string;
}) {
  return (
    <Svg width={width} height={height}>
      <Path d={archPath(1, width - 1, 1, height)} stroke={accent} strokeWidth={1.1} fill="none" />
      <Path
        d={archPath(9, width - 9, 9, height)}
        stroke={accent}
        strokeWidth={0.6}
        strokeOpacity={0.6}
        fill="none"
      />
    </Svg>
  );
}

// The stars' places, made once from a fixed seed so they never move
const STARS = (() => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: 46 }, () => ({
    x: rnd(),
    y: rnd(),
    r: 0.4 + rnd() * 1.1,
    o: 0.25 + rnd() * 0.7,
  }));
})();

/** Gold dots scattered like stars, always in the same places. */
export function Stars({ width, height, color }: { width: number; height: number; color: string }) {
  const unit = Math.max(width, height) / 300;
  return (
    <Svg width={width} height={height}>
      {STARS.map((s, i) => (
        <Circle
          key={i}
          cx={s.x * width}
          cy={s.y * height}
          r={s.r * unit}
          fill={color}
          fillOpacity={s.o}
        />
      ))}
    </Svg>
  );
}

/** Henna line-work for a corner: a paisley, its inner curls, a vine and dots. */
export function PaisleyCorner({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Path
        d="M16 66 C4 52 6 30 22 19 C38 8 61 12 66 29 C70 43 59 52 48 48 C39 45 39 34 47 32"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M22 60 C14 50 15 34 27 26 C38 19 54 22 57 33"
        stroke={color}
        strokeWidth={0.8}
        strokeOpacity={0.7}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M28 54 C24 46 26 38 33 33"
        stroke={color}
        strokeWidth={0.7}
        strokeOpacity={0.55}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M0 79 C14 71 30 73 44 79"
        stroke={color}
        strokeWidth={0.8}
        strokeOpacity={0.7}
        fill="none"
      />
      <Circle cx={9} cy={73} r={1.6} fill={color} />
      <Circle cx={4} cy={66} r={1.1} fill={color} />
      <Circle cx={16} cy={76} r={1.1} fill={color} />
      <Circle cx={52} cy={40} r={1.2} fill={color} />
      <Circle cx={60} cy={20} r={1} fill={color} fillOpacity={0.7} />
    </Svg>
  );
}

/** A soft wash of two colours, as a cover before there's a photo. */
export function Wash({
  width,
  height,
  from,
  to,
  id,
}: {
  width: number;
  height: number;
  from: string;
  to: string;
  id: string;
}) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={`w-${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#w-${id})`} />
    </Svg>
  );
}
