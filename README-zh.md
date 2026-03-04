# rex-ai-boot (AIOS)

本项目是一个面向 `Codex CLI`、`Claude Code`、`Gemini CLI` 的本地 Agent 工作流仓库。  
目标不是做一个新的聊天客户端，而是给现有 CLI 增加两件事：

1. 统一浏览器自动化能力（Playwright MCP，`browser_*` 工具）
2. 跨 CLI 共享的文件系统 Context DB（可追溯会话记忆）

## 先用起来（不想看原理就看这里）

关键入口：

- 项目地址（GitHub）：`https://github.com/rexleimo/rex-ai-boot`
- 文档站：`https://cli.rexai.top`
- 博客：`https://cli.rexai.top/blog/`
- 官方案例库：`https://cli.rexai.top/case-library/`
- 友情链接：`https://os.rexai.top` / `https://rexai.top` / `https://tool.rexai.top`

30 秒上手（macOS / Linux）：

```bash
git clone https://github.com/rexleimo/rex-ai-boot.git
cd rex-ai-boot
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

30 秒上手（Windows PowerShell）：

```powershell
git clone https://github.com/rexleimo/rex-ai-boot.git
cd rex-ai-boot
powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components all -Mode opt-in
. $PROFILE
codex
```

## 你最关心的点：为什么直接输入 `codex` 也会带 ContextDB？

原理是 **zsh 包装函数透明接管**：

- [`scripts/contextdb-shell.zsh`](scripts/contextdb-shell.zsh) 通过 shell function 接管 `codex()`、`claude()`、`gemini()`
- 这些函数会委托给 [`scripts/contextdb-shell-bridge.mjs`](scripts/contextdb-shell-bridge.mjs)，由 bridge 统一判断包裹或透传
- 当满足包裹条件时，bridge 会调用 [`scripts/ctx-agent.mjs`](scripts/ctx-agent.mjs)，并把当前 git 根目录作为 `--workspace`
- 在非 git 目录，或管理子命令（如 `codex mcp`、`gemini hooks`）场景下，会直接透传到原命令

所以你仍然输入原命令，体验上不需要改操作习惯。

## 系统架构

```text
User -> codex/claude/gemini
     -> (zsh wrapper: contextdb-shell.zsh)
     -> contextdb-shell-bridge.mjs
     -> ctx-agent.mjs
        -> contextdb CLI (init/session/event/checkpoint/pack)
        -> 启动原生 codex/claude/gemini（注入 context packet）
     -> mcp-server/browser_* (可选，浏览器自动化)
