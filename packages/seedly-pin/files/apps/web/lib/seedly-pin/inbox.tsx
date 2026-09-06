'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { Badge, Button, Input, Label, Textarea, toast } from '@seedly-crm/ui';

const listRef = makeFunctionReference<'query'>('seedlyPin/api:listPins');
const getRef = makeFunctionReference<'query'>('seedlyPin/api:getPin');
const statsRef = makeFunctionReference<'query'>('seedlyPin/api:getStats');
const updateRef = makeFunctionReference<'mutation'>('seedlyPin/api:updatePin');
const noteRef = makeFunctionReference<'mutation'>('seedlyPin/api:addNote');
const assignableRef = makeFunctionReference<'query'>('seedlyPin/api:listAssignableUsers');
const availabilityRef = makeFunctionReference<'query'>('seedlyPin/api:getAvailability');

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'] as const;

export function SeedlyPinInbox() {
  const availability = useQuery(availabilityRef);
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'board'>('list');
  const pins = useQuery(listRef, { status: status || undefined, search: search || undefined });
  const stats = useQuery(statsRef);

  if (availability && !availability.canTriage) {
    return <p className="text-sm text-muted-foreground">Your role cannot triage pins.</p>;
  }
  if (availability && !availability.enabled) {
    return <p className="text-sm text-muted-foreground">SeedlyPin is turned off. An agency owner can enable it under Settings → Pins.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pins</h1>
          <p className="text-sm text-muted-foreground">{stats?.total ?? 0} in this location</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setView('list')}>
            List
          </Button>
          <Button type="button" variant={view === 'board' ? 'default' : 'outline'} size="sm" onClick={() => setView('board')}>
            Board
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pins" className="max-w-xs" />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      {view === 'board' ? <Board pins={pins ?? []} /> : <PinTable pins={pins ?? []} />}
    </div>
  );
}

function PinTable({ pins }: { pins: Array<Record<string, unknown>> }) {
  const params = useParams();
  const locationId = String(params?.locationId ?? '');
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="p-2">Title</th>
            <th className="p-2">Status</th>
            <th className="p-2">Priority</th>
            <th className="p-2">Assignee</th>
          </tr>
        </thead>
        <tbody>
          {pins.map((pin) => (
            <tr key={String(pin._id)} className="border-t border-border">
              <td className="p-2">
                <Link className="font-medium underline-offset-2 hover:underline" href={`/location/${locationId}/pins/${pin._id}`}>
                  {String(pin.title)}
                </Link>
              </td>
              <td className="p-2">
                <Badge variant="secondary">{String(pin.status)}</Badge>
              </td>
              <td className="p-2">{String(pin.priority)}</td>
              <td className="p-2">{(pin.assignee as { name?: string } | null)?.name ?? 'Unassigned'}</td>
            </tr>
          ))}
          {pins.length === 0 && (
            <tr>
              <td className="p-4 text-muted-foreground" colSpan={4}>
                No pins yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Board({ pins }: { pins: Array<Record<string, unknown>> }) {
  const params = useParams();
  const locationId = String(params?.locationId ?? '');
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
        <div key={col.status} className="rounded border border-border bg-muted/20 p-2">
          <p className="mb-2 text-xs font-semibold uppercase">{col.status}</p>
          <div className="space-y-2">
            {col.items.map((pin) => (
              <Link
                key={String(pin._id)}
                href={`/location/${locationId}/pins/${pin._id}`}
                className="block rounded border border-border bg-background p-2 text-sm hover:border-primary"
              >
                <p className="font-medium">{String(pin.title)}</p>
                <p className="text-xs text-muted-foreground">{String(pin.priority)}</p>
              </Link>
            ))}
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

  if (pin === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!pin) return <p className="text-sm text-muted-foreground">Pin not found.</p>;

  const screenshot = pin.files?.find((file: { type: string }) => file.type === 'screenshot');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/location/${locationId}/pins`} className="text-xs text-muted-foreground hover:underline">
            ← Pins
          </Link>
          <h1 className="text-xl font-semibold">{pin.title}</h1>
          <p className="text-sm text-muted-foreground">{pin.metadata?.url}</p>
        </div>
        <div className="flex gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={pin.status}
            onChange={async (e) => {
              try {
                await update({ pinId, status: e.target.value });
              } catch (err) {
                toast.error('Could not update', { description: err instanceof Error ? err.message : '' });
              }
            }}
          >
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={pin.priority}
            onChange={async (e) => {
              await update({ pinId, priority: e.target.value });
            }}
          >
            {PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={pin.assignedTo ?? ''}
            onChange={async (e) => {
              await update({ pinId, assignedTo: e.target.value ? e.target.value : null });
            }}
          >
            <option value="">Unassigned</option>
            {(assignable ?? []).map((user: { _id: string; name?: string; email?: string }) => (
              <option key={user._id} value={user._id}>
                {user.name || user.email}
              </option>
            ))}
          </select>
        </div>
      </div>
      {pin.description && <p className="text-sm">{pin.description}</p>}
      {screenshot?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={screenshot.url} alt="Pin screenshot" className="max-h-96 rounded border border-border" />
      )}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-border p-3 text-xs">
          <p className="mb-2 font-semibold">Console</p>
          <ul className="space-y-1">
            {(pin.metadata?.consoleErrors ?? []).slice(0, 12).map((row: { type: string; message: string }, i: number) => (
              <li key={i}>
                [{row.type}] {row.message}
              </li>
            ))}
            {(pin.metadata?.consoleErrors ?? []).length === 0 && <li className="text-muted-foreground">(none)</li>}
          </ul>
        </div>
        <div className="rounded border border-border p-3 text-xs">
          <p className="mb-2 font-semibold">Network</p>
          <ul className="space-y-1">
            {(pin.metadata?.networkErrors ?? []).slice(0, 12).map((row: { method: string; status: number; url: string }, i: number) => (
              <li key={i}>
                {row.method} {row.status} {row.url}
              </li>
            ))}
            {(pin.metadata?.networkErrors ?? []).length === 0 && <li className="text-muted-foreground">(none)</li>}
          </ul>
        </div>
      </section>
      {pin.metadata?.pinnedElement && (
        <p className="text-xs text-muted-foreground">
          Element {pin.metadata.pinnedElement.tagName} {pin.metadata.pinnedElement.cssSelector}
        </p>
      )}
      <section className="space-y-2">
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
          {(pin.notes ?? []).map((row: { _id: string; message: string; user?: { name?: string } }) => (
            <li key={row._id} className="rounded border border-border p-2">
              <p className="text-xs text-muted-foreground">{row.user?.name}</p>
              {row.message}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <p className="mb-2 text-xs font-semibold uppercase">History</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {(pin.history ?? []).map((row: { _id: string; action: string; oldValue?: string; newValue?: string }) => (
            <li key={row._id}>
              {row.action}
              {row.oldValue ? ` ${row.oldValue} →` : ''} {row.newValue}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
