// CronFlex Rate Limiter: Created by moaaz yahia zakaria (من صنع معاذ يحيى زكريا)

export class RateLimiter {
  public limit: number;
  public window: number;
  public tokens: number;
  public debounceMap: Map<string, number>;
  public throttleMap: Map<string, number>;

  constructor(limit: number, window: number) {
    this.limit = limit;
    this.window = window;
    this.tokens = 0;
    this.debounceMap = new Map();
    this.throttleMap = new Map();
  }

  public resetTokens(): void {
    this.tokens = 0;
  }

  public isRateLimited(): boolean {
    return this.tokens >= this.limit;
  }

  public consume(): void {
    this.tokens++;
  }

  public checkDebounce(key: string, interval: number): boolean {
    const now = Date.now();
    const last = this.debounceMap.get(key) || 0;
    if (now - last < interval) {
      return true;
    }
    this.debounceMap.set(key, now);
    return false;
  }

  public checkThrottle(key: string, interval: number): boolean {
    const now = Date.now();
    const last = this.throttleMap.get(key) || 0;
    if (now - last < interval) {
      return true;
    }
    this.throttleMap.set(key, now);
    return false;
  }

  public cleanMaps(): void {
    const now = Date.now();
    for (const [key, time] of this.debounceMap.entries()) {
      if (now - time > 60000) this.debounceMap.delete(key);
    }
    for (const [key, time] of this.throttleMap.entries()) {
      if (now - time > 60000) this.throttleMap.delete(key);
    }
  }
}
