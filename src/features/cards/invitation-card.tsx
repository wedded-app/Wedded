import type { Ref } from 'react';
import { Text, View, type TextProps, type TextStyle } from 'react-native';

import { fontStyle, serifFamily } from '@/constants/theme';

import { cardDate, type CardDesign, type CardText } from './card-designs';

/** A card is 5 by 7, like a printed invitation. */
export const CARD_RATIO = 7 / 5;

export type InvitationCardProps = {
  design: CardDesign;
  text: CardText;
  /** Shown faded in place of the names until they're typed. */
  namesSample: string;
  width: number;
  /** The view that's saved as a picture (react-native-view-shot). */
  ref?: Ref<View>;
};

/**
 * One invitation card, drawn the same on screen as in the saved picture:
 * sizes follow the card's width, not the phone's text size, so the saved
 * card never changes with Settings. Screen readers hear it as one image
 * with all its words.
 */
export function InvitationCard({ design, text, namesSample, width, ref }: InvitationCardProps) {
  const u = width / 100;
  const line = (size: number, extra?: TextStyle): TextStyle => ({
    color: design.ink,
    fontSize: size * u,
    lineHeight: size * u * 1.3,
    textAlign: 'center',
    ...extra,
  });
  const caps = { ...fontStyle(600), letterSpacing: 0.6 * u, textTransform: 'uppercase' } as const;
  const date = text.date ? cardDate(text.date) : '';
  const words = [
    text.opening,
    text.names,
    text.invite,
    text.event,
    date,
    text.time,
    text.venue,
    text.note,
  ];

  return (
    <View
      ref={ref}
      // Android leaves out views it can flatten, and a left-out view can't be saved.
      collapsable={false}
      accessible
      accessibilityRole="image"
      accessibilityLabel={words.filter(Boolean).join('. ')}
      style={{ width, height: width * CARD_RATIO, padding: 4.5 * u, backgroundColor: design.paper }}
    >
      <View style={{ flex: 1, padding: 1.8 * u, borderWidth: 1.5, borderColor: design.accent }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2 * u,
            paddingHorizontal: 7 * u,
            borderWidth: 0.75,
            borderColor: design.accent,
          }}
        >
          <Flourish color={design.accent} u={u} />
          {!!text.opening && <CardLine style={line(3.4, caps)}>{text.opening}</CardLine>}
          <CardLine
            numberOfLines={2}
            adjustsFontSizeToFit
            style={line(10.5, {
              fontFamily: serifFamily(600),
              opacity: text.names ? 1 : 0.4,
            })}
          >
            {text.names || namesSample}
          </CardLine>
          {!!text.invite && (
            <CardLine style={line(4, { fontFamily: serifFamily(500) })}>{text.invite}</CardLine>
          )}
          {!!text.event && (
            <CardLine
              numberOfLines={2}
              adjustsFontSizeToFit
              style={line(8, { fontFamily: serifFamily(600), color: design.accent })}
            >
              {text.event}
            </CardLine>
          )}
          <Flourish color={design.accent} u={u} />
          {!!date && <CardLine style={line(3.6, caps)}>{date}</CardLine>}
          {!!text.time && <CardLine style={line(4, fontStyle(500))}>{text.time}</CardLine>}
          {!!text.venue && (
            <CardLine numberOfLines={3} style={line(4.2, { fontFamily: serifFamily(500) })}>
              {text.venue}
            </CardLine>
          )}
          {!!text.note && (
            <CardLine numberOfLines={3} style={line(3.3, { ...fontStyle(400), marginTop: 2 * u })}>
              {text.note}
            </CardLine>
          )}
        </View>
      </View>
    </View>
  );
}

/** A line, a small diamond, a line. */
function Flourish({ color, u }: { color: string; u: number }) {
  const rule = { width: 12 * u, height: 1, backgroundColor: color };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 * u }}>
      <View style={rule} />
      <View
        style={{
          width: 1.8 * u,
          height: 1.8 * u,
          borderWidth: 1,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View style={rule} />
    </View>
  );
}

/** Card words keep their size whatever the phone's text size is. */
function CardLine(props: TextProps) {
  return <Text allowFontScaling={false} {...props} />;
}
