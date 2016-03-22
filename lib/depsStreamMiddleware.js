module.exports = function depsStreamMiddleware(makeDepsStream, resolverFns, options) {
  options = options || {};
  var resolveDepPath = resolverFns.resolveDepPath;

  return function _depsStreamMiddleware(req, res) {
    var modules = modNamesFromStr(req.query.m || '').map(resolveDepPath);

    var excludModules = modNamesFromStr(req.query.l || '').map(resolveDepPath);

    var expiredAfter = options.cacheControlExpiration || 0;

    var stream = makeDepsStream({
      entry: modules,
      excludeEntries: excludModules,
      reloadOnChange: options.reloadOnChange
    });

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
      res.set({
        'Content-Type': 'text/plain'
      });
      return res.status(500).end(err.toString());
    });
  };
};

//helpers
function modNamesFromStr(str){
  return str.split(',').map(function(m){return m.trim();}).filter(Boolean);
}

function getExpireTime(expiredAfter){
  var date = new Date();
  return new Date(date.getTime() + 1000 * expiredAfter);
}
