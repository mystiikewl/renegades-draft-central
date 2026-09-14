import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import {
  notificationState,
  requestOnClockPermission,
  useOnTheClockNotification,
} from './useOnTheClockNotification';

class NotificationMock {
  static instances: NotificationMock[] = [];
  constructor(
    public title: string,
    public options?: NotificationOptions | undefined,
  ) {
    NotificationMock.instances.push(this);
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useOnTheClockNotification', () => {
  beforeEach(() => {
    NotificationMock.instances = [];
    vi.stubGlobal('Notification', NotificationMock);
    Object.defineProperty(NotificationMock, 'permission', { configurable: true, value: 'granted' });
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  });

  it('notifies when the turn becomes mine while the tab is hidden', () => {
    function Probe({ on }: { on: boolean }) {
      useOnTheClockNotification({ isMyTurn: on, pickNumber: 12, seasonLabel: '2026-27' });
      return null;
    }
    const { rerender } = render(<Probe on={false} />);
    expect(NotificationMock.instances).toHaveLength(0);
    rerender(<Probe on />);
    expect(NotificationMock.instances).toHaveLength(1);
    expect(NotificationMock.instances[0].title).toBe("You're on the clock");
    expect(NotificationMock.instances[0].options?.body).toContain('Pick #12');
    expect(NotificationMock.instances[0].options?.body).toContain('2026-27');
    expect(NotificationMock.instances[0].options?.tag).toBe('on-the-clock');
  });

  it('does not notify while the tab is visible', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    function Probe({ on }: { on: boolean }) {
      useOnTheClockNotification({ isMyTurn: on, pickNumber: 3 });
      return null;
    }
    const { rerender } = render(<Probe on={false} />);
    rerender(<Probe on />);
    expect(NotificationMock.instances).toHaveLength(0);
  });

  it('does not notify without permission', () => {
    Object.defineProperty(NotificationMock, 'permission', { configurable: true, value: 'denied' });
    function Probe({ on }: { on: boolean }) {
      useOnTheClockNotification({ isMyTurn: on, pickNumber: 3 });
      return null;
    }
    const { rerender } = render(<Probe on={false} />);
    rerender(<Probe on />);
    expect(NotificationMock.instances).toHaveLength(0);
  });

  it('does not re-notify while it stays my turn', () => {
    function Probe({ on, pickNumber }: { on: boolean; pickNumber: number }) {
      useOnTheClockNotification({ isMyTurn: on, pickNumber });
      return null;
    }
    const { rerender } = render(<Probe on={false} pickNumber={1} />);
    rerender(<Probe on pickNumber={1} />);
    rerender(<Probe on pickNumber={1} />);
    expect(NotificationMock.instances).toHaveLength(1);
  });
});

describe('notificationState / requestOnClockPermission', () => {
  it('reports unsupported without the API', async () => {
    vi.stubGlobal('Notification', undefined);
    expect(notificationState()).toBe('unsupported');
    expect(await requestOnClockPermission()).toBe('unsupported');
  });

  it('requests permission only from the default state', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const Ctor = class {};
    Object.defineProperty(Ctor, 'permission', { configurable: true, value: 'default' });
    Object.defineProperty(Ctor, 'requestPermission', { configurable: true, value: requestPermission });
    vi.stubGlobal('Notification', Ctor);

    expect(notificationState()).toBe('default');
    await expect(requestOnClockPermission()).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });
});
