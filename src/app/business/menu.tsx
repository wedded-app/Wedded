import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { NavScreen } from '@/components/nav';
import { Segmented } from '@/components/segmented';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { type DietTag, useVendorMenus } from '@/data/vendor-menus';
import {
  emptyMenuDraft,
  type MenuDraft,
  menuProblem,
  menuToDraft,
  useDeleteMenu,
  useSaveMenu,
} from '@/data/vendor-self';
import { useCurrentBusiness } from '@/features/business/use-current-business';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

const DIET_TAGS: DietTag[] = [
  'veg',
  'non_veg',
  'jhatka',
  'halal',
  'jain',
  'eggless',
  'vegan',
  'gluten_free',
];
const UNITS = ['plate', 'person', 'event'] as const;

/** Digits only, as a whole number, or null when empty. */
const wholeNumber = (text: string) => {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : null;
};

/**
 * My business → a menu, new or changing one (`?menuId=`): its name in
 * English and Punjabi, a description, cuisine, price per plate, guest or
 * event, the minimum guests, diet tags, and the dishes in sections. Save
 * checks it first and says plainly what to fix; Delete asks before it goes.
 */
export default function BusinessMenuScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const { menuId } = useLocalSearchParams<{ menuId?: string }>();
  const business = useCurrentBusiness();
  const menus = useVendorMenus(business.vendorId);
  const save = useSaveMenu(business.vendorId);
  const remove = useDeleteMenu(business.vendorId);
  const [draft, setDraft] = useState<MenuDraft | null>(menuId ? null : emptyMenuDraft());
  const [error, setError] = useState<string | null>(null);

  // Changing a menu: start from it once it has loaded
  const existing = menuId ? menus.data?.find((m) => m.id === menuId) : undefined;
  if (!draft && existing) setDraft(menuToDraft(existing));

  const title = menuId ? t('business.menus.editTitle') : t('business.menus.newTitle');

  if (!draft) {
    const missing = menus.isSuccess && !existing;
    return (
      <NavScreen title={title}>
        {menus.isError ? (
          <StateView state="error" onRetry={() => void menus.refetch()} />
        ) : missing ? (
          <StateView state="empty" icon="restaurant-outline" message={t('menus.notFound')} />
        ) : (
          <StateView state="loading" />
        )}
      </NavScreen>
    );
  }

  const change = (next: Partial<MenuDraft>) => setDraft({ ...draft, ...next });

  const onSave = async () => {
    const problem = menuProblem(draft);
    if (problem) {
      setError(t(`business.menus.problems.${problem}`));
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(draft);
      successHaptic();
      router.back();
    } catch {
      setError(t('business.menus.saveFailed'));
    }
  };

  const onDelete = () => {
    if (!draft.id) return;
    const id = draft.id;
    const go = async () => {
      try {
        await remove.mutateAsync(id);
        router.back();
      } catch {
        setError(t('business.menus.deleteFailed'));
      }
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm(t('business.menus.deleteConfirm'))) void go();
      return;
    }
    Alert.alert(t('business.menus.deleteTitle'), t('business.menus.deleteConfirm'), [
      { text: t('business.cancel'), style: 'cancel' },
      { text: t('business.menus.delete'), style: 'destructive', onPress: () => void go() },
    ]);
  };

  return (
    <NavScreen title={title}>
      <TextField
        label={t('business.menus.name')}
        hint={t('business.menus.nameHint')}
        value={draft.name}
        onChangeText={(name) => change({ name })}
      />
      <TextField
        label={t('business.menus.namePa')}
        value={draft.namePa}
        onChangeText={(namePa) => change({ namePa })}
      />
      <TextField
        label={t('business.menus.description')}
        value={draft.description}
        onChangeText={(description) => change({ description })}
        multiline
      />
      <TextField
        label={t('business.menus.cuisine')}
        hint={t('business.menus.cuisineHint')}
        value={draft.cuisine}
        onChangeText={(cuisine) => change({ cuisine })}
      />

      <TextField
        label={t('business.menus.price')}
        hint={t('business.menus.priceHint')}
        value={draft.price === null ? '' : String(draft.price)}
        onChangeText={(text) => change({ price: wholeNumber(text) })}
        keyboardType="number-pad"
      />
      <Segmented
        accessibilityLabel={t('business.menus.priceFor')}
        value={draft.unit}
        onChange={(unit) => change({ unit })}
        options={UNITS.map((unit) => ({
          value: unit,
          label: t('business.menus.per', { unit: t(`vendorCard.units.${unit}`) }),
        }))}
      />
      <TextField
        label={t('business.menus.minGuests')}
        value={draft.minGuests === null ? '' : String(draft.minGuests)}
        onChangeText={(text) => change({ minGuests: wholeNumber(text) })}
        keyboardType="number-pad"
      />

      <Field label={t('business.menus.diet')}>
        <View style={styles.chips}>
          {DIET_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={t(`menus.diet.${tag}`)}
              selected={draft.dietTags.includes(tag)}
              onPress={() =>
                change({
                  dietTags: draft.dietTags.includes(tag)
                    ? draft.dietTags.filter((t2) => t2 !== tag)
                    : [...draft.dietTags, tag],
                })
              }
            />
          ))}
        </View>
      </Field>

      <Sections draft={draft} onChange={(sections) => change({ sections })} />

      {error && <FieldError message={error} />}
      <Button label={t('business.menus.save')} loading={save.isPending} onPress={onSave} />
      {draft.id && (
        <Button
          variant="danger"
          icon="trash-outline"
          label={t('business.menus.delete')}
          loading={remove.isPending}
          onPress={onDelete}
        />
      )}
    </NavScreen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <AppText variant="label" weight={600} style={styles.fieldLabel}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

