import { EventEmitter } from "events";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

// 1. Write a function that logs the current file path and directory.
export function CurrentPathAndDir() {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const result = { File: filename, Dir: dirname };
  return result;
}

// 2. Write a function that takes a file path and returns its file name.
export function getFileName(filePath: string): string {
  return path.basename(filePath);
}

// 3. Write a function that builds a path from an object.
export function buildPath(obj: {
  dir: string;
  name: string;
  ext: string;
}): string {
  return path.format(obj);
}

// 4. Write a function that returns the file extension from a given file path.
export function getFileExtension(filePath: string): string {
  return path.extname(filePath);
}

// 5. Write a function that parses a given path and returns its name and ext.
export function parsePath(filePath: string) {
  const parsed = path.parse(filePath);
  return { Name: parsed.name, Ext: parsed.ext };
}

// 6. Write a function that checks whether a given path is absolute.
export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

// 7. Write a function that joins multiple segments.
export function joinSegments(...segments: string[]): string {
  return path.join(...segments);
}

// 8. Write a function that resolves a relative path to an absolute one.
export function resolveRelativePath(relativePath: string): string {
  return path.resolve(relativePath);
}

// 9. Write a function that joins two paths.
export function joinTwoPaths(path1: string, path2: string): string {
  return path.join(path1, path2);
}

// 10. Write a function that deletes a file asynchronously.
export async function deleteFileAsync(filePath: string): Promise<string> {
  const filename = path.basename(filePath);
  await fs.promises.unlink(filePath);
  const msg = `The ${filename} is deleted.`;
  return msg;
}

// 11. Write a function that creates a folder synchronously.
export function createFolderSync(folderPath: string): string {
  fs.mkdirSync(folderPath, { recursive: true });
  return "Success";
}

// 12. Create an event emitter that listens for a "start" event and logs a welcome message.
export function setupStartEventEmitter(): EventEmitter {
  const emitter = new EventEmitter();
  emitter.on("start", () => {
    console.log("Welcome event triggered!");
  });
  return emitter;
}

// 13. Emit a custom "login" event with a username parameter.
export function emitLoginEvent(username: string): EventEmitter {
  const emitter = new EventEmitter();
  emitter.on("login", (user: string) => {
    console.log(`User logged in: ${user}`);
  });
  emitter.emit("login", username);
  return emitter;
}

// 14. Read a file synchronously and log its contents.
export function readFileContentsSync(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf8");
  return content;
}

// 15. Write asynchronously to a file.
export async function writeFileAsync(
  filePath: string,
  content: string,
): Promise<void> {
  await fs.promises.writeFile(filePath, content, "utf8");
}

// 16. Check if a directory exists.
export function checkDirectoryExists(dirPath: string): boolean {
  return fs.existsSync(dirPath);
}

// 17. Write a function that returns the OS platform and CPU architecture.
export function getOSInfo() {
  return {
    Platform: os.platform(),
    Arch: os.arch(),
  };
}
