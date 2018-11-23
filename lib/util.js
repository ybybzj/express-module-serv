var pUtil = require("path");
var fs = require("fs");
var urlParser = require("url").parse;
var Module = require("module");
var debug = require("debug")("express-module-serv:error");
var assert = require("assert");

function toJsStr(jsCode) {
  return jsCode
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\s*(\n|\r|\r\n)\s*/g, "");
}

function makeResolverFns(pSettings, options) {
  pSettings = _preparePathSettings(pSettings);
  options = options || {};
  var isResolveRecursive = !!options.isResolveRecursive;
  var defaultExtensions = options.defaultFileExtensions;
  var acceptExtensions = options.defaultFileExtensions;

  defaultExtensions = []
    .concat(defaultExtensions)
    .filter(Boolean)
    .map(function(ext) {
      return ext.charAt(0) === "." ? ext : "." + ext;
    });
  if (defaultExtensions.length <= 0) {
    defaultExtensions = [".js"];
  }

  acceptExtensions = []
    .concat(defaultExtensions)
    .filter(Boolean)
    .map(function(ext) {
      return ext.charAt(0) === "." ? ext : "." + ext;
    });
  

  function resolveDepPath(dname) {
    var dpath,
      baseDir = pSettings.base,
      paths = pSettings.paths || {},
      parts,
      prefixPath,
      result;
    if (dname in pSettings.files) {
      dpath = pSettings.files[dname];
    } else {
      parts = dname.split("/");
      if (parts[0] in pSettings.files) {
        var filePath = pSettings.files[parts[0]];
        var relPath = parts.slice(1).join("/");
        if (relPath.indexOf(".") !== 0) {
          dpath = dname;
        } else {
          dpath = pUtil.resolve(pUtil.dirname(filePath), relPath);
          result = normalizeFilepath(dpath, defaultExtensions, acceptExtensions, false);

          if (result == null || result.length <= 0) {
            throw new Error(
              '[module-serv/resolveDepPath]file for module "' +
                dname +
                '" does not exist!'
            );
          }

          pSettings.files[dname] = result;
          return result;
        }
      } else {
        prefixPath = paths[parts[0]];
        parts = prefixPath ? [prefixPath].concat(parts.slice(1)) : parts;
        dpath = pUtil.resolve.apply(pUtil, [baseDir].concat(parts));
      }
    }
    result = normalizeFilepath(dpath, defaultExtensions, acceptExtensions, isResolveRecursive);
    if (result == null || result.length <= 0) {
      result = resolveNpmPath(baseDir, dname);
      // update settings for findModId
      pSettings.files[dname] = result;
    }
    return result;
  }

  function resolveDepName(depName, modName) {
    var parentBase,
      part,
      parts,
      _i,
      _len,
      dname,
      idx = depName.indexOf("../"),
      prefix;
    if (idx === -1) {
      idx = depName.indexOf("./");
    }

    if (idx > 0) {
      prefix = depName.slice(0, idx);
      depName = depName.slice(idx);
    }

    if (depName.charAt(0) !== ".") {
      dname = depName;
    } else {
      if (pSettings.files[modName]) {
        return modName + "/" + depName;
      }
      parts = depName.split("/");
      parentBase = modName.split("/").slice(0, -1);

      if(parentBase[0] in pSettings.paths) {
        prefix = prefix ? parentBase[0] + "/" + prefix : parentBase[0] + "/"
        parentBase.shift()
      }
      for (_i = 0, _len = parts.length; _i < _len; _i++) {
        part = parts[_i];
        if (part === ".." && parentBase[parentBase.length - 1] && parentBase[parentBase.length - 1] !== '..') {
          parentBase.pop();
        } else if (part === ".") {
          continue;
        } else {
          parentBase.push(part);
        }
      }
      dname = parentBase.join("/");
    }

    return prefix ? prefix + dname : dname;
  }

  function findModId(fpath) {
    var pathKeys = Object.keys(pSettings.paths),
      fileKeys = Object.keys(pSettings.files),
      i,
      l = pathKeys.length,
      prefix,
      pkey,
      modId,
      filePath;
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
      throw new Error("[_findModId]unknown module at path :" + fpath);
    }
  }

  function _toModId(modPath, defaultExtensions) {
    var ext = pUtil.extname(modPath);
    if (defaultExtensions.indexOf(ext) != -1) {
      modPath = modPath.substr(0, modPath.length - ext.length);
    }
    return modPath;
  }

  return {
    resolveDepPath: memoize(resolveDepPath),
    findModId: memoize(findModId),
    resolveDepName: memoize(resolveDepName, (str1, str2)=> str1+'@#$'+str2)
  };
}

