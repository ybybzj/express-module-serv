var fs = require('fs');
var pUtil = require('path');
var url = require('url');
var memoize = require('./util').memoize;
var scriptsContent = fs.readFileSync(pUtil.resolve(__dirname, '../loader.min.js'));

module.exports = function(loaderPath, routePath){
  var _getMetaByUrl = memoize(getMetaByUrl);
  return function _scriptsMiddleware(req, res, next){
    var pathname = url.parse(req.originalUrl).pathname;
    var moduleBaseUrl = pathname.replace(new RegExp(loaderPath + '$'), routePath);
    var meta = _getMetaByUrl(moduleBaseUrl);
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
    res.status(200).end('(function(w){' + getScriptContent(moduleBaseUrl) + scriptsContent + '})(window);');

  };
};
//helpers
function getMetaByUrl(url){
  return {
    mdate: new Date(),
    etag: url
  };
}

function getScriptContent(url){
  return 'w.__loaderBase__ = \'.'+url+'\';';
}

