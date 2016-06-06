var createDepsStreamer = require('deps-stream');
var resolver = require('./lib/resolver');
var depsStreamMiddleware = require('./lib/depsStreamMiddleware');
var scriptsMiddleware = require('./lib/scriptsMiddleware');
var _ = require('./lib/util');
var makeTransformer = _.makeTransformer;
var defaultTransformers = require('./lib/transformers');

module.exports = function(app, options) {
  var routePath = options.routePath || '/m',
    loaderPath = options.loaderPath || '/mloader.js',
    pathSettings = options.pathSettings,
    transformers = [].concat(options.transformers || defaultTransformers).filter(Boolean),
    resolverFns = _.makeResolverFns(pathSettings);

  transformers = transformers.map(function(exTrans) {
    return makeTransformer(resolverFns, exTrans);
  });

  var streamMaker = createDepsStreamer({
    transformers: transformers,
    depResolver: resolver(resolverFns)
      // resolveDepsCache: resolveCache,
      // contentCache: contentCache
  });
  app.use(loaderPath, scriptsMiddleware(loaderPath, routePath, options));
  app.use(routePath, depsStreamMiddleware(streamMaker, resolverFns, options));
};
