'use client';

import { useMemo, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { Building2, ChevronRight, KeyRound, MapPin } from 'lucide-react';
import type { Id } from '../../../../../../../../convex/_generated/dataModel';
import { Alert, Badge, Button, Input, Label, toast } from '@seedly-crm/ui';
import { CopyButton } from '@/components/shared/copy-button';
import { getDashboardErrorMessage } from '@/lib/get-error-message';
import {
  GHL_ENTITIES,
  GHL_SCOPE_GROUPS,
  GHL_READ_SCOPES,
  MANUAL_FOLLOW_UPS,
  formatScopeChecklist,
  type GhlEntityId,
  type GhlScopeGroup,
} from '@seedly-crm/ghl-import';

const getConnectionRef = makeFunctionReference<'query'>('ghlImport/api:getConnection');
const listJobsRef = makeFunctionReference<'query'>('ghlImport/api:listJobs');
const catalogRef = makeFunctionReference<'query'>('ghlImport/api:catalog');
const getJobRef = makeFunctionReference<'query'>('ghlImport/api:getJob');
const destUsersRef = makeFunctionReference<'query'>('ghlImport/api:listDestinationUsers');
const destPipesRef = makeFunctionReference<'query'>('ghlImport/api:listDestinationPipelines');
const validateTokenRef = makeFunctionReference<'action'>('actions/ghl:validateToken');
const connectRef = makeFunctionReference<'action'>('actions/ghl:connect');
const preflightRef = makeFunctionReference<'action'>('actions/ghl:preflight');
const prepareReviewRef = makeFunctionReference<'mutation'>('ghlImport/api:prepareReview');
const approveImportRef = makeFunctionReference<'mutation'>('ghlImport/api:approveImport');
const pauseJobRef = makeFunctionReference<'mutation'>('ghlImport/api:pauseJob');
const resumeJobRef = makeFunctionReference<'mutation'>('ghlImport/api:resumeJob');
const cancelJobRef = makeFunctionReference<'mutation'>('ghlImport/api:cancelJob');
const disconnectRef = makeFunctionReference<'mutation'>('ghlImport/api:disconnect');
const rollbackJobRef = makeFunctionReference<'mutation'>('ghlImport/api:rollbackJob');

type WizardStep = 'connect' | 'preflight' | 'map' | 'select' | 'run' | 'done';

type DestUser = { _id: Id<'users'>; email: string; name: string };

export function GhlImportHub() {
  const connection = useQuery(getConnectionRef);
  const jobs = useQuery(listJobsRef);
  const catalog = useQuery(catalogRef);
  const destUsers = useQuery(destUsersRef);
  const destPipes = useQuery(destPipesRef);
  const validateToken = useAction(validateTokenRef);
  const connect = useAction(connectRef);
  const preflight = useAction(preflightRef);
  const prepareReview = useMutation(prepareReviewRef);
  const approveImport = useMutation(approveImportRef);
  const pauseJob = useMutation(pauseJobRef);
  const resumeJob = useMutation(resumeJobRef);
  const cancelJob = useMutation(cancelJobRef);
  const disconnect = useMutation(disconnectRef);
  const rollbackJob = useMutation(rollbackJobRef);

  const latestJobId = jobs?.[0]?._id as Id<'ghlImportJobs'> | undefined;
  const latestJob = useQuery(getJobRef, latestJobId ? { jobId: latestJobId } : 'skip');

  const [step, setStep] = useState<WizardStep>(connection ? 'preflight' : 'connect');
  const [token, setToken] = useState('');
  const [locationId, setLocationId] = useState('');
  const [validating, setValidating] = useState(false);
  const [kind, setKind] = useState<'location' | 'agency' | null>(null);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [counts, setCounts] = useState<Record<string, number | string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<GhlEntityId[]>(
    (catalog?.defaultSelected as GhlEntityId[] | undefined) ??
      GHL_ENTITIES.filter((e) => e.category !== 'optional').map((e) => e.id),
  );
  const [fieldMapText, setFieldMapText] = useState('');
  const [fallbackUserId, setFallbackUserId] = useState('');
  const [busy, setBusy] = useState(false);
  // Native <details> has no React `defaultOpen`. null = follow connection
  // (open until a token is saved); after the user toggles we keep their choice.
  const [tokenHelpOpen, setTokenHelpOpen] = useState<boolean | null>(null);

  const reviewing =
    latestJob &&
    (latestJob.status === 'reviewing' || latestJob.status === 'awaiting_approval');
  const activeJob =
    latestJob &&
    (latestJob.status === 'running' ||
      latestJob.status === 'paused' ||
      latestJob.status === 'pending' ||
      latestJob.status === 'reviewing')
      ? latestJob
      : null;

  const planSummary = (latestJob?.planSummary ?? null) as {
    create?: number;
    link?: number;
    update?: number;
    reject?: number;
    blockers?: number;
  } | null;
  const blockers = planSummary?.blockers ?? 0;

  const checklist = useMemo(() => formatScopeChecklist(), []);

  async function handleValidate() {
    setValidating(true);
    try {
      const result = await validateToken({
        token,
        locationId: locationId.trim() || undefined,
      });
      setKind(result.kind);
      setLocations(result.locations);
      if (result.kind === 'location' && result.selectedLocation) {
        setSelectedLocation(result.selectedLocation.id);
        setLocationId(result.selectedLocation.id);
      } else if (result.kind === 'agency' && result.locations[0]) {
        setSelectedLocation(result.selectedLocation?.id ?? result.locations[0].id);
      }
      toast.success(
        result.kind === 'agency'
          ? `Agency token works — ${result.locations.length} location(s) found`
          : 'Location token works',
      );
    } catch (err) {
      toast.error(getDashboardErrorMessage(err));
    } finally {
      setValidating(false);
    }
  }

  async function handleConnect() {
    const loc = selectedLocation || locationId.trim();
    if (!kind || !loc) {
      toast.error('Validate the token and choose a location first');
      return;
    }
    setConnecting(true);
    try {
      await connect({
        token,
        locationId: loc,
        locationName: locations.find((l) => l.id === loc)?.name,
        tokenKind: kind,
      });
      setToken('');
      toast.success('GoHighLevel connected');
      setStep('preflight');
    } catch (err) {
      toast.error(getDashboardErrorMessage(err));
    } finally {
      setConnecting(false);
    }
  }

  async function handleScan() {
    setScanning(true);
    try {
      const result = await preflight({});
      setCounts(result.counts);
      setMissing(result.missing);
      setStep('map');
    } catch (err) {
      toast.error(getDashboardErrorMessage(err));
    } finally {
      setScanning(false);
    }
  }

  function parseFieldMap(): Record<string, string> | undefined {
    if (!fieldMapText.trim()) return undefined;
    const mapping: Record<string, string> = {};
    for (const line of fieldMapText.split('\n')) {
      const [from, to] = line.split('=').map((s) => s.trim());
      if (from && to) mapping[from] = to;
    }
    return Object.keys(mapping).length > 0 ? mapping : undefined;
  }

  async function handleDryRun() {
    setBusy(true);
    try {
      await prepareReview({
        selectedEntities: selected,
        mapping: parseFieldMap(),
        entityCounts: counts,
        fallbackUserId: fallbackUserId
          ? (fallbackUserId as Id<'users'>)
          : destUsers?.[0]?._id,
      });
      setStep('run');
      toast.success('Dry-run started — nothing is written yet');
    } catch (err) {
      toast.error(getDashboardErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!latestJob) return;
    setBusy(true);
    try {
      await approveImport({ jobId: latestJob._id });
      toast.success('Import started');
    } catch (err) {
      toast.error(getDashboardErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (connection === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Import</h1>
        <p className="text-sm text-muted-foreground">
          Move a GoHighLevel location into this Seedly location. Review a dry-run, then approve.
        </p>
      </div>

      <details
        className="group overflow-hidden rounded-lg border border-border"
        open={tokenHelpOpen ?? !connection}
        onToggle={(event) => setTokenHelpOpen(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <span className="min-w-0">Where to get a Private Integration Token</span>
          <span className="ml-auto hidden text-xs font-normal text-muted-foreground sm:inline group-open:hidden">
            Location or agency · read-only scopes
          </span>
        </summary>
        <div className="space-y-5 border-t border-border px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-info/10 text-info">
                  <MapPin className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm font-medium">Location token</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Open the GHL location → Settings → Private Integrations. If that page is missing,
                turn it on under Settings → Labs.
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm font-medium">Agency token</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Sign in at the agency level → Settings → Private Integrations. After you paste the
                token here, pick which location to import.
              </p>
            </div>
          </div>

          <ol className="space-y-3">
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                1
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">Create the integration</p>
                <p className="text-sm text-muted-foreground">
                  Click Create new Integration and name it{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                    Seedly CRM import
                  </code>
                  . Tick only the View / Read scopes below.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                2
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">Copy the token immediately</p>
                <p className="text-sm text-muted-foreground">
                  GoHighLevel shows it once. Then copy the Location ID from the browser URL.
                </p>
              </div>
            </li>
          </ol>

          <Alert variant="warning">
            <KeyRound />
            Do not tick Write scopes — Seedly only reads from GoHighLevel.
          </Alert>

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Location ID lives in the URL
            </p>
            <p className="break-all font-mono text-xs leading-relaxed">
              https://app.gohighlevel.com/v2/location/
              <span className="rounded bg-primary/10 px-1 font-semibold text-foreground">
                LOCATION_ID
              </span>
              /...
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Read-only scopes to tick</h3>
              <CopyButton value={checklist} label="Copy list" size="xs" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(GHL_SCOPE_GROUPS) as GhlScopeGroup[]).map((group) => (
                <div
                  key={group}
                  className={`rounded-md border border-border p-3 ${
                    group === 'optional' ? 'sm:col-span-2' : ''
                  }`}
                >
                  <p className="mb-2 text-xs font-semibold">{GHL_SCOPE_GROUPS[group]}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {GHL_READ_SCOPES.filter((s) => s.group === group).map((s) => (
                      <Badge
                        key={s.scope}
                        variant="outline"
                        size="sm"
                        title={`${s.scope} — ${s.purpose}`}
                      >
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>

      {!connection && (
        <section className="rounded-lg border border-border p-5 space-y-4">
          <h2 className="text-sm font-semibold">1. Connect</h2>
          <div className="space-y-2">
            <Label htmlFor="ghl-token">Private Integration Token</Label>
            <Input
              id="ghl-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ghl-loc">Location ID (location tokens)</Label>
            <Input
              id="ghl-loc"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="From the GHL URL"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void handleValidate()} disabled={validating || !token}>
              {validating ? 'Checking…' : 'Validate'}
            </Button>
          </div>
          {kind === 'agency' && locations.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="ghl-pick">GoHighLevel location</Label>
              <select
                id="ghl-pick"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.id})
                  </option>
                ))}
              </select>
            </div>
          )}
          {kind && (
            <Button type="button" onClick={() => void handleConnect()} disabled={connecting}>
              {connecting ? 'Saving…' : 'Connect'}
            </Button>
          )}
        </section>
      )}

      {connection && (
        <section className="rounded-lg border border-border p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Connected</h2>
              <p className="text-sm text-muted-foreground">
                {connection.ghlLocationName ?? connection.ghlLocationId} · {connection.tokenKind}{' '}
                token
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await disconnect({});
                setStep('connect');
                toast.success('Disconnected. Revoke the token in GoHighLevel too.');
              }}
            >
              Disconnect
            </Button>
          </div>
        </section>
      )}

      {connection && (step === 'preflight' || step === 'map' || step === 'select') && (
        <section className="rounded-lg border border-border p-5 space-y-4">
          <h2 className="text-sm font-semibold">2. Scan &amp; map</h2>
          <Button type="button" onClick={() => void handleScan()} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan GHL location'}
          </Button>
          {Object.keys(counts).length > 0 && (
            <ul className="text-sm grid sm:grid-cols-2 gap-1">
              {Object.entries(counts).map(([k, v]) => (
                <li key={k}>
                  <span className="font-medium">{k}</span>:{' '}
                  {v === -1 ? 'records found (paginated)' : String(v)}
                </li>
              ))}
            </ul>
          )}
          {missing.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Missing scopes (those entities will be skipped): {missing.join(', ')}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="ghl-fallback">Fallback owner</Label>
            <select
              id="ghl-fallback"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={fallbackUserId}
              onChange={(e) => setFallbackUserId(e.target.value)}
            >
              <option value="">Current user (default)</option>
              {((destUsers ?? []) as DestUser[]).map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          {(destPipes ?? []).length > 0 && (
            <p className="text-xs text-muted-foreground">
              Destination already has {destPipes?.length} pipeline(s). Same-name pipelines are reused.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="ghl-map">
              Optional field map (one per line: GHL field key = Seedly custom field name)
            </Label>
            <textarea
              id="ghl-map"
              className="w-full min-h-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={fieldMapText}
              onChange={(e) => setFieldMapText(e.target.value)}
              placeholder="cf_city = city"
            />
          </div>
          <Button type="button" variant="outline" onClick={() => setStep('select')}>
            Continue to entity picker
          </Button>
        </section>
      )}

      {connection && step === 'select' && (
        <section className="rounded-lg border border-border p-5 space-y-4">
          <h2 className="text-sm font-semibold">3. Choose what to import</h2>
          <div className="space-y-2">
            {GHL_ENTITIES.map((entity) => {
              const disabled = missing.includes(entity.id);
              return (
                <label key={entity.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={disabled}
                    checked={selected.includes(entity.id)}
                    onChange={(e) => {
                      setSelected((cur) =>
                        e.target.checked
                          ? [...cur, entity.id]
                          : cur.filter((id) => id !== entity.id),
                      );
                    }}
                  />
                  <span>
                    <span className="font-medium">{entity.label}</span>{' '}
                    <span className="text-muted-foreground">
                      ({entity.fidelity}) — {entity.notes}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <Button type="button" onClick={() => void handleDryRun()} disabled={busy || selected.length === 0}>
            {busy ? 'Starting dry-run…' : 'Run dry-run'}
          </Button>
        </section>
      )}

      {(activeJob || reviewing || step === 'run' || latestJob?.status === 'completed') &&
        latestJob && (
          <section className="rounded-lg border border-border p-5 space-y-3">
            <h2 className="text-sm font-semibold">4. Review &amp; import</h2>
            <p className="text-sm">
              Status: <strong>{latestJob.status}</strong>
              {latestJob.currentEntity ? ` · ${latestJob.currentEntity}` : ''}
            </p>
            <p className="text-sm text-muted-foreground">
              Processed {latestJob.processed} · create {latestJob.imported} · link/skip{' '}
              {latestJob.skipped} · update {latestJob.updated}
              {latestJob.rejected !== undefined ? ` · reject ${latestJob.rejected}` : ''}
            </p>
            {planSummary && latestJob.status === 'awaiting_approval' && (
              <p className="text-sm">
                Dry-run: create {planSummary.create ?? 0}, link {planSummary.link ?? 0}, update{' '}
                {planSummary.update ?? 0}, reject {planSummary.reject ?? 0}
                {blockers > 0 ? ` · ${blockers} blocker(s)` : ''}
              </p>
            )}
            {latestJob.errors.length > 0 && (
              <ul className="text-xs text-destructive space-y-1">
                {latestJob.errors.map((err: string) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {latestJob.status === 'awaiting_approval' && (
                <Button
                  type="button"
                  onClick={() => void handleApprove()}
                  disabled={busy || blockers > 0}
                >
                  {busy ? 'Starting…' : 'Approve and import'}
                </Button>
              )}
              {latestJob.status === 'running' && (
                <Button type="button" variant="outline" onClick={() => pauseJob({ jobId: latestJob._id })}>
                  Pause
                </Button>
              )}
              {latestJob.status === 'paused' && (
                <Button type="button" onClick={() => resumeJob({ jobId: latestJob._id })}>
                  Resume
                </Button>
              )}
              {(latestJob.status === 'running' ||
                latestJob.status === 'paused' ||
                latestJob.status === 'reviewing') && (
                <Button type="button" variant="outline" onClick={() => cancelJob({ jobId: latestJob._id })}>
                  Cancel
                </Button>
              )}
              {(latestJob.status === 'completed' || latestJob.status === 'failed') && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => rollbackJob({ jobId: latestJob._id })}
                >
                  Roll back this import
                </Button>
              )}
            </div>
          </section>
        )}

      {latestJob?.status === 'completed' && (
        <section className="rounded-lg border border-border p-5 space-y-3">
          <h2 className="text-sm font-semibold">5. Reconnect these in Seedly</h2>
          <ul className="text-sm space-y-2">
            {MANUAL_FOLLOW_UPS.map((item) => (
              <li key={item.id}>
                <strong>{item.title}.</strong> {item.detail}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
