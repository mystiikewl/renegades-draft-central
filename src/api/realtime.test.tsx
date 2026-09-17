import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { channel, removeChannel } = vi.hoisted(() => ({
  channel: {
    on: vi.fn(),
    subscribe: vi.fn(),
  },
  removeChannel: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => channel),
    removeChannel,
  },
}));

import { useDraftRealtime, useRealtimeStatus, _setChannelStatusForTest } from './realtime';

const wrapperFor = (queryClient: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRealtimeStatus', () => {
  it('transitions connecting -> connected -> disconnected', () => {
    const { result } = renderHook(() => useRealtimeStatus());
    expect(result.current).toBe('connecting');

    act(() => _setChannelStatusForTest('SUBSCRIBED'));
    expect(result.current).toBe('connected');

    act(() => _setChannelStatusForTest('CHANNEL_ERROR'));
    expect(result.current).toBe('disconnected');

    act(() => _setChannelStatusForTest('SUBSCRIBED'));
    expect(result.current).toBe('connected');
  });
});

describe('useDraftRealtime', () => {
  it('does not add callbacks after a shared season channel has subscribed', () => {
    let subscribed = false;
    channel.on.mockImplementation(() => {
      if (subscribed) throw new Error('cannot add `postgres_changes` callbacks after `subscribe()`.');
      return channel;
    });
    channel.subscribe.mockImplementation(() => {
      subscribed = true;
      return channel;
    });

    const wrapper = wrapperFor(new QueryClient());

    const first = renderHook(() => useDraftRealtime('season-1'), { wrapper });
    const second = renderHook(() => useDraftRealtime('season-1'), { wrapper });

    expect(channel.subscribe).toHaveBeenCalledTimes(1);
    expect(removeChannel).not.toHaveBeenCalled();

    first.unmount();
    expect(removeChannel).not.toHaveBeenCalled();

    second.unmount();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
