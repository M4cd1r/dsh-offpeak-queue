[English](README.md) | **简体中文**

# dsh-offpeak-queue

面向 DeepSeek Harness（DSH）的低谷发送队列。日常消息继续使用原生输入框直接发送；不着急的任务可切换到“低谷再发”，高峰期先暂存，低谷到来后自动投递回原会话。投递时机按**该会话所属 provider** 的高峰时段判断，时段来自 `dsh-offpeak` 插件；未安装时回退到本插件自带的本地时段。

已在 Windows、DSH Desktop 2.0.3、`desktop` profile 下测试。

## 功能特性

- **默认直接发送**：未主动开启“低谷再发”时，DSH 原生输入框保持原有行为。
- **高峰发送拦截**：开启“低谷再发”后，高峰期按 Enter 或点击原生发送按钮都会把当前消息加入队列。
- **按 provider 调度**：每条队列消息记录所属会话的 provider/model，DeepSeek 任务等 DeepSeek 低谷，Z.ai 任务等 Z.ai 低谷，互不干扰。
- **保留多行编辑**：Shift+Enter 继续换行。
- **低谷自动投递**：进入低谷时段后，消息自动发回创建它的原会话。
- **居中队列面板**：等待、工作中、执行记录在 DSH 会话窗口中央展示，不受输入区高度限制。
- **完整队列操作**：支持强制执行、撤销和清空历史。
- **策略可配置**：可调整高峰时段、周末规则、并发数和插件总开关。
- **异常隔离**：host 与 client 的异常只记录并隔离，避免插件故障拖垮 DSH 启动或页面渲染。
- **主题自适应**：胶囊状态条、分区卡片和操作按钮随 DSH 当前主题变化。

## 发送判定

| 插件状态 | 发送模式 | 当前时段 | 结果 |
| --- | --- | --- | --- |
| 已停用 | 任意 | 任意 | 由 DSH 正常发送 |
| 已启用 | 直接发送 | 任意 | 由 DSH 正常发送 |
| 已启用 | 低谷再发 | 低谷 | 由 DSH 正常发送 |
| 已启用 | 低谷再发 | 高峰 | 消息进入队列 |

### Provider 时段

挂载 `dsh-offpeak` 后，队列在每次发送和投递判断时都会向它询问当前会话 provider/model 的时段：

- DeepSeek 会话只在 DeepSeek 高峰时段入队；
- Z.ai 会话只在 Z.ai 高峰时段入队；
- 固定费率 provider 不会入队。

每条队列消息会保留入队时捕获的 provider 和 model，因此不同 provider 的任务独立等待，各自到达低谷后分别投递。

### 回退时段

未安装 `dsh-offpeak`，或该 provider 未在其中配置时段时，队列回退到自己的本地时间规则，并可在队列面板中编辑：

- 高峰时段：`09:00–12:00`、`14:00–18:00`
- 周六、周日：全天视为低谷
- 投递并发数：`1`
- 发送模式：直接发送

以上设置都支持 `22:00–06:00` 这类跨午夜时段。

## 环境要求

- 带 Web 或 Desktop profile 的 DeepSeek Harness
- DSH runtime `>=0.1.5-rc.1`
- Node.js 22.19 或更高版本
- 同一 profile 中挂载 `dsh-offpeak` `>=0.2.0` 以获得按 provider 调度（可选；未安装时回退到本地时段）
- 安装或升级后完整重启 DSH；静态 client bundle 只在启动时加载

## 安装

### 从 npm 安装

