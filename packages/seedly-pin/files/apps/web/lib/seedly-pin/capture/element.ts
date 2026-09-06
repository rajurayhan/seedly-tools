import type { PinnedElement } from './metadata';

export function cssSelectorFor(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && parts.length < 6) {
    const tag = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const same = [...parent.children].filter((child) => child.tagName === node!.tagName);
    const nth = same.indexOf(node) + 1;
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${nth})` : tag);
    node = parent;
  }
  return parts.join(' > ');
}

export function describeElement(el: Element, captureMode: PinnedElement['captureMode'] = 'element'): PinnedElement {
  const rect = el.getBoundingClientRect();
  return {
    cssSelector: cssSelectorFor(el),
    domPath: cssSelectorFor(el),
    tagName: el.tagName.toLowerCase(),
    textSnippet: (el.textContent ?? '').trim().slice(0, 120) || undefined,
    boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    captureMode,
  };
}

export function describeAtPoint(x: number, y: number): PinnedElement | null {
  const el = targetFromPoint(x, y);
  return el ? describeElement(el, 'point') : null;
}

function targetFromPoint(x: number, y: number): Element | null {
  const stack = document.elementsFromPoint(x, y);
  return stack.find((node) => node instanceof Element && !node.closest('[data-seedly-pin]')) ?? null;
}

function mountHint(text: string): HTMLDivElement {
  const hint = document.createElement('div');
  hint.setAttribute('data-seedly-pin', 'hint');
  hint.textContent = text;
  hint.style.cssText =
    'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483001;pointer-events:none;border-radius:999px;padding:8px 14px;font:13px/1.3 system-ui,sans-serif;color:#fff;background:rgba(17,24,39,0.92);box-shadow:0 8px 24px rgba(0,0,0,0.25);';
  document.body.appendChild(hint);
  return hint;
}

export function pickElement(): Promise<PinnedElement | null> {
  return new Promise((resolve) => {
    const hint = mountHint('Click an element to pin · Esc to cancel');
    const highlight = document.createElement('div');
    highlight.setAttribute('data-seedly-pin', 'picker');
    highlight.style.cssText =
      'position:fixed;pointer-events:none;z-index:2147483000;border:2px solid #e11d48;background:rgba(225,29,72,0.12);border-radius:4px;';
    document.body.appendChild(highlight);

    const move = (event: MouseEvent) => {
      const el = targetFromPoint(event.clientX, event.clientY);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      highlight.style.left = `${rect.left}px`;
      highlight.style.top = `${rect.top}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
    };

    const finish = (value: PinnedElement | null) => {
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('pointerdown', click, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
      highlight.remove();
      hint.remove();
      resolve(value);
    };

    const click = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const el = targetFromPoint(event.clientX, event.clientY);
      finish(el ? describeElement(el) : null);
    };

    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(null);
    };

    document.addEventListener('mousemove', move, true);
    document.addEventListener('pointerdown', click, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
  });
}

export function pickPinPoint(): Promise<{ x: number; y: number } | null> {
  return new Promise((resolve) => {
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';
    const hint = mountHint('Click the page to drop a pin · Esc to cancel');
    const ghost = document.createElement('div');
    ghost.setAttribute('data-seedly-pin', 'place-ghost');
    ghost.style.cssText =
      'position:fixed;pointer-events:none;z-index:2147483000;width:28px;height:40px;margin-left:-14px;margin-top:-40px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.28));';
    ghost.innerHTML =
      '<svg viewBox="0 0 28 40" width="28" height="40" aria-hidden="true"><path d="M14 40C14 40 26 24 26 16a12 12 0 1 0-24 0c0 8 12 24 12 24z" fill="#e11d48"/><circle cx="14" cy="15" r="5" fill="#fff"/></svg>';
    document.body.appendChild(ghost);

    const move = (event: MouseEvent) => {
      ghost.style.left = `${event.clientX}px`;
      ghost.style.top = `${event.clientY}px`;
    };

    const finish = (value: { x: number; y: number } | null) => {
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('pointerdown', click, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
      document.body.style.cursor = previousCursor;
      ghost.remove();
      hint.remove();
      resolve(value);
    };

    const click = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      finish({ x: event.clientX, y: event.clientY });
    };

    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(null);
    };

    document.addEventListener('mousemove', move, true);
    document.addEventListener('pointerdown', click, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
  });
}

export function pinPointForElement(el: PinnedElement): { x: number; y: number } | null {
  const rect = el.boundingRect;
  if (!rect) return null;
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
