/**
 * TEMPORARY: a stand-in for Tab 1's Requests and Wedded Pro hooks (#218, #220)
 * with the same names and shapes, on sample data kept in memory, so the
 * screens can be built and tried before the data lands. When it does, this
 * file re-exports `@/data/requests` instead. Never merged to main as is.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DateStatus } from '@/data/availability';
import type { GuestBand } from '@/data/inquiries';

export type RequestStatus = 'open' | 'booked' | 'closed';

export type FamilyRequest = {
  id: string;
  categorySlug: string;
  eventSlug: string | null;
  eventDate: string | null;
  guestBand: GuestBand | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  note: string;
  city: string;
  status: RequestStatus;
  proposalCount: number;
  createdAt: string;
};

export type NewRequest = Pick<
  FamilyRequest,
  'categorySlug' | 'eventSlug' | 'eventDate' | 'guestBand' | 'budgetMinCents' | 'budgetMaxCents'
> & { note: string; city: string };

export type ProposalStatus = 'sent' | 'accepted' | 'declined' | 'withdrawn';
export type PriceUnit = 'event' | 'person' | 'plate' | 'hour';

export type Proposal = {
  id: string;
  requestId: string;
  vendor: {
    id: string;
    slug: string;
    name: string;
    city: string;
    coverUrl: string | null;
    foundingNumber: number | null;
    /** From vendor_public_stats: null below 5 families. */
    bookedBy: number | null;
    repliedTo: { replied: number; asked: number } | null;
  };
  priceCents: number;
  unit: PriceUnit;
  note: string;
  menuId: string | null;
  reelId: string | null;
  status: ProposalStatus;
  createdAt: string;
};

export type LookingCard = {
  requestId: string;
  familyName: string;
  city: string;
  categorySlug: string;
  eventSlug: string | null;
  eventDate: string | null;
  guestBand: GuestBand | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  note: string;
  miles: number | null;
  proposalCount: number;
  alreadyProposed: boolean;
  dateStatus: DateStatus;
  postedAt: string;
};

export type LookingFilters = {
  categorySlug?: string | null;
  maxMiles?: number | null;
};

export type LookingSummary = {
  /** Families looking near the vendor in their types this month. */
  total: number;
  categorySlug: string | null;
  categoryCount: number;
};

export type ProStatus = 'free' | 'pro';

export type NewProposal = {
  requestId: string;
  priceCents: number;
  unit: PriceUnit;
  note: string;
  menuId?: string | null;
  reelId?: string | null;
};

// Sample data ---------------------------------------------------------------------------

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

let myRequests: FamilyRequest[] = [
  {
    id: 'r1',
    categorySlug: 'dhol',
    eventSlug: 'jaago',
    eventDate: '2027-06-12',
    guestBand: '100_250',
    budgetMinCents: 50000,
    budgetMaxCents: 100000,
    note: 'Two dhol players for about an hour, from 9 pm. Bhangra-ready!',
    city: 'Yuba City',
    status: 'open',
    proposalCount: 3,
    createdAt: hoursAgo(20),
  },
];

let proposals: Proposal[] = [
  {
    id: 'p1',
    requestId: 'r1',
    vendor: {
      id: 'v-dhol-1',
      slug: 'gabru-dhol',
      name: 'Gabru Dhol Group',
      city: 'Yuba City',
      coverUrl: null,
      foundingNumber: 4,
      bookedBy: 12,
      repliedTo: { replied: 18, asked: 19 },
    },
    priceCents: 75000,
    unit: 'event',
    note: 'Two dholis for 90 minutes, matching kurtas and the full jaago entry. We know your area well.',
    menuId: null,
    reelId: 'reel-1',
    status: 'sent',
    createdAt: hoursAgo(6),
  },
  {
    id: 'p2',
    requestId: 'r1',
    vendor: {
      id: 'v-dhol-2',
      slug: 'sutter-beats',
      name: 'Sutter Beats',
      city: 'Marysville',
      coverUrl: null,
      foundingNumber: null,
      bookedBy: null,
      repliedTo: { replied: 7, asked: 9 },
    },
    priceCents: 60000,
    unit: 'event',
    note: 'One dhol and a nagara, one hour. Free that Saturday.',
    menuId: null,
    reelId: null,
    status: 'sent',
    createdAt: hoursAgo(3),
  },
  {
    id: 'p3',
    requestId: 'r1',
    vendor: {
      id: 'v-dhol-3',
      slug: 'royal-dhol',
      name: 'Royal Dhol Co.',
      city: 'Sacramento',
      coverUrl: null,
      foundingNumber: null,
      bookedBy: 6,
      repliedTo: null,
    },
    priceCents: 95000,
    unit: 'event',
    note: 'Three players with LED dhols for the night. Travel included.',
    menuId: null,
    reelId: null,
    status: 'sent',
    createdAt: hoursAgo(1),
  },
];

