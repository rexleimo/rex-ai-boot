# RexCLI (AIOS)

本项目是一个面向 `Codex CLI`、`Claude Code`、`Gemini CLI` 的本地 Agent 工作流仓库。  
目标不是做一个新的聊天客户端，而是给现有 CLI 增加三件事：

1. 统一浏览器自动化能力（Playwright MCP，`browser_*` 工具）
2. 跨 CLI 共享的文件系统 Context DB（可追溯会话记忆）
3. 配置/密钥文件读取前的 Privacy Guard 脱敏（`~/.rexcil/privacy-guard.json`）

## 先用起来（不想看原理就看这里）

关键入口：

- 项目地址（GitHub）：`https://github.com/rexleimo/rex-cli`
- 文档站：`https://cli.rexai.top`
- 博客：`https://cli.rexai.top/blog/`
- 官方案例库：`https://cli.rexai.top/case-library/`
- 友情链接：`https://os.rexai.top` / `https://rexai.top` / `https://tool.rexai.top`

30 秒安装（推荐：GitHub Releases）：

```bash
curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
source ~/.zshrc
aios
```

30 秒安装（Windows PowerShell）：

```powershell
irm https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.ps1 | iex
. $PROFILE
aios
```

推荐的 TUI 安装路径（第一次运行最好这么做）：

1. 运行 `aios`
2. 在全屏菜单中选择 `Setup`
3. 按目标选择组件组合：
   - `all`：完整安装
   - `shell,skills,superpowers`：先把记忆/技能链路装好
   - `browser`：只安装 Browser MCP
4. 安装完成后再跑一次 `Doctor`

备选：git clone（适合开发/可控）：

生命周期说明：

- `node scripts/aios.mjs` 现在是统一实现入口。
- `scripts/aios.sh` / `scripts/aios.ps1` 以及 `setup-all/update-all/verify-aios` 继续保留，但只作为兼容包装层。

macOS / Linux：

```bash
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
scripts/aios.sh
```

Windows PowerShell：

```powershell
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
powershell -ExecutionPolicy Bypass -File .\scripts\aios.ps1
```

## 你最关心的点：为什么直接输入 `codex` 也会带 ContextDB？

原理是 **zsh 包装函数透明接管**：

- [`scripts/contextdb-shell.zsh`](scripts/contextdb-shell.zsh) 通过 shell function 接管 `codex()`、`claude()`、`gemini()`
- 这些函数会委托给 [`scripts/contextdb-shell-bridge.mjs`](scripts/contextdb-shell-bridge.mjs)，由 bridge 统一判断包裹或透传
- 当满足包裹条件时，bridge 会调用 [`scripts/ctx-agent.mjs`](scripts/ctx-agent.mjs)，优先把当前 git 根目录作为 `--workspace`，若无法识别 git 根目录则回退到当前目录
- 在非 git 目录下，bridge 现在会回退到当前目录作为工作区；管理子命令（如 `codex mcp`、`gemini hooks`）仍会直接透传到原命令

所以你仍然输入原命令，体验上不需要改操作习惯。

## 自动首任务 Bootstrap

现在在某个工作区第一次运行 `codex` / `claude` / `gemini` 时，若满足以下条件，AIOS 会自动创建一个轻量引导任务：

- `tasks/.current-task` 不存在或为空
- `tasks/pending/` 没有非隐藏任务条目

会生成：

- `tasks/pending/task_<timestamp>_bootstrap_guidelines/task.json`
- `tasks/pending/task_<timestamp>_bootstrap_guidelines/prd.md`
- `tasks/.current-task`

关闭方式：

- 全局关闭：`export AIOS_BOOTSTRAP_AUTO=0`
- 单次关闭：`scripts/ctx-agent.mjs ... --no-bootstrap`

## Operator 工具箱（Quality Gate / Learn-Eval / Orchestrate）

这些命令用于在“接入真实并发 runtime 之前”，把流程门禁、失败语义、记忆闭环先跑通，并且保持本地可复现。

### Quality Gate（仓库健康检查 + ContextDB 回归门禁）

