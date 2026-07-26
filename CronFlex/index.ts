// CronFlex: Created by moaaz yahia zakaria (من صنع معاذ يحيى زكريا)
// 2026
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

export class TaskPulse {
  public queue: Map<string, Task>;
  public completed: Set<string>;
  public deadLetters: Map<string, Task>;
  public registry: Map<
    string,
    { options: TaskOptions; execute: TaskExecuteFn }
  >;
  public running: number;
  public concurrency: number;
  public rateMax: number;
  public rateWindow: number;
  public tokens: number;
  public persist: boolean;
  public saveState?: (state: any[]) => Promise<void> | void;
  public loadState?: () => Promise<any[]> | any[];
  public agingRate: number;
  public isPaused: boolean;
  public beforeHooks: Array<(task: Task) => Promise<void> | void>;
  public afterHooks: Array<(task: Task, result: any) => Promise<void> | void>;
  public history: HistoryItem[];
  public historyLimit: number;
  public stats: {
    totalRuntime: number;
    totalSuccess: number;
    totalFail: number;
    totalLatency: number;
  };
  public debounceMap: Map<string, number>;
  public throttleMap: Map<string, number>;
  public listeners: Record<string, EventCallback[]>;
  public initPromise?: Promise<void>;
  private intervalId: NodeJS.Timeout;
  private isSaving: boolean = false;

  [key: string]: any;

  constructor(opts: TaskPulseOptions = {}) {
    this.queue = new Map();
    this.completed = new Set();
    this.deadLetters = new Map();
    this.registry = new Map();
    this.running = 0;
    this.concurrency = opts.concurrency ?? 3;
    this.rateMax = opts.rateMax ?? 10;
    this.rateWindow = opts.rateWindow ?? 1000;
    this.tokens = 0;
    this.persist = opts.persist ?? false;
    this.saveState = opts.saveState;
    this.loadState = opts.loadState;
    this.agingRate = opts.agingRate ?? 0;

    this.isPaused = false;
    this.beforeHooks = [];
    this.afterHooks = [];
    this.history = [];
    this.historyLimit = opts.historyLimit ?? 50;

    this.stats = {
      totalRuntime: 0,
      totalSuccess: 0,
      totalFail: 0,
      totalLatency: 0,
    };

    this.debounceMap = new Map();
    this.throttleMap = new Map();

    this.listeners = {
      start: [],
      success: [],
      fail: [],
      empty: [],
      progress: [],
      drain: [],
      retry: [],
      expired: [],
      "timeout-warning": [],
    };

    if (this.persist) {
      this.initPromise = this.initPersistence(opts);
      this.initPromise.then(() => {
        this.load().then(() => {
          if (!this.isPaused) this.tick().catch(() => {});
        });
      });
    }

    this.intervalId = setInterval(() => {
      this.tokens = 0;
      this.cleanMaps();
      if (!this.isPaused) {
        this.tick().catch((err) => this.emit("fail", "system", err));
      }
    }, this.rateWindow);

    if (this.intervalId && typeof this.intervalId.unref === "function") {
      this.intervalId.unref();
    }
  }

  private cleanMaps(): void {
    const now = Date.now();
    for (const [key, time] of this.debounceMap.entries()) {
      if (now - time > 60000) this.debounceMap.delete(key);
    }
    for (const [key, time] of this.throttleMap.entries()) {
      if (now - time > 60000) this.throttleMap.delete(key);
    }
  }

  public on(event: string, listener: EventCallback): void {
    if (this.listeners[event]) {
      this.listeners[event].push(listener);
    }
  }

