# Vibe Design 配置项性能优化需求与 Agent 执行说明

版本：2026-10-26。状态：待实施。本文是独立交接文档，执行者不需要阅读原会话。

## 1. 给执行 Agent 的任务

在 @mybricks/editors-pc-common 仓库内，优化点击画布元素后右侧样式配置面板的计算耗时。重点减少相同元素、相同状态、相同样式版本下的重复规则扫描和重复样式求解，并保持现有回显、写入、清除和状态切换行为。

接到本文后，应完成代码实现、回归测试和可进行的性能验证，而不仅是再输出一份分析或计划。先检查项目指引及工作区现状，保留用户已有改动；按小步骤实现，每一步说明收益依据和正确性保障。

本轮任务不包括发布、部署、提交远端、修改宿主或重写整个编辑器架构。当前生成这份文档的会话仅负责交接，尚未实施下面的优化。

## 2. 项目与场景

- 仓库名：editors-pc-common；包名：@mybricks/editors-pc-common。
- 文档生成节点的仓库：/Users/leo/Project/lingzhu/editors-pc-common。其他节点以实际检出的仓库根目录为准，下文源码路径均相对仓库根目录。
- 技术栈：React、TypeScript、antd、CSSOM；宿主通过 editConfig 传入目标 DOM、样式读取和写入接口。
- 主要入口：src/style_new/StyleEditorShell.tsx。
- 用户负责右侧配置项，不负责画布和宿主平台的全部运行时开销。
- 交互：点击画布中的元素 → 解析元素及状态 → 生成 Regular/Hover 等 Tab → 计算样式来源及初始值 → 挂载 Layout、Dimensions、Typography、Fill、Border、Margin、Padding 等配置插件。

架构背景：[style-editor-architecture.md](docs/style-editor-architecture.md)。优先阅读其中的职责分层、StyleMount 缓存与刷新、样式回显、宿主重编译、Zone/单独编辑、MutationObserver 和验证建议。文档里的“建议目标架构”不是已经落地的代码，本轮不要求全面实现它。

## 3. 已完成的修复，不要回退或重复实施

src/style_new/hooks/useZoneSelectors.ts 的 customZoneTabs 初始化已改为：

```tsx
const INIT_TABS: ZoneTab[] = [];
const [customZoneTabs, setCustomZoneTabs] = useState<ZoneTab[]>(INIT_TABS)
```

挂载/目标变化的 effect 仍执行 setCustomZoneTabs(INIT_TABS)。这避免了初始 [] 与重置空数组引用不同导致的无效完整重算。

生成本文时，该文件是工作区中已有的未提交改动。必须保留，不要撤销、覆盖或将它当成尚未完成的主要优化。

复测已经观察到：collectDisplayZoneTabs 从每次点击两轮降为一轮；第二轮约 100–112 ms 的完整 useZoneSelectors 计算不再出现。仍有后续 React 更新和首挂规则刷新，本轮针对这些剩余成本。

## 4. 当前性能基线

### 4.1 最新可用样本

本地附件：

- [新 Trace](/Users/leo/Downloads/Trace-20261026T212736.json.gz)。
- [新 Trace 分析](/Users/leo/Downloads/Trace-20261026T212736.config-performance.md)。

这些 Downloads 路径属于文档生成节点。其他节点访问不到时，使用本节数据开展实现，性能复测阶段再取得附件或相同场景；不要假定另一个节点能访问这些绝对路径，也不要依赖原会话中的临时分析脚本。

最新 Trace 只包含一次工作台点击，伪类扫描涉及 .statCard。编辑器 392 个 JS/TS 源文件与当前仓库一致；与旧 Trace 相比，这些源码仅上述空数组初始化发生改变。

