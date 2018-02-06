var _ = require('./util');
var etag = require('etag');
var fresh = require('fresh');
var setResHeaders = require('./util').setResHeaders;

module.exports = function depsStreamMiddleware(makeDepsStream, resolverFns, options, bundlePath) {
  options = options || {};
  var resolveDepPath = resolverFns.resolveDepPath;
  var bundleMappings = bundlePath != null ? options.bundleMappings[bundlePath] : null;

  return function _depsStreamMiddleware(req, res, next) {
    var mappings = bundleMappings || getReqQuery(req);

    var expiredAfter = options.cacheControlExpiration || 0;

    var stream = _.generateStream(makeDepsStream, mappings, options, resolveDepPath);

    stream.getMeta().then(function(meta) {
      if (meta == null) {
        res.statusCode = 404;
        res.end('file not found');
        return ;
      }

      var headers = {
        ETag: etag(meta.etag),
        'Last-Modified': (new Date(meta.mtime)).toUTCString(),
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age='+expiredAfter
      };

      if(expiredAfter > 0){
        headers.Expires = getExpireTime(expiredAfter).toUTCString();
      }

      setResHeaders(headers, res);

      if (fresh(req.headers, headers)) {
        res.statusCode = 304;
        res.end();
        return ;
      }

      return stream.streamTo(res);
    }).catch(function(err) {
      console.error(err.stack);

      return next(err);
    });
  };
};

//helpers

function getExpireTime(expiredAfter){
  var date = new Date();
  return new Date(date.getTime() + 1000 * expiredAfter);
}

var url = require('url');
var qs = require('querystring');
function getReqQuery(req) {
  if(!req.query) {
    var parsedUrl = url.parse(req.url);
    req.query = qs.parse(parsedUrl.query);
  }

  return req.query;
}
