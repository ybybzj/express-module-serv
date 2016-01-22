var createDepsStreamer = require('deps-stream');

var transformers = require('./lib/transformers');
var resolver = require('./lib/resolver');
var depsStreamMiddleware = require('./lib/depsStreamMiddleware');
var scriptsMiddleware = require('./lib/scriptsMiddleware');
var _ = require('./lib/util');
// var pUtil = require('path');
module.exports = function(app, options) {
  var routePath = options.routePath || '/m',
    loaderPath = options.loaderPath || '/mloader.js',
    pathSettings = options.pathSettings,
    transformerSettings = options.transformerSettings,
    resolverFns = _.makeResolverFns(pathSettings);
  // pathSettings.base = pUtil.resolve(app.get('$boot_dir'), pathSettings.base);
  var streamMaker = createDepsStreamer({
    transformers: [
      transformers.addComma,
      transformers.wrapCMD(resolverFns, transformerSettings && transformerSettings.cmdWrapper),
      transformers.wrapCSS(resolverFns, transformerSettings && transformerSettings.cssWrapper)
    ],
    depResolver: resolver(resolverFns)
      // resolveDepsCache: resolveCache,
      // contentCache: contentCache
  });
  app.use(loaderPath, scriptsMiddleware(loaderPath, routePath));
  app.use(routePath, depsStreamMiddleware(makeDepsStream, resolverFns));
};

