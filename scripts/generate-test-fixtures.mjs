import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

// Generate only disposable, deterministic files. The output directory is
// ignored and is safe to remove between runs.
const root = process.cwd();
const output = path.join(root, "tmp", "fixtures");
mkdirSync(output, { recursive: true });

const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const files = {
  "sample-image.png": png,
  "sample-video.mp4": Buffer.from("000000186674797069736f6d00000200", "hex"),
  "sample-audio.mp3": Buffer.from("49443304000000000023", "hex"),
  "sample-document.pdf": Buffer.from("255044462d312e370a", "ascii"),
};
for (const [name, bytes] of Object.entries(files)) writeFileSync(path.join(output, name), bytes);

writeFileSync(
  path.join(output, "active-codes.json"),
  JSON.stringify(
    {
      generatedAt: "2026-01-01T00:00:00.000Z",
      codes: [
        { slug: "DEMO000001", type: "text", body: "deterministic fixture" },
        { slug: "DEMO000002", type: "url", url: "https://example.com/tp-qr" },
      ],
    },
    null,
    2,
  ) + "\n",
);

console.log(`Generated ${Object.keys(files).length + 1} fixture files in ${path.relative(root, output)}`);
