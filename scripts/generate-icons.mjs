import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDirectory, "..");
const source = await readFile(join(projectRoot, "app", "icon.svg"));

async function renderPng(size, destination, { opaque = false } = {}) {
  let image = sharp(source, { density: 384 }).resize(size, size, {
    fit: "fill",
  });

  if (opaque) {
    image = image.flatten({ background: "#090d14" });
  }

  await image
    .png({ compressionLevel: 9, palette: true })
    .toFile(join(projectRoot, destination));
}

async function renderPngBuffer(size) {
  return sharp(source, { density: 384 })
    .resize(size, size, { fit: "fill" })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}

function createIco(images) {
  const directorySize = 6 + images.length * 16;
  const header = Buffer.alloc(directorySize);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let imageOffset = directorySize;

  images.forEach(({ size, data }, index) => {
    const entryOffset = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entryOffset);
    header.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(data.length, entryOffset + 8);
    header.writeUInt32LE(imageOffset, entryOffset + 12);
    imageOffset += data.length;
  });

  return Buffer.concat([header, ...images.map(({ data }) => data)]);
}

await Promise.all([
  renderPng(180, join("app", "apple-icon.png"), { opaque: true }),
  renderPng(192, join("public", "icon-192.png")),
  renderPng(512, join("public", "icon-512.png")),
  renderPng(192, join("public", "icon-maskable-192.png"), { opaque: true }),
  renderPng(512, join("public", "icon-maskable-512.png"), { opaque: true }),
]);

const faviconImages = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, data: await renderPngBuffer(size) })),
);

await writeFile(
  join(projectRoot, "app", "favicon.ico"),
  createIco(faviconImages),
);

console.log("Generated Lumium favicon and PWA icon set from app/icon.svg");
