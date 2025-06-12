# Simple Arthas Tool

VSCode插件，用于根据当前悬停的Java函数，生成对应的Arthas命令并复制到剪切板。

## 功能

该插件提供几个Arthas命令的快速生成：

1. **Arthas Watch** - 生成watch命令用于观察方法的入参和返回值
2. **Arthas Trace** - 生成trace命令用于跟踪方法调用路径
3. **Arthas Sc** - 生成sc命令用于搜索类信息
4. **Arthas Jad** - 生成jad命令用于反编译类
5. **Arthas Stack** - 生成stack命令用于查看方法调用栈

## 使用方法

1. 在Java文件中，将光标放在需要调试的方法名上
2. 右键点击，从上下文菜单中选择 "Arthas 工具"
3. 从子菜单中选择需要的命令类型
4. 对应的Arthas命令将自动生成并复制到剪贴板
5. 在Arthas控制台中粘贴并执行命令

## 示例

如果光标位于Java编辑器中的 `startsWith` 方法名上：

```java
("Hello World").startsWith("Hello");
```

右键选择 "Arthas 工具" > "Arthas Watch"，会复制以下命令到剪贴板：

```
watch java.lang.String startsWith '{params, returnObj}' -x 3
```


## 注意事项

- 该插件仅在Java文件中可用
- 需要在目标系统上已安装Arthas
- 生成的命令可能需要根据具体情况进行微调

## 版本历史

### 1.0.2

修改提示文本

### 1.0.1

修复了构造函数watch的问题

### 1.0.0

初始版本，支持生成watch、trace和sc命令
