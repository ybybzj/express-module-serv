var createDepsStreamer = require('deps-stream');
var resolver = require('./lib/resolver');
var depsStreamMiddleware = require('./lib/depsStreamMiddleware');
var scriptsMiddleware = require('./lib/scriptsMiddleware');
var _ = require('./lib/util');
var makeTransformer = _.makeTransformer;
var defaultTransformers = require('./lib/transformers');
var pUtil = require('path');

function makeMiddlewares(options) {
  options = options || {};
  var routePath = options.routePath || '/m',
    loaderPath = options.loaderPath || '/mloader.js',
    pathSettings = options.pathSettings || {
      base: pUtil.resolve(process.cwd(), './src')
    },
    bundleMappings = options.bundleMappings || {},
    transformers = [].concat(options.transformers || defaultTransformers).filter(Boolean),
    resolverFns = _.makeResolverFns(pathSettings, options);

  transformers = transformers.map(function(exTrans) {
    return makeTransformer(resolverFns, exTrans, options);
  });

  var depsStreamOpts = {
    transformers: transformers,
    depResolver: resolver(resolverFns)
      // resolveDepsCache: resolveCache,
      // contentCache: contentCache
  }

  if(options.contentCache) {
    depsStreamOpts.contentCache = options.contentCache
  }

  var streamMaker = createDepsStreamer(depsStreamOpts);

  var result = [];

  var bundlePaths = Object.keys(bundleMappings);
  if(bundlePaths.length <= 0) {
    result.push({
      route: loaderPath,
      middleware: scriptsMiddleware(loaderPath, routePath, options)
    });
    result.push({
      route: routePath,
      middleware: depsStreamMiddleware(streamMaker, resolverFns, options)
    });
  } else {
    bundlePaths.forEach(function(rpath){
      result.push({
        route: rpath,
        middleware: depsStreamMiddleware(streamMaker, resolverFns, options, rpath)
      });
    });
  }
  return result;
}

function serv(app, options) {
  var middlewares = makeMiddlewares(options);
  middlewares.forEach(function(mw){
    app.use(mw.route, mw.middleware);
  });
};

serv.makeMiddlewares = makeMiddlewares;

module.exports = serv;

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
