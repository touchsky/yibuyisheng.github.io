'use strict';
/**
 * 将指令为function的转换一下，比如有指令为：
 * someModule.directive('someDirective', [function() {
 *     return function(scope, element, attrs) {
 *         // do something
 *     }
 * }]);
 * 上述指令就只返回了一个link function。
 * 只返回link function的指令默认的restrict是AC（属性和类名称）
 */
function ngDirective(directive) {
    if (isFunction(directive)) {
        directive = {
            link: directive
        };
    }
    directive.restrict = directive.restrict || 'AC';
    return valueFn(directive);
}