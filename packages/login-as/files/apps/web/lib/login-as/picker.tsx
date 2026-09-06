'use client';

import { useEffect, useState } from 'react';
import { useMutation, usePaginatedQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';

interface LoginAsPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  twoFactorEnrolled: boolean;
}

export function LoginAsPicker({ open, onOpenChange, twoFactorEnrolled }: LoginAsPickerProps) {
  const [search, setSearch] = useState('');
  const start = useMutation(api.loginAs.api.start);
  const [pendingUserId, setPendingUserId] = useState<Id<'users'> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setSearch('');
    setError(null);
    setPendingUserId(null);
  }, [open]);

  const { results, status, loadMore } = usePaginatedQuery(
    api.loginAs.api.searchTargets,
    open && twoFactorEnrolled ? { search: search.trim() || undefined } : 'skip',
    { initialNumItems: 20 },
  );

  if (!open) return null;

  const handleSelect = async (userId: Id<'users'>) => {
    if (!twoFactorEnrolled) return;
    setPendingUserId(userId);
    setError(null);
    try {
      await start({ targetUserId: userId });
      window.location.assign('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start login-as.');
      setPendingUserId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Login as location user"
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-6"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="mt-16 w-full max-w-md rounded-lg border border-border bg-popover p-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-sm font-semibold">Login as location user</p>
        {!twoFactorEnrolled ? (
          <p role="alert" className="text-sm text-destructive">
            Enable two-factor authentication on your own account before using login-as.
          </p>
        ) : (
          <>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users"
              className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <ul className="max-h-72 overflow-y-auto text-sm">
              {status === 'LoadingFirstPage' && <li className="px-2 py-3 text-muted-foreground">Loading…</li>}
              {results?.length === 0 && status !== 'LoadingFirstPage' && (
                <li className="px-2 py-3 text-muted-foreground">No users</li>
              )}
              {results?.map((user) => (
                <li key={user._id}>
                  <button
                    type="button"
                    disabled={pendingUserId === user._id}
                    className="flex w-full flex-col items-start rounded-md px-2 py-2 text-left hover:bg-accent disabled:opacity-60"
                    onClick={() => handleSelect(user._id)}
                  >
                    <span data-pii="">
                      {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
                    </span>
                    <span className="text-xs text-muted-foreground" data-pii="">
                      {user.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {status === 'CanLoadMore' && (
              <button type="button" className="mt-2 text-xs underline" onClick={() => loadMore(20)}>
                Load more
              </button>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
