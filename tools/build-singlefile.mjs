#!/usr/bin/env node
/* 打包成单文件 dist/index.html（内联 CSS/JS），便于贴入 WorkBuddy「开发网站」模式。
 * 用法：node tools/build-singlefile.mjs */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const html = await readFile(join(root, "index.html"), "utf8");
const css = await readFile(join(root, "css", "style.css"), "utf8");
const scripts = ["utils", "config", "airspace", "drone", "missions", "ui", "audio", "game", "main"];

// 用替换函数返回，避免 JS 源码中的 $ 序列被当作替换模式
let out = html.replace(
  /<link rel="stylesheet" href="css\/style\.css(\?v=\d+)?">/,
  () => "<style>\n" + css + "\n</style>",
);

for (const name of scripts) {
  const js = await readFile(join(root, "js", name + ".js"), "utf8");
  const tag = new RegExp('<script src="js/' + name + '\\.js(\\?v=\\d+)?"></script>');
  if (!tag.test(out)) throw new Error("index.html 中找不到 " + name + " 的 script 标签");
  out = out.replace(tag, () => "<script>\n" + js + "\n</script>");
}

if (/src="js\/|css\/style\.css/.test(out)) throw new Error("仍有未内联的外部引用");

await mkdir(join(root, "dist"), { recursive: true });
const target = join(root, "dist", "index.html");
await writeFile(target, out, "utf8");
console.log("OK " + target + " (" + (out.length / 1024).toFixed(1) + " KB)");
