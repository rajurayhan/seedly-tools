export type CaptureBlob = {
  blob: Blob;
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
};

export type PinPoint = { x: number; y: number };

export const PIN_MARKER = {
  color: '#e11d48',
  inner: '#ffffff',
  headRadius: 12,
  headOffsetY: 25,
  innerRadius: 5,
} as const;

function canvasToPng(canvas: HTMLCanvasElement): Promise<CaptureBlob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          resolve({
            blob,
            filename: `pin-${Date.now()}.png`,
            mimeType: 'image/png',
            width: canvas.width,
            height: canvas.height,
          });
        },
        'image/png',
        0.92,
      );
    } catch {
      resolve(null);
    }
  });
}

function isCaptureChrome(node: Node): boolean {
  return node instanceof Element && Boolean(node.closest('[data-seedly-pin]'));
}

function isCrossOriginMedia(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  if (node.tagName !== 'IMG' && node.tagName !== 'VIDEO' && node.tagName !== 'SOURCE') return false;
  const src = node.getAttribute('src') || '';
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return false;
  try {
    return new URL(src, window.location.href).origin !== window.location.origin;
  } catch {
    return true;
  }
}

function shouldSkipCaptureNode(node: Node): boolean {
  return isCaptureChrome(node) || isCrossOriginMedia(node);
}

function firstResolved<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

function pageBackground(): string {
  if (typeof document === 'undefined') return '#ffffff';
  const bg = getComputedStyle(document.body).backgroundColor;
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return '#ffffff';
  return bg;
}

async function loadToBlob(): Promise<
  | ((node: HTMLElement, options?: Record<string, unknown>) => Promise<Blob | null>)
  | null
> {
  try {
    const mod = await import('html-to-image');
    return typeof mod.toBlob === 'function' ? mod.toBlob : null;
  } catch {
    return null;
  }
}

export function drawPinMarker(ctx: CanvasRenderingContext2D, point: PinPoint, scale = 1) {
  const x = point.x;
  const y = point.y;
  const r = PIN_MARKER.headRadius * scale;
  const hy = y - PIN_MARKER.headOffsetY * scale;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 8 * scale;
  ctx.shadowOffsetY = 2 * scale;
  ctx.fillStyle = PIN_MARKER.color;
  ctx.beginPath();
  ctx.arc(x, hy, r, Math.PI * 0.82, Math.PI * 0.18, false);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = PIN_MARKER.inner;
  ctx.beginPath();
  ctx.arc(x, hy, PIN_MARKER.innerRadius * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('pin image failed'));
    };
    image.src = url;
  });
}

/** Draw the dropped pin onto an already-captured viewport PNG. */
export async function stampPinOnCapture(capture: CaptureBlob, point: PinPoint): Promise<CaptureBlob> {
  if (typeof document === 'undefined') return capture;
  try {
    const image = await blobToImage(capture.blob);
    const canvas = document.createElement('canvas');
    canvas.width = image.width || capture.width || window.innerWidth;
    canvas.height = image.height || capture.height || window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return capture;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / (capture.width || window.innerWidth || canvas.width);
    const scaleY = canvas.height / (capture.height || window.innerHeight || canvas.height);
    const scale = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
    drawPinMarker(ctx, { x: point.x * scaleX, y: point.y * scaleY }, scale);
    return (await canvasToPng(canvas)) ?? capture;
  } catch {
    return capture;
  }
}

/** Visible viewport. Overlay nodes with data-seedly-pin are skipped. */
export async function captureViewport(): Promise<CaptureBlob | null> {
  if (typeof document === 'undefined' || !document.body) return null;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const toBlob = await loadToBlob();
  if (toBlob) {
    try {
      const blob = await firstResolved(
        toBlob(document.body, {
          width,
          height,
          pixelRatio: 1,
          cacheBust: true,
          skipFonts: true,
          backgroundColor: pageBackground(),
          filter: (node: Node) => !shouldSkipCaptureNode(node),
        }),
        4000,
      );
      if (blob) {
        return {
          blob,
          filename: `pin-${Date.now()}.png`,
          mimeType: blob.type || 'image/png',
          width,
          height,
        };
      }
    } catch {
      // Cross-origin paint can still fail; fall back to a clean card.
    }
  }
  return captureViewportFallback(width, height);
}

export async function captureViewportWithPin(point: PinPoint): Promise<CaptureBlob | null> {
  const shot = await captureViewport();
  if (!shot) return null;
  return stampPinOnCapture(shot, point);
}

function captureViewportFallback(width: number, height: number): Promise<CaptureBlob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#f9fafb';
  ctx.font = '16px sans-serif';
  ctx.fillText(document.title || 'SeedlyPin', 24, 40);
  ctx.fillText(location.href, 24, 68);
  return canvasToPng(canvas);
}

export async function captureDisplayFrame(): Promise<CaptureBlob | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) return null;
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const track = stream.getVideoTracks()[0];
  if (!track) return null;
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  await video.play();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || window.innerWidth;
  canvas.height = video.videoHeight || window.innerHeight;
  canvas.getContext('2d')?.drawImage(video, 0, 0);
  track.stop();
  stream.getTracks().forEach((item) => item.stop());
  return canvasToPng(canvas);
}

export async function recordDisplay(maxMs = 30_000): Promise<CaptureBlob | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) return null;
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : undefined,
  });
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start();
  const timeout = window.setTimeout(() => {
    if (recorder.state !== 'inactive') recorder.stop();
  }, maxMs);
  stream.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (recorder.state !== 'inactive') recorder.stop();
  });
  await stopped;
  window.clearTimeout(timeout);
  stream.getTracks().forEach((track) => track.stop());
  const blob = new Blob(chunks, { type: 'video/webm' });
  if (!blob.size) return null;
  return { blob, filename: `pin-${Date.now()}.webm`, mimeType: 'video/webm' };
}
