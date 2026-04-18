# RexCLI (AIOS)

本项目是一个面向 `Codex CLI`、`Claude Code`、`Gemini CLI`、`OpenCode` 的本地 Agent 工作流仓库。  
目标不是做一个新的聊天客户端，而是给现有 CLI 增加三件事：

1. 统一浏览器自动化能力（Playwright MCP，`browser_*` 工具）
2. 跨 CLI 共享的文件系统 Context DB（可追溯会话记忆）
3. 配置/密钥文件读取前的 Privacy Guard 脱敏（`~/.rexcil/privacy-guard.json`）

## 快速理解（RexCLI 到底是什么）

RexCLI 是一层“AI 记忆系统 + 编排层”，叠加在你已有的编码 Agent 之上。  
如果你正在搜索 **记忆系统**、**Hermes 引擎**、**Agent Team**、**自动化规划子代理** 这些关键词，本项目可分别通过 `ContextDB`、`team`、`orchestrate` 提供对应能力。

本项目重点覆盖的搜索意图：

- 面向 coding agent 的 AI 记忆系统（`ContextDB`）
- 跨会话共享记忆
- 类 Hermes 引擎的编排与自动化流程
- 多智能体协作的 Agent Team 运行时
- 自动化子代理规划与执行门控

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

一键 Team 运行时（推荐）：

```bash
aios team 3:codex "Ship X"
aios team 2:claude "Ship X"
aios team 2:gemini "Ship X" --dry-run
aios team --resume <session-id> --retry-blocked --provider codex --workers 2
```

