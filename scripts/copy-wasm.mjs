// Copies the zxing-wasm reader binary into public/ so the scanner never loads code from a third-party CDN.
import { copyFileSync, existsSync, mkdirSync } from "fs";

const src = "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm";
if (!existsSync(src)) {
  console.error(`Missing ${src} — run npm install first.`);
  process.exit(1);
}
mkdirSync("public/zxing", { recursive: true });
copyFileSync(src, "public/zxing/zxing_reader.wasm");
console.log("zxing_reader.wasm copied to public/zxing/");
