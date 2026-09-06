export type CaptureBlob = {
  blob: Blob;
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
};

function canvasToPng(canvas: HTMLCanvasElement): Promise<CaptureBlob | null> {
  return new Promise((resolve) => {
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
  });
}

/** Visible viewport via SVG foreignObject. Overlay nodes with data-seedly-pin are skipped. */
export async function captureViewport(): Promise<CaptureBlob | null> {
  if (typeof document === 'undefined') return null;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-seedly-pin]').forEach((node) => node.remove());
  const html = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden">${html}</div>
    </foreignObject>
  </svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('screenshot failed'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return canvasToPng(canvas);
  } catch {
    return captureViewportFallback(width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
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
  const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : undefined });
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
