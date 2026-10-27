import type { StoryGroup } from '@/data/stories';
import type { VendorPhoto } from '@/data/vendor-media';
import type { VendorProfile } from '@/data/vendors';

import { fromGroup, vendorTeller } from './story-tellers';

const story = {
  id: 's1',
  kind: 'photo' as const,
  mediaPath: 'a/s1.jpg',
  thumbPath: null,
  url: 'https://x/s1.jpg',
  thumbUrl: null,
  durationS: null,
  caption: 'Sangeet night',
  createdAt: '2026-10-26T20:00:00Z',
};

describe('fromGroup', () => {
  const group: StoryGroup = {
    key: 'u1',
    authorId: 'u1',
    name: null,
    vendor: null,
    following: true,
    isMine: false,
    isSample: false,
    stories: [story],
  };

  it("plays a person's posted stories, named Someone when they have no name", () => {
    const teller = fromGroup(group, 'Someone');
    expect(teller).toMatchObject({ name: 'Someone', personId: 'u1', vendor: null, live: true });
    expect(teller.slides).toEqual([
      {
        id: 's1',
        kind: 'photo',
        url: 'https://x/s1.jpg',
        blurhash: null,
        caption: 'Sangeet night',
        postedAt: '2026-10-26T20:00:00Z',
        story,
      },
    ]);
  });

  it("opens a business's page instead of a person's", () => {
    const teller = fromGroup({ ...group, vendor: { id: 'v1', slug: 'dj', name: 'DJ' } }, 'Someone');
    expect(teller.personId).toBeNull();
    expect(teller.vendor).toEqual({ id: 'v1', slug: 'dj', category: null, city: '' });
  });
});

describe('vendorTeller', () => {
  const vendor = {
    id: 'v1',
    slug: 'royal-orchard',
    name: { en: 'Royal Orchard' },
    city: 'Yuba City',
    tagline: ' Seats 700 ',
    bio: null,
    isSample: true,
    categories: [{ name: { en: 'Banquet hall' } }],
  } as unknown as VendorProfile;
  const photo = {
    id: 'p1',
    blurhash: 'L00',
    url: { small: 'small.jpg', medium: 'medium.jpg', large: 'large.jpg' },
  } as unknown as VendorPhoto;

  it("plays a vendor's photos with their tagline, closing after the last", () => {
    const [teller] = vendorTeller(vendor, [photo]);
    expect(teller).toMatchObject({
      key: 'royal-orchard',
      name: 'Royal Orchard',
      place: 'Banquet hall · Yuba City',
      avatarUrl: 'small.jpg',
      live: false,
      isSample: true,
    });
    expect(teller.slides[0]).toMatchObject({ url: 'large.jpg', caption: 'Seats 700', story: null });
  });

  it('has no one to play without photos', () => {
    expect(vendorTeller(vendor, [])).toEqual([]);
    expect(vendorTeller(null, [photo])).toEqual([]);
  });
});