function _preparePathSettings(pSettings) {
  var base = pSettings.baseUrl || pSettings.base,
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
  return !!pUtil.extname(path) || path.charAt(0) === "@";
}

function isDir(path) {
  var stat;
  try {
    stat = fs.statSync(path);
    return stat.isDirectory();
  } catch (e) {
    return false;
  }
}

function normalizeFilepath(fpath, defaultExtensions, acceptExtensions, isResolveRecursive) {
  var ext = pUtil.extname(fpath),
    p_index;
  if (defaultExtensions.indexOf(ext) > -1 || acceptExtensions.indexOf(ext) > -1) return fpath;

  p_index = _resolveFilePathWithoutExt(fpath, defaultExtensions);
  if (!p_index) {
    p_index = _resolveFilePathWithoutExt(fpath + "/index", defaultExtensions);
  }

  //resolve dir recursively
  if (isResolveRecursive) {
    //if index script exists, then return it
    if (p_index) {
      return p_index;
    }

    var result = [];
    normalizeRecursive(fpath, defaultExtensions, result, false);
    return result;
  } else {
    return p_index;
  }
}

function _resolveFilePathWithoutExt(fpath, defaultExtensions) {
  var i, l, p, _ext;
  for (i = 0, l = defaultExtensions.length; i < l; i++) {
    _ext = defaultExtensions[i];
    p = fpath + _ext;
    if (isPathExist(p)) {
      return p;
    }
  }
  return null;
}

function normalizeRecursive(fpath, defaultExtensions, result, checkIndex) {
  if (checkIndex) {
    var p_index = _resolveFilePathWithoutExt(
      fpath + "/index",
      defaultExtensions
    );
    //stop when directory contains index file,
    //means a module need to be required explicitly
    if (p_index || isPathExist(fpath + "/index")) {
      return;
    }
  }

  _getFilesInDir(fpath).forEach(function(absFpath) {
    if (isDir(absFpath)) {
      normalizeRecursive(absFpath, defaultExtensions, result, true);
      return;
    }

    if (defaultExtensions.indexOf(pUtil.extname(absFpath)) > -1) {
      result.push(absFpath);
      return;
    }
  });
}

function _getFilesInDir(dir) {
  var files = fs.readdirSync(dir).reduce(function(m, file) {
    if (_getBasename(file) != "index") {
      m.push(pUtil.resolve(dir, file));
    }
    return m;
  }, []);

  return files;
}

function _getBasename(fp) {
  var ext = pUtil.extname(fp);
  return pUtil.basename(fp, ext);
}
function unixfy(filepath) {
  if (process.platform === "win32") {
    return filepath.replace(/\\{1,2}/g, "/");
  } else {
    return filepath;
  }
}

function isRelativeUrl(url) {
  var parsed = urlParser(url);
  return !(url.indexOf("/") === 0 || parsed.protocol == "data:" || parsed.host);
}

