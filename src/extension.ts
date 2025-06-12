'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    let disposable;
    
    disposable = vscode.commands.registerTextEditorCommand('simple-arthas-tool.watch', watch);
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerTextEditorCommand('simple-arthas-tool.trace', trace);
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerTextEditorCommand('simple-arthas-tool.stack', stack);
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerTextEditorCommand('simple-arthas-tool.sc', sc);
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerTextEditorCommand('simple-arthas-tool.jad', jad);
    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}

async function copyCommand(editor: vscode.TextEditor, command: string) {
    const hovers: vscode.Hover[] | undefined = await getHoversAtCurrentPositionInEditor(editor);
    let isCopied = false;
    if (hovers && hovers.length > 0) {
        const parts = (hovers)
            .flatMap(hover => hover.contents)
            .map(content => getMarkdown(content))
            .filter(content => content.length > 0);

        if (parts && parts.length > 0) {
            for (const part of parts) {
                if ((part.startsWith('\n```') || part.startsWith('```')) && part.endsWith('\n```\n')) {
                    const cleanPart = part.replace(/^\n```.+\n/, '').replace(/^```.+\n/, '').replace(/\n```\n$/, '');
                    if (cleanPart) {
                        try {
                            const commandText = getPart(cleanPart, command);
                            vscode.env.clipboard.writeText(commandText);
                            isCopied = true;
                            vscode.window.showInformationMessage(`Copied !`);
                            break;
                        } catch (error) {
                            if (error instanceof Error) {
                                vscode.window.showErrorMessage(error.message);
                                isCopied = true; // 虽然是错误，但已经处理了
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    if (!isCopied) {
        vscode.window.showWarningMessage('无法获取当前光标位置的Java元素信息！');
    }
}

function getHoversAtCurrentPositionInEditor(editor: vscode.TextEditor) {
    return vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        editor.document.uri,
        editor.selection.active);
}

function getMarkdown(content: vscode.MarkdownString | vscode.MarkedString): string {
    if (typeof content === 'string') {
        return content;
    } else if (content instanceof vscode.MarkdownString) {
        return content.value;
    } else if ('language' in content) {
        const markdown = new vscode.MarkdownString();
        markdown.appendCodeblock(content.value, content.language);
        return markdown.value;
    }
    return '';
}

// 提取类名和方法名的函数
function extractClassAndMethod(part: string): { className: string, methodName: string } {
    // 去除前后空格
    part = part.trim();
    
    let className = '';
    let methodName = '';
    
    // 处理只有类名的情况
    if (part.indexOf('(') === -1 && part.indexOf(' ') === -1) {
        className = part;
        return { className, methodName };
    }
    
    // 处理构造函数的情况
    // 格式如：java.util.ArrayList.ArrayList()
    const constructorPattern = /([a-zA-Z0-9_$.]+)\.([a-zA-Z0-9_$]+)(?:<.*?>)?\(\)/;
    const constructorMatch = constructorPattern.exec(part);
    if (constructorMatch) {
        const fullClassName = constructorMatch[1];
        const shortClassName = constructorMatch[2];
        
        // 检查类名是否匹配（构造函数名应该与类名相同）
        if (fullClassName.endsWith('.' + shortClassName)) {
            className = fullClassName;
            methodName = '<init>'; // 构造函数在Arthas中使用<init>表示
            return { className, methodName };
        }
    }
    
    // 1. 尝试从格式为 "returnType com.example.Class.method(params)" 的字符串中提取
    const methodPattern = /(\S+)\s+([a-zA-Z0-9_$.]+)\.([a-zA-Z0-9_$]+)\s*\((.*)\)/;
    const methodMatch = methodPattern.exec(part);
    
    if (methodMatch) {
        // 匹配到了类名和方法名
        className = methodMatch[2]; // 第二个捕获组是类名
        methodName = methodMatch[3]; // 第三个捕获组是方法名
        return { className, methodName };
    }
    
    // 2. 尝试从带有 " - " 分隔符的格式中提取
    const dashIndex = part.indexOf(' - ');
    if (dashIndex !== -1) {
        const beforeDash = part.substring(0, dashIndex).trim();
        
        // 检查是否包含方法
        const dotIndex = beforeDash.lastIndexOf('.');
        if (dotIndex !== -1) {
            className = beforeDash.substring(0, dotIndex);
            methodName = beforeDash.substring(dotIndex + 1);
            
            // 如果方法名包含括号，去掉括号及其内容
            const bracketIndex = methodName.indexOf('(');
            if (bracketIndex !== -1) {
                methodName = methodName.substring(0, bracketIndex);
            }
            
            return { className, methodName };
        } else {
            // 只有类名
            className = beforeDash;
            return { className, methodName };
        }
    }
    
    // 3. 尝试从其他格式中提取
    // 查找最后一个空格，前面可能是返回类型
    const lastSpaceIndex = part.lastIndexOf(' ');
    if (lastSpaceIndex !== -1) {
        const fullName = part.substring(lastSpaceIndex + 1).trim();
        
        // 检查是否包含方法
        const dotIndex = fullName.lastIndexOf('.');
        if (dotIndex !== -1) {
            className = fullName.substring(0, dotIndex);
            methodName = fullName.substring(dotIndex + 1);
            
            // 如果方法名包含括号，去掉括号及其内容
            const bracketIndex = methodName.indexOf('(');
            if (bracketIndex !== -1) {
                methodName = methodName.substring(0, bracketIndex);
            }
            
            return { className, methodName };
        }
    }
    
    // 默认返回提取到的结果
    return { className, methodName };
}

function getPart(part: string, command: string): string {
    // 提取类名和方法名
    const { className, methodName } = extractClassAndMethod(part);
    
    // 根据命令类型和提取到的信息生成对应的Arthas命令
    if (className) {
        if (methodName) {
            // 有类名和方法名
            switch(command) {
                case 'watch':
                    return `watch ${className} ${methodName} '{params, returnObj, throwExp}' -x 3 -n 5`;
                case 'trace':
                    return `trace ${className} ${methodName}  -n 5 --skipJDKMethod false`;
                case 'sc':
                    return `sc -d ${className}`;
                case 'jad':
                    return `jad ${className} ${methodName} --source-only`;
                case 'stack':
                    return `stack ${className} ${methodName} -n 5`;
                default:
                    return part;
            }
        } else {
            // 只有类名
            switch(command) {
                case 'sc':
                    return `sc -d ${className}`;
                case 'jad':
                    return `jad ${className}`;
                case 'watch':
                case 'trace':
                case 'stack':
                    // 没有方法名，不能执行这些命令
                    throw new Error(`${command}命令需要方法名`);
                default:
                    return className;
            }
        }
    }
    
    // 默认返回原始内容
    return part;
}

async function watch(editor: vscode.TextEditor) {
    copyCommand(editor, 'watch');
}

async function trace(editor: vscode.TextEditor) {
    copyCommand(editor,'trace')
}

async function sc(editor: vscode.TextEditor) {
    copyCommand(editor,'sc')
}

async function jad(editor: vscode.TextEditor) {
    copyCommand(editor,'jad')
}

async function stack(editor: vscode.TextEditor) {
    copyCommand(editor,'stack')
}