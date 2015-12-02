var fs = require('fs');
var pUtil = require('path');
var url = require('url');
var memoize = require('./util').memoize;
var strHash = require('./util').stringHash;
var scriptsContent = fs.readFileSync(pUtil.resolve(__dirname, '../loader.min.js'));

module.exports = function(loaderPath, routePath){
  var _getMetaByUrl = memoize(getMetaByUrl);
  return function _scriptsMiddleware(req, res, next){
    var pathname = url.parse(req.originalUrl).pathname;
    var baseUrlHash = [pathname,routePath].map(strHash).join('');
    var meta = _getMetaByUrl(baseUrlHash);
    res.set({
      ETag: req.app.get('etag fn')(meta.etag),
      'Last-Modified': (meta.mdate).toUTCString(),
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=0'
    });
    if(req.fresh){
      res.status(304).end();
      return;
    }
    res.status(200).end('(function(w){' + getScriptContent(pathname, routePath, loaderPath) + scriptsContent + '})(window);');

  };
};
//helpers
function getMetaByUrl(url){
  return {
    mdate: new Date(),
    etag: url
  };
}

function getScriptContent(pathname, routePath, loaderPath){
  return 'var __loaderUrlPath__=\''+ pathname + '\';var __loaderPath__=\''+loaderPath+'\';var __moduleRoute__=\''+routePath+'\';';
}

