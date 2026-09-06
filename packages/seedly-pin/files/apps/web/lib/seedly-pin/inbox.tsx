'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { ChevronDown, Columns3, List, MapPin } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@seedly-crm/ui';
import { DataTable, type ColumnDef } from '@/components/shared/data-table';
import { ListPageLayout } from '@/components/shared/list-page-layout';
import { pinFileProxySrc } from './upload';

const listRef = makeFunctionReference<'query'>('seedlyPin/api:listPins');
const getRef = makeFunctionReference<'query'>('seedlyPin/api:getPin');
const statsRef = makeFunctionReference<'query'>('seedlyPin/api:getStats');
const updateRef = makeFunctionReference<'mutation'>('seedlyPin/api:updatePin');
const noteRef = makeFunctionReference<'mutation'>('seedlyPin/api:addNote');
const assignableRef = makeFunctionReference<'query'>('seedlyPin/api:listAssignableUsers');
const availabilityRef = makeFunctionReference<'query'>('seedlyPin/api:getAvailability');

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'] as const;

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  open: 'default',
  in_progress: 'secondary',
  resolved: 'outline',
  closed: 'secondary',
};

const PRIORITY_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  lowest: 'outline',
  low: 'secondary',
  medium: 'secondary',
  high: 'default',
  highest: 'destructive',
};

type PinRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
};

function prettyLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

const pinColumns: ColumnDef<PinRow>[] = [
  {
    key: 'title',
    header: 'Title',
    type: 'custom',
    render: (row) => <span className="truncate text-xs font-medium text-foreground">{row.title}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    type: 'badge',
    width: '130px',
    variantMap: STATUS_VARIANT,
    formatLabel: prettyLabel,
  },
  {
    key: 'priority',
    header: 'Priority',
    type: 'badge',
    width: '110px',
    variantMap: PRIORITY_VARIANT,
    formatLabel: prettyLabel,
  },
  {
    key: 'assignee',
    header: 'Assignee',
    type: 'text',
  },
];

function toPinRow(pin: Record<string, unknown>): PinRow {
  return {
    id: String(pin._id),
    title: String(pin.title ?? ''),
    status: String(pin.status ?? ''),
    priority: String(pin.priority ?? ''),
    assignee: (pin.assignee as { name?: string } | null)?.name ?? 'Unassigned',
  };
}