/** The dishes, in sections (Starters, Mains…): add, rename and remove. */
function Sections({
  draft,
  onChange,
}: {
  draft: MenuDraft;
  onChange: (sections: MenuDraft['sections']) => void;
}) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const sections = draft.sections;
  const setSection = (index: number, next: MenuDraft['sections'][number] | null) =>
    onChange(
      next === null
        ? sections.filter((_, i) => i !== index)
        : sections.map((s, i) => (i === index ? next : s)),
    );

  return (
    <Field label={t('business.menus.dishes')}>
      <AppText color="text2">{t('business.menus.dishesHint')}</AppText>
      {sections.map((section, index) => (
        <View key={index} style={styles.section}>
          <TextField
            label={t('business.menus.sectionName')}
            value={section.title}
            onChangeText={(title) => setSection(index, { ...section, title })}
          />
          {section.items.map((item, itemIndex) => (
            <View key={itemIndex} style={styles.dish}>
              <TextField
                label={t('business.menus.dish', { number: itemIndex + 1 })}
                value={item.name}
                onChangeText={(name) =>
                  setSection(index, {
                    ...section,
                    items: section.items.map((it, i) => (i === itemIndex ? { ...it, name } : it)),
                  })
                }
                style={styles.grow}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('business.menus.removeDish', {
                  name: item.name || t('business.menus.dish', { number: itemIndex + 1 }),
                })}
                onPress={() =>
                  setSection(index, {
                    ...section,
                    items: section.items.filter((_, i) => i !== itemIndex),
                  })
                }
                style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
              >
                <Icon name="close-circle-outline" size={Sizes.icon} color={Colors.text2} />
              </Pressable>
            </View>
          ))}
          <Button
            variant="text"
            icon="add"
            label={t('business.menus.addDish')}
            onPress={() =>
              setSection(index, {
                ...section,
                items: [...section.items, { name: '', description: '', dietTags: [] }],
              })
            }
          />
          <Button
            variant="text"
            icon="trash-outline"
            label={t('business.menus.removeSection')}
            onPress={() => setSection(index, null)}
          />
        </View>
      ))}
      <Button
        variant="secondary"
        icon="add"
        label={t('business.menus.addSection')}
        onPress={() =>
          onChange([
            ...sections,
            { title: '', items: [{ name: '', description: '', dietTags: [] }] },
          ])
        }
      />
    </Field>
  );
}

const useStyles = makeStyles((Colors) => ({
  field: {
    gap: Spacing.sm,
  },
  fieldLabel: {
    color: Colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  section: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
  },
  dish: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  grow: {
    flex: 1,
  },
  remove: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
}));
