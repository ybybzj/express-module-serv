var util = require('./util');
var pUtil = require('path');

var findModId = util.findModId;
var isCMDModule = util.isCMDModule;
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

function wrapCSS(pathSettings) {
  return function _wrapCSS(fileObj) {
    var isCss = pUtil.extname(fileObj.path) === '.css';
    if (!isCss) {
      return fileObj;
    }
    var modId = util.findModId(fileObj.path, pathSettings);
    var content = 'define(\'' + modId + '\',[\'addStyle\'],function(a){a("' + util.toJsStr(fileObj.content) + '");});';
    return {
      path: fileObj.path,
      content: content
    };
  };
}

module.exports = {
  addComma: addComma,
  wrapCMD: wrapCMD,
  wrapCSS: wrapCSS
};