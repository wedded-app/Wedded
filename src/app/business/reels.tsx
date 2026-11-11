import ReelsScreen from '../(tabs)/discover';

/**
 * Business mode's Reels, opened from My page: the same feed as the planning
 * side's, without the families' Book and Ask Wed buttons, and with Back.
 */
export default function BusinessReelsScreen() {
  return <ReelsScreen business back />;
}
