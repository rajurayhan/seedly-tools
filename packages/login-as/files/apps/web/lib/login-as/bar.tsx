'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import { registerLoginAsStop } from './signout';

export function LoginAsBar() {
  const status = useQuery(api.loginAs.api.getStatus);
  const stop = useMutation(api.loginAs.api.stop);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    registerLoginAsStop(() => stop({ reason: 'signout' }));
    return () => registerLoginAsStop(null);
  }, [stop]);

  useEffect(() => {
    const root = document.documentElement;
    if (status) {
      root.setAttribute('data-login-as', '');
    } else {
      root.removeAttribute('data-login-as');
    }
    return () => {
      root.removeAttribute('data-login-as');
    };
  }, [status]);

  if (!status) return null;

  const handleSwitchBack = async () => {
    if (switching) return;
    setSwitching(true);
    setError(null);
    try {
      await stop({ reason: 'manual' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch back to your account.');
      setSwitching(false);
      return;
    }
    window.location.assign('/');
  };

  return (
    <div
      className="flex h-9 shrink-0 items-center justify-center gap-2 border-b border-info/40 px-4 text-xs"
      style={{ backgroundColor: 'hsl(var(--info) / 0.08)' }}
    >
      <span>
        you are{' '}
        <span className="font-semibold text-info" data-pii="">
          {status.real.name || status.real.email}
        </span>{' '}
        as{' '}
        <span className="font-semibold text-info" data-pii="">
          {status.target.name || status.target.email}
        </span>
      </span>
      <button
        type="button"
        onClick={handleSwitchBack}
        disabled={switching}
        className="font-semibold text-info underline underline-offset-2 hover:opacity-80 disabled:opacity-60"
      >
        switch to my account
      </button>
      {error && (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
