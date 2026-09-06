'use client';

import { useEffect, useRef, useState } from 'react';

export type AnnotateTool = 'pen' | 'arrow' | 'rect' | 'text' | 'pixelate';

export type AnnotateShape = {
  tool: AnnotateTool;
  color: string;
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
};

type Props = {
  imageUrl: string;
  onChange: (shapes: AnnotateShape[]) => void;
};

export function AnnotateCanvas({ imageUrl, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<AnnotateTool>('pen');
  const [shapes, setShapes] = useState<AnnotateShape[]>([]);
  const draft = useRef<AnnotateShape | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const image = new Image();
    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;
      redraw(ctx, image, shapes);
    };
    image.src = imageUrl;
  }, [imageUrl, shapes]);

  useEffect(() => {
    onChange(shapes);
  }, [shapes, onChange]);

  const commitDraft = () => {
    const next = draft.current;
    draft.current = null;
    if (!isAnnotateShape(next)) return;
    setShapes((prev) => [...prev, next]);
  };

  const point = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  return (
    <div className="space-y-2" data-seedly-pin="annotate">
      <div className="flex flex-wrap gap-2 text-xs">
        {(['pen', 'arrow', 'rect', 'text', 'pixelate'] as AnnotateTool[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded border px-2 py-1 ${tool === item ? 'border-primary bg-primary/10' : 'border-border'}`}
            onClick={() => setTool(item)}
          >
            {item}
          </button>
        ))}
        <button type="button" className="rounded border border-border px-2 py-1" onClick={() => setShapes([])}>
          clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="max-h-80 w-full cursor-crosshair rounded border border-border bg-background"
        onMouseDown={(event) => {
          const p = point(event);
          if (tool === 'text') {
            const text = window.prompt('Annotation text');
            if (text) setShapes((prev) => [...prev, { tool, color: '#ef4444', x: p.x, y: p.y, text }]);
            return;
          }
          draft.current = { tool, color: tool === 'pixelate' ? '#111827' : '#ef4444', points: [p], x: p.x, y: p.y, w: 0, h: 0 };
        }}
        onMouseMove={(event) => {
          if (!draft.current) return;
          const p = point(event);
          if (draft.current.tool === 'pen') {
            draft.current.points = [...(draft.current.points ?? []), p];
          } else {
            draft.current.w = p.x - (draft.current.x ?? 0);
            draft.current.h = p.y - (draft.current.y ?? 0);
          }
        }}
        onMouseUp={commitDraft}
        onMouseLeave={commitDraft}
      />
    </div>
  );
}

export function isAnnotateShape(value: unknown): value is AnnotateShape {
  return Boolean(value && typeof value === 'object' && typeof (value as AnnotateShape).color === 'string' && (value as AnnotateShape).tool);
}

function redraw(ctx: CanvasRenderingContext2D, image: HTMLImageElement, shapes: AnnotateShape[]) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(image, 0, 0);
  for (const shape of shapes) {
    if (!isAnnotateShape(shape)) continue;
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = 3;
    if (shape.tool === 'pen' && shape.points?.length) {
      const start = shape.points[0];
      if (!start) continue;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      shape.points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (shape.tool === 'rect' || shape.tool === 'pixelate') {
      const x = shape.x ?? 0;
      const y = shape.y ?? 0;
      const w = shape.w ?? 0;
      const h = shape.h ?? 0;
      if (shape.tool === 'pixelate') {
        ctx.fillStyle = 'rgba(17,24,39,0.55)';
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.strokeRect(x, y, w, h);
      }
    } else if (shape.tool === 'arrow') {
      const x1 = shape.x ?? 0;
      const y1 = shape.y ?? 0;
      const x2 = x1 + (shape.w ?? 0);
      const y2 = y1 + (shape.h ?? 0);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (shape.tool === 'text' && shape.text) {
      ctx.font = '20px sans-serif';
      ctx.fillText(shape.text, shape.x ?? 0, shape.y ?? 0);
    }
  }
}