通过 orchestrate 手动执行 live（会产生 token 成本，需显式 opt-in）：

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # 或 claude-code / gemini-cli
export AIOS_SUBAGENT_CONCURRENCY=3
aios orchestrate --session <session-id> --dispatch local --execute live --format json
```

提示（codex-cli）：推荐 Codex CLI >= v0.114。AIOS 会在可用时自动使用 `codex exec` 的结构化输出（`--output-schema` + `--output-last-message` + stdin），旧版本会自动降级为 stdout 解析。

### HUD（会话可见性）

```bash
aios hud --provider codex
aios hud --watch --preset full
aios hud --session <session-id> --json
```

### Team 运维（status/history）

```bash
aios team status --provider codex --watch
aios team history --provider codex --limit 20
```

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
- `agent-sources/`: orchestrator agents 的 canonical source tree
- `memory/specs/orchestrator-agents.json`: 提供给 orchestrator/runtime 的生成兼容导出
- `.claude/agents` / `.codex/agents`: 由 `node scripts/generate-orchestrator-agents.mjs` 管理的仓库内生成目录
- `memory/context-db/`: 本仓库会话数据（本地产物，已忽略提交）
- `config/browser-profiles.json`: 浏览器 profile/CDP 配置

Agent 目录说明：

- 运行 `node scripts/generate-orchestrator-agents.mjs` 会同时刷新兼容导出和仓库内 agent catalogs。
- 运行 `node scripts/generate-orchestrator-agents.mjs --export-only` 只刷新 `memory/specs/orchestrator-agents.json`。
- `gemini` 和 `opencode` 在 v1 里仍复用 Claude/Codex 的兼容 catalogs，还没有单独的仓库原生 agent 根目录。
- AIOS 的 native enhancements 会先给 `gemini`、`opencode` 提供兼容层 repo-local bootstrap 文档，更深的原生接入仍然优先落在 `codex`、`claude`。

## 前置条件

- Git
- Node.js **22 LTS** 并带 `npm`
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
3. 如果启用了 `Skills`，需要时可以进入 skill picker：
   setup/update 里已安装项会带 `(installed)` 标记
   uninstall 只显示已安装项，支持滚动，并提供 `Select all` / `Clear all`
   小贴士：可以勾选 `debug`，用于证据优先的运行时调试（自带本地 NDJSON 日志采集器）。
4. 等安装跑完后，再执行一次 `Doctor`
5. 如果装了 shell 包装层，记得重新加载终端配置

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
# 安装 shell 包装 + skills + native + superpowers
scripts/setup-all.sh --components shell,skills,native,superpowers --mode opt-in

# 只安装 browser MCP
scripts/setup-all.sh --components browser
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components shell,skills,native,superpowers -Mode opt-in
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

TUI 可见变化提示：

- 主菜单新增 `HUD`，用于快速查看最近会话状态（provider/preset/watch）。
- `Setup`/`Update` 默认勾选 `Native enhancements`，并显示实时的 native 预览区块。
- `Confirm` 页面会重复展示 native 分层和受管输出，并给出运行后校验提示。
- `Doctor` 页面新增 `Verbose output`、`Auto-fix native`、`Dry-run auto-fix`。
- 执行 `doctor --native --fix` 后，`Confirm` 完成页会展示 `Repair ID`、`Repair Summary` 和回滚命令。
- 在该完成页可按 `R` 一键回滚当前修复，并立即重新执行 native doctor 校验。
- 运行页会实时显示生命周期日志，并在出现 `[wait] sync lock busy` 时即时提示正在等待同步锁。
- `Client` / `Skills scope` / `Mode` 字段支持 `←/→` 前后切换。

### 3) 高级模式：分组件脚本

如果你想按组件独立管理，也可以使用 `scripts/` 里的拆分脚本：

- Browser MCP：`install-browser-mcp.*`、`doctor-browser-mcp.*`、`start/stop/restart/status-browser-cdp.*`
- Shell 包装：`install/update/uninstall/doctor-contextdb-shell.*`
- 全局 Skills：`install/update/uninstall/doctor-contextdb-skills.*`
- Superpowers：`install/update/doctor-superpowers.*`

现在 `setup --components browser` / `update --components browser` 默认会以 auto-heal 模式运行 browser doctor（等价包含 `--fix`），当默认 `cdpPort` 不可达时会自动尝试恢复。

CDP 服务常用命令（macOS）：

```bash
scripts/doctor-browser-mcp.sh --fix
scripts/start-browser-cdp.sh
scripts/status-browser-cdp.sh
scripts/restart-browser-cdp.sh
scripts/stop-browser-cdp.sh
```

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
- 仓库内 skills 的 canonical 源文件现在统一放在 `skill-sources/`；repo-local 的 `.codex/skills`、`.claude/skills`、`.agents/skills` 是由 `node scripts/sync-skills.mjs` 生成的兼容输出。
- `aios` 的 skills 安装由 `config/skills-catalog.json` 驱动，catalog 里的 `source` 现在指向 `skill-sources/<skill>`。
- skills 安装默认使用可移植的 copy 模式；`--install-mode link` 只适合明确要回链到当前仓库的本地开发场景。
- skills 安装脚本默认会跳过同名但未受管的已有目录；只有你明确要替换已受管安装时再使用 `--force`。
- 用 `--scope global` 把通用技能安装到用户 home；用 `--scope project` 把技能安装到另一个工作区。当前 source repo 自己的 repo-local skill roots 由 sync 管理，所以当 `projectRoot === rootDir` 时请改用 `node scripts/sync-skills.mjs`。
- 用 `--skills <name1,name2>` 只安装或卸载你明确选中的技能。
- skills doctor 无论当前选择的是哪个 scope，都会报告同名技能的 project 覆盖 global 冲突。
- 安装在 `~/.codex/skills`、`~/.claude/skills`、`~/.gemini/skills`、`~/.config/opencode/skills` 的技能是全局安装目标。
- 项目级技能会安装到 `<repo>/.codex/skills`、`<repo>/.claude/skills`、`<repo>/.gemini/skills`、`<repo>/.opencode/skills`；但本仓库的 canonical authoring tree 仍然是 `skill-sources/`。
- 即梦、小红书这类强业务工作流技能通常应保持为项目级，而不是默认全局安装。
- 在发版前运行 `node scripts/check-skills-sync.mjs`，确认生成目录仍与 `skill-sources/` 保持一致。
- 不要把带 `SKILL.md` 的可发现技能放进 `.baoyu-skills/` 之类的平行目录；这类目录不会被 Codex/Claude 当作 repo-local skills 发现。本仓库唯一受支持的 canonical skills authoring root 是 `skill-sources/`。
- `CODEX_HOME` 可以使用相对路径（包装器会在运行时按当前工作目录解析），但全局场景仍推荐绝对路径以减少歧义。

如果你不希望跨项目复用技能，请把自定义技能放在仓库本地目录，而不是 `~` 下的全局目录。

示例：

```bash
# 安装可跨项目复用的全局技能
node scripts/aios.mjs setup --components skills --client codex --scope global --skills find-skills,verification-loop

