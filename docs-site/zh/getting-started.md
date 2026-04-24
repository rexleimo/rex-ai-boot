---
title: 快速开始
description: 一套流程覆盖 macOS、Linux、Windows，通过标签切换不同命令。
---

# 快速开始

本页已合并 macOS、Linux、Windows 的安装流程。命令不同时，按系统标签切换执行。

## 快速答案（AI 搜索）

`RexCLI` 不替换原生 CLI，而是在保留 `codex`、`claude`、`gemini` 原命令习惯的同时，增加项目级 ContextDB 记忆和统一 Browser MCP 能力。

## 前置条件

- Node.js **22 LTS** 并带 `npm`
- 至少安装一个 CLI：`codex`、`claude`、`gemini`
- 一个用于启用项目级 ContextDB 的项目/工作区目录

## 0) 安装（推荐）

本仓库默认安装到 `~/.rexcil/rex-cli`。统一入口是 `aios`：

- 直接运行 `aios`（无参数）会打开全屏交互式 TUI
- `aios doctor|update|privacy ...` 等子命令保持兼容

### 方案 C：一条命令安装（GitHub Releases，推荐）

这是稳定版安装路径，依赖已经发布到 GitHub Releases 的安装资产。

=== "macOS / Linux"

    ```bash
    curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
    source ~/.zshrc
    aios
    ```

=== "Windows (PowerShell)"

    ```powershell
    irm https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.ps1 | iex
    . $PROFILE
    aios
    ```

### 方案 A：git clone（适合开发/可控）

只有当你明确要使用 `main` 分支上的未发布行为时，才走这个路径。它是开发安装路径，不是稳定版发布安装路径。

=== "macOS / Linux"

    ```bash
    git clone https://github.com/rexleimo/rex-cli.git ~/.rexcil/rex-cli
    cd ~/.rexcil/rex-cli
    scripts/aios.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    git clone https://github.com/rexleimo/rex-cli.git $HOME\.rexcil\rex-cli
    cd $HOME\.rexcil\rex-cli
    powershell -ExecutionPolicy Bypass -File .\scripts\aios.ps1
    ```

### 方案 B：从 GitHub Releases 下载（离线友好）

从 Releases 下载 `rex-cli.tar.gz`（macOS/Linux）或 `rex-cli.zip`（Windows），解压到 `~/.rexcil/` 后运行 `scripts/aios.sh` / `scripts/aios.ps1`。

### TUI 启动欢迎横幅

运行 `aios` 启动 TUI 时，会先显示青色的 ASCII 艺术横幅：

```
  ╔══════════════════════════════════════════╗
  ║   ██████╗ ██╗  ██╗██╗██████╗  ██████╗    ║
  ║   ██╔══██╗██║ ██╔╝██║██╔══██╗██╔════╝    ║
  ║   ██████╔╝█████╔╝ ██║██████╔╝██║         ║
  ║   ██╔══██╗██╔═██╗ ██║██╔══██╗██║         ║
  ║   ██║  ██║██║  ██╗██║██║  ██║╚██████╗    ║
  ║   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝    ║
  ║          Hello, Rex CLI!                 ║
  ╚══════════════════════════════════════════╝
```

横幅下方会显示仓库路径，确认 TUI 已准备就绪。

### 推荐：用 TUI 完成安装

安装完成后，推荐直接走这次迭代主推的 TUI 流程：

1. 运行 `aios`
2. 选择 **Setup**
3. 按目标选择组件组合：
   - `all`：完整安装
   - `shell,skills,superpowers`：优先装共享记忆 + 技能
   - `browser`：只装 Browser MCP
4. 如果启用 **Skills**：
   - 安装默认使用可移植的 `copy` 模式
   - 只有在明确要把安装结果回链到当前仓库时，才使用 `--install-mode link`
   - setup/update 会给已安装技能显示 `(installed)`
   - uninstall 只展示当前 scope/client 下真的已安装技能
5. 安装结束后，在同一个 TUI 里继续跑 **Doctor**
6. 如果装了 shell 包装层，记得重新加载：
   - macOS / Linux：`source ~/.zshrc`
   - Windows PowerShell：`. $PROFILE`

### 仓库贡献者：skills 主源已迁到 `skill-sources/`

如果你是在维护本仓库本身，而不是只把它装到自己环境里：

- canonical skill source files 放在 `skill-sources/`
- repo-local 的 `.codex/skills`、`.claude/skills`、`.agents/skills`、`.gemini/skills`、`.opencode/skills` 都是生成产物
- 用下面两个命令维护一致性：

```bash
node scripts/sync-skills.mjs
node scripts/check-skills-sync.mjs
```

### 0.1 Privacy Guard 严格读取（默认开启）

