var pUtil = require('path');
var util = require('../lib/util');

var resourceUrlReg = /(url\(\s*['"]?)([^)'"]+)(['"]?\s*\))/g;

var wrapCSS = function(options) {
  options = options || {};
  if (!options.routePath) options.routePath = './';

  return {
    filter: 'css',
    transformer: function _wrapCSS(fileObj, modId) {
      var content = 'define(\'' + modId + '\',[\'addStyle\'],function(a){a("' + util.toJsStr(resolveResourceUrl(fileObj, options)) + '");});';
      return {
        path: fileObj.path,
        content: content
      };
    }
  };
};



function resolveResourceUrl(fileObj, options) {
  var cssPath = fileObj.path,
    content = fileObj.content,
    staticPath = options.staticPath,
    routePath = options.routePath;
  if (!staticPath) return content;
  return content.replace(resourceUrlReg, function(m, open, url, close) {
    if (!util.isRelativeUrl(url)) {
      return m;
    }
    return open + _resolveUrl(url, cssPath, staticPath, routePath) + close;
  });
}

function _resolveUrl(url, cssPath, staticPath, routePath) {
  var resourcePath = pUtil.resolve(pUtil.dirname(cssPath), url);
  var result = util.unixfy(pUtil.join(routePath, pUtil.relative(staticPath, resourcePath)));
  if (result.charAt(0) === '/') result = util.unixfy(pUtil.join('.', result));
  return result;
}

module.exports = wrapCSS;
