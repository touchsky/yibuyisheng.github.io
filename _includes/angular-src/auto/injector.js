'use strict';

/**
 * @ngdoc function
 * @module ng
 * @name angular.injector
 * @kind function
 *
 * @description
 * 创建一个注入器，用于获取services和依赖注入
 *
 * @param {Array.<string|Function>} modules 一组模块函数或者他们的别名。必须显示地添加ng模块。
 * @param {boolean=} [strictDi=false] 注入器是否应该是严格的模式，严格模式禁止用函数参数的方式来实现依赖注入（function($scope) {}）。
 * @returns {injector} 返回注入器对象。
 *
 * @example
 * Typical usage
 * ```js
 *   // 创建一个注入器
 *   var $injector = angular.injector(['ng']);
 *
 *   // 使用注入器来驱动你的应用
 *   // 使用类型引用来自动地注入参数（['$scope', function($scope) {}]），或者使用隐式注入（function($scope) {}）
 *   $injector.invoke(function($rootScope, $compile, $document) {
 *     $compile($document)($rootScope);
 *     $rootScope.$digest();
 *   });
 * ```
 *
 * 有时你想从外界的angular获取当前运行的angular应用的注入器。或许你想在应用引导完成之后注入和编译一些标记（标签）。
 * 你可以用JQuery/jqLite的额外方法injector()来实现这个功能。
 *
 * 很少会这样干，但是一些第三方的库可能会注入标记（标签）
 *
 * 在下面的这个例子中，一段包含ng-controller指令的HTML代码被jQuery添加到文档的末尾。
 * 接下来我们将它编译连接到当前的AngularJS scope。
 *
 * ```js
 * var $div = $('<div ng-controller="MyCtrl">{{content.label}}</div>');
 * $(document.body).append($div);
 *
 * angular.element(document).injector().invoke(function($compile) {
 *   var scope = angular.element($div).scope();
 *   $compile($div)(scope);
 * });
 * ```
 */


/**
 * @ngdoc module
 * @name auto
 * @description
 *
 * 一个隐式的模块，会被自动添加到每一个注入器。
 */

var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;      // 匹配函数中的参数
var FN_ARG_SPLIT = /,/;                                  // 用于分离用逗号隔开的一对参数
var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg; // 匹配代码注释
var $injectorMinErr = minErr('$injector');

/**
 * 将函数fn转换成比较干净的字符串形式，
 * 比如anonFn(function test(a, b, c) {})，会被转换成字符串'function(a, b, c)'
 */
function anonFn(fn) {
    // 用于匿名函数，显示出来的函数特征至少可以帮助debug
    var fnText = fn.toString().replace(STRIP_COMMENTS, ''),
        args = fnText.match(FN_ARGS);
    if (args) {
        return 'function(' + (args[1] || '').replace(/[\s\r\n]+/, ' ') + ')';
    }
    return 'fn';
}

/**
 * 主要用于解析出依赖，
 * 比如：
 *     function($scope, $compile) {}，解析出的依赖是['$scope', '$compile']
 *     ['$scope', '$compile', function($scope, $compile) {}]解析出的依赖也是['$scope', '$compile']
 */
function annotate(fn, strictDi, name) {
    var $inject,
        fnText,
        argDecl,
        last;

    // fn是一个函数
    if (typeof fn === 'function') {
        // 如果fn中没有明确指定$inject，则开始修复
        if (!($inject = fn.$inject)) {
            $inject = [];
            if (fn.length) {
                // 如果是严格的模式，则抛出异常，
                // 因为严格模式不支持function($compile, $scope) {}这种形式的依赖注入
                if (strictDi) {
                    if (!isString(name) || !name) {
                        name = fn.name || anonFn(fn);
                    }
                    throw $injectorMinErr('strictdi',
                        '{0} is not using explicit annotation and cannot be invoked in strict mode', name);
                }
                // 将fn函数转换成字符串，并去掉其中的注释
                fnText = fn.toString().replace(STRIP_COMMENTS, '');
                // 提取函数中的参数，是一个用逗号隔开的字符串
                argDecl = fnText.match(FN_ARGS);
                // 遍历每一个参数名字，将名字提取到$inject数组中
                forEach(argDecl[1].split(FN_ARG_SPLIT), function(arg) {
                    arg.replace(FN_ARG, function(all, underscore, name) {
                        $inject.push(name);
                    });
                });
            }
            // 将$inject数组设置到fn函数上面去
            fn.$inject = $inject;
        }
    }
    // fn是一个数组，类似于['$scope', function($scope) {}]
    else if (isArray(fn)) {
        last = fn.length - 1;
        // fn数组最后一个元素必须是一个函数
        assertArgFn(fn[last], 'fn');
        // 出去最后一个元素，前面的都是依赖
        $inject = fn.slice(0, last);
    } else {
        assertArgFn(fn, 'fn', true);
    }
    return $inject;
}

