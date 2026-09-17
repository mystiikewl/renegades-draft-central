import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OnClockNotifyToggle } from './OnClockNotifyToggle';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('keeps the bell visible without Notification and explains phone setup', () => {
  vi.stubGlobal('Notification', undefined);
  render(<OnClockNotifyToggle />);
  fireEvent.click(screen.getByRole('button', { name: /alert/i }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
  expect(screen.getByText(/Android/)).toBeInTheDocument();
  expect(screen.getByText(/locked or the app is closed/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Enable alerts' })).not.toBeInTheDocument();
});

it('explains denied permissions rather than disabling the bell', () => {
  vi.stubGlobal('Notification', { permission: 'denied' });
  render(<OnClockNotifyToggle />);
  const bell = screen.getByRole('button', { name: /alerts blocked/i });
  expect(bell).not.toBeDisabled();
  fireEvent.click(bell);
  expect(screen.getByText(/site permissions/i)).toBeInTheDocument();
});

it('requests permission only on explicit enable and refreshes on focus', async () => {
  const api = { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') };
  vi.stubGlobal('Notification', api);
  render(<OnClockNotifyToggle />);
  fireEvent.click(screen.getByRole('button', { name: /enable on-the-clock/i }));
  expect(api.requestPermission).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Enable alerts' }));
  await waitFor(() => expect(screen.getByText('Permission granted')).toBeInTheDocument());
  expect(api.requestPermission).toHaveBeenCalledTimes(1);
  api.permission = 'denied';
  fireEvent.focus(window);
  expect(screen.getByText('Notifications blocked')).toBeInTheDocument();
});
