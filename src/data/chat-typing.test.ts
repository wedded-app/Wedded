import { createTypingSender, TYPING_IDLE_MS, TYPING_PING_MS } from './chat-typing';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('typing signal', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('says typing on the first key, then at most every two seconds', () => {
    const send = jest.fn();
    const sender = createTypingSender(send);
    sender.typed();
    expect(send).toHaveBeenLastCalledWith(true);
    jest.advanceTimersByTime(500);
    sender.typed();
    jest.advanceTimersByTime(500);
    sender.typed();
    expect(send).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(TYPING_PING_MS);
    sender.typed();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('says stopped five seconds after the last key', () => {
    const send = jest.fn();
    const sender = createTypingSender(send);
    sender.typed();
    jest.advanceTimersByTime(TYPING_IDLE_MS - 1);
    expect(send).not.toHaveBeenCalledWith(false);
    jest.advanceTimersByTime(1);
    expect(send).toHaveBeenLastCalledWith(false);
  });

  it('stops at once on send, and only says so after typing', () => {
    const send = jest.fn();
    const sender = createTypingSender(send);
    sender.stop();
    expect(send).not.toHaveBeenCalled();
    sender.typed();
    sender.stop();
    expect(send.mock.calls).toEqual([[true], [false]]);
    jest.advanceTimersByTime(TYPING_IDLE_MS);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
