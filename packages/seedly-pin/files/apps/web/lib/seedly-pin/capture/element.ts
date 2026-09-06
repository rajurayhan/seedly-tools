import type { PinnedElement } from './metadata';

export function cssSelectorFor(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && parts.length < 6) {
    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
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

export function describeElement(el: Element): PinnedElement {
  const rect = el.getBoundingClientRect();
  return {
    cssSelector: cssSelectorFor(el),
    domPath: cssSelectorFor(el),
    tagName: el.tagName.toLowerCase(),
    textSnippet: (el.textContent ?? '').trim().slice(0, 120) || undefined,
    boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    captureMode: 'element',
  };
}

export function pickElement(): Promise<PinnedElement | null> {
  return new Promise((resolve) => {
    const highlight = document.createElement('div');
    highlight.setAttribute('data-seedly-pin', 'picker');
    highlight.style.cssText =
      'position:fixed;pointer-events:none;z-index:2147483000;border:2px solid #2563eb;background:rgba(37,99,235,0.12);';
    document.body.appendChild(highlight);

    const move = (event: MouseEvent) => {
      const el = document.elementFromPoint(event.clientX, event.clientY);
      if (!el || el === highlight) return;
      const rect = el.getBoundingClientRect();
      highlight.style.left = `${rect.left}px`;
      highlight.style.top = `${rect.top}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
    };

    const finish = (value: PinnedElement | null) => {
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
      highlight.remove();
      resolve(value);
    };

    const click = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const el = document.elementFromPoint(event.clientX, event.clientY);
      if (!el || el === highlight) {
        finish(null);
        return;
      }
      finish(describeElement(el));
    };

    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(null);
    };

    document.addEventListener('mousemove', move, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
  });
}