///////////////////////////////////////

/**
 * @ngdoc service
 * @name $injector
 *
 * @description
 *
 * $injector用于获取对象实例，这些对象实例用provider、instantiate types、
 * invoke methods和load modules的方式定义出来。
 *
 * 下面的例子总是true：
 *
 * ```js
 *   var $injector = angular.injector();
 *   expect($injector.get('$injector')).toBe($injector);
 *   expect($injector.invoke(function($injector) {
 *     return $injector;
 *   })).toBe($injector);
 * ```
 *
 * # Injection Function Annotation
 *
 * JavaScript does not have annotations, and annotations are needed for dependency injection. The
 * following are all valid ways of annotating function with injection arguments and are equivalent.
 *
 * ```js
 *   // 隐式注入（仅在代码没有被压缩或者混淆的前提下有效）
 *   $injector.invoke(function(serviceA){});
 *
 *   // annotated
 *   function explicit(serviceA) {};
 *   explicit.$inject = ['serviceA'];
 *   $injector.invoke(explicit);
 *
 *   // inline
 *   $injector.invoke(['serviceA', function(serviceA){}]);
 * ```
 *
 * ## 结论
 *
 * 在JavaScript调用一个函数的toString()方法会返回这个函数的定义。
 * 可以从返回的定义（字符串）中解析出函数的参数。这种找到注解的方式
 * 在严格模式下面是禁止的。
 * 注意：压缩和使用混淆的时候，这种方式就不会奏效了，因为会改变参数的名字。
 *
 * ## `$inject` Annotation
 * 通过设置$inject属性到函数上面，注入的参数可以用这个属性来指定。
 *
 * ## Inline
 * 注入参数的名称数组的形式，最后一个元素是将被调用的函数。
 */

/**
 * @ngdoc method
 * @name $injector#get
 *
 * @description
 * 返回service的实例
 *
 * @param {string} name 要获取的实例名称。
 * @param {string} caller An optional string to provide the origin of the function call for error messages.
 * @return {*} 返回最后的实例。
 */

/**
 * @ngdoc method
 * @name $injector#invoke
 *
 * @description
 * 使用$injector中的参数来调用方法。
 *
 * @param {!Function} fn 被调用的方法。 函数的参数根据注解规则来注入。
 * @param {Object=} self 被调用函数中的this变量。
 * @param {Object=} locals 可选。如果设置了，那么要注入的参数首先根据参数名到这里面取值，而不是去$injector里面获取。
 * @returns {*} 返回被调用函数的返回值。
 */

/**
 * @ngdoc method
 * @name $injector#has
 *
 * @description
 * 允许用户查询指定的service是否存在。
 *
 * @param {string} name 用于查询的service名字。
 * @returns {boolean} 如果存在，返回true。
 */

/**
 * @ngdoc method
 * @name $injector#instantiate
 * @description
 * Create a new instance of JS type. The method takes a constructor function, invokes the new
 * operator, and supplies all of the arguments to the constructor function as specified by the
 * constructor annotation.
 *
 * @param {Function} Type Annotated constructor function.
 * @param {Object=} locals Optional object. If preset then any argument names are read from this
 * object first, before the `$injector` is consulted.
 * @returns {Object} new instance of `Type`.
 */

