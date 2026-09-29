import { AuthErrorCode } from '@acc/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiFetch, apiFetchOptional, onSessionEnded, tokenStore } from './api-client';

class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length(): number {
    return this.items.size;
  }
  clear(): void {
    this.items.clear();
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api-client', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const sessionEnded = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('sessionStorage', new MemoryStorage());
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set({ accessToken: 'access', refreshToken: 'refresh' }, true);
    onSessionEnded(sessionEnded);
  });

  afterEach(() => {
    onSessionEnded(null);
    fetchMock.mockReset();
    sessionEnded.mockReset();
    vi.unstubAllGlobals();
  });

  it('surfaces a wrong current password without refreshing or ending the session', async () => {
    fetchMock.mockResolvedValueOnce(
      json(401, {
        data: null,
        error: {
          code: AuthErrorCode.CurrentPasswordIncorrect,
          message: 'Current password is incorrect',
        },
      }),
    );

    const call = apiFetch('/auth/change-password', { method: 'POST', body: {} });

    await expect(call).rejects.toMatchObject({
      status: 401,
      code: AuthErrorCode.CurrentPasswordIncorrect,
      message: 'Current password is incorrect',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sessionEnded).not.toHaveBeenCalled();
    expect(tokenStore.getRefreshToken()).toBe('refresh');
  });

  it('still ends the session on an ordinary 401 when refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(401, { data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
      )
      .mockResolvedValueOnce(
        json(401, { data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
      );

    await expect(apiFetch('/admin/settings')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock.mock.calls[1]?.[0]).toMatch(/\/auth\/refresh$/);
    expect(sessionEnded).toHaveBeenCalledTimes(1);
    expect(tokenStore.getRefreshToken()).toBeNull();
  });

  it('reads an empty body as null', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));
    await expect(apiFetchOptional('/admin/broadcast')).resolves.toBeNull();
  });
});
