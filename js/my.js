document.querySelector('#toggle-help').addEventListener('click', function () {
    let el = document.querySelector('#usage')
    if (el.style.display == 'block') el.style.display = 'none'
    else el.style.display = 'block'
})

document.querySelector('#toggle-code-pad').addEventListener('click', function () {
    let el = document.querySelector('#code-pad')
    if (el.style.display == 'block') el.style.display = 'none'
    else el.style.display = 'block'
})


function isNewLine(str) {
    return str.search(/[\{\}\[\]\=\#\/\;]/) === -1  // 没有括号{}[]和=#/;
}

function calcWeight(w, minWeight, maxWeight, reverseWeight) {
    let weightLimit = 1e6   //  较多边且边权太大(>1e7)库文件viz.js就会超出范围出错
    let newWeight = reverseWeight ? (maxWeight + minWeight - w) : w
    if (maxWeight > weightLimit) {
        newWeight = parseInt(newWeight / maxWeight * weightLimit)
    }
    return newWeight < 1 ? 1 : newWeight
}

function calcPenWidth(w, minWeight, maxWeight, reversePenWidth) {
    if (minWeight == maxWeight) return 0.5;  // fix
    return (reversePenWidth ? 2.0 - 1.9 * (w - minWeight) / (maxWeight - minWeight) :
        1.9 * (w - minWeight) / (maxWeight - minWeight) + 0.1).toFixed(1)
}

function translate(rawCode, isDigraph, firstLineNotEdge = true, reversePenWidth = false, reverseWeight = false) {
    rawCode = rawCode.trim()
    let isNewGraph = rawCode.indexOf('graph') === -1  // 是否新图，已经转换过的，可能新加点或边
    let sep = isDigraph ? '->' : '--', indent = '    '
    let a = rawCode.split('\n'), header = []
    let nodes = [], weights = [], oldNodes = []
    let minWeight = 999999999, maxWeight = -1
    let isFirstLine = isNewGraph
    let commentRemainedLine = false
    let endInputByZeroToZero = true   // 0 -- 0 边表示边输入结束，注释掉后续行
    let cntNode = -1, oldMaxId = -1
    for (let i = 0; i < a.length; ++i) {  // 扫描所有行
        a[i] = a[i].trim()
        if (a[i].indexOf('##') === 0) {  // ## 开头的为标题行
            header.push(a[i]), a[i] = '' // 放入 header 并置空
            continue
        }
        if (a[i].length === 0 || a[i].indexOf('#') === 0) continue  // 中间空行 和 #开头的注释行仍按原样输出
        if (isFirstLine && firstLineNotEdge) {
            isFirstLine = false, a[i] = '# ' + a[i];
            let matches = a[i].match(/\d+/)
            if (matches && matches[0] > 0) cntNode = matches[0]  // 首行非边第一个数字将作为点数值
            continue  // 首行非边将注释出现
        }
        if (isNewLine(a[i])) {
            if (commentRemainedLine) {
                a[i] = '# ' + a[i]; continue
            }
            let items = a[i].split(/[ \t]+/)
            if (items.length >= 2) {
                let u = parseInt(items[0]), v = parseInt(items[1])
                if (u == 0 && v == 0 && endInputByZeroToZero) {
                    commentRemainedLine = true
                    a[i] = '# ' + a[i]; continue
                }
                nodes.push(u); nodes.push(v)
                a[i] = indent + u + ' ' + sep + ' ' + v + ' [style="" color=""'
                if (items.length >= 3) {  // 带有权值的，添加下面部分
                    let w = items[2]
                    weights[i] = w
                    if (w - 0 > maxWeight) maxWeight = w - 0
                    if (w - 0 < minWeight) minWeight = w - 0
                    a[i] += ' label="' + w + '" weight="WWWWW" fontcolor="" penwidth="PPPPP"'
                }
                a[i] += ']'
            } else {
                a[i] = '# ' + a[i]
            }
        } else {
            let match = a[i].match(/(\d+)\s*\[label=/)
            if (match && match.length == 2) {
                let id = parseInt(match[1])  // 记录旧的点列表中最大的 id
                oldMaxId = id > oldMaxId ? id : oldMaxId
                a[i] = indent + a[i]
                continue
            }
            let regexp = /(\S+)\s*-[->]{1}\s*(\S+)\s*\[/
            let matches = a[i].match(regexp)            // 匹配得到旧的顶点 u, v
            if (matches && matches.length == 3) {
                let u = parseInt(matches[1]), v = parseInt(matches[2])
                oldNodes.push(u, v)
                regexp = /(\S+)\s*-[->]{1}\s*(\S+)\s*\[.+weight="([0-9]+)".+\]/
                matches = a[i].match(regexp)    // 匹配带权值的边
                if (matches && matches.length == 4) {
                    weights[i] = matches[3]    // 得到旧的权值
                    let w = weights[i] - 0
                    if (w > 0) {
                        if (w > maxWeight) maxWeight = w
                        if (w < minWeight) minWeight = w
                    }
                }
            }
            if (a[i].indexOf('graph') === -1) a[i] = indent + a[i]  // 老的行保持缩进 （因为前面已经trim过）
        }
    }

    nodes = [...(new Set(nodes))].sort((a, b) => a - b).filter(v => !oldNodes.includes(v))  // 新加边的节点，可能原来已经出现过，过滤掉
    for (let i in weights) {
        let w = weights[i]
        let penWidth = calcPenWidth(w, minWeight, maxWeight, reversePenWidth)
        let weight = calcWeight(w, minWeight, maxWeight, reverseWeight)
        a[i] = a[i].replace('WWWWW', weight).replace('PPPPP', penWidth)    // 按权值计算出边的显示宽度和长度
    }

    let b = []

    let newMaxId = Math.max(...nodes)

    if (isNewGraph && cntNode > 0) {  // 是新图
        for (let i = 1; i <= cntNode; i++) {
            if (nodes.indexOf(i) === -1) {   // 不在边中，是孤点
                b.push(indent + i + ' [label="' + i + '" shape="" color="grey" style="filled"]')
            } else {  // 边中的点
                b.push(indent + i + ' [label="' + i + '" shape="" color="" style=""]')
            }
        }
    } else if (!isNewGraph && oldMaxId > 0 && newMaxId > oldMaxId) {
        for (let i = oldMaxId + 1; i <= newMaxId; i++) {
            if (nodes.indexOf(i) === -1) {   // 不在边中，是孤点
                b.push(indent + i + ' [label="' + i + '" shape="" color="grey" style="filled"]')
            } else {  // 边中的点
                b.push(indent + i + ' [label="' + i + '" shape="" color="" style=""]')
            }
        }
    }

    // for (let node of nodes) {
    //     b.push(indent + node + ' [label="' + node + '" shape="" color="" style=""]')  // 新点数据
    // }

    if (!isNewGraph) {  // 不是新图
        while (a.pop().indexOf('}') === -1);   // 从 a[] 尾部开始找，一直到尾部 } 为止
        return header.join('\n') + a.join('\n') + (b.length > 0 ? ('\n' + b.join('\n')) : '') + '\n}\n'; // 可能有新的节点产生
    }
    return header.join('\n') + '\n' + (isDigraph ? 'digraph' : 'graph') + ' G {\n'
        + indent + 'rankdir=TB\n' + a.join('\n') + '\n\n' + b.join('\n')
        + '\n}\n';
}

function r_translate(code, firstLineNotEdge = true) {
    let sep = ''
    let a = code.split('\n'), header = [], data = []
    let hasWeight = false
    let i = 0
    while (i < a.length) {
        if (a[i].indexOf('##') === 0) {
            header.push(a[i].trim())
        } else if (a[i].indexOf('digraph') >= 0) {
            sep = '->'; break
        } else if (a[i].indexOf('graph') >= 0) {
            sep = '--'; break
        }
        ++i
    }
    if (sep === '') return ''
    while (i < a.length) {
        a[i] = a[i].trim()
        if (a[i].indexOf('weight=') > 0) hasWeight = true
        if (a[i][0] === '#') {  // 注释行
            if (/^[ \t\d]+$/.test(a[i].substr(1))) {  // 后续都是空白和数字组成
                data.push(a[i].substr(1).match(/\d+/g).join('  '))
            }
        } else {
            let pattern = '(\\d+)\\s*' + sep + '\\s*(\\d+)\\s*\\['
            if (hasWeight) pattern += '.+label="(\\-?\\d+(\\.\\d+)?)"'  // fix float and negative
            let reg = new RegExp(pattern)
            let fields = reg.exec(a[i])
            if (fields) {
                data.push(fields.slice(1, 4).join('  '))
            }
        }
        i++
    }
    return header.join('\n') + '\n' + data.join('\n');
}


document.querySelector('#translate').addEventListener('click', function () {
    let firstLineNotEdge = document.querySelector('#first-line-not-edge').checked
    let v = document.querySelector('#graph-x').value
    let params = {
        'g1': { isDigraph: false, reversePenWidth: false, reverseWeight: false },
        'g2': { isDigraph: false, reversePenWidth: false, reverseWeight: true },
        'g3': { isDigraph: false, reversePenWidth: true, reverseWeight: false },
        'g4': { isDigraph: false, reversePenWidth: true, reverseWeight: true },
        'd1': { isDigraph: true, reversePenWidth: false, reverseWeight: false },
        'd2': { isDigraph: true, reversePenWidth: false, reverseWeight: true },
        'd3': { isDigraph: true, reversePenWidth: true, reverseWeight: false },
        'd4': { isDigraph: true, reversePenWidth: true, reverseWeight: true }
    }
    if (v in params) {
        let rawCode = editor.getSession().getDocument().getValue()
        let code = translate(rawCode, params[v].isDigraph, firstLineNotEdge, params[v].reversePenWidth, params[v].reverseWeight)
        editor.getSession().getDocument().setValue(code)
    }
})

document.querySelector('#r-translate').addEventListener('click', function () {
    let firstLineNotEdge = document.querySelector('#first-line-not-edge').checked
    let code = editor.getSession().getDocument().getValue()
    let rawCode = r_translate(code, firstLineNotEdge)
    if (rawCode.length > 0)
        document.querySelector('#code-area').value = rawCode
})

document.querySelector('#copy-to-left').addEventListener('click', function () {
    let rawCode = document.querySelector('#code-area').value
    editor.getSession().getDocument().setValue(rawCode)
})

let xhr = new XMLHttpRequest()
xhr.open('get', 'help.md')
xhr.send()
xhr.onreadystatechange = function () {
    if (xhr.readyState == 4 && xhr.status == 200) {
        document.querySelector('#usage').innerHTML = marked.parse(xhr.responseText)
    }
}

document.querySelector('#reverse-edge').addEventListener('click', function () {
    let str = editor.getSession().getTextRange(editor.getSelectionRange())
    if (!str) return
    let allRows = editor.getSession().getDocument().getValue()
    let pattern = /(\d+)(\s*-[-|>]\s*)(\d+)(\s*\[)/g
    let replaceMap = []
    while (result = pattern.exec(str)) {
        replaceMap.push({ old: result[0], new: result[3] + result[2] + result[1] + result[4] })
    }
    for (let i = 0; i < replaceMap.length; i++) {
        allRows = allRows.replace(replaceMap[i].old, replaceMap[i].new)
    }
    editor.getSession().getDocument().setValue(allRows)
})