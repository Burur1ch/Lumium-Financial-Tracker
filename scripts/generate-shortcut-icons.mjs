import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Camera, Plus, Zap } from "lucide-react";
import sharp from "sharp";

const destination = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "shortcuts");
await mkdir(destination, { recursive: true });
for (const [name, icon] of [["scan", Camera], ["add", Plus], ["quick", Zap]]) {
  const glyph = renderToStaticMarkup(createElement(icon, { width: 48, height: 48, color: "#ffffff", strokeWidth: 2 }));
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="#D92D3A"/><g transform="translate(24 24)">${glyph}</g></svg>`;
  const png = await sharp(Buffer.from(source)).png().toBuffer();
  await writeFile(join(destination, `${name}.png`), png);
}
console.log("Generated three Android shortcut icons.");
