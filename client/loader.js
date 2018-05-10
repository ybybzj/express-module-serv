// (function(w, Promise) {
if (typeof Promise === 'undefined') {
  throw new Error('Promise is undefined!')
}
var modCache = {}
var loadCache = {}
var dataMain, baseUrl, moduleUrl
var parseUri = (function() {
  var keys = [
      'source',
      'protocol',
      'authority',
      'userInfo',
      'user',
      'password',
      'host',
      'port',
      'relative',
      'pathname',
      'directory',
      'file',
      'query',
      'anchor',
    ],
    parser = /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/
  return function _parseUri(str) {
    var m = parser.exec(str),
      uri = {},
      i = 14
    while (i--) uri[keys[i]] = m[i] || ''
    return uri
  }
})()
//prepare baseUrl according to the entry page url, and try to find data-main attribute value as entries
;(function() {
  var parsed, domain, loaderPath
  var scripts = document.getElementsByTagName('script'),
    i,
    l = scripts.length,
    loaderScript,
    s
  for (i = l - 1; i >= 0; i--) {
    s = scripts[i]
    if (s.src.indexOf(__loaderUrlPath__) !== -1) {
      loaderScript = s
      break
    }
  }
  if (!loaderScript) {
    throw new Error('loader script is not found!')
  }
  //get dataMain
  dataMain = loaderScript.getAttribute('data-main')
  if (dataMain) {
    dataMain = dataMain
      .split(',')
      .filter(Boolean)
      .map(function(m) {
        return m.trim()
      })
  }
  //prepare baseUrl
  parsed = parseUri(loaderScript.src)
  loaderPath = parsed.pathname
  domain =
    parsed.protocol +
    '://' +
    parsed.host +
    (parsed.port ? ':' + parsed.port : '')

  baseUrl = domain + loaderPath.replace(__loaderUrlPath__, '')
  moduleUrl = domain + loaderPath.replace(__loaderPath__, __moduleRoute__)
})()

//legacy support
var config = {}
var _cached = {}
function define(id, deps, factory) {
  var mod = modCache[id]
  if (mod != null) {
    console.warn('Module "' + id + '" is already defined!')
    return
  }

  if (typeof deps === 'function') {
    factory = deps
    deps = []
  }

  mod = {
    resolved: false,
    cache: null,
    factory: factory,
    deps: deps,
    id: id,
  }
  modCache[id] = mod
}

function getModuleResult(mod) {
  if (mod && mod.resolved) {
    return mod.cache
  }
  if (_cached[mod.id]) {
    throw new Error('circle dependency : ' + mod.id)
  }
  _cached[mod.id] = 1
  var requireMod, module, exports, modResult

  requireMod = function(depName) {
    var resolvedMod = resolveDepModule(mod.id, modCache, depName)
    return getModuleResult(resolvedMod)
  }

  try {
    module = {
      exports: {},
      id: mod.id,
    }

    exports = module.exports

    modResult = mod.factory.apply(
      w,
      mod.deps.map(function(depName) {
        switch (depName) {
          case 'r':
            return requireMod
          case 'm':
            return module
          case 'e':
            return exports
          default:
            return requireMod(depName)
        }
      })
    )

    mod.cache = modResult === undefined ? module.exports : modResult
    mod.resolved = true

    //legacy support
    if (
      w.m &&
      w.m.config &&
      Object(mod.cache) === mod.cache &&
      mod.cache.ctrl == null
    ) {
      mod.cache.ctrl = config[id] || {}
    }
    return mod.cache
  } catch (err) {
    errHandler(err)
  }
}

function unloadedModNameFilter(includeLoadCache, modName) {
  return (
    modCache[modName] == null &&
    modCache[modName + '/index'] == null &&
    (!includeLoadCache || loadCache[modName] == null)
  )
}

var isUnloadedModName = unloadedModNameFilter.bind(null, true)
var isUnfinishedModName = unloadedModNameFilter.bind(null, false)