| 配置项阶段 | 最新样本耗时 | 归属说明 |
|---|---:|---|
| useZoneSelectors 的完整状态/样式计算 | 104.00 ms | 含 collectDisplayZoneTabs 43.83 ms，以及各 Tab 的样式计算 60.17 ms |
| 当前 Tab 的 getDefaultConfiguration | 55.49 ms | 仍再次取生效样式、构建回显来源和面板初始配置 |
| getSavedSoloStyle | 37.01 ms | render 中 18.68 ms，effect 中 18.33 ms |
| 配置插件、控件及 hooks | 29.74 ms | 独立插件/控件归属，未包含全部公共 React 成本 |
| StyleMount 挂载后的 rAF 刷新 | 28.71 ms | 再扫描 collectZoneTabs；其内部该函数约 28.21 ms |
| 其他配置项工作 | 2.48 ms | 容器、Tab 栏等 |
| **配置项合计** | **257.42 ms** | 上面阶段互斥，舍入误差约 0.01 ms |

附加事实：

- collectDisplayZoneTabs 只观察到一个调用段，CPU 采样归属约 43.83 ms；首尾样本墙钟跨度约 45.35 ms。
- collectZoneTabs 在 collectDisplayZoneTabs 内约 23.39 ms；在首挂 rAF 内约 28.21 ms，仍有重复收集来源。
- 配置项调用栈下的原生 Element.matches 累计约 67.20 ms，已包含在上述阶段，不可重复相加。
- 整个选中更新区间主线程忙碌约 482.38 ms；配置项保守归属约 53.4%。
- 主要长任务仍为 369.01 ms，其中配置项约 221.86 ms。不能将整个长任务全部归给配置项，也不能承诺仅修改本模块就消除全部长任务。
- Border 独立归属约 11.39 ms，其他主要插件各约 1–3 ms；控件 JSX 微优化不是第一优先级。

### 4.2 如何理解这些数字

这是单次 CPU 采样估算，不是稳定平均值或 P95；调用次数是可观察到的调用段，不是精确埋点计数。

旧样本每次点击配置项约 357–429 ms，但涉及 .section，与新样本 .statCard 不完全相同。不要把全部差值归因于空数组修复；新样本 257.42 ms 只是后续优化的参考起点。

阶段耗时互斥可加；函数含子调用耗时存在嵌套，不能跨父子相加。click 事件处理约 6 ms 或 EventTiming 约 36 ms，均不能代表后续配置面板完成更新的全部耗时。

## 5. 优化目标与范围

### 5.1 必须达到的结构性目标

1. 保留空数组修复；在无实际来源变化的普通首次选中场景，面板自身的 Tab 生成管线不新增第二轮完整计算。
2. 同一求解上下文下，当前 Tab 的生效样式/来源结果在 Tab 管线与默认配置之间可复用，不再无条件重复完整求解。
3. 相同上下文的 solo 查询在 render/effect 之间复用，包括“没有 solo 规则”的负结果。
4. 首挂已持有等价、有效的来源快照时，不仅为了记录 baseline 就再做一次全量来源扫描；如果快照不等价或过期，必须保留正确的刷新路径。
5. 缓存只在相关输入未变时复用，输入变化时结果正确失效；不能用过期数据换速度。

“同一上下文”至少需核对元素、样式 root、comId、selector/状态、公共/单独编辑模式、被排除来源/属性、来源版本和影响结果的 DOM/内联变化。是否需要额外输入由执行者按实际代码确定，不能只按 DOM 引用永久缓存。

外部 getVariations 也会调用 collectDisplayZoneTabs，应独立标记来源。不要把宿主工具栏的合法查询与面板自己的重复计算混为一谈，也不要为追求全局调用次数为 1 而破坏它的结果新鲜度。

### 5.2 建议性能目标

用户要求减少当前时长，尚未指定硬性的毫秒 SLA。以下是本需求建议的验收目标，不是已测结果：

- 相同元素、相同环境下重新采集优化前基线；优化后配置项归属耗时的中位数至少降低 30%。
- 以当前单样本 257 ms 为参考，期望接近或低于 180 ms；这是同量级环境的参考目标，不作为跨机器绝对门槛。
- 配置面板稳定显示的端到端延迟、后续刷新累计成本和状态切换性能不应回退。
- 未达到建议目标时，如实报告实际收益、剩余热点和未完成项，不得自行宣称达标。

### 5.3 允许与不允许

