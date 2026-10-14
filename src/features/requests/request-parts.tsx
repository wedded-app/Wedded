import { Platform, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { useColors } from '@/constants/theme';

import { initials } from './requests-format';

/** The facts under a request's headline, already in words. */
export type PostFacts = {
  date?: string | null;
  guests?: string | null;
  budget?: string | null;
  distance?: string | null;
};

/** A family's letters on a soft maroon-to-rose circle: no photo, ever. */
export function FamilyAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const Colors = useColors();
  const image = `linear-gradient(135deg, ${Colors.heroFrom} 0%, ${Colors.heroTo} 100%)`;
  return (
    <View
      accessible={false}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Colors.heroFrom,
        },
        (Platform.OS === 'web'
          ? { backgroundImage: image }
          : { experimental_backgroundImage: image }) as unknown as ViewStyle,
      ]}
    >
      <AppText
        weight={700}
        color="onHero"
        style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }}
        maxFontSizeMultiplier={1.2}
      >
        {initials(name)}
      </AppText>
    </View>
  );
}