跑完整门禁：

```bash
aios quality-gate full
```

跑更严格的 pre-PR 门禁：

```bash
aios quality-gate pre-pr --profile strict
```

按需禁用某个检查（逗号分隔）：

```bash
AIOS_DISABLED_GATES=quality:contextdb aios quality-gate pre-pr
```

### Learn-Eval（把 checkpoint 遥测变成可执行建议）

```bash
aios learn-eval --limit 10
aios learn-eval --session <session-id> --format json
```

### Orchestrate（蓝图 + 本地调度骨架 + 免 token dry-run）

预览蓝图：

```bash
aios orchestrate feature --task "Ship X"
```

生成本地调度计划（不调用模型，不执行）：

```bash
aios orchestrate --session <session-id> --dispatch local --execute none --format json
```

本地模拟执行（仍不调用模型）：

```bash
aios orchestrate --session <session-id> --format json
# 可选：在最终 DAG 选择前先跑支持的 gate/runbook 动作
aios orchestrate --session <session-id> --preflight auto --format json
```

通过 CLI 子代理执行 live（会产生 token 成本，需显式 opt-in；当前仅支持 codex-cli）：

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # 必须（live 当前仅支持 codex-cli）
aios orchestrate --session <session-id> --dispatch local --execute live --format json
```

提示（codex-cli）：推荐 Codex CLI >= v0.114。AIOS 会在可用时自动使用 `codex exec` 的结构化输出（`--output-schema` + `--output-last-message` + stdin），旧版本会自动降级为 stdout 解析。

### Context Pack Fail-Open（避免包装层硬崩）

默认情况下，如果 `contextdb context:pack` 失败，`ctx-agent` 会**告警并继续运行**（不注入上下文，也不让 `codex/claude/gemini` 整体起不来）。

如果你希望 context packet 失败直接中断（严格模式）：

```bash
export CTXDB_PACK_STRICT=1
```

注意：shell wrapper（`codex`/`claude`/`gemini`）默认会 fail-open，即便设置了 `CTXDB_PACK_STRICT=1` 也不会让交互式会话直接“起不来”。如果你希望包装层也严格执行：

```bash
export CTXDB_PACK_STRICT_INTERACTIVE=1
```

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
- `scripts/privacy-guard.mjs`: Privacy Guard CLI（`init/status/set/redact`）
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
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
```

## 官方案例库

如果你要快速了解“这个仓库到底能做什么”，请直接看：

- 文档站：`https://cli.rexai.top/case-library/`
- 仓库文档：[`docs-site/case-library.md`](docs-site/case-library.md)

### 1) 推荐在 TUI 里完成安装

macOS / Linux：

```bash
scripts/aios.sh
```

Windows（PowerShell）：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\aios.ps1
```

进入 TUI 后按下面走：

1. 选择 `Setup`
2. 选择 `all`、`shell,skills,superpowers` 或 `browser`
3. 等安装跑完后，再执行一次 `Doctor`
4. 如果装了 shell 包装层，记得重新加载终端配置

这是本次迭代最清晰的首次安装路径。下面仍保留脚本命令，方便自动化或非交互场景。

Shell 安装时会自动初始化 Privacy Guard，配置文件默认在 `~/.rexcil/privacy-guard.json`。
现已默认启用严格策略：命中敏感配置文件时必须先脱敏读取：

```bash
# 查看状态/严格策略
aios privacy status

# 读取配置类文件必须走这里
aios privacy read --file <path>

