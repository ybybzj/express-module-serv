# express-module-serv

> An express app booting module that sets up a frontend modular system service which supports AMD, CMD and UMD standards.


## Install

```sh
$ npm install --save express-module-serv
```


## Usage

Pass in express app instance and options to set up the service.

```js
var express = require('express');
var moduleServ = require('express-module-serv');
var app = express();
var options = {
  routePath: '/m', //default
  loaderPath: '/mloader.js', //default
  // ex. [".css", ".txt" ...], when module path's extension is not one of these 
  // then use `defaultExtensions` to resolve its path
  acceptExtensions: [], // default
  defaultExtensions: ['js'], //default
  pathSettings: {
    // requried
    baseUrl: __dirname + '/scripts',
    // optional prefix path settings
    paths: {
      css: __dirname + '/styles' or '../styles' relative to `base`
    }
  },
  debug: true, //default is false, skip minifying loader script

  //optional, set globals on window
  globals: {
    version: '1.0'
  },

  cacheControlExpiration: 10800, //default 0, set duration for expiration in seconds

  //default is true, set false in case you don't need rebuild when src file is updated, for example in production environment.
  reloadOnChange: true
};

//customize transformers if you need support loading css or svg modules

options.transformers = [
  //support loading css files, requiring the similar settings as the static middleware needs
  //for resource url correction
  require('express-module-serv/transformers/css-wrapper')({
    staticPath: __dirname + '/public',
    routePath: '/'
  }),
  //support CommonJS standard
  require('express-module-serv/transformers/cmd-wrapper')(),
  //add comma and new line
  require('express-module-serv/transformers/add-comma')()
];

moduleServ(app, options);
//suppose the index.html is in "public" directory
app.use(express.static(__dirname + '/public'));
app.listen(3003);
```
Then in html, you can import the loader script like this,
```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Express module serv Test Page</title>
    <script src="/mloader.js" data-main="app" async></script>
  </head>
  <body>
  </body>
  </html>
```
`app` stands for a entry module name, and that module is located in the `base`(__dirname + '/scripts') directory.
This module will be executed after `mloader.js` is loaded.

Both AMD or CommonJS module format are supported.  For example, a js file with a filename "add.js" and located in  __dirname + '/scripts/util' could be written like,
```js
//AMD module, must pass in a valid module name according to its filepath
define('util/add', function(){
  return function add(a, b){
    return a+b;
  };
});

//or CommonJS
module.exports = function add(a, b){
  return a + b;
};
```

Dependency identifier can be absolute or relative to the dependent module, and will be resolved referring to `pathSettings`.



The loader script in the page exposes these global methods:
#### `define`

(id, deps, factory) -> module

for define a amd module

#### `requireAsync`

(deps) -> [Promise]

require dependencies asynchronously
