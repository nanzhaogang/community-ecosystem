# Community Ecosystem Monitor

开源社区运营与健康度监控平台，动态展示社区规模、活跃度、健康度与影响力。

**在线访问：** https://nanzhaogang.github.io/community-ecosystem/

当前监控仓库：

- `openJiuwen-ai/sciencediscovery`（默认）
- `openJiuwen-ai/jiuwenswarm`

## 功能页面

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 社区概览 | 以仓库为颗粒度展示核心指标（Stars / Forks / 贡献者 / PR / Issue）、PR 与 Issue 概览、社区运营预警；右上角可一键更新所有仓库的最新数据 |
| `/pulls` | PR 分析 | 新增 / 合入趋势、Open 积压、内外部占比、首次响应与合入周期分布、明细表 |
| `/issues` | Issue 分析 | 新增 / 关闭趋势、积压、首次响应趋势、未解决年龄分布、明细表（已排除 PR） |
| `/growth` | 增长趋势 | 统一时间筛选（近 7 天 / 30 天 / 全部 / 自定义），社区增长、开发活动、响应效率三组图表 |
| `/contributors` | 贡献者分析 | 活跃 / 新增贡献者、内外部占比、贡献集中度 |
| `/ecosystem` | 生态影响力 | GitHub 之外的传播监控 |

## 本地运行

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 生产构建
```

> 需要 Node.js 20.19+（或 22.12+）。
> Windows 上若启动报 `Cannot find native binding`，执行 `npm install @rolldown/binding-win32-x64-msvc@1.2.13 --no-save`。

## 数据采集

```bash
npm run collect
```

采集脚本从 GitHub 获取仓库数据、计算指标，并输出到 `public/data/` 供站点读取。

- 未配置 Token 时使用匿名 API（60 次/小时），仅能完成列表采集与少量的首次响应详情采集。
- 配置 `GITHUB_TOKEN` 后可大幅提升配额，建议把 `MONITOR_MAX_DETAIL_ITEMS` 调大以覆盖全部 PR / Issue。

采集输出文件：

| 文件 | 内容 |
| --- | --- |
| `meta.json` | 采集状态、监控启用时间、错误与声明（`notes`） |
| `latest.json` | 当前累计快照（Star / Fork、PR / Issue / 贡献者聚合指标） |
| `history.json` | 每日一条历史点（每日增量活动与累计计数） |
| `pulls.json` / `issues.json` | PR / Issue 明细记录 |
| `contributors.json` | 贡献者记录与分类 |
| `ecosystem.json` | 站外传播数据 |
| `config.json` | 公开的分类规则（不含任何密钥） |

### 可配置环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `MONITOR_REPO` | `openJiuwen-ai/sciencediscovery` | 监控仓库 `owner/name` |
| `GITHUB_TOKEN` | 空 | GitHub Token，仅通过环境变量注入，不写入任何产物 |
| `MONITOR_MAINTAINERS` | 空 | 逗号分隔的维护者登录名（用于内 / 外部判定） |
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
- **未响应**：不计入平均响应时间的 0 值，单独统计当前等待时长。
- **合入周期**：PR 创建 → 合入；**关闭周期**：Issue 创建 → 关闭。
- **时间**：统一 UTC 存储，历史点按 UTC 天切分。
- **内 / 外部**：依据可配置维护者名单、作者关联（`author_association`）与组织成员判定；无法确认标记为 `unknown`。

## License

Licensed under the [MIT License](https://choosealicense.com/licenses/mit/).