import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

/**
 * Wed's place in the middle of business mode's tab bar. iPhone's own tab bar
 * holds only tabs, so Wed gets this one, which never opens from the bar: the
 * tabs mark it disabled and a tap on it slides Wed up for the business
 * (/business/wed) instead. Reached any other way (by its address), it goes
 * to Today.
 */
export default function BusinessWedTab() {
  useFocusEffect(
    useCallback(() => {
      router.replace('/today');
    }, []),
  );
  return null;
}
