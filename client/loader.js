// (function(w, Promise) {
  if (typeof Promise === 'undefined') {
    throw new Error('Promise is undefined!');
  }
  var modCache = {};
  var loadCache = {};
  var dataMain, baseUrl, moduleUrl;
  var parseUri = (function(){
    var keys = ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "pathname", "directory", "file", "query", "anchor"],
      parser = /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/;
    return function _parseUri(str){
      var m = parser.exec(str),
        uri = {},
        i = 14;
      while (i--) uri[keys[i]] = m[i] || "";
      return uri;
    };
  })();
  //prepare baseUrl according to the entry page url, and try to find data-main attribute value as entries
  (function(){
    var /*pagePath = w.location.pathname,*/ loaderPath;
    var scripts = document.getElementsByTagName('script'),
      i, l = scripts.length, loaderScript, s;
    for(i = l-1; i >=0 ; i--){
      s = scripts[i];
      if(s.src.indexOf(__loaderUrlPath__) !== -1){
        loaderScript = s;
        break;
      }
    }
    if(!loaderScript){
      throw new Error('loader script is not found!');
    }
    //get dataMain
    dataMain = loaderScript.getAttribute('data-main');
    if(dataMain){
      dataMain = dataMain.split(',').filter(Boolean).map(function(m){return m.trim();});
    }
    //prepare baseUrl
    loaderPath = getUrlPathname(loaderScript.src);
    // console.log('pagePath:', pagePath);
    // console.log('loaderPath:', loaderPath);
    baseUrl = loaderPath.replace(__loaderUrlPath__, '');
    moduleUrl = loaderPath.replace(__loaderPath__, __moduleRoute__);
    // console.log('baseUrl:', baseUrl);
  })();


  //legacy support
  var config = {};
  function define(id, deps, factory) {
    var mod = modCache[id],
      factoryParamNames, requireMod,
      module, exports;
    if (mod != null) {
      console.warn('Module "' + id + '" is already defined!');
      return mod.cache;
    }
    mod = {};
    modCache[id] = mod;
    if (typeof deps === 'function') {
      factory = deps;
      deps = [];
    }
    factoryParamNames = getParamNames(factory);
    requireMod = resolveDepModule.bind(null, id, modCache);
    try {
      if (factoryParamNames[0] === 'require' && factoryParamNames[1] === 'module') {
        module = {
          exports: {},
          id: id
        };
        exports = module.exports;
        factory.call(w, requireMod, module, exports);
        mod.cache = module.exports;
      } else {
        mod.cache = factory.apply(w, deps.map(function(depName){
          return depName === 'require' ? requireMod : requireMod(depName);
        }));
      }
      //legacy support
      if(w.m && w.m.config && Object(mod.cache) === mod.cache && mod.cache.ctrl == null){
        mod.cache.ctrl = config[id] || {};
      }
    } catch (err) {
      errHandler(err);
    }
  }
  function loadModule(modNames) {
    var resolveMod = resolveDepModule.bind(null, '', modCache);
    var isArray = Array.isArray(modNames), unloadedModNames, modLen, loadPromise, loadJSPromise;
    modNames = [].concat(modNames).filter(isNotEmptyStr).map(function(modName) {
      return modName.trim();
    });
    modLen = modNames.length;
    if (modLen === 0) {
      throw new Error('[Load Module]Invalid module names!');
    }
    unloadedModNames = modNames.filter(function(modName) {
      return modCache[modName] == null && modCache[modName + '/index'] == null &&  loadCache[modName] == null;
    });
    if (unloadedModNames.length > 0) {
      loadJSPromise = loadJS(makeModRequestUrl(unloadedModNames));
      unloadedModNames.forEach(function(mn) {
        loadCache[mn] = loadJSPromise;
      });
    }
    loadPromise = Promise.all(filterObj(isPromise, loadCache, modNames)).then(function() {
      modNames.forEach(function(mn) {
        if (isPromise(loadCache[mn])) {
          loadCache[mn] = 1;
        }
      });
      return !isArray ? resolveMod(modNames[0]) : modNames.map(resolveMod);
    })['catch'](function(err) {
      unloadedModNames.forEach(function(mn) {
        delete loadCache[mn];
      });
      errHandler(err);
    });
    loadPromise.spread = function(fn){
      return loadPromise.then(function(mods){
        return fn.apply(null, [].concat(mods));
      });
    };
    return loadPromise;
  }
  define.amd = true;
  w.define = define;
  w.requireAsync = loadModule;
  //legacy support
  if(Object(w.m) === w.m){
    w.m.define = define;
    w.m.load = loadModule;
    w.m.config = function(options) {
      // if (options.baseUrl) baseUrl = options.baseUrl;
      if(options.ctrl != null){
        config = options.ctrl;
      }
    };
  }
  var resourceUrlReg = /(url\(\s*['"]?)([^)'"]+)(['"]?\s*\))/g;
  //setup predefined modules
  define('addStyle', function(){
    function fixResourceUrl(content){
      return content.replace(resourceUrlReg, _fixUrl);
    }
    function _fixUrl(m, open, url, close){
      if(!isRelativeUrl(url)) return m;
      return open+baseUrl + '/' + url + close;
    }
    return function addStyle(styleStr){
      var head = document.getElementsByTagName('head')[0],
        style = document.createElement("style");

      // Add a media (and/or media query) here if you'd like!
      // style.setAttribute("media", "screen")
      // style.setAttribute("media", "only screen and (max-width : 1024px)")

      // WebKit hack :(
      style.appendChild(document.createTextNode(fixResourceUrl(styleStr)));

      head.appendChild(style);
    };
  });

  define('url', function(){
    function _url(url){
      if(typeof url !== 'string' || url[0] !== '/'){
        return url;
      }
      return baseUrl + url;
    }

    _url.parse = parseUri;
    return _url;
  });

  define('loadJS', function(){ return loadJS; });
  if(dataMain){
    loadModule(dataMain);
  }
  //helpers
  function resolveDepModule(name, modCache, depName) {
    var parentBase, part, parts, _i, _len, dname, dmod;
    if (depName.charAt(0) !== '.') {
      dname = depName;
    } else {
      parts = depName.split('/');
      parentBase = name.split('/').slice(0, -1);
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
    dmod = modCache[dname];
    if(!dmod){
      dmod = modCache[dname + '/index'];
    }
    if (!dmod) {
      throw new Error("[Module Error] Could not find module: [" + dname + ']');
    }
    return dmod.cache;
  }

  function loadJS(path) {
    var doc = w.document;
    if (typeof doc === 'undefined') {
      throw new Error('browser environment is required!');
    }
    if (!path || path.length === 0) {
      throw new Error('argument "path" is required !');
    }
    var head = doc.getElementsByTagName('head')[0];
    var script = doc.createElement('script');
    return new Promise(function(resolve, reject) {
      script.src = path;
      script.async = true;
      script.type = 'text/javascript';
      script.onload = function() {
        script.onload = null;
        head.removeChild(script);
        resolve();
      };
      script.onerror = function(e) {
        script.onerror = null;
        head.removeChild(script);
        reject(e);
      };
      head.appendChild(script);
    });
  }

  function isNotEmptyStr(str) {
    if (typeof str !== 'string') return false;
    return !!str.trim();
  }

  function makeModRequestUrl(modNames) {
    var loadedMods = Object.keys(loadCache).filter(function(k) {
      return modCache[k] != null;
    });
    return moduleUrl + '?m=' + modNames.join(',') + (loadedMods.length ? ('&l=' + loadedMods.join(',')) : '');
  }

  function errHandler(err) {
    if (typeof console.error === 'function') {
      console.error(err);
      console.error(err.stack);
    } else {
      console.log(err);
      console.log(err.stack);
    }
  }

  function dedup(arr) {
    return arr.reduce(function(m, item) {
      if (!~m.indexOf(item)) {
        m.push(item);
      }
      return m;
    }, []);
  }

  function isPromise(p) {
    return p && typeof p.then === 'function';
  }

  function filterObj(filter, o, keys) {
    var result = Object.keys(o).filter(function(k) {
      return !!~keys.indexOf(k) && filter(o[k]);
    }).map(function(k) {
      return o[k];
    });
    return dedup(result);
  }
  var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
  var ARGUMENT_NAMES = /([^\s,]+)/g;

  function getParamNames(func) {
    var fnStr = func.toString().replace(STRIP_COMMENTS, '');
    var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
    if (result === null) result = [];
    return result;
  }
  function getUrlPathname(url){
    return parseUri(url).pathname;
  }


  function isRelativeUrl(url){
    var parsed = parseUri(url);
    return !(
        (url.indexOf('/') === 0) ||
        (parsed.protocol === 'data') ||
        (parsed.host)
      );
  }
  // function relative(from, to){
  //   var isSlashTail = from[from.length - 1] === '/';
  //   var fromParts = from.split(/[\/\\\s]+/);
  //   var toParts = to.split(/[\/\\\s]+/);
  //   var i = 0 , l = Math.min(fromParts.length, toParts.length), p = i;
  //   for(;i<l;i++){
  //     if(fromParts[i] !== toParts[i]){
  //       break;
  //     }
  //     p = i;
  //   }
  //   fromParts = fromParts.slice(p + 1).filter(Boolean).map(function(){return '..';});
  //   if(!isSlashTail){
  //     fromParts.pop();
  //   }
  //   toParts = toParts.slice(p + 1);
  //   return (fromParts.length ? fromParts.join('/') : '.')  + '/' + toParts.join('/')
  // }


// })(window, window.Promise);