/**
 * @ngdoc method
 * @name $injector#annotate
 *
 * @description
 * 返回一组service名字，。。。（Returns an array of service names which the function is requesting for injection.）
 * 当函数被调用的时候，注入器使用这个API来决定注入哪些service到这个函数。
 * 有三种方式可以实现这个函数的依赖注解。
 *
 * # 函数参数名字
 *
 * 最简单的形式是从函数的参数中取出依赖。这种方式是通过将函数用toString()方法转换成字符串，然后取出参数名字来实现的。
 * ```js
 *   // Given
 *   function MyController($scope, $route) {
 *     // ...
 *   }
 *
 *   // Then
 *   expect(injector.annotate(MyController)).toEqual(['$scope', '$route']);
 * ```
 *
 * 你可以通过使用严格的注入模式来禁止这种方式。
 *
 * 这种方式在代码压缩、混淆的时候无效。正视由于这个原因，下面的注解策略也被支持。
 *
 * # $inject属性
 *
 * 如果函数有$inject属性，并且它的值是一个字符串数组，这串字符代表要被注入到函数的service的名字。
 * ```js
 *   // Given
 *   var MyController = function(obfuscatedScope, obfuscatedRoute) {
 *     // ...
 *   }
 *   // Define function dependencies
 *   MyController['$inject'] = ['$scope', '$route'];
 *
 *   // Then
 *   expect(injector.annotate(MyController)).toEqual(['$scope', '$route']);
 * ```
 *
 * # 数组标记
 *
 * It is often desirable to inline Injected functions and that's when setting the `$inject` property
 * is very inconvenient. In these situations using the array notation to specify the dependencies in
 * a way that survives minification is a better choice:
 *
 * ```js
 *   // We wish to write this (not minification / obfuscation safe)
 *   injector.invoke(function($compile, $rootScope) {
 *     // ...
 *   });
 *
 *   // We are forced to write break inlining
 *   var tmpFn = function(obfuscatedCompile, obfuscatedRootScope) {
 *     // ...
 *   };
 *   tmpFn.$inject = ['$compile', '$rootScope'];
 *   injector.invoke(tmpFn);
 *
 *   // To better support inline function the inline annotation is supported
 *   injector.invoke(['$compile', '$rootScope', function(obfCompile, obfRootScope) {
 *     // ...
 *   }]);
 *
 *   // Therefore
 *   expect(injector.annotate(
 *      ['$compile', '$rootScope', function(obfus_$compile, obfus_$rootScope) {}])
 *    ).toEqual(['$compile', '$rootScope']);
 * ```
 *
 * @param {Function|Array.<string|Function>} fn Function for which dependent service names need to
 * be retrieved as described above.
 *
 * @param {boolean=} [strictDi=false] Disallow argument name annotation inference.
 *
 * @returns {Array.<string>} The names of the services which the function requires.
 */



/**
 * @ngdoc service
 * @name $provide
 *
 * @description
 *
 * $provide service有一系列的方法运用$injector来注册组件。其中许多方法也暴露在angular.Module上面。
 *
 * 一个Angular的service是一个service factory创建的单例对象。
 * 这些service factory是一个service provider依次创建的。
 * 这些service providers是构造函数，在被实例化的时候必须包含一个叫做$get的属性，这个$get属性保存了service factory函数。
 *
 * 当你请求一个service，$injector有负责找到正确的service provider，实例化这个service provider，然后
 * 调用$get service factory函数获取这个service的实例。
 *
 * 一般service没有配置选项，也没有必要给service factory添加方法。
 * provider仅仅是一个有$get属性的构造函数，由此，$provide service有附加的辅助方法来注册service而不指定provider。
 *
 * * {@link auto.$provide#provider provider(provider)} - registers a **service provider** with the
 *     {@link auto.$injector $injector}
 * * {@link auto.$provide#constant constant(obj)} - registers a value/object that can be accessed by
 *     providers and services.
 * * {@link auto.$provide#value value(obj)} - registers a value/object that can only be accessed by
 *     services, not providers.
 * * {@link auto.$provide#factory factory(fn)} - registers a service **factory function**, `fn`,
 *     that will be wrapped in a **service provider** object, whose `$get` property will contain the
 *     given factory function.
 * * {@link auto.$provide#service service(class)} - registers a **constructor function**, `class`
 *     that will be wrapped in a **service provider** object, whose `$get` property will instantiate
 *      a new object using the given constructor function.
 *
 * See the individual methods for more information and examples.
 */

