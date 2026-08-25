import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRealtimeStatus, _setChannelStatusForTest } from './realtime';

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
