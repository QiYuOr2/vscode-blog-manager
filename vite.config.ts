import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const root = dirname(fileURLToPath(import.meta.url));

// 生产包只在 `pnpm run package`（含 vscode:prepublish）里打开压缩、关掉 sourcemap。
// 不用 NODE_ENV 前缀，避免 Windows 的 cmd 写不了 `NODE_ENV=production vp pack`。
// 开发机跑 vite-plus 需要 Node ^22.18 || ^24.11 || >=26，不写进 engines.node：
// tsdown 会把 engines.node 当成产物 target，而扩展实际跑在 VS Code 1.144 的 Node 24 上。
const production =
  process.env.npm_lifecycle_event === "package" ||
  process.env.npm_lifecycle_event === "vscode:prepublish";

export default defineConfig({
  check: {
    fmt: false,
  },
  pack: {
    entry: "src/extension.ts",
    format: "cjs",
    platform: "node",
    // platform:node 默认 fixedExtension:true，会产出 extension.cjs，main 指向的是 extension.js。
    fixedExtension: false,
    // VS Code 1.144.0 扩展宿主实测是 Node v24.22.1。
    target: "node24",
    outDir: "dist",
    dts: false,
    clean: true,
    minify: production,
    sourcemap: !production,
    // js-yaml 的可选 require("esprima") 会被 alwaysBundle 整包打进来。
    // 指到空模块后体积和 esbuild 持平，产物里也不再出现 require("esprima")。
    alias: {
      esprima: resolve(root, "shims/esprima.cjs"),
    },
    deps: {
      neverBundle: ["vscode"],
      // 不打包依赖的话，vsce --no-dependencies 装上后 require("front-matter"|"glob"|"@vscode/l10n") 会在运行时崩。
      alwaysBundle: [/.*/],
      // 扩展就是要把 dependencies 全部打进去。关掉 tsdown 默认的 info 提示。
      onlyBundle: false,
    },
  },
  test: {
    // 默认 include 会把 mocha 的 src/test/*.test.ts 和 out/test/*.test.js 一起抓进来。
    include: ["src/**/*.spec.ts"],
    exclude: ["out/**", "dist/**", "node_modules/**", "src/test/**"],
    environment: "node",
  },
  lint: {
    ignorePatterns: ["dist/**", "out/**", "node_modules/**"],
    options: {
      // tsgolint / TypeScript 7。vp check 和 vp lint 都会走这条路径。
      // 没有 baseUrl，tsgolint 不会跳过 type check。
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      curly: "warn",
      eqeqeq: "warn",
      "no-throw-literal": "warn",
    },
  },
});
