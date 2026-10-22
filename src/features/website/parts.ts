import type { Href } from 'expo-router';

import type { IconName } from '@/components/icon';
import type { SitePage, SiteSection } from '@/data/website';

import { longDate } from './site-helpers';

type Translate = (key: string, options?: Record<string, string | number>) => string;

/** Each part of the site in the builder: its icon, name and where it's edited. */
export const PART_INFO: Record<SiteSection, { icon: IconName; titleKey: string; href: Href }> = {
  family: { icon: 'people-outline', titleKey: 'website.parts.family', href: '/website/family' },
  story: { icon: 'book-outline', titleKey: 'website.parts.story', href: '/website/story' },
  events: { icon: 'calendar-outline', titleKey: 'website.parts.events', href: '/website/events' },
  rsvp: { icon: 'mail-outline', titleKey: 'website.parts.rsvp', href: '/website/rsvp' },
  guide: {
    icon: 'information-circle-outline',
    titleKey: 'website.parts.guide',
    href: { pathname: '/website/list', params: { kind: 'tip' } },
  },
  travel: {
    icon: 'bed-outline',
    titleKey: 'website.parts.travel',
    href: { pathname: '/website/list', params: { kind: 'hotel' } },
  },
  livestream: {
    icon: 'videocam-outline',
    titleKey: 'website.parts.livestream',
    href: '/website/livestream',
  },
  faq: {
    icon: 'help-circle-outline',
    titleKey: 'website.parts.faq',
    href: { pathname: '/website/list', params: { kind: 'faq' } },
  },
};

/** The line under a part's name in the builder: what's in it, or what to add. */
export function partSummary(page: SitePage, section: SiteSection, t: Translate): string {
  switch (section) {
    case 'family':
      return page.familyLines.length > 0
        ? page.familyLines.join(' · ')
        : t('website.summary.familyEmpty');
    case 'story':
      return page.story ? clip(page.story) : t('website.summary.storyEmpty');
    case 'events': {
      const noDress = page.events.filter((e) => !e.dressCode).length;
      return noDress > 0
        ? t('website.summary.eventsNoDress', { count: noDress })
        : t('website.summary.events', { count: page.events.length });
    }
    case 'rsvp':
      return page.rsvpBy
        ? t('website.summary.rsvpBy', { date: longDate(page.rsvpBy) })
        : t('website.summary.rsvpEmpty');
    case 'guide':
      return page.tips.length > 0
        ? t('website.summary.tips', { count: page.tips.length })
        : t('website.summary.guideEmpty');
    case 'travel':
      return page.hotels.length > 0
        ? t('website.summary.hotels', { count: page.hotels.length })
        : t('website.summary.travelEmpty');
    case 'livestream':
      return page.livestreamUrl ? t('website.summary.liveAdded') : t('website.summary.liveEmpty');
    case 'faq':
      return page.faq.length > 0
        ? t('website.summary.faq', { count: page.faq.length })
        : t('website.summary.faqEmpty');
  }
}

function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 70 ? `${flat.slice(0, 68).trimEnd()}…` : flat;
}
