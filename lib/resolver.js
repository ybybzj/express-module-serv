var pUtil = require('path');
var assert = require('assert');
var util = require('./util');
var resolveDepPath = require('./util').resolveDepPath;
function NOOP() {}
var requireCallReg = /(?:[^\w\-\."']|^)require\(\s*(['"])([^'"\)\(]+)\1\s*\)/g;
var findModId = util.findModId;
var isCMDModule = util.isCMDModule;

function makeResolver(options) {
  assert(options && typeof options.base === 'string', '[makeResolver]Invalid "base" configuration, given: ' + options&&options.base);
  return function resolver(path, content) {
    var ext = pUtil.extname(path), deps;
    if(ext !== '.css' && ext !== '.js'){
      return [];
    }
    if(ext === '.css'){
      return [resolveDepPath(options, 'utils/addStyle')];
    }
    
    var modId = findModId(path, options);
    if(isCMDModule(content)){
      deps = getDepsForCMD(content);
    }else{
      deps = getDepsForAMD(content);
    }

    
    return deps.map(function(dname) {
      dname = resolveDepName(dname, modId);
      return resolveDepPath(options, dname);
    });
  };
}
module.exports = makeResolver;

function getDepsForAMD(content){
  var result;
  var defineAMD = function(id, deps) {
      if (typeof deps === 'function') {
        deps = [];
      }
      result = deps;
    };
  defineAMD.amd = true;
  /*jshint -W054 */
  //legacy support
  var execution = new Function('define, m, util, window', content);
  execution(defineAMD, {
    define: defineAMD
  }, {
    loadCSS: NOOP
  }, {});
  result = [].concat(result).filter(Boolean);
  return result;
}

function resolveDepName(depName, modName) {
  var parentBase, part, parts, _i, _len, dname;
  if (depName.charAt(0) !== '.') {
    dname = depName;
  } else {
    parts = depName.split('/');
    parentBase = modName.split('/').slice(0, -1);
    for (_i = 0, _len = parts.length; _i < _len; _i++) {
      part = parts[_i];
      if (part === '..') {
        parentBase.pop();
      } else if (part === '.') {
        continue;
      } else {
        parentBase.push(part);
      }
    }
    dname = parentBase.join('/');
  }
  return dname;
}


function getDepsForCMD(content){
  var result = [], requireMatch = requireCallReg.exec(content);
  while(requireMatch){
    result.push(requireMatch[2]);
    requireMatch = requireCallReg.exec(content);
  }
  return result;
}