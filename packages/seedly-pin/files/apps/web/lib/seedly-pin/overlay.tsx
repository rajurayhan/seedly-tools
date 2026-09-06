'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { Camera, MousePointer2, X } from 'lucide-react';
import { Button, Input, Label, Textarea, toast } from '@seedly-crm/ui';
import { AnnotateCanvas, type AnnotateShape } from './capture/annotate';
import { createCaptureSession } from './capture/collectors';
import { pickElement, pickPinPoint, pinPointForElement } from './capture/element';
import { capturePageMetadata, type PinnedElement } from './capture/metadata';
import {
  captureViewport,
  captureViewportWithPin,
  stampPinOnCapture,
  type CaptureBlob,
  type PinPoint,
} from './capture/screenshot';

const createPinRef = makeFunctionReference<'mutation'>('seedlyPin/api:createPin');
const uploadUrlRef = makeFunctionReference<'mutation'>('seedlyPin/api:generateUploadUrl');

type Props = {
  open: boolean;
  onClose: () => void;
};

type Phase = 'placing' | 'picking' | 'capturing' | 'form';

const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'] as const;

function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function SeedlyPinOverlay({ open, onClose }: Props) {
  const createPin = useMutation(createPinRef);
  const generateUploadUrl = useMutation(uploadUrlRef);
  const [phase, setPhase] = useState<Phase>('placing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('medium');
  const [screenshot, setScreenshot] = useState<CaptureBlob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [element, setElement] = useState<PinnedElement | null>(null);
  const [pinPoint, setPinPoint] = useState<PinPoint | null>(null);
  const [annotations, setAnnotations] = useState<AnnotateShape[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<ReturnType<typeof createCaptureSession> | null>(null);
  const previewRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const applyCapture = (blob: CaptureBlob | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = blob ? URL.createObjectURL(blob.blob) : null;
    previewRef.current = url;
    setScreenshot(blob);
    setPreview(url);
  };

  useEffect(() => {
    if (!open) return;
    const session = createCaptureSession();
    sessionRef.current = session;
    document.documentElement.setAttribute('data-seedly-pin-open', '');
    setTitle('');
    setDescription('');
    setPriority('medium');
    setElement(null);
    setPinPoint(null);
    setAnnotations([]);
    applyCapture(null);
    setPhase('placing');
    let cancelled = false;

    void (async () => {
      await afterPaint();
      if (cancelled) return;
      const point = await pickPinPoint();
      if (cancelled) return;
      if (!point) {
        onCloseRef.current();
        return;
      }
      setPinPoint(point);
      setPhase('capturing');
      await afterPaint();
      if (cancelled) return;
      const shot = await captureViewportWithPin(point);
      if (cancelled) return;
      applyCapture(shot);
      setPhase('form');
    })();

    return () => {
      cancelled = true;
      session.stop();
      sessionRef.current = null;
      document.documentElement.removeAttribute('data-seedly-pin-open');
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
    };
  }, [open]);

  if (!open) return null;

  if (phase !== 'form') {
    return phase === 'capturing' ? (
      <div
        data-seedly-pin="hint"
        className="fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs text-background shadow-lg"
      >
        Capturing…
      </div>
    ) : null;
  }

  const upload = async (file: CaptureBlob) => {
    const url = await generateUploadUrl();
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.mimeType }, body: file.blob });
    if (!res.ok) throw new Error('Upload failed');
    const json = (await res.json()) as { storageId: string };
    return {
      storageId: json.storageId,
      type: file.mimeType.startsWith('video/') ? 'video' : 'screenshot',
      filename: file.filename,
      mimeType: file.mimeType,
      sizeBytes: file.blob.size,
      width: file.width,
      height: file.height,
    } as const;
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const files = [];
      if (screenshot) files.push(await upload(screenshot));
      const snap = sessionRef.current?.snapshot() ?? {};
      await createPin({
        title,
        description,
        priority,
        source: 'capture',
        annotations,
        metadata: capturePageMetadata({
          ...snap,
          pinnedElement: element ?? undefined,
          pinPoint: pinPoint ?? undefined,
          source: 'capture',
        }),
        files,
      });
      toast('Pin dropped');
      onClose();
    } catch (err) {
      toast.error('Could not drop pin', {
        description: err instanceof Error ? err.message : 'Try again',
      });
    } finally {
      setBusy(false);
    }
  };

  const retakeScreenshot = async () => {
    setPhase('capturing');
    await afterPaint();
    const shot = await captureViewport();
    const stamped = shot && pinPoint ? await stampPinOnCapture(shot, pinPoint) : shot;
    applyCapture(stamped);
    setPhase('form');
  };

  const pinAnElement = async () => {
    setPhase('picking');
    await afterPaint();
    const next = await pickElement();
    if (!next) {
      setPhase('form');
      return;
    }
    const point = pinPointForElement(next);
    setElement(next);
    if (point) setPinPoint(point);
    setPhase('capturing');
    await afterPaint();
    const shot = point ? await captureViewportWithPin(point) : await captureViewport();
    applyCapture(shot);
    setPhase('form');
  };

  return (
    <div
      data-seedly-pin="overlay"
      className="fixed inset-0 z-[80] flex items-end justify-end bg-black/40 p-4 sm:items-center sm:justify-center"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Drop a pin</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">The pin is printed on the screenshot so triage can see where you clicked.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="seedly-pin-title">Title</Label>
            <Input id="seedly-pin-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What broke?" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seedly-pin-desc">Description</Label>
            <Textarea
              id="seedly-pin-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you expect?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seedly-pin-priority">Priority</Label>
            <select
              id="seedly-pin-priority"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value as (typeof PRIORITIES)[number])}
            >
              {PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          {preview ? (
            <AnnotateCanvas imageUrl={preview} onChange={setAnnotations} />
          ) : (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              No screenshot yet. Take one after you drop the pin.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={pinAnElement}>
              <MousePointer2 className="mr-1.5 h-3.5 w-3.5" />
              Pin element
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={retakeScreenshot}>
              <Camera className="mr-1.5 h-3.5 w-3.5" />
              Take screenshot
            </Button>
          </div>
          {element && (
            <p className="text-xs text-muted-foreground">
              Element: {element.tagName} {element.cssSelector}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={busy || title.trim().length < 4}>
              {busy ? 'Saving…' : 'Drop pin'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