/**
 * @ngdoc method
 * @name $provide#provider
 * @description
 *
 * 利用$injector注册一个provider function。provider function是构造函数，这个构造函数的实例负责构建某一个service。
 *
 * service provider的名字以它将要构造的service名字加上一个后缀Provider命名（例如$log对应$logProvider）。
 *
 * service provider对象可以包含额外的方法，用于配置这个provider和它的service。重要的是，你能够配置通过$get方法创建何种的service，
 * 或者service将会如何实现功能。例如，$logProvider有一个方法debugEnabled()，这个方法让你指定service是否向控制台输出debug信息。
 *
 * @param {string} name 实例的名字。注意：provider的名字将会是[name + 'Provider']的形式。
 * @param {(Object|function())} provider 如果provider是:
 *
 *   - 对象: 这个对象必须具备一个$get方法。当需要创建一个实例的时候，这个$get方法就会被$injector.invoke()调用。
 *   - 构造函数: 将会通过$injector.instantiate()创建一个实例，接下来就被当成一个对象来处理了。
 *
 * @returns {Object} 注册好的provider实例

 * @例子
 *
 * 下面的例子展示了如何创建一个简单的事件追踪service，然后使用$provider.provider()注册。
 *
 * ```js
 *  // Define the eventTracker provider
 *  function EventTrackerProvider() {
 *    var trackingUrl = '/track';
 *
 *    // A provider method for configuring where the tracked events should been saved
 *    this.setTrackingUrl = function(url) {
 *      trackingUrl = url;
 *    };
 *
 *    // The service factory function
 *    this.$get = ['$http', function($http) {
 *      var trackedEvents = {};
 *      return {
 *        // Call this to track an event
 *        event: function(event) {
 *          var count = trackedEvents[event] || 0;
 *          count += 1;
 *          trackedEvents[event] = count;
 *          return count;
 *        },
 *        // Call this to save the tracked events to the trackingUrl
 *        save: function() {
 *          $http.post(trackingUrl, trackedEvents);
 *        }
 *      };
 *    }];
 *  }
 *
 *  describe('eventTracker', function() {
 *    var postSpy;
 *
 *    beforeEach(module(function($provide) {
 *      // Register the eventTracker provider
 *      $provide.provider('eventTracker', EventTrackerProvider);
 *    }));
 *
 *    beforeEach(module(function(eventTrackerProvider) {
 *      // Configure eventTracker provider
 *      eventTrackerProvider.setTrackingUrl('/custom-track');
 *    }));
 *
 *    it('tracks events', inject(function(eventTracker) {
 *      expect(eventTracker.event('login')).toEqual(1);
 *      expect(eventTracker.event('login')).toEqual(2);
 *    }));
 *
 *    it('saves to the tracking url', inject(function(eventTracker, $http) {
 *      postSpy = spyOn($http, 'post');
 *      eventTracker.event('login');
 *      eventTracker.save();
 *      expect(postSpy).toHaveBeenCalled();
 *      expect(postSpy.mostRecentCall.args[0]).not.toEqual('/track');
 *      expect(postSpy.mostRecentCall.args[0]).toEqual('/custom-track');
 *      expect(postSpy.mostRecentCall.args[1]).toEqual({ 'login': 1 });
 *    }));
 *  });
 * ```
 */

/**
 * @ngdoc method
 * @name $provide#factory
 * @description
 *
 * 注册一个service factory，这个service factory将会被调用返回响应的service实例。
 * This is short for registering a service where its provider consists of only a `$get` property,
 * which is the given service factory function.
 * You should use {@link auto.$provide#factory $provide.factory(getFn)} if you do not need to
 * configure your service in a provider.
 *
 * @param {string} name The name of the instance.
 * @param {function()} $getFn The $getFn for the instance creation. Internally this is a short hand
 *                            for `$provide.provider(name, {$get: $getFn})`.
 * @returns {Object} registered provider instance
 *
 * @example
 * Here is an example of registering a service
 * ```js
 *   $provide.factory('ping', ['$http', function($http) {
 *     return function ping() {
 *       return $http.send('/ping');
 *     };
 *   }]);
 * ```
 * You would then inject and use this service like this:
 * ```js
 *   someModule.controller('Ctrl', ['ping', function(ping) {
 *     ping();
 *   }]);
 * ```
 */


