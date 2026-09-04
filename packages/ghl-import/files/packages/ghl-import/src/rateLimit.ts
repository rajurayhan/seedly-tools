/** GHL burst limit: 100 requests / 10 seconds per app per resource. */

export const GHL_BURST_LIMIT = 100;
export const GHL_BURST_WINDOW_MS = 10_000;
export const GHL_DEFAULT_PAGE_SIZE = 100;

export class TokenBucket {
  private timestamps: number[] = [];

  constructor(
    private readonly limit = GHL_BURST_LIMIT,
    private readonly windowMs = GHL_BURST_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Milliseconds to wait before the next request is allowed. */
  waitMs(): number {
    const now = this.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    if (this.timestamps.length < this.limit) return 0;
    const oldest = this.timestamps[0];
    if (oldest === undefined) return 0;
    return this.windowMs - (now - oldest);
  }

  take(): void {
    this.timestamps.push(this.now());
  }
}

export async function sleep(ms: number, sleeper: (ms: number) => Promise<void> = defaultSleep) {
  if (ms <= 0) return;
  await sleeper(ms);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
