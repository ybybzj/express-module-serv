var util = require('./util');
var pUtil = require('path');

var findModId = util.findModId;
var isCMDModule = util.isCMDModule;

var resourceUrlReg = /(url\(\s*['"]?)([^)'"]+)(['"]?\s*\))/g;


function addComma(fileObj) {
  var content = fileObj.content;
  content = content.replace(/([^;]);?\s*$/g, '$1;\n');
  return {
    path: fileObj.path,
    content: content
  };
}

function wrapCMD(pathSettings){
  return function _wrapCMD(fileObj){
    var isJS = pUtil.extname(fileObj.path) === '.js';
    if (!isJS) {
      return fileObj;
    }
    var content = fileObj.content;
    if(!isCMDModule(content)){
      return fileObj;
    }
    var modId = findModId(fileObj.path, pathSettings);
    content = 'define(\''+modId+'\', function(require, module, exports){' + content + '});';
    return {
      path: fileObj.path,
      content: content
    };
  };
}

function wrapCSS(pathSettings, options) {
  options = options || {};
  if(!options.routePath) options.routePath = './';
  return function _wrapCSS(fileObj) {
    var isCss = pUtil.extname(fileObj.path) === '.css';
    if (!isCss) {
      return fileObj;
    }
    var modId = util.findModId(fileObj.path, pathSettings);
    var content = 'define(\'' + modId + '\',[\'addStyle\'],function(a){a("' + util.toJsStr(resolveResourceUrl(fileObj, options)) + '");});';
    return {
      path: fileObj.path,
      content: content
    };
  };
}

function resolveResourceUrl(fileObj, options){
  var cssPath = fileObj.path,
    content = fileObj.content,
    staticPath = options.staticPath,
    routePath = options.routePath;
  if(!staticPath) return content;
  return content.replace(resourceUrlReg, function(m, open, url, close){
    if(url[0] !== '.'){
      return m;
    }
    return open + _resolveUrl(url, cssPath, staticPath, routePath) + close;
  });
}
function _resolveUrl(url, cssPath, staticPath, routePath){
  var resourcePath = pUtil.resolve(pUtil.dirname(cssPath), url);
  var result = pUtil.join(routePath, pUtil.relative(staticPath, resourcePath));
  return result;
}
module.exports = {
  addComma: addComma,
  wrapCMD: wrapCMD,
  wrapCSS: wrapCSS
};