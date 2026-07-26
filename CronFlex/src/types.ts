// CronFlex Types: Created by moaaz yahia zakaria (من صنع معاذ يحيى زكريا)

export interface TaskOptions {
  id?: string;
  baseId?: string;
  priority?: number | ((task: Task) => number);
  delay?: number;
  ttl?: number;
  debounceInterval?: number;
  throttleInterval?: number;
  timeout?: number;
  warningTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number | ((attempt: number) => number);
  fallback?: () => Promise<any> | any;
  isPeriodic?: boolean;
  periodInterval?: number;
  group?: string;
  tags?: string[];
  registerName?: string;
  dependencies?: string[];
  [key: string]: any;
}

export type TaskExecuteFn = (...args: any[]) => Promise<any> | any;

export interface Task {
  options: TaskOptions;
  execute: TaskExecuteFn & { isPlaceholder?: boolean };
  status: "idle" | "running" | "completed" | "failed" | "expired";
  currentAttempts: number;
  enqueueTime: number;
  controller?: AbortController;
  registerName?: string;
  args?: any[];
  [key: string]: any;
}

export interface TaskPulseOptions {
  concurrency?: number;
  rateMax?: number;
  rateWindow?: number;
  persist?: boolean;
  saveState?: (state: any[]) => Promise<void> | void;
  loadState?: () => Promise<any[]> | any[];
  agingRate?: number;
  historyLimit?: number;
  redisUrl?: string;
  redis?: any;
  redisKey?: string;
}

export interface HistoryItem {
  id: string;
  status: string;
  error: string | null;
  duration: number;
  timestamp: number;
}

export interface MetricsStats {
  avgRuntimeMs: number;
  avgLatencyMs: number;
  successRatePercent: number;
  totalSuccess: number;
  totalFail: number;
}

export interface MetricsResult {
  queue: number;
  running: number;
  completed: number;
  failed: number;
  tokens: number;
  isPaused: boolean;
  stats: MetricsStats;
}

export type EventCallback = (...args: any[]) => void;
