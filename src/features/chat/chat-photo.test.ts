import { fitWithin, rememberSentPhoto, sentPhotoUri } from './chat-photo';

jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: {} }));

describe('chat photos', () => {
  it('shrinks the longest side to fit, keeping the shape', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600 });
    expect(fitWithin(3024, 4032)).toEqual({ height: 1600 });
    expect(fitWithin(2000, 2000)).toEqual({ width: 1600 });
  });

  it('leaves small photos, and photos of unknown size, as they are', () => {
    expect(fitWithin(1200, 900)).toBeNull();
    expect(fitWithin(1600, 1200)).toBeNull();
    expect(fitWithin(0, 0)).toBeNull();
  });

  it('remembers the phone copy of a photo it sent', () => {
    rememberSentPhoto('c1/a.jpg', 'file:///a.jpg');
    expect(sentPhotoUri('c1/a.jpg')).toBe('file:///a.jpg');
    expect(sentPhotoUri('c1/other.jpg')).toBeNull();
    expect(sentPhotoUri(null)).toBeNull();
  });
});
