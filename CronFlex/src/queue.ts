// CronFlex Queue: Created by moaaz yahia zakaria (من صنع معاذ يحيى زكريا)

import { Task } from "./types.js";

export class TaskQueue {
  public queue: Map<string, Task>;
  public completed: Set<string>;
  public deadLetters: Map<string, Task>;

  constructor() {
    this.queue = new Map();
    this.completed = new Set();
    this.deadLetters = new Map();
  }

  public getSortedIdleTasks(
    agingRate: number,
    onExpired: (id: string) => void,
    onFailed: (task: Task, err: Error) => void,
  ): Task[] {
    const now = Date.now();
    return Array.from(this.queue.values())
      .filter((t) => {
        if (t.status !== "idle" || (t.execute && t.execute.isPlaceholder)) {
          return false;
        }

        if (t.options.ttl && now - t.enqueueTime > t.options.ttl) {
          t.status = "expired";
          onExpired(t.options.id!);
          onFailed(
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

        if (agingRate) {
          const waitA = now - (a.enqueueTime || now);
          const waitB = now - (b.enqueueTime || now);
          priorityA += waitA * agingRate;
          priorityB += waitB * agingRate;
        }

        return priorityB - priorityA;
      });
  }

  public cascadeCancel(parentId: string): void {
    this.queue.delete(parentId);
    for (const [id, task] of this.queue.entries()) {
      if (task.options.dependencies?.includes(parentId)) {
        this.cascadeCancel(id);
      }
    }
  }
}
