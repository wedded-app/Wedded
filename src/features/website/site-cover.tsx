import { Image } from 'expo-image';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { coverUrl, type SiteEvent } from '@/data/website';
import { useLocale } from '@/i18n/locale-context';

import { siteDesign, sitePalette, type SiteDesign, type SitePalette } from './designs';
import { ArchLines, ArchPhoto, Bands, Garland, PaisleyCorner, Stars } from './motifs';
import { cityLine, dateRangeLine, daysUntil, firstDay, splitNames } from './site-helpers';

/** What a cover needs; a SitePage has it all. */
export type CoverData = {
  title: string;
  design: string;
  palette: string | null;
  coverPath: string | null;
  events: SiteEvent[];
  weddingDate: string | null;
};

type SiteCoverProps = {
  data: CoverData;
  /** The cover's width; everything scales with it, so a small preview looks the same. */
  width: number;
  /** A small preview: no text scaling, the smallest photo, and no countdown. */
  mini?: boolean;
  /** Room for the status bar on the full page. */
  topInset?: number;
  /** Show this design or colours instead of the site's, e.g. in the design picker. */
  designId?: string;
  paletteId?: string;
  /** Unique on the screen: the drawings' gradients and clips are named with it. */
  id: string;
  /** Fill a preview's box this tall in the design's paper, so it never stops short. */
  minHeight?: number;
};

/**
 * The top of a wedding website: the couple's names, the dates and town, the
 * cover photo and the design's one drawing, laid out the way each design
 * does it. The same component draws the full page and every small preview.
 */
