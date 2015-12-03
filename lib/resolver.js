var pUtil = require('path');
var assert = require('assert');
var util = require('./util');
var resolveDepPath = require('./util').resolveDepPath;
function NOOP() {}
var requireCallReg = /(?:[^\w\-\."']|^)require\(\s*(['"])([^'"\)\(]+)\1\s*\)/g;
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
var findModId = util.findModId;
var isCMDModule = util.isCMDModule;
function makeResolver(options) {
  assert(options && typeof options.base === 'string', '[makeResolver]Invalid "base" configuration, given: ' + options&&options.base);
  return function resolver(path, content) {
    content = content.replace(STRIP_COMMENTS, '');
    var ext = pUtil.extname(path), deps, requireDepIdx;
    if(ext !== '.js'){
      return [];
    }

    var modId = findModId(path, options);
    if(isCMDModule(content)){
      deps = getDepsForCMD(content);
    }else{
      deps = getDepsForAMD(content);
    }

    requireDepIdx = deps.indexOf('require');
    if(requireDepIdx !== -1){
      deps.splice(requireDepIdx, 1);
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
      result = [].concat(deps);
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
  result = result.concat(getDepsForCMD(content)).filter(Boolean);
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