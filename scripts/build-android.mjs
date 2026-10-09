import { spawnSync } from "node:child_process";
import { chmod, readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidProject = path.join(projectRoot, "android");
const nativeAssets = path.join(projectRoot, "android", "app", "src", "main", "assets", "public");

function escapePowerShellLiteral(value) {
  return value.replaceAll("'", "''");
}

async function makeWritable(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  await chmod(directory, (await stat(directory)).mode | 0o200);
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await makeWritable(entryPath);
    else await chmod(entryPath, (await stat(entryPath)).mode | 0o200);
  }
}

await build({ mode: "android", configFile: path.join(projectRoot, "vite.config.js") });
await makeWritable(androidProject);

if (process.platform === "win32") {
  const quotedAndroidPath = escapePowerShellLiteral(androidProject);
  const clearReadOnlyAttributes = `
    $root = Resolve-Path -LiteralPath '${quotedAndroidPath}';
    $items = @((Get-Item -LiteralPath $root.Path -Force)) + @(Get-ChildItem -LiteralPath $root.Path -Force -Recurse | Where-Object { $_.Attributes -band [System.IO.FileAttributes]::ReadOnly });
    foreach ($entry in $items) {
      $item = Get-Item -LiteralPath $entry.FullName -Force;
      $item.Attributes = $item.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly);
    }
  `;
  const attributes = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", clearReadOnlyAttributes], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (attributes.error) throw attributes.error;
  if (attributes.status !== 0) process.exit(attributes.status || 1);
}

const capacitorCli = path.join(projectRoot, "node_modules", "@capacitor", "cli", "bin", "capacitor");
const sync = spawnSync(process.execPath, [capacitorCli, "sync", "android"], {
  cwd: projectRoot,
  stdio: "inherit",
});
if (sync.error) throw sync.error;
if (sync.status !== 0) process.exit(sync.status || 1);

const distAssets = path.join(projectRoot, "dist", "assets");
const androidAssetDirectory = path.join(nativeAssets, "assets");
for (const filename of await readdir(distAssets)) {
  const sourceSize = (await stat(path.join(distAssets, filename))).size;
  const targetSize = (await stat(path.join(androidAssetDirectory, filename))).size;
  if (sourceSize !== targetSize) {
    throw new Error(`Android asset sync verification failed for ${filename}.`);
  }
}

const builtIndex = await readFile(path.join(projectRoot, "dist", "index.html"), "utf8");
const androidIndex = await readFile(path.join(nativeAssets, "index.html"), "utf8");
if (builtIndex !== androidIndex) throw new Error("Android index.html did not sync from the Vite build.");

console.info("Android web assets built and synced successfully.");
