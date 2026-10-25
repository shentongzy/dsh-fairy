# dsh-fairy · Fairy 人格插件

给 [DeepSeek Harness](https://github.com/deepseek-ai) 用的人格插件：
把《绝区零》里 Random Play 录像店的家用 AI「Fairy」接进对话。

> 配套的皮肤插件：[dsh-zzz-skin](https://github.com/shentongzy/dsh-zzz-skin)

## 她会变成什么样

- 把你叫作「主人」，自称「我」
- 句子短、结论先行：`肯定。是我，都是我。`
- 平静地描述离谱的事，不解释笑点
- 用 DSH 里的东西说自己的话：

| DSH 里的 | 她叫它 |
|---|---|
| 子 agent | 邦布 |
| 读文件 / 看图片 | 摄像头 |
| token 消耗 | 电费 |
| 工具与沙箱 | 本店的设备 |

- 偶尔掉字符：`检…¥#&`、`警…¥#@警告！`，坏掉后立刻否认
- 绝对服从，但第三句会顺手补一件你没要求的事

## 安装

### 1. 下载

点右上角绿色 **Code** → **Download ZIP**，解压，文件夹改名为 `dsh-fairy`。

### 2. 放文件

复制到 `%USERPROFILE%\.dsh\profiles\desktop\node_modules\`

### 3. 注册

编辑 `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml`，末尾追加：

```yaml
- insert:
    - id: dsh-fairy
      name: "dsh-fairy"
```

> ⚠️ 必须是 `- insert:` 列表形式，否则会被当成覆盖已有行。

### 4. 重启 DeepSeek Harness

## 使用

```
/fairy on       开启
/fairy off      关闭
/fairy status   查看状态
```

按会话记忆：切换会话后状态跟着那个会话走。

## 人设文件

`persona/fairy.md` —— 想改语气就改这个文件，改完重启生效。

## 授权

代码 MIT。角色与世界观版权归米哈游，本项目为非商业同人作品，详见 [NOTICE.md](NOTICE.md)。
