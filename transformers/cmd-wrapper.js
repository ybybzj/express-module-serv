var util = require('../lib/util');
var pUtil = require('path');
var isCMDModule = util.isCMDModule;



module.exports = function() {
  return {
    filter: function(fileObj, modSrvOptions) {
      var defaultExtensions = [].concat(modSrvOptions.defaultFileExtensions).filter(Boolean).map(function(ext){
       return ext.charAt(0) === '.'  ? ext : ('.' + ext);
      });
      if(defaultExtensions.length <= 0) defaultExtensions = ['.js'];

      var isValid = defaultExtensions.some(function(ext){
        return pUtil.extname(fileObj.path) === ext;
      });
      if (!isValid) {
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

