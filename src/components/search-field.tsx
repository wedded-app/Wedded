import { type Ref } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useFontScale, useTypeStyle } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

export type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** What to search for; the Search tab's wording when left out. Also read aloud. */
  placeholder?: string;
  ref?: Ref<TextInput>;
};

/** The Search tab's text box: the iOS search field, with a clear button once there's text. */
export function SearchField({ value, onChangeText, placeholder, ref }: SearchFieldProps) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const scale = useFontScale('body');
  const { lineHeight, maxFontSizeMultiplier, ...font } = useTypeStyle({});

  return (
    <View style={styles.field}>
      <Icon name="search" size={Sizes.iconSmall * scale} color={Colors.text2} weight="medium" />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t('search.placeholder')}
        placeholderTextColor={Colors.text2}
        accessibilityLabel={placeholder ?? t('search.label')}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        selectionColor={Colors.primary}
        cursorColor={Colors.primary}
        style={[styles.input, font]}
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('search.clear')}
          onPress={() => onChangeText('')}
          style={styles.clear}
        >
          <Icon name="close-circle" size={Sizes.iconSmall * scale} color={Colors.chevron} />
        </Pressable>
      )}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  field: {
    minHeight: Sizes.search,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.md + 2,
    borderRadius: Radius.button,
    backgroundColor: Colors.fill,
  },
  input: {
    flex: 1,
    minHeight: Sizes.search,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    // The browser's own focus ring would draw a box inside the capsule.
    outlineWidth: 0,
  },
  clear: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
