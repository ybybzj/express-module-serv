var fs = require('fs');
var pUtil = require('path');
var url = require('url');
var memoize = require('./util').memoize;
var strHash = require('./util').stringHash;
var setResHeaders = require('./util').setResHeaders;

var promiseScript = fs.readFileSync(pUtil.resolve(__dirname, '../client/promise.js'));
var loaderScript = fs.readFileSync(pUtil.resolve(__dirname, '../client/loader.js'));

var UglifyJS = require('uglify-js');
var etag = require('etag');
var fresh = require('fresh');

var scriptsContent = promiseScript + ';\n' + loaderScript;

module.exports = function(loaderPath, routePath, options){
  options = options || {};

  var lastModified = new Date();
  var globals = options.globals;

  //minify script if not in the debug mode
  if(options.debug !== true){
    scriptsContent = UglifyJS.minify(scriptsContent, {fromString: true}).code;
  }

  return function _scriptsMiddleware(req, res, next){
    var pathname = url.parse(req.originalUrl).pathname;
    var baseUrlHash = [pathname,routePath, '' + ((globals && globals.appVersion) || '')].map(strHash).join('');

    var resHeaders = {
      ETag: etag(baseUrlHash),
      'Last-Modified': (lastModified).toUTCString(),
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=0'
    };
    setResHeaders(resHeaders, res);
    if(fresh(req.headers, resHeaders)){
      res.statusCode = 304;
      res.end();
      return;
    }
    res.statusCode = 200;
    res.end('(function(w){' + getScriptContent(pathname, routePath, loaderPath, globals) + scriptsContent + '})(window);');

  };
};
//helpers

function getScriptContent(pathname, routePath, loaderPath, globals){
  var globalScript = makeGlobalScript(globals);
  return globalScript + 'var __loaderUrlPath__=\''+ pathname + '\';var __loaderPath__=\''+loaderPath+'\';var __moduleRoute__=\''+routePath+'\';';
}

function makeGlobalScript(globals){
  if(Object.prototype.toString.call(globals) !== '[object Object]'){
    return '';
  }

  return Object.keys(globals).map(function(k){
    return 'w.' + k + '=' + (JSON.stringify(globals[k]));
  }).join(';') + ';';
}
