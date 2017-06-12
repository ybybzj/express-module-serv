var pUtil = require('path');
var fs = require('fs');
var urlParser = require('url').parse;
var Module = require('module');
var debug = require('debug')('express-module-serv:error');
var assert = require('assert');

function toJsStr(jsCode) {
  return jsCode.replace(/\\/g, '\\\\').replace(/"/g, '\\\"').replace(/'/g, '\\\'').replace(/\s*(\n|\r|\r\n)\s*/g, '');
}

function makeResolverFns(pSettings, defaultExtensions) {
  pSettings = _preparePathSettings(pSettings);
  defaultExtensions = [].concat(defaultExtensions).filter(Boolean).map(function(ext){
    return ext.charAt(0) === '.' ? ext : ('.' + ext);
  });
  if(defaultExtensions.length <= 0){
    defaultExtensions = ['.js'];
  }

  function resolveDepPath(dname) {
    var dpath,
      baseDir = pSettings.base,
      paths = pSettings.paths || {},
      parts, prefixPath, result;
    if (dname in pSettings.files) {
      dpath = pSettings.files[dname];
    }else{
      parts = dname.split('/');
      if (parts[0] in pSettings.files) {
        dpath = pUtil.resolve(baseDir, dname);
      } else {
        prefixPath = paths[parts[0]];
        parts = prefixPath ? [prefixPath].concat(parts.slice(1)) : parts;
        dpath = pUtil.resolve.apply(pUtil, [baseDir].concat(parts));
      }
    }
    result = normalizeFilepath(dpath, defaultExtensions);
    if(result == null){
      throw new Error('[module-serv/resolveDepPath]file for module "'+dname+'" does not exist!');
    }
    return result;
  }

  function findModId(fpath) {
    var pathKeys = Object.keys(pSettings.paths),
      fileKeys = Object.keys(pSettings.files),
      i, l = pathKeys.length,
      prefix, pkey, modId, filePath;
    for (i = 0, l = fileKeys.length; i < l; i++) {
      pkey = fileKeys[i];
      filePath = pSettings.files[pkey];

      if (filePath == fpath) {
        return pkey;
      }
    }
    for (i = 0, l = pathKeys.length; i < l; i++) {
      pkey = pathKeys[i];
      prefix = pSettings.paths[pkey];
      if (fpath.indexOf(prefix) === 0) {
        modId = pkey + unixfy(fpath.substr(prefix.length));
        break;
      }
    }
    if (modId == null && fpath.indexOf(pSettings.base) === 0) {
      modId = unixfy(fpath.substr(pSettings.base.length + 1));
    }
    if (modId) {
      return _toModId(modId, defaultExtensions);
    } else {
      throw new Error('[_findModId]unknown module at path :' + fpath);
    }

  }

  function _toModId(modPath, defaultExtensions){
    var ext = pUtil.extname(modPath);
    if(defaultExtensions.indexOf(ext) != -1){
      modPath = modPath.substr(0, modPath.length - ext.length);
    }
    return modPath;
  }

  return {
    resolveDepPath: memoize(resolveDepPath),
    findModId: memoize(findModId)
  };
}


function _preparePathSettings(pSettings) {
  var base = pSettings.base,
    paths = pSettings.paths || {},
    files = {};
  paths = Object.keys(paths).reduce(function(m, k) {
    var p = paths[k];
    if (!isFilePath(p)) {
      m[k] = pUtil.resolve(base, p);
    } else {
      files[k] = resolvePath(base, p);
    }
    return m;
  }, {});
  return {
    base: base,
    paths: paths,
    files: files
  };
}
//helpers
function isFilePath(path) {
  return !!pUtil.extname(path) || path.charAt(0) === '@';
}

function normalizeFilepath(fpath, defaultExtensions) {
  var hasExt = !!pUtil.extname(fpath),
    i, p, p_index, _ext;
  if(hasExt) return fpath;

  for(i = 0; i < defaultExtensions.length; i++){
    _ext = defaultExtensions[i];
    p = fpath + _ext;
    p_index = pUtil.resolve(fpath , 'index' + _ext);

    if(isPathExist(p)){
      return p;
    }
    if(isPathExist(p_index)){
      return p_index;
    }
  }

  return null;
}

function unixfy(filepath) {
  if (process.platform === 'win32') {
    return filepath.replace(/\\{1,2}/g, "/");
  } else {
    return filepath;
  }
}

function isRelativeUrl(url) {
  var parsed = urlParser(url);
  return !(
    (url.indexOf('/') === 0) ||
    (parsed.protocol == 'data:') ||
    (parsed.host)
  );
}
// var CMDModIdReg = /^\s*\/\/#\[([\w\/]+)\]/;
// function getCMDModId(content){
//   var result = content.match(CMDModIdReg);
//   return result ? result[1].trim() : null;
// }
// var CMDKeywordsReg = /\b(?:require|module|exports)\b/;
var AMDkeywordsREg = /\b(?:m\.define|define)\s*\(/;

function isCMDModule(content) {
  return /*CMDKeywordsReg.test(content) && */ !AMDkeywordsREg.test(content);
}

function memoize(func, hasher) {
  var memo;
  if (hasher == null) {
    hasher = identity;
  }
  memo = Object.create(null);
  return function() {
    var key;
    key = hasher.apply(this, arguments);
    if (!(key in memo)) {
      memo[key] = func.apply(this, arguments);
    }
    return memo[key];
  };
}

function identity(o) {
  return o;
}

function stringHash(str) {
  var hash = 5381,
    i = str.length;

  while (i)
    hash = (hash * 33) ^ str.charCodeAt(--i);
  return (hash >>> 0).toString(36);
}

function isPathExist(p) {
  var stat;
  try {
    stat = fs.statSync(p);
  } catch (e) {
    if (e.code === 'ENOENT') {
      return false;
    }
    throw e;
  }
  return stat.isFile() || stat.isDirectory();
}

function resolvePath(baseDir, path) {
  var fullPath, modulePaths, i, l, candidateDir, absPath;
  if (path.indexOf('@') !== 0) {
    fullPath = pUtil.resolve(baseDir, path);
  } else {
    path = path.slice(1);
    modulePaths = Module._nodeModulePaths(baseDir);

    for(i = 0, l = modulePaths.length; i < l; i++){
      candidateDir = modulePaths[i];
      absPath = pUtil.resolve(candidateDir, path);
      try{
        fullPath = require.resolve(absPath);
      }catch(e){
        debug('[resolvePath]require.resolve error: ', e);
        fullPath = absPath;
      }
      if(fs.existsSync(fullPath)){
        break;
      }
    }
    if(!fs.existsSync(fullPath)){
      throw new Error('[resolvePath]resolve module path failed! Given:', fullPath);
    }
  }
  return fullPath;
}

function makeTransformer(resolverFns, options, modSrvSettings){
  options = options||{};
  assert(typeof options.transformer === 'function', '[makeTransformer]transformer function is required! given: ' + options.transformer);

  var filter = typeof options.filter === 'string' ?
    function (fileObj){
      return pUtil.extname(fileObj.path) === '.' + options.filter;
    } : typeof options.filter === 'function' ? options.filter : function(){
      return true;
    };
  var transformer = options.transformer;

  return function _transformer(fileObj){
    if(!filter(fileObj, modSrvSettings)){
      return fileObj;
    }
    var modId = resolverFns.findModId(fileObj.path);

    return transformer(fileObj, modId, modSrvSettings);
  };

}

module.exports = {
  toJsStr: toJsStr,
  makeResolverFns: makeResolverFns,
  isCMDModule: isCMDModule,
  memoize: memoize,
  stringHash: stringHash,
  unixfy: unixfy,
  isRelativeUrl: isRelativeUrl,
  makeTransformer: makeTransformer
};

