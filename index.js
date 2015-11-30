var DepsStream = require('deps-stream');
var transformers = require('./lib/transformers');
var resolver = require('./lib/resolver');
var depsStreamMiddleware = require('./lib/depsStreamMiddleware');
var scriptsMiddleware = require('./lib/scriptsMiddleware');
// var pUtil = require('path');
module.exports = function(app, options) {
  var routePath = options.routePath || '/m',
    loaderPath = options.loaderPath || '/mloader.js',
    pathSettings = options.pathSettings;
  // pathSettings.base = pUtil.resolve(app.get('$boot_dir'), pathSettings.base);
  var stream = new DepsStream({
    transformers: [
      transformers.addComma,
      transformers.wrapCMD(pathSettings),
      transformers.wrapCSS(pathSettings)
    ],
    depResolver: resolver(pathSettings)
      // resolveDepsCache: resolveCache,
      // contentCache: contentCache
  });
  app.use(loaderPath, scriptsMiddleware(loaderPath, routePath));
  app.use(routePath, depsStreamMiddleware(stream, pathSettings));
};