export function SeedlyPinInbox() {
  const availability = useQuery(availabilityRef);
  const router = useRouter();
  const params = useParams();
  const locationId = String(params?.locationId ?? '');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'board'>('list');
  const pins = useQuery(listRef, { status: status || undefined, search: search || undefined });
  const stats = useQuery(statsRef);
  const rows = useMemo(() => (pins ?? []).map(toPinRow), [pins]);

  if (availability && !availability.canTriage) {
    return (
      <ListPageLayout icon={MapPin} title="Pins" description="Pins in this location." hideSearch>
        <EmptyState icon={MapPin} title="You cannot triage pins" description="Your role can drop pins, but it cannot open this inbox." />
      </ListPageLayout>
    );
  }
  if (availability && !availability.enabled) {
    return (
      <ListPageLayout icon={MapPin} title="Pins" description="Pins in this location." hideSearch>
        <EmptyState
          icon={MapPin}
          title="Pins is turned off"
          description="An agency owner can enable it under Settings → Pins."
        />
      </ListPageLayout>
    );
  }

  return (
    <ListPageLayout
      icon={MapPin}
      title="Pins"
      description={`${stats?.total ?? 0} in this location`}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search pins..."
      filters={
        <Select value={status || '__all__'} onValueChange={(value) => setStatus(value === '__all__' ? '' : value)}>
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {prettyLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      activeFilterCount={status ? 1 : 0}
      onClearFilters={() => setStatus('')}
      toolbarActions={
        <div className="flex items-center">
          <Button
            type="button"
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 rounded-r-none"
            aria-label="List view"
            onClick={() => setView('list')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={view === 'board' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 rounded-l-none"
            aria-label="Board view"
            onClick={() => setView('board')}
          >
            <Columns3 className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      {view === 'board' ? (
        <Board pins={pins ?? []} locationId={locationId} />
      ) : (
        <DataTable
          tableLabel="Pins"
          data={rows}
          columns={pinColumns}
          isLoading={pins === undefined}
          onRowClick={(row) => router.push(`/location/${locationId}/pins/${row.id}`)}
          emptyState={{
            icon: MapPin,
            title: 'No pins yet',
            description: 'Use the bug button to drop a pin on any page in this location.',
          }}
        />
      )}
    </ListPageLayout>
  );
}

function Board({ pins, locationId }: { pins: Array<Record<string, unknown>>; locationId: string }) {
  const router = useRouter();
  const columns = useMemo(
    () =>
      STATUSES.map((status) => ({
        status,
        items: pins.filter((pin) => pin.status === status),
      })),
    [pins],
  );
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {columns.map((col) => (
        <div
          key={col.status}
          className="flex flex-col overflow-hidden rounded-lg"
          style={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border-strong))',
            boxShadow: 'var(--shadow-panel)',
          }}
        >
          <p className="border-b border-border/50 px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {prettyLabel(col.status)}
          </p>
          <div className="space-y-2 p-2">
            {col.items.map((pin) => (
              <button
                key={String(pin._id)}
                type="button"
                onClick={() => router.push(`/location/${locationId}/pins/${String(pin._id)}`)}
                className="w-full rounded-md border border-border bg-background p-2 text-left hover:bg-muted/50"
              >
                <p className="truncate text-xs font-medium">{String(pin.title)}</p>
                <p className="text-2xs text-muted-foreground">{prettyLabel(String(pin.priority))}</p>
              </button>
            ))}
            {col.items.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">None</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SeedlyPinDetail({ pinId }: { pinId: string }) {
  const pin = useQuery(getRef, pinId ? { pinId } : 'skip');
  const assignable = useQuery(assignableRef);
  const update = useMutation(updateRef);
  const addNote = useMutation(noteRef);
  const [note, setNote] = useState('');
  const params = useParams();
  const locationId = String(params?.locationId ?? '');

  if (pin === undefined) {
    return (
      <ListPageLayout icon={MapPin} title="Pin" description="Loading…" hideSearch>
        <DataTable tableLabel="Pin" data={[]} columns={pinColumns} isLoading />
      </ListPageLayout>
    );
  }
  if (!pin) {
    return (
      <ListPageLayout icon={MapPin} title="Pin" description="This pin could not be found." hideSearch>
        <EmptyState icon={MapPin} title="Pin not found" description="It may have been removed." />
      </ListPageLayout>
    );
  }

  const meta = pin.metadata ?? {};
  const files = (pin.files ?? []) as PinFile[];
  const element = meta.pinnedElement as PinnedElementMeta | undefined;
  const pinPoint = meta.pinPoint as { x: number; y: number } | undefined;
  const consoleErrors = (meta.consoleErrors ?? []) as ConsoleRow[];
  const networkErrors = (meta.networkErrors ?? []) as NetworkRow[];
  const activity = (meta.userActivity ?? []) as ActivityRow[];
  const storage = meta.storageKeys as StorageKeysMeta | undefined;
  const annotations = Array.isArray(pin.annotations) ? pin.annotations : [];

  return (
    <ListPageLayout
      icon={MapPin}
      title={pin.title}
      description={meta.url || 'Pin detail'}
      hideSearch
      breadcrumbs={[
        { label: 'Pins', href: `/location/${locationId}/pins` },
        { label: pin.title },
      ]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select
            value={pin.status}
            onValueChange={async (value) => {
              try {
                await update({ pinId, status: value });
              } catch (err) {
                toast.error('Could not update', { description: err instanceof Error ? err.message : '' });
              }
            }}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((item) => (
                <SelectItem key={item} value={item}>
                  {prettyLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pin.priority} onValueChange={async (value) => update({ pinId, priority: value })}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {prettyLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={pin.assignedTo ?? '__none__'}
            onValueChange={async (value) => update({ pinId, assignedTo: value === '__none__' ? null : value })}
          >
            <SelectTrigger className="h-8 w-48">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {(assignable ?? []).map((user: { _id: string; name?: string; email?: string }) => (
                <SelectItem key={user._id} value={user._id}>
                  {user.name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {pin.description && <p className="text-sm">{pin.description}</p>}

        <Card>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-sm">Screenshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-3">
            {files.length === 0 && (
              <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                No screenshot was stored with this pin.
              </p>
            )}
            {files.map((file) => (
              <PinFilePreview key={file._id} file={file} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-sm">Element</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {element ? (
              <MetaList
                rows={[
                  ['Tag', element.tagName],
                  ['Selector', element.cssSelector],
                  ['DOM path', element.domPath],
                  ['Text', element.textSnippet],
                  ['Captured', element.captureMode === 'point' ? 'Under the pin drop' : element.captureMode ?? 'element pick'],
                  [
                    'Box',
                    element.boundingRect
                      ? `${Math.round(element.boundingRect.width)}×${Math.round(element.boundingRect.height)} at ${Math.round(element.boundingRect.x)}, ${Math.round(element.boundingRect.y)}`
                      : undefined,
                  ],
                ]}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                No element was stored with this pin. New drops record the element under the marker automatically.
              </p>
            )}
            {pinPoint && (
              <p className="mt-3 text-xs text-muted-foreground">
                Pin dropped at viewport {Math.round(pinPoint.x)}, {Math.round(pinPoint.y)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-sm">Page</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <MetaList
              rows={[
                ['URL', meta.url],
                ['Title', meta.title],
                ['Referrer', meta.referrer],
                ['Source', meta.source ?? pin.source],
                ['Reporter', pin.reporter?.name || pin.reporter?.email],
                ['Assignee', pin.assignee?.name || pin.assignee?.email || 'Unassigned'],
                ['Created', formatWhen(pin.createdAt)],
                ['Updated', formatWhen(pin.updatedAt)],
                ['Resolved', formatWhen(pin.resolvedAt)],
                ['Captured', formatWhen(meta.timestamp)],
                ['Timezone', meta.timezone],
                ['Page load', typeof meta.pageLoadTime === 'number' ? `${Math.round(meta.pageLoadTime)} ms` : undefined],
                [
                  'Browser',
                  meta.browser
                    ? `${meta.browser.name}${meta.browser.version ? ` ${meta.browser.version}` : ''}`
                    : undefined,
                ],
                ['Device', meta.device ? `${meta.device.type} · ${meta.device.os}` : undefined],
                [
                  'Viewport',
                  meta.viewport
                    ? `${meta.viewport.width}×${meta.viewport.height} @${meta.viewport.devicePixelRatio ?? 1} ${meta.viewport.orientation ?? ''}`
                    : undefined,
                ],
                ['User agent', meta.browser?.userAgent],
              ]}
            />
          </CardContent>
        </Card>

        <DiagnosticSection title="Console" count={consoleErrors.length}>
          {consoleErrors.length === 0 ? (
            <p className="text-xs text-muted-foreground">(none)</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {consoleErrors.map((row, i) => (
                <li key={i} className="break-all">
                  <span className="font-medium">[{row.type}]</span> {row.message}
                  {(row.source || row.line != null) && (
                    <span className="block text-muted-foreground">
                      {row.source}
                      {row.line != null ? `:${row.line}` : ''}
                    </span>
                  )}
                  {row.timestamp && <span className="block text-2xs text-muted-foreground">{formatWhen(row.timestamp)}</span>}
                </li>
              ))}
            </ul>
          )}
        </DiagnosticSection>

        <DiagnosticSection title="Network" count={networkErrors.length}>
          {networkErrors.length === 0 ? (
            <p className="text-xs text-muted-foreground">(none)</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {networkErrors.map((row, i) => (
                <li key={i} className="break-all">
                  <span className="font-medium">
                    {row.method} {row.status}
                  </span>{' '}
                  {row.statusText} {row.url}
                  {row.timestamp && <span className="block text-2xs text-muted-foreground">{formatWhen(row.timestamp)}</span>}
                </li>
              ))}
            </ul>
          )}
        </DiagnosticSection>

        <DiagnosticSection title="Activity" count={activity.length}>
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">(none)</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {activity.map((row, i) => (
                <li key={i} className="break-all">
                  <span className="font-medium">{row.type}</span>
                  {row.text ? ` “${row.text}”` : ''}
                  {row.inputType ? ` (${row.inputType})` : ''}
                  {row.url ? ` ${row.url}` : ''}
                  {row.timestamp && <span className="block text-2xs text-muted-foreground">{formatWhen(row.timestamp)}</span>}
                </li>
              ))}
            </ul>
          )}
        </DiagnosticSection>

        <DiagnosticSection
          title="Storage keys"
          count={(storage?.cookies.length ?? 0) + (storage?.localStorage.length ?? 0) + (storage?.sessionStorage.length ?? 0)}
        >
          <div className="space-y-3 text-xs">
            <KeyGroup label="Cookies" values={storage?.cookies} />
            <KeyGroup label="localStorage" values={storage?.localStorage} />
            <KeyGroup label="sessionStorage" values={storage?.sessionStorage} />
          </div>
        </DiagnosticSection>

        {annotations.length > 0 && (
          <DiagnosticSection title="Annotations" count={annotations.length}>
            <ul className="space-y-1 text-xs">
              {annotations.map((shape: { tool?: string; color?: string; text?: string }, i: number) => (
                <li key={i}>
                  {shape.tool ?? 'mark'}
                  {shape.color ? ` · ${shape.color}` : ''}
                  {shape.text ? ` · ${shape.text}` : ''}
                </li>
              ))}
            </ul>
          </DiagnosticSection>
        )}

        <Card>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-sm">Internal notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            <Label>Internal note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                if (!note.trim()) return;
                await addNote({ pinId, message: note });
                setNote('');
              }}
            >
              Add note
            </Button>
            <ul className="space-y-2 text-sm">
              {(pin.notes ?? []).map((row: { _id: string; message: string; user?: { name?: string }; createdAt?: number }) => (
                <li key={row._id} className="rounded-md border border-border p-2">
                  <p className="text-xs text-muted-foreground">
                    {row.user?.name}
                    {row.createdAt ? ` · ${formatWhen(row.createdAt)}` : ''}
                  </p>
                  {row.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-sm">History</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <ul className="space-y-1 text-xs text-muted-foreground">
              {(pin.history ?? []).map(
                (row: { _id: string; action: string; oldValue?: string; newValue?: string; createdAt?: number }) => (
                  <li key={row._id}>
                    {prettyLabel(row.action)}
                    {row.oldValue ? ` ${row.oldValue} →` : ''} {row.newValue}
                    {row.createdAt ? ` · ${formatWhen(row.createdAt)}` : ''}
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </ListPageLayout>
  );
}

type PinFile = {
  _id: string;
  type: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  url?: string | null;
};

type PinnedElementMeta = {
  tagName?: string;
  cssSelector?: string;
  domPath?: string;
  textSnippet?: string;
  captureMode?: string;
  boundingRect?: { x: number; y: number; width: number; height: number };
};

type ConsoleRow = { type: string; message: string; source?: string; line?: number; timestamp?: string };
type NetworkRow = { method: string; status: number; statusText?: string; url: string; timestamp?: string };
type ActivityRow = { type: string; text?: string; url?: string; inputType?: string; timestamp?: string };
type StorageKeysMeta = { cookies: string[]; localStorage: string[]; sessionStorage: string[] };

function formatWhen(value?: number | string) {
  if (value == null || value === '') return undefined;
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatBytes(n?: number) {
  if (!n) return undefined;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function MetaList({ rows }: { rows: Array<[string, string | undefined | null]> }) {
  const shown = rows.filter(([, value]) => Boolean(value));
  if (shown.length === 0) return <p className="text-xs text-muted-foreground">(none)</p>;
  return (
    <dl className="grid gap-2 text-xs sm:grid-cols-[8rem_minmax(0,1fr)]">
      {shown.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-all font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DiagnosticSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
        <span>
          {title}
          {count != null ? ` (${count})` : ''}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-3 py-2">{children}</div>
    </details>
  );
}

function KeyGroup({ label, values }: { label: string; values?: string[] }) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      {values && values.length > 0 ? (
        <p className="break-all text-muted-foreground">{values.join(', ')}</p>
      ) : (
        <p className="text-muted-foreground">(none)</p>
      )}
    </div>
  );
}

function PinFilePreview({ file }: { file: PinFile }) {
  const src = pinFileProxySrc(file.url);
  return (
    <div className="space-y-2">
      {file.type === 'video' && src ? (
        <video src={src} controls className="max-h-96 w-full rounded-lg border border-border" />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={file.filename || 'Pin screenshot'}
          className="max-h-[32rem] w-full rounded-lg border border-border bg-muted/30 object-contain"
        />
      ) : (
        <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
          {file.filename
            ? `${file.filename} is stored, but the preview URL could not be opened.`
            : 'No preview URL.'}
        </p>
      )}
      <p className="text-2xs text-muted-foreground">
        {[file.filename, file.mimeType, formatBytes(file.sizeBytes), file.width && file.height ? `${file.width}×${file.height}` : null]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  );
}
