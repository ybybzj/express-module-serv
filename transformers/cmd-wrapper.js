var util = require('../lib/util');
var pUtil = require('path');
var isCMDModule = util.isCMDModule;



module.exports = function() {
  return {
    filter: function(fileObj) {
      var isJS = pUtil.extname(fileObj.path) === '.js';
      if (!isJS) {
        return false;
      }
      var content = fileObj.content;
      if (!isCMDModule(content)) {
        return false;
      }
      return true;

    },
    transformer: function _wrapCMD(fileObj, modId) {
      var content = fileObj.content;
      content = 'define(\'' + modId + '\',[\'r\',\'m\',\'e\'],function(require, module, exports){' + content + '});';
      return {
        path: fileObj.path,
        content: content
      };
    }
  };
};