export function SiteCover({
  data,
  width,
  mini = false,
  topInset = 0,
  designId,
  paletteId,
  id,
  minHeight,
}: SiteCoverProps) {
  const { t } = useLocale();
  const design = siteDesign(designId ?? data.design);
  const palette = sitePalette(design, paletteId ?? data.palette);
  const u = width / 390;
  const photo = data.coverPath
    ? coverUrl(data.coverPath, mini ? 'small' : width > 700 ? 'large' : 'medium')
    : null;
  const when = dateRangeLine(data.events, data.weddingDate);
  const city = cityLine(data.events);
  const first = firstDay(data.events, data.weddingDate);
  const days = first && !mini ? daysUntil(first) : null;
  const scaling = mini ? { allowFontScaling: false } : { maxFontSizeMultiplier: 1.3 };
  const pad = 28 * u;

  const caps = (size: number, color: string, spacing = 0.22): TextStyle => ({
    fontFamily: design.capsFont,
    fontSize: size * u,
    lineHeight: size * u * 1.5,
    letterSpacing: size * u * spacing,
    color,
    textAlign: 'center',
  });

  const onPhoto = design.cover === 'photo' && !!photo;
  const ink = onPhoto ? '#FFFFFF' : palette.ink;
  const soft = onPhoto ? 'rgba(255,255,255,0.86)' : palette.soft;
  const namesSize = 40 * design.namesScale * u;
  const script = design.namesFont.startsWith('Pinyon');

  const text = (
    <View style={[styles.text, { gap: 10 * u }]}>
      <Text {...scaling} style={caps(10.5, soft)}>
        {t('website.site.kicker').toUpperCase()}
      </Text>
      <Names
        title={data.title || t('website.site.ourWedding')}
        style={{
          fontFamily: design.namesFont,
          fontSize: namesSize,
          lineHeight: namesSize * (script ? 1.35 : 1.12),
          color: ink,
          textAlign: 'center',
        }}
        ampColor={onPhoto ? '#FFFFFF' : palette.accent}
        ampFont={script ? design.headingFont : undefined}
        ampSize={script ? namesSize * 0.62 : undefined}
        scaling={scaling}
      />
      {(when || city) && (
        <Text {...scaling} style={caps(11.5, ink, 0.16)}>
          {[when, city].filter(Boolean).join(' · ').toUpperCase()}
        </Text>
      )}
    </View>
  );

  const countdown =
    days !== null && days >= 0 ? (
      <Text {...scaling} style={[caps(11, soft, 0.12), styles.lower]}>
        {days === 0 ? t('website.site.today') : t('website.site.daysToGo', { count: days })}
      </Text>
    ) : null;

  const photoBox = (style: object) =>
    photo ? (
      <Image
        source={{ uri: photo }}
        style={style}
        contentFit="cover"
        transition={mini ? 0 : 250}
        accessible={false}
      />
    ) : null;

  const base = { width, minHeight, backgroundColor: palette.paper };

  switch (design.cover) {
    case 'photo':
      if (photo) {
        const height = Math.min(width * 1.28, 760);
        return (
          <View style={[base, { height }]}>
            <Image
              source={{ uri: photo }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible={false}
            />
            <Shade width={width} height={height} id={id} />
            <View style={[styles.photoText, { padding: pad, paddingBottom: 36 * u, gap: 10 * u }]}>
              {text}
              {countdown}
            </View>
          </View>
        );
      }
      return (
        <View
          style={[
            base,
            styles.center,
            {
              paddingTop: topInset + 72 * u,
              paddingBottom: 48 * u,
              paddingHorizontal: pad,
              gap: 18 * u,
            },
          ]}
        >
          {text}
          <View
            style={{ width: 44 * u, height: Math.max(1, u), backgroundColor: palette.accent }}
          />
          {countdown}
        </View>
      );

    case 'bands':
      return (
        <View
          style={[
            base,
            styles.center,
            { paddingTop: topInset + 22 * u, paddingBottom: 22 * u, gap: 22 * u },
          ]}
        >
          <Bands
            width={width}
            height={26 * u}
            accent={palette.accent}
            accent2={palette.accent2}
            paper={palette.paper}
          />
          <View style={{ paddingHorizontal: pad, gap: 22 * u, alignItems: 'center', width }}>
            {text}
            {photoBox({ width: width - pad * 2, aspectRatio: 4 / 3, borderRadius: 6 * u })}
            {countdown}
          </View>
          <Bands
            width={width}
            height={26 * u}
            accent={palette.accent}
            accent2={palette.accent2}
            paper={palette.paper}
          />
        </View>
      );

    case 'arch':
      return (
        <View
          style={[
            base,
            styles.center,
            {
              paddingTop: topInset + 40 * u,
              paddingBottom: 40 * u,
              paddingHorizontal: pad,
              gap: 24 * u,
            },
          ]}
        >
          <View>
            <ArchPhoto
              width={width * 0.7}
              photoUri={photo}
              accent={palette.accent}
              washFrom={palette.card}
              washTo={palette.line}
              id={`${id}-arch`}
            />
            {!photo && (
              <View style={[StyleSheet.absoluteFill, styles.monogram]}>
                <Text
                  {...scaling}
                  style={{
                    fontFamily: design.namesFont,
                    fontSize: 44 * u,
                    color: palette.accent,
                    letterSpacing: 4 * u,
                  }}
                >
                  {initials(data.title)}
                </Text>
              </View>
            )}
          </View>
          {text}
          {countdown}
        </View>
      );

    case 'garland':
      return (
        <View
          style={[
            base,
            styles.center,
            { paddingTop: topInset, paddingBottom: 36 * u, gap: 20 * u },
          ]}
        >
          <Garland width={width} accent={palette.accent} accent2={palette.accent2} />
          <View style={{ paddingHorizontal: pad, gap: 22 * u, alignItems: 'center', width }}>
            {text}
            {photoBox({ width: width - pad * 2, aspectRatio: 4 / 3, borderRadius: 20 * u })}
            {countdown}
          </View>
        </View>
      );

    case 'stars': {
      const height = Math.max(width * 1.12, 420 * u) + topInset;
      const inset = 26 * u;
      return (
        <View style={[base, { height }]}>
          <View style={StyleSheet.absoluteFill}>
            <Stars width={width} height={height} color={palette.accent} />
          </View>
          <View
            style={{
              position: 'absolute',
              left: inset,
              right: inset,
              top: topInset + 30 * u,
              bottom: 22 * u,
            }}
          >
            <ArchLines
              width={width - inset * 2}
              height={height - topInset - 52 * u}
              accent={palette.accent}
            />
          </View>
          <View
            style={[
              styles.center,
              styles.fill,
              { paddingTop: topInset + 120 * u, paddingHorizontal: pad * 1.8, gap: 18 * u },
            ]}
          >
            {photoBox({
              width: 92 * u,
              height: 92 * u,
              borderRadius: 46 * u,
              borderWidth: 1,
              borderColor: palette.accent,
            })}
            {text}
            {countdown}
          </View>
        </View>
      );
    }

    case 'corners':
      return (
        <View
          style={[
            base,
            styles.center,
            {
              paddingTop: topInset + 64 * u,
              paddingBottom: 56 * u,
              paddingHorizontal: pad,
              gap: 22 * u,
            },
          ]}
        >
          <View style={{ position: 'absolute', top: topInset + 10 * u, left: 10 * u }}>
            <PaisleyCorner size={84 * u} color={palette.accent} />
          </View>
          <View
            style={{
              position: 'absolute',
              bottom: 10 * u,
              right: 10 * u,
              transform: [{ rotate: '180deg' }],
            }}
          >
            <PaisleyCorner size={84 * u} color={palette.accent} />
          </View>
          {photoBox({ width: width * 0.48, aspectRatio: 4 / 5, borderRadius: 999 })}
          {text}
          {countdown}
        </View>
      );
  }
}

/** "J & A" for the arch before there's a photo; the first letter for one name. */
function initials(title: string): string {
  const names = splitNames(title);
  if (names) return `${names[0][0]} & ${names[1][0]}`.toUpperCase();
  return (title.trim()[0] ?? '').toUpperCase();
}

/** The couple's names with the "&" in the accent colour. */
function Names({
  title,
  style,
  ampColor,
  ampFont,
  ampSize,
  scaling,
}: {
  title: string;
  style: TextStyle;
  ampColor: string;
  /** Another font for the "&" when the names' own is a script. */
  ampFont?: string;
  ampSize?: number;
  scaling: object;
}) {
  const names = splitNames(title);
  return (
    <Text {...scaling} accessibilityRole="header" style={style}>
      {names ? (
        <>
          {names[0]}{' '}
          <Text
            style={{
              color: ampColor,
              ...(ampFont ? { fontFamily: ampFont, fontSize: ampSize } : null),
            }}
          >
            &amp;
          </Text>{' '}
          {names[1]}
        </>
      ) : (
        title
      )}
    </Text>
  );
}

/** A dark wash up from the bottom of a photo, so white names read on any picture. */
function Shade({ width, height, id }: { width: number; height: number; id: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={`shade-${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.35" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.62} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#shade-${id})`} />
      </Svg>
    </View>
  );
}

/** A design's look in a few words, for pickers: its colours, first to last. */
export function paletteSwatches(design: SiteDesign, palette: SitePalette): string[] {
  return design.cover === 'stars'
    ? [palette.paper, palette.accent, palette.ink]
    : [palette.paper, palette.accent2, palette.accent];
}

const styles = StyleSheet.create({
  text: {
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
  },
  fill: {
    flex: 1,
  },
  lower: {
    marginTop: 2,
  },
  monogram: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '18%',
  },
  photoText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
});
