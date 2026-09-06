'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { MapPin, Shield, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Separator,
  SettingRow,
  Skeleton,
  Switch,
  toast,
} from '@seedly-crm/ui';

const getSettingsRef = makeFunctionReference<'query'>('seedlyPin/api:getSettings');
const updateSettingsRef = makeFunctionReference<'mutation'>('seedlyPin/api:updateSettings');

const ROLES = [
  { slug: 'agency_owner', label: 'Agency owner', description: 'Turns Pins on and changes these rules' },
  { slug: 'brand_admin', label: 'Brand admin', description: 'Manages brands and their locations' },
  { slug: 'sub_account_admin', label: 'Location admin', description: 'Runs a single location' },
  { slug: 'sub_account_user', label: 'Location user', description: 'Day-to-day work inside a location' },
];

function sameList(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((item, index) => item === right[index]);
}

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

  const dirty = useMemo(() => {
    if (!settings) return false;
    return enabled !== settings.enabled || !sameList(dropRoles, settings.dropRoles) || !sameList(triageRoles, settings.triageRoles);
  }, [settings, enabled, dropRoles, triageRoles]);

  const toggle = (list: string[], slug: string, set: (next: string[]) => void) => {
    set(list.includes(slug) ? list.filter((item) => item !== slug) : [...list, slug]);
  };

  const save = async () => {
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
  };

  if (settings === undefined) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (settings === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pins"
          icon={MapPin}
          description="Drop a pin on any page, capture a screenshot with the marker printed on it, and triage the report later."
        />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Only an agency owner can change Pins.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pins"
        icon={MapPin}
        description="Agency-wide. When this is off, nobody can drop or triage pins. There is no plan switch."
        actions={
          dirty ? (
            <Button type="button" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          ) : undefined
        }
      />

      <Separator />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">SeedlyPin</CardTitle>
              <CardDescription>The floating pin button only appears for roles allowed to drop a pin.</CardDescription>
            </div>
            <Badge variant={enabled ? 'default' : 'secondary'}>{enabled ? 'On' : 'Off'}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <SettingRow
            label="Enable Pins for this agency"
            description="Turns the drop-pin button and the Pins inbox on or off for everyone."
            htmlFor="seedly-pin-enabled"
          >
            <Switch id="seedly-pin-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </SettingRow>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Who can drop a pin</CardTitle>
            </div>
            <CardDescription>These people see the pin button and can capture a page.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {ROLES.map((role) => (
              <SettingRow key={role.slug} label={role.label} description={role.description} htmlFor={`drop-${role.slug}`}>
                <Switch
                  id={`drop-${role.slug}`}
                  checked={dropRoles.includes(role.slug)}
                  onCheckedChange={() => toggle(dropRoles, role.slug, setDropRoles)}
                />
              </SettingRow>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Who can triage pins</CardTitle>
            </div>
            <CardDescription>These people open the Pins inbox, assign, and close reports.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {ROLES.map((role) => (
              <SettingRow key={role.slug} label={role.label} description={role.description} htmlFor={`triage-${role.slug}`}>
                <Switch
                  id={`triage-${role.slug}`}
                  checked={triageRoles.includes(role.slug)}
                  onCheckedChange={() => toggle(triageRoles, role.slug, setTriageRoles)}
                />
              </SettingRow>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">How dropping a pin works</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1. Click the pin button. The form hides so you can see the real page.</p>
          <p>2. Click where the problem is. That marker is printed onto the screenshot.</p>
          <p>3. Add a title and send it. Pin element works the same way — the form closes first so you can click the control.</p>
        </CardContent>
      </Card>
    </div>
  );
}
