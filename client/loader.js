// (function(w, Promise) {
  if (typeof w.__loaderBase__ === 'undefined'){
    throw new Error('w.__loaderBase__ is undefined!');
  }
  if (typeof Promise === 'undefined') {
    throw new Error('Promise is undefined!');
  }
  var modCache = {};
  var loadCache = {};
  var baseUrl = w.__loaderBase__;
  
  function define(id, deps, factory) {
    var mod = modCache[id],
      factoryParamNames, requireMod,
      module, exports;
    if (mod != null) {
      console.warn('Module "' + id + '" is already defined!');
      return mod.cache;
    }
    mod = {};
    if (typeof deps === 'function') {
      factory = deps;
      deps = [];
    }
    factoryParamNames = getParamNames(factory);
    requireMod = resolveDepModule.bind(null, id, modCache);
    try {
      if (factoryParamNames[0] === 'require' && factoryParamNames[1] === 'module') {
        module = {
          exports: {}
        };
        exports = module.exports;
        factory.call(w, requireMod, module, exports);
        mod.cache = module.exports;
      } else {
        mod.cache = factory.apply(w, deps.map(requireMod));
      }
      
    } catch (err) {
      errHandler(err);
    }
    modCache[id] = mod;
  }
  function loadModule(modNames) {
    var isArray = Array.isArray(modNames), unloadedModNames, modLen, loadPromise, loadJSPromise;
    modNames = [].concat(modNames).filter(isNotEmptyStr).map(function(modName) {
      return modName.trim();
    });
    modLen = modNames.length;
    if (modLen === 0) {
      throw new Error('[Load Module]Invalid module names!');
    }
    unloadedModNames = modNames.filter(function(modName) {
      return modCache[modName] == null && loadCache[modName] == null;
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
      return !isArray ? modCache[modNames[0]].cache : modNames.map(function(mn) {
        return modCache[mn].cache;
      });
    })['catch'](function(err) {
      unloadedModNames.forEach(function(mn) {
        delete loadCache[mn];
      });
      errHandler(err);
    });

    return loadPromise;
  }
  define.amd = true;
  w.define = define;
  w.requireAsync = loadModule;
  //setup predefined module
  define('addStyle', function(){
    return function addStyle(styleStr){
      var head = document.getElementsByTagName('head')[0],
        style = document.createElement("style");

      // Add a media (and/or media query) here if you'd like!
      // style.setAttribute("media", "screen")
      // style.setAttribute("media", "only screen and (max-width : 1024px)")

      // WebKit hack :(
      style.appendChild(document.createTextNode(styleStr));

      head.appendChild(style);
    };
  });
  //try to find data-main attribute value as entries
  (function(){
    var scripts = document.getElementsByTagName('script'),
      i, l = scripts.length, s, dataMain;
    for(i = l-1; i >=0 ; i--){
      s = scripts[i];
      dataMain = s.getAttribute('data-main');
      if(dataMain){
        dataMain = dataMain.split(',').filter(Boolean).map(function(m){return m.trim();});
        break;
      }
    }
    if(dataMain){
      loadModule(dataMain);
    }
  })();
      
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
      return loadCache[k] === 1;
    });
    return baseUrl + '?m=' + modNames.join(',') + (loadedMods.length ? ('&l=' + loadedMods.join(',')) : '');
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
// })(window, window.Promise);