// CronFlex Worker: Created by moaaz yahia zakaria (من صنع معاذ يحيى زكريا)

import { Task } from "./types.js";

export class TaskWorker {
  public static async executeTask(
    task: Task,
    beforeHooks: Array<(task: Task) => Promise<void> | void>,
    afterHooks: Array<(task: Task, result: any) => Promise<void> | void>,
    emit: (event: string, ...args: any[]) => void,
    onProgress: (id: string, progress: number) => void,
  ): Promise<{ result: any; startTime: number }> {
    const startTime = Date.now();
    const controller = new AbortController();
    task.controller = controller;

    let timeoutId: NodeJS.Timeout | undefined;
    if (task.options.timeout) {
      timeoutId = setTimeout(() => controller.abort(), task.options.timeout);
    }

    let warningTimeoutId: NodeJS.Timeout | undefined;
    if (task.options.warningTimeout) {
      warningTimeoutId = setTimeout(() => {
        emit("timeout-warning", task.options.id!, task.options.warningTimeout!);
      }, task.options.warningTimeout);
    }

    try {
      for (const hook of beforeHooks) {
        await hook(task);
      }

      const progressCb = (percent: number) => {
        onProgress(task.options.id!, percent);
      };

      const result = await task.execute(controller.signal, progressCb);

      if (timeoutId) clearTimeout(timeoutId);
      if (warningTimeoutId) clearTimeout(warningTimeoutId);

      for (const hook of afterHooks) {
        await hook(task, result);
      }

      return { result, startTime };
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      if (warningTimeoutId) clearTimeout(warningTimeoutId);
      throw error;
    }
  }

  public static calculateRetryDelay(task: Task, attempt: number): number {
    if (typeof task.options.retryDelay === "function") {
      return task.options.retryDelay(attempt);
    }
    const baseDelay = task.options.retryDelay ?? 1000;
    return baseDelay * Math.pow(2, attempt - 1);
  }
}