  public emit(event: string, ...args: any[]): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach((fn) => {
        try {
          fn(...args);
        } catch (e) {}
      });
    }
  }

  public enqueue(task: Task): void {
    this.queue.set(task.options.id!, task);
    this.save();
    if (!this.isPaused) {
      this.tick().catch((err) => this.emit("fail", task.options.id!, err));
    }
  }

  public add(
    options: TaskOptions = {},
    execute: TaskExecuteFn,
    extra: Record<string, any> = {},
  ): void {
    if (typeof execute !== "function") return;

    const taskId =
      options.id || `task-${Math.random().toString(36).substring(2, 9)}`;
    const resolvedOptions = { priority: 0, ...options, id: taskId };

    if (this.queue.has(taskId)) return;

    const trackingKey = extra.registerName || resolvedOptions.baseId || taskId;

    if (
      resolvedOptions.debounceInterval &&
      typeof resolvedOptions.debounceInterval === "number"
    ) {
      const now = Date.now();
      const last = this.debounceMap.get(trackingKey) || 0;
      if (now - last < resolvedOptions.debounceInterval) {
        return;
      }
      this.debounceMap.set(trackingKey, now);
    }

    if (
      resolvedOptions.throttleInterval &&
      typeof resolvedOptions.throttleInterval === "number"
    ) {
      const now = Date.now();
      const last = this.throttleMap.get(trackingKey) || 0;
      if (now - last < resolvedOptions.throttleInterval) {
        return;
      }
      this.throttleMap.set(trackingKey, now);
    }

    const task: Task = {
      options: resolvedOptions,
      execute,
      status: "idle",
      currentAttempts: 0,
      enqueueTime: Date.now(),
      ...extra,
    };

    if (resolvedOptions.delay) {
      setTimeout(() => this.enqueue(task), resolvedOptions.delay);
    } else {
      this.enqueue(task);
    }
  }

  public addBatch(
    tasksArray: Array<{ options?: TaskOptions; execute: TaskExecuteFn }>,
  ): void {
    if (!Array.isArray(tasksArray)) return;

    for (const task of tasksArray) {
      if (typeof task.execute !== "function") continue;
      this.add(task.options || {}, task.execute);
    }
  }

  public sequence(
    functionsArray: TaskExecuteFn[],
    baseId: string = "seq",
  ): void {
    if (!Array.isArray(functionsArray)) return;

    let prevId: string | null = null;
    const batch = functionsArray.map((execute, index) => {
      const id = `${baseId}-${Math.random().toString(36).substring(2, 7)}-${index}`;

      const task = {
        options: {
          id,
          priority: 10,
          dependencies: prevId ? [prevId] : [],
        },
        execute,
      };

      prevId = id;
      return task;
    });

    this.addBatch(batch);
  }

  public wrap(
    options: TaskOptions = {},
    fn: (...args: any[]) => any,
  ): (...args: any[]) => Promise<any> {
    return (...args: any[]) => {
      return new Promise((resolve, reject) => {
        const baseId =
          options.id ||
          `wrapped-${Math.random().toString(36).substring(2, 11)}`;
        const taskId = `${baseId}-${Math.random().toString(36).substring(2, 7)}`;

        const taskOptions: TaskOptions = {
          priority: 0,
          ...options,
          id: taskId,
          baseId: baseId,
        };

        const executeWrapper: TaskExecuteFn = (signal, progress) => {
          const safeProgress =
            typeof progress === "function" ? progress : () => {};
          return fn(signal, safeProgress, ...args);
        };

        this.add(taskOptions, executeWrapper, {
          registerName: options.registerName,
          args: args,
        });

        const handleSuccess = (id: string, result: any) => {
          if (id === taskId) {
            cleanup();
            resolve(result);
          }
        };

        const handleFail = (id: string, error: any) => {
          if (id === taskId) {
            cleanup();
            reject(error);
          }
        };

        const cleanup = () => {
          this.listeners.success = this.listeners.success.filter(
            (l) => l !== handleSuccess,
          );
          this.listeners.fail = this.listeners.fail.filter(
            (l) => l !== handleFail,
          );
        };

        this.on("success", handleSuccess);
        this.on("fail", handleFail);
      });
    };
  }

  public control(originalFn: Function, options: TaskOptions = {}): any {
    if (typeof originalFn !== "function") return originalFn;
    return this.wrap(
      {
        id:
          originalFn.name ||
          `task-${Math.random().toString(36).substring(2, 7)}`,
        ...options,
      },
      originalFn as any,
    );
  }

  public register(
    name: string,
    options: TaskOptions | TaskExecuteFn = {},
    execute?: TaskExecuteFn,
  ): void {
    if (typeof name !== "string") {
      throw new Error("Invalid registration arguments: name must be a string");
    }

    let taskOptions: TaskOptions = {};
    let taskExecute: TaskExecuteFn | undefined = execute;

    if (typeof options === "function") {
      taskExecute = options;
      taskOptions = {};
    } else if (options) {
      taskOptions = options;
    }

    if (typeof taskExecute !== "function") {
      throw new Error(
        "Invalid registration arguments: execute must be a function",
      );
    }

    this.registry.set(name, { options: taskOptions, execute: taskExecute });

    this[name] = this.wrap(
      {
        id: name,
        registerName: name,
        ...taskOptions,
      },
      taskExecute,
    );

    for (const [id, task] of this.queue.entries()) {
      if (
        task.registerName === name &&
        task.execute &&
        task.execute.isPlaceholder
      ) {
        const args = task.args || [];
        task.execute = (signal, progress) => {
          const safeProgress =
            typeof progress === "function" ? progress : () => {};
          return taskExecute!(signal, safeProgress, ...args);
        };
        task.execute.isPlaceholder = false;
        if (!this.isPaused) this.tick().catch(() => {});
      }
    }
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
    this.tick().catch(() => {});
  }

  public setConcurrency(n: number): void {
    this.concurrency = n;
    if (!this.isPaused) this.tick().catch(() => {});
  }

  public setRateLimit(max: number, window?: number): void {
    this.rateMax = max;
    if (window !== undefined) {
      this.rateWindow = window;
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => {
        this.tokens = 0;
        this.cleanMaps();
        if (!this.isPaused) {
          this.tick().catch((err) => this.emit("fail", "system", err));
        }
      }, this.rateWindow);
      if (this.intervalId && typeof this.intervalId.unref === "function") {
        this.intervalId.unref();
      }
    }
  }

  public before(fn: (task: Task) => Promise<void> | void): void {
    if (typeof fn === "function") this.beforeHooks.push(fn);
  }

  public after(fn: (task: Task, result: any) => Promise<void> | void): void {
    if (typeof fn === "function") this.afterHooks.push(fn);
  }

  public updatePriority(
    id: string,
    priority: number | ((task: Task) => number),
  ): void {
    const task = this.queue.get(id);
    if (task) {
      task.options.priority = priority;
      if (!this.isPaused) this.tick().catch(() => {});
    }
  }

  public cancelGroup(group: string): void {
    for (const [id, task] of this.queue.entries()) {
      if (task.options.group === group) {
        this.cascadeCancel(id);
      }
    }
    this.save();
  }

  public cancelByTag(tag: string): void {
    for (const [id, task] of this.queue.entries()) {
      if (task.options.tags?.includes(tag)) {
        this.cascadeCancel(id);
      }
    }
    this.save();
  }

  public cascadeCancel(parentId: string): void {
    this.queue.delete(parentId);
    for (const [id, task] of this.queue.entries()) {
      if (task.options.dependencies?.includes(parentId)) {
        this.cascadeCancel(id);
      }
    }
  }

  public retryFailed(id: string): boolean {
    const task = this.deadLetters.get(id);
    if (task) {
      task.status = "idle";
      task.currentAttempts = 0;
      task.enqueueTime = Date.now();
      this.deadLetters.delete(id);
      this.enqueue(task);
      this.emit("retry", task.options.id!);
      return true;
    }
    return false;
  }

  public clearFailed(): void {
    this.deadLetters.clear();
    this.save();
  }

  public getHistory(): HistoryItem[] {
    return this.history;
  }

  public addToHistory(
    id: string,
    status: string,
    error: any = null,
    duration: number = 0,
  ): void {
    this.history.push({
      id,
      status,
      error: error ? error.message : null,
      duration,
      timestamp: Date.now(),
    });
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }
  }

  public clearQueue(): void {
    for (const [id, task] of this.queue.entries()) {
      if (task.status === "idle") {
        this.queue.delete(id);
      }
    }
    this.save();
  }

  public getMermaidGraph(): string {
    let graph = "graph TD\n";
    for (const [id, task] of this.queue.entries()) {
      graph += `  ${id}["${id} (priority: ${typeof task.options.priority === "number" ? task.options.priority : 0})"]\n`;
      if (task.options.dependencies) {
        for (const dep of task.options.dependencies) {
          graph += `  ${dep} --> ${id}\n`;
        }
      }
    }
    return graph;
  }

  public all(promises: Promise<any>[]): Promise<any[]> {
    return Promise.all(promises);
  }

  public race(promises: Promise<any>[]): Promise<any> {
    return Promise.race(promises);
  }

  public static all(promises: Promise<any>[]): Promise<any[]> {
    return Promise.all(promises);
  }

  public static race(promises: Promise<any>[]): Promise<any> {
    return Promise.race(promises);
  }

  public getSortedIdleTasks(): Task[] {
    const now = Date.now();
    return Array.from(this.queue.values())
      .filter((t) => {
        if (t.status !== "idle" || (t.execute && t.execute.isPlaceholder)) {
          return false;
        }

        if (t.options.ttl && now - t.enqueueTime > t.options.ttl) {
          t.status = "expired";
          this.emit("expired", t.options.id!);
          this.fail(
            t,
            new Error(`Task expired: exceeded TTL of ${t.options.ttl}ms`),
          );
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        let priorityA =
          typeof a.options.priority === "function"
            ? a.options.priority(a)
            : a.options.priority || 0;
        let priorityB =
          typeof b.options.priority === "function"
            ? b.options.priority(b)
            : b.options.priority || 0;

        if (this.agingRate) {
          const waitA = now - (a.enqueueTime || now);
          const waitB = now - (b.enqueueTime || now);
          priorityA += waitA * this.agingRate;
          priorityB += waitB * this.agingRate;
        }

        return priorityB - priorityA;
      });
  }

  public async tick(): Promise<void> {
    if (
      this.isPaused ||
      this.running >= this.concurrency ||
      this.tokens >= this.rateMax
    )
      return;

    const sorted = this.getSortedIdleTasks();
    if (sorted.length === 0) {
      if (this.queue.size === 0 && this.running === 0) {
        this.emit("empty");
      }
      return;
    }

    const firstTask = sorted[0];
    const highestPriority =
      typeof firstTask.options.priority === "function"
        ? firstTask.options.priority(firstTask)
        : firstTask.options.priority || 0;

    for (const task of sorted) {
      if (this.running >= this.concurrency || this.tokens >= this.rateMax)
        break;

      const currentPriority =
        typeof task.options.priority === "function"
          ? task.options.priority(task)
          : task.options.priority || 0;

      if (currentPriority < highestPriority && this.running > 0) {
        break;
      }

      if (
        task.options.dependencies?.some((d: string) => !this.completed.has(d))
      ) {
        if (currentPriority === highestPriority) {
          break;
        }
        continue;
      }

      task.status = "running";
      this.running++;
      this.tokens++;

      this.run(task).catch(() => {});
    }
  }

  public async run(task: Task): Promise<void> {
    this.emit("start", task.options.id!);

    const startTime = Date.now();
    const latency = startTime - (task.enqueueTime || startTime);

    const controller = new AbortController();
    task.controller = controller;

    let timeoutId: NodeJS.Timeout | undefined;
    if (task.options.timeout) {
      timeoutId = setTimeout(() => controller.abort(), task.options.timeout);
    }

    let warningTimeoutId: NodeJS.Timeout | undefined;
    if (task.options.warningTimeout) {
      warningTimeoutId = setTimeout(() => {
        this.emit(
          "timeout-warning",
          task.options.id!,
          task.options.warningTimeout!,
        );
      }, task.options.warningTimeout);
    }

    try {
      for (const hook of this.beforeHooks) {
        await hook(task);
      }

      const progress = (percent: number) => {
        this.emit("progress", task.options.id!, percent);
      };

      const result = await task.execute(controller.signal, progress);

      if (timeoutId) clearTimeout(timeoutId);
      if (warningTimeoutId) clearTimeout(warningTimeoutId);

      for (const hook of this.afterHooks) {
        await hook(task, result);
      }

      task.status = "completed";
      this.completed.add(task.options.id!);

      const duration = Date.now() - startTime;
      this.stats.totalSuccess++;
      this.stats.totalRuntime += duration;
      this.stats.totalLatency += latency;

      this.addToHistory(task.options.id!, "completed", null, duration);

      this.emit("success", task.options.id!, result);

      if (task.options.isPeriodic && task.options.periodInterval) {
        setTimeout(() => {
          task.status = "idle";
          task.enqueueTime = Date.now();
          this.enqueue(task);
        }, task.options.periodInterval);
      } else {
        this.queue.delete(task.options.id!);
      }
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      if (warningTimeoutId) clearTimeout(warningTimeoutId);

      task.currentAttempts++;

      const isAborted =
        controller.signal.aborted || error.name === "AbortError";

      if (
        !isAborted &&
        task.options.retryAttempts &&
        task.currentAttempts <= task.options.retryAttempts
      ) {
        task.status = "idle";
        let delay: number;
        if (typeof task.options.retryDelay === "function") {
          delay = task.options.retryDelay(task.currentAttempts);
        } else {
          const baseDelay = task.options.retryDelay ?? 1000;
          delay = baseDelay * Math.pow(2, task.currentAttempts - 1);
        }
        setTimeout(() => {
          if (!this.isPaused) this.tick().catch(() => {});
        }, delay);
      } else if (task.options.fallback) {
        try {
          const fbResult = await task.options.fallback();
          this.emit("success", task.options.id!, {
            fallback: true,
            data: fbResult,
          });
          this.queue.delete(task.options.id!);
        } catch (fbError) {
          this.fail(task, fbError, startTime, latency);
        }
      } else {
        this.fail(task, error, startTime, latency);
      }
    } finally {
      this.running--;
      this.save();

      if (this.queue.size === 0 && this.running === 0) {
        this.emit("drain");
        this.emit("empty");
      }

      this.tick().catch(() => {});
    }
  }

  public fail(
    task: Task,
    error: any,
    startTime: number = Date.now(),
    latency: number = 0,
  ): void {
    task.status = "failed";
    this.deadLetters.set(task.options.id!, task);
    this.queue.delete(task.options.id!);

    const duration = Date.now() - startTime;
    this.stats.totalFail++;
    this.stats.totalRuntime += duration;
    this.stats.totalLatency += latency;

    this.addToHistory(task.options.id!, "failed", error, duration);

    this.emit("fail", task.options.id!, error);
  }

  public abort(id: string): boolean {
    const task = this.queue.get(id);
    if (task && task.controller) {
      task.controller.abort();
      return true;
    }
    return false;
  }

  public async initPersistence(opts: TaskPulseOptions = {}): Promise<void> {
    if (this.saveState && this.loadState) return;

    if (opts.redisUrl || opts.redis) {
      try {
        // @ts-ignore
        const Redis = (await import("ioredis")).default;
        const client = opts.redisUrl
          ? new Redis(opts.redisUrl)
          : new Redis(opts.redis);
        const key = opts.redisKey || "taskpulse_tasks";

        this.saveState = async (state) => {
          await client.set(key, JSON.stringify(state));
        };
        this.loadState = async () => {
          const data = await client.get(key);
          return data ? JSON.parse(data) : [];
        };
        return;
      } catch (e: any) {
        console.warn(
          "TaskPulse: Failed to initialize Redis. Falling back to local storage.",
          e.message,
        );
      }
    }

    if (typeof window !== "undefined" && window.localStorage) {
      this.saveState = (state) => {
        window.localStorage.setItem("taskpulse_tasks", JSON.stringify(state));
      };
      this.loadState = () => {
        try {
          const data = window.localStorage.getItem("taskpulse_tasks");
          return data ? JSON.parse(data) : [];
        } catch (e) {
          return [];
        }
      };
      return;
    }

    if (
      typeof process !== "undefined" &&
      process.versions &&
      process.versions.node
    ) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const filePath = path.join(process.cwd(), "tasks_persist.json");

        this.saveState = (state) => {
          fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
        };
        this.loadState = () => {
          try {
            if (fs.existsSync(filePath)) {
              return JSON.parse(fs.readFileSync(filePath, "utf8"));
            }
          } catch (e) {}
          return [];
        };
        return;
      } catch (e) {}
    }
  }

  public async save(): Promise<void> {
    if (!this.persist || this.isSaving) return;
    if (this.initPromise) await this.initPromise;
    if (typeof this.saveState !== "function") return;

    this.isSaving = true;
    try {
      const serialized = [];
      for (const [id, task] of this.queue.entries()) {
        serialized.push({
          id,
          options: task.options,
          status: task.status,
          currentAttempts: task.currentAttempts,
          registerName: task.registerName,
          args: task.args,
          enqueueTime: task.enqueueTime,
        });
      }
      await this.saveState(serialized);
    } catch (err: any) {
      this.emit("fail", "persist", err);
    } finally {
      this.isSaving = false;
    }
  }

  public async load(): Promise<void> {
    if (!this.persist) return;
    if (this.initPromise) await this.initPromise;
    if (typeof this.loadState !== "function") return;
    try {
      const tasks = await this.loadState();
      if (tasks && Array.isArray(tasks)) {
        for (const t of tasks) {
          const placeholder: any = () => {};
          placeholder.isPlaceholder = true;

          let execute: TaskExecuteFn = placeholder;
          if (t.registerName && this.registry.has(t.registerName)) {
            const reg = this.registry.get(t.registerName)!;
            const args = t.args || [];
            execute = (signal, progress) => {
              const safeProgress =
                typeof progress === "function" ? progress : () => {};
              return reg.execute(signal, safeProgress, ...args);
            };
          }

          const task: Task = {
            options: t.options,
            execute,
            status: t.status,
            currentAttempts: t.currentAttempts,
            registerName: t.registerName,
            args: t.args,
            enqueueTime: t.enqueueTime || Date.now(),
          };
          this.queue.set(t.id, task);
        }
      }
    } catch (err: any) {
      this.emit("fail", "persist", err);
    }
  }

  public metrics(): MetricsResult {
    const totalCount = this.stats.totalSuccess + this.stats.totalFail;
    const avgRuntime =
      totalCount > 0 ? this.stats.totalRuntime / totalCount : 0;
    const avgLatency =
      totalCount > 0 ? this.stats.totalLatency / totalCount : 0;
    const successRate =
      totalCount > 0 ? (this.stats.totalSuccess / totalCount) * 100 : 0;

    return {
      queue: this.queue.size,
      running: this.running,
      completed: this.completed.size,
      failed: this.deadLetters.size,
      tokens: this.tokens,
      isPaused: this.isPaused,
      stats: {
        avgRuntimeMs: Math.round(avgRuntime),
        avgLatencyMs: Math.round(avgLatency),
        successRatePercent: Math.round(successRate),
        totalSuccess: this.stats.totalSuccess,
        totalFail: this.stats.totalFail,
      },
    };
  }

  public destroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.queue.clear();
    this.completed.clear();
    this.deadLetters.clear();
    this.registry.clear();
  }
}

export default TaskPulse;
