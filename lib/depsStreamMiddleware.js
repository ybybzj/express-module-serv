var resolveDepPath = require('./util').resolveDepPath;
module.exports = function depsStreamMiddleware(stream, pathSettings) {
  return function _depsStreamMiddleware(req, res) {
    var modules = (req.query.m || '').split(',').map(function(m) {
      return m.trim();
    }).filter(Boolean);
    var excludModules = (req.query.l || '').split(',').map(function(m) {
      return m.trim();
    }).filter(Boolean);
    stream.buildFrom({
      entries: modules.map(function(module) {
        return resolveDepPath(pathSettings, module);
      }),
      excludes: excludModules.map(function(module) {
        return resolveDepPath(pathSettings, module);
      })
    }).getMeta().then(function(meta) {
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