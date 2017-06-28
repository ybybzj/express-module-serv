var createDepsStreamer = require('deps-stream');
var resolver = require('./lib/resolver');
var _ = require('./lib/util');
var makeTransformer = _.makeTransformer;
var defaultTransformers = require('./lib/transformers');
var BPromise = require('bluebird');

module.exports = function(options) {
  options = options || {};
  var pathSettings = options.pathSettings,
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

  
  return generateStream(options, streamMaker, resolverFns);
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
function generateStream(options, streamMaker, resolverFns){
  var paths = Object.keys(options.bundleMappings);
  if(paths.length === 0){
    throw new Error('[module-serv/bundle]invalid bundle mappings!');
  }

  return paths.reduce(function(m, path){
    var stream = _makeStream(streamMaker, resolverFns.resolveDepPath, options.bundleMappings[path], path, options);
    m.push(stream);
    return m;
  }, []);
}

function ensureLeadSlash(path){
  path = _.unixfy(path.trim());
  return path.charAt(0) !== '/' ? '/' + path : path;
}

function _makeStream(streamMaker, resolveDepPath, mappings, bundlePath, options){
  var stream = _.generateStream(streamMaker, mappings, options, resolveDepPath);
  var _streamTo = stream.streamTo.bind(stream);
  stream.streamTo = function(writable){
    return stream.getMeta().then(function(meta){
      if(meta == null){
       throw new Error('[module-serv/bundle]module files for bundle "' + bundlePath + '" are not found!');
      }
      return new BPromise(function(resolve, reject){
        stream.onError(reject);
        stream.onEnd(resolve);
        if(typeof writable === 'function'){
          writable = writable({
            etag: meta.etag,
            hash: meta.hash,
            mtime: meta.mtime,
            bundlePath: bundlePath
          });
        }
        _streamTo(writable);
      });
    });
  };

  return stream;
}
