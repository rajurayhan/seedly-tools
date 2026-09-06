'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { Button, Input, Label, Textarea, toast } from '@seedly-crm/ui';
import { AnnotateCanvas, type AnnotateShape } from './capture/annotate';
import { createCaptureSession } from './capture/collectors';
import { pickElement } from './capture/element';
import { capturePageMetadata, type PinnedElement } from './capture/metadata';
import { captureDisplayFrame, captureViewport, recordDisplay, type CaptureBlob } from './capture/screenshot';

const createPinRef = makeFunctionReference<'mutation'>('seedlyPin/api:createPin');
const uploadUrlRef = makeFunctionReference<'mutation'>('seedlyPin/api:generateUploadUrl');

type Props = {
  open: boolean;
  onClose: () => void;
};

const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'] as const;

export function SeedlyPinOverlay({ open, onClose }: Props) {
  const createPin = useMutation(createPinRef);
  const generateUploadUrl = useMutation(uploadUrlRef);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('medium');
  const [screenshot, setScreenshot] = useState<CaptureBlob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [video, setVideo] = useState<CaptureBlob | null>(null);
  const [element, setElement] = useState<PinnedElement | null>(null);
  const [annotations, setAnnotations] = useState<AnnotateShape[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<ReturnType<typeof createCaptureSession> | null>(null);

  useEffect(() => {
    if (!open) return;
    const session = createCaptureSession();
    sessionRef.current = session;
    document.documentElement.setAttribute('data-seedly-pin-open', '');
    captureViewport().then((blob) => {
      setScreenshot(blob);
      if (blob) setPreview(URL.createObjectURL(blob.blob));
    });
    return () => {
      session.stop();
      sessionRef.current = null;
      document.documentElement.removeAttribute('data-seedly-pin-open');
    };
  }, [open]);

  if (!open) return null;

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
      if (video) files.push(await upload(video));
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
          source: 'capture',
        }),
        files,
      });
      toast('Pin dropped');
      onClose();
      setTitle('');
      setDescription('');
    } catch (err) {
      toast.error('Could not drop pin', {
        description: err instanceof Error ? err.message : 'Try again',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-seedly-pin="overlay"
      className="fixed inset-0 z-[80] flex items-end justify-end bg-black/40 p-4 sm:items-center sm:justify-center"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Drop a pin</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="seedly-pin-title">Title</Label>
            <Input id="seedly-pin-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What broke?" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seedly-pin-desc">Description</Label>
            <Textarea
              id="seedly-pin-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you expect?"
            />
          </div>
          <div className="space-y-1">
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
          {preview && <AnnotateCanvas imageUrl={preview} onChange={setAnnotations} />}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const next = await pickElement();
                setElement(next);
              }}
            >
              Pin element
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const frame = await captureDisplayFrame();
                if (frame) {
                  setScreenshot(frame);
                  setPreview(URL.createObjectURL(frame.blob));
                }
              }}
            >
              Screen capture
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const rec = await recordDisplay();
                setVideo(rec);
              }}
            >
              Record video
            </Button>
          </div>
          {element && <p className="text-xs text-muted-foreground">Element: {element.cssSelector}</p>}
          {video && <p className="text-xs text-muted-foreground">Video attached ({Math.round(video.blob.size / 1024)} KB)</p>}
          <div className="flex justify-end gap-2 pt-2">
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