现在 shell 安装会自动初始化 `~/.rexcil/privacy-guard.json`，并默认开启严格脱敏策略。
读取配置/密钥类文件时必须走以下入口：

=== "macOS / Linux"

    ```bash
    aios privacy read --file <path>
    ```

=== "Windows (PowerShell)"

    ```powershell
    aios privacy read --file <path>
    ```

可选本地模型路径（Ollama + `qwen3.5:4b`）：

=== "macOS / Linux"

    ```bash
    aios privacy ollama-on
    ```

=== "Windows (PowerShell)"

    ```powershell
    aios privacy ollama-on
    ```

启动被 ContextDB shell 包装的交互式 `codex` / `claude` / `gemini` / `opencode` 时，会打印 Privacy Shield 面板，提示当前 Privacy Guard、模型端点/中转站和敏感文件读取策略。

=== "macOS / Linux"

    ```bash
    CTXDB_PRIVACY_BANNER=0 codex      # 临时隐藏面板
    CTXDB_PRIVACY_COLOR=0 codex       # 保留面板但关闭 ANSI 颜色
    ```

=== "Windows (PowerShell)"

    ```powershell
    $env:CTXDB_PRIVACY_BANNER = "0"; codex
    $env:CTXDB_PRIVACY_COLOR = "0"; codex
    ```

说明：Privacy Shield 会提醒 agent 遵守隐私规则，但无法数学证明大模型在生成过程中严格遵循提示词。可验证的保护来自 wrapper、Privacy Guard、ContextDB 打包、MCP 工具和日志/检查点写入前的确定性检查。

按需选择组件示例：

提示：如果你通过一条命令安装，仓库会在 `~/.rexcil/rex-cli`。
可以 `cd ~/.rexcil/rex-cli` 后再跑这些脚本，或者直接运行 `aios` 在 TUI 里选择 **Setup**。

=== "macOS / Linux"

    ```bash
    # 仅安装 shell 包装 + skills
    scripts/setup-all.sh --components shell,skills --mode opt-in

    # 仅安装 browser MCP
    scripts/setup-all.sh --components browser
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components shell,skills -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components browser
    ```

一条命令更新 / 卸载：

=== "macOS / Linux"

    ```bash
    scripts/update-all.sh --components all --mode opt-in
    scripts/uninstall-all.sh --components shell,skills
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-all.ps1 -Components all -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-all.ps1 -Components shell,skills
    ```

如果你更喜欢分组件安装，继续看下面 1-8 步。

## 1) 安装 Browser MCP

=== "macOS / Linux"

    ```bash
    scripts/install-browser-mcp.sh
    scripts/doctor-browser-mcp.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-browser-mcp.ps1
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-browser-mcp.ps1
    ```

## 2) 构建 ContextDB CLI

```bash
cd mcp-server
npm install
npm run build
```

说明：

- `mcp-server` 的 npm scripts 现在会自动按 `.nvmrc` 解析项目运行时，预期统一运行在 Node 22 LTS。
- 如果看到 `Unable to resolve a Node runtime matching .nvmrc=22`，先安装并切换到 Node 22（例如 `nvm install 22 && nvm use 22`），再重试命令。

## 3) 安装命令包装（推荐）

=== "macOS / Linux (zsh)"

    ```bash
    scripts/install-contextdb-shell.sh --mode opt-in
    scripts/doctor-contextdb-shell.sh
    source ~/.zshrc
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1 -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-contextdb-shell.ps1
    . $PROFILE
    ```

## 4) 启用当前项目

=== "macOS / Linux"

    ```bash
    touch .contextdb-enable
    ```

=== "Windows (PowerShell)"

    ```powershell
    New-Item -ItemType File -Path .contextdb-enable -Force
    ```

## 5) 开始使用

```bash
cd /path/to/your/project
codex
# 或
claude
# 或
gemini
```

## 5.1) 可选：运营/门禁工具（quality-gate + learn-eval + orchestrate）

仓库健康门禁（包含 ContextDB 回归检查）：

```bash
aios quality-gate pre-pr --profile strict
```

分析最近一次会话的遥测：

```bash
aios learn-eval --limit 10
```

生成本地编排调度骨架（不调用模型）：

```bash
aios orchestrate --session <session-id> --preflight auto --format json
```

