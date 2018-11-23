var util = require('./util');
var getDepsForCMD = util.getDepsForCMD
var getDepsForAMD = util.getDepsForAMD


var isCMDModule = util.isCMDModule;
var isAMDModule = util.isAMDModule;


var predefinedModules = ['r', 'm', 'e', 'addStyle', 'url', 'loadJS'];

function makeResolver(resolverFns) {
  var resolvePath = resolverFns.resolveDepPath;
  var findModId = resolverFns.findModId;
  var resolveDepName = resolverFns.resolveDepName;

  return function resolver(path, content) {
    var deps;
    var modId = findModId(path);

    if(isCMDModule(content)){
      deps = getDepsForCMD(content);
    }else if(isAMDModule(content)){
      deps = getDepsForAMD(content, modId);
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