允许：有限重构 src/style_new 内的求解上下文、来源快照、缓存传递和刷新协调；增加必要类型、测试和可关闭的开发测量辅助。

不要求：全量改造 StyleEditorShell、重写 CSS 引擎、换 React/antd、修改宿主组件加载器、搭建完整性能分析平台。

禁止作为优化手段：删除功能、改变回显/写入语义、用过期快照冻结面板、无限全局缓存、屏蔽实际样式变化、将重工作移到下一帧后只统计首帧来制造收益。

## 6. 实施顺序

### P0：Tab 管线与默认配置共享求解结果

当前重复路径：

| 方法 | useZoneSelectors 逐 Tab 路径 | getDefaultConfiguration 当前配置路径 |
|---|---:|---:|
| getEffectedCssPropertyAndOptions | 37.10 ms | 31.98 ms |
| buildZoneEffectiveStyle | 22.94 ms | 22.97 ms |

重点文件：

- src/style_new/hooks/useZoneSelectors.ts。
- src/style_new/StyleEditorShell.tsx。
- src/style_new/core/get-default-configuration.ts。
- src/style_new/core/get-effected-css.ts。
- src/style_new/core/zone-tab.ts。
- src/style_new/type.ts 与相关内部类型，仅在必要时修改。

建议建立有限生命周期的求解结果/上下文，由默认配置消费已计算的同版本结果。具体 API 由执行者确定，避免仅通过 tab.effectiveStyle 猜测结果已经完整。

必须保留 defaultValue、effectiveStyle、authoredStyle、setValue、ownRulesPanels、ancestorPanels、collapsedOptions、readonlyExpandedOptions 等不同语义。业务 value.get 的源码值和当前编辑快照不能因为复用 CSSOM 结果而冻结。

对于伪类、无 DOM、options 为数组、selector 数组和 solo 排除来源等不满足复用条件的路径，保留兼容回退。现有 getEffectedCssPropertyAndOptions 已有伪类元数据快路径，不要先删掉它再重新引入扫描。

### P1：复用 solo 查询

重点文件：src/style_new/StyleEditorShell.tsx、src/style_new/core/build-solo-selector.ts。

首次普通选中下，render/effect 对同一查询只做一次真实扫描。可缓存 null 结果；选择器、目标、样式来源或编辑模式变化后必须失效。

必须区分公共样式与 nth-child 等单独规则；保留进入/退出单独编辑、已有单独样式回显、退出后公共样式回显和复制/清除行为。

### P1：首挂复用来源快照，减少无变化扫描

重点文件：src/style_new/StyleMount.tsx、src/style_new/core/zone-tab.ts、src/style_new/core/style-property.ts。

现在首挂 refresh(false) 在 rAF 内再次 collectZoneTabs，并失效 StyleResolution。评估初始 Tab 来源能否等价满足 baseline 建立和当前来源确认；有效时复用，不等价时按原语义刷新。

不是直接删除 refresh(false)、MutationObserver 或所有缓存失效。观察器是宿主异步 CSS 重编译后的闭环，必须保留实际更新能力。防止初始快照建立与观察器安装间发生变化而漏失效。

### P2：按测量结果继续优化底层扫描

重点文件：src/style_new/core/cascade-winner.ts、selector-utils.ts、scan-pseudo-selectors.ts、get-style-rules.ts、zone-tab.ts。

- 共享同版本规则快照和同元素/状态匹配结果，避免不同路径创建 resolver 后重复扫描。
- 单个 createCascadeResolver 已按 mode 缓存匹配规则，不能误判成每个属性都扫描全部 CSS。
- 对相同 selectorText 复用顶层拆分、主体定位等解析结果。
- 将 scanPseudoSelectors 中对某个 base selector 不变的正则构建移出规则循环，并减少同一规则的重复拆分。
- 如仍有必要，再共享控件 CSS 变量快照；不是先全面重构插件。

P2 按剩余热点实施，不要求同时落地所有缓存。每个缓存必须说明归属、边界、失效和释放方式。

## 7. 正确性与失效要求

