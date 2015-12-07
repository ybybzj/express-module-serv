var createDepsStreamer = require('deps-stream');
var transformers = require('./lib/transformers');
var resolver = require('./lib/resolver');
var depsStreamMiddleware = require('./lib/depsStreamMiddleware');
var scriptsMiddleware = require('./lib/scriptsMiddleware');
// var pUtil = require('path');
module.exports = function(app, options) {
  var routePath = options.routePath || '/m',
    loaderPath = options.loaderPath || '/mloader.js',
    pathSettings = options.pathSettings,
    transformerSettings = options.transformerSettings;
  // pathSettings.base = pUtil.resolve(app.get('$boot_dir'), pathSettings.base);
  var makeDepsStream = createDepsStreamer({
    transformers: [
      transformers.addComma,
      transformers.wrapCMD(pathSettings, transformerSettings && transformerSettings.cmdWrapper),
      transformers.wrapCSS(pathSettings, transformerSettings && transformerSettings.cssWrapper)
    ],
    depResolver: resolver(pathSettings)
      // resolveDepsCache: resolveCache,
      // contentCache: contentCache
  });
  app.use(loaderPath, scriptsMiddleware(loaderPath, routePath));
  app.use(routePath, depsStreamMiddleware(makeDepsStream, pathSettings));
};

