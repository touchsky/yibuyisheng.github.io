'use strict';

/**
 * @ngdoc directive
 * @name a
 * @restrict E
 *
 * @description
 * 修改A标签，当href为空的时候将会阻止默认行为。
 *
 * 这个改变允许使用ngClick指令简单地添加点击回调函数，而不会导致页面跳转或者重新加载，例如：
 * `<a href="" ng-click="list.addItem()">Add Item</a>`
 */
var htmlAnchorDirective = valueFn({
  restrict: 'E',
  compile: function(element, attr) {
    if (!attr.href && !attr.xlinkHref && !attr.name) {
      return function(scope, element) {
        // SVGAElement does not use the href attribute, but rather the 'xlinkHref' attribute.
        var href = toString.call(element.prop('href')) === '[object SVGAnimatedString]' ?
                   'xlink:href' : 'href';
        element.on('click', function(event) {
          // if we have no href url, then don't navigate anywhere.
          if (!element.attr(href)) {
            event.preventDefault();
          }
        });
      };
    }
  }
});
