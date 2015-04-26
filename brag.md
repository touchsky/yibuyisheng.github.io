### React 出来了这么久，为什么今年才决定去翻译文档，参与组织 React 中文社区？

React Native

### React 与 AngularJS


* AngularJS 是更完备的一套框架，是比较全面的解决方案，帮助开发者解决了项目代码结构组织问题

* React 更像是一个库，专注于解决 UI 渲染问题，然后对于数据处理等，Facebook 提出了 Flux 方案

    ![](http://facebook.github.io/flux/img/flux-simple-f8-diagram-explained-1300w.png)

* AngularJS 关键知识点：

    - 双向数据绑定
    - digest 、 TTL 震荡
    - watcher，脏检测，复杂 object
    - scope
    - 四种主要模块：directive 、 controller 、 factory 、 service
    - 两个过程： compile 、 link

* React 关键知识点：

    - 单向数据流
    - 没有震荡
    - 虚拟 DOM
    - 由数据变动产生差异，计算这种差异导致的最小 DOM 改变
    - [树形结构差异算法复杂度](http://reactjs.cn/react/docs/reconciliation.html)

* 个人更喜欢 React，因为使开发者更倾向于去思考怎么模块化、组件化和复用代码，当项目大到一定程度的时候，这种优势就会显而易见。

### 几篇文章

[React Native 概述：背景、规划和风险（作者：鬼道 徐凯）](http://div.io/topic/938)

[the dom is not slow your abstraction is](http://webreflection.blogspot.hk/2015/04/the-dom-is-not-slow-your-abstraction-is.html)

### 欢迎大家共同参与建设 React 中文社区

QQ 群：173324629 （内有寸志、题叶等业内知名人士，也有支付宝的大神）

可以到 [https://github.com/reactjs-cn](https://github.com/reactjs-cn) ，给自己感兴趣的项目提交 pr 或者 issue。

其中翻译项目做的比较仓促，翻译不好的地方大家一起纠正。

### 宣传下自己

* 微博昵称：yibuyisheng2009
* https://github.com/yibuyisheng/
* 邮箱：yibuyisheng@163.com