```

## 目录说明

- `mcp-server/`: Playwright MCP 服务与 `contextdb` CLI 实现
- `scripts/contextdb-shell-bridge.mjs`: 跨平台包裹/透传决策桥
- `scripts/ctx-agent.mjs`: 统一运行器（自动接入 ContextDB）
- `scripts/contextdb-shell.zsh`: 透明接管 `codex/claude/gemini`
- `memory/context-db/`: 本仓库会话数据（本地产物，已忽略提交）
- `config/browser-profiles.json`: 浏览器 profile/CDP 配置

## 前置条件

- Git
- Node.js **20+**（推荐：**22 LTS**）并带 `npm`
- Windows：PowerShell（Windows PowerShell 5.x 或 PowerShell 7）
- 可选（仅文档站点）：Python 3.10+（`pip install -r docs-requirements.txt`）

## 快速开始

执行 `scripts/*.sh` 或 `scripts/*.ps1` 前，先 clone 并进入仓库根目录：

```bash
git clone https://github.com/rexleimo/rex-ai-boot.git
cd rex-ai-boot
```

## 官方案例库

如果你要快速了解“这个仓库到底能做什么”，请直接看：

- 文档站：`https://cli.rexai.top/case-library/`
- 仓库文档：[`docs-site/case-library.md`](docs-site/case-library.md)

### 1) 一条命令完成安装（推荐）

macOS / Linux：

```bash
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
```

Windows（PowerShell）：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components all -Mode opt-in
. $PROFILE
```

这会在一次流程里安装 Browser MCP、shell 包装层、全局 skills（可选）和 superpowers。

按需选择组件示例：

```bash
# 只安装 shell 包装 + skills + superpowers
scripts/setup-all.sh --components shell,skills,superpowers --mode opt-in

# 只安装 browser MCP
scripts/setup-all.sh --components browser
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components shell,skills,superpowers -Mode opt-in
powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components browser
```

### 2) 一条命令更新 / 卸载

```bash
scripts/update-all.sh --components all --mode opt-in
scripts/uninstall-all.sh --components shell,skills
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\update-all.ps1 -Components all -Mode opt-in
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-all.ps1 -Components shell,skills
```

### 3) 高级模式：分组件脚本

如果你想按组件独立管理，也可以使用 `scripts/` 里的拆分脚本：

- Browser MCP：`install-browser-mcp.*`、`doctor-browser-mcp.*`
- Shell 包装：`install/update/uninstall/doctor-contextdb-shell.*`
- 全局 Skills：`install/update/uninstall/doctor-contextdb-skills.*`
- Superpowers：`install/update/doctor-superpowers.*`

### 3.1 作用域控制（避免跨项目复用）

默认行为是仅在 `ROOTPATH` 仓库启用包装（`CTXDB_WRAP_MODE=repo-only`）。
如果你希望使用其他范围，可在 `~/.zshrc` 设置：

```zsh
# 只在 rex-ai-boot 项目启用
export CTXDB_WRAP_MODE=repo-only

# 或：只有带 .contextdb-enable 标记文件的项目才启用
export CTXDB_WRAP_MODE=opt-in
```

如果使用 `opt-in`，在项目根目录创建标记文件：

```bash
touch .contextdb-enable
```

最新行为：
- `opt-in` 模式下，包装器启动时默认会自动创建该标记文件。
- 如果你希望保持“严格手动 opt-in”，可关闭自动创建：

```bash
export CTXDB_AUTO_CREATE_MARKER=0
```

### 3.2 Skills 作用域（重要）

ContextDB 包装和 CLI 的 Skills 加载是两层机制：

- 包装范围由上面的 `CTXDB_WRAP_MODE` 控制。
- 使用上面的 skills 生命周期脚本完成安装/更新/卸载/诊断。
- skills 安装脚本默认会跳过同名已有目录；只有你明确要替换时再使用 `--force` / `-Force`。
- 安装在 `~/.codex/skills`、`~/.claude/skills`、`~/.gemini/skills`、`~/.config/opencode/skills` 的技能是全局可见。
- 仅项目可见的技能应放在 `<repo>/.codex/skills`、`<repo>/.claude/skills`。
- `CODEX_HOME` 建议保持为绝对路径（推荐 `~/.codex`），不要设置为相对路径 `.codex`。

如果你不希望跨项目复用技能，请把自定义技能放在仓库本地目录，而不是 `~` 下的全局目录。

### 4) 直接使用原命令

```bash
codex
claude
gemini
```

PowerShell 包装入口是 `scripts/contextdb-shell.ps1`，底层跨平台运行器是 `scripts/ctx-agent.mjs`。

配置完成后，在其他 git 项目里也同样生效（上下文写入该项目自己的 `memory/context-db/`）。

## 两种运行模式

### A. 交互模式（直接 `codex` / `claude` / `gemini`）

- 自动做：`init`、`session:latest/new`、`context:pack`
- 作用域：当前 git 项目根目录（`--workspace <git-root>`）
- 用途：启动时自动带上历史上下文
- 边界：不会在每一轮消息后自动写 checkpoint

### B. One-shot 模式（推荐做全自动闭环）

```bash
scripts/ctx-agent.sh --agent codex-cli --project rex-ai-boot --prompt "继续上次任务并执行下一步"
```

one-shot 下会自动执行完整 5 步：
`init -> session:new/latest -> event:add -> checkpoint -> context:pack`

## ContextDB 数据结构（L0/L1/L2）

```text
memory/context-db/
  manifest.json
  index/context.db
  index/sessions.jsonl
  index/events.jsonl
  index/checkpoints.jsonl
  sessions/<session_id>/
    meta.json
    l0-summary.md
    l1-checkpoints.jsonl
    l2-events.jsonl
    state.json
  exports/<session_id>-context.md
```

全局模式下，上述结构会在每个项目根目录各自创建一份。

## 常用命令

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- session:new --agent claude-code --project rex-ai-boot --goal "stabilize flow"
npm run contextdb -- event:add --session <id> --role user --text "need retry plan"
npm run contextdb -- checkpoint --session <id> --summary "blocked by auth" --status blocked --next "wait-login|resume"
npm run contextdb -- context:pack --session <id> --out memory/context-db/exports/<id>-context.md
npm run contextdb -- index:rebuild
npm run contextdb -- search --query "auth race" --project rex-ai-boot --kinds response --refs auth.ts
```

可选语义重排（P2）：

```bash
export CONTEXTDB_SEMANTIC=1
export CONTEXTDB_SEMANTIC_PROVIDER=token
npm run contextdb -- search --query "issue auth" --project rex-ai-boot --semantic
```

未知或不可用 provider 会自动回退到 lexical 检索。

## 版本与发布

仓库使用语义化版本（SemVer），根目录维护：

- `VERSION`：当前版本号
- `CHANGELOG.md`：发布历史

升级版本命令：

```bash
scripts/release-version.sh patch "fix: 非破坏性问题修复"
scripts/release-version.sh minor "feat: 向后兼容的新能力"
scripts/release-version.sh major "breaking: 不兼容行为变更"
```

仅预览，不改文件：

```bash
scripts/release-version.sh --dry-run patch "示例说明"
```

版本判断技能文件：

- `.codex/skills/versioning-by-impact/SKILL.md`
- `.claude/skills/versioning-by-impact/SKILL.md`

## 开发验证

```bash
cd mcp-server
npm test
npm run typecheck
npm run build
```

## 卸载透明接管

推荐方式：

```bash
scripts/uninstall-contextdb-shell.sh
source ~/.zshrc
```

手动兜底（仅在需要时）：删除 `~/.zshrc` 中 `# >>> contextdb-shell >>>` 管理区块。