/**
 * @ngdoc method
 * @name $provide#service
 * @description
 *
 * Register a **service constructor**, which will be invoked with `new` to create the service
 * instance.
 * This is short for registering a service where its provider's `$get` property is the service
 * constructor function that will be used to instantiate the service instance.
 *
 * You should use {@link auto.$provide#service $provide.service(class)} if you define your service
 * as a type/class.
 *
 * @param {string} name The name of the instance.
 * @param {Function} constructor A class (constructor function) that will be instantiated.
 * @returns {Object} registered provider instance
 *
 * @example
 * Here is an example of registering a service using
 * {@link auto.$provide#service $provide.service(class)}.
 * ```js
 *   var Ping = function($http) {
 *     this.$http = $http;
 *   };
 *
 *   Ping.$inject = ['$http'];
 *
 *   Ping.prototype.send = function() {
 *     return this.$http.get('/ping');
 *   };
 *   $provide.service('ping', Ping);
 * ```
 * You would then inject and use this service like this:
 * ```js
 *   someModule.controller('Ctrl', ['ping', function(ping) {
 *     ping.send();
 *   }]);
 * ```
 */


/**
 * @ngdoc method
 * @name $provide#value
 * @description
 *
 * Register a **value service** with the {@link auto.$injector $injector}, such as a string, a
 * number, an array, an object or a function.  This is short for registering a service where its
 * provider's `$get` property is a factory function that takes no arguments and returns the **value
 * service**.
 *
 * Value services are similar to constant services, except that they cannot be injected into a
 * module configuration function (see {@link angular.Module#config}) but they can be overridden by
 * an Angular
 * {@link auto.$provide#decorator decorator}.
 *
 * @param {string} name The name of the instance.
 * @param {*} value The value.
 * @returns {Object} registered provider instance
 *
 * @example
 * Here are some examples of creating value services.
 * ```js
 *   $provide.value('ADMIN_USER', 'admin');
 *
 *   $provide.value('RoleLookup', { admin: 0, writer: 1, reader: 2 });
 *
 *   $provide.value('halfOf', function(value) {
 *     return value / 2;
 *   });
 * ```
 */


/**
 * @ngdoc method
 * @name $provide#constant
 * @description
 *
 * Register a **constant service**, such as a string, a number, an array, an object or a function,
 * with the {@link auto.$injector $injector}. Unlike {@link auto.$provide#value value} it can be
 * injected into a module configuration function (see {@link angular.Module#config}) and it cannot
 * be overridden by an Angular {@link auto.$provide#decorator decorator}.
 *
 * @param {string} name The name of the constant.
 * @param {*} value The constant value.
 * @returns {Object} registered instance
 *
 * @example
 * Here a some examples of creating constants:
 * ```js
 *   $provide.constant('SHARD_HEIGHT', 306);
 *
 *   $provide.constant('MY_COLOURS', ['red', 'blue', 'grey']);
 *
 *   $provide.constant('double', function(value) {
 *     return value * 2;
 *   });
 * ```
 */


/**
 * @ngdoc method
 * @name $provide#decorator
 * @description
 *
 * 运用$injector注册一个service decorator。
 * 一个service decorator监听一个service的创建，允许覆盖或者修改service的功能。这个decorator返回的对象可能是原始的service，
 * 或者一个新的service对象，这个对象代替或者包装和代理原始的service。
 *
 * @param {string} name 要修饰的service。
 * @param {function()} decorator This function will be invoked when the service needs to be
 *    instantiated and should return the decorated service instance. The function is called using
 *    the {@link auto.$injector#invoke injector.invoke} method and is therefore fully injectable.
 *    Local injection arguments:
 *
 *    * `$delegate` - The original service instance, which can be monkey patched, configured,
 *      decorated or delegated to.
 *
 * @example
 * Here we decorate the {@link ng.$log $log} service to convert warnings to errors by intercepting
 * calls to {@link ng.$log#error $log.warn()}.
 * ```js
 *   $provide.decorator('$log', ['$delegate', function($delegate) {
 *     $delegate.warn = $delegate.error;
 *     return $delegate;
 *   }]);
 * ```
 */


