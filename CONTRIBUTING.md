# 开发指南

## 环境

- Node.js >= 18

仓库是 npm workspaces 管理的 monorepo，**只在根目录安装依赖**：

```bash
npm install
```

## 目录结构

```
packages/
  core/            smap-leaflet：核心库
    src/           SMap.ts 主类、core/ 各功能模块、plugins/ 底图与坐标、utils/、style/
    tests/
  vue/             smap-leaflet-vue：Vue 3 封装
    src/           SMapView.ts、components.ts、composables.ts、context.ts
    tests/
example/           示例站（Vue 3），直接引用两个包的源码
```

lint、格式化配置和大部分开发依赖放在根目录，两个包共用。

## 日常开发

命令都在根目录运行。

| 命令                           | 说明                                                            |
| :----------------------------- | :-------------------------------------------------------------- |
| `npm run example`              | 运行示例站，改源码即时生效                                      |
| `npm run check`                | 构建 core + 类型检查 + lint + 格式检查 + 全部测试，提交前跑一遍 |
| `npm run test`                 | 跑全部测试                                                      |
| `npm run build`                | 按顺序构建 core、vue                                            |
| `npm run lint:fix`             | 自动修复 lint 问题                                              |
| `npm run format`               | 用 Prettier 格式化                                              |
| `npm run test:watch -w <包名>` | 监听运行某个包的测试                                            |

`vue` 包的类型检查依赖 `core` 构建出的类型声明。改了 `core` 的公开类型后，先 `npm run build -w smap-leaflet` 再检查 `vue`（`npm run check` 会自动做）。

## 约定

- **对外 API 有变化时同步改该包的 README、llms.txt 和 CHANGELOG。** README 里的示例必须能对上代码里的真实方法名。
- **新增底图**：在 `packages/core/src/plugins/chinese-tms-providers.ts` 的 `providers` 里登记，并在 `COORD_TYPE_MAP` 里声明坐标系；测试会自动遍历所有已登记的类型。
- **绘制与编辑**是自研引擎（`packages/core/src/core/sketch/`），不依赖 leaflet-draw。新增需要画图的工具走 `DrawSession`。
- 修 bug 时尽量补一个能复现它的测试。测试里用 `tests/helpers.ts` 的 `vectorSafe()` 和 `pointer` 可以驱动真实的绘制与编辑流程。

## 提交规范

提交信息使用 `类型: 说明` 的格式：

| 类型       | 用途                 |
| :--------- | :------------------- |
| `feat`     | 新功能               |
| `fix`      | 修复 bug             |
| `docs`     | 仅文档               |
| `refactor` | 重构，不改变对外行为 |
| `test`     | 测试                 |
| `chore`    | 构建、依赖、配置     |

## 发布

两个包各自发布、各自有版本号。以下命令都在根目录运行，`<包名>` 是 `smap-leaflet` 或 `smap-leaflet-vue`。

1. 在该包的 `CHANGELOG.md` 中把「未发布」改成版本号和日期，确认变更条目完整。
2. 升级版本号：`npm version patch|minor|major -w <包名> --no-git-tag-version`，然后提交。
   - 修 bug → patch；向后兼容的新功能 → minor；不兼容的改动 → major。
3. 等 `main` 上的 CI 通过后打 tag 并推送，发布由 `.github/workflows/release.yml` 自动完成。核心库的 tag 是 `v2.6.1` 这样的格式，Vue 包是 `vue-v0.4.1`：

   ```bash
   git tag v2.6.1 && git push origin v2.6.1
   ```

   工作流会核对 tag 和 `package.json` 的版本号是否一致，跑完整检查后再发布，任何一步失败都不会发出去。

注意事项：

- **两个包都要发时，先发 core。** `vue` 包的 `peerDependencies` 声明了它需要的 core 版本范围，用到 core 的新 API 时要同步调高。等 core 的发布工作流成功后再推 Vue 包的 tag。

发布用的是 npm 的 [Trusted Publishing](https://docs.npmjs.com/trusted-publishers)：npm 只认这个仓库的 `release.yml`，仓库里不存任何令牌。所以这个文件不能改名；改名后要到 npmjs.com 上两个包的设置里重新配置受信任的发布者。

需要手动发布时（比如工作流不可用）：`npm publish -w <包名>`，要先 `npm login` 并且对包有发布权限。`prepublishOnly` 会先跑类型检查、测试和构建；发布 `vue` 前要先构建 core（`npm run build`），它的类型声明依赖 core 的产物。
