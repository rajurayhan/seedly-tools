import { describe, expect, it } from 'vitest';
import { TokenBucket } from '../rateLimit';

describe('TokenBucket', () => {
  it('allows the first request immediately', () => {
    const bucket = new TokenBucket(2, 10_000, () => 1_000);
    expect(bucket.waitMs()).toBe(0);
    bucket.take();
    expect(bucket.waitMs()).toBe(0);
  });

  it('waits when the burst window is full', () => {
    let now = 10_000;
    const bucket = new TokenBucket(2, 10_000, () => now);
    bucket.take();
    bucket.take();
    expect(bucket.waitMs()).toBe(10_000);
    now = 15_000;
    expect(bucket.waitMs()).toBe(5_000);
    now = 20_000;
    expect(bucket.waitMs()).toBe(0);
  });
});