var CMDKeywordsReg = /\b(?:require(\.m)?\s*\(|module\.exports\b|exports\.)/;
var AMDkeywordsREg = /\b(?:m\.define|define)\s*\(/;

function isCMDModule(content) {
  return CMDKeywordsReg.test(content) && !AMDkeywordsREg.test(content);
}

function isAMDModule(content) {
  return AMDkeywordsREg.test(content);
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

  while (i) hash = (hash * 33) ^ str.charCodeAt(--i);
  return (hash >>> 0).toString(36);
}

function isPathExist(p) {
  var stat;
  try {
    stat = fs.statSync(p);
  } catch (e) {
    if (e.code === "ENOENT") {
      return false;
    }
    throw e;
  }
  return stat.isFile() || stat.isDirectory();
}

function resolvePath(baseDir, path) {
  var fullPath;
  if (path.indexOf("@") !== 0) {
    fullPath = pUtil.resolve(baseDir, path);
  } else {
    path = path.slice(1);
    fullPath = resolveNpmPath(baseDir, path);
  }
  return fullPath;
}

function resolveNpmPath(baseDir, path) {
  var modulePaths = Module._nodeModulePaths(baseDir),
    i,
    l,
    candidateDir,
    absPath,
    fullPath;

  for (i = 0, l = modulePaths.length; i < l; i++) {
    candidateDir = modulePaths[i];
    absPath = pUtil.resolve(candidateDir, path);
    try {
      fullPath = require.resolve(absPath);
    } catch (e) {
      debug("[resolvePath]require.resolve error: ", e);
      fullPath = absPath;
    }
    if (fs.existsSync(fullPath)) {
      break;
    }
  }
  if (!fs.existsSync(fullPath)) {
    throw new Error("[resolvePath]resolve module path failed! Given:" + path);
  }
  return fullPath;
}

function makeTransformer(resolverFns, options, modSrvSettings) {
  options = options || {};
  assert(
    typeof options.transformer === "function",
    "[makeTransformer]transformer function is required! given: " +
      options.transformer
  );

  var filter =
    typeof options.filter === "string"
      ? function(fileObj) {
          return pUtil.extname(fileObj.path) === "." + options.filter;
        }
      : typeof options.filter === "function"
        ? options.filter
        : function() {
            return true;
          };
  var transformer = options.transformer;

  return function _transformer(fileObj) {
    if (!filter(fileObj, modSrvSettings, resolverFns)) {
      return fileObj;
    }
    var modId = resolverFns.findModId(fileObj.path);

    return transformer(fileObj, modId, modSrvSettings, resolverFns);
  };
}

function generateStream(makeDepsStream, mappings, options, resolveDepPath) {
  options = options || {};
  var modules = mapFlatten(modNamesFromStr(mappings.m || ""), resolveDepPath);

  var excludModules = mapFlatten(
    modNamesFromStr(mappings.l || ""),
    resolveDepPath
  );
  return makeDepsStream({
    entry: modules,
    excludeEntries: excludModules,
    reloadOnChange: options.reloadOnChange
  });
}

function modNamesFromStr(str) {
  return str
    .split(",")
    .map(function(m) {
      return m.trim();
    })
    .filter(Boolean);
}

function mapFlatten(arr, fn) {
  return _flatten(arr.map(fn));
}

function _flatten(arr) {
  return !Array.isArray(arr)
    ? [arr]
    : arr.reduce(function(m, item) {
        m.push.apply(m, _flatten(item));
        return m;
      }, []);
}

function setResHeaders(headers, res) {
  Object.keys(headers).forEach(function(headerKey) {
    res.setHeader(headerKey, headers[headerKey]);
  });
}

var requireCallReg = function(requireWord){
  requireWord = requireWord || 'require';
  return new RegExp('([^\\w\\-\\\.\"\']|^)'+requireWord+'\\(\\s*([\'\"])([^\'\"\\)\\(]+)\\2\\s*\\)', 'g');
};
function NOOP() {}
var STRIP_COMMENTS = /(^\s*(\/\/.*$))|(\/\*[\s\S]*?\*\/)/mg;
var ARGUMENT_NAMES = /([^\s,]+)/g;



function getDepsForCMD(content, requireWord){
  content = content.replace(STRIP_COMMENTS, '');
  var result = [],
    reg = requireCallReg(requireWord),
    requireMatch = reg.exec(content);
  while(requireMatch){
    result.push(requireMatch[3]);
    requireMatch = reg.exec(content);
  }
  return result;
}

function getDepsForAMD(content, modId){
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
  try{
    var execution = new Function('define, window', content);
    execution(defineAMD, {});
  }catch(e){
    console.error('[getDepsForAMD]function execution error! modId: "' + modId + '"')
    throw e
  }

  result = result.concat(getDepsForCMD(content, requireWord)).filter(Boolean);
  return result;
}

function getParamNames(func) {
  var fnStr = func.toString().replace(STRIP_COMMENTS, '');
  var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
  if (result === null) result = [];
  return result;
}

function swapRequiredModNames(content, requireWord, modId, resolverFns) {
  var reg = requireCallReg(requireWord)
  return content.replace(reg, function(_m, _prefix, _quote, depString){
    var dname = resolverFns.resolveDepName(depString, modId)
    var fpath = resolverFns.resolveDepPath(dname)
    var depModId = resolverFns.findModId(fpath)
    
    return _prefix+'require("'+depModId+'")'
  })
}

module.exports = {
  toJsStr: toJsStr,
  makeResolverFns: makeResolverFns,
  isCMDModule: isCMDModule,
  isAMDModule: isAMDModule,
  memoize: memoize,
  stringHash: stringHash,
  unixfy: unixfy,
  isRelativeUrl: isRelativeUrl,
  makeTransformer: makeTransformer,
  generateStream: generateStream,
  mapFlatten: mapFlatten,
  setResHeaders: setResHeaders,
  getDepsForCMD: getDepsForCMD,
  getDepsForAMD: getDepsForAMD,
  swapRequiredModNames: swapRequiredModNames
};
