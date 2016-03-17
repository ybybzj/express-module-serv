var createDepsStreamer = require('deps-stream');

var defaultTransformers = require('./lib/transformers');
var resolver = require('./lib/resolver');
var depsStreamMiddleware = require('./lib/depsStreamMiddleware');
var scriptsMiddleware = require('./lib/scriptsMiddleware');
var _ = require('./lib/util');
var makeTransformer = _.makeTransformer;

module.exports = function(app, options) {
  var routePath = options.routePath || '/m',
    loaderPath = options.loaderPath || '/mloader.js',
    pathSettings = options.pathSettings,
    transformerSettings = options.transformerSettings,
    extraTransformers = [].concat(options.transformers).filter(Boolean),
    resolverFns = _.makeResolverFns(pathSettings);
  // pathSettings.base = pUtil.resolve(app.get('$boot_dir'), pathSettings.base);

  var transformers = [
      makeTransformer(resolverfns, defaulttransformers.addcomma),
      makeTransformer(resolverfns, defaulttransformers.wrapcmd),
      makeTransformer(resolverfns, defaulttransformers.wrapcss(transformersettings && transformersettings.csswrapper))
  ];

  if(extraTransformers.length){
    transformers = transformers.concat(extraTransformers.map(function(exTrans){
      return makeTransformer(resolverFns, exTrans);
    }));
  }

  var streamMaker = createDepsStreamer({
    transformers: transformers,
    depResolver: resolver(resolverFns)
      // resolveDepsCache: resolveCache,
      // contentCache: contentCache
  });
  app.use(loaderPath, scriptsMiddleware(loaderPath, routePath, options.globals));
  app.use(routePath, depsStreamMiddleware(streamMaker, resolverFns));
};

