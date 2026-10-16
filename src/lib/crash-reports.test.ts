import type { ErrorEvent } from '@sentry/react-native';

import { stripPersonalDetails } from './crash-reports';

jest.mock('@sentry/react-native', () => ({ init: jest.fn(), captureException: jest.fn() }));

describe('stripPersonalDetails', () => {
  it('drops who the person is', () => {
    const event = stripPersonalDetails({
      type: undefined,
      user: { email: 'kirat@example.com' },
      request: { data: { phone: '+15305550101' } },
      contexts: { device: { name: "Kirat's iPhone", model: 'iPhone17,1' } },
      breadcrumbs: [
        { category: 'console', message: 'Kirat Bagri signed in' },
        { category: 'navigation', data: { to: '/plan' } },
      ],
    } as ErrorEvent);
    expect(event.user).toBeUndefined();
    expect(event.request).toBeUndefined();
    expect(event.contexts?.device).toEqual({ model: 'iPhone17,1' });
    expect(event.breadcrumbs).toEqual([{ category: 'navigation', data: { to: '/plan' } }]);
  });

  it('masks emails and phone numbers, and cuts query strings off URLs', () => {
    const event = stripPersonalDetails({
      type: undefined,
      message: 'No account for kirat@example.com or (530) 555-0101',
      exception: {
        values: [{ value: 'Code sent to +91 98765 43210', stacktrace: { frames: [] } }],
      },
      breadcrumbs: [{ category: 'fetch', data: { url: 'https://db.example/rest?phone=eq.1' } }],
    } as ErrorEvent);
    expect(event.message).toBe('No account for [email] or [phone]');
    expect(event.exception?.values?.[0]).toEqual({
      value: 'Code sent to [phone]',
      stacktrace: { frames: [] },
    });
    expect(event.breadcrumbs?.[0].data).toEqual({ url: 'https://db.example/rest' });
  });

  it('leaves dates, ids and versions alone', () => {
    const text = 'Wedding 2026-10-16 row 550e8400-e29b-41d4-a716-446655440000 app 1.4.2';
    expect(stripPersonalDetails({ type: undefined, message: text } as ErrorEvent).message).toBe(
      text,
    );
  });
});