function createInjector(modulesToLoad, strictDi) {
    strictDi = (strictDi === true);
    var INSTANTIATING = {},
        providerSuffix = 'Provider',
        path = [],
        loadedModules = new HashMap([], true),
        providerCache = {
            $provide: {
                provider: supportObject(provider),
                factory: supportObject(factory),
                service: supportObject(service),
                value: supportObject(value),
                constant: supportObject(constant),
                decorator: decorator
            }
        },
        providerInjector = (providerCache.$injector =
            createInternalInjector(providerCache, function(serviceName, caller) {
                if (angular.isString(caller)) {
                    path.push(caller);
                }
                throw $injectorMinErr('unpr', "Unknown provider: {0}", path.join(' <- '));
            })),
        instanceCache = {},
        instanceInjector = (instanceCache.$injector =
            createInternalInjector(instanceCache, function(serviceName, caller) {
                var provider = providerInjector.get(serviceName + providerSuffix, caller);
                return instanceInjector.invoke(provider.$get, provider, undefined, serviceName);
            }));


    forEach(loadModules(modulesToLoad), function(fn) {
        instanceInjector.invoke(fn || noop);
    });

    return instanceInjector;

    ////////////////////////////////////
    // $provider
    ////////////////////////////////////

    function supportObject(delegate) {
        return function(key, value) {
            // 如果第一个参数是一个object，则用delegate函数遍历这个object
            if (isObject(key)) {
                forEach(key, reverseParams(delegate));
            }
            // 否则，用delegate函数直接访问前两个参数
            else {
                return delegate(key, value);
            }
        };
    }

    function provider(name, provider_) {
        // 如果name中没有service属性，抛出异常
        assertNotHasOwnProperty(name, 'service');
        // 实例化provider
        if (isFunction(provider_) || isArray(provider_)) {
            provider_ = providerInjector.instantiate(provider_);
        }
        // 如果实例化后的对象没有$get属性，则抛出异常。
        // $get用于定义factory方法
        if (!provider_.$get) {
            throw $injectorMinErr('pget', "Provider '{0}' must define $get factory method.", name);
        }
        // 将实例化后的对象存放在cache中，并返回这个对象
        return providerCache[name + providerSuffix] = provider_;
    }

    function enforceReturnValue(name, factory) {
        return function enforcedReturnValue() {
            var result = instanceInjector.invoke(factory, this);
            if (isUndefined(result)) {
                throw $injectorMinErr('undef', "Provider '{0}' must return a value from $get factory method.", name);
            }
            return result;
        };
    }

    function factory(name, factoryFn, enforce) {
        return provider(name, {
            $get: enforce !== false ? enforceReturnValue(name, factoryFn) : factoryFn
        });
    }

    function service(name, constructor) {
        return factory(name, ['$injector', function($injector) {
            return $injector.instantiate(constructor);
        }]);
    }

    function value(name, val) {
        return factory(name, valueFn(val), false);
    }

    function constant(name, value) {
        assertNotHasOwnProperty(name, 'constant');
        providerCache[name] = value;
        instanceCache[name] = value;
    }

    function decorator(serviceName, decorFn) {
        var origProvider = providerInjector.get(serviceName + providerSuffix),
            orig$get = origProvider.$get;

        origProvider.$get = function() {
            var origInstance = instanceInjector.invoke(orig$get, origProvider);
            return instanceInjector.invoke(decorFn, null, {
                $delegate: origInstance
            });
        };
    }

    ////////////////////////////////////
    // Module Loading
    ////////////////////////////////////
    function loadModules(modulesToLoad) {
        var runBlocks = [],
            moduleFn;
        forEach(modulesToLoad, function(module) {
            // loadedModules：已经被load的module
            // 数据结构类似：{'ng': true, '$compile': true}
            if (loadedModules.get(module)) return;
            loadedModules.put(module, true);

            function runInvokeQueue(queue) {
                var i, ii;
                for (i = 0, ii = queue.length; i < ii; i++) {
                    var invokeArgs = queue[i],
                        provider = providerInjector.get(invokeArgs[0]);

                    provider[invokeArgs[1]].apply(provider, invokeArgs[2]);
                }
            }

            try {
                if (isString(module)) {
                    // angularModule()函数同angular.module()函数
                    moduleFn = angularModule(module);
                    // 递归调用loadModules，获取当前module的依赖
                    runBlocks = runBlocks.concat(loadModules(moduleFn.requires)).concat(moduleFn._runBlocks);
                    runInvokeQueue(moduleFn._invokeQueue);
                    runInvokeQueue(moduleFn._configBlocks);
                } else if (isFunction(module)) {
                    runBlocks.push(providerInjector.invoke(module));
                } else if (isArray(module)) {
                    runBlocks.push(providerInjector.invoke(module));
                } else {
                    assertArgFn(module, 'module');
                }
            } catch (e) {
                if (isArray(module)) {
                    module = module[module.length - 1];
                }
                if (e.message && e.stack && e.stack.indexOf(e.message) == -1) {
                    // Safari & FF's stack traces don't contain error.message content
                    // unlike those of Chrome and IE
                    // So if stack doesn't contain message, we create a new string that contains both.
                    // Since error.stack is read-only in Safari, I'm overriding e and not e.stack here.
                    /* jshint -W022 */
                    e = e.message + '\n' + e.stack;
                }
                throw $injectorMinErr('modulerr', "Failed to instantiate module {0} due to:\n{1}",
                    module, e.stack || e.message || e);
            }
        });
        return runBlocks;
    }

    ////////////////////////////////////
    // internal Injector
    ////////////////////////////////////

    function createInternalInjector(cache, factory) {

        /**
         * 从cache中获取service
         */
        function getService(serviceName, caller) {
            // 如果cache中已经存在，则直接返回
            if (cache.hasOwnProperty(serviceName)) {
                // 如果这个service正处于实例化阶段，则抛出循环依赖的异常
                if (cache[serviceName] === INSTANTIATING) {
                    throw $injectorMinErr('cdep', 'Circular dependency found: {0}',
                        serviceName + ' <- ' + path.join(' <- '));
                }
                return cache[serviceName];
            }
            // 否则尝试创建这个service
            else {
                try {
                    // 将service名字（或者说唯一ID）存放在path数组中
                    path.unshift(serviceName);
                    // 状态置为实例化中
                    cache[serviceName] = INSTANTIATING;
                    // 实例化并返回service，该service有个$get属性，在此处这个$get属性实际上就是caller
                    return cache[serviceName] = factory(serviceName, caller);
                } catch (err) {
                    // 实例化出现了异常，删除cache中相应的service属性
                    if (cache[serviceName] === INSTANTIATING) {
                        delete cache[serviceName];
                    }
                    throw err;
                } finally {
                    path.shift();
                }
            }
        }

        /**
         * 调用fn指示的工厂方法，并返回工厂方法的返回值
         */
        function invoke(fn, self, locals, serviceName) {
            // 参数修正
            if (typeof locals === 'string') {
                serviceName = locals;
                locals = null;
            }

            var args = [],
                $inject = annotate(fn, strictDi, serviceName),  // 解析出fn中的依赖：一个字符串数组
                length, i,
                key;

            // 找到各个依赖注入对象，并存放在args中
            for (i = 0, length = $inject.length; i < length; i++) {
                key = $inject[i];
                // 对于依赖名字不是字符串的，直接抛出异常
                if (typeof key !== 'string') {
                    throw $injectorMinErr('itkn',
                        'Incorrect injection token! Expected service name as string, got {0}', key);
                }
                args.push(
                    locals && locals.hasOwnProperty(key) ? locals[key] : getService(key, serviceName)
                );
            }
            if (isArray(fn)) {
                fn = fn[length];
            }

            // http://jsperf.com/angularjs-invoke-apply-vs-switch
            // #5388
            // 执行工厂函数
            return fn.apply(self, args);
        }

        function instantiate(Type, locals, serviceName) {
            // Check if Type is annotated and use just the given function at n-1 as parameter
            // e.g. someModule.factory('greeter', ['$window', function(renamed$window) {}]);
            // Object creation: http://jsperf.com/create-constructor/2
            var instance = Object.create((isArray(Type) ? Type[Type.length - 1] : Type).prototype);
            var returnedValue = invoke(Type, instance, locals, serviceName);

            return isObject(returnedValue) || isFunction(returnedValue) ? returnedValue : instance;
        }

        return {
            invoke: invoke,
            instantiate: instantiate,
            get: getService,
            annotate: annotate,
            has: function(name) {
                return providerCache.hasOwnProperty(name + providerSuffix) || cache.hasOwnProperty(name);
            }
        };
    }
}

createInjector.$$annotate = annotate;