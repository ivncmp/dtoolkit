export interface InputFile {
  name: string;
  mimeType: string;
  data: string;
}

const TEXT_MIME_PREFIXES = ["text/"];

const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/toml",
  "application/x-sh",
  "application/javascript",
  "application/typescript",
  "application/graphql",
  "application/sql",
  "application/x-httpd-php",
]);

export function isTextFile(file: InputFile): boolean {
  if (TEXT_MIME_PREFIXES.some((p) => file.mimeType.startsWith(p))) return true;
  return TEXT_MIME_TYPES.has(file.mimeType);
}

export function embedTextFiles(
  prompt: string,
  files: InputFile[],
): { prompt: string; remaining: InputFile[] } {
  if (files.length === 0) return { prompt, remaining: [] };

  const blocks = files
    .map((f) => {
      if (isTextFile(f)) {
        return `<file name="${f.name}">\n${f.data}\n</file>`;
      }
      return `<file name="${f.name}" type="${f.mimeType}" encoding="base64">\n${f.data}\n</file>`;
    })
    .join("\n\n");

  return { prompt: `${blocks}\n\n${prompt}`, remaining: [] };
}

const MIME_BY_EXT: Record<string, string> = {
  // text
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  xml: "text/xml",
  svg: "text/xml",
  log: "text/plain",
  env: "text/plain",

  // code
  js: "application/javascript",
  mjs: "application/javascript",
  cjs: "application/javascript",
  ts: "application/typescript",
  mts: "application/typescript",
  cts: "application/typescript",
  jsx: "application/javascript",
  tsx: "application/typescript",
  json: "application/json",
  yaml: "application/yaml",
  yml: "application/yaml",
  toml: "application/toml",
  sh: "application/x-sh",
  bash: "application/x-sh",
  zsh: "application/x-sh",
  sql: "application/sql",
  graphql: "application/graphql",
  gql: "application/graphql",
  py: "text/x-python",
  rb: "text/x-ruby",
  rs: "text/x-rust",
  go: "text/x-go",
  java: "text/x-java",
  kt: "text/x-kotlin",
  swift: "text/x-swift",
  c: "text/x-c",
  h: "text/x-c",
  cpp: "text/x-c++",
  hpp: "text/x-c++",
  cs: "text/x-csharp",
  php: "application/x-httpd-php",
  r: "text/x-r",
  lua: "text/x-lua",
  ex: "text/x-elixir",
  exs: "text/x-elixir",
  erl: "text/x-erlang",
  hs: "text/x-haskell",
  scala: "text/x-scala",
  vue: "text/html",
  svelte: "text/html",

  // images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  tiff: "image/tiff",
  tif: "image/tiff",
  avif: "image/avif",

  // documents
  pdf: "application/pdf",

  // audio
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",

  // video
  mp4: "video/mp4",
  webm: "video/webm",

  // archives
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
};

export function detectMimeType(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  const ext = filename.slice(dot + 1).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
