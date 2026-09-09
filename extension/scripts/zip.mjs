import archiver from "archiver";
import { createWriteStream, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("dist/manifest.json", "utf-8"));
const outFile = `recall-extension-v${manifest.version}.zip`;

const output = createWriteStream(outFile);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(`Packaged ${outFile} (${archive.pointer()} bytes)`);
});
archive.on("error", (err) => {
  throw err;
});
archive.pipe(output);
archive.directory("dist/", false);
await archive.finalize();