let looking: LookingCard[] = [
  {
    requestId: 'l1',
    familyName: 'Harjit K.',
    city: 'Yuba City',
    categorySlug: 'dj',
    eventSlug: 'reception',
    eventDate: '2027-06-13',
    guestBand: '250_500',
    budgetMinCents: 250000,
    budgetMaxCents: 500000,
    note: 'Bollywood and bhangra for the reception, and a quiet set during dinner. We want the dance floor full by 9.',
    miles: 4,
    proposalCount: 2,
    alreadyProposed: false,
    dateStatus: 'open',
    postedAt: hoursAgo(2),
  },
  {
    requestId: 'l2',
    familyName: 'Simran S.',
    city: 'Sacramento',
    categorySlug: 'dj',
    eventSlug: 'sangeet',
    eventDate: '2027-05-01',
    guestBand: '100_250',
    budgetMinCents: 100000,
    budgetMaxCents: 250000,
    note: 'Sangeet in our backyard. Need speakers and lights too.',
    miles: 38,
    proposalCount: 5,
    alreadyProposed: true,
    dateStatus: 'booked',
    postedAt: hoursAgo(26),
  },
  {
    requestId: 'l3',
    familyName: 'Aman G.',
    city: 'Live Oak',
    categorySlug: 'dj',
    eventSlug: 'jaago',
    eventDate: '2027-08-20',
    guestBand: '50_100',
    budgetMinCents: null,
    budgetMaxCents: 100000,
    note: 'Small jaago at home, mostly family. Punjabi folk only please.',
    miles: 9,
    proposalCount: 0,
    alreadyProposed: false,
    dateStatus: 'unknown',
    postedAt: hoursAgo(50),
  },
];

let pro: ProStatus = 'free';

// Hooks ---------------------------------------------------------------------------------

const keys = {
  mine: ['mock-requests', 'mine'] as const,
  proposals: (id: string) => ['mock-requests', 'proposals', id] as const,
  looking: ['mock-requests', 'looking'] as const,
  pro: ['mock-requests', 'pro'] as const,
};

const wait = () => new Promise((resolve) => setTimeout(resolve, 350));

export function useMyRequests(_weddingId: string | null) {
  return useQuery({ queryKey: keys.mine, queryFn: async () => (await wait(), [...myRequests]) });
}

export function usePostRequest(_weddingId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: NewRequest) => {
      await wait();
      const posted: FamilyRequest = {
        ...request,
        id: `r${Date.now()}`,
        status: 'open',
        proposalCount: 0,
        createdAt: new Date().toISOString(),
      };
      myRequests = [posted, ...myRequests];
      return posted.id;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.mine }),
  });
}

export function useCloseRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      await wait();
      myRequests = myRequests.map((r) => (r.id === requestId ? { ...r, status: 'closed' } : r));
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.mine }),
  });
}

export function useRequestProposals(requestId: string) {
  return useQuery({
    queryKey: keys.proposals(requestId),
    queryFn: async () => (await wait(), proposals.filter((p) => p.requestId === requestId)),
  });
}

export function useAnswerProposal(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      proposalId,
      answer,
    }: {
      proposalId: string;
      answer: 'accept' | 'decline';
    }): Promise<{ conversationId: string | null }> => {
      await wait();
      proposals = proposals.map((p) =>
        p.id === proposalId ? { ...p, status: answer === 'accept' ? 'accepted' : 'declined' } : p,
      );
      if (answer === 'accept') {
        myRequests = myRequests.map((r) => (r.id === requestId ? { ...r, status: 'booked' } : r));
      }
      return { conversationId: null };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.proposals(requestId) });
      void queryClient.invalidateQueries({ queryKey: keys.mine });
    },
  });
}

export function useFamiliesLooking(_vendorId: string, filters: LookingFilters = {}) {
  return useQuery({
    queryKey: [...keys.looking, filters],
    queryFn: async () => {
      await wait();
      return looking.filter(
        (card) => filters.maxMiles == null || (card.miles ?? 0) <= filters.maxMiles,
      );
    },
  });
}

export function useFamiliesLookingSummary(_vendorId: string) {
  return useQuery({
    queryKey: [...keys.looking, 'summary'],
    queryFn: async (): Promise<LookingSummary> => (
      await wait(),
      { total: 14, categorySlug: 'dj', categoryCount: 9 }
    ),
  });
}

export function useSendProposal(_vendorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proposal: NewProposal) => {
      await wait();
      looking = looking.map((card) =>
        card.requestId === proposal.requestId
          ? { ...card, alreadyProposed: true, proposalCount: card.proposalCount + 1 }
          : card,
      );
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.looking }),
  });
}

export function useProStatus(_vendorId: string) {
  return useQuery({ queryKey: keys.pro, queryFn: async () => (await wait(), pro) });
}

/** Mock only: flip Pro on and off from the Pro page while trying the screens. */
export function useMockTogglePro() {
  const queryClient = useQueryClient();
  return () => {
    pro = pro === 'pro' ? 'free' : 'pro';
    void queryClient.invalidateQueries({ queryKey: keys.pro });
  };
}

/** Card lookups for the composer. */
export function lookingCard(requestId: string): LookingCard | undefined {
  return looking.find((card) => card.requestId === requestId);
}
