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
moduleServ(app, {
  routePath: '/m', //default
  loaderPath: '/mloader.js', //default
  pathSettings: {
    // requried
    base: __dirname + '/scripts',
    // optional prefix path settings
    path: {
      css: __dirname + '/styles'
    }
  }
});
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