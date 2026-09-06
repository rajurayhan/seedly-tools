'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { Button, Label, toast } from '@seedly-crm/ui';

const getSettingsRef = makeFunctionReference<'query'>('seedlyPin/api:getSettings');
const updateSettingsRef = makeFunctionReference<'mutation'>('seedlyPin/api:updateSettings');

const ROLES = [
  { slug: 'agency_owner', label: 'Agency owner' },
  { slug: 'brand_admin', label: 'Brand admin' },
  { slug: 'sub_account_admin', label: 'Location admin' },
  { slug: 'sub_account_user', label: 'Location user' },
];

export function SeedlyPinSettingsPanel() {
  const settings = useQuery(getSettingsRef);
  const update = useMutation(updateSettingsRef);
  const [enabled, setEnabled] = useState(false);
  const [dropRoles, setDropRoles] = useState<string[]>([]);
  const [triageRoles, setTriageRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.enabled);
    setDropRoles(settings.dropRoles);
    setTriageRoles(settings.triageRoles);
  }, [settings]);

  if (settings === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (settings === null) {
    return <p className="text-sm text-muted-foreground">Only an agency owner can change SeedlyPin.</p>;
  }

  const toggle = (list: string[], slug: string, set: (next: string[]) => void) => {
    set(list.includes(slug) ? list.filter((item) => item !== slug) : [...list, slug]);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pins</h1>
        <p className="text-sm text-muted-foreground">
          Agency-wide. When this is off, nobody can drop or triage pins. There is no plan switch.
        </p>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enable SeedlyPin for this agency
      </label>
      <fieldset className="space-y-2">
        <Label>Who can drop a pin</Label>
        {ROLES.map((role) => (
          <label key={role.slug} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dropRoles.includes(role.slug)}
              onChange={() => toggle(dropRoles, role.slug, setDropRoles)}
            />
            {role.label}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <Label>Who can triage pins</Label>
        {ROLES.map((role) => (
          <label key={role.slug} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={triageRoles.includes(role.slug)}
              onChange={() => toggle(triageRoles, role.slug, setTriageRoles)}
            />
            {role.label}
          </label>
        ))}
      </fieldset>
      <Button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await update({ enabled, dropRoles, triageRoles });
            toast('Pins settings saved');
          } catch (err) {
            toast.error('Could not save', {
              description: err instanceof Error ? err.message : 'Try again',
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        Save
      </Button>
    </div>
  );
}
