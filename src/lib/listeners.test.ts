import { createListeners } from './listeners';

describe('createListeners', () => {
  it('tells everyone subscribed, until they unsubscribe', () => {
    const { subscribe, notify } = createListeners();
    const a = jest.fn();
    const b = jest.fn();
    const stopA = subscribe(a);
    subscribe(b);

    notify();
    stopA();
    notify();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});
