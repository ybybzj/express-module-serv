var pUtil = require('path');
var urlParser = require('url').parse;
function resolveDepPath(options, dname) {
  var dpath,
    baseDir = options.base,
    pathSettings = options.paths || {},
    filePathKeys = filterKeys(isFilePath, pathSettings),
    parts, prefixPath;
  if (!!~filePathKeys.indexOf(dname)) {
    return pUtil.resolve(options.base, pathSettings[dname]);
  }
  parts = dname.split('/');
  if (!!~filePathKeys.indexOf(parts[0])) {
    dpath = pUtil.resolve(options.base, dname);
  } else {
    prefixPath = pathSettings[parts[0]];
    parts = prefixPath ? [prefixPath].concat(parts.slice(1)) : parts;
    dpath = pUtil.resolve.apply(pUtil, [options.base].concat(parts));
  }
  return normalizeFilepath(dpath);
}

function toJsStr(jsCode) {
  return jsCode.replace(/\\/g, '\\\\').replace(/"/g, '\\\"').replace(/'/g, '\\\'').replace(/\s*(\n|\r|\r\n)\s*/g, '');
}

function findModId(fpath, pSettings) {
  pSettings = _preparePathSettings(pSettings);
  var pathKeys = Object.keys(pSettings.paths),
    fileKeys = Object.keys(pSettings.files),
    i, l = pathKeys.length,
    prefix, pkey, modId;
  for (i = 0, l = fileKeys.length; i < l; i++) {
    pkey = fileKeys[i];
    filePath = pSettings.files[pkey];
    console.log('filePath', filePath);
    console.log('fpath', fpath);
    console.log(filePath == fpath);
    if (filePath == fpath) {
      console.log('pKey', pkey);
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

function _preparePathSettings(pSettings) {
  var base = pSettings.base,
    paths = pSettings.paths || {},
    files = {};
  paths = Object.keys(paths).reduce(function(m, k) {
    var p = paths[k];
    if (!isFilePath(p)) {
      m[k] = pUtil.resolve(base, p);
    } else {
      files[k] = pUtil.resolve(base, p);
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
  return !!pUtil.extname(path);
}

function filterKeys(f, o) {
  return Object.keys(o).filter(function(k) {
    return f(o[k]);
  });
}

function normalizeFilepath(fpath) {
  return !!pUtil.extname(fpath) ? fpath : fpath + '.js';
}

function unixfy(filepath) {
  if (process.platform === 'win32') {
    return filepath.replace(/\\{1,2}/g, "/");
  } else {
    return filepath;
  }
}
function isRelativeUrl(url){
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
  return /*CMDKeywordsReg.test(content) && */!AMDkeywordsREg.test(content);
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
      i    = str.length;

  while(i)
    hash = (hash * 33) ^ str.charCodeAt(--i);
  return (hash >>> 0).toString(36);
}

module.exports = {
  resolveDepPath: resolveDepPath,
  toJsStr: toJsStr,
  findModId: findModId,
  // getCMDModId: getCMDModId,
  isCMDModule: isCMDModule,
  memoize: memoize,
  stringHash: stringHash,
  unixfy: unixfy,
  isRelativeUrl: isRelativeUrl
};