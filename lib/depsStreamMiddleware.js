var _ = require('./util');
module.exports = function depsStreamMiddleware(makeDepsStream, resolverFns, options, bundlePath) {
  options = options || {};
  var resolveDepPath = resolverFns.resolveDepPath;
  var bundleMappings = bundlePath != null ? options.bundleMappings[bundlePath] : null;

  return function _depsStreamMiddleware(req, res, next) {
    var mappings = bundleMappings || req.query;

    var expiredAfter = options.cacheControlExpiration || 0;

    var stream = _.generateStream(makeDepsStream, mappings, options, resolveDepPath);

    stream.getMeta().then(function(meta) {
      if (meta == null) {
        res.status(404).end('file not found');
        return ;
      }

      var headers = {
        ETag: req.app.get('etag fn')(meta.etag),
        'Last-Modified': (new Date(meta.mtime)).toUTCString(),
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age='+expiredAfter
      };

      if(expiredAfter > 0){
        headers.Expires = getExpireTime(expiredAfter).toUTCString();
      }

      res.set(headers);

      if (req.fresh) {
        res.status(304).end();
        return ;
      }
      return stream.streamTo(res);
    }).catch(function(err) {
      console.error(err.stack);
      // res.set({
      //   'Content-Type': 'text/plain'
      // });
      // return res.status(500).end(err.toString());
      return next(err);
    });
  };
};

//helpers

function getExpireTime(expiredAfter){
  var date = new Date();
  return new Date(date.getTime() + 1000 * expiredAfter);
}