function loadModule(modNames) {
  function resolveMod(modName) {
    var mod = resolveDepModule('', modCache, modName)
    return getModuleResult(mod)
  }
  var isArray = Array.isArray(modNames),
    unloadedModNames,
    modLen,
    loadPromise,
    loadJSPromise
  modNames = []
    .concat(modNames)
    .filter(isNotEmptyStr)
    .map(function(modName) {
      return modName.trim()
    })
  modLen = modNames.length
  if (modLen === 0) {
    throw new Error('[Load Module]Invalid module names!')
  }
  unloadedModNames = modNames.filter(isUnloadedModName)
  if (unloadedModNames.length > 0) {
    loadJSPromise = batchLoadJS(unloadedModNames)
    unloadedModNames.forEach(function(mn) {
      loadCache[mn] = loadJSPromise
    })
  }
  loadPromise = Promise.all(filterObj(isPromise, loadCache, modNames))
    .then(function() {
      modNames.forEach(function(mn) {
        if (isPromise(loadCache[mn])) {
          loadCache[mn] = 1
        }
      })
      return !isArray ? resolveMod(modNames[0]) : modNames.map(resolveMod)
    })
    ['catch'](function(err) {
      unloadedModNames.forEach(function(mn) {
        delete loadCache[mn]
      })
      errHandler(err)
    })

  return loadPromise
}
define.amd = true
w.define = define

w.requireAsync = function requireAsync() {
  var args = [].slice.call(arguments)
  var p = Promise.resolve().then(function() {
    return loadModule.apply(null, args)
  })
  p.spread = function(fn) {
    return p.then(function(mods) {
      return fn.apply(null, [].concat(mods))
    })
  }

  return p
}
//legacy support
if (Object(w.m) === w.m) {
  w.m.define = define
  w.m.load = w.requireAsync
  w.m.config = function(options) {
    // if (options.baseUrl) baseUrl = options.baseUrl;
    if (options.ctrl != null) {
      config = options.ctrl
    }
  }
}
var resourceUrlReg = /(url\(\s*['"]?)([^)'"]+)(['"]?\s*\))/g
//setup predefined modules
define('addStyle', function() {
  function fixResourceUrl(content) {
    return content.replace(resourceUrlReg, _fixUrl)
  }
  function _fixUrl(m, open, url, close) {
    if (!isRelativeUrl(url)) return m
    return open + baseUrl + '/' + url + close
  }
  return function addStyle(styleStr) {
    var head = document.getElementsByTagName('head')[0],
      style = document.createElement('style')

    // Add a media (and/or media query) here if you'd like!
    // style.setAttribute("media", "screen")
    // style.setAttribute("media", "only screen and (max-width : 1024px)")

    // WebKit hack :(
    style.appendChild(document.createTextNode(fixResourceUrl(styleStr)))

    head.appendChild(style)
  }
})

define('url', function() {
  function _url(url) {
    if (typeof url !== 'string' || url[0] !== '/') {
      return url
    }
    return baseUrl + url
  }

  _url.parse = parseUri
  return _url
})

define('loadJS', function() {
  return loadJS
})

//helpers
function resolveDepModule(name, modCache, orgDepName) {
  depName = normalizeDepName(orgDepName)
  var parentBase,
    part,
    parts,
    _i,
    _len,
    dname,
    dmod,
    idx = depName.indexOf('../'),
    prefix
  if (idx === -1) {
    idx = depName.indexOf('./')
  }

  if (idx > 0) {
    prefix = depName.slice(0, idx)
    depName = depName.slice(idx)
  }

  if (depName.charAt(0) !== '.') {
    dname = depName
  } else {
    parts = depName.split('/')
    parentBase = name.split('/').slice(0, -1)
    for (_i = 0, _len = parts.length; _i < _len; _i++) {
      part = parts[_i]
      if (part === '..') {
        parentBase.pop()
      } else if (part === '.') {
        continue
      } else {
        parentBase.push(part)
      }
    }
    dname = parentBase.join('/')
  }

  dname = prefix ? prefix + dname : dname
  dmod = modCache[dname]
  if (!dmod) {
    dmod = modCache[dname + '/index']
  }
  if (!dmod) {
    dname = name + '/' + orgDepName
    dmod = modCache[dname]
  }
  if (!dmod) {
    throw new Error('[Module Error] Could not find module: [' + dname + ']')
  }
  return dmod
}

