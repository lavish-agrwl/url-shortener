const { checkRateLimit } = require('../src/services/rateLimiter');

/** Simple mock Redis client with pipeline support */
class MockPipeline {
  constructor(zcardCount, shouldError = false) {
    this.zcardCount = zcardCount;
    this.shouldError = shouldError;
  }
  zremrangebyscore() { return this; }
  zadd() { return this; }
  zcard() { return this; }
  expire() { return this; }
  async exec() {
    if (this.shouldError) {
      throw new Error('Redis error');
    }
    // Return placeholder arrays; index 2 corresponds to zcard result
    return [
      [null, 0], // zremrangebyscore
      [null, 0], // zadd
      [null, this.zcardCount], // zcard
      [null, undefined], // expire
    ];
  }
}

function createMockRedis(zcardCount, shouldError = false) {
  return {
    pipeline() {
      return new MockPipeline(zcardCount, shouldError);
    },
  };
}

describe('Rate limiter', () => {
  const fixedNow = new Date('2026-07-08T12:00:00.000Z');

  test('allows request when count under limit', async () => {
    const redis = createMockRedis(2);
    const result = await checkRateLimit(redis, '1.2.3.4', 'shorten', 10, fixedNow);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(8);
    expect(result.resetAt).toBe(fixedNow.getTime() + 60 * 1000);
  });

  test('blocks request when count exceeds limit', async () => {
    const redis = createMockRedis(12);
    const result = await checkRateLimit(redis, '1.2.3.4', 'shorten', 10, fixedNow);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBe(fixedNow.getTime() + 60 * 1000);
  });

  test('fails open (allows) on Redis error', async () => {
    const redis = createMockRedis(0, true);
    const result = await checkRateLimit(redis, '1.2.3.4', 'shorten', 10, fixedNow);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
  });
});
