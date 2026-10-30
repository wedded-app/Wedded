import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { usePlan } from '@/features/planner/plan';
import {
  shareInvite,
  useCreateInvite,
  useRemoveMember,
  useSetMemberRole,
  useStartWedding,
  useWeddingMembers,
  type AccountWedding,
  type InviteRole,
  type WeddingMember,
} from '@/data/wedding';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';
import { confirm } from '@/lib/confirm';

import { initials } from './wedding-tab';

// Kept here too for the screens that already take it from this file
export { initials };

/**
 * "Plan together" on My Wedding (docs/RESEARCH_GROWTH.md #1): save the plan
 * to the account and invite family by a link (WhatsApp), or, once shared,
 * see who's planning and invite more. Like sharing in Google Drive: the owner,
 * editors who change the plan, and suggesters who suggest vendors for the
 * owner or an editor to accept. The owner taps someone to change their access.
 */
export function PlanTogether({ wedding }: { wedding: AccountWedding | null }) {
  if (!wedding) return <StartTogether />;
  return <Together wedding={wedding} />;
}

function StartTogether() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { status, requireSignIn } = useSession();
  const phonePlan = usePlan();
  const start = useStartWedding();
  const createInvite = useCreateInvite();
  const [error, setError] = useState<string>();

  const begin = () => {
    setError(undefined);
    start.mutate(phonePlan, {
      onSuccess: (weddingId) => {
        successHaptic();
        // Straight to the share sheet, since inviting family is why they tapped
        createInvite.mutate(
          { weddingId, role: 'editor' },
          { onSuccess: (link) => void shareInvite(link, t) },
        );
      },
      onError: () => setError(t('planTogether.failed')),
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Icon name="people-outline" size={28} color={Colors.primary} />
        <AppText variant="heading" weight={700} style={styles.grow}>
          {t('planTogether.title')}
        </AppText>
      </View>
      <AppText color="text2">{t('planTogether.body')}</AppText>
      <Button
        icon="share-outline"
        label={status === 'signedIn' ? t('planTogether.start') : t('planTogether.signInToStart')}
        loading={start.isPending || createInvite.isPending}
        onPress={() => requireSignIn(begin)}
      />
      {error && <FieldError message={error} />}
    </View>
  );
}

function Together({ wedding }: { wedding: AccountWedding }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const members = useWeddingMembers(wedding.id);
  const createInvite = useCreateInvite();
  const remove = useRemoveMember();
  const setRole = useSetMemberRole();
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();
  const [openMember, setOpenMember] = useState<string | null>(null);
  const canInvite = wedding.role !== 'suggester';
  const me = members.data?.find((m) => m.isMe);
  const isOwner = me?.role === 'owner';

  const invite = (role: InviteRole) => {
    setError(undefined);
    setNote(undefined);
    createInvite.mutate(
      { weddingId: wedding.id, role },
      {
        onSuccess: async (link) => {
          const result = await shareInvite(link, t);
          if (result === 'copied') setNote(t('planTogether.copied'));
        },
        onError: () => setError(t('planTogether.inviteFailed')),
      },
    );
  };

  const removeMember = (member: WeddingMember) => {
    const leaving = member.isMe;
    confirm(
      leaving
        ? t('planTogether.leaveTitle')
        : t('planTogether.removeTitle', { name: member.name ?? '' }),
      leaving ? t('planTogether.leaveBody') : t('planTogether.removeBody'),
      leaving ? t('planTogether.leave') : t('planTogether.remove'),
      '✕',
      () =>
        remove.mutate(
          { weddingId: wedding.id, userId: member.userId },
          { onError: () => setError(t('planTogether.failed')) },
        ),
    );
  };

  const changeRole = (member: WeddingMember, role: WeddingMember['role']) => {
    setError(undefined);
    const apply = () =>
      setRole.mutate(
        { weddingId: wedding.id, userId: member.userId, role },
        {
          onSuccess: () => {
            selectionHaptic();
            if (role === 'owner') setOpenMember(null);
          },
          onError: () => setError(t('planTogether.failed')),
        },
      );
    if (role === 'owner') {
      const name = member.name ?? t('planTogether.someone');
      confirm(
        t('planTogether.access.ownerTitle', { name }),
        t('planTogether.access.ownerBody'),
        t('planTogether.access.owner'),
        '✕',
        apply,
      );
    } else apply();
  };

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Icon name="people" size={28} color={Colors.primary} />
        <AppText variant="heading" weight={700} style={styles.grow}>
          {t('planTogether.familyTitle')}
        </AppText>
      </View>
      {wedding.role === 'suggester' && (
        <AppText color="text2">{t('planTogether.suggesterNote')}</AppText>
      )}

      <View style={styles.members}>
        {members.data?.map((member) => {
          // The owner manages everyone else's access, like Google Drive's share list
          const manageable = isOwner && !member.isMe;
          const open = manageable && openMember === member.userId;
          const name = member.isMe
            ? t('planTogether.you')
            : (member.name ?? t('planTogether.someone'));
          return (
            <View key={member.userId}>
              <Pressable
                accessibilityRole={manageable ? 'button' : undefined}
                accessibilityState={manageable ? { expanded: open } : undefined}
                accessibilityHint={
                  manageable ? t('planTogether.access.title', { name }) : undefined
                }
                disabled={!manageable}
                onPress={() => setOpenMember(open ? null : member.userId)}
                style={({ pressed }) => [styles.member, pressed && styles.pressed]}
              >
                <View style={[styles.avatar, member.isMe && styles.avatarMe]}>
                  <AppText weight={700} color={member.isMe ? 'onPrimary' : 'primary'}>
                    {initials(member.name)}
                  </AppText>
                </View>
                <View style={styles.grow}>
                  <AppText weight={600}>{name}</AppText>
                  <AppText variant="label" weight={400} color="text2">
                    {t(`planTogether.roles.${member.role}`)}
                  </AppText>
                </View>
                {manageable ? (
                  <View style={styles.rolePill}>
                    <AppText variant="label" weight={600} color="primary">
                      {t('planTogether.access.change')}
                    </AppText>
                    <Icon
                      name={open ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={Colors.primary}
                      weight="semibold"
                    />
                  </View>
                ) : (
                  member.isMe && (
                    <Button
                      variant="text"
                      label={t('planTogether.leave')}
                      onPress={() => removeMember(member)}
                    />
                  )
                )}
              </Pressable>

              {open && (
                <Animated.View entering={Motion.enter} exiting={Motion.exit} style={styles.access}>
                  {(['editor', 'suggester'] as const).map((role) => (
                    <Pressable
                      key={role}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: member.role === role }}
                      onPress={() => member.role !== role && changeRole(member, role)}
                      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                    >
                      <Icon
                        name={member.role === role ? 'checkmark-circle' : 'ellipse-outline'}
                        size={26}
                        color={member.role === role ? Colors.primary : Colors.borderInput}
                      />
                      <View style={styles.grow}>
                        <AppText weight={600}>{t(`planTogether.access.${role}`)}</AppText>
                        <AppText variant="caption" color="text2">
                          {t(`planTogether.access.${role}Detail`)}
                        </AppText>
                      </View>
                    </Pressable>
                  ))}
                  <View style={styles.accessActions}>
                    <Button
                      variant="text"
                      label={t('planTogether.access.owner')}
                      onPress={() => changeRole(member, 'owner')}
                    />
                    <Button
                      variant="text"
                      label={t('planTogether.remove')}
                      onPress={() => removeMember(member)}
                    />
                  </View>
                </Animated.View>
              )}
            </View>
          );
        })}
      </View>

      {canInvite && (
        <>
          <Button
            icon="person-add-outline"
            label={t('planTogether.invite')}
            loading={createInvite.isPending && createInvite.variables?.role === 'editor'}
            onPress={() => invite('editor')}
          />
          <Button
            variant="secondary"
            icon="chatbubble-ellipses-outline"
            label={t('planTogether.inviteSuggester')}
            loading={createInvite.isPending && createInvite.variables?.role === 'suggester'}
            onPress={() => invite('suggester')}
          />
          <AppText variant="label" weight={400} color="text2">
            {t('planTogether.inviteHint')}
          </AppText>
        </>
      )}
      {note && <AppText color="success">{note}</AppText>}
      {error && <FieldError message={error} />}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  grow: {
    flex: 1,
  },
  members: {
    gap: Spacing.sm,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 52,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  avatarMe: {
    backgroundColor: Colors.primaryFill,
  },
  pressed: {
    opacity: 0.6,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.chip,
    backgroundColor: Colors.primaryTint,
  },
  access: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    marginLeft: 44 + Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.bg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
  },
  accessActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
}));