# 安装 DESIGN.md 工作流技能（VoltAgent awesome-design-md）
node scripts/aios.mjs setup --components skills --client codex --scope global --skills awesome-design-md

# 安装前端设计执行技能（支持“无设计稿”）
node scripts/aios.mjs setup --components skills --client codex --scope global --skills frontend-design

# 两者一起装（推荐：没有设计稿时）
node scripts/aios.mjs setup --components skills --client codex --scope global --skills awesome-design-md,frontend-design

# 把仓库专用工作流技能安装到当前项目
node scripts/aios.mjs setup --components skills --client codex --scope project --skills xhs-ops-methods,aios-jimeng-image-ops

# 仅本地开发使用：保持技能安装回链到当前仓库
node scripts/aios.mjs setup --components skills --client codex --scope global --install-mode link --skills find-skills
```

### 3.2.0 官方文案：无设计稿也能做高质量 UI

对外一句话（可直接用于产品文案）：

`没有设计稿，也能做出好看的界面：先用 DESIGN.md 锁定风格，再用 frontend-design 落地页面实现。`

用户引导文案（可用于 onboarding）：

1. 在你的项目根目录安装技能（推荐项目级）：

```bash
node <AIOS_ROOT>/scripts/aios.mjs setup --components skills --client codex --scope project --skills awesome-design-md,frontend-design
```

2. 先生成一个风格基线（`DESIGN.md`）：

```bash
npx --yes getdesign@latest list
npx --yes getdesign@latest add linear --force
```

3. 给 agent 下达固定指令：

```text
先按 DESIGN.md 定风格，再用 frontend-design 落地实现页面。
```

客服 FAQ（可直接复用）：

- Q: 我没有设计稿，能用吗？
- A: 可以。我们就是为“无设计稿”场景设计的，先自动生成 `DESIGN.md` 风格基线，再由 `frontend-design` 生成页面代码。
- Q: 我不会设计，选什么风格？
- A: 可以先用 `linear`（SaaS）、`framer`（营销页）、`mintlify`（文档站）作为默认起点，后续再微调。
- Q: 会不会生成千篇一律模板？
- A: 这套流程会先锁定风格约束，再实现页面，能明显减少“模板味”。

模糊提示词兼容（建议默认开启）：

- 用户即使只说一句模糊话，也可以自动收敛：
  - `把这个页面某个元素改一下，更高级一点`
  - `参考某种风格重做这个页面`
  - `做一个完整的 SaaS 后台界面流程`
- 推荐在产品里加一条系统提示词：

```text
当用户需求模糊时，请先自动判断是 Patch/Restyle/Flow 三类中的哪一类；基于 DESIGN.md 锁定风格后再实现页面。输出必须包含完整交互状态（hover/focus/active/disabled）以及核心流程的 loading/empty/error/success。
```

完整文案包见：

- [docs/zh-CN/design-skills-official-copy.md](docs/zh-CN/design-skills-official-copy.md)

可选：第三方 Skills（不依赖 `aios`）

本仓库已经把一批常用技能以 `skill-sources/` 的方式内置（包含 `debug`），因此能直接出现在 TUI 的 skill picker 里。
如果你想装 *catalog 之外* 的额外技能，也可以用 Skills CLI 安装外部仓库的技能（独立于 `aios` 的 catalog 机制）：

```bash
# 按关键字搜索技能
npx skills find <keyword>

# 列出外部仓库有哪些技能（不安装）
npx skills add <owner>/<repo> --list

# 安装某个技能
# -g：全局安装；-a codex：安装到 Codex 的技能目录；-y：跳过确认
npx skills add <owner>/<repo> --skill <skill-name> -g -a codex -y

# 后续统一更新外部技能
npx skills update
```

注：尽量避免安装与本仓库内置技能同名的第三方 skill（例如 `debug`），否则 skills doctor 会提示 project/global 冲突。

### 3.2.1 Native enhancements（仓库本地）

`native` 是在 shell 包装和 skill 安装之上的 repo-local 原生增强层。

- `skills` 负责 catalog 驱动的 home/project 技能安装。
- `agents` 仍然保留为面向高级用户的 repo-local agent 直连同步面。
- `native` 则把 repo-local skills、repo-local agents、以及受管 bootstrap/config 片段组合成一个对客户端可感知的原生增强层。

v1 分层：

- 深度层：`codex`、`claude`
- 兼容层：`gemini`、`opencode`

`native` 当前会管理这些 repo-local 输出：

- `codex`：`AGENTS.md`、`.codex/agents`、`.codex/skills`、`.codex/.aios-native-sync.json`
- `claude`：`CLAUDE.md`、`.claude/settings.local.json`、`.claude/agents`、`.claude/skills`、`.claude/.aios-native-sync.json`
- `gemini`：`.gemini/AIOS.md`、`.gemini/skills`、`.gemini/.aios-native-sync.json`
- `opencode`：`.opencode/AIOS.md`、`.opencode/skills`、`.opencode/.aios-native-sync.json`

命令示例：

```bash
# 为单个客户端同步 repo-local native 增强
node scripts/aios.mjs setup --components native --client codex

