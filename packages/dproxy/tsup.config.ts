import { defineConfig } from "tsup";
import { cpSync, readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
  onSuccess: async () => {
    cpSync("src/scripts", "dist/scripts", { recursive: true });
  },
});
