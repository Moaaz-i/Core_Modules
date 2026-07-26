# CronFlex

A robust, modular task queue and rate-limiting library for Node.js and browser environments.

Created by: **moaaz yahia zakaria** (من صنع معاذ يحيى زكريا)

## Features
- **Task Prioritization**: Enqueue tasks with dynamic priority or aging rate.
- **Dependency Management**: Schedule tasks with dependency chains.
- **Rate-Limiting**: Limit concurrent running tasks and token-based rate window resets.
- **Debounce & Throttle**: Clean maps and prevent excessive execution.
- **Persistence**: Save and restore state with Redis or LocalStorage.
- **Robust Failure & Timeout Handlers**: Integrated retries, timeout warning events, and fallback actions.

## Structure
- `types.ts`: Task and option interfaces.
- `queue.ts`: Queue management and dependency resolving.
- `worker.ts`: Worker processing and runner.
- `rateLimiter.ts`: Debounce, throttle, and token limiting.
- `index.ts`: Orchestrates all components under the `TaskPulse` class.
