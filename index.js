var createDepsStreamer = require('deps-stream');
var resolver = require('./lib/resolver');
var depsStreamMiddleware = require('./lib/depsStreamMiddleware');
var scriptsMiddleware = require('./lib/scriptsMiddleware');
var _ = require('./lib/util');
var makeTransformer = _.makeTransformer;
var defaultTransformers = require('./lib/transformers');

module.exports = function(app, options) {
  options = options || {};
  var routePath = options.routePath || '/m',
    loaderPath = options.loaderPath || '/mloader.js',
    pathSettings = options.pathSettings,
    transformers = [].concat(options.transformers || defaultTransformers).filter(Boolean),
    resolverFns = _.makeResolverFns(pathSettings, options);

  transformers = transformers.map(function(exTrans) {
    return makeTransformer(resolverFns, exTrans, options);
  });

  var streamMaker = createDepsStreamer({
    transformers: transformers,
    depResolver: resolver(resolverFns)
      // resolveDepsCache: resolveCache,
      // contentCache: contentCache
  });

  if(!options.bundleMappings){
    app.use(loaderPath, scriptsMiddleware(loaderPath, routePath, options));
    app.use(routePath, depsStreamMiddleware(streamMaker, resolverFns, options));
    return;
  }

  applyBundleMapping(app, options, streamMaker, resolverFns);
};

/**
 * bundleMappings => {
 *    '/xxx.js': {
 *      m: 'mod1,xx/mod2'
 *    },
 *    '/yyy/a.js': {
 *      m: 'mod_a,mod_b',
 *      l: 'mod1, xx/mod2'
 *    }
 * }
 */
function applyBundleMapping(app, options, streamMaker, resolverFns){
  var paths = Object.keys(options.bundleMappings);
  if(paths.length === 0){
    return;
  }

  paths.forEach(function(path){
    app.use(ensureLeadSlash(path), depsStreamMiddleware(streamMaker, resolverFns, options, path));
  });
}

function ensureLeadSlash(path){
  path = _.unixfy(path.trim());
  return path.charAt(0) !== '/' ? '/' + path : path;
}
