var assert = require('assert');
var util = require('./util');

function NOOP() {}

// var requireCallReg = /(?:[^\w\-\."']|^)require\(\s*(['"])([^'"\)\(]+)\1\s*\)/g;
var requireCallReg = function(requireWord){
  requireWord = requireWord || 'require';
  return new RegExp('(?:[^\\w\\-\\\.\"\']|^)'+requireWord+'\\(\\s*([\'\"])([^\'\"\\)\\(]+)\\1\\s*\\)', 'g');
};

var STRIP_COMMENTS = /(^\s*(\/\/.*$))|(\/\*[\s\S]*?\*\/)/mg;

var ARGUMENT_NAMES = /([^\s,]+)/g;

var isCMDModule = util.isCMDModule;
var isAMDModule = util.isAMDModule;


var predefinedModules = ['r', 'm', 'e', 'addStyle', 'url', 'loadJS'];

function makeResolver(resolverFns) {
  var resolvePath = resolverFns.resolveDepPath;
  var findModId = resolverFns.findModId;

  return function resolver(path, content) {
    var deps;
    var modId = findModId(path);

    if(isCMDModule(content)){
      deps = getDepsForCMD(content);
    }else if(isAMDModule(content)){
      deps = getDepsForAMD(content);
    }else{
      return [];
    }

 
    return util.mapFlatten(deps.map(function(dname) {
      dname = resolveDepName(dname, modId);
      return predefinedModules.indexOf(dname) !== -1 ? null : dname;
    }).filter(Boolean), resolvePath);
  };
}
module.exports = makeResolver;

function getDepsForAMD(content){
  var result, fnParamNames, requireWord;
  var defineAMD = function(id, deps, fn) {
      var ridx; 
      if (typeof deps === 'function') {
        fn = deps;
        deps = [];
      }
      result = [].concat(deps);
      ridx = result.indexOf('r');
      if(ridx !== -1){
        fnParamNames = getParamNames(fn);
        requireWord = fnParamNames[ridx];
      }
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

  result = result.concat(getDepsForCMD(content, requireWord)).filter(Boolean);
  return result;
}

function resolveDepName(depName, modName) {
  var parentBase, part, parts, _i, _len, dname,
  idx = depName.indexOf('../'), prefix;
  if(idx === -1){
    idx = depName.indexOf('./');
  }

  if(idx > 0){
    prefix = depName.slice(0, idx);
    depName = depName.slice(idx);
  }

  
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
  return prefix ? prefix + dname: dname;
}


function getDepsForCMD(content, requireWord){
  content = content.replace(STRIP_COMMENTS, '');
  var result = [],
    reg = requireCallReg(requireWord),
    requireMatch = reg.exec(content);
  while(requireMatch){
    result.push(requireMatch[2]);
    requireMatch = reg.exec(content);
  }
  return result;
}

function getParamNames(func) {
  var fnStr = func.toString().replace(STRIP_COMMENTS, '');
  var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
  if (result === null) result = [];
  return result;
}
