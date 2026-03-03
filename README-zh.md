# rex-ai-boot (AIOS)

本项目是一个面向 `Codex CLI`、`Claude Code`、`Gemini CLI` 的本地 Agent 工作流仓库。  
目标不是做一个新的聊天客户端，而是给现有 CLI 增加两件事：

1. 统一浏览器自动化能力（Playwright MCP，`browser_*` 工具）
2. 跨 CLI 共享的文件系统 Context DB（可追溯会话记忆）

## 你最关心的点：为什么直接输入 `codex` 也会带 ContextDB？

原理是 **zsh 包装函数透明接管**：

- [`scripts/contextdb-shell.zsh`](scripts/contextdb-shell.zsh) 通过 shell function 接管 `codex()`、`claude()`、`gemini()`
- 在任意 git 项目里，这些函数会调用 `ROOTPATH` 下的 [`scripts/ctx-agent.sh`](scripts/ctx-agent.sh)，并把当前 git 根目录作为 `--workspace`
- 在非 git 目录，或管理子命令（如 `codex mcp`、`gemini hooks`）场景下，会直接透传到原命令

所以你仍然输入原命令，体验上不需要改操作习惯。

## 系统架构

```text
User -> codex/claude/gemini
     -> (zsh wrapper: contextdb-shell.zsh)
     -> ctx-agent.sh
        -> contextdb CLI (init/session/event/checkpoint/pack)
        -> 启动原生 codex/claude/gemini（注入 context packet）
     -> mcp-server/browser_* (可选，浏览器自动化)
```

## 目录说明

- `mcp-server/`: Playwright MCP 服务与 `contextdb` CLI 实现
- `scripts/ctx-agent.sh`: 统一运行器（自动接入 ContextDB）
- `scripts/contextdb-shell.zsh`: 透明接管 `codex/claude/gemini`
- `memory/context-db/`: 本仓库会话数据（本地产物，已忽略提交）
- `config/browser-profiles.json`: 浏览器 profile/CDP 配置

## 快速开始

### 1) 一键安装 Browser MCP（给新同学）

macOS / Linux：

```bash
scripts/install-browser-mcp.sh
scripts/doctor-browser-mcp.sh
```

Windows（PowerShell）：

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-browser-mcp.ps1
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-browser-mcp.ps1
```

这会自动安装浏览器运行时、构建 `mcp-server`，并输出可复制到 CLI 客户端的 MCP 配置 JSON。

### 2) 手动构建 MCP 与 ContextDB CLI（可选路径）

```bash
cd mcp-server
npm install
npx playwright install chromium
npm run build
```

### 3) 安装透明接管（一次即可）

> 安全建议：优先手动编辑 `~/.zshrc`，并先备份。不要盲目执行会改写 shell 配置的命令。

先备份：

```bash
cp ~/.zshrc ~/.zshrc.bak.$(date +%Y%m%d-%H%M%S)
```

再手动把下面这段加入 `~/.zshrc`：

```zsh
# >>> contextdb-shell >>>
export ROOTPATH="${ROOTPATH:-$HOME/cool.cnb/rex-ai-boot}"
if [[ -f "$ROOTPATH/scripts/contextdb-shell.zsh" ]]; then
  source "$ROOTPATH/scripts/contextdb-shell.zsh"
fi
# <<< contextdb-shell <<<
```

加载配置：

```bash
source ~/.zshrc
```

如果仓库不在 `$HOME/cool.cnb/rex-ai-boot`，把 `ROOTPATH` 改成你的真实路径。

可选：你也可以运行安装脚本 [`scripts/install-contextdb-shell.sh`](scripts/install-contextdb-shell.sh)，但仍建议先手动备份 `~/.zshrc`。

Windows PowerShell 可使用：
`scripts/install-contextdb-shell.ps1`

### 3.1 作用域控制（避免跨项目复用）

默认行为是 **所有 git 项目都启用包装**（`CTXDB_WRAP_MODE=all`）。
如果你希望隔离，可在 `~/.zshrc` 设置：

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

### 3.2 Skills 作用域（重要）

ContextDB 包装和 CLI 的 Skills 加载是两层机制：

- 包装范围由上面的 `CTXDB_WRAP_MODE` 控制。
- 安装在 `~/.codex/skills`、`~/.claude/skills` 的技能是全局可见。
- 仅项目可见的技能应放在 `<repo>/.codex/skills`、`<repo>/.claude/skills`。

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
  index/sessions.jsonl
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
```

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

手动打开 `~/.zshrc`，删除下面这个区块，再重新加载 shell：

```zsh
# >>> contextdb-shell >>>
...
# <<< contextdb-shell <<<
```

然后执行：

```bash
source ~/.zshrc
```

删除后 `codex/claude/gemini` 会恢复原生行为。
