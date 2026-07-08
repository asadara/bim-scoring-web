import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const patches = [
  {
    relPath: "node_modules/@opennextjs/aws/dist/build/copyTracedFiles.js",
    replacements: [
      {
        find: `if (e.code !== "EEXIST") {
                    throw e;
                }`,
        replace: `if (e.code === "EPERM") {
                    cpSync(from, to, { recursive: true, dereference: true });
                }
                else if (e.code !== "EEXIST") {
                    throw e;
                }`,
      },
    ],
  },
  {
    relPath:
      "node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/turbopack.js",
    replacements: [
      {
        find: `        if (file.includes(".next/server/chunks/")) {
            chunks.add(file);
        }`,
        replace: `        const posixFile = file.replaceAll("\\\\", "/");
        if (posixFile.includes(".next/server/chunks/")) {
            chunks.add(file);
        }`,
      },
      {
        find: `        .map((chunk) => \`      case "\${
    // we only want the path after /path/to/.next/
    chunk.replace(/.*\\/\\.next\\//, "")}": return require("\${chunk}");\`)`,
        replace: `        .map((chunk) => {
        const posixChunk = chunk.replaceAll("\\\\", "/");
        return \`      case "\${
            // we only want the path after /path/to/.next/
            posixChunk.replace(/.*\\/\\.next\\//, "")}": return require("\${posixChunk}");\`;
    })`,
      },
      {
        find: `.map((absPath) => ({ absPath, relPath: absPath.replace(/.*\\/\\.next\\//, "") }))`,
        replace: `.map((absPath) => {
        const posixAbsPath = absPath.replaceAll("\\\\", "/");
        return { absPath: posixAbsPath, relPath: posixAbsPath.replace(/.*\\/\\.next\\//, "") };
    })`,
      },
    ],
  },
];

let applied = 0;

for (const patch of patches) {
  const filePath = path.join(process.cwd(), patch.relPath);
  if (!existsSync(filePath)) {
    console.warn(`[patch-opennext-windows] skipped missing ${patch.relPath}`);
    continue;
  }

  let source = readFileSync(filePath, "utf8");
  let next = source;

  for (const replacement of patch.replacements) {
    if (next.includes(replacement.replace)) {
      continue;
    }

    if (!next.includes(replacement.find)) {
      console.warn(
        `[patch-opennext-windows] pattern not found in ${patch.relPath}`,
      );
      continue;
    }

    next = next.replace(replacement.find, replacement.replace);
    applied += 1;
  }

  if (next !== source) {
    writeFileSync(filePath, next);
  }
}

console.log(`[patch-opennext-windows] applied ${applied} patch(es)`);
