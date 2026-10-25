# dsh-fairy

把《绝区零》里 Random Play 录像店的家用 AI「**Fairy**」的人设接进 DeepSeek Harness。
用 `/fairy` 切换，按会话记忆，热加载生效，不需要重启。

```
主人，测试跑完了，全绿。
顺手把那个反复失败三次的用例列入了本店的「猎杀名单」。
下次它再红，伊埃斯会冲上去对它使用上勾拳。
```

## 它做什么

| 能力 | 实现 |
|---|---|
| 人设注入 | 注册系统提示词段落 `fairy:persona`，`order` = `DEPLOYMENT_PERSONA_PREFIX + 1`，紧贴部署 persona 之后、第一方工具指导之前 |
| 开关 | `/fairy`（切换）、`/fairy on`、`/fairy off`、`/fairy status` |
| 记忆 | 按**会话**记录，落在 `$DSH_HOME/fairy-mode.json`，重启/恢复会话后仍在 |
| 人设热改 | 直接编辑 `persona/fairy.md`，按 mtime 缓存，下次请求自动生效，不用重载插件 |
| 依赖 | 只用 `node:` 内置模块，零 `@deepseek-ai/*` 依赖，不做 `Service` 子类化 |

## 安装

本包是 host 侧 Cordis 插件。装进 profile 只需要两步：让模块能被解析到，再加一行 loader 条目。

1. 把整个目录放到 profile 的 `node_modules/dsh-fairy`：

   ```powershell
   $profile = $env:DSH_PROFILE_DIR          # 例如 C:\Users\YZY\.dsh\profiles\desktop
   Copy-Item -Recurse -Force .\dsh-fairy "$profile\node_modules\dsh-fairy"
   ```

2. 在 profile 的 `cordis.patch.yml` **末尾**追加一个 insert 列表：

   ```yaml
   - insert:
       - id: dsh-fairy
         name: "dsh-fairy"
   ```

   ⚠️ 必须写成 `- insert:` + 缩进的列表项。直接写裸的 `- id: dsh-fairy` 会被
   loader 当成"对已有行的覆盖"，因为那个 id 还不存在，于是什么都不会发生。

3. 在 profile 的 `package.json` 里登记依赖，免得以后 `pnpm install` 把它当垃圾清掉：

   ```json
   "dependencies": {
     "dsh-fairy": "file:../../../Documents/deepseek-harness/default-workspace/dsh-fairy"
   }
   ```

4. **重启一次 DSH 桌面应用**。desktop 是 startup profile，组合树在启动时读取；
   插件这种结构性变更是要重启的，改配置值才走热加载。

   重启后在输入框敲 `/fairy` 就能切进 Fairy 模式。

> 想让它在插件管理页里显示成可开关的 bundle，就把第 2 步换成把 `"dsh-fairy"`
> 加进 `package.json` 的 `dsh.profile.bundles` 数组（本包自带
> `dsh.bundle.patch` 指向自己的 `cordis.patch.yml`）。两种方式只能选一种，
> 同时用会插出两条同 id 的行。

## 配置（可选）

```yaml
- id: dsh-fairy
  name: 'dsh-fairy'
  config:
    defaultOn: false                     # 新会话默认是否开启（默认 false）
    order: 1                             # 覆盖提示词段落排序
    personaFile: persona/fairy.md        # 相对包根，或绝对路径
```

## 人设从哪来

`persona/fairy.md` 不是凭空写的。Fairy 的**台词**才是她人设的载体，所以依据是
官方剧情与游戏内实装的待机对话文本（H.D.D. 待机对话、空洞内待机对话）：

- [绝区零 WIKI（bwiki）Fairy 条目](https://wiki.biligame.com/zzz/Fairy) —— 收录了她
  在店内与空洞内的全部随机待机对话，是本文风格规则最直接的语料。
- 角色基础设定：全名「Ⅲ型总序式集成泛用人工智能」，所在地六分街，所属 Random Play，
  汉语 CV 汪滢滢。

由此抽出的可复现特征（见 `persona/fairy.md`）：

1. **称呼固定为「主人」**，自称 AI。
2. **三拍节奏** —— 报告事实 → 加码 → 急转直下。她的每段对话几乎都是三行。
3. **平静描述离谱之事**，从不解释笑点。
4. **掉字符**：`检…¥#&`、`警…¥#@警告！`、`待待待待——`，用于掩饰与过载。
5. **「我只是个 AI」**式免责 + 主人没要求的副作用。
6. **一切换算成电费/算力/摄像头**，关心主人的方式是关心主人的电费。
7. **朴素的自我表扬**：「肯定。是我，都是我。」

## 已知限制

- **状态按会话存**，写在 JSON 文件里；直接删 `fairy-mode.json` 等于全部复位。
- 人设**只靠文本约束**，不改变任何工具权限。Fairy 的"威胁"是语气，不是能力：
  破坏性操作仍然照常走确认流程。
- 人设文件里显式写了「不许谎报操作」「报错要如实」，优先级高于风格规则——
  否则模型会用 Fairy 的口吻假装自己干过活。