# 可选：启用本地 ollama + qwen3.5:4b
aios privacy ollama-on
```

如果你更需要直接脚本控制，可用下面这些非交互示例：

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
# 只在 RexCLI 项目启用
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

### 3.1.1 常见坑：Node ABI 与 `better-sqlite3` 不匹配

如果启动时报错：

```text
contextdb init failed: ... better_sqlite3.node ...
... compiled against NODE_MODULE_VERSION 115 ...
... requires NODE_MODULE_VERSION 127 ...
```

根因：
- 包装层会用你当前 shell 的 Node 运行时执行 ContextDB。
- `mcp-server/node_modules/better-sqlite3` 是原生模块，必须和当前 Node ABI 一致。
- 常见场景是你在 Node 22 项目里运行 `codex`，但 `aios/mcp-server` 依赖是用 Node 20 安装的。

当前行为：
- 包装器会自动识别该错误，并先执行一次 `npm rebuild better-sqlite3` 后重试。
- 如需严格失败不自动修复，可设置 `CTXDB_AUTO_REBUILD_NATIVE=0`。

手动修复（自动重建失败时）：

```bash
cd "$ROOTPATH/mcp-server"
npm rebuild better-sqlite3
# 如果仅 rebuild 不够，再执行：
# npm install
```

验证：

```bash
cd "$ROOTPATH/mcp-server"
npm run contextdb -- init --workspace <你的项目根目录>
```

预防建议：
- 每次切换 Node 主版本后，在 `mcp-server` 重新构建原生依赖。
- 如果不希望跨项目触发包装，保持 `CTXDB_WRAP_MODE=repo-only`（或临时设为 `off`）。

### 3.2 Skills 作用域（重要）

ContextDB 包装和 CLI 的 Skills 加载是两层机制：

- 包装范围由上面的 `CTXDB_WRAP_MODE` 控制。
- 使用上面的 skills 生命周期脚本完成安装/更新/卸载/诊断。
- skills 安装脚本默认会跳过同名已有目录；只有你明确要替换时再使用 `--force` / `-Force`。
- 安装在 `~/.codex/skills`、`~/.claude/skills`、`~/.gemini/skills`、`~/.config/opencode/skills` 的技能是全局可见。
- 仅项目可见的技能应放在 `<repo>/.codex/skills`、`<repo>/.claude/skills`。
- 不要把带 `SKILL.md` 的可发现技能放进 `.baoyu-skills/` 之类的平行目录；这类目录不会被 Codex/Claude 当作 repo-local skills 发现。`.baoyu-skills/` 只适合放 `EXTEND.md` 这类扩展配置。
- `CODEX_HOME` 可以使用相对路径（包装器会在运行时按当前工作目录解析），但全局场景仍推荐绝对路径以减少歧义。

如果你不希望跨项目复用技能，请把自定义技能放在仓库本地目录，而不是 `~` 下的全局目录。

### 3.3 Privacy Guard（默认严格）

Privacy Guard 配置在 `~/.rexcil/privacy-guard.json`，默认开启严格策略。

```bash
# 查看当前配置
aios privacy status

# 读取配置/密钥类文件必须走该入口
aios privacy read --file config/browser-profiles.json
```

可选本地模型模式：

```bash
aios privacy ollama-on
# 等价于 hybrid 模式 + qwen3.5:4b
```

如需临时关闭：

```bash
aios privacy disable
```

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
- 注意：CLI 内的重置命令（如 Codex 的 `/new`、Claude/Gemini 的 `/clear`）会清空对话状态。退出并重新启动 CLI 可重新注入；或在新对话第一句引用 `memory/context-db/exports/latest-<agent>-context.md`。
- 边界：不会在每一轮消息后自动写 checkpoint

### B. One-shot 模式（推荐做全自动闭环）

```bash
scripts/ctx-agent.sh --agent codex-cli --project RexCLI --prompt "继续上次任务并执行下一步"
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
npm run contextdb -- session:new --agent claude-code --project RexCLI --goal "stabilize flow"
npm run contextdb -- event:add --session <id> --role user --text "need retry plan"
npm run contextdb -- checkpoint --session <id> --summary "blocked by auth" --status blocked --next "wait-login|resume"
npm run contextdb -- context:pack --session <id> --out memory/context-db/exports/<id>-context.md
npm run contextdb -- index:rebuild
npm run contextdb -- search --query "auth race" --project RexCLI --kinds response --refs auth.ts
```

可选语义重排（P2）：

```bash
export CONTEXTDB_SEMANTIC=1
export CONTEXTDB_SEMANTIC_PROVIDER=token
npm run contextdb -- search --query "issue auth" --project RexCLI --semantic
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