1. CSS 级联：保留 !important、特指度、源码顺序、重复 selector 和 CSSRule 身份；不能只按 selectorText 去重规则。
2. 状态：Regular 不混入 hover/focus/active 值；伪类和伪元素按现有规则回显，祖先 hover 的继承行为不变。
3. 来源：computed 值不能冒充 authored 值；inline、规则、继承、UA 默认和未配置值需保持区分。
4. 样式 root：兼容 getDocument 返回的画布 ShadowRoot 和 document；已有 style/link/adoptedStyleSheets、条件规则处理能力不能退化。不要为提速引入跨 root 全局混用。
5. CSS 写入/重编译：新增、删除、替换样式标签、规则替换和既有程序化规则更新通路需使相关结果失效。MutationObserver 捕获不到的 CSSOM 操作不能被误认为永远不变，应沿用或增加必要的显式版本通知。
6. DOM 变化：目标或影响匹配/继承的祖先 class/style、data-style-info、相关 DOM 结构、元素替换/断开连接变化不得读到错误缓存。
7. 外部条件：现有媒体条件/状态变化后的刷新语义不得被缓存屏蔽；不要只靠固定 TTL 保证正确性。
8. 写入与清除：保留 winner/fallback、shorthand/longhand、变量表达式、inherit/unset、deletion side-channel 和编辑即时快照语义。
9. 生命周期：快速切换元素不能把旧目标结果写到新目标；卸载后不得遗留新增 observer、订阅、timer 或无界强引用。隐藏 Tab 保留机制不得变成重复扫描放大器。
10. 允许按既有宿主异步重编译和下一帧刷新时序更新，但最终必须显示最新来源；不能要求宿主改成同步写入来绕开本模块问题。

## 8. 测试与回归验收

### 8.1 最低自动化覆盖

新增针对本轮实现的行为测试，不能只测试缓存返回了同一个对象：

- 同上下文重复读取返回等价配置，同时真实求解/扫描次数减少。
- 缓存命中与不命中路径的配置字段语义一致。
- DOM/来源/状态/solo 上下文变化后重新计算，不串结果。
- null 的 solo 查询复用，以及新增 solo 规则后失效。
- 首挂使用来源快照后，实际重编译仍更新 sourceRules、baseRules、来源解析和回显。
- 目标快速切换/卸载后没有旧结果污染新面板。

现有测试使用 Node test runner 和 TypeScript 内存转译，可参考并运行：

```sh
node --test src/style_new/core/__tests__/border-write.test.cjs src/style_new/core/__tests__/flex-write.test.cjs src/style_new/StyleEditor/plugins/Flex/__tests__/index.test.cjs
```

项目有 npm run build，没有 package.json 中的统一 test 脚本；不要声称执行了不存在的 npm test。

构建采用 ts-loader transpileOnly，构建成功不等于类型检查成功。根据改动范围运行现有构建及本地 TypeScript 检查，先记录基线错误，不把无关存量问题扩大成本轮重构；若执行构建，先确认输出目录没有需要保留的用户改动。

### 8.2 最低交互回归

| 场景 | 验收关注点 |
|---|---|
| 普通 statCard 首次选中、切走再选回 | Tab、初始值、自动折叠正确，不重复完整求解 |
| Regular ↔ Hover/Focus/Active/Disabled、伪元素 | 状态不串值，预览和来源正确 |
| 祖先 hover、继承 color | 常规态不会误显示 hover 颜色 |
| inline 与 !important/竞争规则 | winner 和可编辑/可清除来源正确 |
| 多 class、CSS Modules、逗号 selector、selector 数组 | 匹配、标签、规则顺序不变 |
| 多目标、无 DOM、数组 options 等兼容输入 | 原行为不被复用条件破坏 |
| 批量编辑 ↔ 单独编辑，已有 nth-child 规则 | 查询命中和负结果失效正确 |
| 修改、清除、复制粘贴样式，Visual ↔ CSS | 写入、fallback、简写和变量语义正确 |
| CSS 标签/规则重编译，目标 DOM 替换 | 面板刷新最新来源，无旧规则引用 |
| 快速切换目标、Tab 缓存保留和卸载 | 无污染、无新增资源泄漏、无后台重复放大 |