通过 CLI 子代理执行 live（会产生 token 成本，需显式 opt-in）：

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # 必须（live 当前仅支持 codex-cli）
aios orchestrate --session <session-id> --dispatch local --execute live --format json
```

提示（codex-cli）：推荐 Codex CLI >= v0.114。AIOS 会在可用时自动使用 `codex exec` 的结构化输出（`--output-schema`、`--output-last-message`、stdin），旧版本会自动降级为 stdout 解析。

可选控制项：

- `AIOS_SUBAGENT_CONCURRENCY`（默认：`3`）
- `AIOS_SUBAGENT_TIMEOUT_MS`（默认：`600000`）

### 5.1.1) 路由 + 并发配置（推荐）

如果你想保留并发能力、又不想记太多变量，直接用这组简化配置：

需要独立速查页可看：[路由与并发档位](route-concurrency-profiles.md)。

```bash
export CTXDB_INTERACTIVE_AUTO_ROUTE=1
export CTXDB_CODEX_DISABLE_MCP=1
export CTXDB_TEAM_WORKERS=3
export AIOS_SUBAGENT_CONCURRENCY=3
```

各变量含义：

- `CTXDB_INTERACTIVE_AUTO_ROUTE`：是否在交互包装层注入自动路由策略（`single/subagent/team`）
- `CTXDB_CODEX_DISABLE_MCP`：包装后的 `codex` 是否跳过 MCP 启动（设为 `1` 可规避 MCP 冷启动卡顿）
- `CTXDB_TEAM_WORKERS`：`aios team ...` 的并行 worker 数
- `AIOS_SUBAGENT_CONCURRENCY`：`aios orchestrate --execute live` 的并行执行数

推荐档位：

- 默认均衡（推荐）：`3 + 3`
- 高吞吐：`4 + 4`
- 调试稳态：`1 + 1`

## 5.2) 可选：HUD 和 Team Ops 可见性

使用 HUD 查看会话状态：

```bash
aios hud --provider codex
aios hud --watch --preset full
aios hud --session <session-id> --json
```

Team Ops 状态和历史：

```bash
aios team status --provider codex --watch
aios team history --provider codex --limit 20
```

Skill-candidate 详细视图（2026-04-09+）：

```bash
# 显示 skill candidates，使用默认限制（普通模式 6 个，fast-watch minimal 模式 3 个）
aios team status --show-skill-candidates

# 配置 candidate 限制（1-20）
aios team status --show-skill-candidates --skill-candidate-limit 10

# Fast-watch 模式自动使用最小限制（3 个 candidates）
aios team status --watch --fast

# HUD 也支持 skill-candidate 视图
aios hud --show-skill-candidates --skill-candidate-limit 5
```

Quality-gate 类别过滤器（2026-04-08+）：

```bash
# 只显示 quality-gate 失败的会话
aios team history --quality-failed-only

# 按 quality category prefix 过滤
aios team history --quality-category clarity
aios team history --quality-category sample.latency-watch
```

Dispatch hindsight 和 draft 推荐（2026-04-07+）：

```bash
# Learn-eval 显示 draft skill-candidate patches
aios learn-eval --limit 10

# HUD 在可用时会建议 skill-candidate apply 命令
aios hud --session <session-id>
```

## 6) 验证数据已生成

=== "macOS / Linux"

    ```bash
    ls memory/context-db
    ```

=== "Windows (PowerShell)"

    ```powershell
    Get-ChildItem memory/context-db
    ```

你应该能看到 `sessions/`、`index/`、`exports/`。

## 7) 更新 / 卸载包装

=== "macOS / Linux"

    ```bash
    scripts/update-contextdb-shell.sh --mode opt-in
    scripts/uninstall-contextdb-shell.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-shell.ps1 -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-shell.ps1
    ```

## 8) 可选：全局安装本项目 Skills

仅当你希望在其他项目也能直接使用本仓库 skills 时再执行。
`--client all` 会同时安装到 `codex`、`claude`、`gemini`、`opencode`。

=== "macOS / Linux"

    ```bash
    scripts/install-contextdb-skills.sh --client all
    scripts/doctor-contextdb-skills.sh --client all
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-skills.ps1 -Client all
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-contextdb-skills.ps1 -Client all
    ```

Skills 生命周期：

=== "macOS / Linux"

    ```bash
    scripts/update-contextdb-skills.sh --client all
    scripts/uninstall-contextdb-skills.sh --client all
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-skills.ps1 -Client all
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-skills.ps1 -Client all
    ```

## 常见问答

### 这会替代原生 CLI 吗？

不会。你仍然运行原命令，包装层只负责注入上下文。

### 如何避免跨项目上下文串扰？

设置 `CTXDB_WRAP_MODE=opt-in`，并且只在需要的项目根目录创建 `.contextdb-enable`。

### 安装包装器后会自动安装 skills 吗？

不会。包装器与 skills 是两层能力，默认分离。需要全局 skills 时执行第 8 步。

### 为什么会出现 `CODEX_HOME points to ".codex"`？

说明 `CODEX_HOME` 被设置成了相对路径。改为绝对路径即可：

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

### 浏览器工具失效时先执行什么？

先执行 `doctor-browser-mcp` 诊断脚本，再决定是否重装。