var modsQueue = []
var loadModTimer = null
var _batchLoadPromise = null
var _deferFn = null

function batchLoadJS(modNames) {
  modsQueue.push.apply(modsQueue, [].concat(modNames).filter(Boolean))
  if (loadModTimer != null) {
    clearTimeout(loadModTimer)
  }
  if (_batchLoadPromise == null) {
    _batchLoadPromise = new Promise(function(resolve, reject) {
      deferFn = function _deferFn() {
        var requestMods = dedup(modsQueue, isUnfinishedModName)

        modsQueue.length = 0
        loadModTimer = null
        _batchLoadPromise = null
        deferFn = null

        if (requestMods.length) {
          loadJS(makeModRequestUrl(requestMods))
            .then(resolve)
            ['catch'](reject)
        } else {
          resolve()
        }
      }
    })
  }
  deferFn && (loadModTimer = setTimeout(deferFn, 10))
  return _batchLoadPromise
}

function loadJS(path) {
  var doc = w.document
  if (typeof doc === 'undefined') {
    throw new Error('browser environment is required!')
  }
  if (!path || path.length === 0) {
    throw new Error('argument "path" is required !')
  }
  var head = doc.getElementsByTagName('head')[0]
  var script = doc.createElement('script')
  return new Promise(function(resolve, reject) {
    script.type = 'text/javascript'
    script.onload = function() {
      script.onload = script.onerror = null
      resolve()
    }
    script.onerror = function(e) {
      var err = new Error('[loadJS]script load failed!src: ' + script.src)
      script.onerror = script.onload = null
      head.removeChild(script)
      reject(err)
    }
    script.src = path
    script.async = true
    head.appendChild(script)
  })
}

function isNotEmptyStr(str) {
  if (typeof str !== 'string') return false
  return !!str.trim()
}

function makeModRequestUrl(modNames) {
  var loadedMods = Object.keys(loadCache).filter(function(k) {
    return modCache[k] != null || modCache[k + '/index'] != null
  })
  var reqUrl =
    moduleUrl +
    '?m=' +
    modNames.join(',') +
    (loadedMods.length ? '&l=' + loadedMods.join(',') : '')
  if (w.appVersion) {
    reqUrl = reqUrl + '&_v_=' + w.appVersion
  }
  return reqUrl
}

function errHandler(err) {
  if (typeof console.error === 'function') {
    console.error(err)
    console.error(err.stack)
  } else {
    console.log(err)
    console.log(err.stack)
  }
  if (typeof window.onerror === 'function') {
    window.onerror(err + '', window.location.href, 0, 0, err)
  }
  throw err
}

function dedup(arr, filter) {
  return arr.reduce(function(m, item) {
    if (!~m.indexOf(item) && (typeof filter !== 'function' || filter(item))) {
      m.push(item)
    }
    return m
  }, [])
}

function isPromise(p) {
  return p && typeof p.then === 'function'
}

function filterObj(filter, o, keys) {
  var result = Object.keys(o)
    .filter(function(k) {
      return !!~keys.indexOf(k) && filter(o[k])
    })
    .map(function(k) {
      return o[k]
    })
  return dedup(result)
}

function isRelativeUrl(url) {
  var parsed = parseUri(url)
  return !(url.indexOf('/') === 0 || parsed.protocol === 'data' || parsed.host)
}

function normalizeDepName(depName) {
  let extIdx = depName.lastIndexOf('.js')
  if (extIdx > -1 && extIdx === depName.length - 3) {
    return depName.slice(0, extIdx)
  }
  return depName
}
//init load
if (dataMain) {
  loadModule(dataMain)
}
// })(window, window.Promise);