# 刷新 repo-local native 增强
node scripts/aios.mjs update --components native --client claude

# 只跑 native doctor
node scripts/aios.mjs doctor --native

# 输出每个 client 的 metadata/targets 解释信息
node scripts/aios.mjs doctor --native --verbose

# 自动修复 native 漂移/冲突
node scripts/aios.mjs doctor --native --fix

# 仅预览 auto-fix 变更，不落盘
node scripts/aios.mjs doctor --native --fix --dry-run

# 回滚最近一次已落盘的 native 修复包
node scripts/aios.mjs internal native rollback --repair-id latest

# 查看近期 native 修复会话列表
node scripts/aios.mjs internal native repair list --limit 20

# 查看单个 native 修复会话详情（改动文件 + 回滚状态）
node scripts/aios.mjs internal native repair show --repair-id latest

# repo 维护者使用的 sync/check 入口
node scripts/sync-native.mjs
node scripts/check-native-sync.mjs
```

`sync-native` 与 `sync-skills` 现在共享仓库锁（`.aios/.locks/native-skills-sync.lock`），并发执行时会自动串行，避免互相覆盖。

TUI 快速自检：

1. 运行 `aios`，进入 `Setup`（或 `Update`）。
2. 保持 `Native enhancements` 勾选，切换 `Client`。
3. 确认 native 预览区块会随 client/tier 变化。
4. 执行后再跑 `node scripts/aios.mjs doctor --native`。

冲突策略：

- `AGENTS.md` 和 `CLAUDE.md` 只会更新 marker 包围的受管片段，外层用户文本会保留。
- `.claude/settings.local.json` 只会在 `aiosNative` key 下合并，不会覆盖无关配置。
- `.gemini/AIOS.md`、`.opencode/AIOS.md` 这类兼容层文档属于 AIOS 受管文件；如果被手改，`doctor --native` 会报告冲突，并提示你重新执行 `node scripts/aios.mjs update --components native --client <client>`。
- `doctor --native --fix` 现在会在写入前对 native 受管目标做快照。修复成功后会输出 repair id（`[repair] id=...`）和回滚命令（`node scripts/aios.mjs internal native rollback --repair-id <id>`）。
- `doctor --native --fix` 会输出具体改动文件清单（`[repair] changed ...`），方便直接核对修复影响。
- `doctor --native --fix --dry-run` 会输出计划改动的目标文件清单（`[plan] native files ...`），且不会落盘。
- `internal native repair list/show` 支持在事后找回 repair id、改动文件与回滚状态，不依赖当次执行日志。
- 发版前运行 `node scripts/check-native-sync.mjs`，确认 repo-local native 输出仍与 `client-sources/native-base/` 保持一致。

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
- `codex` / `claude` / `gemini` / `opencode` 包装器默认都会注入自动路由启动提示，智能体可在对话中自行判定 `single/subagent/team` 并直接触发 `aios team` / `aios orchestrate`，无需用户手动下触发命令
- `opencode` 会自动回退到受支持的 subagent runtime（默认 `codex-cli`，也可用 `CTXDB_ROUTE_SUBAGENT_CLIENT=<codex-cli|claude-code|gemini-cli>` 覆盖）
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

从已经提交的版本 bump 提交创建并发布稳定版 GitHub Release tag：

```bash
scripts/release-stable.sh --dry-run
scripts/release-stable.sh
```

稳定安装走 GitHub Releases；开发安装只保留 `git clone main`，它不等同于带版本保证的 stable release。

版本判断技能文件：

- `skill-sources/versioning-by-impact/SKILL.md`
- 生成后的镜像会同步到 `.codex/skills/versioning-by-impact/` 和 `.claude/skills/versioning-by-impact/`

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
