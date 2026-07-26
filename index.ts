import fs from "fs";
import { TaskPulse } from "cronflex";
import * as assignment from "./assignment2.js";
import { findKthPositive } from "./bonus.js";

const pulse = new TaskPulse({
  concurrency: 1,
  rateMax: 20,
  rateWindow: 1000,
  persist: false,
});

pulse.on("success", (id, result) => {
  console.log(`✅ [Success - ${id}]:`, JSON.stringify(result, null, 2));
});

pulse.on("fail", (id, err) => {
  console.error(`❌ [Fail - ${id}] Error:`, err.message);
});

// Q1: CurrentPathAndDir
pulse.add({ id: "q1", priority: 18 }, () => {
  return assignment.CurrentPathAndDir();
});

// Q2: getFileName
pulse.add({ id: "q2", priority: 17 }, () => {
  const result = assignment.getFileName("/user/files/report.pdf");
  return { filename: result };
});

// Q3: buildPath
pulse.add({ id: "q3", priority: 16 }, () => {
  const result = assignment.buildPath({
    dir: "/folder",
    name: "app",
    ext: ".js",
  });
  return { path: result };
});

// Q4: getFileExtension
pulse.add({ id: "q4", priority: 15 }, () => {
  const result = assignment.getFileExtension("/docs/readme.md");
  return { extension: result };
});

// Q5: parsePath
pulse.add({ id: "q5", priority: 14 }, () => {
  return assignment.parsePath("/home/app/main.js");
});

// Q6: isAbsolutePath
pulse.add({ id: "q6", priority: 13 }, () => {
  const result = assignment.isAbsolutePath("/home/user/file.txt");
  return { isAbsolute: result };
});

// Q7: joinSegments
pulse.add({ id: "q7", priority: 12 }, () => {
  const result = assignment.joinSegments("src", "components", "App.js");
  return { path: result };
});

// Q8: resolveRelativePath
pulse.add({ id: "q8", priority: 11 }, () => {
  const result = assignment.resolveRelativePath("./index.js");
  return { resolvedPath: result };
});

// Q9: joinTwoPaths
pulse.add({ id: "q9", priority: 10 }, () => {
  const result = assignment.joinTwoPaths("/folder1", "folder2/file.txt");
  return { path: result };
});

// Q10: deleteFileAsync
pulse.add({ id: "q10", priority: 9 }, async () => {
  const tempFileForDelete = "./temp_delete.txt";
  await assignment.writeFileAsync(
    tempFileForDelete,
    "Temporary file to delete",
  );
  const result = await assignment.deleteFileAsync(tempFileForDelete);
  return { status: result };
});

// Q11: createFolderSync
pulse.add({ id: "q11", priority: 8 }, () => {
  const result = assignment.createFolderSync("./temp_folder");
  if (fs.existsSync("./temp_folder")) {
    fs.rmdirSync("./temp_folder");
  }
  return { status: result };
});

// Q12: setupStartEventEmitter
pulse.add({ id: "q12", priority: 7 }, () => {
  const emitterStart = assignment.setupStartEventEmitter();
  emitterStart.emit("start");
  return { status: "Welcome event triggered!" };
});

// Q13: emitLoginEvent
pulse.add({ id: "q13", priority: 6 }, () => {
  assignment.emitLoginEvent("Ahmed");
  return { status: "User logged in: Ahmed" };
});

// Q14: readFileContentsSync
pulse.add({ id: "q14", priority: 5 }, async () => {
  const notesFile = "./notes.txt";
  await assignment.writeFileAsync(notesFile, "This is a note.");
  const content = assignment.readFileContentsSync(notesFile);
  await assignment.deleteFileAsync(notesFile);
  return { content };
});

// Q15: writeFileAsync
pulse.add({ id: "q15", priority: 4 }, async () => {
  const asyncFile = "./async.txt";
  await assignment.writeFileAsync(asyncFile, "Async save");
  await assignment.deleteFileAsync(asyncFile);
  return { status: "Async save" };
});

// Q16: checkDirectoryExists
pulse.add({ id: "q16", priority: 3 }, async () => {
  const notesFile = "./notes.txt";
  await assignment.writeFileAsync(notesFile, "This is a note.");
  const exists = assignment.checkDirectoryExists(notesFile);
  await assignment.deleteFileAsync(notesFile);
  return { exists };
});

// Q17: getOSInfo
pulse.add({ id: "q17", priority: 2 }, () => {
  return assignment.getOSInfo();
});

// Bonus: findKthPositive
pulse.add({ id: "bonus", priority: 1 }, () => {
  const result = findKthPositive([2, 3, 4, 7, 11], 5);
  return {
    input: "arr: [2, 3, 4, 7, 11], k: 5",
    result: result,
    leetcodeSubmission:
      "https://leetcode.com/problems/kth-missing-positive-number/submissions/2080863390/",
  };
});
