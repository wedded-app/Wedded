import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

/**
 * Wed's place in the middle of the tab bar. iPhone's own tab bar holds only
 * tabs, so Wed gets this one, which never opens from the bar: the tabs
 * layout marks it disabled and a tap on it slides Wed's sheet up instead.
 * Reached any other way (by its address), it goes Home.
 */
export default function WedTab() {
  useFocusEffect(
    useCallback(() => {
      router.replace('/');
    }, []),
  );
  return null;
}
