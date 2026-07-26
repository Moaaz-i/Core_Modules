# Core Modules Assignment & LeetCode Bonus

This repository contains the solutions for the Node.js Core Modules Assignment (Assignment 2) and the LeetCode Bonus problem, written entirely in **TypeScript** and orchestrated using **CronFlex** (TaskPulse).

Created and developed by: **moaaz yahia zakaria** (من صنع معاذ يحيى زكريا).

---

## Features

### 1. Core Modules Assignment (`assignment2.ts`)
Implements 17 functions covering essential Node.js core modules (`path`, `fs`, `os`, and `events`):
1. **Current Path & Dir**: Logs and returns current file path and directory.
2. **Get File Name**: Extracts the file name from a path.
3. **Build Path**: Reconstructs a path from an object containing `{ dir, name, ext }`.
4. **Get File Extension**: Returns the extension of a file.
5. **Parse Path**: Returns `{ Name, Ext }` from a path.
6. **Is Absolute Path**: Checks if a path is absolute.
7. **Join Segments**: Joins multiple path segments.
8. **Resolve Relative Path**: Resolves a relative path to an absolute one.
9. **Join Two Paths**: Joins two paths.
10. **Delete File Asynchronously**: Deletes a file asynchronously using promises.
11. **Create Folder Synchronously**: Creates a directory synchronously.
12. **Start Event Emitter**: Listens to a "start" event and logs a welcome message.
13. **Login Event Emitter**: Emits a custom "login" event with a username.
14. **Read File Synchronously**: Reads file contents synchronously and logs them.
15. **Write File Asynchronously**: Writes contents asynchronously.
16. **Check Directory Exists**: Confirms if a path/directory exists.
17. **Get OS Info**: Returns the OS platform and CPU architecture.

### 2. LeetCode Bonus (`bonus.ts`)
- **Problem**: 1539. Kth Missing Positive Number.
- **Solution**: Implemented using an optimized Binary Search algorithm with a time complexity of **$O(\log n)$**, satisfying the follow-up constraints.
- **Submission**: [View LeetCode Submission](https://leetcode.com/problems/kth-missing-positive-number/submissions/2080863390/)

### 3. Task Orchestration (`index.ts`)
All functions and the bonus task are executed as individual tasks scheduled sequentially inside the **CronFlex** framework, displaying output cleanly via the CronFlex `success` event listener.

---

## How to Run

### Prerequisites
Make sure you have Node.js installed on your system.

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/Moaaz-i/Core_Modules.git
   cd Core_Modules
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server (auto-reruns on change):
   ```bash
   npm run dev
   ```
4. Or execute it once:
   ```bash
   npm run start
   ```
