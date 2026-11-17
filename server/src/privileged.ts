// PlayVerse privileged handlers — host-side only.
//
// The action worker cannot touch the host filesystem, so the one job that
// needs real files on disk — reading this project's own source files for the
// Admin → Code Files "full project source" export — runs here. The handler
// reads only the explicit project-relative paths it is handed (never
// anything outside the space directory it is given, never the database),
// builds a real ZIP from the bytes it actually read, and reports every file
// it could not read so the export's MANIFEST.txt stays honest about gaps.

import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";
import { deflateRawSync } from "node:zlib";
import {
  definePrivilegedContracts,
  definePrivilegedHandlers,
  z,
} from "@hatch/space-sdk";

export const privileged = definePrivilegedContracts({
  buildSourceExport: {
    request: z.object({
      root: z.string().min(1),
      sourcePaths: z.array(z.string().min(1)).min(1).max(80),
      extraFiles: z
        .array(z.object({ path: z.string().min(1), content: z.string() }))
        .max(8),
      excluded: z
        .array(z.object({ path: z.string(), reason: z.string() }))
        .max(24),
      exportedAt: z.string().min(1),
    }),
    response: z.object({
      filename: z.string(),
      zipBase64: z.string(),
      fileCount: z.number(),
      zipBytes: z.number(),
      included: z.array(
        z.object({
          path: z.string(),
          sizeBytes: z.number(),
          origin: z.enum(["source", "generated"]),
        }),
      ),
      gaps: z.array(z.object({ path: z.string(), reason: z.string() })),
    }),
    timeoutMs: 120000,
  },
});

type IncludedFile = { path: string; sizeBytes: number; origin: "source" | "generated" };
type GapEntry = { path: string; reason: string };
type ExportArgs = {
  root: string;
  sourcePaths: string[];
  extraFiles: { path: string; content: string }[];
  excluded: GapEntry[];
  exportedAt: string;
};
type ZipEntry = { name: string; data: Uint8Array };

/* ------------------------------------------------------------ zip utils */
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] ?? 0;
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    ((d.getSeconds() >> 1) & 0x1f);
  const date =
    ((Math.max(0, d.getFullYear() - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0xf) << 5) |
    (d.getDate() & 0x1f);
  return { time, date };
}

function buildZip(entries: ZipEntry[], when: Date): Uint8Array {
  const { time, date } = dosDateTime(when);
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    let method = 0;
    let payload: Uint8Array = entry.data;
    try {
      const deflated = deflateRawSync(entry.data, { level: 9 });
      if (deflated.length < entry.data.length) {
        method = 8;
        payload = new Uint8Array(deflated);
      }
    } catch {
      // Compression unavailable for this entry — store it uncompressed.
    }
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 filename flag
    local.setUint16(8, method, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, payload.length, true);
    local.setUint32(22, entry.data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, payload);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, method, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, payload.length, true);
    cd.setUint32(24, entry.data.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameBytes);

    offset += 30 + nameBytes.length + payload.length;
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) centralSize += c.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, centralStart, true);
  const out = new Uint8Array(centralStart + centralSize + 22);
  let pos = 0;
  for (const c of [...chunks, ...central, new Uint8Array(end.buffer)]) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/* ------------------------------------------------------------- exporter */
async function assembleExport(args: ExportArgs) {
  const rootAbs = resolve(args.root);
  const encoder = new TextEncoder();
  const included: IncludedFile[] = [];
  const readGaps: GapEntry[] = [];
  const entries: ZipEntry[] = [];

  for (const rel of args.sourcePaths) {
    const zipPath = `playverse/${rel}`;
    if (isAbsolute(rel) || rel.split(/[\\/]/).includes("..")) {
      readGaps.push({
        path: zipPath,
        reason: "Refused: the path escapes the project directory.",
      });
      continue;
    }
    const abs = join(rootAbs, rel);
    if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) {
      readGaps.push({
        path: zipPath,
        reason: "Refused: the path escapes the project directory.",
      });
      continue;
    }
    try {
      const info = await stat(abs);
      if (!info.isFile()) {
        readGaps.push({ path: zipPath, reason: "Not a regular file on disk." });
        continue;
      }
      if (info.size > 8 * 1024 * 1024) {
        readGaps.push({
          path: zipPath,
          reason: `Too large to export safely (${info.size} bytes).`,
        });
        continue;
      }
      const data = new Uint8Array(await readFile(abs));
      entries.push({ name: zipPath, data });
      included.push({ path: zipPath, sizeBytes: data.length, origin: "source" });
    } catch (e) {
      readGaps.push({
        path: zipPath,
        reason: `Could not be read from disk: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  for (const extra of args.extraFiles) {
    const zipPath = `playverse/${extra.path}`;
    const data = encoder.encode(extra.content);
    entries.push({ name: zipPath, data });
    included.push({ path: zipPath, sizeBytes: data.length, origin: "generated" });
  }

  const sourceIncluded = included.filter((f) => f.origin === "source");
  const generatedIncluded = included.filter((f) => f.origin === "generated");
  const sourceBytes = included.reduce((sum, f) => sum + f.sizeBytes, 0);
  const lines: string[] = [
    "PLAYVERSE — FULL PROJECT SOURCE EXPORT",
    `Generated: ${args.exportedAt}`,
    "",
    "This zip was built live from the project's real source files, read from",
    "disk on the host at export time. No database data, no secrets and no API",
    "keys are included anywhere in this zip.",
    "",
    `== INCLUDED — READ VERBATIM FROM THE PROJECT SOURCE (${sourceIncluded.length} files) ==`,
    ...sourceIncluded.map((f) => `${f.path} — ${f.sizeBytes} bytes`),
    "",
    `== INCLUDED — GENERATED FOR THIS EXPORT (${generatedIncluded.length + 1} files) ==`,
    ...generatedIncluded.map((f) => `${f.path} — ${f.sizeBytes} bytes`),
    "playverse/MANIFEST.txt — this file",
    "",
    `== COULD NOT BE INCLUDED (${readGaps.length}) ==`,
    ...(readGaps.length === 0
      ? ["None — every requested source file was read successfully."]
      : readGaps.map((g) => `${g.path} — ${g.reason}`)),
    "",
    `== DELIBERATELY EXCLUDED (${args.excluded.length}) ==`,
    ...args.excluded.map((g) => `${g.path} — ${g.reason}`),
    "",
    `TOTALS: ${entries.length + 1} files in this zip · ${sourceBytes} bytes of file content (plus this manifest).`,
  ];
  const manifest = lines.join("\n") + "\n";
  const manifestData = encoder.encode(manifest);
  entries.push({ name: "playverse/MANIFEST.txt", data: manifestData });
  included.push({
    path: "playverse/MANIFEST.txt",
    sizeBytes: manifestData.length,
    origin: "generated",
  });

  const zip = buildZip(entries, new Date(args.exportedAt));
  return {
    filename: "playverse-full-source.zip",
    zipBase64: Buffer.from(zip).toString("base64"),
    fileCount: entries.length,
    zipBytes: zip.length,
    included,
    gaps: [...readGaps, ...args.excluded],
  };
}

export const privilegedHandlers = definePrivilegedHandlers(privileged, {
  buildSourceExport: (args) => assembleExport(args),
});
