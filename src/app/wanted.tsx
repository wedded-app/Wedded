import { Redirect } from 'expo-router';

/**
 * The families looking (#221), for old links: Wanted lives inside Leads
 * (since 2026-10-23), so this opens Leads on its Wanted half. It can't stay a
 * page of business mode's tabs, because iPhone's own tab bar holds only tabs.
 */
export default function WantedScreen() {
  return <Redirect href={{ pathname: '/leads', params: { half: 'wanted' } }} />;
}