已有行为可以用明确的测试 fixture 补足，不要求制造原来不支持的功能。不能用不具备真实 CSSOM 的假 DOM 测试替代全部浏览器回归。

## 9. 性能验证方法

1. 使用同一 Chrome、同一构建模式、同一 CPU 降速设置、同一窗口/画布与 CSS 规模；固定同一个 statCard 元素及 Regular 初始状态。
2. 在保留 INIT_TABS 修复的代码上建立“本轮优化前”基线，不回退该修复重新测旧问题。
3. 优化前后各预热 2 次，再各记录至少 5 次有效点击。首次冷启动另列，不能只用缓存最热的一次作为结论。
4. 清楚定义每次选择开始与面板稳定的结束边界；包含后续 rAF、effect、实际 DOM 更新及必要的重新计算，不只统计 click 回调或第一帧。
5. 记录以下函数的来源、次数、累计含子调用耗时与缓存命中/失效：collectDisplayZoneTabs、collectZoneTabs、getEffectedCssPropertyAndOptions、buildZoneEffectiveStyle、getDefaultConfiguration、getSavedSoloStyle、StyleMount 刷新。
6. 记录同一更新周期中样式来源/DOM 是否真实发生改变；发生改变的合法重算与无变化的重复计算分开统计。
7. 记录配置项互斥阶段耗时、整个主线程任务耗时和端到端面板稳定延迟。若只能用埋点而不能复现 CPU 采样归属，单列指标口径，不把两种数值直接比较。
8. 用可关闭的开发标记/计数器或已有工具验证真实调用次数；生产默认不开启，不保留海量日志、临时全局状态或高开销逐规则标记。
9. 若自行解析 Chrome Trace，必须按进程/线程及 Profile ID 分离节点和采样，将乱序采样按时间排序；用 Source Map 定位实际模块。最新附件含两个 Profile，不能拼接它们的 timeDeltas 或混用 node ID。
10. 报告每次样本、样本数、中位数和相对收益；不足以支撑稳定 P95 时不要给出 P95 结论。对嵌套函数禁止重复累计，不把宿主/扩展/全页面 Paint 全归到本模块。

## 10. 交付与完成定义

执行 Agent 应交付：

1. 聚焦本需求的代码改动，说明每项复用机制及失效条件；保留用户原有 INIT_TABS 修改。
2. 新增回归测试，以及现有相关测试、构建/类型检查的实际结果；失败和未执行项分开说明。
3. 复测数据表，标明环境、目标元素、样本数、计算次数、每次耗时和可比口径；有条件时附新 Trace。
4. 说明已减少的重复计算、仍存在的必要扫描、是否达到建议性能目标和剩余风险。
5. 对外 API/类型兼容性说明；若内部参数扩展，应保留未传缓存/上下文时的正确回退。

完成必须同时满足功能回归、失效测试和已进行验证的真实说明。性能环境不可访问时，仍可完成可验证的代码和自动化测试，但应将“真实工作台性能复测/验收”标为未完成，不得宣称整体性能已达标。仅靠单元测试里的 mock 扫描计数不足以证明 30% 的实际性能收益。

不要求提交或发布。无法在现有宿主合约内安全实现的项，先说明具体缺口和可行替代，不擅自修改宿主系统或扩大任务范围。

## 11. 可直接复制给其他 Agent 的指令

> 请阅读仓库中的 docs/style-editor-performance-optimization.md，并按其中的任务、范围和验收要求实施右侧样式配置面板性能优化。先检查项目指引、现有代码和未提交改动，保留 useState(INIT_TABS) 的已有修复；优先共享 Tab/默认配置求解结果、复用 solo 查询和减少无变化首挂扫描。保持回显、写入、伪类、单独编辑及缓存失效语义，分步实现并补测试。不要只返回分析或计划，不要发布、部署或修改宿主。用相同 statCard 场景做优化前后验证；无法访问工作台/Trace 时说明性能验收缺口，不编造已验证结果。最终交付代码变更、测试结果、缓存失效说明和真实可比的性能数据。
