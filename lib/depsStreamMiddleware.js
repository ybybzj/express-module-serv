module.exports = function depsStreamMiddleware(makeDepsStream, resolverFns) {
  var resolveDepPath = resolverFns.resolveDepPath;
  return function _depsStreamMiddleware(req, res) {
    var modules = (req.query.m || '').split(',').map(function(m) {
      return m.trim();
    }).filter(Boolean);
    var excludModules = (req.query.l || '').split(',').map(function(m) {
      return m.trim();
    }).filter(Boolean);
    var stream = makeDepsStream({
      entry: modules.map(function(module) {
        return resolveDepPath(module);
      }),
      excludeEntries: excludModules.map(function(module) {
        return resolveDepPath(module);
      })
    });
    stream.getMeta().then(function(meta) {
      if (meta == null) {
        return res.status(404).end('file not found');
      }
      res.set({
        ETag: req.app.get('etag fn')(meta.etag),
        'Last-Modified': (new Date(meta.mtime)).toUTCString(),
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=0'
      });
      if (req.fresh) {
        res.status(304).end();
        return;
      }
      stream.streamTo(res);
    }).catch(function(err) {
      return res.status(500).send(err.toString());
    });
  };
};
