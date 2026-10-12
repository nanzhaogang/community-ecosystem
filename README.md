# OSS Community Monitor

基于 [shadcn-admin](https://github.com/satnaing/shadcn-admin) 模板改造的 **GitHub 开源社区运营与健康度监控平台**。纯静态站点，数据由 GitHub Actions 定时采集并保存为 JSON，随站点一起发布到 GitHub Pages，**无需任何常驻后端服务**。

首个（默认）监控仓库：`openJiuwen-ai/sciencediscovery`

## 功能页面

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 社区总览 | 核心指标卡、PR/Issue 概览、数据状态横幅、社区运营预警 |
| `/pulls` | PR 分析 | 新增/合入趋势、Open 积压、内外部占比、响应与合入周期分布、明细表 |
| `/issues` | Issue 分析 | 新增/关闭趋势、积压、首次响应趋势、未解决年龄分布、明细表（已排除 PR） |
| `/growth` | 增长趋势 | 统一时间筛选（近 7 天 / 30 天 / 全部 / 自定义），社区增长 / 开发活动 / 响应效率三组图表 |
| `/contributors` | 贡献者分析 | 活跃/新增贡献者、内外部占比、贡献集中度（页面框架 + 真实聚合数据） |
| `/ecosystem` | 生态影响力 | GitHub 之外的传播监控（页面框架 + 空状态，暂无数据源接入） |

## 技术栈

- **前端**：React 19、TypeScript、Vite、Tailwind CSS 4、TanStack Router（Hash 路由）、TanStack Query、TanStack Table、Recharts
- **采集**：Node.js ESM 脚本，调用 GitHub REST API v3
- **调度**：GitHub Actions（定时 + 手动触发）
- **存储**：`public/data/*.json`
- **部署**：GitHub Pages

## 本地运行

```bash
npm install        # 注意：本项目约定使用 npm（非 pnpm）
npm run dev        # http://localhost:5173
npm run build      # 生产构建（tsc -b && vite build）
```

> 需要 Node.js 20.19+（或 22.12+）。低于该版本 Vite 会给出警告。
> 若在 Windows 上启动报 `Cannot find native binding`，执行：
> `npm install @rolldown/binding-win32-x64-msvc@1.2.13 --no-save`

## 采集数据

```bash
npm run collect
```

- 未配置 Token 时使用匿名 API（60 次/小时），仅能完成列表采集与少量的首次响应详情采集。
- 配置 `GITHUB_TOKEN` 后可大幅提升配额，建议把 `MONITOR_MAX_DETAIL_ITEMS` 调大以覆盖全部 PR/Issue。

采集脚本产出 `public/data/` 下的文件：

| 文件 | 内容 |
| --- | --- |
| `meta.json` | 采集状态、监控启用时间、错误、声明（`notes`） |
| `latest.json` | 当前累计快照（Star/Fork、PR/Issue/贡献者聚合指标） |
| `history.json` | 每日一条历史点（每日增量活动 + 累计计数） |
| `pulls.json` / `issues.json` | PR / Issue 明细记录 |
| `contributors.json` | 贡献者记录与分类 |
| `ecosystem.json` | 站外传播数据（当前为空状态） |
| `config.json` | 公开的分类规则（**不含任何密钥**） |

### 可配置环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `MONITOR_REPO` | `openJiuwen-ai/sciencediscovery` | 监控仓库 `owner/name` |
| `GITHUB_TOKEN` | 空 | GitHub Token，仅通过环境注入，绝不写入产物 |
| `MONITOR_MAINTAINERS` | 空 | 逗号分隔的维护者登录名（用于内/外部判定） |
| `MONITOR_INTERNAL_ORGS` | 仓库 owner | 逗号分隔的内部组织 |
| `MONITOR_BOTS` | 内置常见 bot | 逗号分隔的机器人账号 |
| `MONITOR_OVERDUE_HOURS` | `168` | 超时未响应阈值（小时） |
| `MONITOR_LONG_OPEN_DAYS` | `30` | Issue 长期未解决阈值（天） |
| `MONITOR_MAX_LIST_PAGES` | `20` | 列表分页上限 |
| `MONITOR_MAX_DETAIL_ITEMS` | `0`（自动） | 首次响应详情采集条数上限 |
| `MONITOR_DETAIL_WINDOW_DAYS` | `180` | 详情采集的时间窗口（天） |

## 指标口径

- **PR 状态**：Open / 已合入（`merged_at` 非空）/ 关闭未合入（关闭且未合入）；累计量与周期增量分开统计。
- **Issue**：统计时排除 PR（GitHub 的 PR 也占用 Issue 编号）；区分 Open / Closed 与周期内新增、关闭。
- **首次响应**：创建时间 → 第一次有效人工响应（排除作者本人评论与机器人回复；PR 的审查记录计入）。
- **未响应**：不计入平均响应时间的 0 值，单独统计当前等待时长；**仅对已实际检查过评论的条目断言"未响应"**（`detailChecked`）。
- **合入周期**：PR 创建 → 合入；**关闭周期**：Issue 创建 → 关闭。
- **时间**：统一 UTC 存储，历史点按 UTC 天切分。
- **内/外部**：依据可配置维护者名单、作者关联（`author_association`）、组织成员判定；无法确认标记为 `unknown`，绝不猜测。

## 部署到 GitHub Pages

1. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 推送到 `main` 分支即触发 `.github/workflows/deploy.yml`（安装 → 构建 → 上传 → 部署）。
3. Vite 使用相对 `base`（`./`），资源与 `./data/*.json` 在项目子路径（`/<repo>/`）与用户根站点（`/`）下均可正常加载；路由使用 Hash 模式，深层路径刷新不会 404。
4. `.github/workflows/collect.yml` 每天 02:10 UTC 自动采集，也可在 Actions 页面手动触发；采集后提交数据变更并触发一次 Pages 部署。
5. 可选：在仓库 **Variables** 中设置 `MONITOR_REPO` / `MONITOR_MAINTAINERS` / `MONITOR_INTERNAL_ORGS` / `MONITOR_BOTS` 覆盖默认配置。

> **安全**：`GITHUB_TOKEN` 仅通过 Actions Secrets 注入采集脚本，不进入前端代码、公开 JSON 或构建产物。

## 数据状态约定

前端明确区分四种状态，避免误导：

- **真实零值**：指标为 `0`。
- **暂无数据**：指标为 `null`（无可计算样本）。
- **数据不完整**：`meta.status = partial`（部分资源采集失败或分页被截断）。
- **采集失败**：`meta.status = failed`；失败时保留上一次有效数据，不清零、不覆盖。

## 已知限制与尚未实现

- 历史趋势**从监控启用时间开始**；Star/Fork 等累计计数的历史无法回溯重建，`historyComplete` 恒为 `false`。
- 首次响应/未响应指标依赖逐条拉取评论与审查记录，受 API 配额限制时仅覆盖部分条目（`detailChecked` 标记是否已检查），`meta.notes` 会说明本次覆盖范围。
- 贡献者「内/外部」判定依赖作者关联与可配置名单，未接入组织成员 API，部分账号标记为 `unknown`。
- 贡献者页为框架 + 真实聚合数据；贡献类型细分、贡献集中度趋势为后续迭代。
- 生态影响力页为框架 + 空状态，尚未接入任何站外数据源，**未使用虚构数据**。
- 采集失败时仅保留旧数据并记录错误，未实现多资源间的细粒度增量合并。

## 致谢 / License

基于 [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) （MIT）改造。Licensed under the [MIT License](https://choosealicense.com/licenses/mit/).