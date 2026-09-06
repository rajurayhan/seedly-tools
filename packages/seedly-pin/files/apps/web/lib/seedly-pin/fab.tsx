'use client';

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { Bug, X } from 'lucide-react';
import { SeedlyPinOverlay } from './overlay';

const availabilityRef = makeFunctionReference<'query'>('seedlyPin/api:getAvailability');

const FAB_SIZE = 56;
const FAB_MARGIN = 24;
const EDGE_TAB_HEIGHT = 44;
const DRAG_THRESHOLD = 6;
const FAB_POSITION_KEY = 'seedly-pin-fab-position';

type FabPosition = { x: number; y: number };

function defaultFabPosition(vw: number, vh: number): FabPosition {
  return {
    x: Math.max(0, vw - FAB_SIZE - FAB_MARGIN),
    y: Math.max(0, vh - FAB_SIZE - FAB_MARGIN),
  };
}

function clampFabPosition(pos: FabPosition, vw: number, vh: number): FabPosition {
  return {
    x: Math.min(Math.max(0, pos.x), Math.max(0, vw - FAB_SIZE)),
    y: Math.min(Math.max(0, pos.y), Math.max(0, vh - FAB_SIZE)),
  };
}

function readFabPrefs(): { pos: FabPosition | null; hidden: boolean } {
  try {
    const raw = window.localStorage.getItem(FAB_POSITION_KEY);
    if (!raw) return { pos: null, hidden: false };
    const parsed = JSON.parse(raw) as Partial<FabPosition> & { hidden?: unknown };
    const pos =
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y)
        ? { x: parsed.x, y: parsed.y }
        : null;
    return { pos, hidden: Boolean(parsed.hidden) };
  } catch {
    return { pos: null, hidden: false };
  }
}

function writeFabPrefs(pos: FabPosition, hidden: boolean): void {
  window.localStorage.setItem(FAB_POSITION_KEY, JSON.stringify({ ...pos, hidden }));
}

export function SeedlyPinFab() {
  const availability = useQuery(availabilityRef);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [pos, setPos] = useState<FabPosition | null>(null);
  const [viewportH, setViewportH] = useState(800);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const skipClick = useRef(false);

  useEffect(() => {
    const prefs = readFabPrefs();
    setHidden(prefs.hidden);
    const place = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setViewportH(vh);
      setPos((current) =>
        clampFabPosition(current ?? prefs.pos ?? defaultFabPosition(vw, vh), vw, vh),
      );
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);

  if (!availability?.canDrop) return null;

  const persist = (nextPos: FabPosition | null, nextHidden: boolean) => {
    if (nextPos) writeFabPrefs(nextPos, nextHidden);
  };

  const hideFab = () => {
    setHidden(true);
    persist(pos, true);
  };

  const showFab = () => {
    setHidden(false);
    persist(pos, false);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !pos) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    if (!session.moved && dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
    session.moved = true;
    setDragging(true);
    setPos(
      clampFabPosition(
        { x: session.originX + dx, y: session.originY + dy },
        window.innerWidth,
        window.innerHeight,
      ),
    );
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    if (session.moved) {
      skipClick.current = true;
      setPos((current) => {
        persist(current, hidden);
        return current;
      });
    }
  };

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    setOpen(true);
  };

  const edgeTop = pos
    ? Math.min(Math.max(0, pos.y), Math.max(0, viewportH - EDGE_TAB_HEIGHT))
    : FAB_MARGIN;

  return (
    <>
      {!open && hidden && (
        <button
          type="button"
          data-seedly-pin="fab-tab"
          aria-label="Show pin button"
          title="Show pin button"
          onClick={showFab}
          className="fixed z-[70] flex h-11 w-7 cursor-pointer items-center justify-center rounded-l-lg bg-primary text-primary-foreground shadow-lg hover:opacity-90"
          style={{ right: 0, top: edgeTop }}
        >
          <Bug className="h-4 w-4" />
        </button>
      )}
      {!open && pos && !hidden && (
        <div className="fixed z-[70]" data-seedly-pin="fab-wrap" style={{ left: pos.x, top: pos.y }}>
          <button
            type="button"
            data-seedly-pin="fab"
            aria-label="Drop pin. Drag to move."
            title="Click to drop a pin · Drag to move"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={onClick}
            className={`flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl hover:opacity-90 ${
              dragging ? 'cursor-grabbing scale-105' : 'hover:scale-105'
            }`}
            style={{ touchAction: 'none' }}
          >
            <Bug className="pointer-events-none h-6 w-6" />
          </button>
          <button
            type="button"
            data-seedly-pin="fab-hide"
            aria-label="Hide pin button"
            title="Hide pin button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              hideFab();
            }}
            className="absolute -left-1 -top-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <SeedlyPinOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