要获得按 provider 调度，请先安装并挂载 [dsh-offpeak](https://github.com/AlexShang1992/dsh-offpeak)。队列会读取它的 `offpeak` 设置命名空间与 host 服务。

以下包名安装命令在 `dsh-offpeak-queue` 发布到 npm 后可用。

DSH Desktop：

```powershell
dsh plugin --profile desktop add dsh-offpeak-queue
```

标准 Web profile：

```powershell
dsh plugin --profile web add dsh-offpeak-queue
```

安装完成后，重启 DSH Desktop 或对应的 DSH profile。

### 本地链接调试

```powershell
dsh plugin --profile desktop add "link:E:/path/to/dsh-offpeak-queue"
```

本插件采用原生静态 host/client 双半侧 bundle。请保持它注册在 `dsh.profile.bundles` 中，不要改成运行后动态 `define` 的启动方式。

### 更新与卸载

```powershell
dsh plugin --profile desktop update dsh-offpeak-queue
dsh plugin --profile desktop remove dsh-offpeak-queue
```

请把 `desktop` 替换成实际使用的 profile，并在操作后重启该 profile。

## 使用方法

1. 打开任意 DSH 会话，输入框附近会出现“直接发送”和“队列 n”。
2. 点击“直接发送”，切换为“低谷再发”。
3. 在当前 provider 的高峰时段编辑消息，按 Enter 或点击 DSH 原生发送按钮。host 确认入队成功后，插件才会清空输入框。
4. 点击“队列 n”，查看或管理已暂存的任务。
5. 进入低谷后，host 会把每条消息投递回创建它的会话。

如果插件无法识别当前会话，它会阻止这次被拦截的发送并记录原因，从而避免把消息投递到错误会话。

## 存储、隐私与限制

配置与诊断文件位于：

```text
%DSH_HOME%\offpeak-queue\
├── config.json
└── host.log
```

- 插件不依赖外部网络服务，也不需要单独的凭据。
- client 诊断仅提交到插件在本机 DSH host 上注册的路由，并追加到 `host.log`。
- 队列消息入队时会从在线会话捕获 provider 与 model，仅用于查询该 provider 的时段。
- 设置会持久化到 `config.json`。
- 等待、工作中和执行记录目前保存在内存中，DSH host 进程退出后会清空。重启前请先处理或复制仍在等待的消息。
- 队列最多容纳 200 条待处理消息；单条消息上限为 50,000 个字符。
- 投递失败后最多重试三次，每次失败后有短暂冷却时间。

## 故障排查

### 看不到控件

静态 client 模块只在启动时扫描。请完整退出并重启 DSH，然后检查：

```text
%DSH_HOME%\offpeak-queue\host.log
```

日志中应能看到 host 启动、路由注册、client 启动，以及 DOM 探针成功或原生后备挂载成功的记录。

### 应急停用

如果插件影响 profile 启动，可在该 profile 的 `cordis.patch.yml` 顶层数组中加入以下条目，然后重启 DSH：

```yaml
- id: offpeak-queue
  name: dsh-offpeak-queue
  disabled: true
```

删除该条目并再次重启即可恢复，无需卸载插件。

## 项目结构

```text
dsh-offpeak-queue
├── index.js             Host 半侧：路由、配置、调度、投递
├── client.js            静态 Client 半侧：控件、弹窗、发送拦截
├── src/core.mjs         与框架解耦的队列状态机
├── cordis.patch.yml     原生 DSH profile bundle 行
├── scripts/             冒烟与结构平衡检查
└── test/                核心行为单元测试
```

浏览器半侧通过本机 `/dsh-offpeak-queue/*` 路由与 host 通信。host 恢复消息记录的 DSH 会话，再通过该会话的正常 follow-up 路径提交文本。

## 开发验证

打包前运行完整检查：

```powershell
npm run verify
npm pack --dry-run
```

展开后的命令如下：

```powershell
node --check client.js
node --check index.js
node --test test/core.test.mjs
node scripts/smoke.mjs
node scripts/balance.mjs
```

## 发布

首次公开发布前，请再次确认 npm 包名仍可注册。随后检查发布包内容，发布到 npm，在 GitHub 创建同版本 tag，并把生成的 `.tgz` 附加到 GitHub Release。

为了方便生态发现，请给 GitHub 仓库添加 `dsh-plugin` topic。社区插件目录可以通过现有的 `dsh-plugin`、`deepseek-harness` 关键词发现 npm 包；DSH Web 社区索引还支持提交 PR，把仓库地址和 npm 包名加入其 `community.json`。

## 许可证

MIT，详见 [LICENSE](LICENSE)。
