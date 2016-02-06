var pUtil = require('path');
var fs = require('fs');
var urlParser = require('url').parse;
var Module = require('module');
var debug = require('debug')('express-module-serv:error');

function toJsStr(jsCode) {
  return jsCode.replace(/\\/g, '\\\\').replace(/"/g, '\\\"').replace(/'/g, '\\\'').replace(/\s*(\n|\r|\r\n)\s*/g, '');
}

function makeResolverFns(pSettings) {
  pSettings = _preparePathSettings(pSettings);

  function resolveDepPath(dname) {
    var dpath,
      baseDir = pSettings.base,
      paths = pSettings.paths || {},
      parts, prefixPath;
    if (dname in pSettings.files) {
      return pSettings.files[dname];
    }
    parts = dname.split('/');
    if (parts[0] in pSettings.files) {
      dpath = pUtil.resolve(baseDir, dname);
    } else {
      prefixPath = paths[parts[0]];
      parts = prefixPath ? [prefixPath].concat(parts.slice(1)) : parts;
      dpath = pUtil.resolve.apply(pUtil, [baseDir].concat(parts));
    }
    return normalizeFilepath(dpath);
  }

  function findModId(fpath) {
    var pathKeys = Object.keys(pSettings.paths),
      fileKeys = Object.keys(pSettings.files),
      i, l = pathKeys.length,
      prefix, pkey, modId;
    for (i = 0, l = fileKeys.length; i < l; i++) {
      pkey = fileKeys[i];
      filePath = pSettings.files[pkey];
      // console.log('filePath', filePath);
      // console.log('fpath', fpath);
      // console.log(filePath == fpath);
      if (filePath == fpath) {
        // console.log('pKey', pkey);
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
      return pUtil.extname(modId) === '.js' ? modId.substr(0, modId.length - 3) : modId;
    } else {
      throw new Error('[_findModId]unknown module at path :' + fpath);
    }

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

function filterKeys(f, o) {
  return Object.keys(o).filter(function(k) {
    return f(o[k]);
  });
}

function normalizeFilepath(fpath) {
  var hasExt = !!pUtil.extname(fpath),
    resultPath = hasExt ? fpath : fpath + '.js';
  if (!hasExt && !isPathExist(resultPath)) {
    return pUtil.resolve(fpath, 'index.js');
  }
  return resultPath;
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

module.exports = {
  toJsStr: toJsStr,
  makeResolverFns: makeResolverFns,
  // getCMDModId: getCMDModId,
  isCMDModule: isCMDModule,
  memoize: memoize,
  stringHash: stringHash,
  unixfy: unixfy,
  isRelativeUrl: isRelativeUrl
};
