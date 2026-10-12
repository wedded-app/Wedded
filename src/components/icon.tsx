import Ionicons from '@expo/vector-icons/Ionicons';
import { SymbolView, type SymbolWeight } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Platform, type StyleProp, type TextStyle } from 'react-native';

export type IconName = ComponentProps<typeof Ionicons>['name'];
// Every valid SF Symbol name, so a typo fails the typecheck instead of
// drawing nothing on iPhone.
type SFSymbol = Extract<ComponentProps<typeof SymbolView>['name'], string>;

// Screens name icons by their Ionicons name, which Android and the web draw.
// iPhones draw the matching SF Symbol instead, so icons sit on the same
// weight and baseline as the San Francisco text next to them. Anything not
// listed here stays an Ionicon on iPhone too.
const SF_SYMBOLS: Partial<Record<IconName, SFSymbol>> = {
  home: 'house.fill',
  'home-outline': 'house',
  search: 'magnifyingglass',
  'search-outline': 'magnifyingglass',
  heart: 'heart.fill',
  'heart-outline': 'heart',
  'heart-dislike-outline': 'heart.slash',
  'person-circle': 'person.crop.circle.fill',
  'person-circle-outline': 'person.crop.circle',
  person: 'person.fill',
  'chevron-forward': 'chevron.right',
  'chevron-back': 'chevron.left',
  'chevron-down': 'chevron.down',
  close: 'xmark',
  'arrow-undo': 'arrowshape.turn.up.left',
  'close-circle': 'xmark.circle.fill',
  'help-circle': 'questionmark.circle.fill',
  'help-circle-outline': 'questionmark.circle',
  'close-circle-outline': 'xmark.circle',
  checkmark: 'checkmark',
  'checkmark-sharp': 'checkmark',
  'checkmark-circle': 'checkmark.circle.fill',
  'ellipse-outline': 'circle',
  'bulb-outline': 'lightbulb',
  'checkmark-circle-outline': 'checkmark.circle',
  location: 'location.fill',
  'location-outline': 'mappin.and.ellipse',
  'navigate-outline': 'arrow.triangle.turn.up.right.diamond.fill',
  'business-outline': 'building.2',
  'restaurant-outline': 'fork.knife',
  'musical-notes-outline': 'music.note.list',
  'flower-outline': 'camera.macro',
  'camera-outline': 'camera',
  'arrow-up': 'arrow.up',
  'color-palette-outline': 'paintpalette',
  'brush-outline': 'paintbrush',
  'shirt-outline': 'tshirt',
  'car-outline': 'car',
  'mail-outline': 'envelope',
  mail: 'envelope.fill',
  'people-outline': 'person.2',
  'git-compare-outline': 'arrow.left.arrow.right',
  'person-add-outline': 'person.badge.plus',
  'options-outline': 'slider.horizontal.3',
  'storefront-outline': 'storefront',
  call: 'phone.fill',
  'call-outline': 'phone',
  'chatbubble-outline': 'message',
  'chatbubble-ellipses-outline': 'bubble.left',
  'chatbubbles-outline': 'bubble.left.and.bubble.right',
  'calendar-outline': 'calendar',
  'time-outline': 'clock',
  'language-outline': 'character.bubble',
  'ribbon-outline': 'rosette',
  'image-outline': 'photo',
  'grid-outline': 'square.grid.2x2',
  refresh: 'arrow.clockwise',
  'refresh-outline': 'arrow.clockwise',
  'cloud-offline-outline': 'icloud.slash',
  'alert-circle': 'exclamationmark.circle.fill',
  'trash-outline': 'trash',
  'send-outline': 'paperplane',
  'print-outline': 'printer',
  'phone-portrait-outline': 'iphone',
  'add-circle-outline': 'plus.circle',
  'add-circle': 'plus.circle.fill',
  'arrow-up-circle': 'arrow.up.circle.fill',
  'globe-outline': 'globe',
  'share-outline': 'square.and.arrow.up',
  'compass-outline': 'safari',
  compass: 'safari.fill',
  'settings-outline': 'gearshape',
  settings: 'gearshape.fill',
  moon: 'moon.fill',
  sunny: 'sun.max.fill',
  'contrast-outline': 'circle.lefthalf.filled',
  'text-outline': 'textformat.size',
  'hand-left-outline': 'hand.tap',
  'notifications-outline': 'bell',
  'information-circle-outline': 'info.circle',
  'checkbox-outline': 'checklist',
  sparkles: 'sparkles',
  'sparkles-outline': 'sparkles',
  play: 'play.fill',
  'play-circle': 'play.circle.fill',
  'play-circle-outline': 'play.circle',
  'volume-mute': 'speaker.slash.fill',
  'volume-high': 'speaker.wave.2.fill',
  'film-outline': 'film',
  pause: 'pause.fill',
  'ellipsis-horizontal': 'ellipsis',
  'paper-plane-outline': 'paperplane',
  'chatbubble-ellipses': 'bubble.right',
  'shield-checkmark': 'checkmark.seal.fill',
  time: 'clock.fill',
  'list-outline': 'list.bullet',
  people: 'person.2.fill',
  star: 'star.fill',
  'chevron-up': 'chevron.up',
  add: 'plus',
  'images-outline': 'photo.on.rectangle',
  'videocam-outline': 'video',
  flame: 'flame',
  wifi: 'wifi',
  cellular: 'cellularbars',
  'battery-full': 'battery.100',
  'gift-outline': 'gift',
  'diamond-outline': 'diamond',
  'sunny-outline': 'sun.max',
  'flame-outline': 'flame',
  'people-circle-outline': 'person.2.circle',
  'infinite-outline': 'infinity',
  'star-outline': 'star',
  'arrow-forward': 'arrow.right',
  'pencil-outline': 'pencil',
  'person-outline': 'person',
  'logo-apple': 'apple.logo',
  'link-outline': 'link',
};

export type IconProps = {
  name: IconName;
  size: number;
  color: string;
  /** SF Symbol weight on iPhone; match the text beside the icon. */
  weight?: SymbolWeight;
  style?: StyleProp<TextStyle>;
};

/** An icon that is an SF Symbol on iPhone and an Ionicon everywhere else. */
export function Icon({ name, size, color, weight = 'regular', style }: IconProps) {
  const symbol = Platform.OS === 'ios' ? SF_SYMBOLS[name] : undefined;
  // Icons sit next to words that say the same thing, so screen readers skip
  // them (VoiceOver would otherwise read the symbol's name, "photo.on.rectangle")
  const ionicon = (
    <Ionicons
      name={name}
      size={size}
      color={color}
      style={style}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
  if (!symbol) return ionicon;

  return (
    <SymbolView
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      name={symbol}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      fallback={ionicon}
      style={[{ width: size, height: size }, style as object]}
    />
  );
}
