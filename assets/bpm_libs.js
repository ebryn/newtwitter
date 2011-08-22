/* ===========================================================================
   BPM Combined Asset File
   MANIFEST: handlebars (1.0.0.beta.3) jquery (1.6.2) newtwitter () spade (1.0.0.5) sproutcore (2.0.beta.3) sproutcore-handlebars (2.0.beta.3) sproutcore-metal (2.0.beta.3) sproutcore-runtime (2.0.beta.3) sproutcore-views (2.0.beta.3)
   This file is generated automatically by the bpm (http://www.bpmjs.org)
   =========================================================================*/

// ==========================================================================
// Project:   Spade - CommonJS Runtime
// Copyright: ©2010 Strobe Inc. All rights reserved.
// License:   Licened under MIT license
// ==========================================================================
/*jslint evil:true */
/*globals spade ARGS ARGV ENV __module ActiveXObject */


(function() {

var K, indexOf, Sandbox, Sp, Evaluator, Ep, Loader, Lp, Spade, Tp;


// ..........................................................
// HELPER FUNCTIONS
// 

K = function() {}; // noop

if (Array.prototype.indexOf) {
  indexOf = function(ary, obj, fromIndex) { 
    return ary.indexOf(obj, fromIndex);
  };
} else {
  indexOf = function(ary, obj, fromIndex) {
    var len = ary.length, idx;
    fromIndex = fromIndex<0 ? Math.max(0, ary.length+fromIndex) : (fromIndex||0);
    for(idx = fromIndex; idx<len; idx++) {
      if (ary[idx] === obj) return idx;
    }
    return -1;
  };
}

// assume id is already normalized
function packageIdFor(normalizedId) {
  return normalizedId.slice(0, indexOf(normalizedId, '/'));
}

function remap(id, contextPkg) {
  var mappings = contextPkg ? contextPkg.mappings : null;
  if (!mappings) { return id; }

  var packageId = packageIdFor(id);
  if (mappings[packageId]) {
    id = mappings[packageId] + id.slice(indexOf(id, '/'));
  }
  return id;
}

// convert a relative or otherwise de-normalized module id into canoncial form
// normalize('./foo', 'bar/baz') -> 'bar/foo'
// normalize('foo', 'bar/baz') -> 'foo/main' (or foo/~package is asPackage)
// normalize('foo/bar', 'bar/baz') -> 'foo/bar'
function normalize(id, contextId, contextPkg, _asPackage) {
  var idx, len;

  // slice separator off the end since it is not used...
  if (id[id.length-1]==='/') { id = id.slice(0,-1); }

  // need to walk if there is a .
  if (indexOf(id, '.')>=0) {
    var parts = contextId && (id.charAt(0) ==='.') ? contextId.split('/') : [],
        part, next,
        packageName = parts[0],
        needsCleanup = false;

    idx = 0;
    len = id.length;

    if (contextPkg && contextPkg.main && contextId === packageName+'/main') {
    // If we're requiring from main we need to handle relative requires specially
      needsCleanup = true;
      parts = contextPkg.main.replace(/^\.?\//, '').split('/');
    }

    parts.pop(); // get rid of the last path element since it is a module.

    while(idx<len) {
      next = indexOf(id, '/', idx);
      if (next<0) { next = len; }
      part = id.slice(idx, next);
      if (part==='..') { parts.pop(); }
      else if (part!=='.' && part!=='' && part!==null) { parts.push(part); }
      // skip .., empty, and null.
      idx = next+1;
    }

    id = parts.join('/');

    if (needsCleanup) {
      var libPaths = contextPkg.directories.lib;
      for (idx=0,len=libPaths.length; idx<len; idx++){
        id = id.replace(libPaths[idx].replace(/^\.?\//, '')+'/', '');
      }
      id = packageName+'/'+id;
    }

  // else, just slice off beginning '/' if needed
  } else if (id[0]==='/') { id = id.slice(1); }

  // if we end up with no separators, make this a pkg
  if (indexOf(id, '/')<0) { id = id+(_asPackage ? '/~package' : '/main'); }

  // slice separators off begin and end
  if (id[0]==='/') { id = id.slice(1); }

  // Remove unnecessary ~lib references
  id = id.replace('~lib/', '');

  return remap(id, contextPkg);
}

// ..........................................................
// SANDBOX - you could make a secure version if you want
// 

// runs a factory within context and returns exports...
function execFactory(id, factory, sandbox, spade) {
  var require, mod, factoryData, fullId;

  var filename = factory.filename,
      ARGV     = sandbox.ARGV,
      ENV      = sandbox.ENV;

  require = sandbox.makeRequire(id, spade);
  
  sandbox._modules[id] = mod = {
    id:        id,
    exports:   {},
    sandbox:   sandbox
  };

  factoryData = factory.data; // extract the raw module body

  // evaluate if needed - use cache so we only do it once per sandbox
  if ('string' === typeof factoryData) {
    
    if (sandbox._factories[id]) {
      factoryData = sandbox._factories[id];
    } else {
      sandbox._loading[id] = true;

      // The __evalFunc keeps IE 9 happy since it doesn't like
      // unassigned anonymous functions
      factoryData = sandbox.evaluate('__evalFunc = '+factoryData+'\n//@ sourceURL='+filename+'\n', filename);
      sandbox._factories[id] = factoryData;
      sandbox._loading[id] = false;
    }
  }

  if ('function' === typeof factoryData) {
    var ret = factoryData(require, mod.exports, mod, ARGV, ENV, filename);
    if (ret !== undefined) { mod.exports = ret; } // allow return exports
  } else {
    mod.exports = factoryData;
  }

  return mod.exports;
}

/**
  @constructor

  Sandbox provides an isolated context for loading and running modules.
  You can create new sandboxes anytime you want.  If you pass true for the
  isolate flag, then the sandbox will be created in a separate context if
  supported on the platform.  Otherwise it will share globals with the
  default sandbox context.

  Note that isolated sandboxes are not the same as secure sandboxes.  For
  example in the browser, a isolated sandbox is created using an iframe
  which still exposes access to the DOM and parent environment.

  Isolated sandboxes are mostly useful for testing and sharing plugin code
  that might want to use different versions of packages.

  @param {Spade} spade
    The spade instance

  @param {String} name
    (Optional) name of the sandbox for debugging purposes
    
  @param {Boolean} isolate
    Set to true if you want to isolate it

  @returns {Sandbox} instance
*/
Sandbox = function(spade, name, isolate) {
  
  // name parameter is optional
  if (typeof name !== 'string') {
    isolate = name;
    name = null;
  }

  if (!name) { name = '(anonymous)'; }

  this.spade = spade;
  this.name  = name;
  this.isIsolated = !!isolate;
  this._factories = {}; // evaluated factories
  this._loading   = {}; // list of loading modules
  this._modules   = {}; // cached export results
  this._used      = {}; // to detect circular references
};

// alias this to help minifier make the page a bit smaller.
Sp = Sandbox.prototype;

Sp.toString = function() {
  return '[Sandbox '+this.name+']';
};

/**
  Evaluate the passed string in the Sandbox context, returning the result.
  This is the primitive used to evalute string-encoded factories into
  modules that can execute within a specific context.
*/
Sp.evaluate = function(code, filename) {
  if (this.isDestroyed) { throw new Error("Sandbox destroyed"); }
  if (!this._evaluatorInited) {
    this._evaluatorInited = true;
    this.spade.evaluator.setup(this);
  }
  return this.spade.evaluator.evaluate(code, this, filename);
};

/**
  NOTE: This is a primitive form of the require() method.  Usually you should
  use the require() method defined in your module.

  Sandbox-specific require.  This is the most primitive form of require.  All
  other requires() pass through here.
  
  @param {String} id
    The module id you want to require.
    
  @param {String} callingId
    (Optional) The id of the module requiring the module.  This is needed if 
    you the id you pass in might be relative.
    
  @returns {Object} exports of the required module
*/
Sp.require = function(id, callingId) {
  var spade = this.spade,
      pkg, ret, factory;
      
  pkg = callingId ? spade.package(callingId) : null;
  id = normalize(id, callingId, pkg);

  ret = this._modules[id];
  if (ret) { ret = ret.exports; }

  if (ret) {
    
    // save so we can detect circular references later
    if (!this._used[id]) { this._used[id] = ret; }
    return ret ;

  } else {
    factory = spade.loadFactory(spade.resolve(id, this));
    if (!factory) { throw new Error('Module '+id+' not found'); }

    if (!this.ENV)  { this.ENV = spade.env(); } // get at the last minute
    if (!this.ARGV) { this.ARGV = spade.argv(); }

    ret = execFactory(id, factory, this, spade);

    if (this._used[id] && (this._used[id] !== ret)) {
      throw new Error("Circular require detected for module "+id);
    }
  }

  return ret ;
};

/**
  NOTE: This is a primitive form of the exists() method.  Usually you should
  use the require.exists() method defined on the require() function in your
  module.

  Sandbox-specific test to determine if the named module exists or not.
  This property only reflects what is immediately available through the
  sync-loader.  Using the async loader may change the return value of this
  call.
  
  @param {String} id
    The module id you want to test
    
  @param {String} callingId
    (Optional) The id of the module requesting the module.  Required if the id 
    you pass in might be relative.
    
  @returns {Object} exports of the required module
*/
Sp.exists = function(id, callingId) {
  var spade = this.spade, pkg;
  pkg = callingId ? spade.package(callingId) : null;
  id  = normalize(id, callingId, pkg);
  if (this._modules[id]) { return true; }
  return spade.factoryExists(spade.resolve(id, this));
};

/**
  NOTE: This is a primitive form of the async() method.  Usually you should
  use the require.async() method defined on the require() function in your
  module.
  
  Asynchronously attempts to load a module, invoking a callback if and when
  the module is loaded.  If the module is already defined, the callback will
  be invoked immediately.  Otherwise, this will use the Loader plugin on the
  main spade context to attempt to load the module.  If the module cannot 
  be loaded, the callback will be invoked with an error object as its first
  parameter to inform you that it failed.
  
  Note that the default Loader that ships with spade is not actually capable
  of asynchronously loading modules, which means this method will always fail
  unless the module is already present.  You can use the spade-loader package
  to install an async loader that will work.
  
  @param {String} id
    The module id you want to load

  @param {Function} callback
    A callback to invoke when the module is loaded or if the load has failed.
    The calback should expect an error object (or null) as the first 
    parameter.
    
  @param {String} callingId
    (Optional) The id of the module requesting the module.  Required if the id 
    you pass in might be relative.
    
  @returns {void}
*/
Sp.async = function(id, callback, callingId) {
  var spade = this.spade, pkg;
  pkg = callingId ? spade.package(callingId) : null;
  id = spade.resolve(normalize(id, callingId, pkg), this);
  spade.loadFactory(id, callback);
};

/**
  NOTE: This is a primitive form of the url() method.  Usually you should
  use the require.url() method defined on the require() function in your
  module.

  Returns the URL of the given resource based on the settings of the named
  package.  This method requires the package information to include a `root`
  property that defines the root URL where resources can be found.  
  
  This method is useful for finding non-JavaScript resources such as images,
  video, etc.
  
  @param {String} id
    A module id form of the reference you want to load.
    
  @param {String} ext
    (Optional) and extension to append to the returned URL.
    
  @param {String} callingId
    (Optional) The id of the module requesting the module.  Required if the id 
    you pass in might be relative.

  @param {String} the computed URL.
*/
Sp.url = function(id, ext, callingId) {
  var spade = this.spade, ret, pkg;

  pkg = callingId ? spade.package(callingId) : null;
  id = normalize(id, callingId, pkg);

  pkg = spade.package(id);
  if (!pkg) {
    var packageId = packageIdFor(id)+'/~package';
    if (spade.exists(packageId)) { spade.require(packageId); }
    pkg = spade.package(id);
  }

  if (!pkg) {
    throw new Error("Can't get url for non-existent package "+id);
  }

  if (!pkg.root) {
    throw new Error('Package for '+id+' does not support urls');
  }

  ret = pkg.root + id.slice(id.indexOf('/'));
  if (ext) { ret = ret+'.'+ext; }
  return ret ;
};

Sp.isDestroyed = false;

Sp.destroy = function() {
  if (!this.isDestroyed) {
    this.isDestroyed = true;
    this.spade.evaluator.teardown(this);
  }
  return this;
};

/**
  Return a new require function for the normalized module ID.  Normally you
  would not call this method yourself but you might override it if you want 
  to add new API to the require() methods passed into modules.
*/
Sp.makeRequire = function(id, spade) {
  var pkg     = spade.package(id),
      sandbox = this,
      require;

  require = function(moduleId) {
    return sandbox.require(moduleId, id, pkg);
  };

  // make the require 'object' have the same API as sandbox and spade.
  require.require = require;

  require.exists = function(moduleId) {
    return sandbox.exists(normalize(moduleId, id, pkg));
  };

  require.normalize = function(moduleId) {
    return normalize(moduleId, id, pkg);
  };

  require.async = function(moduleId, callback) {
    return sandbox.async(normalize(moduleId, id, pkg), callback);
  };

  require.sandbox = function(name, isolate) {
    return spade.sandbox(name, isolate);
  };

  require.url = function(moduleId, ext) {
    return sandbox.url(normalize(moduleId, id, pkg), ext);
  };

  require.id = id; // so you can tell one require from another

  return require;
};

// ..........................................................
// LOADER
//

/**
  @constructor 
  
  The Loader object is used to asynchronously load modules from the server.
  It also provides other low-level URL resolution and event handling 
  functions needed to integrate with the low-level environment.  The default
  implementation does not support any kind of async loading.  See the 
  spade-loader package for a way to add support for this.
*/
Loader = function() {
  this._loading = {};
};

Lp = Loader.prototype;

/**
  Called by spade whenever a module is requested that has not already been
  registered in memory.  This function should attempt to load the module if 
  possible, registering any packages on the spade instance.
  
  If a `done` is a function, then this method should run asynchronously -
  invoking the callback when complete.  If the load failed, this method should
  pass an error as the first parameter.  Otherwise it should not pass any 
  parameter.
  
  If `done` is null, then this method should run synchronously and then simply
  return when it is complete.  If the named module cannot be loaded, you can
  just return with no errors as the spade environment will detect this 
  condition and fail.
  
  Note that loaders are not required to support both sync and async loading. 
  If you don't support one or the other, simply throw an error.
  
  @method
  
  @param {Spade} spade
    The spade instance.
    
  @param {String} id
    The normalized module id to load.
    
  @param {Function} done
    (Optional) if passed, run this function async and invoke the done callback
    when complete.
    
  @returns {void}
*/
Lp.loadFactory = null;

/**
  Called by spade whenever it wants to detect if a given module exists and the
  id is not yet registered with the spade instance.
  
  This method should do its best to determine if the module exists and return
  the appropriate value.  Note that if you only support async loading of 
  modules then you may not be able to detect when a module is defined outside
  of what is already registered. In this case it is OK to simply return false.
  
  @method
  
  @param {Spade} spade
    The spade instance.
    
  @param {String} id
    The normalized module id to load
    
  @returns {Boolean} true if module exists
*/
Lp.exists = null;

// NOTE: On ready stuff mostly stolen from jQuery 1.4.  Need to incl here
// because spade will often be used to load jQuery.
// Will only be invoked once.  Just be prepared to call it
/**
  Called once by spade on page load to schedule a ready callback, which should
  be invoked once the documents 'ready' event (or an equivalent) is fired.

  You should never call this method yourself but you might override it when
  using spade outside of a proper browser.

  @param {Function} callback
    The callback to be invoked when the document is 'ready'.
    
  @returns {void}
*/
Lp.scheduleReady = function(callback) {

  // handle case where ready is invoked AFTER the document is already ready
  if ( document.readyState === "complete" ) { return setTimeout(callback, 1); }

  var handler, handled = false;

  // The DOM ready check for Internet Explorer
  function doScrollCheck() {
    if (handled) { return; }

    try {
      // If IE is used, use the trick by Diego Perini
      // http://javascript.nwbox.com/IEContentLoaded/
      document.documentElement.doScroll("left");
    } catch(e) {
      setTimeout( doScrollCheck, 1 );
      return;
    }

    // and execute any waiting functions
    handler();
  }

  // Mozilla, Opera and webkit nightlies currently support this event
  if (document.addEventListener) {

    handler = function() {
      if (handled) { return; }
      handled = true;
      document.removeEventListener("DOMContentLoaded", handler, false);
      window.removeEventListener('load', handler, false);
      callback();
    };

    document.addEventListener( "DOMContentLoaded", handler, false);

    // A fallback to window.onload, that will always work
    window.addEventListener( "load", handler, false );

  // If IE event model is used
  } else if ( document.attachEvent ) {

    handler = function() {
      if (!handled && document.readyState === "complete") {
        handled = true;
        document.detachEvent( "onreadystatechange", handler );
        window.detachEvent('onload', handler);
        callback();
      }
    };

    // ensure firing before onload,
    // maybe late but safe also for iframes
    document.attachEvent("onreadystatechange", handler);

    // A fallback to window.onload, that will always work
    window.attachEvent( "onload", handler);

    // If IE and not a frame
    // continually check to see if the document is ready
    var toplevel = false;

    try {
      toplevel = window.frameElement === null;
    } catch(e) {}
    if ( document.documentElement.doScroll && toplevel ) { doScrollCheck(); }
  }
};

// ..........................................................
// Evaluator Class
//

/**
  @constructor
  
  An Evaluator instance is used to evaluate code inside of a sandbox.  A 
  default instance is created on spade and used automatically by sandboxes. 
  You can extend this class and replace the default one on spade in order to
  provide additional new features, such as sandbox isolation or secure eval.

  The default Evaluator simply evals code in the current context using the 
  built-in eval() function.  It does not support isolated sandboxes.  To add
  isolated sandbox support, add the `spade-isolate` package.
*/
Evaluator = function() {};
Ep = Evaluator.prototype;

/**
  Called once on each new sandbox to allow the evaluator to setup any required
  context for future calls.  For isolated sandboxes, this is usually where
  you would create the new compilation context and store it on the sandbox for
  future use.
  
  The default implementation does nothing, but will throw an exception if you
  try to setup a new isolated sandbox. (Since the feature is not supported.).
  If you override this method, you do not need to call the default function.
  
  @param {Sandbox} sandbox
    The sandbox to setup.
    
  @returns {void}
*/
Ep.setup = function(sandbox) {
  if (sandbox.isIsolated) { 
    throw new Error("Isolated sandboxes are not supported."); 
  }
};

/**
  Evaluates the passed JavaScript within the context of a sandbox and returns
  the resulting value (usually a function).  The default version simply calls
  the built-in eval().
  
  @param {String} text
    The code to evaluate.
    
  @param {Sandbox} sandbox
    The sandbox owning the code.
    
  @param {String} filename
    An optional filename to associate with the text (may be useful for debug
    support)
    
  @returns {Object} evaluated result.
*/
Ep.evaluate = function(text, sandbox, filename) {
  return eval(text);
};

/**
  Called once by the sandbox when it is destroyed to allow the evaluator to
  cleanup any data it might have stashed on the sandbox.  For isolated 
  sandboxes, this method might destroy the compilation context to allow its 
  memory to be reclaimed.
  
  Since the default evaluator does not support isolated contexts, this method
  is a no-op.
  
  @param {Sandbox} sandbox
    The sandbox about to be destroyed.
    
  @returns {void}
*/
Ep.teardown = function(sandbox) {
  // noop by default
};

// ..........................................................
// Spade Class - defined so we can recreate
//

/**
  @constructor
  
  The root object used to coordinate the entire spade environment.  A global
  instance of this class is created on page load called `spade`.  Most of the
  time you will only interact with this object directly to register new 
  modules and perhaps to load a new module outside of traditional module code.
  
  Note that if you are using BPM and your app is actually published as modules
  then you won't actually need reference this object at all as the details are
  handled for you.

  # Registering a Module
  
  If you are manually constructing a JavaScript file to load from the server
  and you want to register new modules, you will need to use the
  `spade.register()` method:
  
      spade.register('package_name/module_name', function() { ... });
      
  This will make the module `package_name/module_name` available to all other
  modules.  The first time the module is required, your passed function will
  be called.
  
  You can also register metadata about a package by registering the 
  `package_name/~package` module:
  
      spade.register('package_name/~package', { 
        "name": "package_name",
        "version": "1.0.0",
        ...
      });
      
  Note that in addition to factory functions you can also pass in JSON hashes
  (which will simply be returned directory) or a string of code - which will
  be eval'd on demand.
  
  The string format is particularly important because defining modules as 
  strings can dramatically improve load time on mobile devices while also 
  allowing you to easily support isolated sandbox contexts.
  
  # Requiring a Module
  
  Normally when you write module code that is managed by Spade you will have
  a `require()` method defined within the module that you should use to load
  modules.
  
  If you happen to be writing code outside of a spade module and need to 
  require a module, however, you can use the `spade.require()` method instead:
  
      var jQuery = spade.require('jquery');
      
  This works just like the built-in require method except it will not support
  relative modules (since there is no module to be relative too).  This 
  method will require modules from the default sandbox, found at 
  `spade.defaultSandbox`.
  
  # Plugins
  
  Spade supports a number of plugins that you can use to enhance the way 
  spade discovers and loads modules.  The two plugins currently supported are
  a `loader` and `evaluator`.
  
  The `loader` plugin is used to asynchronously discover and load modules. It
  expects the object to be an instance of Spade.Loader.  See `Loader` 
  documentation for more information.
  
  The `evaluator` plugin is used to evaluate code within a sandbox context. It
  can be enhanced to support isolated sandboxes as well as worker threads and
  many other contexts.  See the `Evaluator` documentation for more 
  information.
  
*/
Spade = function() {
  this.loader   = new this.Loader(this);
  this.evaluator = new this.Evaluator(this);
  this.defaultSandbox  = this.sandbox();
  this._factories = {};
  this._packages  = {};
};

Tp = Spade.prototype;

Tp.VERSION  = "1.0.0";

// expose the classes.  We do it this way so that you can create a new
// Spade instance and treat it like the spade module
Tp.Spade    = Spade;
Tp.Sandbox  = Sandbox;
Tp.Loader   = Loader;
Tp.Evaluator = Evaluator;

/**
  Computes and returns a normalized ENV hash.  By default this will look for
  a globally defined variable called `ENV` and use that.  If not defined,
  it will look for a locally defined `ENV` variable instead.
  
  In either case, this method will also normalize the variable to include at
  least the `LANG` and `SPADE_PLATFORM` properties.
  
  @returns {Hash} the environment hash
*/
Tp.env = function() {
  var env = this.ENV;
  if (!env) { this.ENV = env = ('undefined' !== typeof ENV) ? ENV : {}; }
  if (!env.SPADE_PLATFORM) { env.SPADE_PLATFORM = 'browser'; }
  if (!env.LANG) {
    env.LANG = ('undefined' !== typeof navigator) ? navigator.language : 'en-US';
  }
    
  return env;
};

/**
  Computes and returns the ARGV array for the current spade environment.  By
  default this will look for a globally defined variable called `ARGV` and 
  use that.
  
  ARGV is a useful way to pass in startup options to spade modules.
  
  @returns {Array} the argv array
*/
Tp.argv = function() {
  var argv = this.ARGV;
  if (!argv) { argv= this.ARGV = ('undefined' !== typeof ARGV) ? ARGV : []; }
  return argv;
};

/**
  Restores original values after a call to `spade.globalize()`.  If you call 
  this method more than once it will have no effect.
  
  @returns {void}
*/
Tp.noConflict = function() {
  var c = this._conflict;
  if (c) {
    delete this._conflict;
    spade = this._conflict;
  }
  return this;
};

/**
  Returns a new sandbox instance attached to the current spade instance.
  If you pass true for the `isolate` parameter, the new sandbox will attempt
  to load its code in an isolated compilation context (possibly using an 
  iframe in browsers).  Note that isolated sandboxes are not supported by 
  default.  Include the spade-isolate package instead.

  @param {String} name
    (Optional) name for the sandbox for debugging purposes.
  
  @param {Boolean} isolate
    true if you want the sandbox to be isolated.  Throws exception if
    platform cannot isolate.

  @returns {Sandbox} sandbox instance
*/
Tp.sandbox = function(name, isolate) {
  return new this.Sandbox(this, name, isolate);
};

/**
  Register a module or package information.  You can pass one of the
  following:

    'module/id', 'module body string'
    'module/id', function() { module func }
    'module/id', { exports: 'foo' }
    'module/id' - just register module id and no body to indicate presence

  Note also that if you pass just a packageId, it will be normalized to
  packageId/~package.  This is how you register a package.

  @param {String} id
    The module or package id

  @param {String|Function|Hash} data
    A module function, module body (as string), or hash of exports to use.

  @param {String} opts
    Additional metadata only if you are registering a module factory.  Known
    keys include 'filename' and 'format' (for compilation of DSLs).

  @returns {void}
*/
Tp.register = function(id, data, opts) {
  if (!data) { data = K ; }
  var t = typeof data, isExtern, factory, isPkg;

  id = normalize(id, null, null, true);
  isPkg = id.slice(-9) === '/~package';

  // register - note packages can only accept hashes
  if (isPkg && 'object'!==typeof data) {
    throw new Error('You can only register hashes for packages');
  }

  // Set some package defaults
  if (isPkg) {
    if (!data.directories) { data.directories = {}; }
    if (!data.directories.lib) {
      data.directories.lib = ['lib'];
    } else if (typeof data.directories.lib === 'string') {
      data.directories.lib = [data.directories.lib];
    }
  }

  factory = { data: data };
  factory.filename     = opts && opts.filename ? opts.filename : id;

  // Store with generic id if none, or if JS
  this._factories[id] = factory;
  return this;
};

/**
  Efficient way to register external packages.  Pass a hash of packageIds
  and source URLs.  If the package is already registered, the extern will
  not replace it so this is safe to call multiple times.
  
  @param {Hash} externs
    A hash of package names and package settings.
    
  @returns {void}
*/
Tp.externs = function(externs, extern) {
  var tmp, packages = this._packages;

  // normalize method call.
  if ('string' === typeof externs) {
    tmp = {};
    tmp[externs] = extern;
    externs = tmp;
    extern = null;
  }

  for(var packageId in externs) {
    if (!externs.hasOwnProperty(packageId)) { continue; }
    if (packages[packageId] && !packages[packageId].extern) { continue; }

    extern = externs[packageId];
    if ('string' === typeof extern) { extern = {name: packageId, src: extern}; }
    extern.extern = true;
    this.register(packageId, extern);
  }
};

/**
  Require a module from the default sandbox.

  @param {String} id
    The module id.

  @returns {Hash} module exports
*/
Tp.require = function(id) {
  return this.defaultSandbox.require(id, this.defaultSandbox.callerId);
};

/**
  Async load a module if it is not already a registered factory.  Invoke
  the passed callback with an optional error object when the module is
  ready to load.
*/
Tp.async = function(id, callback) {
  return this.defaultSandbox.async(id, callback);
};

/**
  Returns true if the passed module exists in the default sandbox.
  
  @param {String} id
    The module id to check.
    
  @returns {Boolean} true if module id exists
*/
Tp.exists = function(id) {
  return this.defaultSandbox.exists(id);
};

/**
  Returns the URL for a resource matching the passed module id and optional
  extension.
  
  @param {String} id
    the module id to resolve
  
  @param {String} ext
    (Optional) extension to append to URL
    
  @returns {String} url
*/
Tp.url = function(id, ext) {
  return this.defaultSandbox.url(id, ext);
};

/**
  Called by the sandbox to get a factory object for the named moduleId.  
  Normally you will not need to call this method directly or even override it.
  
  @param {String} id
    Fully normalized module id
    
  @param {Function} callback
    (Optional) callback to invoke once factory is loaded.  If not passed, this
    method will run sync.  Otherwise it will run async.
    
  @returns {Hash} factory hash.
*/
Tp.loadFactory = function(id, callback) {
  
  var ret = this._factories[id],
      loader = this.loader;

  if (callback) {
    if (!ret) {
      if (loader && loader.loadFactory) {
        loader.loadFactory(this, id, callback);
      } else { callback(new Error('Module '+id+' not found')); }
    } else { callback(); }

  } else if (!ret && loader && loader.loadFactory) {
    loader.loadFactory(this, id);
    ret = this._factories[id];
  }

  return ret ;
};

/**
  Called by the sandbox to determine if the named id exists on the system.
  The id should already be normalized.  If the id is not yet registered, the
  loader will also be consulted.
  
  Normally you will not need to call this method directly or override it.
  
  @param {String} id
    Fully normalized module id
    
  @returns {Boolean} true if factory exists
*/
Tp.factoryExists = function(id) {
  if (this._factories[id]) { return true; }
  var loader = this.loader;
  return loader && loader.exists && loader.exists(this, id);
};

/**
  Returns the package info, if any, for the named module or packageId
  
  @param {String} id
    A package name or fully normalized module id.
    
  @returns {Hash} package info or null if package is not registered
*/
Tp.package = function(id) {
  id = packageIdFor(normalize(id))+'/~package';
  var ret = this._factories[id];
  return ret ? ret.data : null;
};

/**
  Normalize a moduleId, expanding relative values if needed.
  
  @param {String} id
    The module id, possibly de-normalized.
    
  @param {String} contextId
    (Optional) The normalized module id of the calling module.  Required if 
    your module id might be relative.
    
  @returns {String} the normalized module id
*/
Tp.normalize = function(id, contextId) {
  return normalize(id, contextId);
};

/**
  Maps the passed module id to a potentially location specific module id.
  This gives the loader a way to vary the factory function returns for a given
  module id per sandbox.  Useful when supporting multiple versions of the 
  same package.
  
  @param {String} id
    Normalized module id
    
  @param {Sandbox} sandbox
    The requesting sandbox
    
  @returns {String} resolved module id
*/
Tp.resolve = function(id, sandbox) {
  var loader = this.loader;
  return sandbox && loader && loader.resolve ? loader.resolve(id, sandbox):id;
};

/**
  Invokes the passed callback when the browser is ready.  This will work 
  regardless of the environment you are in.
  
  @param {Function} callback
    Invoked when the browser is ready.  If browser is alrady ready, invoked
    immediately.
    
  @returns {void}
*/
Tp.ready = function(callback) {
  switch(this.readyState) {
    case 'ready':
      callback();
      break;

    case 'scheduled':
      this._readyQueue.push(callback);
      break;

    default:
      this._readyQueue = [callback];
      this.readyState = 'scheduled';
      if (this.loader.scheduleReady) {
        var that = this;
        this.loader.scheduleReady(function() {
          var queue = that._readyQueue, len = queue ? queue.length : 0;
          that._readyQueue = null;
          that.readyState = 'ready';
          for(var idx=0;idx<len;idx++) { queue[idx](); }
        });

      } else {
        throw new Error('Loader does not support activate on ready state');
      }
  }
};

// instantiate spade and also attach class for testing
var newSpade = new Spade();
if ('undefined' !== typeof spade) newSpade._conflict = spade;
spade = newSpade;

// make this work when called as a module - both from within spade and from
// node.
if ('undefined' !== typeof require) {
  if ('undefined' !== typeof __module) { __module.exports = spade; }
  else if ('undefined' !== typeof module) { module.exports = spade; }
}

})();
spade.register("sproutcore-metal/accessors", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Metal\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals sc_assert */\n\n\nrequire('sproutcore-metal/core');\nrequire('sproutcore-metal/platform');\nrequire('sproutcore-metal/utils');\n\nvar USE_ACCESSORS = SC.platform.hasPropertyAccessors && SC.ENV.USE_ACCESSORS;\nSC.USE_ACCESSORS = !!USE_ACCESSORS;\n\nvar meta = SC.meta;\n\n// ..........................................................\n// GET AND SET\n// \n// If we are on a platform that supports accessors we can get use those.\n// Otherwise simulate accessors by looking up the property directly on the\n// object.\n\nvar get, set;\n\nget = function get(obj, keyName) {\n  if (keyName === undefined && 'string' === typeof obj) {\n    keyName = obj;\n    obj = SC;\n  }\n  \n  if (!obj) return undefined;\n  var ret = obj[keyName];\n  if (ret===undefined && 'function'===typeof obj.unknownProperty) {\n    ret = obj.unknownProperty(keyName);\n  }\n  return ret;\n};\n\nset = function set(obj, keyName, value) {\n  if (('object'===typeof obj) && !(keyName in obj)) {\n    if ('function' === typeof obj.setUnknownProperty) {\n      obj.setUnknownProperty(keyName, value);\n    } else if ('function' === typeof obj.unknownProperty) {\n      obj.unknownProperty(keyName, value);\n    } else obj[keyName] = value;\n  } else {\n    obj[keyName] = value;\n  }\n  return value;\n};\n\nif (!USE_ACCESSORS) {\n\n  var o_get = get, o_set = set;\n  \n  get = function(obj, keyName) {\n    if (keyName === undefined && 'string' === typeof obj) {\n      keyName = obj;\n      obj = SC;\n    }\n\n    sc_assert(\"You need to provide an object and key to `get`.\", !!obj && keyName);\n\n    if (!obj) return undefined;\n    var desc = meta(obj, false).descs[keyName];\n    if (desc) return desc.get(obj, keyName);\n    else return o_get(obj, keyName);\n  };\n\n  set = function(obj, keyName, value) {\n    sc_assert(\"You need to provide an object and key to `set`.\", !!obj && keyName !== undefined);\n    var desc = meta(obj, false).descs[keyName];\n    if (desc) desc.set(obj, keyName, value);\n    else o_set(obj, keyName, value);\n    return value;\n  };\n\n}\n\n/**\n  @function\n  \n  Gets the value of a property on an object.  If the property is computed,\n  the function will be invoked.  If the property is not defined but the \n  object implements the unknownProperty() method then that will be invoked.\n  \n  If you plan to run on IE8 and older browsers then you should use this \n  method anytime you want to retrieve a property on an object that you don't\n  know for sure is private.  (My convention only properties beginning with \n  an underscore '_' are considered private.)\n  \n  On all newer browsers, you only need to use this method to retrieve \n  properties if the property might not be defined on the object and you want\n  to respect the unknownProperty() handler.  Otherwise you can ignore this\n  method.\n  \n  Note that if the obj itself is null, this method will simply return \n  undefined.\n  \n  @param {Object} obj\n    The object to retrieve from.\n    \n  @param {String} keyName\n    The property key to retrieve\n    \n  @returns {Object} the property value or null.\n*/\nSC.get = get;\n\n/**\n  @function \n  \n  Sets the value of a property on an object, respecting computed properties\n  and notifying observers and other listeners of the change.  If the \n  property is not defined but the object implements the unknownProperty()\n  method then that will be invoked as well.\n  \n  If you plan to run on IE8 and older browsers then you should use this \n  method anytime you want to set a property on an object that you don't\n  know for sure is private.  (My convention only properties beginning with \n  an underscore '_' are considered private.)\n  \n  On all newer browsers, you only need to use this method to set \n  properties if the property might not be defined on the object and you want\n  to respect the unknownProperty() handler.  Otherwise you can ignore this\n  method.\n  \n  @param {Object} obj\n    The object to modify.\n    \n  @param {String} keyName\n    The property key to set\n    \n  @param {Object} value\n    The value to set\n    \n  @returns {Object} the passed value.\n*/\nSC.set = set;\n\n// ..........................................................\n// PATHS\n// \n\nfunction normalizePath(path) {\n  sc_assert('must pass non-empty string to normalizePath()', path && path!=='');\n    \n  if (path==='*') return path; //special case...\n  var first = path.charAt(0);\n  if(first==='.') return 'this'+path;\n  if (first==='*' && path.charAt(1)!=='.') return 'this.'+path.slice(1);\n  return path;\n}\n\n// assumes normalized input; no *, normalized path, always a target...\nfunction getPath(target, path) {\n  var len = path.length, idx, next, key;\n  \n  idx = path.indexOf('*');\n  if (idx>0 && path[idx-1]!=='.') {\n    return getPath(getPath(target, path.slice(0, idx)), path.slice(idx+1));\n  }\n\n  idx = 0;\n  while(target && idx<len) {\n    next = path.indexOf('.', idx);\n    if (next<0) next = len;\n    key = path.slice(idx, next);\n    target = key==='*' ? target : get(target, key);\n\n    if (target && target.isDestroyed) { return undefined; }\n\n    idx = next+1;\n  }\n  return target ;\n}\n\nvar TUPLE_RET = [];\nvar IS_GLOBAL = /^([A-Z$]|([0-9][A-Z$])).*[\\.\\*]/;\nvar IS_GLOBAL_SET = /^([A-Z$]|([0-9][A-Z$])).*[\\.\\*]?/;\nvar HAS_THIS  = /^this[\\.\\*]/;\nvar FIRST_KEY = /^([^\\.\\*]+)/;\n\nfunction firstKey(path) {\n  return path.match(FIRST_KEY)[0];\n}\n\n// assumes path is already normalized\nfunction normalizeTuple(target, path) {\n  var hasThis  = HAS_THIS.test(path),\n      isGlobal = !hasThis && IS_GLOBAL.test(path),\n      key;\n\n  if (!target || isGlobal) target = window;\n  if (hasThis) path = path.slice(5);\n  \n  var idx = path.indexOf('*');\n  if (idx>0 && path.charAt(idx-1)!=='.') {\n    \n    // should not do lookup on a prototype object because the object isn't\n    // really live yet.\n    if (target && meta(target,false).proto!==target) {\n      target = getPath(target, path.slice(0, idx));\n    } else {\n      target = null;\n    }\n    path   = path.slice(idx+1);\n\n  } else if (target === window) {\n    key = firstKey(path);\n    target = get(target, key);\n    path   = path.slice(key.length+1);\n  }\n\n  // must return some kind of path to be valid else other things will break.\n  if (!path || path.length===0) throw new Error('Invalid Path');\n  \n  TUPLE_RET[0] = target;\n  TUPLE_RET[1] = path;\n  return TUPLE_RET;\n}\n\n/**\n  @private\n\n  Normalizes a path to support older-style property paths beginning with . or\n\n  @function\n  @param {String} path path to normalize\n  @returns {String} normalized path  \n*/\nSC.normalizePath = normalizePath;\n\n/**\n  @private\n\n  Normalizes a target/path pair to reflect that actual target/path that should\n  be observed, etc.  This takes into account passing in global property \n  paths (i.e. a path beginning with a captial letter not defined on the \n  target) and * separators.\n  \n  @param {Object} target\n    The current target.  May be null.\n    \n  @param {String} path\n    A path on the target or a global property path.\n    \n  @returns {Array} a temporary array with the normalized target/path pair.\n*/\nSC.normalizeTuple = function(target, path) {\n  return normalizeTuple(target, normalizePath(path));\n};\n\nSC.normalizeTuple.primitive = normalizeTuple;\n\nSC.getPath = function(root, path) {\n  var hasThis, hasStar, isGlobal;\n  \n  if (!path && 'string'===typeof root) {\n    path = root;\n    root = null;\n  }\n\n  hasStar = path.indexOf('*') > -1;\n\n  // If there is no root and path is a key name, return that\n  // property from the global object.\n  // E.g. getPath('SC') -> SC\n  if (root === null && !hasStar && path.indexOf('.') < 0) { return get(window, path); }\n\n  // detect complicated paths and normalize them\n  path = normalizePath(path);\n  hasThis  = HAS_THIS.test(path);\n  isGlobal = !hasThis && IS_GLOBAL.test(path);\n  if (!root || hasThis || isGlobal || hasStar) {\n    var tuple = normalizeTuple(root, path);\n    root = tuple[0];\n    path = tuple[1];\n  } \n  \n  return getPath(root, path);\n};\n\nSC.setPath = function(root, path, value, tolerant) {\n  var keyName;\n  \n  if (arguments.length===2 && 'string' === typeof root) {\n    value = path;\n    path = root;\n    root = null;\n  }\n  \n  path = normalizePath(path);\n  if (path.indexOf('*')>0) {\n    var tuple = normalizeTuple(root, path);\n    root = tuple[0];\n    path = tuple[1];\n  }\n\n  if (path.indexOf('.') > 0) {\n    keyName = path.slice(path.lastIndexOf('.')+1);\n    path    = path.slice(0, path.length-(keyName.length+1));\n    if (!HAS_THIS.test(path) && IS_GLOBAL_SET.test(path) && path.indexOf('.')<0) {\n      root = window[path]; // special case only works during set...\n    } else if (path !== 'this') {\n      root = SC.getPath(root, path);\n    }\n\n  } else {\n    if (IS_GLOBAL_SET.test(path)) throw new Error('Invalid Path');\n    keyName = path;\n  }\n  \n  if (!keyName || keyName.length===0 || keyName==='*') {\n    throw new Error('Invalid Path');\n  }\n\n  if (!root) {\n    if (tolerant) { return; }\n    else { throw new Error('Object in path '+path+' could not be found or was destroyed.'); }\n  }\n\n  return SC.set(root, keyName, value);\n};\n\n/**\n  Error-tolerant form of SC.setPath. Will not blow up if any part of the\n  chain is undefined, null, or destroyed.\n\n  This is primarily used when syncing bindings, which may try to update after\n  an object has been destroyed.\n*/\nSC.trySetPath = function(root, path, value) {\n  if (arguments.length===2 && 'string' === typeof root) {\n    value = path;\n    path = root;\n    root = null;\n  }\n\n  return SC.setPath(root, path, value, true);\n};\n\n/**\n  Returns true if the provided path is global (e.g., \"MyApp.fooController.bar\")\n  instead of local (\"foo.bar.baz\").\n\n  @param {String} path\n  @returns Boolean\n*/\nSC.isGlobalPath = function(path) {\n  return !HAS_THIS.test(path) && IS_GLOBAL.test(path);\n}\n\n\n});");spade.register("sproutcore-metal/array", "(function(require, exports, __module, ARGV, ENV, __filename){// From: https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/array/map\nif (!Array.prototype.map)\n{\n  Array.prototype.map = function(fun /*, thisp */)\n  {\n    \"use strict\";\n\n    if (this === void 0 || this === null)\n      throw new TypeError();\n\n    var t = Object(this);\n    var len = t.length >>> 0;\n    if (typeof fun !== \"function\")\n      throw new TypeError();\n\n    var res = new Array(len);\n    var thisp = arguments[1];\n    for (var i = 0; i < len; i++)\n    {\n      if (i in t)\n        res[i] = fun.call(thisp, t[i], i, t);\n    }\n\n    return res;\n  };\n}\n\n// From: https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/array/foreach\nif (!Array.prototype.forEach)\n{\n  Array.prototype.forEach = function(fun /*, thisp */)\n  {\n    \"use strict\";\n \n    if (this === void 0 || this === null)\n      throw new TypeError();\n \n    var t = Object(this);\n    var len = t.length >>> 0;\n    if (typeof fun !== \"function\")\n      throw new TypeError();\n\n    var thisp = arguments[1];\n    for (var i = 0; i < len; i++)\n    {\n      if (i in t)\n        fun.call(thisp, t[i], i, t);\n    }\n  };\n}\n\nif (!Array.prototype.indexOf) {\n  Array.prototype.indexOf = function (obj, fromIndex) {\n    if (fromIndex == null) { fromIndex = 0; }\n    else if (fromIndex < 0) { fromIndex = Math.max(0, this.length + fromIndex); }\n    for (var i = fromIndex, j = this.length; i < j; i++) {\n      if (this[i] === obj) { return i; }\n    }\n    return -1;\n  };\n}\n\n});");spade.register("sproutcore-metal/computed", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Metal\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals sc_assert */\n\n\nrequire('sproutcore-metal/core');\nrequire('sproutcore-metal/platform');\nrequire('sproutcore-metal/utils');\nrequire('sproutcore-metal/properties');\n\nvar meta = SC.meta;\nvar guidFor = SC.guidFor;\nvar USE_ACCESSORS = SC.USE_ACCESSORS;\nvar a_slice = Array.prototype.slice;\nvar o_create = SC.platform.create;\nvar o_defineProperty = SC.platform.defineProperty;\n\n// ..........................................................\n// DEPENDENT KEYS\n// \n\n// data structure:\n//  meta.deps = { \n//   'depKey': { \n//     'keyName': count,\n//     __scproto__: SRC_OBJ [to detect clones]\n//     },\n//   __scproto__: SRC_OBJ\n//  }\n\nfunction uniqDeps(obj, depKey) {\n  var m = meta(obj), deps, ret;\n  deps = m.deps;\n  if (!deps) {\n    deps = m.deps = { __scproto__: obj };\n  } else if (deps.__scproto__ !== obj) {\n    deps = m.deps = o_create(deps);\n    deps.__scproto__ = obj;\n  }\n  \n  ret = deps[depKey];\n  if (!ret) {\n    ret = deps[depKey] = { __scproto__: obj };\n  } else if (ret.__scproto__ !== obj) {\n    ret = deps[depKey] = o_create(ret);\n    ret.__scproto__ = obj;\n  }\n  \n  return ret;\n}\n\nfunction addDependentKey(obj, keyName, depKey) {\n  var deps = uniqDeps(obj, depKey);\n  deps[keyName] = (deps[keyName] || 0) + 1;\n  SC.watch(obj, depKey);\n}\n\nfunction removeDependentKey(obj, keyName, depKey) {\n  var deps = uniqDeps(obj, depKey);\n  deps[keyName] = (deps[keyName] || 0) - 1;\n  SC.unwatch(obj, depKey);\n}\n\nfunction addDependentKeys(desc, obj, keyName) {\n  var keys = desc._dependentKeys, \n      len  = keys ? keys.length : 0;\n  for(var idx=0;idx<len;idx++) addDependentKey(obj, keyName, keys[idx]);\n}\n\n// ..........................................................\n// COMPUTED PROPERTY\n//\n\nfunction ComputedProperty(func, opts) {\n  this.func = func;\n  this._cacheable = opts && opts.cacheable;\n  this._dependentKeys = opts && opts.dependentKeys;\n}\n\nSC.ComputedProperty = ComputedProperty;\nComputedProperty.prototype = new SC.Descriptor();\n\nvar CP_DESC = {\n  configurable: true,\n  enumerable:   true,\n  get: function() { return undefined; }, // for when use_accessors is false.\n  set: SC.Descriptor.MUST_USE_SETTER  // for when use_accessors is false\n};\n\nfunction mkCpGetter(keyName, desc) {\n  var cacheable = desc._cacheable, \n      func     = desc.func;\n      \n  if (cacheable) {\n    return function() {\n      var ret, cache = meta(this).cache;\n      if (keyName in cache) return cache[keyName];\n      ret = cache[keyName] = func.call(this, keyName);\n      return ret ;\n    };\n  } else {\n    return function() {\n      return func.call(this, keyName);\n    };\n  }\n}\n\nfunction mkCpSetter(keyName, desc) {\n  var cacheable = desc._cacheable,\n      func      = desc.func;\n      \n  return function(value) {\n    var m = meta(this, cacheable),\n        watched = (m.source===this) && m.watching[keyName]>0,\n        ret, oldSuspended, lastSetValues;\n\n    oldSuspended = desc._suspended;\n    desc._suspended = this;\n\n    watched = watched && m.lastSetValues[keyName]!==guidFor(value);\n    if (watched) {\n      m.lastSetValues[keyName] = guidFor(value);\n      SC.propertyWillChange(this, keyName);\n    }\n    \n    if (cacheable) delete m.cache[keyName];\n    ret = func.call(this, keyName, value);\n    if (cacheable) m.cache[keyName] = ret;\n    if (watched) SC.propertyDidChange(this, keyName);\n    desc._suspended = oldSuspended;\n    return ret;\n  };\n}\n\nvar Cp = ComputedProperty.prototype;\n\n/**\n  Call on a computed property to set it into cacheable mode.  When in this\n  mode the computed property will automatically cache the return value of \n  your function until one of the dependent keys changes.\n\n  @param {Boolean} aFlag optional set to false to disable cacheing\n  @returns {SC.ComputedProperty} receiver\n*/\nCp.cacheable = function(aFlag) {\n  this._cacheable = aFlag!==false;\n  return this;\n};\n\n/**\n  Sets the dependent keys on this computed property.  Pass any number of \n  arguments containing key paths that this computed property depends on.\n  \n  @param {String} path... zero or more property paths\n  @returns {SC.ComputedProperty} receiver\n*/\nCp.property = function() {\n  this._dependentKeys = a_slice.call(arguments);\n  return this;\n};\n\n/** @private - impl descriptor API */\nCp.setup = function(obj, keyName, value) {\n  CP_DESC.get = mkCpGetter(keyName, this);\n  CP_DESC.set = mkCpSetter(keyName, this);\n  o_defineProperty(obj, keyName, CP_DESC);\n  CP_DESC.get = CP_DESC.set = null;\n  addDependentKeys(this, obj, keyName);\n};\n\n/** @private - impl descriptor API */\nCp.teardown = function(obj, keyName) {\n  var keys = this._dependentKeys, \n      len  = keys ? keys.length : 0;\n  for(var idx=0;idx<len;idx++) removeDependentKey(obj, keyName, keys[idx]);\n\n  if (this._cacheable) delete meta(obj).cache[keyName];\n  \n  return null; // no value to restore\n};\n\n/** @private - impl descriptor API */\nCp.didChange = function(obj, keyName) {\n  if (this._cacheable && (this._suspended !== obj)) {\n    delete meta(obj).cache[keyName];\n  }\n};\n\n/** @private - impl descriptor API */\nCp.get = function(obj, keyName) {\n  var ret, cache;\n  \n  if (this._cacheable) {\n    cache = meta(obj).cache;\n    if (keyName in cache) return cache[keyName];\n    ret = cache[keyName] = this.func.call(obj, keyName);\n  } else {\n    ret = this.func.call(obj, keyName);\n  }\n  return ret ;\n};\n\n/** @private - impl descriptor API */\nCp.set = function(obj, keyName, value) {\n  var cacheable = this._cacheable;\n  \n  var m = meta(obj, cacheable),\n      watched = (m.source===obj) && m.watching[keyName]>0,\n      ret, oldSuspended, lastSetValues;\n\n  oldSuspended = this._suspended;\n  this._suspended = obj;\n\n  watched = watched && m.lastSetValues[keyName]!==guidFor(value);\n  if (watched) {\n    m.lastSetValues[keyName] = guidFor(value);\n    SC.propertyWillChange(obj, keyName);\n  }\n  \n  if (cacheable) delete m.cache[keyName];\n  ret = this.func.call(obj, keyName, value);\n  if (cacheable) m.cache[keyName] = ret;\n  if (watched) SC.propertyDidChange(obj, keyName);\n  this._suspended = oldSuspended;\n  return ret;\n};\n\nCp.val = function(obj, keyName) {\n  return meta(obj, false).values[keyName];\n};\n\nif (!SC.platform.hasPropertyAccessors) {\n  Cp.setup = function(obj, keyName, value) {\n    obj[keyName] = undefined; // so it shows up in key iteration\n    addDependentKeys(this, obj, keyName);\n  };\n  \n} else if (!USE_ACCESSORS) {\n  Cp.setup = function(obj, keyName) {\n    // throw exception if not using SC.get() and SC.set() when supported\n    o_defineProperty(obj, keyName, CP_DESC);\n    addDependentKeys(this, obj, keyName);\n  };\n} \n\n/**\n  This helper returns a new property descriptor that wraps the passed \n  computed property function.  You can use this helper to define properties\n  with mixins or via SC.defineProperty().\n  \n  The function you pass will be used to both get and set property values.\n  The function should accept two parameters, key and value.  If value is not\n  undefined you should set the value first.  In either case return the \n  current value of the property.\n  \n  @param {Function} func\n    The computed property function.\n    \n  @returns {SC.ComputedProperty} property descriptor instance\n*/\nSC.computed = function(func) {\n  return new ComputedProperty(func);\n};\n\n});");spade.register("sproutcore-metal/core", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Metal\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals ENV sc_assert */\n\n\nif ('undefined' === typeof SC) {\n/**\n  @namespace\n  @name SC\n  @version 2.0.beta.3\n\n  All SproutCore methods and functions are defined inside of this namespace.\n  You generally should not add new properties to this namespace as it may be\n  overwritten by future versions of SproutCore.\n\n  You can also use the shorthand \"SC\" instead of \"SproutCore\".\n\n  SproutCore-Runtime is a framework that provides core functions for \n  SproutCore including cross-platform functions, support for property \n  observing and objects. Its focus is on small size and performance. You can \n  use this in place of or along-side other cross-platform libraries such as \n  jQuery.\n\n  The core Runtime framework is based on the jQuery API with a number of\n  performance optimizations.\n*/\nSC = {};\n\n// aliases needed to keep minifiers from removing the global context\nif ('undefined' !== typeof window) {\n  window.SC = window.SproutCore = SproutCore = SC;\n}\n\n}\n\n/**\n  @static\n  @type String\n  @default '2.0.beta.3'\n  @constant\n*/\nSC.VERSION = '2.0.beta.3';\n\n/**\n  @static\n  @type Hash\n  @constant\n  \n  Standard environmental variables.  You can define these in a global `ENV`\n  variable before loading SproutCore to control various configuration \n  settings.\n*/\nSC.ENV = 'undefined' === typeof ENV ? {} : ENV;\n\n/**\n  Empty function.  Useful for some operations.\n\n  @returns {Object}\n  @private\n*/\nSC.K = function() { return this; };\n\n/**\n  Define an assertion that will throw an exception if the condition is not \n  met.  SproutCore build tools will remove any calls to sc_assert() when \n  doing a production build.\n  \n  ## Examples\n  \n      #js:\n      \n      // pass a simple Boolean value\n      sc_assert('must pass a valid object', !!obj);\n\n      // pass a function.  If the function returns false the assertion fails\n      // any other return value (including void) will pass.\n      sc_assert('a passed record must have a firstName', function() {\n        if (obj instanceof SC.Record) {\n          return !SC.empty(obj.firstName);\n        }\n      });\n      \n  @static\n  @function\n  @param {String} desc\n    A description of the assertion.  This will become the text of the Error\n    thrown if the assertion fails.\n    \n  @param {Boolean} test\n    Must return true for the assertion to pass.  If you pass a function it\n    will be executed.  If the function returns false an exception will be\n    thrown.\n*/\nwindow.sc_assert = function sc_assert(desc, test) {\n  if ('function' === typeof test) test = test()!==false;\n  if (!test) throw new Error(\"assertion failed: \"+desc);\n};\n\n//if ('undefined' === typeof sc_require) sc_require = SC.K;\nif ('undefined' === typeof require) require = SC.K;\n\n});");spade.register("sproutcore-metal/events", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Metal\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals sc_assert */\n\n\nrequire('sproutcore-metal/core');\nrequire('sproutcore-metal/platform');\nrequire('sproutcore-metal/utils');\n\nvar o_create = SC.platform.create;\nvar meta = SC.meta;\nvar guidFor = SC.guidFor;\nvar array_Slice = Array.prototype.slice;\n\n/**\n  The event system uses a series of nested hashes to store listeners on an\n  object. When a listener is registered, or when an event arrives, these\n  hashes are consulted to determine which target and action pair to invoke.\n\n  The hashes are stored in the object's meta hash, and look like this:\n\n      // Object's meta hash\n      {\n        listeners: {               // variable name: `listenerSet`\n          \"foo:changed\": {         // variable name: `targetSet`\n            [targetGuid]: {        // variable name: `actionSet`\n              [methodGuid]: {      // variable name: `action`\n                target: [Object object],\n                method: [Function function],\n                xform: [Function function]\n              }\n            }\n          }\n        }\n      }\n\n*/\n\nvar metaPath = SC.metaPath;\n\n// Gets the set of all actions, keyed on the guid of each action's\n// method property.\nfunction actionSetFor(obj, eventName, target, writable) {\n  var targetGuid = guidFor(target);\n  return metaPath(obj, ['listeners', eventName, targetGuid], writable);\n}\n\n// Gets the set of all targets, keyed on the guid of each action's\n// target property.\nfunction targetSetFor(obj, eventName) {\n  var listenerSet = meta(obj, false).listeners;\n  if (!listenerSet) { return false; }\n\n  return listenerSet[eventName] || false;\n}\n\n// TODO: This knowledge should really be a part of the\n// meta system.\nvar SKIP_PROPERTIES = { __sc_source__: true };\n\n// For a given target, invokes all of the methods that have\n// been registered as a listener.\nfunction invokeEvents(targetSet, params) {\n  // Iterate through all elements of the target set\n  for(var targetGuid in targetSet) {\n    if (SKIP_PROPERTIES[targetGuid]) { continue; }\n\n    var actionSet = targetSet[targetGuid];\n\n    // Iterate through the elements of the action set\n    for(var methodGuid in actionSet) {\n      if (SKIP_PROPERTIES[methodGuid]) { continue; }\n\n      var action = actionSet[methodGuid]\n      if (!action) { continue; }\n\n      // Extract target and method for each action\n      var method = action.method;\n      var target = action.target;\n\n      // If there is no target, the target is the object\n      // on which the event was fired.\n      if (!target) { target = params[0]; }\n      if ('string' === typeof method) { method = target[method]; }\n\n      // Listeners can provide an `xform` function, which can perform\n      // arbitrary transformations, such as changing the order of\n      // parameters.\n      //\n      // This is primarily used by sproutcore-runtime's observer system, which\n      // provides a higher level abstraction on top of events, including\n      // dynamically looking up current values and passing them into the\n      // registered listener.\n      var xform = action.xform;\n\n      if (xform) {\n        xform(target, method, params);\n      } else {\n        method.apply(target, params);\n      }\n    }\n  }\n}\n\n/**\n  The parameters passed to an event listener are not exactly the\n  parameters passed to an observer. if you pass an xform function, it will\n  be invoked and is able to translate event listener parameters into the form\n  that observers are expecting.\n*/\nfunction addListener(obj, eventName, target, method, xform) {\n  sc_assert(\"You must pass at least an object and event name to SC.addListener\", !!obj && !!eventName);\n\n  if (!method && 'function' === typeof target) {\n    method = target;\n    target = null;\n  }\n\n  var actionSet = actionSetFor(obj, eventName, target, true),\n      methodGuid = guidFor(method), ret;\n\n  if (!actionSet[methodGuid]) {\n    actionSet[methodGuid] = { target: target, method: method, xform: xform };\n  } else {\n    actionSet[methodGuid].xform = xform; // used by observers etc to map params\n  }\n\n  if ('function' === typeof obj.didAddListener) {\n    obj.didAddListener(eventName, target, method);\n  }\n\n  return ret; // return true if this is the first listener.\n}\n\nfunction removeListener(obj, eventName, target, method) {\n  if (!method && 'function'===typeof target) {\n    method = target;\n    target = null;\n  }\n\n  var actionSet = actionSetFor(obj, eventName, target, true),\n      methodGuid = guidFor(method);\n\n  // we can't simply delete this parameter, because if we do, we might\n  // re-expose the property from the prototype chain.\n  if (actionSet && actionSet[methodGuid]) { actionSet[methodGuid] = null; }\n\n  if (obj && 'function'===typeof obj.didRemoveListener) {\n    obj.didRemoveListener(eventName, target, method);\n  }\n}\n\n// returns a list of currently watched events\nfunction watchedEvents(obj) {\n  var listeners = meta(obj, false).listeners, ret = [];\n\n  if (listeners) {\n    for(var eventName in listeners) {\n      if (!SKIP_PROPERTIES[eventName] && listeners[eventName]) {\n        ret.push(eventName);\n      }\n    }\n  }\n  return ret;\n}\n\nfunction sendEvent(obj, eventName) {\n  sc_assert(\"You must pass an object and event name to SC.sendEvent\", !!obj && !!eventName);\n\n  // first give object a chance to handle it\n  if (obj !== SC && 'function' === typeof obj.sendEvent) {\n    obj.sendEvent.apply(obj, array_Slice.call(arguments, 1));\n  }\n\n  var targetSet = targetSetFor(obj, eventName);\n  if (!targetSet) { return false; }\n\n  invokeEvents(targetSet, arguments);\n  return true;\n}\n\nfunction hasListeners(obj, eventName) {\n  var targetSet = targetSetFor(obj, eventName);\n  if (!targetSet) { return false; }\n\n  for(var targetGuid in targetSet) {\n    if (SKIP_PROPERTIES[targetGuid] || !targetSet[targetGuid]) { continue; }\n\n    var actionSet = targetSet[targetGuid];\n\n    for(var methodGuid in actionSet) {\n      if (SKIP_PROPERTIES[methodGuid] || !actionSet[methodGuid]) { continue; }\n      return true; // stop as soon as we find a valid listener\n    }\n  }\n\n  // no listeners!  might as well clean this up so it is faster later.\n  var set = metaPath(obj, ['listeners'], true);\n  set[eventName] = null;\n\n  return false;\n}\n\nfunction listenersFor(obj, eventName) {\n  var targetSet = targetSetFor(obj, eventName), ret = [];\n  if (!targetSet) { return ret; }\n\n  var info;\n  for(var targetGuid in targetSet) {\n    if (SKIP_PROPERTIES[targetGuid] || !targetSet[targetGuid]) { continue; }\n\n    var actionSet = targetSet[targetGuid];\n\n    for(var methodGuid in actionSet) {\n      if (SKIP_PROPERTIES[methodGuid] || !actionSet[methodGuid]) { continue; }\n      info = actionSet[methodGuid];\n      ret.push([info.target, info.method]);\n    }\n  }\n\n  return ret;\n}\n\nSC.addListener = addListener;\nSC.removeListener = removeListener;\nSC.sendEvent = sendEvent;\nSC.hasListeners = hasListeners;\nSC.watchedEvents = watchedEvents;\nSC.listenersFor = listenersFor;\n\n});");spade.register("sproutcore-metal", {"name":"sproutcore-metal","version":"2.0.beta.3","dependencies":{"spade":"~> 1.0.0"}});

spade.register("sproutcore-metal/main", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Metal\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-metal/core');\nrequire('sproutcore-metal/platform');\nrequire('sproutcore-metal/utils');\nrequire('sproutcore-metal/accessors');\nrequire('sproutcore-metal/properties');\nrequire('sproutcore-metal/computed');\nrequire('sproutcore-metal/watching');\nrequire('sproutcore-metal/events');\nrequire('sproutcore-metal/observer');\nrequire('sproutcore-metal/mixin');\n\n});");spade.register("sproutcore-metal/mixin", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-metal/core');\nrequire('sproutcore-metal/accessors');\nrequire('sproutcore-metal/computed');\nrequire('sproutcore-metal/properties');\nrequire('sproutcore-metal/observer');\nrequire('sproutcore-metal/utils');\nrequire('sproutcore-metal/array');\n\nvar Mixin, MixinDelegate, REQUIRED, Alias;\nvar classToString, superClassString;\n\nvar a_map = Array.prototype.map;\nvar EMPTY_META = {}; // dummy for non-writable meta\nvar META_SKIP = { __scproto__: true, __sc_count__: true };\n\nvar o_create = SC.platform.create;\n\nfunction meta(obj, writable) {\n  var m = SC.meta(obj, writable!==false), ret = m.mixins;\n  if (writable===false) return ret || EMPTY_META;\n  \n  if (!ret) {\n    ret = m.mixins = { __scproto__: obj };\n  } else if (ret.__scproto__ !== obj) {\n    ret = m.mixins = o_create(ret);\n    ret.__scproto__ = obj;\n  }\n  return ret;\n}\n\nfunction initMixin(mixin, args) {\n  if (args && args.length > 0) {\n    mixin.mixins = a_map.call(args, function(x) {\n      if (x instanceof Mixin) return x;\n      \n      // Note: Manually setup a primitive mixin here.  This is the only \n      // way to actually get a primitive mixin.  This way normal creation\n      // of mixins will give you combined mixins...\n      var mixin = new Mixin();\n      mixin.properties = x;\n      return mixin;\n    });\n  }\n  return mixin;\n} \n\nvar NATIVES = [Boolean, Object, Number, Array, Date, String];\nfunction isMethod(obj) {\n  if ('function' !== typeof obj || obj.isMethod===false) return false;\n  return NATIVES.indexOf(obj)<0;\n}\n\nfunction mergeMixins(mixins, m, descs, values, base) {\n  var len = mixins.length, idx, mixin, guid, props, value, key, ovalue, concats;\n  \n  function removeKeys(keyName) {\n    delete descs[keyName];\n    delete values[keyName];\n  }\n  \n  for(idx=0;idx<len;idx++) {\n    \n    mixin = mixins[idx];\n    if (!mixin) throw new Error('Null value found in SC.mixin()');\n\n    if (mixin instanceof Mixin) {\n      guid = SC.guidFor(mixin);\n      if (m[guid]) continue;\n      m[guid] = mixin;\n      props = mixin.properties; \n    } else {\n      props = mixin; // apply anonymous mixin properties\n    }\n\n    if (props) {\n      \n      // reset before adding each new mixin to pickup concats from previous\n      concats = values.concatenatedProperties || base.concatenatedProperties;\n      if (props.concatenatedProperties) {\n        concats = concats ? concats.concat(props.concatenatedProperties) : props.concatenatedProperties;\n      }\n\n      for (key in props) {\n        if (!props.hasOwnProperty(key)) continue;\n        value = props[key];\n        if (value instanceof SC.Descriptor) {\n          if (value === REQUIRED && descs[key]) { continue; }\n\n          descs[key]  = value;\n          values[key] = undefined;\n        } else {\n          \n          // impl super if needed...\n          if (isMethod(value)) {\n            ovalue = (descs[key] === SC.SIMPLE_PROPERTY) && values[key];\n            if (!ovalue) ovalue = base[key];\n            if ('function' !== typeof ovalue) ovalue = null;\n            if (ovalue) {\n              var o = value.__sc_observes__, ob = value.__sc_observesBefore__; \n              value = SC.wrap(value, ovalue);\n              value.__sc_observes__ = o;\n              value.__sc_observesBefore__ = ob;\n            }\n          } else if ((concats && concats.indexOf(key)>=0) || key === 'concatenatedProperties') {\n            var baseValue = values[key] || base[key];\n            value = baseValue ? baseValue.concat(value) : SC.makeArray(value);\n          }\n          \n          descs[key]  = SC.SIMPLE_PROPERTY;\n          values[key] = value;\n        }\n      }\n\n      // manually copy toString() because some JS engines do not enumerate it\n      if (props.hasOwnProperty('toString')) {\n        base.toString = props.toString;\n      }\n      \n    } else if (mixin.mixins) {\n      mergeMixins(mixin.mixins, m, descs, values, base);\n      if (mixin._without) mixin._without.forEach(removeKeys);\n    }\n  }\n}\n\nvar defineProperty = SC.defineProperty;\n\nfunction writableReq(obj) {\n  var m = SC.meta(obj), req = m.required;\n  if (!req || (req.__scproto__ !== obj)) {\n    req = m.required = req ? o_create(req) : { __sc_count__: 0 };\n    req.__scproto__ = obj;\n  }\n  return req;\n}\n\nfunction getObserverPaths(value) {\n  return ('function' === typeof value) && value.__sc_observes__;\n}\n\nfunction getBeforeObserverPaths(value) {\n  return ('function' === typeof value) && value.__sc_observesBefore__;\n}\n\nSC._mixinBindings = function(obj, key, value, m) {\n  return value;\n};\n\nfunction applyMixin(obj, mixins, partial) {\n  var descs = {}, values = {}, m = SC.meta(obj), req = m.required;\n  var key, willApply, didApply, value, desc;\n  \n  var mixinBindings = SC._mixinBindings;\n  \n  mergeMixins(mixins, meta(obj), descs, values, obj);\n\n  if (MixinDelegate.detect(obj)) {\n    willApply = values.willApplyProperty || obj.willApplyProperty;\n    didApply  = values.didApplyProperty || obj.didApplyProperty;\n  }\n\n  for(key in descs) {\n    if (!descs.hasOwnProperty(key)) continue;\n    \n    desc = descs[key];\n    value = values[key];\n     \n    if (desc === REQUIRED) {\n      if (!(key in obj)) {\n        if (!partial) throw new Error('Required property not defined: '+key);\n        \n        // for partial applies add to hash of required keys\n        req = writableReq(obj);\n        req.__sc_count__++;\n        req[key] = true;\n      }\n      \n    } else {\n      \n      while (desc instanceof Alias) {\n        \n        var altKey = desc.methodName; \n        if (descs[altKey]) {\n          value = values[altKey];\n          desc  = descs[altKey];\n        } else if (m.descs[altKey]) {\n          desc  = m.descs[altKey];\n          value = desc.val(obj, altKey);\n        } else {\n          value = obj[altKey];\n          desc  = SC.SIMPLE_PROPERTY;\n        }\n      }\n      \n      if (willApply) willApply.call(obj, key);\n      \n      var observerPaths = getObserverPaths(value),\n          curObserverPaths = observerPaths && getObserverPaths(obj[key]),\n          beforeObserverPaths = getBeforeObserverPaths(value),\n          curBeforeObserverPaths = beforeObserverPaths && getBeforeObserverPaths(obj[key]),\n          len, idx;\n          \n      if (curObserverPaths) {\n        len = curObserverPaths.length;\n        for(idx=0;idx<len;idx++) {\n          SC.removeObserver(obj, curObserverPaths[idx], null, key);\n        }\n      }\n\n      if (curBeforeObserverPaths) {\n        len = curBeforeObserverPaths.length;\n        for(idx=0;idx<len;idx++) {\n          SC.removeBeforeObserver(obj, curBeforeObserverPaths[idx], null,key);\n        }\n      }\n\n      // TODO: less hacky way for sproutcore-runtime to add bindings.\n      value = mixinBindings(obj, key, value, m);\n      \n      defineProperty(obj, key, desc, value);\n      \n      if (observerPaths) {\n        len = observerPaths.length;\n        for(idx=0;idx<len;idx++) {\n          SC.addObserver(obj, observerPaths[idx], null, key);\n        }\n      }\n\n      if (beforeObserverPaths) {\n        len = beforeObserverPaths.length;\n        for(idx=0;idx<len;idx++) {\n          SC.addBeforeObserver(obj, beforeObserverPaths[idx], null, key);\n        }\n      }\n      \n      if (req && req[key]) {\n        req = writableReq(obj);\n        req.__sc_count__--;\n        req[key] = false;\n      }\n\n      if (didApply) didApply.call(obj, key);\n\n    }\n  }\n  \n  // Make sure no required attrs remain\n  if (!partial && req && req.__sc_count__>0) {\n    var keys = [];\n    for(key in req) {\n      if (META_SKIP[key]) continue;\n      keys.push(key);\n    }\n    throw new Error('Required properties not defined: '+keys.join(','));\n  }\n  return obj;\n}\n\nSC.mixin = function(obj) {\n  var args = Array.prototype.slice.call(arguments, 1);\n  return applyMixin(obj, args, false);\n};\n\n\nMixin = function() { return initMixin(this, arguments); };\n\nMixin._apply = applyMixin;\n\nMixin.applyPartial = function(obj) {\n  var args = Array.prototype.slice.call(arguments, 1);\n  return applyMixin(obj, args, true);\n};\n\nMixin.create = function() {\n  classToString.processed = false;\n  var M = this;\n  return initMixin(new M(), arguments);\n};\n\nMixin.prototype.reopen = function() {\n  \n  var mixin, tmp;\n  \n  if (this.properties) {\n    mixin = Mixin.create();\n    mixin.properties = this.properties;\n    delete this.properties;\n    this.mixins = [mixin];\n  }\n  \n  var len = arguments.length, mixins = this.mixins, idx;\n\n  for(idx=0;idx<len;idx++) {\n    mixin = arguments[idx];\n    if (mixin instanceof Mixin) {\n      mixins.push(mixin);\n    } else {\n      tmp = Mixin.create();\n      tmp.properties = mixin;\n      mixins.push(tmp);\n    }\n  }\n  \n  return this;\n};\n\nvar TMP_ARRAY = [];\nMixin.prototype.apply = function(obj) {\n  TMP_ARRAY.length=0;\n  TMP_ARRAY[0] = this;\n  return applyMixin(obj, TMP_ARRAY, false);\n};\n\nMixin.prototype.applyPartial = function(obj) {\n  TMP_ARRAY.length=0;\n  TMP_ARRAY[0] = this;\n  return applyMixin(obj, TMP_ARRAY, true);\n};\n\nfunction _detect(curMixin, targetMixin, seen) {\n  var guid = SC.guidFor(curMixin);\n\n  if (seen[guid]) return false;\n  seen[guid] = true;\n  \n  if (curMixin === targetMixin) return true;\n  var mixins = curMixin.mixins, loc = mixins ? mixins.length : 0;\n  while(--loc >= 0) {\n    if (_detect(mixins[loc], targetMixin, seen)) return true;\n  }\n  return false;\n}\n\nMixin.prototype.detect = function(obj) {\n  if (!obj) return false;\n  if (obj instanceof Mixin) return _detect(obj, this, {});\n  return !!meta(obj, false)[SC.guidFor(this)];\n};\n\nMixin.prototype.without = function() {\n  var ret = new Mixin(this);\n  ret._without = Array.prototype.slice.call(arguments);\n  return ret;\n};\n\nfunction _keys(ret, mixin, seen) {\n  if (seen[SC.guidFor(mixin)]) return;\n  seen[SC.guidFor(mixin)] = true;\n  \n  if (mixin.properties) {\n    var props = mixin.properties;\n    for(var key in props) {\n      if (props.hasOwnProperty(key)) ret[key] = true;\n    }\n  } else if (mixin.mixins) {\n    mixin.mixins.forEach(function(x) { _keys(ret, x, seen); });\n  }\n}\n\nMixin.prototype.keys = function() {\n  var keys = {}, seen = {}, ret = [];\n  _keys(keys, this, seen);\n  for(var key in keys) {\n    if (keys.hasOwnProperty(key)) ret.push(key);\n  }\n  return ret;\n};\n\n/** @private - make Mixin's have nice displayNames */\n\nvar NAME_KEY = SC.GUID_KEY+'_name';\n\nfunction processNames(paths, root, seen) {\n  var idx = paths.length;\n  for(var key in root) {\n    if (!root.hasOwnProperty || !root.hasOwnProperty(key)) continue;\n    var obj = root[key];\n    paths[idx] = key;\n\n    if (obj && obj.toString === classToString) {\n      obj[NAME_KEY] = paths.join('.');\n    } else if (key==='SC' || (SC.Namespace && obj instanceof SC.Namespace)) {\n      if (seen[SC.guidFor(obj)]) continue;\n      seen[SC.guidFor(obj)] = true;\n      processNames(paths, obj, seen);\n    }\n\n  }\n  paths.length = idx; // cut out last item\n}\n\nsuperClassString = function(mixin) {\n  var superclass = mixin.superclass;\n  if (superclass) {\n    if (superclass[NAME_KEY]) { return superclass[NAME_KEY] }\n    else { return superClassString(superclass); }\n  } else {\n    return;\n  }\n}\n\nclassToString = function() {\n  if (!this[NAME_KEY] && !classToString.processed) {\n    classToString.processed = true;\n    processNames([], window, {});\n  }\n\n  if (this[NAME_KEY]) {\n    return this[NAME_KEY];\n  } else {\n    var str = superClassString(this);\n    if (str) {\n      return \"(subclass of \" + str + \")\";\n    } else {\n      return \"(unknown mixin)\";\n    }\n  }\n\n  return this[NAME_KEY] || \"(unknown mixin)\";\n};\n\nMixin.prototype.toString = classToString;\n\n// returns the mixins currently applied to the specified object\n// TODO: Make SC.mixin\nMixin.mixins = function(obj) {\n  var ret = [], mixins = meta(obj, false), key, mixin;\n  for(key in mixins) {\n    if (META_SKIP[key]) continue;\n    mixin = mixins[key];\n    \n    // skip primitive mixins since these are always anonymous\n    if (!mixin.properties) ret.push(mixins[key]);\n  }\n  return ret;\n};\n\nREQUIRED = new SC.Descriptor();\nREQUIRED.toString = function() { return '(Required Property)'; };\n\nSC.required = function() {\n  return REQUIRED;\n};\n\nAlias = function(methodName) {\n  this.methodName = methodName;\n};\nAlias.prototype = new SC.Descriptor();\n\nSC.alias = function(methodName) {\n  return new Alias(methodName);\n};\n\nSC.Mixin = Mixin;\n\nMixinDelegate = Mixin.create({\n\n  willApplyProperty: SC.required(),\n  didApplyProperty:  SC.required()\n  \n});\n\nSC.MixinDelegate = MixinDelegate;\n\n\n// ..........................................................\n// OBSERVER HELPER\n// \n\nSC.observer = function(func) {\n  var paths = Array.prototype.slice.call(arguments, 1);\n  func.__sc_observes__ = paths;\n  return func;\n};\n\nSC.beforeObserver = function(func) {\n  var paths = Array.prototype.slice.call(arguments, 1);\n  func.__sc_observesBefore__ = paths;\n  return func;\n};\n\n\n\n\n\n\n\n});");spade.register("sproutcore-metal/observer", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Metal\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals sc_assert */\n\n\nrequire('sproutcore-metal/core');\nrequire('sproutcore-metal/platform');\nrequire('sproutcore-metal/utils');\nrequire('sproutcore-metal/accessors');\n\nvar AFTER_OBSERVERS = ':change';\nvar BEFORE_OBSERVERS = ':before';\nvar guidFor = SC.guidFor;\nvar normalizePath = SC.normalizePath;\n\nvar suspended = 0;\nvar array_Slice = Array.prototype.slice;\n\nvar ObserverSet = function(iterateable) {\n  this.set = {};\n  if (iterateable) { this.array = []; }\n}\n\nObserverSet.prototype.add = function(target, name) {\n  var set = this.set, guid = SC.guidFor(target), array;\n\n  if (!set[guid]) { set[guid] = {}; }\n  set[guid][name] = true;\n  if (array = this.array) {\n    array.push([target, name]);\n  }\n};\n\nObserverSet.prototype.contains = function(target, name) {\n  var set = this.set, guid = SC.guidFor(target), nameSet = set[guid];\n  return nameSet && nameSet[name];\n};\n\nObserverSet.prototype.empty = function() {\n  this.set = {};\n  this.array = [];\n};\n\nObserverSet.prototype.forEach = function(fn) {\n  var q = this.array;\n  this.empty();\n  q.forEach(function(item) {\n    fn(item[0], item[1]);\n  });\n};\n\nvar queue = new ObserverSet(true), beforeObserverSet = new ObserverSet();\n\nfunction notifyObservers(obj, eventName, forceNotification) {\n  if (suspended && !forceNotification) {\n\n    // if suspended add to the queue to send event later - but only send \n    // event once.\n    if (!queue.contains(obj, eventName)) {\n      queue.add(obj, eventName);\n    }\n\n  } else {\n    SC.sendEvent(obj, eventName);\n  }\n}\n\nfunction flushObserverQueue() {\n  beforeObserverSet.empty();\n\n  if (!queue || queue.array.length===0) return ;\n  queue.forEach(function(target, event){ SC.sendEvent(target, event); });\n}\n\nSC.beginPropertyChanges = function() {\n  suspended++;\n  return this;\n};\n\nSC.endPropertyChanges = function() {\n  suspended--;\n  if (suspended<=0) flushObserverQueue();\n};\n\nfunction changeEvent(keyName) {\n  return keyName+AFTER_OBSERVERS;\n}\n\nfunction beforeEvent(keyName) {\n  return keyName+BEFORE_OBSERVERS;\n}\n\nfunction changeKey(eventName) {\n  return eventName.slice(0, -7);\n}\n\nfunction beforeKey(eventName) {\n  return eventName.slice(0, -7);\n}\n\nfunction xformForArgs(args) {\n  return function (target, method, params) {\n    var obj = params[0], keyName = changeKey(params[1]), val;\n    if (method.length>2) val = SC.getPath(obj, keyName);\n    args.unshift(obj, keyName, val);\n    method.apply(target, args);\n  }\n}\n\nvar xformChange = xformForArgs([]);\n\nfunction xformBefore(target, method, params) {\n  var obj = params[0], keyName = beforeKey(params[1]), val;\n  if (method.length>2) val = SC.getPath(obj, keyName);\n  method.call(target, obj, keyName, val);\n}\n\nSC.addObserver = function(obj, path, target, method) {\n  path = normalizePath(path);\n\n  var xform;\n  if (arguments.length > 4) {\n    var args = array_Slice.call(arguments, 4);\n    xform = xformForArgs(args);\n  } else {\n    xform = xformChange;\n  }\n  SC.addListener(obj, changeEvent(path), target, method, xform);\n  SC.watch(obj, path);\n  return this;\n};\n\n/** @private */\nSC.observersFor = function(obj, path) {\n  return SC.listenersFor(obj, changeEvent(path));\n};\n\nSC.removeObserver = function(obj, path, target, method) {\n  path = normalizePath(path);\n  SC.unwatch(obj, path);\n  SC.removeListener(obj, changeEvent(path), target, method);\n  return this;\n};\n\nSC.addBeforeObserver = function(obj, path, target, method) {\n  path = normalizePath(path);\n  SC.addListener(obj, beforeEvent(path), target, method, xformBefore);\n  SC.watch(obj, path);\n  return this;\n};\n\n/** @private */\nSC.beforeObserversFor = function(obj, path) {\n  return SC.listenersFor(obj, beforeEvent(path));\n};\n\nSC.removeBeforeObserver = function(obj, path, target, method) {\n  path = normalizePath(path);\n  SC.unwatch(obj, path);\n  SC.removeListener(obj, beforeEvent(path), target, method);\n  return this;\n};\n\n/** @private */\nSC.notifyObservers = function(obj, keyName) {\n  notifyObservers(obj, changeEvent(keyName));\n};\n\n/** @private */\nSC.notifyBeforeObservers = function(obj, keyName) {\n  var guid, set, forceNotification = false;\n\n  if (suspended) {\n    if (!beforeObserverSet.contains(obj, keyName)) {\n      beforeObserverSet.add(obj, keyName);\n      forceNotification = true;\n    } else {\n      return;\n    }\n  }\n\n  notifyObservers(obj, beforeEvent(keyName), forceNotification);\n};\n\n\n});");spade.register("sproutcore-metal/platform", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Metal\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals sc_assert */\n\n\nrequire('sproutcore-metal/core');\n\n/**\n  @class\n\n  Platform specific methods and feature detectors needed by the framework.\n*/\nvar platform = SC.platform = {} ;\n\n/**\n  Identical to Object.create().  Implements if not available natively.\n*/\nplatform.create = Object.create;\n\nif (!platform.create) {\n  var O_ctor = function() {},\n      O_proto = O_ctor.prototype;\n\n  platform.create = function(obj, descs) {\n    O_ctor.prototype = obj;\n    obj = new O_ctor();\n    O_ctor.prototype = O_proto;\n\n    if (descs !== undefined) {\n      for(var key in descs) {\n        if (!descs.hasOwnProperty(key)) continue;\n        platform.defineProperty(obj, key, descs[key]);\n      }\n    }\n\n    return obj;\n  };\n\n  platform.create.isSimulated = true;\n}\n\nvar defineProperty = Object.defineProperty, canRedefineProperties, canDefinePropertyOnDOM;\n\n// Catch IE8 where Object.defineProperty exists but only works on DOM elements\nif (defineProperty) {\n  try {\n    defineProperty({}, 'a',{get:function(){}});\n  } catch (e) {\n    defineProperty = null;\n  }\n}\n\nif (defineProperty) {\n  // Detects a bug in Android <3.2 where you cannot redefine a property using\n  // Object.defineProperty once accessors have already been set.\n  canRedefineProperties = (function() {\n    var obj = {};\n\n    defineProperty(obj, 'a', {\n      configurable: true,\n      enumerable: true,\n      get: function() { },\n      set: function() { }\n    });\n\n    defineProperty(obj, 'a', {\n      configurable: true,\n      enumerable: true,\n      writable: true,\n      value: true\n    });\n\n    return obj.a === true;\n  })();\n\n  // This is for Safari 5.0, which supports Object.defineProperty, but not\n  // on DOM nodes.\n\n  canDefinePropertyOnDOM = (function(){\n    try {\n      defineProperty(document.body, 'definePropertyOnDOM', {});\n      return true;\n    } catch(e) { }\n\n    return false;\n  })();\n\n  if (!canRedefineProperties) {\n    defineProperty = null;\n  } else if (!canDefinePropertyOnDOM) {\n    defineProperty = function(obj, keyName, desc){\n      var isNode;\n\n      if (typeof Node === \"object\") {\n        isNode = obj instanceof Node;\n      } else {\n        isNode = typeof obj === \"object\" && typeof obj.nodeType === \"number\" && typeof obj.nodeName === \"string\";\n      }\n\n      if (isNode) {\n        // TODO: Should we have a warning here?\n        return (obj[keyName] = desc.value);\n      } else {\n        return Object.defineProperty(obj, keyName, desc);\n      }\n    };\n  }\n}\n\n/**\n  Identical to Object.defineProperty().  Implements as much functionality\n  as possible if not available natively.\n\n  @param {Object} obj The object to modify\n  @param {String} keyName property name to modify\n  @param {Object} desc descriptor hash\n  @returns {void}\n*/\nplatform.defineProperty = defineProperty;\n\n/**\n  Set to true if the platform supports native getters and setters.\n*/\nplatform.hasPropertyAccessors = true;\n\nif (!platform.defineProperty) {\n  platform.hasPropertyAccessors = false;\n\n  platform.defineProperty = function(obj, keyName, desc) {\n    sc_assert(\"property descriptor cannot have `get` or `set` on this platform\", !desc.get && !desc.set);\n    obj[keyName] = desc.value;\n  };\n\n  platform.defineProperty.isSimulated = true;\n}\n\n});");spade.register("sproutcore-metal/properties", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Metal\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals sc_assert */\n\n\nrequire('sproutcore-metal/core');\nrequire('sproutcore-metal/platform');\nrequire('sproutcore-metal/utils');\nrequire('sproutcore-metal/accessors');\n\nvar USE_ACCESSORS = SC.USE_ACCESSORS;\nvar GUID_KEY = SC.GUID_KEY;\nvar META_KEY = SC.META_KEY;\nvar meta = SC.meta;\nvar o_create = SC.platform.create;\nvar o_defineProperty = SC.platform.defineProperty;\nvar SIMPLE_PROPERTY, WATCHED_PROPERTY;\n\n// ..........................................................\n// DESCRIPTOR\n// \n\nvar SIMPLE_DESC = {\n  writable: true,\n  configurable: true,\n  enumerable: true,\n  value: null\n};\n\n/**\n  @private\n  @constructor\n  \n  Objects of this type can implement an interface to responds requests to\n  get and set.  The default implementation handles simple properties.\n  \n  You generally won't need to create or subclass this directly.\n*/\nvar Dc = SC.Descriptor = function() {};\n\nvar setup = Dc.setup = function(obj, keyName, value) {\n  SIMPLE_DESC.value = value;\n  o_defineProperty(obj, keyName, SIMPLE_DESC);\n  SIMPLE_DESC.value = null;\n};\n\nvar Dp = SC.Descriptor.prototype;\n\n/**\n  Called whenever we want to set the property value.  Should set the value \n  and return the actual set value (which is usually the same but may be \n  different in the case of computed properties.)\n  \n  @param {Object} obj\n    The object to set the value on.\n    \n  @param {String} keyName\n    The key to set.\n    \n  @param {Object} value\n    The new value\n    \n  @returns {Object} value actual set value\n*/\nDp.set = function(obj, keyName, value) {\n  obj[keyName] = value;\n  return value;\n};\n\n/**\n  Called whenever we want to get the property value.  Should retrieve the \n  current value.\n  \n  @param {Object} obj\n    The object to get the value on.\n    \n  @param {String} keyName\n    The key to retrieve\n    \n  @returns {Object} the current value\n*/\nDp.get = function(obj, keyName) {\n  return w_get(obj, keyName, obj);\n};\n\n/**\n  This is called on the descriptor to set it up on the object.  The \n  descriptor is responsible for actually defining the property on the object\n  here.\n  \n  The passed `value` is the transferValue returned from any previous \n  descriptor.\n  \n  @param {Object} obj\n    The object to set the value on.\n    \n  @param {String} keyName\n    The key to set.\n    \n  @param {Object} value\n    The transfer value from any previous descriptor.\n  \n  @returns {void}\n*/\nDp.setup = setup;\n\n/**\n  This is called on the descriptor just before another descriptor takes its\n  place.  This method should at least return the 'transfer value' of the \n  property - which is the value you want to passed as the input to the new\n  descriptor's setup() method.  \n  \n  It is not generally necessary to actually 'undefine' the property as a new\n  property descriptor will redefine it immediately after this method returns.\n  \n  @param {Object} obj\n    The object to set the value on.\n    \n  @param {String} keyName\n    The key to set.\n    \n  @returns {Object} transfer value\n*/\nDp.teardown = function(obj, keyName) {\n  return obj[keyName];\n};\n\nDp.val = function(obj, keyName) {\n  return obj[keyName];\n};\n\n// ..........................................................\n// SIMPLE AND WATCHED PROPERTIES\n// \n\n// if accessors are disabled for the app then this will act as a guard when\n// testing on browsers that do support accessors.  It will throw an exception\n// if you do foo.bar instead of SC.get(foo, 'bar')\n\nif (!USE_ACCESSORS) {\n  SC.Descriptor.MUST_USE_GETTER = function() {\n    sc_assert('Must use SC.get() to access this property', false);\n  };\n\n  SC.Descriptor.MUST_USE_SETTER = function() {\n    if (this.isDestroyed) {\n      sc_assert('You cannot set observed properties on destroyed objects', false);\n    } else {\n      sc_assert('Must use SC.set() to access this property', false);\n    }\n  };\n}\n\nvar WATCHED_DESC = {\n  configurable: true,\n  enumerable:   true,\n  set: SC.Descriptor.MUST_USE_SETTER\n};\n\nfunction w_get(obj, keyName, values) {\n  values = values || meta(obj, false).values;\n\n  if (values) {\n    var ret = values[keyName];\n    if (ret !== undefined) { return ret; }\n    if (obj.unknownProperty) { return obj.unknownProperty(keyName); }\n  }\n\n}\n\nfunction w_set(obj, keyName, value) {\n  var m = meta(obj), watching;\n  \n  watching = m.watching[keyName]>0 && value!==m.values[keyName];  \n  if (watching) SC.propertyWillChange(obj, keyName);\n  m.values[keyName] = value;\n  if (watching) SC.propertyDidChange(obj, keyName);\n  return value;\n}\n\nvar WATCHED_GETTERS = {};\nfunction mkWatchedGetter(keyName) {\n  var ret = WATCHED_GETTERS[keyName];\n  if (!ret) {\n    ret = WATCHED_GETTERS[keyName] = function() { \n      return w_get(this, keyName); \n    };\n  }\n  return ret;\n}\n\nvar WATCHED_SETTERS = {};\nfunction mkWatchedSetter(keyName) {\n  var ret = WATCHED_SETTERS[keyName];\n  if (!ret) {\n    ret = WATCHED_SETTERS[keyName] = function(value) {\n      return w_set(this, keyName, value);\n    };\n  }\n  return ret;\n}\n\n/**\n  @private \n  \n  Private version of simple property that invokes property change callbacks.\n*/\nWATCHED_PROPERTY = new SC.Descriptor();\n\nif (SC.platform.hasPropertyAccessors) {\n  WATCHED_PROPERTY.get = w_get ;\n  WATCHED_PROPERTY.set = w_set ;\n\n  if (USE_ACCESSORS) {\n    WATCHED_PROPERTY.setup = function(obj, keyName, value) {\n      WATCHED_DESC.get = mkWatchedGetter(keyName);\n      WATCHED_DESC.set = mkWatchedSetter(keyName);\n      o_defineProperty(obj, keyName, WATCHED_DESC);\n      WATCHED_DESC.get = WATCHED_DESC.set = null;\n      if (value !== undefined) meta(obj).values[keyName] = value;\n    };\n\n  } else {\n    WATCHED_PROPERTY.setup = function(obj, keyName, value) {\n      WATCHED_DESC.get = mkWatchedGetter(keyName);\n      o_defineProperty(obj, keyName, WATCHED_DESC);\n      WATCHED_DESC.get = null;\n      if (value !== undefined) meta(obj).values[keyName] = value;\n    };\n  }\n\n  WATCHED_PROPERTY.teardown = function(obj, keyName) {\n    var ret = meta(obj).values[keyName];\n    delete meta(obj).values[keyName];\n    return ret;\n  };\n\n// NOTE: if platform does not have property accessors then we just have to \n// set values and hope for the best.  You just won't get any warnings...\n} else {\n  \n  WATCHED_PROPERTY.set = function(obj, keyName, value) {\n    var m = meta(obj), watching;\n\n    watching = m.watching[keyName]>0 && value!==obj[keyName];  \n    if (watching) SC.propertyWillChange(obj, keyName);\n    obj[keyName] = value;\n    if (watching) SC.propertyDidChange(obj, keyName);\n    return value;\n  };\n  \n}\n\n/**\n  The default descriptor for simple properties.  Pass as the third argument\n  to SC.defineProperty() along with a value to set a simple value.\n  \n  @static\n  @default SC.Descriptor\n*/\nSC.SIMPLE_PROPERTY = new SC.Descriptor();\nSIMPLE_PROPERTY = SC.SIMPLE_PROPERTY;\n\nSIMPLE_PROPERTY.unwatched = WATCHED_PROPERTY.unwatched = SIMPLE_PROPERTY;\nSIMPLE_PROPERTY.watched   = WATCHED_PROPERTY.watched   = WATCHED_PROPERTY;\n\n\n// ..........................................................\n// DEFINING PROPERTIES API\n// \n\nfunction hasDesc(descs, keyName) {\n  if (keyName === 'toString') return 'function' !== typeof descs.toString;\n  else return !!descs[keyName];\n}\n\n/**\n  @private\n\n  NOTE: This is a low-level method used by other parts of the API.  You almost\n  never want to call this method directly.  Instead you should use SC.mixin()\n  to define new properties.\n  \n  Defines a property on an object.  This method works much like the ES5 \n  Object.defineProperty() method except that it can also accept computed \n  properties and other special descriptors. \n\n  Normally this method takes only three parameters.  However if you pass an\n  instance of SC.Descriptor as the third param then you can pass an optional\n  value as the fourth parameter.  This is often more efficient than creating\n  new descriptor hashes for each property.\n  \n  ## Examples\n\n      // ES5 compatible mode\n      SC.defineProperty(contact, 'firstName', {\n        writable: true,\n        configurable: false,\n        enumerable: true,\n        value: 'Charles'\n      });\n      \n      // define a simple property\n      SC.defineProperty(contact, 'lastName', SC.SIMPLE_PROPERTY, 'Jolley');\n      \n      // define a computed property\n      SC.defineProperty(contact, 'fullName', SC.computed(function() {\n        return this.firstName+' '+this.lastName;\n      }).property('firstName', 'lastName').cacheable());\n*/\nSC.defineProperty = function(obj, keyName, desc, val) {\n  var m = meta(obj, false), descs = m.descs, watching = m.watching[keyName]>0;\n\n  if (val === undefined) {\n    val = hasDesc(descs, keyName) ? descs[keyName].teardown(obj, keyName) : obj[keyName];\n  } else if (hasDesc(descs, keyName)) {\n    descs[keyName].teardown(obj, keyName);\n  }\n\n  if (!desc) desc = SIMPLE_PROPERTY;\n  \n  if (desc instanceof SC.Descriptor) {\n    m = meta(obj, true);\n    descs = m.descs;\n    \n    desc = (watching ? desc.watched : desc.unwatched) || desc; \n    descs[keyName] = desc;\n    desc.setup(obj, keyName, val, watching);\n\n  // compatibility with ES5\n  } else {\n    if (descs[keyName]) meta(obj).descs[keyName] = null;\n    o_defineProperty(obj, keyName, desc);\n  }\n  \n  return this;\n};\n\n/**\n  Creates a new object using the passed object as its prototype.  On browsers\n  that support it, this uses the built in Object.create method.  Else one is\n  simulated for you.\n  \n  This method is a better choice thant Object.create() because it will make \n  sure that any observers, event listeners, and computed properties are \n  inherited from the parent as well.\n  \n  @param {Object} obj\n    The object you want to have as the prototype.\n    \n  @returns {Object} the newly created object\n*/\nSC.create = function(obj, props) {\n  var ret = o_create(obj, props);\n  if (GUID_KEY in ret) SC.generateGuid(ret, 'sc');\n  if (META_KEY in ret) SC.rewatch(ret); // setup watch chains if needed.\n  return ret;\n};\n\n/**\n  @private\n\n  Creates a new object using the passed object as its prototype.  This method\n  acts like `SC.create()` in every way except that bindings, observers, and\n  computed properties will be activated on the object.  \n  \n  The purpose of this method is to build an object for use in a prototype\n  chain. (i.e. to be set as the `prototype` property on a constructor \n  function).  Prototype objects need to inherit bindings, observers and\n  other configuration so they pass it on to their children.  However since\n  they are never 'live' objects themselves, they should not fire or make\n  other changes when various properties around them change.\n  \n  You should use this method anytime you want to create a new object for use\n  in a prototype chain.\n\n  @param {Object} obj\n    The base object.\n\n  @param {Object} hash\n    Optional hash of properties to define on the object.\n\n  @returns {Object} new object\n*/\nSC.createPrototype = function(obj, props) {\n  var ret = o_create(obj, props);\n  meta(ret, true).proto = ret;\n  if (GUID_KEY in ret) SC.generateGuid(ret, 'sc');\n  if (META_KEY in ret) SC.rewatch(ret); // setup watch chains if needed.\n  return ret;\n};\n  \n\n/**\n  Tears down the meta on an object so that it can be garbage collected.\n  Multiple calls will have no effect.\n  \n  @param {Object} obj  the object to destroy\n  @returns {void}\n*/\nSC.destroy = function(obj) {\n  if (obj[META_KEY]) obj[META_KEY] = null; \n};\n\n\n});");spade.register("sproutcore-metal/utils", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Metal\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-metal/core');\nrequire('sproutcore-metal/platform');\n    \n// ..........................................................\n// GUIDS\n// \n\n// Used for guid generation...\nvar GUID_KEY = '__sc'+ (+ new Date());\nvar uuid, numberCache, stringCache;\n\nuuid         = 0;\nnumberCache  = [];\nstringCache  = {};\n\nvar GUID_DESC = {\n  configurable: true,\n  writable: true,\n  enumerable: false\n};\n\nvar o_defineProperty = SC.platform.defineProperty;\nvar o_create = SC.platform.create;\n\n/**\n  @private\n  @static\n  @type String\n  @constant\n\n  A unique key used to assign guids and other private metadata to objects.\n  If you inspect an object in your browser debugger you will often see these.\n  They can be safely ignored.\n\n  On browsers that support it, these properties are added with enumeration \n  disabled so they won't show up when you iterate over your properties.\n*/\nSC.GUID_KEY = GUID_KEY;\n\n/**\n  @private\n\n  Generates a new guid, optionally saving the guid to the object that you\n  pass in.  You will rarely need to use this method.  Instead you should\n  call SC.guidFor(obj), which return an existing guid if available.\n\n  @param {Object} obj\n    Optional object the guid will be used for.  If passed in, the guid will\n    be saved on the object and reused whenever you pass the same object \n    again.\n\n    If no object is passed, just generate a new guid.\n\n  @param {String} prefix\n    Optional prefix to place in front of the guid.  Useful when you want to\n    separate the guid into separate namespaces.\n\n  @returns {String} the guid\n*/\nSC.generateGuid = function(obj, prefix) {\n  if (!prefix) prefix = 'sc';\n  var ret = (prefix + (uuid++));\n  if (obj) {\n    GUID_DESC.value = ret;\n    o_defineProperty(obj, GUID_KEY, GUID_DESC);\n    GUID_DESC.value = null;\n  }\n\n  return ret ;\n};\n\n/**\n  @private\n\n  Returns a unique id for the object.  If the object does not yet have\n  a guid, one will be assigned to it.  You can call this on any object,\n  SC.Object-based or not, but be aware that it will add a _guid property.\n\n  You can also use this method on DOM Element objects.\n\n  @method\n  @param obj {Object} any object, string, number, Element, or primitive\n  @returns {String} the unique guid for this instance.\n*/\nSC.guidFor = function(obj) {\n\n  // special cases where we don't want to add a key to object\n  if (obj === undefined) return \"(undefined)\";\n  if (obj === null) return \"(null)\";\n\n  var cache, ret;\n  var type = typeof obj;\n\n  // Don't allow prototype changes to String etc. to change the guidFor\n  switch(type) {\n    case 'number':\n      ret = numberCache[obj];\n      if (!ret) ret = numberCache[obj] = 'nu'+obj;\n      return ret;\n\n    case 'string':\n      ret = stringCache[obj];\n      if (!ret) ret = stringCache[obj] = 'st'+(uuid++);\n      return ret;\n\n    case 'boolean':\n      return obj ? '(true)' : '(false)';\n\n    default:\n      if (obj[GUID_KEY]) return obj[GUID_KEY];\n      if (obj === Object) return '(Object)';\n      if (obj === Array)  return '(Array)';\n      return SC.generateGuid(obj, 'sc');\n  }\n};\n\n\n// ..........................................................\n// META\n// \n\nvar META_DESC = {\n  writable:    true,\n  configurable: false,\n  enumerable:  false,\n  value: null\n};\n\nvar META_KEY = SC.GUID_KEY+'_meta';\n\n/**\n  The key used to store meta information on object for property observing.\n\n  @static\n  @property\n*/\nSC.META_KEY = META_KEY;\n\n// Placeholder for non-writable metas.\nvar EMPTY_META = {\n  descs: {},\n  watching: {}\n}; \n\nif (Object.freeze) Object.freeze(EMPTY_META);\n\n/**\n  @private\n  @function\n  \n  Retrieves the meta hash for an object.  If 'writable' is true ensures the\n  hash is writable for this object as well.\n  \n  The meta object contains information about computed property descriptors as\n  well as any watched properties and other information.  You generally will\n  not access this information directly but instead work with higher level \n  methods that manipulate this has indirectly.\n\n  @param {Object} obj\n    The object to retrieve meta for\n    \n  @param {Boolean} writable\n    Pass false if you do not intend to modify the meta hash, allowing the \n    method to avoid making an unnecessary copy.\n    \n  @returns {Hash}\n*/\nSC.meta = function meta(obj, writable) {\n  \n  sc_assert(\"You must pass an object to SC.meta. This was probably called from SproutCore internals, so you probably called a SproutCore method with undefined that was expecting an object\", obj != undefined);\n\n  var ret = obj[META_KEY];\n  if (writable===false) return ret || EMPTY_META;\n\n  if (!ret) {\n    o_defineProperty(obj, META_KEY, META_DESC);\n    ret = obj[META_KEY] = {\n      descs: {},\n      watching: {},\n      values: {},\n      lastSetValues: {},\n      cache:  {},\n      source: obj\n    };\n    \n    // make sure we don't accidentally try to create constructor like desc\n    ret.descs.constructor = null;\n    \n  } else if (ret.source !== obj) {\n    ret = obj[META_KEY] = o_create(ret);\n    ret.descs    = o_create(ret.descs);\n    ret.values   = o_create(ret.values);\n    ret.watching = o_create(ret.watching);\n    ret.lastSetValues = {};\n    ret.cache    = {};\n    ret.source   = obj;\n  }\n  return ret;\n};\n\n/**\n  @private\n\n  In order to store defaults for a class, a prototype may need to create\n  a default meta object, which will be inherited by any objects instantiated\n  from the class's constructor.\n\n  However, the properties of that meta object are only shallow-cloned,\n  so if a property is a hash (like the event system's `listeners` hash),\n  it will by default be shared across all instances of that class.\n\n  This method allows extensions to deeply clone a series of nested hashes or\n  other complex objects. For instance, the event system might pass\n  ['listeners', 'foo:change', 'sc157'] to `prepareMetaPath`, which will\n  walk down the keys provided.\n\n  For each key, if the key does not exist, it is created. If it already\n  exists and it was inherited from its constructor, the constructor's\n  key is cloned.\n\n  You can also pass false for `writable`, which will simply return\n  undefined if `prepareMetaPath` discovers any part of the path that\n  shared or undefined.\n\n  @param {Object} obj The object whose meta we are examining\n  @param {Array} path An array of keys to walk down\n  @param {Boolean} writable whether or not to create a new meta\n    (or meta property) if one does not already exist or if it's\n    shared with its constructor\n*/\nSC.metaPath = function(obj, path, writable) {\n  var meta = SC.meta(obj, writable), keyName, value;\n\n  for (var i=0, l=path.length; i<l; i++) {\n    keyName = path[i];\n    value = meta[keyName];\n\n    if (!value) {\n      if (!writable) { return undefined; }\n      value = meta[keyName] = { __sc_source__: obj };\n    } else if (value.__sc_source__ !== obj) {\n      if (!writable) { return undefined; }\n      value = meta[keyName] = o_create(value);\n      value.__sc_source__ = obj;\n    }\n\n    meta = value;\n  }\n\n  return value;\n};\n\n/**\n  @private\n\n  Wraps the passed function so that `this._super` will point to the superFunc\n  when the function is invoked.  This is the primitive we use to implement\n  calls to super.\n  \n  @param {Function} func\n    The function to call\n    \n  @param {Function} superFunc\n    The super function.\n    \n  @returns {Function} wrapped function.\n*/\nSC.wrap = function(func, superFunc) {\n  \n  function K() {}\n  \n  var newFunc = function() {\n    var ret, sup = this._super;\n    this._super = superFunc || K;\n    ret = func.apply(this, arguments);\n    this._super = sup;\n    return ret;\n  };\n  \n  newFunc.base = func;\n  return newFunc;\n};\n\n/**\n  @function\n  \n  Returns YES if the passed object is an array or Array-like.\n\n  SproutCore Array Protocol:\n\n    - the object has an objectAt property\n    - the object is a native Array\n    - the object is an Object, and has a length property\n\n  Unlike SC.typeOf this method returns true even if the passed object is\n  not formally array but appears to be array-like (i.e. implements SC.Array)\n\n  @param {Object} obj The object to test\n  @returns {Boolean}\n*/\nSC.isArray = function(obj) {\n  if (!obj || obj.setInterval) { return false; }\n  if (Array.isArray && Array.isArray(obj)) { return true; }\n  if (SC.Array && SC.Array.detect(obj)) { return true; }\n  if ((obj.length !== undefined) && 'object'===typeof obj) { return true; }\n  return false;\n};\n\n/**\n  Forces the passed object to be part of an array.  If the object is already\n  an array or array-like, returns the object.  Otherwise adds the object to\n  an array.  If obj is null or undefined, returns an empty array.\n  \n  @param {Object} obj the object\n  @returns {Array}\n*/\nSC.makeArray = function(obj) {\n  if (obj==null) return [];\n  return SC.isArray(obj) ? obj : [obj];\n};\n\n\n\n});");spade.register("sproutcore-metal/watching", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Metal\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals sc_assert */\n\n\nrequire('sproutcore-metal/core');\nrequire('sproutcore-metal/platform');\nrequire('sproutcore-metal/utils');\nrequire('sproutcore-metal/accessors');\nrequire('sproutcore-metal/properties');\nrequire('sproutcore-metal/observer');\n\nvar guidFor = SC.guidFor;\nvar meta    = SC.meta;\nvar get = SC.get, set = SC.set;\nvar normalizeTuple = SC.normalizeTuple.primitive;\nvar normalizePath  = SC.normalizePath;\nvar SIMPLE_PROPERTY = SC.SIMPLE_PROPERTY;\nvar GUID_KEY = SC.GUID_KEY;\nvar notifyObservers = SC.notifyObservers;\n\nvar FIRST_KEY = /^([^\\.\\*]+)/;\nvar IS_PATH = /[\\.\\*]/;\n\nfunction firstKey(path) {\n  return path.match(FIRST_KEY)[0];\n}\n\n// returns true if the passed path is just a keyName\nfunction isKeyName(path) {\n  return path==='*' || !IS_PATH.test(path);\n}\n\n// ..........................................................\n// DEPENDENT KEYS\n// \n\nvar DEP_SKIP = { __scproto__: true }; // skip some keys and toString\nfunction iterDeps(methodName, obj, depKey, seen) {\n  \n  var guid = guidFor(obj);\n  if (!seen[guid]) seen[guid] = {};\n  if (seen[guid][depKey]) return ;\n  seen[guid][depKey] = true;\n  \n  var deps = meta(obj, false).deps, method = SC[methodName];\n  deps = deps && deps[depKey];\n  if (deps) {\n    for(var key in deps) {\n      if (DEP_SKIP[key]) continue;\n      method(obj, key);\n    }\n  }\n}\n\n\nvar WILL_SEEN, DID_SEEN;\n\n// called whenever a property is about to change to clear the cache of any dependent keys (and notify those properties of changes, etc...)\nfunction dependentKeysWillChange(obj, depKey) {\n  var seen = WILL_SEEN, top = !seen;\n  if (top) seen = WILL_SEEN = {};\n  iterDeps('propertyWillChange', obj, depKey, seen);\n  if (top) WILL_SEEN = null;\n}\n\n// called whenever a property has just changed to update dependent keys\nfunction dependentKeysDidChange(obj, depKey) {\n  var seen = DID_SEEN, top = !seen;\n  if (top) seen = DID_SEEN = {};\n  iterDeps('propertyDidChange', obj, depKey, seen);\n  if (top) DID_SEEN = null;\n}\n\n// ..........................................................\n// CHAIN\n// \n\nfunction addChainWatcher(obj, keyName, node) {\n  if (!obj || ('object' !== typeof obj)) return; // nothing to do\n  var m = meta(obj);\n  var nodes = m.chainWatchers;\n  if (!nodes || nodes.__scproto__ !== obj) {\n    nodes = m.chainWatchers = { __scproto__: obj };\n  }\n\n  if (!nodes[keyName]) nodes[keyName] = {};\n  nodes[keyName][guidFor(node)] = node;\n  SC.watch(obj, keyName);\n}\n\nfunction removeChainWatcher(obj, keyName, node) {\n  if (!obj || ('object' !== typeof obj)) return; // nothing to do\n  var m = meta(obj, false);\n  var nodes = m.chainWatchers;\n  if (!nodes || nodes.__scproto__ !== obj) return; //nothing to do\n  if (nodes[keyName]) delete nodes[keyName][guidFor(node)];\n  SC.unwatch(obj, keyName);\n}\n\nvar pendingQueue = [];\n\n// attempts to add the pendingQueue chains again.  If some of them end up\n// back in the queue and reschedule is true, schedules a timeout to try \n// again.\nfunction flushPendingChains(reschedule) {\n  if (pendingQueue.length===0) return ; // nothing to do\n  \n  var queue = pendingQueue;\n  pendingQueue = [];\n  \n  queue.forEach(function(q) { q[0].add(q[1]); });\n  if (reschedule!==false && pendingQueue.length>0) {\n    setTimeout(flushPendingChains, 1);\n  }\n}\n\nfunction isProto(pvalue) {\n  return meta(pvalue, false).proto === pvalue;\n}\n\n// A ChainNode watches a single key on an object.  If you provide a starting\n// value for the key then the node won't actually watch it.  For a root node \n// pass null for parent and key and object for value.\nvar ChainNode = function(parent, key, value, separator) {\n  var obj;\n  \n  this._parent = parent;\n  this._key    = key;\n  this._watching = value===undefined;\n  this._value  = value || (parent._value && !isProto(parent._value) && get(parent._value, key));\n  this._separator = separator || '.';\n  this._paths = {};\n\n  if (this._watching) {\n    this._object = parent._value;\n    if (this._object) addChainWatcher(this._object, this._key, this);\n  }\n};\n\n\nvar Wp = ChainNode.prototype;\n\nWp.destroy = function() {\n  if (this._watching) {\n    var obj = this._object;\n    if (obj) removeChainWatcher(obj, this._key, this);\n    this._watching = false; // so future calls do nothing\n  }\n};\n\n// copies a top level object only\nWp.copy = function(obj) {\n  var ret = new ChainNode(null, null, obj, this._separator);\n  var paths = this._paths, path;\n  for(path in paths) {\n    if (!(paths[path] > 0)) continue; // this check will also catch non-number vals.\n    ret.add(path);\n  }\n  return ret;\n};\n\n// called on the root node of a chain to setup watchers on the specified \n// path.\nWp.add = function(path) {\n  var obj, tuple, key, src, separator, paths;\n\n  paths = this._paths;\n  paths[path] = (paths[path] || 0) + 1 ;\n\n  obj = this._value;\n  tuple = normalizeTuple(obj, path);\n  if (tuple[0] && (tuple[0] === obj)) {\n    path = tuple[1];\n    key  = firstKey(path);\n    path = path.slice(key.length+1);\n\n  // static path does not exist yet.  put into a queue and try to connect\n  // later.\n  } else if (!tuple[0]) {\n    pendingQueue.push([this, path]);\n    return;\n\n  } else {\n    src  = tuple[0];\n    key  = path.slice(0, 0-(tuple[1].length+1));\n    separator = path.slice(key.length, key.length+1);\n    path = tuple[1];\n  }\n\n  this.chain(key, path, src, separator);\n};\n\n// called on the root node of a chain to teardown watcher on the specified\n// path\nWp.remove = function(path) {\n  var obj, tuple, key, src, paths;\n\n  paths = this._paths;\n  if (paths[path] > 0) paths[path]--;\n\n  obj = this._value;\n  tuple = normalizeTuple(obj, path);\n  if (tuple[0] === obj) {\n    path = tuple[1];\n    key  = firstKey(path);\n    path = path.slice(key.length+1);\n\n  } else {\n    src  = tuple[0];\n    key  = path.slice(0, 0-(tuple[1].length+1));\n    path = tuple[1];\n  }\n\n  this.unchain(key, path);\n};\n\nWp.count = 0;\n\nWp.chain = function(key, path, src, separator) {\n  var chains = this._chains, node;\n  if (!chains) chains = this._chains = {};\n\n  node = chains[key];\n  if (!node) node = chains[key] = new ChainNode(this, key, src, separator);\n  node.count++; // count chains...\n\n  // chain rest of path if there is one\n  if (path && path.length>0) {\n    key = firstKey(path);\n    path = path.slice(key.length+1);\n    node.chain(key, path); // NOTE: no src means it will observe changes...\n  }\n};\n\nWp.unchain = function(key, path) {\n  var chains = this._chains, node = chains[key];\n\n  // unchain rest of path first...\n  if (path && path.length>1) {\n    key  = firstKey(path);\n    path = path.slice(key.length+1);\n    node.unchain(key, path);\n  }\n\n  // delete node if needed.\n  node.count--;\n  if (node.count<=0) {\n    delete chains[node._key];\n    node.destroy();\n  }\n  \n};\n\nWp.willChange = function() {\n  var chains = this._chains;\n  if (chains) {\n    for(var key in chains) {\n      if (!chains.hasOwnProperty(key)) continue;\n      chains[key].willChange();\n    }\n  }\n  \n  if (this._parent) this._parent.chainWillChange(this, this._key, 1);\n};\n\nWp.chainWillChange = function(chain, path, depth) {\n  if (this._key) path = this._key+this._separator+path;\n\n  if (this._parent) {\n    this._parent.chainWillChange(this, path, depth+1);\n  } else {\n    if (depth>1) SC.propertyWillChange(this._value, path);\n    path = 'this.'+path;\n    if (this._paths[path]>0) SC.propertyWillChange(this._value, path);\n  }\n};\n\nWp.chainDidChange = function(chain, path, depth) {\n  if (this._key) path = this._key+this._separator+path;\n  if (this._parent) {\n    this._parent.chainDidChange(this, path, depth+1);\n  } else {\n    if (depth>1) SC.propertyDidChange(this._value, path);\n    path = 'this.'+path;\n    if (this._paths[path]>0) SC.propertyDidChange(this._value, path);\n  }\n};\n\nWp.didChange = function() {\n  // update my own value first.\n  if (this._watching) {\n    var obj = this._parent._value;\n    if (obj !== this._object) {\n      removeChainWatcher(this._object, this._key, this);\n      this._object = obj;\n      addChainWatcher(obj, this._key, this);\n    }\n    this._value  = obj && !isProto(obj) ? get(obj, this._key) : undefined;\n  }\n  \n  // then notify chains...\n  var chains = this._chains;\n  if (chains) {\n    for(var key in chains) {\n      if (!chains.hasOwnProperty(key)) continue;\n      chains[key].didChange();\n    }\n  }\n\n  // and finally tell parent about my path changing...\n  if (this._parent) this._parent.chainDidChange(this, this._key, 1);\n};\n\n// get the chains for the current object.  If the current object has \n// chains inherited from the proto they will be cloned and reconfigured for\n// the current object.\nfunction chainsFor(obj) {\n  var m   = meta(obj), ret = m.chains;\n  if (!ret) {\n    ret = m.chains = new ChainNode(null, null, obj);\n  } else if (ret._value !== obj) {\n    ret = m.chains = ret.copy(obj);\n  }\n  return ret ;\n}\n\n\n\nfunction notifyChains(obj, keyName, methodName) {\n  var m = meta(obj, false);\n  var nodes = m.chainWatchers;\n  if (!nodes || nodes.__scproto__ !== obj) return; // nothing to do\n\n  nodes = nodes[keyName];\n  if (!nodes) return;\n  \n  for(var key in nodes) {\n    if (!nodes.hasOwnProperty(key)) continue;\n    nodes[key][methodName](obj, keyName);\n  }\n}\n\nfunction chainsWillChange(obj, keyName) {\n  notifyChains(obj, keyName, 'willChange');\n}\n\nfunction chainsDidChange(obj, keyName) {\n  notifyChains(obj, keyName, 'didChange');\n}\n\n// ..........................................................\n// WATCH\n// \n\nvar WATCHED_PROPERTY = SC.SIMPLE_PROPERTY.watched;\n\n/**\n  @private\n\n  Starts watching a property on an object.  Whenever the property changes,\n  invokes SC.propertyWillChange and SC.propertyDidChange.  This is the \n  primitive used by observers and dependent keys; usually you will never call\n  this method directly but instead use higher level methods like\n  SC.addObserver().\n*/\nSC.watch = function(obj, keyName) {\n\n  // can't watch length on Array - it is special...\n  if (keyName === 'length' && SC.typeOf(obj)==='array') return this;\n  \n  var m = meta(obj), watching = m.watching, desc;\n  keyName = normalizePath(keyName);\n\n  // activate watching first time\n  if (!watching[keyName]) {\n    watching[keyName] = 1;\n    if (isKeyName(keyName)) {\n      desc = m.descs[keyName];\n      desc = desc ? desc.watched : WATCHED_PROPERTY;\n      if (desc) SC.defineProperty(obj, keyName, desc);\n    } else {\n      chainsFor(obj).add(keyName);\n    }\n\n  }  else {\n    watching[keyName] = (watching[keyName]||0)+1;\n  }\n  return this;\n};\n\nSC.isWatching = function(obj, keyName) {\n  return !!meta(obj).watching[keyName];\n};\n\nSC.watch.flushPending = flushPendingChains;\n\n/** @private */\nSC.unwatch = function(obj, keyName) {\n  // can't watch length on Array - it is special...\n  if (keyName === 'length' && SC.typeOf(obj)==='array') return this;\n\n  var watching = meta(obj).watching, desc, descs;\n  keyName = normalizePath(keyName);\n  if (watching[keyName] === 1) {\n    watching[keyName] = 0;\n    if (isKeyName(keyName)) {\n      desc = meta(obj).descs[keyName];\n      desc = desc ? desc.unwatched : SIMPLE_PROPERTY;\n      if (desc) SC.defineProperty(obj, keyName, desc);\n    } else {\n      chainsFor(obj).remove(keyName);\n    }\n\n  } else if (watching[keyName]>1) {\n    watching[keyName]--;\n  }\n  \n  return this;\n};\n\n/**\n  @private\n\n  Call on an object when you first beget it from another object.  This will\n  setup any chained watchers on the object instance as needed.  This method is\n  safe to call multiple times.\n*/\nSC.rewatch = function(obj) {\n  var m = meta(obj, false), chains = m.chains, bindings = m.bindings, key, b;\n\n  // make sure the object has its own guid.\n  if (GUID_KEY in obj && !obj.hasOwnProperty(GUID_KEY)) {\n    SC.generateGuid(obj, 'sc');\n  }  \n\n  // make sure any chained watchers update.\n  if (chains && chains._value !== obj) chainsFor(obj);\n\n  // if the object has bindings then sync them..\n  if (bindings && m.proto!==obj) {\n    for (key in bindings) {\n      b = !DEP_SKIP[key] && obj[key];\n      if (b && b instanceof SC.Binding) b.fromDidChange(obj);\n    }\n  }\n\n  return this;\n};\n\n// ..........................................................\n// PROPERTY CHANGES\n// \n\n/**\n  This function is called just before an object property is about to change.\n  It will notify any before observers and prepare caches among other things.\n  \n  Normally you will not need to call this method directly but if for some\n  reason you can't directly watch a property you can invoke this method \n  manually along with `SC.propertyDidChange()` which you should call just \n  after the property value changes.\n  \n  @param {Object} obj\n    The object with the property that will change\n    \n  @param {String} keyName\n    The property key (or path) that will change.\n    \n  @returns {void}\n*/\nSC.propertyWillChange = function(obj, keyName) {\n  var m = meta(obj, false), proto = m.proto, desc = m.descs[keyName];\n  if (proto === obj) return ;\n  if (desc && desc.willChange) desc.willChange(obj, keyName);\n  dependentKeysWillChange(obj, keyName);\n  chainsWillChange(obj, keyName);\n  SC.notifyBeforeObservers(obj, keyName);\n};\n\n/**\n  This function is called just after an object property has changed.\n  It will notify any observers and clear caches among other things.\n  \n  Normally you will not need to call this method directly but if for some\n  reason you can't directly watch a property you can invoke this method \n  manually along with `SC.propertyWilLChange()` which you should call just \n  before the property value changes.\n  \n  @param {Object} obj\n    The object with the property that will change\n    \n  @param {String} keyName\n    The property key (or path) that will change.\n    \n  @returns {void}\n*/\nSC.propertyDidChange = function(obj, keyName) {\n  var m = meta(obj, false), proto = m.proto, desc = m.descs[keyName];\n  if (proto === obj) return ;\n  if (desc && desc.didChange) desc.didChange(obj, keyName);\n  dependentKeysDidChange(obj, keyName);\n  chainsDidChange(obj, keyName);\n  SC.notifyObservers(obj, keyName);\n};\n\n});");spade.register("sproutcore-runtime/controllers", "(function(require, exports, __module, ARGV, ENV, __filename){require('sproutcore-runtime/controllers/array_controller');\n\n});");spade.register("sproutcore-runtime/controllers/array_controller", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Metal\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/system/array_proxy');\n\n/**\n  @class\n\n  SC.ArrayController provides a way for you to publish an array of objects for\n  SC.CollectionView or other controllers to work with.  To work with an\n  ArrayController, set the content property to the array you want the controller\n  to manage.  Then work directly with the controller object as if it were the\n  array itself.\n\n  For example, imagine you wanted to display a list of items fetched via an XHR\n  request. Create an SC.ArrayController and set its `content` property:\n\n      MyApp.listController = SC.ArrayController.create();\n\n      $.get('people.json', function(data) {\n        MyApp.listController.set('content', data);\n      });\n\n  Then, create a view that binds to your new controller:\n\n    {{collection contentBinding=\"MyApp.listController\"}}\n      {{content.firstName}} {{content.lastName}}\n    {{/collection}}\n\n  The advantage of using an array controller is that you only have to set up\n  your view bindings once; to change what's displayed, simply swap out the\n  `content` property on the controller.\n\n  @extends SC.ArrayProxy\n*/\n\nSC.ArrayController = SC.ArrayProxy.extend();\n\n});");spade.register("sproutcore-runtime/core", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals ENV sc_assert */\n\n\nrequire('sproutcore-metal');\n\n// ........................................\n// GLOBAL CONSTANTS\n//\n\n/**\n  @name YES\n  @static\n  @type Boolean\n  @default true\n  @constant\n*/\nYES = true;\n\n/**\n  @name NO\n  @static\n  @type Boolean\n  @default NO\n  @constant\n*/\nNO = false;\n\n// ensure no undefined errors in browsers where console doesn't exist\nif (typeof console === 'undefined') {\n  window.console = {};\n  console.log = console.info = console.warn = console.error = function() {};\n}\n\n// ..........................................................\n// BOOTSTRAP\n// \n\n/**\n  @static\n  @type Boolean\n  @default YES\n  @constant\n  \n  Determines whether SproutCore should enhances some built-in object \n  prototypes to provide a more friendly API.  If enabled, a few methods \n  will be added to Function, String, and Array.  Object.prototype will not be\n  enhanced, which is the one that causes most troubles for people.\n  \n  In general we recommend leaving this option set to true since it rarely\n  conflicts with other code.  If you need to turn it off however, you can\n  define an ENV.ENHANCE_PROTOTYPES config to disable it.\n*/  \nSC.EXTEND_PROTOTYPES = (SC.ENV.EXTEND_PROTOTYPES !== false);\n\n// ........................................\n// TYPING & ARRAY MESSAGING\n//\n\nvar TYPE_MAP = {};\nvar t =\"Boolean Number String Function Array Date RegExp Object\".split(\" \");\nt.forEach(function(name) {\n\tTYPE_MAP[ \"[object \" + name + \"]\" ] = name.toLowerCase();\n});\n\nvar toString = Object.prototype.toString;\n\n/**\n  Returns a consistant type for the passed item.\n\n  Use this instead of the built-in SC.typeOf() to get the type of an item.\n  It will return the same result across all browsers and includes a bit\n  more detail.  Here is what will be returned:\n\n  | Return Value Constant | Meaning |\n  | 'string' | String primitive |\n  | 'number' | Number primitive |\n  | 'boolean' | Boolean primitive |\n  | 'null' | Null value |\n  | 'undefined' | Undefined value |\n  | 'function' | A function |\n  | 'array' | An instance of Array |\n  | 'class' | A SproutCore class (created using SC.Object.extend()) |\n  | 'object' | A SproutCore object instance |\n  | 'error' | An instance of the Error object |\n  | 'hash' | A JavaScript object not inheriting from SC.Object |\n\n  @param item {Object} the item to check\n  @returns {String} the type\n*/\nSC.typeOf = function(item) {\n  var ret;\n  \n  ret = item==null ? String(item) : TYPE_MAP[toString.call(item)]||'object';\n\n  if (ret === 'function') {\n    if (SC.Object && SC.Object.detect(item)) ret = 'class';\n  } else if (ret === 'object') {\n    if (item instanceof Error) ret = 'error';\n    else if (SC.Object && item instanceof SC.Object) ret = 'instance';\n    else ret = 'object';\n  }\n  \n  return ret;\n};\n\n/**\n  Returns YES if the passed value is null or undefined.  This avoids errors\n  from JSLint complaining about use of ==, which can be technically\n  confusing.\n\n  @param {Object} obj Value to test\n  @returns {Boolean}\n*/\nSC.none = function(obj) {\n  return obj === null || obj === undefined;\n};\n\n/**\n  Verifies that a value is either null or an empty string. Return false if\n  the object is not a string.\n\n  @param {Object} obj Value to test\n  @returns {Boolean}\n*/\nSC.empty = function(obj) {\n  return obj === null || obj === undefined || obj === '';\n};\n\n/**\n  SC.isArray defined in sproutcore-metal/lib/utils\n**/\n\n/**\n This will compare two javascript values of possibly different types.\n It will tell you which one is greater than the other by returning:\n\n  - -1 if the first is smaller than the second,\n  - 0 if both are equal,\n  - 1 if the first is greater than the second.\n\n The order is calculated based on SC.ORDER_DEFINITION, if types are different.\n In case they have the same type an appropriate comparison for this type is made.\n\n @param {Object} v First value to compare\n @param {Object} w Second value to compare\n @returns {Number} -1 if v < w, 0 if v = w and 1 if v > w.\n*/\nSC.compare = function (v, w) {\n  if (v === w) { return 0; }\n\n  var type1 = SC.typeOf(v);\n  var type2 = SC.typeOf(w);\n\n  var Comparable = SC.Comparable;\n  if (Comparable) {\n    if (type1==='instance' && Comparable.detect(v.constructor)) {\n      return v.constructor.compare(v, w);\n    }\n    \n    if (type2 === 'instance' && Comparable.detect(w.constructor)) {\n      return 1-w.constructor.compare(w, v);\n    }\n  }\n\n  // If we haven't yet generated a reverse-mapping of SC.ORDER_DEFINITION,\n  // do so now.\n  var mapping = SC.ORDER_DEFINITION_MAPPING;\n  if (!mapping) {\n    var order = SC.ORDER_DEFINITION;\n    mapping = SC.ORDER_DEFINITION_MAPPING = {};\n    var idx, len;\n    for (idx = 0, len = order.length; idx < len;  ++idx) {\n      mapping[order[idx]] = idx;\n    }\n\n    // We no longer need SC.ORDER_DEFINITION.\n    delete SC.ORDER_DEFINITION;\n  }\n\n  var type1Index = mapping[type1];\n  var type2Index = mapping[type2];\n\n  if (type1Index < type2Index) { return -1; }\n  if (type1Index > type2Index) { return 1; }\n\n  // types are equal - so we have to check values now\n  switch (type1) {\n    case 'boolean':\n    case 'number':\n      if (v < w) { return -1; }\n      if (v > w) { return 1; }\n      return 0;\n\n    case 'string':\n      var comp = v.localeCompare(w);\n      if (comp < 0) { return -1; }\n      if (comp > 0) { return 1; }\n      return 0;\n\n    case 'array':\n      var vLen = v.length;\n      var wLen = w.length;\n      var l = Math.min(vLen, wLen);\n      var r = 0;\n      var i = 0;\n      var thisFunc = arguments.callee;\n      while (r === 0 && i < l) {\n        r = thisFunc(v[i],w[i]);\n        i++;\n      }\n      if (r !== 0) { return r; }\n\n      // all elements are equal now\n      // shorter array should be ordered first\n      if (vLen < wLen) { return -1; }\n      if (vLen > wLen) { return 1; }\n      // arrays are equal now\n      return 0;\n\n    case 'instance':\n      if (SC.Comparable && SC.Comparable.detect(v)) { \n        return v.compare(v, w); \n      }\n      return 0;\n\n    default:\n      return 0;\n  }\n};\n\nfunction _copy(obj, deep, seen, copies) {\n  var ret, loc, key;\n\n  // primitive data types are immutable, just return them.\n  if ('object' !== typeof obj || obj===null) return obj;\n\n  // avoid cyclical loops\n  if (deep && (loc=seen.indexOf(obj))>=0) return copies[loc];\n  \n  sc_assert('Cannot clone an SC.Object that does not implement SC.Copyable', !(obj instanceof SC.Object) || (SC.Copyable && SC.Copyable.detect(obj)));\n\n  // IMPORTANT: this specific test will detect a native array only.  Any other\n  // object will need to implement Copyable.\n  if (SC.typeOf(obj) === 'array') {\n    ret = obj.slice();\n    if (deep) {\n      loc = ret.length;\n      while(--loc>=0) ret[loc] = _copy(ret[loc], deep, seen, copies);\n    }\n  } else if (SC.Copyable && SC.Copyable.detect(obj)) {\n    ret = obj.copy(deep, seen, copies);\n  } else {\n    ret = {};\n    for(key in obj) {\n      if (!obj.hasOwnProperty(key)) continue;\n      ret[key] = deep ? _copy(obj[key], deep, seen, copies) : obj[key];\n    }\n  }\n  \n  if (deep) {\n    seen.push(obj);\n    copies.push(ret);\n  }\n\n  return ret;\n}\n\n/**\n  Creates a clone of the passed object. This function can take just about\n  any type of object and create a clone of it, including primitive values\n  (which are not actually cloned because they are immutable).\n\n  If the passed object implements the clone() method, then this function\n  will simply call that method and return the result.\n\n  @param {Object} object The object to clone\n  @param {Boolean} deep If true, a deep copy of the object is made\n  @returns {Object} The cloned object\n*/\nSC.copy = function(obj, deep) {\n  // fast paths\n  if ('object' !== typeof obj || obj===null) return obj; // can't copy primitives\n  if (SC.Copyable && SC.Copyable.detect(obj)) return obj.copy(deep);\n  return _copy(obj, deep, deep ? [] : null, deep ? [] : null);\n};\n\n/**\n  Convenience method to inspect an object. This method will attempt to\n  convert the object into a useful string description.\n\n  @param {Object} obj The object you want to inspec.\n  @returns {String} A description of the object\n*/\nSC.inspect = function(obj) {\n  var v, ret = [];\n  for(var key in obj) {\n    if (obj.hasOwnProperty(key)) {\n      v = obj[key];\n      if (v === 'toString') { continue; } // ignore useless items\n      if (SC.typeOf(v) === SC.T_FUNCTION) { v = \"function() { ... }\"; }\n      ret.push(key + \": \" + v);\n    }\n  }\n  return \"{\" + ret.join(\" , \") + \"}\";\n};\n\n/**\n  Compares two objects, returning true if they are logically equal.  This is \n  a deeper comparison than a simple triple equal.  For arrays and enumerables\n  it will compare the internal objects.  For any other object that implements\n  `isEqual()` it will respect that method.\n  \n  @param {Object} a first object to compare\n  @param {Object} b second object to compare\n  @returns {Boolean}\n*/\nSC.isEqual = function(a, b) {\n  if (a && 'function'===typeof a.isEqual) return a.isEqual(b);\n  return a === b;\n};\n\n/**\n  @private\n  Used by SC.compare\n*/\nSC.ORDER_DEFINITION = SC.ENV.ORDER_DEFINITION || [\n  'undefined',\n  'null',\n  'boolean',\n  'number',\n  'string',\n  'array',\n  'object',\n  'instance',\n  'function',\n  'class'\n];\n\n/**\n  Returns all of the keys defined on an object or hash. This is useful\n  when inspecting objects for debugging.  On browsers that support it, this\n  uses the native Object.keys implementation.\n\n  @function\n  @param {Object} obj\n  @returns {Array} Array containing keys of obj\n*/\nSC.keys = Object.keys;\n\nif (!SC.keys) {\n  SC.keys = function(obj) {\n    var ret = [];\n    for(var key in obj) {\n      if (obj.hasOwnProperty(key)) { ret.push(key); }\n    }\n    return ret;\n  };\n}\n\n// ..........................................................\n// ERROR\n// \n\n/**\n  @class\n\n  A subclass of the JavaScript Error object for use in SproutCore.\n*/\nSC.Error = function() {\n  var tmp = Error.prototype.constructor.apply(this, arguments);\n\n  for (var p in tmp) {\n    if (tmp.hasOwnProperty(p)) { this[p] = tmp[p]; }\n  }\n};\n\nSC.Error.prototype = SC.create(Error.prototype);\n\n// ..........................................................\n// LOGGER\n// \n\n/**\n  @class\n\n  Inside SproutCore-Runtime, simply uses the window.console object.\n  Override this to provide more robust logging functionality.\n*/\nSC.Logger = window.console;\n\n});");spade.register("sproutcore-runtime/ext", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/ext/string');\nrequire('sproutcore-runtime/ext/function');\nrequire('sproutcore-runtime/ext/mixin');\n\n});");spade.register("sproutcore-runtime/ext/function", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/core');\n\nif (SC.EXTEND_PROTOTYPES) {\n\n  Function.prototype.property = function() {\n    var ret = SC.computed(this);\n    return ret.property.apply(ret, arguments);\n  };\n\n  Function.prototype.observes = function() {\n    this.__sc_observes__ = Array.prototype.slice.call(arguments);\n    return this;\n  };\n\n  Function.prototype.observesBefore = function() {\n    this.__sc_observesBefore__ = Array.prototype.slice.call(arguments);\n    return this;\n  };\n\n}\n\n\n});");spade.register("sproutcore-runtime/ext/mixin", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-metal/mixin');\n\nvar IS_BINDING = SC.IS_BINDING = /^.+Binding$/;\n\nSC._mixinBindings = function(obj, key, value, m) {\n  if (IS_BINDING.test(key)) {\n    if (!(value instanceof SC.Binding)) {\n      value = new SC.Binding(key.slice(0,-7), value); // make binding\n    } else {\n      value.to(key.slice(0, -7));\n    }\n    value.connect(obj);\n\n    // keep a set of bindings in the meta so that when we rewatch we can\n    // resync them...\n    var bindings = m.bindings;\n    if (!bindings) {\n      bindings = m.bindings = { __scproto__: obj };\n    } else if (bindings.__scproto__ !== obj) {\n      bindings = m.bindings = SC.create(m.bindings);\n      bindings.__scproto__ = obj;\n    }\n\n    bindings[key] = true;\n  }\n  \n  return value;\n};\n\n});");spade.register("sproutcore-runtime/ext/string", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/core');\nrequire('sproutcore-runtime/system/string');\n\n\n\nvar fmt = SC.String.fmt,\n    w   = SC.String.w,\n    loc = SC.String.loc,\n    decamelize = SC.String.decamelize,\n    dasherize = SC.String.dasherize;\n  \nif (SC.EXTEND_PROTOTYPES) {\n\n  /**\n    @see SC.String.fmt\n  */\n  String.prototype.fmt = function() {\n    return fmt(this, arguments);\n  };\n  \n  /**\n    @see SC.String.w\n  */\n  String.prototype.w = function() {\n    return w(this);\n  };\n  \n  /**\n    @see SC.String.loc\n  */\n  String.prototype.loc = function() {\n    return loc(this, arguments);\n  };\n  \n  /**\n    @see SC.String.decamelize\n  */\n  String.prototype.decamelize = function() {\n    return decamelize(this);\n  };\n  \n  /**\n    @see SC.String.dasherize\n  */\n  String.prototype.dashersize = function() {\n    return dasherize(this);\n  };\n}\n\n\n\n\n});");spade.register("sproutcore-runtime/license", "(function(require, exports, __module, ARGV, ENV, __filename){/**\n * @license\n * ==========================================================================\n * SproutCore\n * Copyright ©2006-2011, Strobe Inc. and contributors.\n * Portions copyright ©2008-2011 Apple Inc. All rights reserved.\n * \n * Permission is hereby granted, free of charge, to any person obtaining a \n * copy of this software and associated documentation files (the \"Software\"), \n * to deal in the Software without restriction, including without limitation \n * the rights to use, copy, modify, merge, publish, distribute, sublicense, \n * and/or sell copies of the Software, and to permit persons to whom the \n * Software is furnished to do so, subject to the following conditions:\n * \n * The above copyright notice and this permission notice shall be included in \n * all copies or substantial portions of the Software.\n * \n * THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR \n * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, \n * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE \n * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER \n * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING \n * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER \n * DEALINGS IN THE SOFTWARE.\n * \n * For more information about SproutCore, visit http://www.sproutcore.com\n * \n * ==========================================================================\n */\n\n\n});");spade.register("sproutcore-runtime", {"name":"sproutcore-runtime","version":"2.0.beta.3","dependencies":{"spade":"~> 1.0","sproutcore-metal":"2.0.beta.3"}});

spade.register("sproutcore-runtime/main", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/license');\n\nrequire('sproutcore-metal');\nrequire('sproutcore-runtime/core');\nrequire('sproutcore-runtime/ext');\nrequire('sproutcore-runtime/mixins');\nrequire('sproutcore-runtime/system');\nrequire('sproutcore-runtime/controllers');\n\n});");spade.register("sproutcore-runtime/mixins", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/mixins/array');\nrequire('sproutcore-runtime/mixins/comparable');\nrequire('sproutcore-runtime/mixins/copyable');\nrequire('sproutcore-runtime/mixins/enumerable');\nrequire('sproutcore-runtime/mixins/freezable');\nrequire('sproutcore-runtime/mixins/mutable_array');\nrequire('sproutcore-runtime/mixins/mutable_enumerable');\nrequire('sproutcore-runtime/mixins/observable');\n\n});");spade.register("sproutcore-runtime/mixins/array", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\n\nrequire('sproutcore-runtime/mixins/enumerable');\n\n\n  \n// ..........................................................\n// HELPERS\n// \n\nvar get = SC.get, set = SC.set, meta = SC.meta;\n\nfunction none(obj) { return obj===null || obj===undefined; }\n\nfunction xform(target, method, params) {\n  method.call(target, params[0], params[2], params[3], params[4]);\n}\n\n// ..........................................................\n// ARRAY\n// \n/**\n  @namespace\n\n  This module implements Observer-friendly Array-like behavior.  This mixin is\n  picked up by the Array class as well as other controllers, etc. that want to\n  appear to be arrays.\n\n  Unlike SC.Enumerable, this mixin defines methods specifically for\n  collections that provide index-ordered access to their contents.  When you\n  are designing code that needs to accept any kind of Array-like object, you\n  should use these methods instead of Array primitives because these will\n  properly notify observers of changes to the array.\n\n  Although these methods are efficient, they do add a layer of indirection to\n  your application so it is a good idea to use them only when you need the\n  flexibility of using both true JavaScript arrays and \"virtual\" arrays such\n  as controllers and collections.\n\n  You can use the methods defined in this module to access and modify array\n  contents in a KVO-friendly way.  You can also be notified whenever the\n  membership if an array changes by changing the syntax of the property to\n  .observes('*myProperty.[]') .\n\n  To support SC.Array in your own class, you must override two\n  primitives to use it: replace() and objectAt().\n\n  Note that the SC.Array mixin also incorporates the SC.Enumerable mixin.  All\n  SC.Array-like objects are also enumerable.\n\n  @extends SC.Enumerable\n  @since SproutCore 0.9.0\n*/\nSC.Array = SC.Mixin.create(SC.Enumerable, /** @scope SC.Array.prototype */ {\n\n  /** @private - compatibility */\n  isSCArray: true,\n  \n  /**\n    @field {Number} length\n\n    Your array must support the length property.  Your replace methods should\n    set this property whenever it changes.\n  */\n  length: SC.required(),\n\n  /**\n    This is one of the primitives you must implement to support SC.Array.\n    Returns the object at the named index.  If your object supports retrieving\n    the value of an array item using get() (i.e. myArray.get(0)), then you do\n    not need to implement this method yourself.\n\n    @param {Number} idx\n      The index of the item to return.  If idx exceeds the current length,\n      return null.\n  */\n  objectAt: function(idx) {\n    if ((idx < 0) || (idx>=get(this, 'length'))) return undefined ;\n    return get(this, idx);\n  },\n\n  /** @private (nodoc) - overrides SC.Enumerable version */\n  nextObject: function(idx) {\n    return this.objectAt(idx);\n  },\n  \n  /**\n    @field []\n\n    This is the handler for the special array content property.  If you get\n    this property, it will return this.  If you set this property it a new\n    array, it will replace the current content.\n\n    This property overrides the default property defined in SC.Enumerable.\n  */\n  '[]': SC.computed(function(key, value) {\n    if (value !== undefined) this.replace(0, get(this, 'length'), value) ;\n    return this ;\n  }).property().cacheable(),\n\n  /** @private (nodoc) - optimized version from Enumerable */\n  contains: function(obj){\n    return this.indexOf(obj) >= 0;\n  },\n\n  // Add any extra methods to SC.Array that are native to the built-in Array.\n  /**\n    Returns a new array that is a slice of the receiver.  This implementation\n    uses the observable array methods to retrieve the objects for the new\n    slice.\n\n    @param beginIndex {Integer} (Optional) index to begin slicing from.\n    @param endIndex {Integer} (Optional) index to end the slice at.\n    @returns {Array} New array with specified slice\n  */\n  slice: function(beginIndex, endIndex) {\n    var ret = [];\n    var length = get(this, 'length') ;\n    if (none(beginIndex)) beginIndex = 0 ;\n    if (none(endIndex) || (endIndex > length)) endIndex = length ;\n    while(beginIndex < endIndex) {\n      ret[ret.length] = this.objectAt(beginIndex++) ;\n    }\n    return ret ;\n  },\n\n  /**\n    Returns the index for a particular object in the index.\n\n    @param {Object} object the item to search for\n    @param {NUmber} startAt optional starting location to search, default 0\n    @returns {Number} index of -1 if not found\n  */\n  indexOf: function(object, startAt) {\n    var idx, len = get(this, 'length');\n\n    if (startAt === undefined) startAt = 0;\n    if (startAt < 0) startAt += len;\n\n    for(idx=startAt;idx<len;idx++) {\n      if (this.objectAt(idx, true) === object) return idx ;\n    }\n    return -1;\n  },\n\n  /**\n    Returns the last index for a particular object in the index.\n\n    @param {Object} object the item to search for\n    @param {NUmber} startAt optional starting location to search, default 0\n    @returns {Number} index of -1 if not found\n  */\n  lastIndexOf: function(object, startAt) {\n    var idx, len = get(this, 'length');\n\n    if (startAt === undefined) startAt = len-1;\n    if (startAt < 0) startAt += len;\n\n    for(idx=startAt;idx>=0;idx--) {\n      if (this.objectAt(idx) === object) return idx ;\n    }\n    return -1;\n  },\n  \n  // ..........................................................\n  // ARRAY OBSERVERS\n  // \n  \n  /**\n    Adds an array observer to the receiving array.  The array observer object\n    normally must implement two methods:\n    \n    * `arrayWillChange(start, removeCount, addCount)` - This method will be\n      called just before the array is modified.\n    * `arrayDidChange(start, removeCount, addCount)` - This method will be\n      called just after the array is modified.\n      \n    Both callbacks will be passed the starting index of the change as well a \n    a count of the items to be removed and added.  You can use these callbacks\n    to optionally inspect the array during the change, clear caches, or do \n    any other bookkeeping necessary.\n    \n    In addition to passing a target, you can also include an options hash \n    which you can use to override the method names that will be invoked on the\n    target.\n    \n    @param {Object} target\n      The observer object.\n      \n    @param {Hash} opts\n      Optional hash of configuration options including willChange, didChange,\n      and a context option.\n      \n    @returns {SC.Array} receiver\n  */\n  addArrayObserver: function(target, opts) {\n    var willChange = (opts && opts.willChange) || 'arrayWillChange',\n        didChange  = (opts && opts.didChange) || 'arrayDidChange';\n\n    var hasObservers = get(this, 'hasArrayObservers');\n    if (!hasObservers) SC.propertyWillChange(this, 'hasArrayObservers');\n    SC.addListener(this, '@array:before', target, willChange, xform);\n    SC.addListener(this, '@array:change', target, didChange, xform);\n    if (!hasObservers) SC.propertyDidChange(this, 'hasArrayObservers');\n    return this;\n  },\n  \n  /**\n    Removes an array observer from the object if the observer is current \n    registered.  Calling this method multiple times with the same object will\n    have no effect.\n    \n    @param {Object} target\n      The object observing the array.\n    \n    @returns {SC.Array} receiver\n  */\n  removeArrayObserver: function(target, opts) {\n    var willChange = (opts && opts.willChange) || 'arrayWillChange',\n        didChange  = (opts && opts.didChange) || 'arrayDidChange';\n\n    var hasObservers = get(this, 'hasArrayObservers');\n    if (hasObservers) SC.propertyWillChange(this, 'hasArrayObservers');\n    SC.removeListener(this, '@array:before', target, willChange, xform);\n    SC.removeListener(this, '@array:change', target, didChange, xform);\n    if (hasObservers) SC.propertyDidChange(this, 'hasArrayObservers');\n    return this;\n  },\n  \n  /**\n    Becomes true whenever the array currently has observers watching changes\n    on the array.\n    \n    @property {Boolean}\n  */\n  hasArrayObservers: SC.computed(function() {\n    return SC.hasListeners(this, '@array:change') || SC.hasListeners(this, '@array:before');\n  }).property().cacheable(),\n  \n  /**\n    If you are implementing an object that supports SC.Array, call this \n    method just before the array content changes to notify any observers and\n    invalidate any related properties.  Pass the starting index of the change\n    as well as a delta of the amounts to change.\n    \n    @param {Number} startIdx\n      The starting index in the array that will change.\n      \n    @param {Number} removeAmt\n      The number of items that will be removed.  If you pass null assumes 0\n    \n    @param {Number} addAmt\n      The number of items that will be added.  If you pass null assumes 0.\n      \n    @returns {SC.Array} receiver\n  */\n  arrayContentWillChange: function(startIdx, removeAmt, addAmt) {\n\n    // if no args are passed assume everything changes\n    if (startIdx===undefined) {\n      startIdx = 0;\n      removeAmt = addAmt = -1;\n    } else {\n      if (!removeAmt) removeAmt=0;\n      if (!addAmt) addAmt=0;\n    }\n\n    SC.sendEvent(this, '@array:before', startIdx, removeAmt, addAmt);\n\n    var removing, lim;\n    if (startIdx>=0 && removeAmt>=0 && get(this, 'hasEnumerableObservers')) {\n      removing = [];\n      lim = startIdx+removeAmt;\n      for(var idx=startIdx;idx<lim;idx++) removing.push(this.objectAt(idx));\n    } else {\n      removing = removeAmt;\n    }\n    \n    this.enumerableContentWillChange(removing, addAmt);\n\n    // Make sure the @each proxy is set up if anyone is observing @each\n    if (SC.isWatching(this, '@each')) { get(this, '@each'); }\n    return this;\n  },\n  \n  arrayContentDidChange: function(startIdx, removeAmt, addAmt) {\n\n    // if no args are passed assume everything changes\n    if (startIdx===undefined) {\n      startIdx = 0;\n      removeAmt = addAmt = -1;\n    } else {\n      if (!removeAmt) removeAmt=0;\n      if (!addAmt) addAmt=0;\n    }\n    \n    var adding, lim;\n    if (startIdx>=0 && addAmt>=0 && get(this, 'hasEnumerableObservers')) {\n      adding = [];\n      lim = startIdx+addAmt;\n      for(var idx=startIdx;idx<lim;idx++) adding.push(this.objectAt(idx));\n    } else {\n      adding = addAmt;\n    }\n\n    this.enumerableContentDidChange(removeAmt, adding);\n    SC.sendEvent(this, '@array:change', startIdx, removeAmt, addAmt);\n    return this;\n  },\n  \n  // ..........................................................\n  // ENUMERATED PROPERTIES\n  // \n  \n  /**\n    Returns a special object that can be used to observe individual properties\n    on the array.  Just get an equivalent property on this object and it will\n    return an enumerable that maps automatically to the named key on the \n    member objects.\n  */\n  '@each': SC.computed(function() {\n    if (!this.__each) this.__each = new SC.EachProxy(this);\n    return this.__each;\n  }).property().cacheable()\n  \n  \n  \n}) ;\n\n\n\n\n});");spade.register("sproutcore-runtime/mixins/comparable", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/core');\n\n\n/**\n  @namespace\n\n  Implements some standard methods for comparing objects. Add this mixin to\n  any class you create that can compare its instances.\n\n  You should implement the compare() method.\n\n  @since SproutCore 1.0\n*/\nSC.Comparable = SC.Mixin.create( /** @scope SC.Comparable.prototype */{\n\n  /**\n    walk like a duck. Indicates that the object can be compared.\n\n    @type Boolean\n    @default YES\n    @constant\n  */\n  isComparable: true,\n\n  /**\n    Override to return the result of the comparison of the two parameters. The\n    compare method should return:\n\n      - -1 if a < b\n      - 0 if a == b\n      - 1 if a > b\n\n    Default implementation raises an exception.\n\n    @param a {Object} the first object to compare\n    @param b {Object} the second object to compare\n    @returns {Integer} the result of the comparison\n  */\n  compare: SC.required(Function)\n\n});\n\n\n});");spade.register("sproutcore-runtime/mixins/copyable", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2010 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\n\nrequire('sproutcore-runtime/system/string');\n\n\n  \nvar get = SC.get, set = SC.set;\n\n/**\n  @namespace\n\n  Implements some standard methods for copying an object.  Add this mixin to\n  any object you create that can create a copy of itself.  This mixin is\n  added automatically to the built-in array.\n\n  You should generally implement the copy() method to return a copy of the\n  receiver.\n\n  Note that frozenCopy() will only work if you also implement SC.Freezable.\n\n  @since SproutCore 1.0\n*/\nSC.Copyable = SC.Mixin.create({\n\n  /**\n    Override to return a copy of the receiver.  Default implementation raises\n    an exception.\n\n    @param deep {Boolean} if true, a deep copy of the object should be made\n    @returns {Object} copy of receiver\n  */\n  copy: SC.required(Function),\n\n  /**\n    If the object implements SC.Freezable, then this will return a new copy\n    if the object is not frozen and the receiver if the object is frozen.\n\n    Raises an exception if you try to call this method on a object that does\n    not support freezing.\n\n    You should use this method whenever you want a copy of a freezable object\n    since a freezable object can simply return itself without actually\n    consuming more memory.\n\n    @returns {Object} copy of receiver or receiver\n  */\n  frozenCopy: function() {\n    if (SC.Freezable && SC.Freezable.detect(this)) {\n      return get(this, 'isFrozen') ? this : this.copy().freeze();\n    } else {\n      throw new Error(SC.String.fmt(\"%@ does not support freezing\",this));\n    }\n  }\n});\n\n\n\n\n});");spade.register("sproutcore-runtime/mixins/enumerable", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\n\n\n\n\n// ..........................................................\n// HELPERS\n// \n\nvar get = SC.get, set = SC.set;\n\nvar contexts = [];\nfunction popCtx() {\n  return contexts.length===0 ? {} : contexts.pop();\n}\n\nfunction pushCtx(ctx) {\n  contexts.push(ctx);\n  return null;\n}\n\nfunction iter(key, value) {\n  function i(item) {\n    var cur = get(item, key);\n    return value===undefined ? !!cur : value===cur;\n  } \n  return i ;\n}\n\nfunction xform(target, method, params) {\n  method.call(target, params[0], params[2], params[3]);\n}\n\n/**\n  @class\n\n  This mixin defines the common interface implemented by enumerable objects\n  in SproutCore.  Most of these methods follow the standard Array iteration\n  API defined up to JavaScript 1.8 (excluding language-specific features that\n  cannot be emulated in older versions of JavaScript).\n\n  This mixin is applied automatically to the Array class on page load, so you\n  can use any of these methods on simple arrays.  If Array already implements\n  one of these methods, the mixin will not override them.\n\n  h3. Writing Your Own Enumerable\n\n  To make your own custom class enumerable, you need two items:\n\n  1. You must have a length property.  This property should change whenever\n     the number of items in your enumerable object changes.  If you using this\n     with an SC.Object subclass, you should be sure to change the length\n     property using set().\n\n  2. If you must implement nextObject().  See documentation.\n\n  Once you have these two methods implement, apply the SC.Enumerable mixin\n  to your class and you will be able to enumerate the contents of your object\n  like any other collection.\n\n  h3. Using SproutCore Enumeration with Other Libraries\n\n  Many other libraries provide some kind of iterator or enumeration like\n  facility.  This is often where the most common API conflicts occur.\n  SproutCore's API is designed to be as friendly as possible with other\n  libraries by implementing only methods that mostly correspond to the\n  JavaScript 1.8 API.\n\n  @since SproutCore 1.0\n*/\nSC.Enumerable = SC.Mixin.create( /** @lends SC.Enumerable */ {\n  \n  /** @private - compatibility */\n  isEnumerable: true,\n  \n  /**\n    Implement this method to make your class enumerable.\n\n    This method will be call repeatedly during enumeration.  The index value\n    will always begin with 0 and increment monotonically.  You don't have to\n    rely on the index value to determine what object to return, but you should\n    always check the value and start from the beginning when you see the\n    requested index is 0.\n\n    The previousObject is the object that was returned from the last call\n    to nextObject for the current iteration.  This is a useful way to\n    manage iteration if you are tracing a linked list, for example.\n\n    Finally the context parameter will always contain a hash you can use as\n    a \"scratchpad\" to maintain any other state you need in order to iterate\n    properly.  The context object is reused and is not reset between\n    iterations so make sure you setup the context with a fresh state whenever\n    the index parameter is 0.\n\n    Generally iterators will continue to call nextObject until the index\n    reaches the your current length-1.  If you run out of data before this\n    time for some reason, you should simply return undefined.\n\n    The default impementation of this method simply looks up the index.\n    This works great on any Array-like objects.\n\n    @param index {Number} the current index of the iteration\n    @param previousObject {Object} the value returned by the last call to nextObject.\n    @param context {Object} a context object you can use to maintain state.\n    @returns {Object} the next object in the iteration or undefined\n  */\n  nextObject: SC.required(Function),\n\n  /**\n    Helper method returns the first object from a collection.  This is usually\n    used by bindings and other parts of the framework to extract a single\n    object if the enumerable contains only one item.\n\n    If you override this method, you should implement it so that it will\n    always return the same value each time it is called.  If your enumerable\n    contains only one object, this method should always return that object.\n    If your enumerable is empty, this method should return undefined.\n\n    @returns {Object} the object or undefined\n  */\n  firstObject: SC.computed(function() {\n    if (get(this, 'length')===0) return undefined ;\n    if (SC.Array && SC.Array.detect(this)) return this.objectAt(0); \n\n    // handle generic enumerables\n    var context = popCtx(), ret;\n    ret = this.nextObject(0, null, context);\n    pushCtx(context);\n    return ret ;\n  }).property('[]').cacheable(),\n\n  /**\n    Helper method returns the last object from a collection.\n\n    @returns {Object} the object or undefined\n  */\n  lastObject: SC.computed(function() {\n    var len = get(this, 'length');\n    if (len===0) return undefined ;\n    if (SC.Array && SC.Array.detect(this)) {\n      return this.objectAt(len-1);\n    } else {\n      var context = popCtx(), idx=0, cur, last = null;\n      do {\n        last = cur;\n        cur = this.nextObject(idx++, last, context);\n      } while (cur !== undefined);\n      pushCtx(context);\n      return last;\n    }\n    \n  }).property('[]').cacheable(),\n\n  /**\n    Returns true if the passed object can be found in the receiver.  The\n    default version will iterate through the enumerable until the object \n    is found.  You may want to override this with a more efficient version.\n    \n    @param {Object} obj\n      The object to search for.\n      \n    @returns {Boolean} true if object is found in enumerable.\n  */\n  contains: function(obj) {\n    return this.find(function(item) { return item===obj; }) !== undefined; \n  },\n  \n  /**\n    Iterates through the enumerable, calling the passed function on each\n    item. This method corresponds to the forEach() method defined in\n    JavaScript 1.6.\n\n    The callback method you provide should have the following signature (all\n    parameters are optional):\n\n          function(item, index, enumerable);\n\n    - *item* is the current item in the iteration.\n    - *index* is the current index in the iteration\n    - *enumerable* is the enumerable object itself.\n\n    Note that in addition to a callback, you can also pass an optional target\n    object that will be set as \"this\" on the context. This is a good way\n    to give your iterator function access to the current object.\n\n    @param {Function} callback The callback to execute\n    @param {Object} target The target object to use\n    @returns {Object} receiver\n  */\n  forEach: function(callback, target) {\n    if (typeof callback !== \"function\") throw new TypeError() ;\n    var len = get(this, 'length'), last = null, context = popCtx();\n\n    if (target === undefined) target = null;\n\n    for(var idx=0;idx<len;idx++) {\n      var next = this.nextObject(idx, last, context) ;\n      callback.call(target, next, idx, this);\n      last = next ;\n    }\n    last = null ;\n    context = pushCtx(context);\n    return this ;\n  },\n\n  /**\n    Retrieves the named value on each member object. This is more efficient\n    than using one of the wrapper methods defined here. Objects that\n    implement SC.Observable will use the get() method, otherwise the property\n    will be accessed directly.\n\n    @param {String} key The key to retrieve\n    @returns {Array} Extracted values\n  */\n  getEach: function(key) {\n    return this.map(function(item) {\n      return get(item, key);\n    });\n  },\n\n  /**\n    Sets the value on the named property for each member. This is more\n    efficient than using other methods defined on this helper. If the object\n    implements SC.Observable, the value will be changed to set(), otherwise\n    it will be set directly. null objects are skipped.\n\n    @param {String} key The key to set\n    @param {Object} value The object to set\n    @returns {Object} receiver\n  */\n  setEach: function(key, value) {\n    return this.forEach(function(item) {\n      set(item, key, value);\n    });\n  },\n\n  /**\n    Maps all of the items in the enumeration to another value, returning\n    a new array. This method corresponds to map() defined in JavaScript 1.6.\n\n    The callback method you provide should have the following signature (all\n    parameters are optional):\n\n        function(item, index, enumerable);\n\n    - *item* is the current item in the iteration.\n    - *index* is the current index in the iteration\n    - *enumerable* is the enumerable object itself.\n\n    It should return the mapped value.\n\n    Note that in addition to a callback, you can also pass an optional target\n    object that will be set as \"this\" on the context. This is a good way\n    to give your iterator function access to the current object.\n\n    @param {Function} callback The callback to execute\n    @param {Object} target The target object to use\n    @returns {Array} The mapped array.\n  */\n  map: function(callback, target) {\n    var ret = [];\n    this.forEach(function(x, idx, i) { \n      ret[idx] = callback.call(target, x, idx,i); \n    });\n    return ret ;\n  },\n\n  /**\n    Similar to map, this specialized function returns the value of the named\n    property on all items in the enumeration.\n\n    @params key {String} name of the property\n    @returns {Array} The mapped array.\n  */\n  mapProperty: function(key) {\n    return this.map(function(next) {\n      return get(next, key);\n    });\n  },\n\n  /**\n    Returns an array with all of the items in the enumeration that the passed\n    function returns YES for. This method corresponds to filter() defined in\n    JavaScript 1.6.\n\n    The callback method you provide should have the following signature (all\n    parameters are optional):\n\n          function(item, index, enumerable);\n\n    - *item* is the current item in the iteration.\n    - *index* is the current index in the iteration\n    - *enumerable* is the enumerable object itself.\n\n    It should return the YES to include the item in the results, NO otherwise.\n\n    Note that in addition to a callback, you can also pass an optional target\n    object that will be set as \"this\" on the context. This is a good way\n    to give your iterator function access to the current object.\n\n    @param {Function} callback The callback to execute\n    @param {Object} target The target object to use\n    @returns {Array} A filtered array.\n  */\n  filter: function(callback, target) {\n    var ret = [];\n    this.forEach(function(x, idx, i) {\n      if (callback.call(target, x, idx, i)) ret.push(x);\n    });\n    return ret ;\n  },\n\n  /**\n    Returns an array with just the items with the matched property.  You\n    can pass an optional second argument with the target value.  Otherwise\n    this will match any property that evaluates to true.\n\n    @params key {String} the property to test\n    @param value {String} optional value to test against.\n    @returns {Array} filtered array\n  */\n  filterProperty: function(key, value) {\n    return this.filter(iter(key, value));\n  },\n\n  /**\n    Returns the first item in the array for which the callback returns YES.\n    This method works similar to the filter() method defined in JavaScript 1.6\n    except that it will stop working on the array once a match is found.\n\n    The callback method you provide should have the following signature (all\n    parameters are optional):\n\n          function(item, index, enumerable);\n\n    - *item* is the current item in the iteration.\n    - *index* is the current index in the iteration\n    - *enumerable* is the enumerable object itself.\n\n    It should return the YES to include the item in the results, NO otherwise.\n\n    Note that in addition to a callback, you can also pass an optional target\n    object that will be set as \"this\" on the context. This is a good way\n    to give your iterator function access to the current object.\n\n    @param {Function} callback The callback to execute\n    @param {Object} target The target object to use\n    @returns {Object} Found item or null.\n  */\n  find: function(callback, target) {\n    var len = get(this, 'length') ;\n    if (target === undefined) target = null;\n\n    var last = null, next, found = false, ret ;\n    var context = popCtx();\n    for(var idx=0;idx<len && !found;idx++) {\n      next = this.nextObject(idx, last, context) ;\n      if (found = callback.call(target, next, idx, this)) ret = next ;\n      last = next ;\n    }\n    next = last = null ;\n    context = pushCtx(context);\n    return ret ;\n  },\n\n  /**\n    Returns an the first item with a property matching the passed value.  You\n    can pass an optional second argument with the target value.  Otherwise\n    this will match any property that evaluates to true.\n\n    This method works much like the more generic find() method.\n\n    @params key {String} the property to test\n    @param value {String} optional value to test against.\n    @returns {Object} found item or null\n  */\n  findProperty: function(key, value) {\n    return this.find(iter(key, value));\n  },\n\n  /**\n    Returns YES if the passed function returns YES for every item in the\n    enumeration. This corresponds with the every() method in JavaScript 1.6.\n\n    The callback method you provide should have the following signature (all\n    parameters are optional):\n\n          function(item, index, enumerable);\n\n    - *item* is the current item in the iteration.\n    - *index* is the current index in the iteration\n    - *enumerable* is the enumerable object itself.\n\n    It should return the YES or NO.\n\n    Note that in addition to a callback, you can also pass an optional target\n    object that will be set as \"this\" on the context. This is a good way\n    to give your iterator function access to the current object.\n\n    Example Usage:\n\n          if (people.every(isEngineer)) { Paychecks.addBigBonus(); }\n\n    @param {Function} callback The callback to execute\n    @param {Object} target The target object to use\n    @returns {Boolean}\n  */\n  every: function(callback, target) {\n    return !this.find(function(x, idx, i) {\n      return !callback.call(target, x, idx, i);\n    });\n  },\n\n  /**\n    Returns true if the passed property resolves to true for all items in the\n    enumerable.  This method is often simpler/faster than using a callback.\n\n    @params key {String} the property to test\n    @param value {String} optional value to test against.\n    @returns {Array} filtered array\n  */\n  everyProperty: function(key, value) {\n    return this.every(iter(key, value));\n  },\n\n\n  /**\n    Returns YES if the passed function returns true for any item in the\n    enumeration. This corresponds with the every() method in JavaScript 1.6.\n\n    The callback method you provide should have the following signature (all\n    parameters are optional):\n\n          function(item, index, enumerable);\n\n    - *item* is the current item in the iteration.\n    - *index* is the current index in the iteration\n    - *enumerable* is the enumerable object itself.\n\n    It should return the YES to include the item in the results, NO otherwise.\n\n    Note that in addition to a callback, you can also pass an optional target\n    object that will be set as \"this\" on the context. This is a good way\n    to give your iterator function access to the current object.\n\n    Usage Example:\n\n          if (people.some(isManager)) { Paychecks.addBiggerBonus(); }\n\n    @param {Function} callback The callback to execute\n    @param {Object} target The target object to use\n    @returns {Array} A filtered array.\n  */\n  some: function(callback, target) {\n    return !!this.find(function(x, idx, i) {\n      return !!callback.call(target, x, idx, i);\n    });\n  },\n\n  /**\n    Returns true if the passed property resolves to true for any item in the\n    enumerable.  This method is often simpler/faster than using a callback.\n\n    @params key {String} the property to test\n    @param value {String} optional value to test against.\n    @returns {Boolean} true\n  */\n  someProperty: function(key, value) {\n    return this.some(iter(key, value));\n  },\n\n  /**\n    This will combine the values of the enumerator into a single value. It\n    is a useful way to collect a summary value from an enumeration. This\n    corresponds to the reduce() method defined in JavaScript 1.8.\n\n    The callback method you provide should have the following signature (all\n    parameters are optional):\n\n          function(previousValue, item, index, enumerable);\n\n    - *previousValue* is the value returned by the last call to the iterator.\n    - *item* is the current item in the iteration.\n    - *index* is the current index in the iteration\n    - *enumerable* is the enumerable object itself.\n\n    Return the new cumulative value.\n\n    In addition to the callback you can also pass an initialValue. An error\n    will be raised if you do not pass an initial value and the enumerator is\n    empty.\n\n    Note that unlike the other methods, this method does not allow you to\n    pass a target object to set as this for the callback. It's part of the\n    spec. Sorry.\n\n    @param {Function} callback The callback to execute\n    @param {Object} initialValue Initial value for the reduce\n    @param {String} reducerProperty internal use only.\n    @returns {Object} The reduced value.\n  */\n  reduce: function(callback, initialValue, reducerProperty) {\n    if (typeof callback !== \"function\") { throw new TypeError(); }\n\n    var ret = initialValue;\n\n    this.forEach(function(item, i) {\n      ret = callback.call(null, ret, item, i, this, reducerProperty);\n    }, this);\n\n    return ret;\n  },\n\n  /**\n    Invokes the named method on every object in the receiver that\n    implements it.  This method corresponds to the implementation in\n    Prototype 1.6.\n\n    @param methodName {String} the name of the method\n    @param args {Object...} optional arguments to pass as well.\n    @returns {Array} return values from calling invoke.\n  */\n  invoke: function(methodName) {\n    var args, ret = [];\n    if (arguments.length>1) args = Array.prototype.slice.call(arguments, 1);\n    \n    this.forEach(function(x, idx) { \n      var method = x && x[methodName];\n      if ('function' === typeof method) {\n        ret[idx] = args ? method.apply(x, args) : method.call(x);\n      }\n    }, this);\n    \n    return ret;\n  },\n\n  /**\n    Simply converts the enumerable into a genuine array.  The order is not \n    gauranteed.  Corresponds to the method implemented by Prototype.\n\n    @returns {Array} the enumerable as an array.\n  */\n  toArray: function() {\n    var ret = [];\n    this.forEach(function(o, idx) { ret[idx] = o; });\n    return ret ;\n  },\n\n  /**\n    Generates a new array with the contents of the old array, sans any null\n    values.\n\n    @returns {Array}\n  */\n  compact: function() { return this.without(null); },\n\n  /**\n    Returns a new enumerable that excludes the passed value.  The default\n    implementation returns an array regardless of the receiver type unless\n    the receiver does not contain the value.\n\n    @param {Object} value\n    @returns {SC.Enumerable}\n  */\n  without: function(value) {\n    if (!this.contains(value)) return this; // nothing to do\n    var ret = [] ;\n    this.forEach(function(k) { \n      if (k !== value) ret[ret.length] = k;\n    }) ;\n    return ret ;\n  },\n\n  /**\n    Returns a new enumerable that contains only unique values.  The default\n    implementation returns an array regardless of the receiver type.\n    \n    @returns {SC.Enumerable}\n  */\n  uniq: function() {\n    var ret = [], hasDups = false;\n    this.forEach(function(k){\n      if (ret.indexOf(k)<0) ret[ret.length] = k;\n      else hasDups = true;\n    });\n    \n    return hasDups ? ret : this ;\n  },\n\n  /**\n    This property will trigger anytime the enumerable's content changes.\n    You can observe this property to be notified of changes to the enumerables\n    content.\n\n    For plain enumerables, this property is read only.  SC.Array overrides\n    this method.\n\n    @property {SC.Array}\n  */\n  '[]': SC.computed(function(key, value) { \n    return this; \n  }).property().cacheable(),\n\n  // ..........................................................\n  // ENUMERABLE OBSERVERS\n  // \n  \n  /**\n    Registers an enumerable observer.   Must implement SC.EnumerableObserver\n    mixin.\n  */\n  addEnumerableObserver: function(target, opts) {\n    var willChange = (opts && opts.willChange) || 'enumerableWillChange',\n        didChange  = (opts && opts.didChange) || 'enumerableDidChange';\n\n    var hasObservers = get(this, 'hasEnumerableObservers');\n    if (!hasObservers) SC.propertyWillChange(this, 'hasEnumerableObservers');\n    SC.addListener(this, '@enumerable:before', target, willChange, xform);\n    SC.addListener(this, '@enumerable:change', target, didChange, xform);\n    if (!hasObservers) SC.propertyDidChange(this, 'hasEnumerableObservers');\n    return this;\n  },\n\n  /**\n    Removes a registered enumerable observer. \n  */\n  removeEnumerableObserver: function(target, opts) {\n    var willChange = (opts && opts.willChange) || 'enumerableWillChange',\n        didChange  = (opts && opts.didChange) || 'enumerableDidChange';\n\n    var hasObservers = get(this, 'hasEnumerableObservers');\n    if (hasObservers) SC.propertyWillChange(this, 'hasEnumerableObservers');\n    SC.removeListener(this, '@enumerable:before', target, willChange);\n    SC.removeListener(this, '@enumerable:change', target, didChange);\n    if (hasObservers) SC.propertyDidChange(this, 'hasEnumerableObservers');\n    return this;\n  },\n  \n  /**\n    Becomes true whenever the array currently has observers watching changes\n    on the array.\n    \n    @property {Boolean}\n  */\n  hasEnumerableObservers: SC.computed(function() {\n    return SC.hasListeners(this, '@enumerable:change') || SC.hasListeners(this, '@enumerable:before');\n  }).property().cacheable(),\n  \n  \n  /**\n    Invoke this method just before the contents of your enumerable will \n    change.  You can either omit the parameters completely or pass the objects\n    to be removed or added if available or just a count.\n    \n    @param {SC.Enumerable|Number} removing\n      An enumerable of the objects to be removed or the number of items to\n      be removed.\n      \n    @param {SC.Enumerable|Number} adding\n      An enumerable of the objects to be added or the number of items to be\n      added.\n    \n    @returns {SC.Enumerable} receiver\n  */\n  enumerableContentWillChange: function(removing, adding) {\n    \n    var removeCnt, addCnt, hasDelta;\n\n    if ('number' === typeof removing) removeCnt = removing;\n    else if (removing) removeCnt = get(removing, 'length');\n    else removeCnt = removing = -1;\n\n    if ('number' === typeof adding) addCnt = adding;\n    else if (adding) addCnt = get(adding,'length');\n    else addCnt = adding = -1;\n    \n    hasDelta = addCnt<0 || removeCnt<0 || addCnt-removeCnt!==0;\n\n    if (removing === -1) removing = null;\n    if (adding   === -1) adding   = null;\n    \n    SC.propertyWillChange(this, '[]');\n    if (hasDelta) SC.propertyWillChange(this, 'length');\n    SC.sendEvent(this, '@enumerable:before', removing, adding);\n\n    return this;\n  },\n  \n  /**\n    Invoke this method when the contents of your enumerable has changed.\n    This will notify any observers watching for content changes.  If your are\n    implementing an ordered enumerable (such as an array), also pass the\n    start and end values where the content changed so that it can be used to\n    notify range observers.\n\n    @param {Number} start \n      optional start offset for the content change.  For unordered \n      enumerables, you should always pass -1.\n      \n    @param {Enumerable} added\n      optional enumerable containing items that were added to the set.  For\n      ordered enumerables, this should be an ordered array of items.  If no\n      items were added you can pass null.\n    \n    @param {Enumerable} removes\n      optional enumerable containing items that were removed from the set. \n      For ordered enumerables, this hsould be an ordered array of items. If \n      no items were removed you can pass null.\n      \n    @returns {Object} receiver\n  */\n  enumerableContentDidChange: function(removing, adding) {\n    var notify = this.propertyDidChange, removeCnt, addCnt, hasDelta;\n\n    if ('number' === typeof removing) removeCnt = removing;\n    else if (removing) removeCnt = get(removing, 'length');\n    else removeCnt = removing = -1;\n\n    if ('number' === typeof adding) addCnt = adding;\n    else if (adding) addCnt = get(adding, 'length');\n    else addCnt = adding = -1;\n    \n    hasDelta = addCnt<0 || removeCnt<0 || addCnt-removeCnt!==0;\n\n    if (removing === -1) removing = null;\n    if (adding   === -1) adding   = null;\n    \n    SC.sendEvent(this, '@enumerable:change', removing, adding);\n    if (hasDelta) SC.propertyDidChange(this, 'length');\n    SC.propertyDidChange(this, '[]');\n\n    return this ;\n  }\n\n}) ;\n\n\n\n\n});");spade.register("sproutcore-runtime/mixins/freezable", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2010 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\n\n\n\n  \nvar get = SC.get, set = SC.set;\n\n/**\n  @namespace\n\n  The SC.Freezable mixin implements some basic methods for marking an object\n  as frozen. Once an object is frozen it should be read only. No changes\n  may be made the internal state of the object.\n\n  ## Enforcement\n\n  To fully support freezing in your subclass, you must include this mixin and\n  override any method that might alter any property on the object to instead\n  raise an exception. You can check the state of an object by checking the\n  isFrozen property.\n\n  Although future versions of JavaScript may support language-level freezing\n  object objects, that is not the case today. Even if an object is freezable,\n  it is still technically possible to modify the object, even though it could\n  break other parts of your application that do not expect a frozen object to\n  change. It is, therefore, very important that you always respect the\n  isFrozen property on all freezable objects.\n\n  ## Example Usage\n\n  The example below shows a simple object that implement the SC.Freezable\n  protocol.\n\n        Contact = SC.Object.extend(SC.Freezable, {\n\n          firstName: null,\n\n          lastName: null,\n\n          // swaps the names\n          swapNames: function() {\n            if (this.get('isFrozen')) throw SC.FROZEN_ERROR;\n            var tmp = this.get('firstName');\n            this.set('firstName', this.get('lastName'));\n            this.set('lastName', tmp);\n            return this;\n          }\n\n        });\n\n        c = Context.create({ firstName: \"John\", lastName: \"Doe\" });\n        c.swapNames();  => returns c\n        c.freeze();\n        c.swapNames();  => EXCEPTION\n\n  ## Copying\n\n  Usually the SC.Freezable protocol is implemented in cooperation with the\n  SC.Copyable protocol, which defines a frozenCopy() method that will return\n  a frozen object, if the object implements this method as well.\n\n  @since SproutCore 1.0\n*/\nSC.Freezable = SC.Mixin.create({\n\n  /**\n    Set to YES when the object is frozen.  Use this property to detect whether\n    your object is frozen or not.\n\n    @property {Boolean}\n  */\n  isFrozen: false,\n\n  /**\n    Freezes the object.  Once this method has been called the object should\n    no longer allow any properties to be edited.\n\n    @returns {Object} reciever\n  */\n  freeze: function() {\n    if (get(this, 'isFrozen')) return this;\n    set(this, 'isFrozen', true);\n    return this;\n  }\n\n});\n\nSC.FROZEN_ERROR = \"Frozen object cannot be modified.\";\n\n\n\n\n});");spade.register("sproutcore-runtime/mixins/mutable_array", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\n\nrequire('sproutcore-runtime/mixins/array');\nrequire('sproutcore-runtime/mixins/mutable_enumerable');\n\n// ..........................................................\n// CONSTANTS\n// \n\nvar OUT_OF_RANGE_EXCEPTION = \"Index out of range\" ;\nvar EMPTY = [];\n\n// ..........................................................\n// HELPERS\n// \n\nvar get = SC.get, set = SC.set;\n\n/**\n  @class\n\n  This mixin defines the API for modifying array-like objects.  These methods\n  can be applied only to a collection that keeps its items in an ordered set.\n  \n  Note that an Array can change even if it does not implement this mixin.\n  For example, a SparyArray may not be directly modified but if its \n  underlying enumerable changes, it will change also.\n\n  @extends SC.Mixin\n  @extends SC.Array\n  @extends SC.MutableEnumerable\n*/\nSC.MutableArray = SC.Mixin.create(SC.Array, SC.MutableEnumerable,\n  /** @scope SC.MutableArray.prototype */ {\n\n  /**\n    __Required.__ You must implement this method to apply this mixin.\n\n    This is one of the primitves you must implement to support SC.Array.  You\n    should replace amt objects started at idx with the objects in the passed\n    array.  You should also call this.enumerableContentDidChange() ;\n\n    @param {Number} idx\n      Starting index in the array to replace.  If idx >= length, then append \n      to the end of the array.\n\n    @param {Number} amt\n      Number of elements that should be removed from the array, starting at\n      *idx*.\n\n    @param {Array} objects\n      An array of zero or more objects that should be inserted into the array \n      at *idx*\n  */\n  replace: SC.required(),\n\n  /**\n    This will use the primitive replace() method to insert an object at the\n    specified index.\n\n    @param {Number} idx index of insert the object at.\n    @param {Object} object object to insert\n  */\n  insertAt: function(idx, object) {\n    if (idx > get(this, 'length')) throw new Error(OUT_OF_RANGE_EXCEPTION) ;\n    this.replace(idx, 0, [object]) ;\n    return this ;\n  },\n\n  /**\n    Remove an object at the specified index using the replace() primitive\n    method.  You can pass either a single index, a start and a length or an\n    index set.\n\n    If you pass a single index or a start and length that is beyond the\n    length this method will throw an SC.OUT_OF_RANGE_EXCEPTION\n\n    @param {Number|SC.IndexSet} start index, start of range, or index set\n    @param {Number} len length of passing range\n    @returns {Object} receiver\n  */\n  removeAt: function(start, len) {\n\n    var delta = 0;\n\n    if ('number' === typeof start) {\n\n      if ((start < 0) || (start >= get(this, 'length'))) {\n        throw new Error(OUT_OF_RANGE_EXCEPTION);\n      }\n\n      // fast case\n      if (len === undefined) len = 1;\n      this.replace(start, len, EMPTY);\n    }\n\n    // TODO: Reintroduce SC.IndexSet support\n    // this.beginPropertyChanges();\n    // start.forEachRange(function(start, length) {\n    //   start -= delta ;\n    //   delta += length ;\n    //   this.replace(start, length, empty); // remove!\n    // }, this);\n    // this.endPropertyChanges();\n\n    return this ;\n  },\n\n  /**\n    Push the object onto the end of the array.  Works just like push() but it\n    is KVO-compliant.\n  */\n  pushObject: function(obj) {\n    this.insertAt(get(this, 'length'), obj) ;\n    return obj ;\n  },\n\n\n  /**\n    Add the objects in the passed numerable to the end of the array.  Defers\n    notifying observers of the change until all objects are added.\n\n    @param {SC.Enumerable} objects the objects to add\n    @returns {SC.Array} receiver\n  */\n  pushObjects: function(objects) {\n    this.beginPropertyChanges();\n    objects.forEach(function(obj) { this.pushObject(obj); }, this);\n    this.endPropertyChanges();\n    return this;\n  },\n\n  /**\n    Pop object from array or nil if none are left.  Works just like pop() but\n    it is KVO-compliant.\n  */\n  popObject: function() {\n    var len = get(this, 'length') ;\n    if (len === 0) return null ;\n\n    var ret = this.objectAt(len-1) ;\n    this.removeAt(len-1, 1) ;\n    return ret ;\n  },\n\n  /**\n    Shift an object from start of array or nil if none are left.  Works just\n    like shift() but it is KVO-compliant.\n  */\n  shiftObject: function() {\n    if (get(this, 'length') === 0) return null ;\n    var ret = this.objectAt(0) ;\n    this.removeAt(0) ;\n    return ret ;\n  },\n\n  /**\n    Unshift an object to start of array.  Works just like unshift() but it is\n    KVO-compliant.\n  */\n  unshiftObject: function(obj) {\n    this.insertAt(0, obj) ;\n    return obj ;\n  },\n\n\n  /**\n    Adds the named objects to the beginning of the array.  Defers notifying\n    observers until all objects have been added.\n\n    @param {SC.Enumerable} objects the objects to add\n    @returns {SC.Array} receiver\n  */\n  unshiftObjects: function(objects) {\n    this.beginPropertyChanges();\n    objects.forEach(function(obj) { this.unshiftObject(obj); }, this);\n    this.endPropertyChanges();\n    return this;\n  },\n  \n  // ..........................................................\n  // IMPLEMENT SC.MutableEnumerable\n  // \n\n  /** @private (nodoc) */\n  removeObject: function(obj) {\n    var loc = get(this, 'length') || 0;\n    while(--loc >= 0) {\n      var curObject = this.objectAt(loc) ;\n      if (curObject === obj) this.removeAt(loc) ;\n    }\n    return this ;\n  },\n  \n  /** @private (nodoc) */\n  addObject: function(obj) {\n    if (!this.contains(obj)) this.pushObject(obj);\n    return this ;\n  }\n    \n});\n\n\n});");spade.register("sproutcore-runtime/mixins/mutable_enumerable", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\n\nrequire('sproutcore-runtime/mixins/enumerable');\n\n/**\n  @class\n\n  This mixin defines the API for modifying generic enumerables.  These methods\n  can be applied to an object regardless of whether it is ordered or \n  unordered.\n  \n  Note that an Enumerable can change even if it does not implement this mixin.\n  For example, a MappedEnumerable cannot be directly modified but if its \n  underlying enumerable changes, it will change also.\n\n  ## Adding Objects\n  \n  To add an object to an enumerable, use the addObject() method.  This \n  method will only add the object to the enumerable if the object is not \n  already present and the object if of a type supported by the enumerable.\n  \n      javascript:\n      set.addObject(contact);\n      \n  ## Removing Objects\n  \n  To remove an object form an enumerable, use the removeObject() method.  This\n  will only remove the object if it is already in the enumerable, otherwise\n  this method has no effect.\n  \n      javascript:\n      set.removeObject(contact);\n      \n  ## Implementing In Your Own Code\n  \n  If you are implementing an object and want to support this API, just include\n  this mixin in your class and implement the required methods.  In your unit\n  tests, be sure to apply the SC.MutableEnumerableTests to your object.\n  \n  @extends SC.Mixin\n  @extends SC.Enumerable\n*/\nSC.MutableEnumerable = SC.Mixin.create(SC.Enumerable, \n  /** @scope SC.MutableEnumerable.prototype */ {\n  \n  /**\n    __Required.__ You must implement this method to apply this mixin.\n    \n    Attempts to add the passed object to the receiver if the object is not \n    already present in the collection. If the object is present, this method\n    has no effect. \n    \n    If the passed object is of a type not supported by the receiver (for \n    example if you pass an object to an IndexSet) then this method should \n    raise an exception.\n    \n    @param {Object} object\n      The object to add to the enumerable.\n      \n    @returns {Object} the passed object\n  */\n  addObject: SC.required(Function),\n\n  /**\n    Adds each object in the passed enumerable to the receiver.\n\n    @param {SC.Enumerable} objects the objects to remove\n    @returns {Object} receiver\n  */\n  addObjects: function(objects) {\n    SC.beginPropertyChanges(this);\n    objects.forEach(function(obj) { this.addObject(obj); }, this);\n    SC.endPropertyChanges(this);\n    return this;\n  },\n\n  /**\n    __Required.__ You must implement this method to apply this mixin.\n    \n    Attempts to remove the passed object from the receiver collection if the\n    object is in present in the collection.  If the object is not present,\n    this method has no effect.\n    \n    If the passed object is of a type not supported by the receiver (for \n    example if you pass an object to an IndexSet) then this method should \n    raise an exception.\n    \n    @param {Object} object\n      The object to remove from the enumerable.\n      \n    @returns {Object} the passed object\n  */\n  removeObject: SC.required(Function),\n  \n  \n  /**\n    Removes each objects in the passed enumerable from the receiver.\n\n    @param {SC.Enumerable} objects the objects to remove\n    @returns {Object} receiver\n  */\n  removeObjects: function(objects) {\n    SC.beginPropertyChanges(this);\n    objects.forEach(function(obj) { this.removeObject(obj); }, this);\n    SC.endPropertyChanges(this);\n    return this;\n  }\n    \n});\n\n});");spade.register("sproutcore-runtime/mixins/observable", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nvar get = SC.get, set = SC.set;\n  \n/**\n  @class\n\n  Restores some of the SC 1.x SC.Observable mixin API.  The new property \n  observing system does not require SC.Observable to be applied anymore.\n  Instead, on most browsers you can just access properties directly.  For\n  code that needs to run on IE7 or IE8 you should use SC.get() and SC.set()\n  instead.\n  \n  If you have older code and you want to bring back the older 1.x observable\n  API, you can do so by readding SC.Observable to SC.Object like so:\n  \n      SC.Object.reopen(SC.Observable);\n    \n  You will then be able to use the traditional get(), set() and other \n  observable methods on your objects.\n\n  @extends SC.Mixin\n*/\nSC.Observable = SC.Mixin.create(/** @scope SC.Observable.prototype */ {\n\n  /** @private - compatibility */\n  isObserverable: true,\n  \n  /**\n    Retrieves the value of key from the object.\n\n    This method is generally very similar to using object[key] or object.key,\n    however it supports both computed properties and the unknownProperty\n    handler.\n\n    ## Computed Properties\n\n    Computed properties are methods defined with the property() modifier\n    declared at the end, such as:\n\n          fullName: function() {\n            return this.getEach('firstName', 'lastName').compact().join(' ');\n          }.property('firstName', 'lastName')\n\n    When you call get() on a computed property, the property function will be\n    called and the return value will be returned instead of the function\n    itself.\n\n    ## Unknown Properties\n\n    Likewise, if you try to call get() on a property whose values is\n    undefined, the unknownProperty() method will be called on the object.\n    If this method reutrns any value other than undefined, it will be returned\n    instead. This allows you to implement \"virtual\" properties that are\n    not defined upfront.\n\n    @param {String} key The property to retrieve\n    @returns {Object} The property value or undefined.\n  */\n  get: function(keyName) {\n    return get(this, keyName);\n  },\n  \n  /**\n    Sets the key equal to value.\n\n    This method is generally very similar to calling object[key] = value or\n    object.key = value, except that it provides support for computed\n    properties, the unknownProperty() method and property observers.\n\n    ## Computed Properties\n\n    If you try to set a value on a key that has a computed property handler\n    defined (see the get() method for an example), then set() will call\n    that method, passing both the value and key instead of simply changing\n    the value itself. This is useful for those times when you need to\n    implement a property that is composed of one or more member\n    properties.\n\n    ## Unknown Properties\n\n    If you try to set a value on a key that is undefined in the target\n    object, then the unknownProperty() handler will be called instead. This\n    gives you an opportunity to implement complex \"virtual\" properties that\n    are not predefined on the obejct. If unknownProperty() returns\n    undefined, then set() will simply set the value on the object.\n\n    ## Property Observers\n\n    In addition to changing the property, set() will also register a\n    property change with the object. Unless you have placed this call\n    inside of a beginPropertyChanges() and endPropertyChanges(), any \"local\"\n    observers (i.e. observer methods declared on the same object), will be\n    called immediately. Any \"remote\" observers (i.e. observer methods\n    declared on another object) will be placed in a queue and called at a\n    later time in a coelesced manner.\n\n    ## Chaining\n\n    In addition to property changes, set() returns the value of the object\n    itself so you can do chaining like this:\n\n          record.set('firstName', 'Charles').set('lastName', 'Jolley');\n\n    @param {String} key The property to set\n    @param {Object} value The value to set or null.\n    @returns {SC.Observable}\n  */\n  set: function(keyName, value) {\n    set(this, keyName, value);\n    return this;\n  },\n  \n  /**\n    To set multiple properties at once, call setProperties\n    with a Hash:\n\n          record.setProperties({ firstName: 'Charles', lastName: 'Jolley' });\n\n    @param {Hash} hash the hash of keys and values to set\n    @returns {SC.Observable}\n  */\n  setProperties: function(hash) {\n    SC.beginPropertyChanges(this);\n    for(var prop in hash) {\n      if (hash.hasOwnProperty(prop)) set(this, prop, hash[prop]);\n    }\n    SC.endPropertyChanges(this);\n    return this;\n  },\n\n  /**\n    Begins a grouping of property changes.\n\n    You can use this method to group property changes so that notifications\n    will not be sent until the changes are finished. If you plan to make a\n    large number of changes to an object at one time, you should call this\n    method at the beginning of the changes to suspend change notifications.\n    When you are done making changes, call endPropertyChanges() to allow\n    notification to resume.\n\n    @returns {SC.Observable}\n  */\n  beginPropertyChanges: function() {\n    SC.beginPropertyChanges();\n    return this;\n  },\n  \n  /**\n    Ends a grouping of property changes.\n\n    You can use this method to group property changes so that notifications\n    will not be sent until the changes are finished. If you plan to make a\n    large number of changes to an object at one time, you should call\n    beginPropertyChanges() at the beginning of the changes to suspend change\n    notifications. When you are done making changes, call this method to allow\n    notification to resume.\n\n    @returns {SC.Observable}\n  */\n  endPropertyChanges: function() {\n    SC.endPropertyChanges();\n    return this;\n  },\n  \n  /**\n    Notify the observer system that a property is about to change.\n\n    Sometimes you need to change a value directly or indirectly without\n    actually calling get() or set() on it. In this case, you can use this\n    method and propertyDidChange() instead. Calling these two methods\n    together will notify all observers that the property has potentially\n    changed value.\n\n    Note that you must always call propertyWillChange and propertyDidChange as\n    a pair. If you do not, it may get the property change groups out of order\n    and cause notifications to be delivered more often than you would like.\n\n    @param {String} key The property key that is about to change.\n    @returns {SC.Observable}\n  */\n  propertyWillChange: function(keyName){\n    SC.propertyWillChange(this, keyName);\n    return this;\n  },\n  \n  /**\n    Notify the observer system that a property has just changed.\n\n    Sometimes you need to change a value directly or indirectly without\n    actually calling get() or set() on it. In this case, you can use this\n    method and propertyWillChange() instead. Calling these two methods\n    together will notify all observers that the property has potentially\n    changed value.\n\n    Note that you must always call propertyWillChange and propertyDidChange as\n    a pair. If you do not, it may get the property change groups out of order\n    and cause notifications to be delivered more often than you would like.\n\n    @param {String} key The property key that has just changed.\n    @param {Object} value The new value of the key. May be null.\n    @param {Boolean} _keepCache Private property\n    @returns {SC.Observable}\n  */\n  propertyDidChange: function(keyName) {\n    SC.propertyDidChange(this, keyName);\n    return this;\n  },\n  \n  notifyPropertyChange: function(keyName) {\n    this.propertyWillChange(keyName);\n    this.propertyDidChange(keyName);\n    return this;\n  }, \n\n  /**\n    Adds an observer on a property.\n\n    This is the core method used to register an observer for a property.\n\n    Once you call this method, anytime the key's value is set, your observer\n    will be notified. Note that the observers are triggered anytime the\n    value is set, regardless of whether it has actually changed. Your\n    observer should be prepared to handle that.\n\n    You can also pass an optional context parameter to this method. The\n    context will be passed to your observer method whenever it is triggered.\n    Note that if you add the same target/method pair on a key multiple times\n    with different context parameters, your observer will only be called once\n    with the last context you passed.\n\n    ## Observer Methods\n\n    Observer methods you pass should generally have the following signature if\n    you do not pass a \"context\" parameter:\n\n          fooDidChange: function(sender, key, value, rev);\n\n    The sender is the object that changed. The key is the property that\n    changes. The value property is currently reserved and unused. The rev\n    is the last property revision of the object when it changed, which you can\n    use to detect if the key value has really changed or not.\n\n    If you pass a \"context\" parameter, the context will be passed before the\n    revision like so:\n\n          fooDidChange: function(sender, key, value, context, rev);\n\n    Usually you will not need the value, context or revision parameters at\n    the end. In this case, it is common to write observer methods that take\n    only a sender and key value as parameters or, if you aren't interested in\n    any of these values, to write an observer that has no parameters at all.\n\n    @param {String} key The key to observer\n    @param {Object} target The target object to invoke\n    @param {String|Function} method The method to invoke.\n    @returns {SC.Object} self\n  */\n  addObserver: function(key, target, method) {\n    SC.addObserver(this, key, target, method);\n  },\n  \n  /**\n    Remove an observer you have previously registered on this object. Pass\n    the same key, target, and method you passed to addObserver() and your\n    target will no longer receive notifications.\n\n    @param {String} key The key to observer\n    @param {Object} target The target object to invoke\n    @param {String|Function} method The method to invoke.\n    @returns {SC.Observable} reciever\n  */\n  removeObserver: function(key, target, method) {\n    SC.removeObserver(this, key, target, method);\n  },\n  \n  /**\n    Returns YES if the object currently has observers registered for a\n    particular key. You can use this method to potentially defer performing\n    an expensive action until someone begins observing a particular property\n    on the object.\n\n    @param {String} key Key to check\n    @returns {Boolean}\n  */\n  hasObserverFor: function(key) {\n    return SC.hasListeners(this, key+':change');\n  },\n\n  unknownProperty: function(key) {\n    return undefined;\n  },\n  \n  setUnknownProperty: function(key, value) {\n    this[key] = value;\n  },\n  \n  getPath: function(path) {\n    return SC.getPath(this, path);\n  },\n  \n  setPath: function(path, value) {\n    SC.setPath(this, path, value);\n    return this;\n  },\n  \n  incrementProperty: function(keyName, increment) {\n    if (!increment) { increment = 1; }\n    set(this, keyName, (get(this, keyName) || 0)+increment);\n    return get(this, keyName);\n  },\n  \n  decrementProperty: function(keyName, increment) {\n    if (!increment) { increment = 1; }\n    set(this, keyName, (get(this, keyName) || 0)-increment);\n    return get(this, keyName);\n  },\n  \n  toggleProperty: function(keyName) {\n    set(this, keyName, !get(this, keyName));\n    return get(this, keyName);\n  },\n  \n  observersForKey: function(keyName) {\n    return SC.observersFor(this, keyName);\n  }\n    \n});\n\n\n\n\n});");spade.register("sproutcore-runtime/system", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/system/application');\nrequire('sproutcore-runtime/system/array_proxy');\nrequire('sproutcore-runtime/system/binding');\nrequire('sproutcore-runtime/system/core_object');\nrequire('sproutcore-runtime/system/each_proxy');\n\nrequire('sproutcore-runtime/system/namespace');\nrequire('sproutcore-runtime/system/native_array');\nrequire('sproutcore-runtime/system/object');\nrequire('sproutcore-runtime/system/run_loop');\nrequire('sproutcore-runtime/system/set');\nrequire('sproutcore-runtime/system/string');\n\n});");spade.register("sproutcore-runtime/system/application", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/system/namespace');\n\n/**\n  @private\n\n  Defines a namespace that will contain an executable application.  This is\n  very similar to a normal namespace except that it is expected to include at\n  least a 'ready' function which can be run to initialize the application.\n  \n  Currently SC.Application is very similar to SC.Namespace.  However, this\n  class may be augmented by additional frameworks so it is important to use\n  this instance when building new applications.\n  \n  # Example Usage\n  \n      MyApp = SC.Application.create({\n        VERSION: '1.0.0',\n        store: SC.Store.create().from(SC.fixtures)\n      });\n      \n      MyApp.ready = function() { \n        //..init code goes here...\n      }\n      \n*/\nSC.Application = SC.Namespace.extend();\n\n\n});");spade.register("sproutcore-runtime/system/array_proxy", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/mixins/mutable_array');\nrequire('sproutcore-runtime/system/object');\n\n\n  \nvar get = SC.get, set = SC.set;\n\n/**\n  @class\n\n  An ArrayProxy wraps any other object that implements SC.Array and/or \n  SC.MutableArray, forwarding all requests.  ArrayProxy isn't useful by itself\n  but you can extend it to do specialized things like transforming values,\n  etc.\n\n  @extends SC.Object\n  @extends SC.Array\n  @extends SC.MutableArray\n*/\nSC.ArrayProxy = SC.Object.extend(SC.MutableArray, {\n  \n  /**\n    The content array.  Must be an object that implements SC.Array and or\n    SC.MutableArray.\n    \n    @property {SC.Array}\n  */\n  content: null,\n\n  /**\n    Should actually retrieve the object at the specified index from the \n    content.  You can override this method in subclasses to transform the \n    content item to something new.\n    \n    This method will only be called if content is non-null.\n    \n    @param {Number} idx\n      The index to retreive.\n      \n    @returns {Object} the value or undefined if none found\n  */\n  objectAtContent: function(idx) {\n    return get(this, 'content').objectAt(idx);\n  },\n  \n  /**\n    Should actually replace the specified objects on the content array.  \n    You can override this method in subclasses to transform the content item\n    into something new.\n    \n    This method will only be called if content is non-null.\n    \n    @param {Number} idx\n      The starting index\n    \n    @param {Number} amt\n      The number of items to remove from the content.\n      \n    @param {Array} objects\n      Optional array of objects to insert or null if no objects.\n      \n    @returns {void}\n  */\n  replaceContent: function(idx, amt, objects) {\n    get(this, 'content').replace(idx, amt, objects);\n  },\n  \n  contentWillChange: SC.beforeObserver(function() {\n    var content = get(this, 'content'),\n        len     = content ? get(content, 'length') : 0;\n    this.arrayWillChange(content, 0, len, undefined);\n    if (content) content.removeArrayObserver(this);\n  }, 'content'),\n  \n  /**\n    Invoked when the content property changes.  Notifies observers that the\n    entire array content has changed.\n  */\n  contentDidChange: SC.observer(function() {\n    var content = get(this, 'content'),\n        len     = content ? get(content, 'length') : 0;\n    if (content) content.addArrayObserver(this);\n    this.arrayDidChange(content, 0, undefined, len);\n  }, 'content'),\n  \n  /** @private (nodoc) */\n  objectAt: function(idx) {\n    return get(this, 'content') && this.objectAtContent(idx);\n  },\n  \n  /** @private (nodoc) */\n  length: SC.computed(function() {\n    var content = get(this, 'content');\n    return content ? get(content, 'length') : 0;\n  }).property('content.length').cacheable(),\n  \n  /** @private (nodoc) */\n  replace: function(idx, amt, objects) {\n    if (get(this, 'content')) this.replaceContent(idx, amt, objects);\n    return this;\n  },\n  \n  /** @private (nodoc) */\n  arrayWillChange: function(item, idx, removedCnt, addedCnt) {\n    this.arrayContentWillChange(idx, removedCnt, addedCnt);\n  },\n  \n  /** @private (nodoc) */\n  arrayDidChange: function(item, idx, removedCnt, addedCnt) {\n    this.arrayContentDidChange(idx, removedCnt, addedCnt);\n  },\n  \n  init: function(content) {\n    this._super();\n    // TODO: Why is init getting called with a parameter? --TD\n    if (content) set(this, 'content', content);\n    this.contentDidChange();\n  }\n  \n});\n\n\n\n\n});");spade.register("sproutcore-runtime/system/binding", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals sc_assert */\n\n\nrequire('sproutcore-runtime/system/object');\nrequire('sproutcore-runtime/system/run_loop');\n\n// ..........................................................\n// CONSTANTS\n//\n\n\n/**\n  @static\n\n  Debug parameter you can turn on. This will log all bindings that fire to\n  the console. This should be disabled in production code. Note that you\n  can also enable this from the console or temporarily.\n\n  @type Boolean\n  @default NO\n*/\nSC.LOG_BINDINGS = false || !!SC.ENV.LOG_BINDINGS;\n\n/**\n  @static\n\n  Performance paramter. This will benchmark the time spent firing each\n  binding.\n\n  @type Boolean\n*/\nSC.BENCHMARK_BINDING_NOTIFICATIONS = !!SC.ENV.BENCHMARK_BINDING_NOTIFICATIONS;\n\n/**\n  @static\n\n  Performance parameter. This will benchmark the time spend configuring each\n  binding.\n\n  @type Boolean\n*/\nSC.BENCHMARK_BINDING_SETUP = !!SC.ENV.BENCHMARK_BINDING_SETUP;\n\n\n/**\n  @static\n\n  Default placeholder for multiple values in bindings.\n\n  @type String\n  @default '@@MULT@@'\n*/\nSC.MULTIPLE_PLACEHOLDER = '@@MULT@@';\n\n/**\n  @static\n\n  Default placeholder for empty values in bindings.  Used by notEmpty()\n  helper unless you specify an alternative.\n\n  @type String\n  @default '@@EMPTY@@'\n*/\nSC.EMPTY_PLACEHOLDER = '@@EMPTY@@';\n\n// ..........................................................\n// TYPE COERCION HELPERS\n//\n\n// Coerces a non-array value into an array.\nfunction MULTIPLE(val) {\n  if (val instanceof Array) return val;\n  if (val === undefined || val === null) return [];\n  return [val];\n}\n\n// Treats a single-element array as the element. Otherwise\n// returns a placeholder.\nfunction SINGLE(val, placeholder) {\n  if (val instanceof Array) {\n    if (val.length>1) return placeholder;\n    else return val[0];\n  }\n  return val;\n}\n\n// Coerces the binding value into a Boolean.\n\nvar BOOL = {\n  to: function (val) {\n    return !!val;\n  }\n};\n\n// Returns the Boolean inverse of the value.\nvar NOT = {\n  to: function NOT(val) {\n    return !val;\n  }\n};\n\nvar get     = SC.get,\n    getPath = SC.getPath,\n    setPath = SC.setPath,\n    guidFor = SC.guidFor;\n\n// Applies a binding's transformations against a value.\nfunction getTransformedValue(binding, val, obj, dir) {\n\n  // First run a type transform, if it exists, that changes the fundamental\n  // type of the value. For example, some transforms convert an array to a\n  // single object.\n\n  var typeTransform = binding._typeTransform;\n  if (typeTransform) { val = typeTransform(val, binding._placeholder); }\n\n  // handle transforms\n  var transforms = binding._transforms,\n      len        = transforms ? transforms.length : 0,\n      idx;\n\n  for(idx=0;idx<len;idx++) {\n    var transform = transforms[idx][dir];\n    if (transform) { val = transform.call(this, val, obj); }\n  }\n  return val;\n}\n\nfunction empty(val) {\n  return val===undefined || val===null || val==='' || (SC.isArray(val) && get(val, 'length')===0) ;\n}\n\nfunction getTransformedFromValue(obj, binding) {\n  var operation = binding._operation;\n  var fromValue = operation ? operation(obj, binding._from, binding._operand) : getPath(obj, binding._from);\n  return getTransformedValue(binding, fromValue, obj, 'to');\n}\n\nfunction getTransformedToValue(obj, binding) {\n  var toValue = getPath(obj, binding._to);\n  return getTransformedValue(binding, toValue, obj, 'from');\n}\n\nvar AND_OPERATION = function(obj, left, right) {\n  return getPath(obj, left) && getPath(obj, right);\n};\n\nvar OR_OPERATION = function(obj, left, right) {\n  return getPath(obj, left) || getPath(obj, right);\n};\n\n// ..........................................................\n// BINDING\n//\n\n/**\n  @class\n\n  A binding simply connects the properties of two objects so that whenever the\n  value of one property changes, the other property will be changed also. You\n  do not usually work with Binding objects directly but instead describe\n  bindings in your class definition using something like:\n\n        valueBinding: \"MyApp.someController.title\"\n\n  This will create a binding from `MyApp.someController.title` to the `value`\n  property of your object instance automatically. Now the two values will be\n  kept in sync.\n\n  ## Customizing Your Bindings\n\n  In addition to synchronizing values, bindings can also perform some basic\n  transforms on values. These transforms can help to make sure the data fed\n  into one object always meets the expectations of that object regardless of\n  what the other object outputs.\n\n  To customize a binding, you can use one of the many helper methods defined\n  on SC.Binding like so:\n\n        valueBinding: SC.Binding.single(\"MyApp.someController.title\")\n\n  This will create a binding just like the example above, except that now the\n  binding will convert the value of `MyApp.someController.title` to a single\n  object (removing any arrays) before applying it to the `value` property of\n  your object.\n\n  You can also chain helper methods to build custom bindings like so:\n\n        valueBinding: SC.Binding.single(\"MyApp.someController.title\").notEmpty(\"(EMPTY)\")\n\n  This will force the value of MyApp.someController.title to be a single value\n  and then check to see if the value is \"empty\" (null, undefined, empty array,\n  or an empty string). If it is empty, the value will be set to the string\n  \"(EMPTY)\".\n\n  ## One Way Bindings\n\n  One especially useful binding customization you can use is the `oneWay()`\n  helper. This helper tells SproutCore that you are only interested in\n  receiving changes on the object you are binding from. For example, if you\n  are binding to a preference and you want to be notified if the preference\n  has changed, but your object will not be changing the preference itself, you\n  could do:\n\n        bigTitlesBinding: SC.Binding.oneWay(\"MyApp.preferencesController.bigTitles\")\n\n  This way if the value of MyApp.preferencesController.bigTitles changes the\n  \"bigTitles\" property of your object will change also. However, if you\n  change the value of your \"bigTitles\" property, it will not update the\n  preferencesController.\n\n  One way bindings are almost twice as fast to setup and twice as fast to\n  execute because the binding only has to worry about changes to one side.\n\n  You should consider using one way bindings anytime you have an object that\n  may be created frequently and you do not intend to change a property; only\n  to monitor it for changes. (such as in the example above).\n\n  ## Adding Custom Transforms\n\n  In addition to using the standard helpers provided by SproutCore, you can\n  also defined your own custom transform functions which will be used to\n  convert the value. To do this, just define your transform function and add\n  it to the binding with the transform() helper. The following example will\n  not allow Integers less than ten. Note that it checks the value of the\n  bindings and allows all other values to pass:\n\n        valueBinding: SC.Binding.transform(function(value, binding) {\n          return ((SC.typeOf(value) === 'number') && (value < 10)) ? 10 : value;\n        }).from(\"MyApp.someController.value\")\n\n  If you would like to instead use this transform on a number of bindings,\n  you can also optionally add your own helper method to SC.Binding. This\n  method should simply return the value of `this.transform()`. The example\n  below adds a new helper called `notLessThan()` which will limit the value to\n  be not less than the passed minimum:\n\n      SC.Binding.reopen({\n        notLessThan: function(minValue) {\n          return this.transform(function(value, binding) {\n            return ((SC.typeOf(value) === 'number') && (value < minValue)) ? minValue : value;\n          });\n        }\n      });\n\n  You could specify this in your core.js file, for example. Then anywhere in\n  your application you can use it to define bindings like so:\n\n        valueBinding: SC.Binding.from(\"MyApp.someController.value\").notLessThan(10)\n\n  Also, remember that helpers are chained so you can use your helper along\n  with any other helpers. The example below will create a one way binding that\n  does not allow empty values or values less than 10:\n\n        valueBinding: SC.Binding.oneWay(\"MyApp.someController.value\").notEmpty().notLessThan(10)\n\n  ## How to Manually Adding Binding\n\n  All of the examples above show you how to configure a custom binding, but\n  the result of these customizations will be a binding template, not a fully\n  active binding. The binding will actually become active only when you\n  instantiate the object the binding belongs to. It is useful however, to\n  understand what actually happens when the binding is activated.\n\n  For a binding to function it must have at least a \"from\" property and a \"to\"\n  property. The from property path points to the object/key that you want to\n  bind from while the to path points to the object/key you want to bind to.\n\n  When you define a custom binding, you are usually describing the property\n  you want to bind from (such as \"MyApp.someController.value\" in the examples\n  above). When your object is created, it will automatically assign the value\n  you want to bind \"to\" based on the name of your binding key. In the\n  examples above, during init, SproutCore objects will effectively call\n  something like this on your binding:\n\n        binding = SC.Binding.from(this.valueBinding).to(\"value\");\n\n  This creates a new binding instance based on the template you provide, and\n  sets the to path to the \"value\" property of the new object. Now that the\n  binding is fully configured with a \"from\" and a \"to\", it simply needs to be\n  connected to become active. This is done through the connect() method:\n\n        binding.connect(this);\n\n  Note that when you connect a binding you pass the object you want it to be\n  connected to.  This object will be used as the root for both the from and\n  to side of the binding when inspecting relative paths.  This allows the\n  binding to be automatically inherited by subclassed objects as well.\n\n  Now that the binding is connected, it will observe both the from and to side\n  and relay changes.\n\n  If you ever needed to do so (you almost never will, but it is useful to\n  understand this anyway), you could manually create an active binding by\n  using the SC.bind() helper method. (This is the same method used by\n  to setup your bindings on objects):\n\n        SC.bind(MyApp.anotherObject, \"value\", \"MyApp.someController.value\");\n\n  Both of these code fragments have the same effect as doing the most friendly\n  form of binding creation like so:\n\n        MyApp.anotherObject = SC.Object.create({\n          valueBinding: \"MyApp.someController.value\",\n\n          // OTHER CODE FOR THIS OBJECT...\n\n        });\n\n  SproutCore's built in binding creation method makes it easy to automatically\n  create bindings for you. You should always use the highest-level APIs\n  available, even if you understand how to it works underneath.\n\n  @since SproutCore 1.0\n*/\nvar Binding = SC.Object.extend({\n\n  /** @private */\n  _direction: 'fwd',\n\n  /** @private */\n  init: function(toPath, fromPath) {\n    this._from = fromPath;\n    this._to   = toPath;\n  },\n\n  // ..........................................................\n  // CONFIG\n  //\n\n  /**\n    This will set \"from\" property path to the specified value. It will not\n    attempt to resolve this property path to an actual object until you\n    connect the binding.\n\n    The binding will search for the property path starting at the root object\n    you pass when you connect() the binding.  It follows the same rules as\n    `getPath()` - see that method for more information.\n\n    @param {String} propertyPath the property path to connect to\n    @returns {SC.Binding} receiver\n  */\n  from: function(object, path) {\n    if (!path) { path = object; object = null; }\n\n    this._from = path;\n    this._object = object;\n    return this;\n  },\n\n  /**\n    This will set the \"to\" property path to the specified value. It will not\n    attempt to reoslve this property path to an actual object until you\n    connect the binding.\n\n    The binding will search for the property path starting at the root object\n    you pass when you connect() the binding.  It follows the same rules as\n    `getPath()` - see that method for more information.\n\n    @param {String|Tuple} propertyPath A property path or tuple\n    @param {Object} [root] Root object to use when resolving the path.\n    @returns {SC.Binding} this\n  */\n  to: function(path) {\n    this._to = path;\n    return this;\n  },\n\n  /**\n    Configures the binding as one way. A one-way binding will relay changes\n    on the \"from\" side to the \"to\" side, but not the other way around. This\n    means that if you change the \"to\" side directly, the \"from\" side may have\n    a different value.\n\n    @param {Boolean} flag\n      (Optional) passing nothing here will make the binding oneWay.  You can\n      instead pass NO to disable oneWay, making the binding two way again.\n\n    @returns {SC.Binding} receiver\n  */\n  oneWay: function(flag) {\n    this._oneWay = flag===undefined ? true : !!flag;\n    return this;\n  },\n\n  /**\n    Adds the specified transform to the array of transform functions.\n\n    A transform is a hash with `to` and `from` properties. Each property\n    should be a function that performs a transformation in either the\n    forward or back direction.\n\n    The functions you pass must have the following signature:\n\n          function(value) {};\n\n    They must also return the transformed value.\n\n    Transforms are invoked in the order they were added. If you are\n    extending a binding and want to reset the transforms, you can call\n    `resetTransform()` first.\n\n    @param {Function} transformFunc the transform function.\n    @returns {SC.Binding} this\n  */\n  transform: function(transform) {\n    if ('function' === typeof transform) {\n      transform = { to: transform };\n    }\n\n    if (!this._transforms) this._transforms = [];\n    this._transforms.push(transform);\n    return this;\n  },\n\n  /**\n    Resets the transforms for the binding. After calling this method the\n    binding will no longer transform values. You can then add new transforms\n    as needed.\n\n    @returns {SC.Binding} this\n  */\n  resetTransforms: function() {\n    this._transforms = null;\n    return this;\n  },\n\n  /**\n    Adds a transform to the chain that will allow only single values to pass.\n    This will allow single values and nulls to pass through. If you pass an\n    array, it will be mapped as so:\n\n      - [] => null\n      - [a] => a\n      - [a,b,c] => Multiple Placeholder\n\n    You can pass in an optional multiple placeholder or it will use the\n    default.\n\n    Note that this transform will only happen on forwarded valued. Reverse\n    values are send unchanged.\n\n    @param {String} fromPath from path or null\n    @param {Object} [placeholder] Placeholder value.\n    @returns {SC.Binding} this\n  */\n  single: function(placeholder) {\n    if (placeholder===undefined) placeholder = SC.MULTIPLE_PLACEHOLDER;\n    this._typeTransform = SINGLE;\n    this._placeholder = placeholder;\n    return this;\n  },\n\n  /**\n    Adds a transform that will convert the passed value to an array. If\n    the value is null or undefined, it will be converted to an empty array.\n\n    @param {String} [fromPath]\n    @returns {SC.Binding} this\n  */\n  multiple: function() {\n    this._typeTransform = MULTIPLE;\n    this._placeholder = null;\n    return this;\n  },\n\n  /**\n    Adds a transform to convert the value to a bool value. If the value is\n    an array it will return YES if array is not empty. If the value is a\n    string it will return YES if the string is not empty.\n\n    @returns {SC.Binding} this\n  */\n  bool: function() {\n    this.transform(BOOL);\n    return this;\n  },\n\n  /**\n    Adds a transform that will return the placeholder value if the value is\n    null, undefined, an empty array or an empty string. See also notNull().\n\n    @param {Object} [placeholder] Placeholder value.\n    @returns {SC.Binding} this\n  */\n  notEmpty: function(placeholder) {\n    // Display warning for users using the SC 1.x-style API.\n    sc_assert(\"notEmpty should only take a placeholder as a parameter. You no longer need to pass null as the first parameter.\", arguments.length < 2);\n\n    if (placeholder == undefined) { placeholder = SC.EMPTY_PLACEHOLDER; }\n\n    this.transform({\n      to: function(val) { return empty(val) ? placeholder : val; }\n    });\n\n    return this;\n  },\n\n  /**\n    Adds a transform that will return the placeholder value if the value is\n    null or undefined. Otherwise it will passthrough untouched. See also notEmpty().\n\n    @param {String} fromPath from path or null\n    @param {Object} [placeholder] Placeholder value.\n    @returns {SC.Binding} this\n  */\n  notNull: function(placeholder) {\n    if (placeholder == undefined) { placeholder = SC.EMPTY_PLACEHOLDER; }\n\n    this.transform({\n      to: function(val) { return val == null ? placeholder : val; }\n    });\n\n    return this;\n  },\n\n  /**\n    Adds a transform to convert the value to the inverse of a bool value. This\n    uses the same transform as bool() but inverts it.\n\n    @returns {SC.Binding} this\n  */\n  not: function() {\n    this.transform(NOT);\n    return this;\n  },\n\n  /**\n    Adds a transform that will return YES if the value is null or undefined, NO otherwise.\n\n    @returns {SC.Binding} this\n  */\n  isNull: function() {\n    this.transform(function(val) { return val == null; });\n    return this;\n  },\n\n  /** @private */\n  toString: function() {\n    var oneWay = this._oneWay ? '[oneWay]' : '';\n    return SC.String.fmt(\"SC.Binding<%@>(%@ -> %@)%@\", [guidFor(this), this._from, this._to, oneWay]);\n  },\n\n  // ..........................................................\n  // CONNECT AND SYNC\n  //\n\n  /**\n    Attempts to connect this binding instance so that it can receive and relay\n    changes. This method will raise an exception if you have not set the\n    from/to properties yet.\n\n    @param {Object} obj\n      The root object for this binding.\n\n    @param {Boolean} preferFromParam\n      private: Normally, `connect` cannot take an object if `from` already set\n      an object. Internally, we would like to be able to provide a default object\n      to be used if no object was provided via `from`, so this parameter turns\n      off the assertion.\n\n    @returns {SC.Binding} this\n  */\n  connect: function(obj) {\n    sc_assert('Must pass a valid object to SC.Binding.connect()', !!obj);\n\n    var oneWay = this._oneWay, operand = this._operand;\n\n    // add an observer on the object to be notified when the binding should be updated\n    SC.addObserver(obj, this._from, this, this.fromDidChange);\n\n    // if there is an operand, add an observer onto it as well\n    if (operand) { SC.addObserver(obj, operand, this, this.fromDidChange); }\n\n    // if the binding is a two-way binding, also set up an observer on the target\n    // object.\n    if (!oneWay) { SC.addObserver(obj, this._to, this, this.toDidChange); }\n\n    if (SC.meta(obj,false).proto !== obj) { this._scheduleSync(obj, 'fwd'); }\n\n    this._readyToSync = true;\n    return this;\n  },\n\n  /**\n    Disconnects the binding instance. Changes will no longer be relayed. You\n    will not usually need to call this method.\n\n    @param {Object} obj\n      The root object you passed when connecting the binding.\n\n    @returns {SC.Binding} this\n  */\n  disconnect: function(obj) {\n    sc_assert('Must pass a valid object to SC.Binding.disconnect()', !!obj);\n\n    var oneWay = this._oneWay, operand = this._operand;\n\n    // remove an observer on the object so we're no longer notified of\n    // changes that should update bindings.\n    SC.removeObserver(obj, this._from, this, this.fromDidChange);\n\n    // if there is an operand, remove the observer from it as well\n    if (operand) SC.removeObserver(obj, operand, this, this.fromDidChange);\n\n    // if the binding is two-way, remove the observer from the target as well\n    if (!oneWay) SC.removeObserver(obj, this._to, this, this.toDidChange);\n\n    this._readyToSync = false; // disable scheduled syncs...\n    return this;\n  },\n\n  // ..........................................................\n  // PRIVATE\n  //\n\n  /** @private - called when the from side changes */\n  fromDidChange: function(target) {\n    this._scheduleSync(target, 'fwd');\n  },\n\n  /** @private - called when the to side changes */\n  toDidChange: function(target) {\n    this._scheduleSync(target, 'back');\n  },\n\n  /** @private */\n  _scheduleSync: function(obj, dir) {\n    var guid = guidFor(obj), existingDir = this[guid];\n\n    // if we haven't scheduled the binding yet, schedule it\n    if (!existingDir) {\n      SC.run.schedule('sync', this, this._sync, obj);\n      this[guid] = dir;\n    }\n\n    // If both a 'back' and 'fwd' sync have been scheduled on the same object,\n    // default to a 'fwd' sync so that it remains deterministic.\n    if (existingDir === 'back' && dir === 'fwd') {\n      this[guid] = 'fwd';\n    }\n  },\n\n  /** @private */\n  _sync: function(obj) {\n    var log = SC.LOG_BINDINGS;\n\n    // don't synchronize destroyed objects or disconnected bindings\n    if (obj.isDestroyed || !this._readyToSync) { return; }\n\n    // get the direction of the binding for the object we are\n    // synchronizing from\n    var guid = guidFor(obj), direction = this[guid], val, transformedValue;\n\n    var fromPath = this._from, toPath = this._to;\n\n    delete this[guid];\n\n    // apply any operations to the object, then apply transforms\n    var fromValue = getTransformedFromValue(obj, this);\n    var toValue   = getTransformedToValue(obj, this);\n\n    if (toValue === fromValue) { return; }\n\n    // if we're synchronizing from the remote object...\n    if (direction === 'fwd') {\n      if (log) { SC.Logger.log(' ', this.toString(), val, '->', fromValue, obj); }\n      SC.trySetPath(obj, toPath, fromValue);\n\n    // if we're synchronizing *to* the remote object\n    } else if (direction === 'back') {// && !this._oneWay) {\n      if (log) { SC.Logger.log(' ', this.toString(), val, '<-', fromValue, obj); }\n      SC.trySetPath(obj, fromPath, toValue);\n    }\n  }\n\n});\n\nBinding.reopenClass(/** @scope SC.Binding */ {\n\n  /**\n    @see SC.Binding.prototype.from\n  */\n  from: function() {\n    var C = this, binding = new C();\n    return binding.from.apply(binding, arguments);\n  },\n\n  /**\n    @see SC.Binding.prototype.to\n  */\n  to: function() {\n    var C = this, binding = new C();\n    return binding.to.apply(binding, arguments);\n  },\n\n  /**\n    @see SC.Binding.prototype.oneWay\n  */\n  oneWay: function(from, flag) {\n    var C = this, binding = new C(null, from);\n    return binding.oneWay(flag);\n  },\n\n  /**\n    @see SC.Binding.prototype.single\n  */\n  single: function(from) {\n    var C = this, binding = new C(null, from);\n    return binding.single();\n  },\n\n  /**\n    @see SC.Binding.prototype.multiple\n  */\n  multiple: function(from) {\n    var C = this, binding = new C(null, from);\n    return binding.multiple();\n  },\n\n  /**\n    @see SC.Binding.prototype.transform\n  */\n  transform: function(func) {\n    var C = this, binding = new C();\n    return binding.transform(func);\n  },\n\n  /**\n    @see SC.Binding.prototype.notEmpty\n  */\n  notEmpty: function(from, placeholder) {\n    var C = this, binding = new C(null, from);\n    return binding.notEmpty(placeholder);\n  },\n\n  /**\n    @see SC.Binding.prototype.bool\n  */\n  bool: function(from) {\n    var C = this, binding = new C(null, from);\n    return binding.bool();\n  },\n\n  /**\n    @see SC.Binding.prototype.not\n  */\n  not: function(from) {\n    var C = this, binding = new C(null, from);\n    return binding.not();\n  },\n\n  /**\n    Adds a transform that forwards the logical 'AND' of values at 'pathA' and\n    'pathB' whenever either source changes. Note that the transform acts\n    strictly as a one-way binding, working only in the direction\n\n        'pathA' AND 'pathB' --> value  (value returned is the result of ('pathA' && 'pathB'))\n\n    Usage example where a delete button's `isEnabled` value is determined by\n    whether something is selected in a list and whether the current user is\n    allowed to delete:\n\n        deleteButton: SC.ButtonView.design({\n          isEnabledBinding: SC.Binding.and('MyApp.itemsController.hasSelection', 'MyApp.userController.canDelete')\n        })\n\n    @param {String} pathA The first part of the conditional\n    @param {String} pathB The second part of the conditional\n  */\n  and: function(pathA, pathB) {\n    var C = this, binding = new C(null, pathA).oneWay();\n    binding._operand = pathB;\n    binding._operation = AND_OPERATION;\n    return binding;\n  },\n\n  /**\n    Adds a transform that forwards the 'OR' of values at 'pathA' and\n    'pathB' whenever either source changes. Note that the transform acts\n    strictly as a one-way binding, working only in the direction\n\n        'pathA' AND 'pathB' --> value  (value returned is the result of ('pathA' || 'pathB'))\n\n    @param {String} pathA The first part of the conditional\n    @param {String} pathB The second part of the conditional\n  */\n  or: function(pathA, pathB) {\n    var C = this, binding = new C(null, pathA).oneWay();\n    binding._operand = pathB;\n    binding._operation = OR_OPERATION;\n    return binding;\n  }\n\n});\n\nSC.Binding = Binding;\n\n/**\n  Global helper method to create a new binding.  Just pass the root object\n  along with a to and from path to create and connect the binding.  The new\n  binding object will be returned which you can further configure with\n  transforms and other conditions.\n\n  @param {Object} obj\n    The root object of the transform.\n\n  @param {String} to\n    The path to the 'to' side of the binding.  Must be relative to obj.\n\n  @param {String} from\n    The path to the 'from' side of the binding.  Must be relative to obj or\n    a global path.\n\n  @returns {SC.Binding} binding instance\n*/\nSC.bind = function(obj, to, from) {\n  return new SC.Binding(to, from).connect(obj);\n};\n\nSC.oneWay = function(obj, to, from) {\n  return new SC.Binding(to, from).oneWay().connect(obj);\n}\n\n});");spade.register("sproutcore-runtime/system/core_object", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\n\n\n// NOTE: this object should never be included directly.  Instead use SC.\n// SC.Object.  We only define this separately so that SC.Set can depend on it\n\n\n\nvar rewatch = SC.rewatch;\nvar classToString = SC.Mixin.prototype.toString;\nvar set = SC.set, get = SC.get;\nvar o_create = SC.platform.create,\n    meta = SC.meta;\n\nfunction makeCtor() {\n\n  // Note: avoid accessing any properties on the object since it makes the\n  // method a lot faster.  This is glue code so we want it to be as fast as\n  // possible.\n\n  var isPrepared = false, initMixins, init = false, hasChains = false;\n\n  var Class = function() {\n    if (!isPrepared) { get(Class, 'proto'); } // prepare prototype...\n    if (initMixins) {\n      this.reopen.apply(this, initMixins);\n      initMixins = null;\n      rewatch(this); // ålways rewatch just in case\n      this.init.apply(this, arguments);\n    } else {\n      if (hasChains) {\n        rewatch(this);\n      } else {\n        this[SC.GUID_KEY] = undefined;\n      }\n      if (init===false) { init = this.init; } // cache for later instantiations\n      init.apply(this, arguments);\n    }\n  };\n\n  Class.toString = classToString;\n  Class._prototypeMixinDidChange = function() { isPrepared = false; };\n  Class._initMixins = function(args) { initMixins = args; };\n\n  SC.defineProperty(Class, 'proto', SC.computed(function() {\n    if (!isPrepared) {\n      isPrepared = true;\n      Class.PrototypeMixin.applyPartial(Class.prototype);\n      hasChains = !!meta(Class.prototype, false).chains; // avoid rewatch\n    }\n    return this.prototype;\n  }));\n\n  return Class;\n\n}\n\nvar CoreObject = makeCtor();\n\nCoreObject.PrototypeMixin = SC.Mixin.create({\n\n  reopen: function() {\n    SC.Mixin._apply(this, arguments, true);\n    return this;\n  },\n\n  isInstance: true,\n\n  init: function() {},\n\n  isDestroyed: false,\n\n  /**\n    Destroys an object by setting the isDestroyed flag and removing its\n    metadata, which effectively destroys observers and bindings.\n\n    If you try to set a property on a destroyed object, an exception will be\n    raised.\n\n    Note that destruction is scheduled for the end of the run loop and does not\n    happen immediately.\n\n    @returns {SC.Object} receiver\n  */\n  destroy: function() {\n    set(this, 'isDestroyed', true);\n    SC.run.schedule('destroy', this, this._scheduledDestroy);\n    return this;\n  },\n\n  /**\n    Invoked by the run loop to actually destroy the object. This is\n    scheduled for execution by the `destroy` method.\n\n    @private\n  */\n  _scheduledDestroy: function() {\n    this[SC.META_KEY] = null;\n  },\n\n  bind: function(to, from) {\n    if (!(from instanceof SC.Binding)) { from = SC.Binding.from(from); }\n    from.to(to).connect(this);\n    return from;\n  },\n\n  toString: function() {\n    return '<'+this.constructor.toString()+':'+SC.guidFor(this)+'>';\n  }\n});\n\nCoreObject.__super__ = null;\n\nvar ClassMixin = SC.Mixin.create({\n\n  ClassMixin: SC.required(),\n\n  PrototypeMixin: SC.required(),\n\n  isClass: true,\n\n  isMethod: false,\n\n  extend: function() {\n    var Class = makeCtor(), proto;\n    Class.ClassMixin = SC.Mixin.create(this.ClassMixin);\n    Class.PrototypeMixin = SC.Mixin.create(this.PrototypeMixin);\n\n    Class.ClassMixin.ownerConstructor = Class;\n    Class.PrototypeMixin.ownerConstructor = Class;\n\n    var PrototypeMixin = Class.PrototypeMixin;\n    PrototypeMixin.reopen.apply(PrototypeMixin, arguments);\n\n    Class.superclass = this;\n    Class.__super__  = this.prototype;\n\n    proto = Class.prototype = o_create(this.prototype);\n    proto.constructor = Class;\n    SC.generateGuid(proto, 'sc');\n    meta(proto).proto = proto; // this will disable observers on prototype\n    SC.rewatch(proto); // setup watch chains if needed.\n\n\n    Class.subclasses = SC.Set ? new SC.Set() : null;\n    if (this.subclasses) { this.subclasses.add(Class); }\n\n    Class.ClassMixin.apply(Class);\n    return Class;\n  },\n\n  create: function() {\n    var C = this;\n    if (arguments.length>0) { this._initMixins(arguments); }\n    return new C();\n  },\n\n  reopen: function() {\n    var PrototypeMixin = this.PrototypeMixin;\n    PrototypeMixin.reopen.apply(PrototypeMixin, arguments);\n    this._prototypeMixinDidChange();\n    return this;\n  },\n\n  reopenClass: function() {\n    var ClassMixin = this.ClassMixin;\n    ClassMixin.reopen.apply(ClassMixin, arguments);\n    SC.Mixin._apply(this, arguments, false);\n    return this;\n  },\n\n  detect: function(obj) {\n    if ('function' !== typeof obj) { return false; }\n    while(obj) {\n      if (obj===this) { return true; }\n      obj = obj.superclass;\n    }\n    return false;\n  }\n\n});\n\nCoreObject.ClassMixin = ClassMixin;\nClassMixin.apply(CoreObject);\n\nSC.CoreObject = CoreObject;\n\n\n\n\n});");spade.register("sproutcore-runtime/system/each_proxy", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/system/object');\nrequire('sproutcore-runtime/mixins/array');\n\n\n\nvar set = SC.set, get = SC.get, guidFor = SC.guidFor;\n\nvar EachArray = SC.Object.extend(SC.Array, {\n\n  init: function(content, keyName, owner) {\n    this._super();\n    this._keyName = keyName;\n    this._owner   = owner;\n    this._content = content;\n  },\n\n  objectAt: function(idx) {\n    var item = this._content.objectAt(idx);\n    return item && get(item, this._keyName);\n  },\n\n  length: function() {\n    var content = this._content;\n    return content ? get(content, 'length') : 0;\n  }.property('[]').cacheable()\n\n});\n\nvar IS_OBSERVER = /^.+:(before|change)$/;\n\nfunction addObserverForContentKey(content, keyName, proxy, idx, loc) {\n  var objects = proxy._objects, guid;\n  if (!objects) objects = proxy._objects = {};\n\n  while(--loc>=idx) {\n    var item = content.objectAt(loc);\n    if (item) {\n      SC.addBeforeObserver(item, keyName, proxy, 'contentKeyWillChange');\n      SC.addObserver(item, keyName, proxy, 'contentKeyDidChange');\n\n      // keep track of the indicies each item was found at so we can map\n      // it back when the obj changes.\n      guid = guidFor(item);\n      if (!objects[guid]) objects[guid] = [];\n      objects[guid].push(loc);\n    }\n  }\n}\n\nfunction removeObserverForContentKey(content, keyName, proxy, idx, loc) {\n  var objects = proxy._objects;\n  if (!objects) objects = proxy._objects = {};\n  var indicies, guid;\n\n  while(--loc>=idx) {\n    var item = content.objectAt(loc);\n    if (item) {\n      SC.removeBeforeObserver(item, keyName, proxy, 'contentKeyWillChange');\n      SC.removeObserver(item, keyName, proxy, 'contentKeyDidChange');\n\n      guid = guidFor(item);\n      indicies = objects[guid];\n      indicies[indicies.indexOf(loc)] = null;\n    }\n  }\n}\n\n/**\n  @private\n  @class\n\n  This is the object instance returned when you get the @each property on an\n  array.  It uses the unknownProperty handler to automatically create\n  EachArray instances for property names.\n\n  @extends SC.Object\n*/\nSC.EachProxy = SC.Object.extend({\n\n  init: function(content) {\n    this._super();\n    this._content = content;\n    content.addArrayObserver(this);\n\n    // in case someone is already observing some keys make sure they are\n    // added\n    SC.watchedEvents(this).forEach(function(eventName) {\n      this.didAddListener(eventName);\n    }, this);\n  },\n\n  /**\n    You can directly access mapped properties by simply requesting them.\n    The unknownProperty handler will generate an EachArray of each item.\n  */\n  unknownProperty: function(keyName, value) {\n    var ret;\n    ret = new EachArray(this._content, keyName, this);\n    new SC.Descriptor().setup(this, keyName, ret);\n    this.beginObservingContentKey(keyName);\n    return ret;\n  },\n\n  // ..........................................................\n  // ARRAY CHANGES\n  // Invokes whenever the content array itself changes.\n\n  arrayWillChange: function(content, idx, removedCnt, addedCnt) {\n    var keys = this._keys, key, array, lim;\n\n    lim = removedCnt>0 ? idx+removedCnt : -1;\n    SC.beginPropertyChanges(this);\n    for(key in keys) {\n      if (!keys.hasOwnProperty(key)) continue;\n\n      if (lim>0) removeObserverForContentKey(content, key, this, idx, lim);\n\n      array = get(this, key);\n      SC.propertyWillChange(this, key);\n      if (array) array.arrayContentWillChange(idx, removedCnt, addedCnt);\n    }\n\n    SC.propertyWillChange(this._content, '@each');\n    SC.endPropertyChanges(this);\n  },\n\n  arrayDidChange: function(content, idx, removedCnt, addedCnt) {\n    var keys = this._keys, key, array, lim;\n\n    lim = addedCnt>0 ? idx+addedCnt : -1;\n    SC.beginPropertyChanges(this);\n    for(key in keys) {\n      if (!keys.hasOwnProperty(key)) continue;\n\n      if (lim>0) addObserverForContentKey(content, key, this, idx, lim);\n\n      array = get(this, key);\n      if (array) array.arrayContentDidChange(idx, removedCnt, addedCnt);\n      SC.propertyDidChange(this, key);\n    }\n    SC.propertyDidChange(this._content, '@each');\n    SC.endPropertyChanges(this);\n  },\n\n  // ..........................................................\n  // LISTEN FOR NEW OBSERVERS AND OTHER EVENT LISTENERS\n  // Start monitoring keys based on who is listening...\n\n  didAddListener: function(eventName) {\n    if (IS_OBSERVER.test(eventName)) {\n      this.beginObservingContentKey(eventName.slice(0, -7));\n    }\n  },\n\n  didRemoveListener: function(eventName) {\n    if (IS_OBSERVER.test(eventName)) {\n      this.stopObservingContentKey(eventName.slice(0, -7));\n    }\n  },\n\n  // ..........................................................\n  // CONTENT KEY OBSERVING\n  // Actual watch keys on the source content.\n\n  beginObservingContentKey: function(keyName) {\n    var keys = this._keys;\n    if (!keys) keys = this._keys = {};\n    if (!keys[keyName]) {\n      keys[keyName] = 1;\n      var content = this._content,\n          len = get(content, 'length');\n      addObserverForContentKey(content, keyName, this, 0, len);\n    } else {\n      keys[keyName]++;\n    }\n  },\n\n  stopObservingContentKey: function(keyName) {\n    var keys = this._keys;\n    if (keys && (keys[keyName]>0) && (--keys[keyName]<=0)) {\n      var content = this._content,\n          len     = get(content, 'length');\n      removeObserverForContentKey(content, keyName, this, 0, len);\n    }\n  },\n\n  contentKeyWillChange: function(obj, keyName) {\n    // notify array.\n    var indexes = this._objects[guidFor(obj)],\n        array   = get(this, keyName),\n        len = array && indexes ? indexes.length : 0, idx;\n\n    for(idx=0;idx<len;idx++) {\n      array.arrayContentWillChange(indexes[idx], 1, 1);\n    }\n  },\n\n  contentKeyDidChange: function(obj, keyName) {\n    // notify array.\n    var indexes = this._objects[guidFor(obj)],\n        array   = get(this, keyName),\n        len = array && indexes ? indexes.length : 0, idx;\n\n    for(idx=0;idx<len;idx++) {\n      array.arrayContentDidChange(indexes[idx], 1, 1);\n    }\n\n    SC.propertyDidChange(this, keyName);\n  }\n\n});\n\n\n\n});");spade.register("sproutcore-runtime/system/namespace", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/system/object');\n\n/**\n  @private\n  A Namespace is an object usually used to contain other objects or methods \n  such as an application or framework.  Create a namespace anytime you want\n  to define one of these new containers.\n  \n  # Example Usage\n  \n      MyFramework = SC.Namespace.create({\n        VERSION: '1.0.0'\n      });\n      \n*/\nSC.Namespace = SC.Object.extend();\n\n});");spade.register("sproutcore-runtime/system/native_array", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\n\nrequire('sproutcore-runtime/mixins/observable');\nrequire('sproutcore-runtime/mixins/mutable_array');\nrequire('sproutcore-runtime/mixins/copyable');\n\n\n\nvar get = SC.get, set = SC.set;\n  \n// Add SC.Array to Array.prototype.  Remove methods with native \n// implementations and supply some more optimized versions of generic methods\n// because they are so common.\nvar NativeArray = SC.Mixin.create(SC.MutableArray, SC.Observable, SC.Copyable, {\n\n  // because length is a built-in property we need to know to just get the \n  // original property.\n  get: function(key) {\n    if (key==='length') return this.length;\n    else if ('number' === typeof key) return this[key];\n    else return this._super(key);  \n  },\n  \n  objectAt: function(idx) {\n    return this[idx];\n  },\n    \n  // primitive for array support.\n  replace: function(idx, amt, objects) {\n\n    if (this.isFrozen) throw SC.FROZEN_ERROR ;\n\n    // if we replaced exactly the same number of items, then pass only the\n    // replaced range.  Otherwise, pass the full remaining array length\n    // since everything has shifted\n    var len = objects ? get(objects, 'length') : 0;\n    this.arrayContentWillChange(idx, amt, len);\n    \n    if (!objects || objects.length === 0) {\n      this.splice(idx, amt) ;\n    } else {\n      var args = [idx, amt].concat(objects) ;\n      this.splice.apply(this,args) ;\n    }\n\n    this.arrayContentDidChange(idx, amt, len);\n    return this ;\n  },\n\n  // If you ask for an unknown property, then try to collect the value\n  // from member items.\n  unknownProperty: function(key, value) {\n    var ret;// = this.reducedProperty(key, value) ;\n    if ((value !== undefined) && ret === undefined) {\n      ret = this[key] = value;\n    }\n    return ret ;\n  },\n\n  // If browser did not implement indexOf natively, then override with\n  // specialized version\n  indexOf: function(object, startAt) {\n    var idx, len = this.length;\n\n    if (startAt === undefined) startAt = 0;\n    else startAt = (startAt < 0) ? Math.ceil(startAt) : Math.floor(startAt);\n    if (startAt < 0) startAt += len;\n\n    for(idx=startAt;idx<len;idx++) {\n      if (this[idx] === object) return idx ;\n    }\n    return -1;\n  },\n\n  lastIndexOf: function(object, startAt) {\n    var idx, len = this.length;\n\n    if (startAt === undefined) startAt = len-1;\n    else startAt = (startAt < 0) ? Math.ceil(startAt) : Math.floor(startAt);\n    if (startAt < 0) startAt += len;\n\n    for(idx=startAt;idx>=0;idx--) {\n      if (this[idx] === object) return idx ;\n    }\n    return -1;\n  },\n  \n  copy: function() {\n    return this.slice();\n  }\n});\n\n// Remove any methods implemented natively so we don't override them\nvar ignore = ['length'];\nNativeArray.keys().forEach(function(methodName) {\n  if (Array.prototype[methodName]) ignore.push(methodName);\n});\n\nif (ignore.length>0) {\n  NativeArray = NativeArray.without.apply(NativeArray, ignore);\n}\n\n/**\n  The NativeArray mixin contains the properties needed to to make the native\n  Array support SC.MutableArray and all of its dependent APIs.  Unless you \n  have SC.EXTEND_PROTOTYPES set to false, this will be applied automatically.\n  Otherwise you can apply the mixin at anytime by calling \n  `SC.NativeArray.activate`.\n  \n  @namespace\n  @extends SC.MutableArray\n  @extends SC.Array\n  @extends SC.Enumerable\n  @extends SC.MutableEnumerable\n  @extends SC.Copyable\n  @extends SC.Freezable\n*/\nSC.NativeArray = NativeArray;\n\n/**\n  Activates the mixin on the Array.prototype if not already applied.  Calling\n  this method more than once is safe.\n  \n  @returns {void}\n*/\nSC.NativeArray.activate = function() {\n  NativeArray.apply(Array.prototype);\n};\n\nif (SC.EXTEND_PROTOTYPES) SC.NativeArray.activate();\n\n\n\n});");spade.register("sproutcore-runtime/system/object", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/mixins/observable');\nrequire('sproutcore-runtime/system/core_object');\nrequire('sproutcore-runtime/system/set');\n\nSC.CoreObject.subclasses = new SC.Set();\nSC.Object = SC.CoreObject.extend(SC.Observable);\n\n\n\n\n});");spade.register("sproutcore-runtime/system/run_loop", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2010 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals sc_assert */\n\n\nrequire('sproutcore-runtime/system/object');\n\n\n\n// ..........................................................\n// HELPERS\n//\n\nvar slice = Array.prototype.slice;\n\n// invokes passed params - normalizing so you can pass target/func,\n// target/string or just func\nfunction invoke(target, method, args, ignore) {\n\n  if (method===undefined) {\n    method = target;\n    target = undefined;\n  }\n\n  if ('string'===typeof method) method = target[method];\n  if (args && ignore>0) {\n    args = args.length>ignore ? slice.call(args, ignore) : null;\n  }\n  // IE8's Function.prototype.apply doesn't accept undefined/null arguments.\n  return method.apply(target || this, args || []);\n}\n\n\n// ..........................................................\n// RUNLOOP\n//\n\nvar timerMark; // used by timers...\n\nvar RunLoop = SC.Object.extend({\n\n  _prev: null,\n\n  init: function(prev) {\n    this._prev = prev;\n    this.onceTimers = {};\n  },\n\n  end: function() {\n    this.flush();\n    return this._prev;\n  },\n\n  // ..........................................................\n  // Delayed Actions\n  //\n\n  schedule: function(queueName, target, method) {\n    var queues = this._queues, queue;\n    if (!queues) queues = this._queues = {};\n    queue = queues[queueName];\n    if (!queue) queue = queues[queueName] = [];\n\n    var args = arguments.length>3 ? slice.call(arguments, 3) : null;\n    queue.push({ target: target, method: method, args: args });\n    return this;\n  },\n\n  flush: function(queueName) {\n    var queues = this._queues, queueNames, idx, len, queue, log;\n\n    if (!queues) return this; // nothing to do\n\n    function iter(item) {\n      invoke(item.target, item.method, item.args);\n    }\n\n    SC.watch.flushPending(); // make sure all chained watchers are setup\n\n    if (queueName) {\n      while (this._queues && (queue = this._queues[queueName])) {\n        this._queues[queueName] = null;\n\n        log = SC.LOG_BINDINGS && queueName==='sync';\n        if (log) SC.Logger.log('Begin: Flush Sync Queue');\n\n        // the sync phase is to allow property changes to propogate.  don't\n        // invoke observers until that is finished.\n        if (queueName === 'sync') SC.beginPropertyChanges();\n        queue.forEach(iter);\n        if (queueName === 'sync') SC.endPropertyChanges();\n\n        if (log) SC.Logger.log('End: Flush Sync Queue');\n\n      }\n\n    } else {\n      queueNames = SC.run.queues;\n      len = queueNames.length;\n      do {\n        this._queues = null;\n        for(idx=0;idx<len;idx++) {\n          queueName = queueNames[idx];\n          queue = queues[queueName];\n\n          log = SC.LOG_BINDINGS && queueName==='sync';\n          if (log) SC.Logger.log('Begin: Flush Sync Queue');\n\n          if (queueName === 'sync') SC.beginPropertyChanges();\n          if (queue) queue.forEach(iter);\n          if (queueName === 'sync') SC.endPropertyChanges();\n\n          if (log) SC.Logger.log('End: Flush Sync Queue');\n\n        }\n\n      } while (queues = this._queues); // go until queues stay clean\n    }\n\n    timerMark = null;\n\n    return this;\n  }\n\n});\n\nSC.RunLoop = RunLoop;\n\n// ..........................................................\n// SC.run - this is ideally the only public API the dev sees\n//\n\nvar run;\n\n/**\n  Runs the passed target and method inside of a runloop, ensuring any\n  deferred actions including bindings and views updates are flushed at the\n  end.\n\n  Normally you should not need to invoke this method yourself.  However if\n  you are implementing raw event handlers when interfacing with other\n  libraries or plugins, you should probably wrap all of your code inside this\n  call.\n\n  @function\n  @param {Object} target\n    (Optional) target of method to call\n\n  @param {Function|String} method\n    Method to invoke.  May be a function or a string.  If you pass a string\n    then it will be looked up on the passed target.\n\n  @param {Object...} args\n    Any additional arguments you wish to pass to the method.\n\n  @returns {Object} return value from invoking the passed function.\n*/\nSC.run = run = function(target, method) {\n\n  var ret, loop;\n  run.begin();\n  if (target || method) ret = invoke(target, method, arguments, 2);\n  run.end();\n  return ret;\n};\n\n/**\n  Begins a new RunLoop.  Any deferred actions invoked after the begin will\n  be buffered until you invoke a matching call to SC.run.end().  This is\n  an lower-level way to use a RunLoop instead of using SC.run().\n\n  @returns {void}\n*/\nSC.run.begin = function() {\n  run.currentRunLoop = new RunLoop(run.currentRunLoop);\n};\n\n/**\n  Ends a RunLoop.  This must be called sometime after you call SC.run.begin()\n  to flush any deferred actions.  This is a lower-level way to use a RunLoop\n  instead of using SC.run().\n\n  @returns {void}\n*/\nSC.run.end = function() {\n  sc_assert('must have a current run loop', run.currentRunLoop);\n  run.currentRunLoop = run.currentRunLoop.end();\n};\n\n/**\n  Array of named queues.  This array determines the order in which queues\n  are flushed at the end of the RunLoop.  You can define your own queues by\n  simply adding the queue name to this array.  Normally you should not need\n  to inspect or modify this property.\n\n  @property {String}\n*/\nSC.run.queues = ['sync', 'actions', 'destroy', 'timers'];\n\n/**\n  Adds the passed target/method and any optional arguments to the named\n  queue to be executed at the end of the RunLoop.  If you have not already\n  started a RunLoop when calling this method one will be started for you\n  automatically.\n\n  At the end of a RunLoop, any methods scheduled in this way will be invoked.\n  Methods will be invoked in an order matching the named queues defined in\n  the run.queues property.\n\n  @param {String} queue\n    The name of the queue to schedule against.  Default queues are 'sync' and\n    'actions'\n\n  @param {Object} target\n    (Optional) target object to use as the context when invoking a method.\n\n  @param {String|Function} method\n    The method to invoke.  If you pass a string it will be resolved on the\n    target object at the time the scheduled item is invoked allowing you to\n    change the target function.\n\n  @param {Object} arguments...\n    Optional arguments to be passed to the queued method.\n\n  @returns {void}\n*/\nSC.run.schedule = function(queue, target, method) {\n  var loop = run.autorun();\n  loop.schedule.apply(loop, arguments);\n};\n\nvar autorunTimer;\n\nfunction autorun() {\n  autorunTimer = null;\n  if (run.currentRunLoop) run.end();\n}\n\n/**\n  Begins a new RunLoop is necessary and schedules a timer to flush the\n  RunLoop at a later time.  This method is used by parts of SproutCore to\n  ensure the RunLoop always finishes.  You normally do not need to call this\n  method directly.  Instead use SC.run().\n\n  @returns {SC.RunLoop} the new current RunLoop\n*/\nSC.run.autorun = function() {\n\n  if (!run.currentRunLoop) {\n    run.begin();\n\n    // TODO: throw during tests\n    if (SC.testing) {\n      run.end();\n    } else if (!autorunTimer) {\n      autorunTimer = setTimeout(autorun, 1);\n    }\n  }\n\n  return run.currentRunLoop;\n};\n\n/**\n  Immediately flushes any events scheduled in the 'sync' queue.  Bindings\n  use this queue so this method is a useful way to immediately force all\n  bindings in the application to sync.\n\n  You should call this method anytime you need any changed state to propogate\n  throughout the app immediately without repainting the UI.\n\n  @returns {void}\n*/\nSC.run.sync = function() {\n  run.autorun();\n  run.currentRunLoop.flush('sync');\n};\n\n// ..........................................................\n// TIMERS\n//\n\nvar timers = {}; // active timers...\n\nvar laterScheduled = false;\nfunction invokeLaterTimers() {\n  var now = (+ new Date()), earliest = -1;\n  for(var key in timers) {\n    if (!timers.hasOwnProperty(key)) continue;\n    var timer = timers[key];\n    if (timer && timer.expires) {\n      if (now >= timer.expires) {\n        delete timers[key];\n        invoke(timer.target, timer.method, timer.args, 2);\n      } else {\n        if (earliest<0 || (timer.expires < earliest)) earliest=timer.expires;\n      }\n    }\n  }\n\n  // schedule next timeout to fire...\n  if (earliest>0) setTimeout(invokeLaterTimers, earliest-(+ new Date())); \n}\n\n/**\n  Invokes the passed target/method and optional arguments after a specified\n  period if time.  The last parameter of this method must always be a number\n  of milliseconds.\n\n  You should use this method whenever you need to run some action after a\n  period of time inside of using setTimeout().  This method will ensure that\n  items that expire during the same script execution cycle all execute\n  together, which is often more efficient than using a real setTimeout.\n\n  @param {Object} target\n    (optional) target of method to invoke\n\n  @param {Function|String} method\n    The method to invoke.  If you pass a string it will be resolved on the\n    target at the time the method is invoked.\n\n  @param {Object...} args\n    Optional arguments to pass to the timeout.\n\n  @param {Number} wait\n    Number of milliseconds to wait.\n\n  @returns {Timer} an object you can use to cancel a timer at a later time.\n*/\nSC.run.later = function(target, method) {\n  var args, expires, timer, guid, wait;\n\n  // setTimeout compatibility...\n  if (arguments.length===2 && 'function' === typeof target) {\n    wait   = method;\n    method = target;\n    target = undefined;\n    args   = [target, method];\n\n  } else {\n    args = slice.call(arguments);\n    wait = args.pop();\n  }\n  \n  expires = (+ new Date())+wait;\n  timer   = { target: target, method: method, expires: expires, args: args };\n  guid    = SC.guidFor(timer);\n  timers[guid] = timer;\n  run.once(timers, invokeLaterTimers);\n  return guid;\n};\n\nfunction invokeOnceTimer(guid, onceTimers) {\n  if (onceTimers[this.tguid]) delete onceTimers[this.tguid][this.mguid];\n  if (timers[guid]) invoke(this.target, this.method, this.args, 2);\n  delete timers[guid];\n}\n\n/**\n  Schedules an item to run one time during the current RunLoop.  Calling\n  this method with the same target/method combination will have no effect.\n\n  Note that although you can pass optional arguments these will not be\n  considered when looking for duplicates.  New arguments will replace previous\n  calls.\n\n  @param {Object} target\n    (optional) target of method to invoke\n\n  @param {Function|String} method\n    The method to invoke.  If you pass a string it will be resolved on the\n    target at the time the method is invoked.\n\n  @param {Object...} args\n    Optional arguments to pass to the timeout.\n\n\n  @returns {Object} timer\n*/\nSC.run.once = function(target, method) {\n  var tguid = SC.guidFor(target), mguid = SC.guidFor(method), guid, timer;\n\n  var onceTimers = run.autorun().onceTimers;\n  guid = onceTimers[tguid] && onceTimers[tguid][mguid];\n  if (guid && timers[guid]) {\n    timers[guid].args = slice.call(arguments); // replace args\n\n  } else {\n    timer = {\n      target: target,\n      method: method,\n      args:   slice.call(arguments),\n      tguid:  tguid,\n      mguid:  mguid\n    };\n\n    guid  = SC.guidFor(timer);\n    timers[guid] = timer;\n    if (!onceTimers[tguid]) onceTimers[tguid] = {};\n    onceTimers[tguid][mguid] = guid; // so it isn't scheduled more than once\n\n    run.schedule('actions', timer, invokeOnceTimer, guid, onceTimers);\n  }\n\n  return guid;\n};\n\nvar scheduledNext = false;\nfunction invokeNextTimers() {\n  scheduledNext = null;\n  for(var key in timers) {\n    if (!timers.hasOwnProperty(key)) continue;\n    var timer = timers[key];\n    if (timer.next) {\n      delete timers[key];\n      invoke(timer.target, timer.method, timer.args, 2);\n    }\n  }\n}\n\n/**\n  Schedules an item to run after control has been returned to the system.\n  This is often equivalent to calling setTimeout(function...,1).\n\n  @param {Object} target\n    (optional) target of method to invoke\n\n  @param {Function|String} method\n    The method to invoke.  If you pass a string it will be resolved on the\n    target at the time the method is invoked.\n\n  @param {Object...} args\n    Optional arguments to pass to the timeout.\n\n  @returns {Object} timer\n*/\nSC.run.next = function(target, method) {\n  var timer, guid;\n\n  timer = {\n    target: target,\n    method: method,\n    args: slice.call(arguments),\n    next: true\n  };\n\n  guid = SC.guidFor(timer);\n  timers[guid] = timer;\n\n  if (!scheduledNext) scheduledNext = setTimeout(invokeNextTimers, 1);\n  return guid;\n};\n\n/**\n  Cancels a scheduled item.  Must be a value returned by `SC.run.later()`,\n  `SC.run.once()`, or `SC.run.next()`.\n\n  @param {Object} timer\n    Timer object to cancel\n\n  @returns {void}\n*/\nSC.run.cancel = function(timer) {\n  delete timers[timer];\n};\n\n\n// ..........................................................\n// DEPRECATED API\n//\n\n/**\n  @deprecated\n  @method\n\n  Use `#js:SC.run.begin()` instead\n*/\nSC.RunLoop.begin = SC.run.begin;\n\n/**\n  @deprecated\n  @method\n\n  Use `#js:SC.run.end()` instead\n*/\nSC.RunLoop.end = SC.run.end;\n\n\n\n});");spade.register("sproutcore-runtime/system/set", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-runtime/core');\nrequire('sproutcore-runtime/system/core_object');\nrequire('sproutcore-runtime/mixins/mutable_enumerable');\nrequire('sproutcore-runtime/mixins/copyable');\nrequire('sproutcore-runtime/mixins/freezable');\n\n\n\nvar get = SC.get, set = SC.set, guidFor = SC.guidFor, none = SC.none;\n\n/**\n  @class\n\n  An unordered collection of objects.\n\n  A Set works a bit like an array except that its items are not ordered.\n  You can create a set to efficiently test for membership for an object. You\n  can also iterate through a set just like an array, even accessing objects\n  by index, however there is no gaurantee as to their order.\n\n  Starting with SproutCore 2.0 all Sets are now observable since there is no\n  added cost to providing this support.  Sets also do away with the more\n  specialized Set Observer API in favor of the more generic Enumerable \n  Observer API - which works on any enumerable object including both Sets and\n  Arrays.\n\n  ## Creating a Set\n\n  You can create a set like you would most objects using \n  `new SC.Set()`.  Most new sets you create will be empty, but you can \n  also initialize the set with some content by passing an array or other \n  enumerable of objects to the constructor.\n\n  Finally, you can pass in an existing set and the set will be copied. You\n  can also create a copy of a set by calling `SC.Set#copy()`.\n\n      #js\n      // creates a new empty set\n      var foundNames = new SC.Set();\n\n      // creates a set with four names in it.\n      var names = new SC.Set([\"Charles\", \"Tom\", \"Juan\", \"Alex\"]); // :P\n\n      // creates a copy of the names set.\n      var namesCopy = new SC.Set(names);\n\n      // same as above.\n      var anotherNamesCopy = names.copy();\n\n  ## Adding/Removing Objects\n\n  You generally add or remove objects from a set using `add()` or \n  `remove()`. You can add any type of object including primitives such as \n  numbers, strings, and booleans.\n\n  Unlike arrays, objects can only exist one time in a set. If you call `add()` \n  on a set with the same object multiple times, the object will only be added\n  once. Likewise, calling `remove()` with the same object multiple times will\n  remove the object the first time and have no effect on future calls until\n  you add the object to the set again.\n\n  NOTE: You cannot add/remove null or undefined to a set. Any attempt to do so \n  will be ignored.\n\n  In addition to add/remove you can also call `push()`/`pop()`. Push behaves \n  just like `add()` but `pop()`, unlike `remove()` will pick an arbitrary \n  object, remove it and return it. This is a good way to use a set as a job \n  queue when you don't care which order the jobs are executed in.\n\n  ## Testing for an Object\n\n  To test for an object's presence in a set you simply call \n  `SC.Set#contains()`.\n\n  ## Observing changes\n\n  When using `SC.Set`, you can observe the `\"[]\"` property to be \n  alerted whenever the content changes.  You can also add an enumerable \n  observer to the set to be notified of specific objects that are added and\n  removed from the set.  See `SC.Enumerable` for more information on \n  enumerables.\n\n  This is often unhelpful. If you are filtering sets of objects, for instance,\n  it is very inefficient to re-filter all of the items each time the set \n  changes. It would be better if you could just adjust the filtered set based \n  on what was changed on the original set. The same issue applies to merging \n  sets, as well.\n\n  ## Other Methods\n\n  `SC.Set` primary implements other mixin APIs.  For a complete reference\n  on the methods you will use with `SC.Set`, please consult these mixins.\n  The most useful ones will be `SC.Enumerable` and \n  `SC.MutableEnumerable` which implement most of the common iterator \n  methods you are used to on Array.\n\n  Note that you can also use the `SC.Copyable` and `SC.Freezable`\n  APIs on `SC.Set` as well.  Once a set is frozen it can no longer be \n  modified.  The benefit of this is that when you call frozenCopy() on it,\n  SproutCore will avoid making copies of the set.  This allows you to write\n  code that can know with certainty when the underlying set data will or \n  will not be modified.\n\n  @extends SC.Enumerable\n  @extends SC.MutableEnumerable\n  @extends SC.Copyable\n  @extends SC.Freezable\n\n  @since SproutCore 1.0\n*/\nSC.Set = SC.CoreObject.extend(SC.MutableEnumerable, SC.Copyable, SC.Freezable,\n  /** @scope SC.Set.prototype */ {\n\n  // ..........................................................\n  // IMPLEMENT ENUMERABLE APIS\n  //\n\n  /**\n    This property will change as the number of objects in the set changes.\n\n    @property Number\n    @default 0\n  */\n  length: 0,\n\n  /**\n    Clears the set.  This is useful if you want to reuse an existing set\n    without having to recreate it.\n\n    @returns {SC.Set}\n  */\n  clear: function() {\n    if (this.isFrozen) { throw new Error(SC.FROZEN_ERROR); }\n    var len = get(this, 'length');\n    this.enumerableContentWillChange(len, 0);\n    set(this, 'length', 0);\n    this.enumerableContentDidChange(len, 0);\n    return this;\n  },\n\n  /**\n    Returns true if the passed object is also an enumerable that contains the \n    same objects as the receiver.\n\n    @param {SC.Set} obj the other object\n    @returns {Boolean}\n  */\n  isEqual: function(obj) {\n    // fail fast\n    if (!SC.Enumerable.detect(obj)) return false;\n    \n    var loc = get(this, 'length');\n    if (get(obj, 'length') !== loc) return false;\n\n    while(--loc >= 0) {\n      if (!obj.contains(this[loc])) return false;\n    }\n\n    return true;\n  },\n  \n  /**\n    Adds an object to the set.  Only non-null objects can be added to a set \n    and those can only be added once. If the object is already in the set or\n    the passed value is null this method will have no effect.\n\n    This is an alias for `SC.MutableEnumerable.addObject()`.\n\n    @function\n    @param {Object} obj The object to add\n    @returns {SC.Set} receiver\n  */\n  add: SC.alias('addObject'),\n\n  /**\n    Removes the object from the set if it is found.  If you pass a null value\n    or an object that is already not in the set, this method will have no\n    effect. This is an alias for `SC.MutableEnumerable.removeObject()`.\n\n    @function\n    @param {Object} obj The object to remove\n    @returns {SC.Set} receiver\n  */\n  remove: SC.alias('removeObject'),\n  \n  /**\n    Removes an arbitrary object from the set and returns it.\n\n    @returns {Object} An object from the set or null\n  */\n  pop: function() {\n    if (get(this, 'isFrozen')) throw new Error(SC.FROZEN_ERROR);\n    var obj = this.length > 0 ? this[this.length-1] : null;\n    this.remove(obj);\n    return obj;\n  },\n\n  /**\n    This is an alias for `SC.MutableEnumerable.addObject()`.\n\n    @function\n  */\n  push: SC.alias('addObject'),\n  \n  /**\n    This is an alias for `SC.Set.pop()`.\n    @function\n  */\n  shift: SC.alias('pop'),\n\n  /**\n    This is an alias of `SC.Set.push()`\n    @function\n  */\n  unshift: SC.alias('push'),\n\n  /**\n    This is an alias of `SC.MutableEnumerable.addObjects()`\n    @function\n  */\n  addEach: SC.alias('addObjects'),\n\n  /**\n    This is an alias of `SC.MutableEnumerable.removeObjects()`\n    @function\n  */\n  removeEach: SC.alias('removeObjects'),\n\n  // ..........................................................\n  // PRIVATE ENUMERABLE SUPPORT\n  //\n\n  /** @private */\n  init: function(items) {\n    this._super();\n    if (items) this.addObjects(items);\n  },\n\n  /** @private (nodoc) - implement SC.Enumerable */\n  nextObject: function(idx) {\n    return this[idx];\n  },\n\n  /** @private - more optimized version */\n  firstObject: SC.computed(function() {\n    return this.length > 0 ? this[0] : undefined;  \n  }).property('[]').cacheable(),\n\n  /** @private - more optimized version */\n  lastObject: SC.computed(function() {\n    return this.length > 0 ? this[this.length-1] : undefined;\n  }).property('[]').cacheable(),\n\n  /** @private (nodoc) - implements SC.MutableEnumerable */\n  addObject: function(obj) {\n    if (get(this, 'isFrozen')) throw new Error(SC.FROZEN_ERROR);\n    if (none(obj)) return this; // nothing to do\n    \n    var guid = guidFor(obj),\n        idx  = this[guid],\n        len  = get(this, 'length'),\n        added ;\n        \n    if (idx>=0 && idx<len && (this[idx] === obj)) return this; // added\n    \n    added = [obj];\n    this.enumerableContentWillChange(null, added);\n    len = get(this, 'length');\n    this[guid] = len;\n    this[len] = obj;\n    set(this, 'length', len+1);\n    this.enumerableContentDidChange(null, added);\n\n    return this;\n  },\n  \n  /** @private (nodoc) - implements SC.MutableEnumerable */\n  removeObject: function(obj) {\n    if (get(this, 'isFrozen')) throw new Error(SC.FROZEN_ERROR);\n    if (none(obj)) return this; // nothing to do\n    \n    var guid = guidFor(obj),\n        idx  = this[guid],\n        len = get(this, 'length'),\n        last, removed;\n        \n    \n    if (idx>=0 && idx<len && (this[idx] === obj)) {\n      removed = [obj];\n\n      this.enumerableContentWillChange(removed, null);\n      \n      // swap items - basically move the item to the end so it can be removed\n      if (idx < len-1) {\n        last = this[len-1];\n        this[idx] = last;\n        this[guidFor(last)] = idx;\n      }\n\n      delete this[guid];\n      delete this[len-1];\n      set(this, 'length', len-1);\n\n      this.enumerableContentDidChange(removed, null);\n    }\n    \n    return this;\n  },\n\n  /** @private (nodoc) - optimized version */\n  contains: function(obj) {\n    return this[guidFor(obj)]>=0;\n  },\n  \n  /** @private (nodoc) */\n  copy: function() {\n    var C = this.constructor, ret = new C(), loc = get(this, 'length');\n    set(ret, 'length', loc);\n    while(--loc>=0) {\n      ret[loc] = this[loc];\n      ret[guidFor(this[loc])] = loc;\n    }\n    return ret;\n  },\n  \n  /** @private */\n  toString: function() {\n    var len = this.length, idx, array = [];\n    for(idx = 0; idx < len; idx++) {\n      array[idx] = this[idx];\n    }\n    return \"SC.Set<%@>\".fmt(array.join(','));\n  },\n  \n  // ..........................................................\n  // DEPRECATED\n  // \n\n  /** @deprecated\n\n    This property is often used to determine that a given object is a set.\n    Instead you should use instanceof:\n\n        #js:\n        // SproutCore 1.x:\n        isSet = myobject && myobject.isSet;\n\n        // SproutCore 2.0 and later:\n        isSet = myobject instanceof SC.Set\n\n    @type Boolean\n    @default true\n  */\n  isSet: true\n    \n});\n\n// Support the older API \nvar o_create = SC.Set.create;\nSC.Set.create = function(items) {\n  if (items && SC.Enumerable.detect(items)) {\n    SC.Logger.warn('Passing an enumerable to SC.Set.create() is deprecated and will be removed in a future version of SproutCore.  Use new SC.Set(items) instead');\n    return new SC.Set(items);\n  } else {\n    return o_create.apply(this, arguments);\n  }\n};\n\n\n\n});");spade.register("sproutcore-runtime/system/string", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:  SproutCore Runtime\n// Copyright: ©2011 Strobe Inc.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\n\n\n\n\n/** @private **/\n\nvar STRING_DASHERIZE_REGEXP = (/[ _]/g);\nvar STRING_DASHERIZE_CACHE = {};\nvar STRING_DECAMELIZE_REGEXP = (/([a-z])([A-Z])/g);\n  \n/**\n  Defines the hash of localized strings for the current language.  Used by \n  the `SC.String.loc()` helper.  To localize, add string values to this\n  hash.\n  \n  @property {String}\n*/\nSC.STRINGS = {};\n\n/**\n  Defines string helper methods including string formatting and localization.\n  Unless SC.EXTEND_PROTOTYPES = false these methods will also be added to the\n  String.prototype as well.\n  \n  @namespace\n*/\nSC.String = {\n\n  /**\n    Apply formatting options to the string.  This will look for occurrences\n    of %@ in your string and substitute them with the arguments you pass into\n    this method.  If you want to control the specific order of replacement,\n    you can add a number after the key as well to indicate which argument\n    you want to insert.\n\n    Ordered insertions are most useful when building loc strings where values\n    you need to insert may appear in different orders.\n\n    ## Examples\n\n        \"Hello %@ %@\".fmt('John', 'Doe') => \"Hello John Doe\"\n        \"Hello %@2, %@1\".fmt('John', 'Doe') => \"Hello Doe, John\"\n\n    @param {Object...} [args]\n    @returns {String} formatted string\n  */\n  fmt: function(str, formats) {\n    // first, replace any ORDERED replacements.\n    var idx  = 0; // the current index for non-numerical replacements\n    return str.replace(/%@([0-9]+)?/g, function(s, argIndex) {\n      argIndex = (argIndex) ? parseInt(argIndex,0) - 1 : idx++ ;\n      s = formats[argIndex];\n      return ((s === null) ? '(null)' : (s === undefined) ? '' : s).toString();\n    }) ;\n  },\n\n  /**\n    Formats the passed string, but first looks up the string in the localized\n    strings hash.  This is a convenient way to localize text.  See \n    `SC.String.fmt()` for more information on formatting.\n    \n    Note that it is traditional but not required to prefix localized string\n    keys with an underscore or other character so you can easily identify\n    localized strings.\n    \n    # Example Usage\n    \n        @javascript@\n        SC.STRINGS = {\n          '_Hello World': 'Bonjour le monde',\n          '_Hello %@ %@': 'Bonjour %@ %@'\n        };\n        \n        SC.String.loc(\"_Hello World\");\n        => 'Bonjour le monde';\n        \n        SC.String.loc(\"_Hello %@ %@\", [\"John\", \"Smith\"]);\n        => \"Bonjour John Smith\";\n        \n        \n        \n    @param {String} str\n      The string to format\n    \n    @param {Array} formats\n      Optional array of parameters to interpolate into string.\n      \n    @returns {String} formatted string\n  */\n  loc: function(str, formats) {\n    str = SC.STRINGS[str] || str;\n    return SC.String.fmt(str, formats) ;\n  },\n\n  /**\n    Splits a string into separate units separated by spaces, eliminating any\n    empty strings in the process.  This is a convenience method for split that\n    is mostly useful when applied to the String.prototype.\n    \n    # Example Usage\n    \n        @javascript@\n        SC.String.w(\"alpha beta gamma\").forEach(function(key) { \n          console.log(key); \n        });\n        > alpha\n        > beta\n        > gamma\n\n    @param {String} str\n      The string to split\n      \n    @returns {String} split string\n  */\n  w: function(str) { return str.split(/\\s+/); },\n  \n  /**\n    Converts a camelized string into all lower case separated by underscores.\n\n    h2. Examples\n\n    | *Input String* | *Output String* |\n    | my favorite items | my favorite items |\n    | css-class-name | css-class-name |\n    | action_name | action_name |\n    | innerHTML | inner_html |\n\n    @returns {String} the decamelized string.\n  */\n  decamelize: function(str) {\n    return str.replace(STRING_DECAMELIZE_REGEXP, '$1_$2').toLowerCase();\n  },\n\n  /**\n    Converts a camelized string or a string with spaces or underscores into\n    a string with components separated by dashes.\n\n    h2. Examples\n\n    | *Input String* | *Output String* |\n    | my favorite items | my-favorite-items |\n    | css-class-name | css-class-name |\n    | action_name | action-name |\n    | innerHTML | inner-html |\n\n    @returns {String} the dasherized string.\n  */\n  dasherize: function(str) {\n    var cache = STRING_DASHERIZE_CACHE,\n        ret   = cache[str];\n\n    if (ret) {\n      return ret;\n    } else {\n      ret = SC.String.decamelize(str).replace(STRING_DASHERIZE_REGEXP,'-');\n      cache[str] = ret;\n    }\n\n    return ret;\n  }\n};\n\n\n\n\n});");/*!
 * jQuery JavaScript Library v1.6.2
 * http://jquery.com/
 *
 * Copyright 2011, John Resig
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * Includes Sizzle.js
 * http://sizzlejs.com/
 * Copyright 2011, The Dojo Foundation
 * Released under the MIT, BSD, and GPL Licenses.
 *
 * Date: Thu Jun 30 14:16:56 2011 -0400
 */

(function( window, undefined ) {

// Use the correct document accordingly with window argument (sandbox)
var document = window.document,
	navigator = window.navigator,
	location = window.location;
var jQuery = (function() {

// Define a local copy of jQuery
var jQuery = function( selector, context ) {
		// The jQuery object is actually just the init constructor 'enhanced'
		return new jQuery.fn.init( selector, context, rootjQuery );
	},

	// Map over jQuery in case of overwrite
	_jQuery = window.jQuery,

	// Map over the $ in case of overwrite
	_$ = window.$,

	// A central reference to the root jQuery(document)
	rootjQuery,

	// A simple way to check for HTML strings or ID strings
	// (both of which we optimize for)
	quickExpr = /^(?:[^<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/,

	// Check if a string has a non-whitespace character in it
	rnotwhite = /\S/,

	// Used for trimming whitespace
	trimLeft = /^\s+/,
	trimRight = /\s+$/,

	// Check for digits
	rdigit = /\d/,

	// Match a standalone tag
	rsingleTag = /^<(\w+)\s*\/?>(?:<\/\1>)?$/,

	// JSON RegExp
	rvalidchars = /^[\],:{}\s]*$/,
	rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,
	rvalidtokens = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,
	rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g,

	// Useragent RegExp
	rwebkit = /(webkit)[ \/]([\w.]+)/,
	ropera = /(opera)(?:.*version)?[ \/]([\w.]+)/,
	rmsie = /(msie) ([\w.]+)/,
	rmozilla = /(mozilla)(?:.*? rv:([\w.]+))?/,

	// Matches dashed string for camelizing
	rdashAlpha = /-([a-z])/ig,

	// Used by jQuery.camelCase as callback to replace()
	fcamelCase = function( all, letter ) {
		return letter.toUpperCase();
	},

	// Keep a UserAgent string for use with jQuery.browser
	userAgent = navigator.userAgent,

	// For matching the engine and version of the browser
	browserMatch,

	// The deferred used on DOM ready
	readyList,

	// The ready event handler
	DOMContentLoaded,

	// Save a reference to some core methods
	toString = Object.prototype.toString,
	hasOwn = Object.prototype.hasOwnProperty,
	push = Array.prototype.push,
	slice = Array.prototype.slice,
	trim = String.prototype.trim,
	indexOf = Array.prototype.indexOf,

	// [[Class]] -> type pairs
	class2type = {};

jQuery.fn = jQuery.prototype = {
	constructor: jQuery,
	init: function( selector, context, rootjQuery ) {
		var match, elem, ret, doc;

		// Handle $(""), $(null), or $(undefined)
		if ( !selector ) {
			return this;
		}

		// Handle $(DOMElement)
		if ( selector.nodeType ) {
			this.context = this[0] = selector;
			this.length = 1;
			return this;
		}

		// The body element only exists once, optimize finding it
		if ( selector === "body" && !context && document.body ) {
			this.context = document;
			this[0] = document.body;
			this.selector = selector;
			this.length = 1;
			return this;
		}

		// Handle HTML strings
		if ( typeof selector === "string" ) {
			// Are we dealing with HTML string or an ID?
			if ( selector.charAt(0) === "<" && selector.charAt( selector.length - 1 ) === ">" && selector.length >= 3 ) {
				// Assume that strings that start and end with <> are HTML and skip the regex check
				match = [ null, selector, null ];

			} else {
				match = quickExpr.exec( selector );
			}

			// Verify a match, and that no context was specified for #id
			if ( match && (match[1] || !context) ) {

				// HANDLE: $(html) -> $(array)
				if ( match[1] ) {
					context = context instanceof jQuery ? context[0] : context;
					doc = (context ? context.ownerDocument || context : document);

					// If a single string is passed in and it's a single tag
					// just do a createElement and skip the rest
					ret = rsingleTag.exec( selector );

					if ( ret ) {
						if ( jQuery.isPlainObject( context ) ) {
							selector = [ document.createElement( ret[1] ) ];
							jQuery.fn.attr.call( selector, context, true );

						} else {
							selector = [ doc.createElement( ret[1] ) ];
						}

					} else {
						ret = jQuery.buildFragment( [ match[1] ], [ doc ] );
						selector = (ret.cacheable ? jQuery.clone(ret.fragment) : ret.fragment).childNodes;
					}

					return jQuery.merge( this, selector );

				// HANDLE: $("#id")
				} else {
					elem = document.getElementById( match[2] );

					// Check parentNode to catch when Blackberry 4.6 returns
					// nodes that are no longer in the document #6963
					if ( elem && elem.parentNode ) {
						// Handle the case where IE and Opera return items
						// by name instead of ID
						if ( elem.id !== match[2] ) {
							return rootjQuery.find( selector );
						}

						// Otherwise, we inject the element directly into the jQuery object
						this.length = 1;
						this[0] = elem;
					}

					this.context = document;
					this.selector = selector;
					return this;
				}

			// HANDLE: $(expr, $(...))
			} else if ( !context || context.jquery ) {
				return (context || rootjQuery).find( selector );

			// HANDLE: $(expr, context)
			// (which is just equivalent to: $(context).find(expr)
			} else {
				return this.constructor( context ).find( selector );
			}

		// HANDLE: $(function)
		// Shortcut for document ready
		} else if ( jQuery.isFunction( selector ) ) {
			return rootjQuery.ready( selector );
		}

		if (selector.selector !== undefined) {
			this.selector = selector.selector;
			this.context = selector.context;
		}

		return jQuery.makeArray( selector, this );
	},

	// Start with an empty selector
	selector: "",

	// The current version of jQuery being used
	jquery: "1.6.2",

	// The default length of a jQuery object is 0
	length: 0,

	// The number of elements contained in the matched element set
	size: function() {
		return this.length;
	},

	toArray: function() {
		return slice.call( this, 0 );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {
		return num == null ?

			// Return a 'clean' array
			this.toArray() :

			// Return just the object
			( num < 0 ? this[ this.length + num ] : this[ num ] );
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems, name, selector ) {
		// Build a new jQuery matched element set
		var ret = this.constructor();

		if ( jQuery.isArray( elems ) ) {
			push.apply( ret, elems );

		} else {
			jQuery.merge( ret, elems );
		}

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;

		ret.context = this.context;

		if ( name === "find" ) {
			ret.selector = this.selector + (this.selector ? " " : "") + selector;
		} else if ( name ) {
			ret.selector = this.selector + "." + name + "(" + selector + ")";
		}

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	// (You can seed the arguments with an array of args, but this is
	// only used internally.)
	each: function( callback, args ) {
		return jQuery.each( this, callback, args );
	},

	ready: function( fn ) {
		// Attach the listeners
		jQuery.bindReady();

		// Add the callback
		readyList.done( fn );

		return this;
	},

	eq: function( i ) {
		return i === -1 ?
			this.slice( i ) :
			this.slice( i, +i + 1 );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ),
			"slice", slice.call(arguments).join(",") );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map(this, function( elem, i ) {
			return callback.call( elem, i, elem );
		}));
	},

	end: function() {
		return this.prevObject || this.constructor(null);
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: [].sort,
	splice: [].splice
};

// Give the init function the jQuery prototype for later instantiation
jQuery.fn.init.prototype = jQuery.fn;

jQuery.extend = jQuery.fn.extend = function() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !jQuery.isFunction(target) ) {
		target = {};
	}

	// extend jQuery itself if only one argument is passed
	if ( length === i ) {
		target = this;
		--i;
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( (options = arguments[ i ]) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)) ) ) {
					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && jQuery.isArray(src) ? src : [];

					} else {
						clone = src && jQuery.isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend({
	noConflict: function( deep ) {
		if ( window.$ === jQuery ) {
			window.$ = _$;
		}

		if ( deep && window.jQuery === jQuery ) {
			window.jQuery = _jQuery;
		}

		return jQuery;
	},

	// Is the DOM ready to be used? Set to true once it occurs.
	isReady: false,

	// A counter to track how many items to wait for before
	// the ready event fires. See #6781
	readyWait: 1,

	// Hold (or release) the ready event
	holdReady: function( hold ) {
		if ( hold ) {
			jQuery.readyWait++;
		} else {
			jQuery.ready( true );
		}
	},

	// Handle when the DOM is ready
	ready: function( wait ) {
		// Either a released hold or an DOMready/load event and not yet ready
		if ( (wait === true && !--jQuery.readyWait) || (wait !== true && !jQuery.isReady) ) {
			// Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
			if ( !document.body ) {
				return setTimeout( jQuery.ready, 1 );
			}

			// Remember that the DOM is ready
			jQuery.isReady = true;

			// If a normal DOM Ready event fired, decrement, and wait if need be
			if ( wait !== true && --jQuery.readyWait > 0 ) {
				return;
			}

			// If there are functions bound, to execute
			readyList.resolveWith( document, [ jQuery ] );

			// Trigger any bound ready events
			if ( jQuery.fn.trigger ) {
				jQuery( document ).trigger( "ready" ).unbind( "ready" );
			}
		}
	},

	bindReady: function() {
		if ( readyList ) {
			return;
		}

		readyList = jQuery._Deferred();

		// Catch cases where $(document).ready() is called after the
		// browser event has already occurred.
		if ( document.readyState === "complete" ) {
			// Handle it asynchronously to allow scripts the opportunity to delay ready
			return setTimeout( jQuery.ready, 1 );
		}

		// Mozilla, Opera and webkit nightlies currently support this event
		if ( document.addEventListener ) {
			// Use the handy event callback
			document.addEventListener( "DOMContentLoaded", DOMContentLoaded, false );

			// A fallback to window.onload, that will always work
			window.addEventListener( "load", jQuery.ready, false );

		// If IE event model is used
		} else if ( document.attachEvent ) {
			// ensure firing before onload,
			// maybe late but safe also for iframes
			document.attachEvent( "onreadystatechange", DOMContentLoaded );

			// A fallback to window.onload, that will always work
			window.attachEvent( "onload", jQuery.ready );

			// If IE and not a frame
			// continually check to see if the document is ready
			var toplevel = false;

			try {
				toplevel = window.frameElement == null;
			} catch(e) {}

			if ( document.documentElement.doScroll && toplevel ) {
				doScrollCheck();
			}
		}
	},

	// See test/unit/core.js for details concerning isFunction.
	// Since version 1.3, DOM methods and functions like alert
	// aren't supported. They return false on IE (#2968).
	isFunction: function( obj ) {
		return jQuery.type(obj) === "function";
	},

	isArray: Array.isArray || function( obj ) {
		return jQuery.type(obj) === "array";
	},

	// A crude way of determining if an object is a window
	isWindow: function( obj ) {
		return obj && typeof obj === "object" && "setInterval" in obj;
	},

	isNaN: function( obj ) {
		return obj == null || !rdigit.test( obj ) || isNaN( obj );
	},

	type: function( obj ) {
		return obj == null ?
			String( obj ) :
			class2type[ toString.call(obj) ] || "object";
	},

	isPlainObject: function( obj ) {
		// Must be an Object.
		// Because of IE, we also have to check the presence of the constructor property.
		// Make sure that DOM nodes and window objects don't pass through, as well
		if ( !obj || jQuery.type(obj) !== "object" || obj.nodeType || jQuery.isWindow( obj ) ) {
			return false;
		}

		// Not own constructor property must be Object
		if ( obj.constructor &&
			!hasOwn.call(obj, "constructor") &&
			!hasOwn.call(obj.constructor.prototype, "isPrototypeOf") ) {
			return false;
		}

		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.

		var key;
		for ( key in obj ) {}

		return key === undefined || hasOwn.call( obj, key );
	},

	isEmptyObject: function( obj ) {
		for ( var name in obj ) {
			return false;
		}
		return true;
	},

	error: function( msg ) {
		throw msg;
	},

	parseJSON: function( data ) {
		if ( typeof data !== "string" || !data ) {
			return null;
		}

		// Make sure leading/trailing whitespace is removed (IE can't handle it)
		data = jQuery.trim( data );

		// Attempt to parse using the native JSON parser first
		if ( window.JSON && window.JSON.parse ) {
			return window.JSON.parse( data );
		}

		// Make sure the incoming data is actual JSON
		// Logic borrowed from http://json.org/json2.js
		if ( rvalidchars.test( data.replace( rvalidescape, "@" )
			.replace( rvalidtokens, "]" )
			.replace( rvalidbraces, "")) ) {

			return (new Function( "return " + data ))();

		}
		jQuery.error( "Invalid JSON: " + data );
	},

	// Cross-browser xml parsing
	// (xml & tmp used internally)
	parseXML: function( data , xml , tmp ) {

		if ( window.DOMParser ) { // Standard
			tmp = new DOMParser();
			xml = tmp.parseFromString( data , "text/xml" );
		} else { // IE
			xml = new ActiveXObject( "Microsoft.XMLDOM" );
			xml.async = "false";
			xml.loadXML( data );
		}

		tmp = xml.documentElement;

		if ( ! tmp || ! tmp.nodeName || tmp.nodeName === "parsererror" ) {
			jQuery.error( "Invalid XML: " + data );
		}

		return xml;
	},

	noop: function() {},

	// Evaluates a script in a global context
	// Workarounds based on findings by Jim Driscoll
	// http://weblogs.java.net/blog/driscoll/archive/2009/09/08/eval-javascript-global-context
	globalEval: function( data ) {
		if ( data && rnotwhite.test( data ) ) {
			// We use execScript on Internet Explorer
			// We use an anonymous function so that context is window
			// rather than jQuery in Firefox
			( window.execScript || function( data ) {
				window[ "eval" ].call( window, data );
			} )( data );
		}
	},

	// Converts a dashed string to camelCased string;
	// Used by both the css and data modules
	camelCase: function( string ) {
		return string.replace( rdashAlpha, fcamelCase );
	},

	nodeName: function( elem, name ) {
		return elem.nodeName && elem.nodeName.toUpperCase() === name.toUpperCase();
	},

	// args is for internal usage only
	each: function( object, callback, args ) {
		var name, i = 0,
			length = object.length,
			isObj = length === undefined || jQuery.isFunction( object );

		if ( args ) {
			if ( isObj ) {
				for ( name in object ) {
					if ( callback.apply( object[ name ], args ) === false ) {
						break;
					}
				}
			} else {
				for ( ; i < length; ) {
					if ( callback.apply( object[ i++ ], args ) === false ) {
						break;
					}
				}
			}

		// A special, fast, case for the most common use of each
		} else {
			if ( isObj ) {
				for ( name in object ) {
					if ( callback.call( object[ name ], name, object[ name ] ) === false ) {
						break;
					}
				}
			} else {
				for ( ; i < length; ) {
					if ( callback.call( object[ i ], i, object[ i++ ] ) === false ) {
						break;
					}
				}
			}
		}

		return object;
	},

	// Use native String.trim function wherever possible
	trim: trim ?
		function( text ) {
			return text == null ?
				"" :
				trim.call( text );
		} :

		// Otherwise use our own trimming functionality
		function( text ) {
			return text == null ?
				"" :
				text.toString().replace( trimLeft, "" ).replace( trimRight, "" );
		},

	// results is for internal usage only
	makeArray: function( array, results ) {
		var ret = results || [];

		if ( array != null ) {
			// The window, strings (and functions) also have 'length'
			// The extra typeof function check is to prevent crashes
			// in Safari 2 (See: #3039)
			// Tweaked logic slightly to handle Blackberry 4.7 RegExp issues #6930
			var type = jQuery.type( array );

			if ( array.length == null || type === "string" || type === "function" || type === "regexp" || jQuery.isWindow( array ) ) {
				push.call( ret, array );
			} else {
				jQuery.merge( ret, array );
			}
		}

		return ret;
	},

	inArray: function( elem, array ) {

		if ( indexOf ) {
			return indexOf.call( array, elem );
		}

		for ( var i = 0, length = array.length; i < length; i++ ) {
			if ( array[ i ] === elem ) {
				return i;
			}
		}

		return -1;
	},

	merge: function( first, second ) {
		var i = first.length,
			j = 0;

		if ( typeof second.length === "number" ) {
			for ( var l = second.length; j < l; j++ ) {
				first[ i++ ] = second[ j ];
			}

		} else {
			while ( second[j] !== undefined ) {
				first[ i++ ] = second[ j++ ];
			}
		}

		first.length = i;

		return first;
	},

	grep: function( elems, callback, inv ) {
		var ret = [], retVal;
		inv = !!inv;

		// Go through the array, only saving the items
		// that pass the validator function
		for ( var i = 0, length = elems.length; i < length; i++ ) {
			retVal = !!callback( elems[ i ], i );
			if ( inv !== retVal ) {
				ret.push( elems[ i ] );
			}
		}

		return ret;
	},

	// arg is for internal usage only
	map: function( elems, callback, arg ) {
		var value, key, ret = [],
			i = 0,
			length = elems.length,
			// jquery objects are treated as arrays
			isArray = elems instanceof jQuery || length !== undefined && typeof length === "number" && ( ( length > 0 && elems[ 0 ] && elems[ length -1 ] ) || length === 0 || jQuery.isArray( elems ) ) ;

		// Go through the array, translating each of the items to their
		if ( isArray ) {
			for ( ; i < length; i++ ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret[ ret.length ] = value;
				}
			}

		// Go through every key on the object,
		} else {
			for ( key in elems ) {
				value = callback( elems[ key ], key, arg );

				if ( value != null ) {
					ret[ ret.length ] = value;
				}
			}
		}

		// Flatten any nested arrays
		return ret.concat.apply( [], ret );
	},

	// A global GUID counter for objects
	guid: 1,

	// Bind a function to a context, optionally partially applying any
	// arguments.
	proxy: function( fn, context ) {
		if ( typeof context === "string" ) {
			var tmp = fn[ context ];
			context = fn;
			fn = tmp;
		}

		// Quick check to determine if target is callable, in the spec
		// this throws a TypeError, but we will just return undefined.
		if ( !jQuery.isFunction( fn ) ) {
			return undefined;
		}

		// Simulated bind
		var args = slice.call( arguments, 2 ),
			proxy = function() {
				return fn.apply( context, args.concat( slice.call( arguments ) ) );
			};

		// Set the guid of unique handler to the same of original handler, so it can be removed
		proxy.guid = fn.guid = fn.guid || proxy.guid || jQuery.guid++;

		return proxy;
	},

	// Mutifunctional method to get and set values to a collection
	// The value/s can optionally be executed if it's a function
	access: function( elems, key, value, exec, fn, pass ) {
		var length = elems.length;

		// Setting many attributes
		if ( typeof key === "object" ) {
			for ( var k in key ) {
				jQuery.access( elems, k, key[k], exec, fn, value );
			}
			return elems;
		}

		// Setting one attribute
		if ( value !== undefined ) {
			// Optionally, function values get executed if exec is true
			exec = !pass && exec && jQuery.isFunction(value);

			for ( var i = 0; i < length; i++ ) {
				fn( elems[i], key, exec ? value.call( elems[i], i, fn( elems[i], key ) ) : value, pass );
			}

			return elems;
		}

		// Getting an attribute
		return length ? fn( elems[0], key ) : undefined;
	},

	now: function() {
		return (new Date()).getTime();
	},

	// Use of jQuery.browser is frowned upon.
	// More details: http://docs.jquery.com/Utilities/jQuery.browser
	uaMatch: function( ua ) {
		ua = ua.toLowerCase();

		var match = rwebkit.exec( ua ) ||
			ropera.exec( ua ) ||
			rmsie.exec( ua ) ||
			ua.indexOf("compatible") < 0 && rmozilla.exec( ua ) ||
			[];

		return { browser: match[1] || "", version: match[2] || "0" };
	},

	sub: function() {
		function jQuerySub( selector, context ) {
			return new jQuerySub.fn.init( selector, context );
		}
		jQuery.extend( true, jQuerySub, this );
		jQuerySub.superclass = this;
		jQuerySub.fn = jQuerySub.prototype = this();
		jQuerySub.fn.constructor = jQuerySub;
		jQuerySub.sub = this.sub;
		jQuerySub.fn.init = function init( selector, context ) {
			if ( context && context instanceof jQuery && !(context instanceof jQuerySub) ) {
				context = jQuerySub( context );
			}

			return jQuery.fn.init.call( this, selector, context, rootjQuerySub );
		};
		jQuerySub.fn.init.prototype = jQuerySub.fn;
		var rootjQuerySub = jQuerySub(document);
		return jQuerySub;
	},

	browser: {}
});

// Populate the class2type map
jQuery.each("Boolean Number String Function Array Date RegExp Object".split(" "), function(i, name) {
	class2type[ "[object " + name + "]" ] = name.toLowerCase();
});

browserMatch = jQuery.uaMatch( userAgent );
if ( browserMatch.browser ) {
	jQuery.browser[ browserMatch.browser ] = true;
	jQuery.browser.version = browserMatch.version;
}

// Deprecated, use jQuery.browser.webkit instead
if ( jQuery.browser.webkit ) {
	jQuery.browser.safari = true;
}

// IE doesn't match non-breaking spaces with \s
if ( rnotwhite.test( "\xA0" ) ) {
	trimLeft = /^[\s\xA0]+/;
	trimRight = /[\s\xA0]+$/;
}

// All jQuery objects should point back to these
rootjQuery = jQuery(document);

// Cleanup functions for the document ready method
if ( document.addEventListener ) {
	DOMContentLoaded = function() {
		document.removeEventListener( "DOMContentLoaded", DOMContentLoaded, false );
		jQuery.ready();
	};

} else if ( document.attachEvent ) {
	DOMContentLoaded = function() {
		// Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
		if ( document.readyState === "complete" ) {
			document.detachEvent( "onreadystatechange", DOMContentLoaded );
			jQuery.ready();
		}
	};
}

// The DOM ready check for Internet Explorer
function doScrollCheck() {
	if ( jQuery.isReady ) {
		return;
	}

	try {
		// If IE is used, use the trick by Diego Perini
		// http://javascript.nwbox.com/IEContentLoaded/
		document.documentElement.doScroll("left");
	} catch(e) {
		setTimeout( doScrollCheck, 1 );
		return;
	}

	// and execute any waiting functions
	jQuery.ready();
}

return jQuery;

})();


var // Promise methods
	promiseMethods = "done fail isResolved isRejected promise then always pipe".split( " " ),
	// Static reference to slice
	sliceDeferred = [].slice;

jQuery.extend({
	// Create a simple deferred (one callbacks list)
	_Deferred: function() {
		var // callbacks list
			callbacks = [],
			// stored [ context , args ]
			fired,
			// to avoid firing when already doing so
			firing,
			// flag to know if the deferred has been cancelled
			cancelled,
			// the deferred itself
			deferred  = {

				// done( f1, f2, ...)
				done: function() {
					if ( !cancelled ) {
						var args = arguments,
							i,
							length,
							elem,
							type,
							_fired;
						if ( fired ) {
							_fired = fired;
							fired = 0;
						}
						for ( i = 0, length = args.length; i < length; i++ ) {
							elem = args[ i ];
							type = jQuery.type( elem );
							if ( type === "array" ) {
								deferred.done.apply( deferred, elem );
							} else if ( type === "function" ) {
								callbacks.push( elem );
							}
						}
						if ( _fired ) {
							deferred.resolveWith( _fired[ 0 ], _fired[ 1 ] );
						}
					}
					return this;
				},

				// resolve with given context and args
				resolveWith: function( context, args ) {
					if ( !cancelled && !fired && !firing ) {
						// make sure args are available (#8421)
						args = args || [];
						firing = 1;
						try {
							while( callbacks[ 0 ] ) {
								callbacks.shift().apply( context, args );
							}
						}
						finally {
							fired = [ context, args ];
							firing = 0;
						}
					}
					return this;
				},

				// resolve with this as context and given arguments
				resolve: function() {
					deferred.resolveWith( this, arguments );
					return this;
				},

				// Has this deferred been resolved?
				isResolved: function() {
					return !!( firing || fired );
				},

				// Cancel
				cancel: function() {
					cancelled = 1;
					callbacks = [];
					return this;
				}
			};

		return deferred;
	},

	// Full fledged deferred (two callbacks list)
	Deferred: function( func ) {
		var deferred = jQuery._Deferred(),
			failDeferred = jQuery._Deferred(),
			promise;
		// Add errorDeferred methods, then and promise
		jQuery.extend( deferred, {
			then: function( doneCallbacks, failCallbacks ) {
				deferred.done( doneCallbacks ).fail( failCallbacks );
				return this;
			},
			always: function() {
				return deferred.done.apply( deferred, arguments ).fail.apply( this, arguments );
			},
			fail: failDeferred.done,
			rejectWith: failDeferred.resolveWith,
			reject: failDeferred.resolve,
			isRejected: failDeferred.isResolved,
			pipe: function( fnDone, fnFail ) {
				return jQuery.Deferred(function( newDefer ) {
					jQuery.each( {
						done: [ fnDone, "resolve" ],
						fail: [ fnFail, "reject" ]
					}, function( handler, data ) {
						var fn = data[ 0 ],
							action = data[ 1 ],
							returned;
						if ( jQuery.isFunction( fn ) ) {
							deferred[ handler ](function() {
								returned = fn.apply( this, arguments );
								if ( returned && jQuery.isFunction( returned.promise ) ) {
									returned.promise().then( newDefer.resolve, newDefer.reject );
								} else {
									newDefer[ action ]( returned );
								}
							});
						} else {
							deferred[ handler ]( newDefer[ action ] );
						}
					});
				}).promise();
			},
			// Get a promise for this deferred
			// If obj is provided, the promise aspect is added to the object
			promise: function( obj ) {
				if ( obj == null ) {
					if ( promise ) {
						return promise;
					}
					promise = obj = {};
				}
				var i = promiseMethods.length;
				while( i-- ) {
					obj[ promiseMethods[i] ] = deferred[ promiseMethods[i] ];
				}
				return obj;
			}
		});
		// Make sure only one callback list will be used
		deferred.done( failDeferred.cancel ).fail( deferred.cancel );
		// Unexpose cancel
		delete deferred.cancel;
		// Call given func if any
		if ( func ) {
			func.call( deferred, deferred );
		}
		return deferred;
	},

	// Deferred helper
	when: function( firstParam ) {
		var args = arguments,
			i = 0,
			length = args.length,
			count = length,
			deferred = length <= 1 && firstParam && jQuery.isFunction( firstParam.promise ) ?
				firstParam :
				jQuery.Deferred();
		function resolveFunc( i ) {
			return function( value ) {
				args[ i ] = arguments.length > 1 ? sliceDeferred.call( arguments, 0 ) : value;
				if ( !( --count ) ) {
					// Strange bug in FF4:
					// Values changed onto the arguments object sometimes end up as undefined values
					// outside the $.when method. Cloning the object into a fresh array solves the issue
					deferred.resolveWith( deferred, sliceDeferred.call( args, 0 ) );
				}
			};
		}
		if ( length > 1 ) {
			for( ; i < length; i++ ) {
				if ( args[ i ] && jQuery.isFunction( args[ i ].promise ) ) {
					args[ i ].promise().then( resolveFunc(i), deferred.reject );
				} else {
					--count;
				}
			}
			if ( !count ) {
				deferred.resolveWith( deferred, args );
			}
		} else if ( deferred !== firstParam ) {
			deferred.resolveWith( deferred, length ? [ firstParam ] : [] );
		}
		return deferred.promise();
	}
});



jQuery.support = (function() {

	var div = document.createElement( "div" ),
		documentElement = document.documentElement,
		all,
		a,
		select,
		opt,
		input,
		marginDiv,
		support,
		fragment,
		body,
		testElementParent,
		testElement,
		testElementStyle,
		tds,
		events,
		eventName,
		i,
		isSupported;

	// Preliminary tests
	div.setAttribute("className", "t");
	div.innerHTML = "   <link/><table></table><a href='/a' style='top:1px;float:left;opacity:.55;'>a</a><input type='checkbox'/>";

	all = div.getElementsByTagName( "*" );
	a = div.getElementsByTagName( "a" )[ 0 ];

	// Can't get basic test support
	if ( !all || !all.length || !a ) {
		return {};
	}

	// First batch of supports tests
	select = document.createElement( "select" );
	opt = select.appendChild( document.createElement("option") );
	input = div.getElementsByTagName( "input" )[ 0 ];

	support = {
		// IE strips leading whitespace when .innerHTML is used
		leadingWhitespace: ( div.firstChild.nodeType === 3 ),

		// Make sure that tbody elements aren't automatically inserted
		// IE will insert them into empty tables
		tbody: !div.getElementsByTagName( "tbody" ).length,

		// Make sure that link elements get serialized correctly by innerHTML
		// This requires a wrapper element in IE
		htmlSerialize: !!div.getElementsByTagName( "link" ).length,

		// Get the style information from getAttribute
		// (IE uses .cssText instead)
		style: /top/.test( a.getAttribute("style") ),

		// Make sure that URLs aren't manipulated
		// (IE normalizes it by default)
		hrefNormalized: ( a.getAttribute( "href" ) === "/a" ),

		// Make sure that element opacity exists
		// (IE uses filter instead)
		// Use a regex to work around a WebKit issue. See #5145
		opacity: /^0.55$/.test( a.style.opacity ),

		// Verify style float existence
		// (IE uses styleFloat instead of cssFloat)
		cssFloat: !!a.style.cssFloat,

		// Make sure that if no value is specified for a checkbox
		// that it defaults to "on".
		// (WebKit defaults to "" instead)
		checkOn: ( input.value === "on" ),

		// Make sure that a selected-by-default option has a working selected property.
		// (WebKit defaults to false instead of true, IE too, if it's in an optgroup)
		optSelected: opt.selected,

		// Test setAttribute on camelCase class. If it works, we need attrFixes when doing get/setAttribute (ie6/7)
		getSetAttribute: div.className !== "t",

		// Will be defined later
		submitBubbles: true,
		changeBubbles: true,
		focusinBubbles: false,
		deleteExpando: true,
		noCloneEvent: true,
		inlineBlockNeedsLayout: false,
		shrinkWrapBlocks: false,
		reliableMarginRight: true
	};

	// Make sure checked status is properly cloned
	input.checked = true;
	support.noCloneChecked = input.cloneNode( true ).checked;

	// Make sure that the options inside disabled selects aren't marked as disabled
	// (WebKit marks them as disabled)
	select.disabled = true;
	support.optDisabled = !opt.disabled;

	// Test to see if it's possible to delete an expando from an element
	// Fails in Internet Explorer
	try {
		delete div.test;
	} catch( e ) {
		support.deleteExpando = false;
	}

	if ( !div.addEventListener && div.attachEvent && div.fireEvent ) {
		div.attachEvent( "onclick", function() {
			// Cloning a node shouldn't copy over any
			// bound event handlers (IE does this)
			support.noCloneEvent = false;
		});
		div.cloneNode( true ).fireEvent( "onclick" );
	}

	// Check if a radio maintains it's value
	// after being appended to the DOM
	input = document.createElement("input");
	input.value = "t";
	input.setAttribute("type", "radio");
	support.radioValue = input.value === "t";

	input.setAttribute("checked", "checked");
	div.appendChild( input );
	fragment = document.createDocumentFragment();
	fragment.appendChild( div.firstChild );

	// WebKit doesn't clone checked state correctly in fragments
	support.checkClone = fragment.cloneNode( true ).cloneNode( true ).lastChild.checked;

	div.innerHTML = "";

	// Figure out if the W3C box model works as expected
	div.style.width = div.style.paddingLeft = "1px";

	body = document.getElementsByTagName( "body" )[ 0 ];
	// We use our own, invisible, body unless the body is already present
	// in which case we use a div (#9239)
	testElement = document.createElement( body ? "div" : "body" );
	testElementStyle = {
		visibility: "hidden",
		width: 0,
		height: 0,
		border: 0,
		margin: 0
	};
	if ( body ) {
		jQuery.extend( testElementStyle, {
			position: "absolute",
			left: -1000,
			top: -1000
		});
	}
	for ( i in testElementStyle ) {
		testElement.style[ i ] = testElementStyle[ i ];
	}
	testElement.appendChild( div );
	testElementParent = body || documentElement;
	testElementParent.insertBefore( testElement, testElementParent.firstChild );

	// Check if a disconnected checkbox will retain its checked
	// value of true after appended to the DOM (IE6/7)
	support.appendChecked = input.checked;

	support.boxModel = div.offsetWidth === 2;

	if ( "zoom" in div.style ) {
		// Check if natively block-level elements act like inline-block
		// elements when setting their display to 'inline' and giving
		// them layout
		// (IE < 8 does this)
		div.style.display = "inline";
		div.style.zoom = 1;
		support.inlineBlockNeedsLayout = ( div.offsetWidth === 2 );

		// Check if elements with layout shrink-wrap their children
		// (IE 6 does this)
		div.style.display = "";
		div.innerHTML = "<div style='width:4px;'></div>";
		support.shrinkWrapBlocks = ( div.offsetWidth !== 2 );
	}

	div.innerHTML = "<table><tr><td style='padding:0;border:0;display:none'></td><td>t</td></tr></table>";
	tds = div.getElementsByTagName( "td" );

	// Check if table cells still have offsetWidth/Height when they are set
	// to display:none and there are still other visible table cells in a
	// table row; if so, offsetWidth/Height are not reliable for use when
	// determining if an element has been hidden directly using
	// display:none (it is still safe to use offsets if a parent element is
	// hidden; don safety goggles and see bug #4512 for more information).
	// (only IE 8 fails this test)
	isSupported = ( tds[ 0 ].offsetHeight === 0 );

	tds[ 0 ].style.display = "";
	tds[ 1 ].style.display = "none";

	// Check if empty table cells still have offsetWidth/Height
	// (IE < 8 fail this test)
	support.reliableHiddenOffsets = isSupported && ( tds[ 0 ].offsetHeight === 0 );
	div.innerHTML = "";

	// Check if div with explicit width and no margin-right incorrectly
	// gets computed margin-right based on width of container. For more
	// info see bug #3333
	// Fails in WebKit before Feb 2011 nightlies
	// WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
	if ( document.defaultView && document.defaultView.getComputedStyle ) {
		marginDiv = document.createElement( "div" );
		marginDiv.style.width = "0";
		marginDiv.style.marginRight = "0";
		div.appendChild( marginDiv );
		support.reliableMarginRight =
			( parseInt( ( document.defaultView.getComputedStyle( marginDiv, null ) || { marginRight: 0 } ).marginRight, 10 ) || 0 ) === 0;
	}

	// Remove the body element we added
	testElement.innerHTML = "";
	testElementParent.removeChild( testElement );

	// Technique from Juriy Zaytsev
	// http://thinkweb2.com/projects/prototype/detecting-event-support-without-browser-sniffing/
	// We only care about the case where non-standard event systems
	// are used, namely in IE. Short-circuiting here helps us to
	// avoid an eval call (in setAttribute) which can cause CSP
	// to go haywire. See: https://developer.mozilla.org/en/Security/CSP
	if ( div.attachEvent ) {
		for( i in {
			submit: 1,
			change: 1,
			focusin: 1
		} ) {
			eventName = "on" + i;
			isSupported = ( eventName in div );
			if ( !isSupported ) {
				div.setAttribute( eventName, "return;" );
				isSupported = ( typeof div[ eventName ] === "function" );
			}
			support[ i + "Bubbles" ] = isSupported;
		}
	}

	// Null connected elements to avoid leaks in IE
	testElement = fragment = select = opt = body = marginDiv = div = input = null;

	return support;
})();

// Keep track of boxModel
jQuery.boxModel = jQuery.support.boxModel;




var rbrace = /^(?:\{.*\}|\[.*\])$/,
	rmultiDash = /([a-z])([A-Z])/g;

jQuery.extend({
	cache: {},

	// Please use with caution
	uuid: 0,

	// Unique for each copy of jQuery on the page
	// Non-digits removed to match rinlinejQuery
	expando: "jQuery" + ( jQuery.fn.jquery + Math.random() ).replace( /\D/g, "" ),

	// The following elements throw uncatchable exceptions if you
	// attempt to add expando properties to them.
	noData: {
		"embed": true,
		// Ban all objects except for Flash (which handle expandos)
		"object": "clsid:D27CDB6E-AE6D-11cf-96B8-444553540000",
		"applet": true
	},

	hasData: function( elem ) {
		elem = elem.nodeType ? jQuery.cache[ elem[jQuery.expando] ] : elem[ jQuery.expando ];

		return !!elem && !isEmptyDataObject( elem );
	},

	data: function( elem, name, data, pvt /* Internal Use Only */ ) {
		if ( !jQuery.acceptData( elem ) ) {
			return;
		}

		var internalKey = jQuery.expando, getByName = typeof name === "string", thisCache,

			// We have to handle DOM nodes and JS objects differently because IE6-7
			// can't GC object references properly across the DOM-JS boundary
			isNode = elem.nodeType,

			// Only DOM nodes need the global jQuery cache; JS object data is
			// attached directly to the object so GC can occur automatically
			cache = isNode ? jQuery.cache : elem,

			// Only defining an ID for JS objects if its cache already exists allows
			// the code to shortcut on the same path as a DOM node with no cache
			id = isNode ? elem[ jQuery.expando ] : elem[ jQuery.expando ] && jQuery.expando;

		// Avoid doing any more work than we need to when trying to get data on an
		// object that has no data at all
		if ( (!id || (pvt && id && !cache[ id ][ internalKey ])) && getByName && data === undefined ) {
			return;
		}

		if ( !id ) {
			// Only DOM nodes need a new unique ID for each element since their data
			// ends up in the global cache
			if ( isNode ) {
				elem[ jQuery.expando ] = id = ++jQuery.uuid;
			} else {
				id = jQuery.expando;
			}
		}

		if ( !cache[ id ] ) {
			cache[ id ] = {};

			// TODO: This is a hack for 1.5 ONLY. Avoids exposing jQuery
			// metadata on plain JS objects when the object is serialized using
			// JSON.stringify
			if ( !isNode ) {
				cache[ id ].toJSON = jQuery.noop;
			}
		}

		// An object can be passed to jQuery.data instead of a key/value pair; this gets
		// shallow copied over onto the existing cache
		if ( typeof name === "object" || typeof name === "function" ) {
			if ( pvt ) {
				cache[ id ][ internalKey ] = jQuery.extend(cache[ id ][ internalKey ], name);
			} else {
				cache[ id ] = jQuery.extend(cache[ id ], name);
			}
		}

		thisCache = cache[ id ];

		// Internal jQuery data is stored in a separate object inside the object's data
		// cache in order to avoid key collisions between internal data and user-defined
		// data
		if ( pvt ) {
			if ( !thisCache[ internalKey ] ) {
				thisCache[ internalKey ] = {};
			}

			thisCache = thisCache[ internalKey ];
		}

		if ( data !== undefined ) {
			thisCache[ jQuery.camelCase( name ) ] = data;
		}

		// TODO: This is a hack for 1.5 ONLY. It will be removed in 1.6. Users should
		// not attempt to inspect the internal events object using jQuery.data, as this
		// internal data object is undocumented and subject to change.
		if ( name === "events" && !thisCache[name] ) {
			return thisCache[ internalKey ] && thisCache[ internalKey ].events;
		}

		return getByName ? 
			// Check for both converted-to-camel and non-converted data property names
			thisCache[ jQuery.camelCase( name ) ] || thisCache[ name ] :
			thisCache;
	},

	removeData: function( elem, name, pvt /* Internal Use Only */ ) {
		if ( !jQuery.acceptData( elem ) ) {
			return;
		}

		var internalKey = jQuery.expando, isNode = elem.nodeType,

			// See jQuery.data for more information
			cache = isNode ? jQuery.cache : elem,

			// See jQuery.data for more information
			id = isNode ? elem[ jQuery.expando ] : jQuery.expando;

		// If there is already no cache entry for this object, there is no
		// purpose in continuing
		if ( !cache[ id ] ) {
			return;
		}

		if ( name ) {
			var thisCache = pvt ? cache[ id ][ internalKey ] : cache[ id ];

			if ( thisCache ) {
				delete thisCache[ name ];

				// If there is no data left in the cache, we want to continue
				// and let the cache object itself get destroyed
				if ( !isEmptyDataObject(thisCache) ) {
					return;
				}
			}
		}

		// See jQuery.data for more information
		if ( pvt ) {
			delete cache[ id ][ internalKey ];

			// Don't destroy the parent cache unless the internal data object
			// had been the only thing left in it
			if ( !isEmptyDataObject(cache[ id ]) ) {
				return;
			}
		}

		var internalCache = cache[ id ][ internalKey ];

		// Browsers that fail expando deletion also refuse to delete expandos on
		// the window, but it will allow it on all other JS objects; other browsers
		// don't care
		if ( jQuery.support.deleteExpando || cache != window ) {
			delete cache[ id ];
		} else {
			cache[ id ] = null;
		}

		// We destroyed the entire user cache at once because it's faster than
		// iterating through each key, but we need to continue to persist internal
		// data if it existed
		if ( internalCache ) {
			cache[ id ] = {};
			// TODO: This is a hack for 1.5 ONLY. Avoids exposing jQuery
			// metadata on plain JS objects when the object is serialized using
			// JSON.stringify
			if ( !isNode ) {
				cache[ id ].toJSON = jQuery.noop;
			}

			cache[ id ][ internalKey ] = internalCache;

		// Otherwise, we need to eliminate the expando on the node to avoid
		// false lookups in the cache for entries that no longer exist
		} else if ( isNode ) {
			// IE does not allow us to delete expando properties from nodes,
			// nor does it have a removeAttribute function on Document nodes;
			// we must handle all of these cases
			if ( jQuery.support.deleteExpando ) {
				delete elem[ jQuery.expando ];
			} else if ( elem.removeAttribute ) {
				elem.removeAttribute( jQuery.expando );
			} else {
				elem[ jQuery.expando ] = null;
			}
		}
	},

	// For internal use only.
	_data: function( elem, name, data ) {
		return jQuery.data( elem, name, data, true );
	},

	// A method for determining if a DOM node can handle the data expando
	acceptData: function( elem ) {
		if ( elem.nodeName ) {
			var match = jQuery.noData[ elem.nodeName.toLowerCase() ];

			if ( match ) {
				return !(match === true || elem.getAttribute("classid") !== match);
			}
		}

		return true;
	}
});

jQuery.fn.extend({
	data: function( key, value ) {
		var data = null;

		if ( typeof key === "undefined" ) {
			if ( this.length ) {
				data = jQuery.data( this[0] );

				if ( this[0].nodeType === 1 ) {
			    var attr = this[0].attributes, name;
					for ( var i = 0, l = attr.length; i < l; i++ ) {
						name = attr[i].name;

						if ( name.indexOf( "data-" ) === 0 ) {
							name = jQuery.camelCase( name.substring(5) );

							dataAttr( this[0], name, data[ name ] );
						}
					}
				}
			}

			return data;

		} else if ( typeof key === "object" ) {
			return this.each(function() {
				jQuery.data( this, key );
			});
		}

		var parts = key.split(".");
		parts[1] = parts[1] ? "." + parts[1] : "";

		if ( value === undefined ) {
			data = this.triggerHandler("getData" + parts[1] + "!", [parts[0]]);

			// Try to fetch any internally stored data first
			if ( data === undefined && this.length ) {
				data = jQuery.data( this[0], key );
				data = dataAttr( this[0], key, data );
			}

			return data === undefined && parts[1] ?
				this.data( parts[0] ) :
				data;

		} else {
			return this.each(function() {
				var $this = jQuery( this ),
					args = [ parts[0], value ];

				$this.triggerHandler( "setData" + parts[1] + "!", args );
				jQuery.data( this, key, value );
				$this.triggerHandler( "changeData" + parts[1] + "!", args );
			});
		}
	},

	removeData: function( key ) {
		return this.each(function() {
			jQuery.removeData( this, key );
		});
	}
});

function dataAttr( elem, key, data ) {
	// If nothing was found internally, try to fetch any
	// data from the HTML5 data-* attribute
	if ( data === undefined && elem.nodeType === 1 ) {
		var name = "data-" + key.replace( rmultiDash, "$1-$2" ).toLowerCase();

		data = elem.getAttribute( name );

		if ( typeof data === "string" ) {
			try {
				data = data === "true" ? true :
				data === "false" ? false :
				data === "null" ? null :
				!jQuery.isNaN( data ) ? parseFloat( data ) :
					rbrace.test( data ) ? jQuery.parseJSON( data ) :
					data;
			} catch( e ) {}

			// Make sure we set the data so it isn't changed later
			jQuery.data( elem, key, data );

		} else {
			data = undefined;
		}
	}

	return data;
}

// TODO: This is a hack for 1.5 ONLY to allow objects with a single toJSON
// property to be considered empty objects; this property always exists in
// order to make sure JSON.stringify does not expose internal metadata
function isEmptyDataObject( obj ) {
	for ( var name in obj ) {
		if ( name !== "toJSON" ) {
			return false;
		}
	}

	return true;
}




function handleQueueMarkDefer( elem, type, src ) {
	var deferDataKey = type + "defer",
		queueDataKey = type + "queue",
		markDataKey = type + "mark",
		defer = jQuery.data( elem, deferDataKey, undefined, true );
	if ( defer &&
		( src === "queue" || !jQuery.data( elem, queueDataKey, undefined, true ) ) &&
		( src === "mark" || !jQuery.data( elem, markDataKey, undefined, true ) ) ) {
		// Give room for hard-coded callbacks to fire first
		// and eventually mark/queue something else on the element
		setTimeout( function() {
			if ( !jQuery.data( elem, queueDataKey, undefined, true ) &&
				!jQuery.data( elem, markDataKey, undefined, true ) ) {
				jQuery.removeData( elem, deferDataKey, true );
				defer.resolve();
			}
		}, 0 );
	}
}

jQuery.extend({

	_mark: function( elem, type ) {
		if ( elem ) {
			type = (type || "fx") + "mark";
			jQuery.data( elem, type, (jQuery.data(elem,type,undefined,true) || 0) + 1, true );
		}
	},

	_unmark: function( force, elem, type ) {
		if ( force !== true ) {
			type = elem;
			elem = force;
			force = false;
		}
		if ( elem ) {
			type = type || "fx";
			var key = type + "mark",
				count = force ? 0 : ( (jQuery.data( elem, key, undefined, true) || 1 ) - 1 );
			if ( count ) {
				jQuery.data( elem, key, count, true );
			} else {
				jQuery.removeData( elem, key, true );
				handleQueueMarkDefer( elem, type, "mark" );
			}
		}
	},

	queue: function( elem, type, data ) {
		if ( elem ) {
			type = (type || "fx") + "queue";
			var q = jQuery.data( elem, type, undefined, true );
			// Speed up dequeue by getting out quickly if this is just a lookup
			if ( data ) {
				if ( !q || jQuery.isArray(data) ) {
					q = jQuery.data( elem, type, jQuery.makeArray(data), true );
				} else {
					q.push( data );
				}
			}
			return q || [];
		}
	},

	dequeue: function( elem, type ) {
		type = type || "fx";

		var queue = jQuery.queue( elem, type ),
			fn = queue.shift(),
			defer;

		// If the fx queue is dequeued, always remove the progress sentinel
		if ( fn === "inprogress" ) {
			fn = queue.shift();
		}

		if ( fn ) {
			// Add a progress sentinel to prevent the fx queue from being
			// automatically dequeued
			if ( type === "fx" ) {
				queue.unshift("inprogress");
			}

			fn.call(elem, function() {
				jQuery.dequeue(elem, type);
			});
		}

		if ( !queue.length ) {
			jQuery.removeData( elem, type + "queue", true );
			handleQueueMarkDefer( elem, type, "queue" );
		}
	}
});

jQuery.fn.extend({
	queue: function( type, data ) {
		if ( typeof type !== "string" ) {
			data = type;
			type = "fx";
		}

		if ( data === undefined ) {
			return jQuery.queue( this[0], type );
		}
		return this.each(function() {
			var queue = jQuery.queue( this, type, data );

			if ( type === "fx" && queue[0] !== "inprogress" ) {
				jQuery.dequeue( this, type );
			}
		});
	},
	dequeue: function( type ) {
		return this.each(function() {
			jQuery.dequeue( this, type );
		});
	},
	// Based off of the plugin by Clint Helfers, with permission.
	// http://blindsignals.com/index.php/2009/07/jquery-delay/
	delay: function( time, type ) {
		time = jQuery.fx ? jQuery.fx.speeds[time] || time : time;
		type = type || "fx";

		return this.queue( type, function() {
			var elem = this;
			setTimeout(function() {
				jQuery.dequeue( elem, type );
			}, time );
		});
	},
	clearQueue: function( type ) {
		return this.queue( type || "fx", [] );
	},
	// Get a promise resolved when queues of a certain type
	// are emptied (fx is the type by default)
	promise: function( type, object ) {
		if ( typeof type !== "string" ) {
			object = type;
			type = undefined;
		}
		type = type || "fx";
		var defer = jQuery.Deferred(),
			elements = this,
			i = elements.length,
			count = 1,
			deferDataKey = type + "defer",
			queueDataKey = type + "queue",
			markDataKey = type + "mark",
			tmp;
		function resolve() {
			if ( !( --count ) ) {
				defer.resolveWith( elements, [ elements ] );
			}
		}
		while( i-- ) {
			if (( tmp = jQuery.data( elements[ i ], deferDataKey, undefined, true ) ||
					( jQuery.data( elements[ i ], queueDataKey, undefined, true ) ||
						jQuery.data( elements[ i ], markDataKey, undefined, true ) ) &&
					jQuery.data( elements[ i ], deferDataKey, jQuery._Deferred(), true ) )) {
				count++;
				tmp.done( resolve );
			}
		}
		resolve();
		return defer.promise();
	}
});




var rclass = /[\n\t\r]/g,
	rspace = /\s+/,
	rreturn = /\r/g,
	rtype = /^(?:button|input)$/i,
	rfocusable = /^(?:button|input|object|select|textarea)$/i,
	rclickable = /^a(?:rea)?$/i,
	rboolean = /^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i,
	rinvalidChar = /\:|^on/,
	formHook, boolHook;

jQuery.fn.extend({
	attr: function( name, value ) {
		return jQuery.access( this, name, value, true, jQuery.attr );
	},

	removeAttr: function( name ) {
		return this.each(function() {
			jQuery.removeAttr( this, name );
		});
	},
	
	prop: function( name, value ) {
		return jQuery.access( this, name, value, true, jQuery.prop );
	},
	
	removeProp: function( name ) {
		name = jQuery.propFix[ name ] || name;
		return this.each(function() {
			// try/catch handles cases where IE balks (such as removing a property on window)
			try {
				this[ name ] = undefined;
				delete this[ name ];
			} catch( e ) {}
		});
	},

	addClass: function( value ) {
		var classNames, i, l, elem,
			setClass, c, cl;

		if ( jQuery.isFunction( value ) ) {
			return this.each(function( j ) {
				jQuery( this ).addClass( value.call(this, j, this.className) );
			});
		}

		if ( value && typeof value === "string" ) {
			classNames = value.split( rspace );

			for ( i = 0, l = this.length; i < l; i++ ) {
				elem = this[ i ];

				if ( elem.nodeType === 1 ) {
					if ( !elem.className && classNames.length === 1 ) {
						elem.className = value;

					} else {
						setClass = " " + elem.className + " ";

						for ( c = 0, cl = classNames.length; c < cl; c++ ) {
							if ( !~setClass.indexOf( " " + classNames[ c ] + " " ) ) {
								setClass += classNames[ c ] + " ";
							}
						}
						elem.className = jQuery.trim( setClass );
					}
				}
			}
		}

		return this;
	},

	removeClass: function( value ) {
		var classNames, i, l, elem, className, c, cl;

		if ( jQuery.isFunction( value ) ) {
			return this.each(function( j ) {
				jQuery( this ).removeClass( value.call(this, j, this.className) );
			});
		}

		if ( (value && typeof value === "string") || value === undefined ) {
			classNames = (value || "").split( rspace );

			for ( i = 0, l = this.length; i < l; i++ ) {
				elem = this[ i ];

				if ( elem.nodeType === 1 && elem.className ) {
					if ( value ) {
						className = (" " + elem.className + " ").replace( rclass, " " );
						for ( c = 0, cl = classNames.length; c < cl; c++ ) {
							className = className.replace(" " + classNames[ c ] + " ", " ");
						}
						elem.className = jQuery.trim( className );

					} else {
						elem.className = "";
					}
				}
			}
		}

		return this;
	},

	toggleClass: function( value, stateVal ) {
		var type = typeof value,
			isBool = typeof stateVal === "boolean";

		if ( jQuery.isFunction( value ) ) {
			return this.each(function( i ) {
				jQuery( this ).toggleClass( value.call(this, i, this.className, stateVal), stateVal );
			});
		}

		return this.each(function() {
			if ( type === "string" ) {
				// toggle individual class names
				var className,
					i = 0,
					self = jQuery( this ),
					state = stateVal,
					classNames = value.split( rspace );

				while ( (className = classNames[ i++ ]) ) {
					// check each className given, space seperated list
					state = isBool ? state : !self.hasClass( className );
					self[ state ? "addClass" : "removeClass" ]( className );
				}

			} else if ( type === "undefined" || type === "boolean" ) {
				if ( this.className ) {
					// store className if set
					jQuery._data( this, "__className__", this.className );
				}

				// toggle whole className
				this.className = this.className || value === false ? "" : jQuery._data( this, "__className__" ) || "";
			}
		});
	},

	hasClass: function( selector ) {
		var className = " " + selector + " ";
		for ( var i = 0, l = this.length; i < l; i++ ) {
			if ( (" " + this[i].className + " ").replace(rclass, " ").indexOf( className ) > -1 ) {
				return true;
			}
		}

		return false;
	},

	val: function( value ) {
		var hooks, ret,
			elem = this[0];
		
		if ( !arguments.length ) {
			if ( elem ) {
				hooks = jQuery.valHooks[ elem.nodeName.toLowerCase() ] || jQuery.valHooks[ elem.type ];

				if ( hooks && "get" in hooks && (ret = hooks.get( elem, "value" )) !== undefined ) {
					return ret;
				}

				ret = elem.value;

				return typeof ret === "string" ? 
					// handle most common string cases
					ret.replace(rreturn, "") : 
					// handle cases where value is null/undef or number
					ret == null ? "" : ret;
			}

			return undefined;
		}

		var isFunction = jQuery.isFunction( value );

		return this.each(function( i ) {
			var self = jQuery(this), val;

			if ( this.nodeType !== 1 ) {
				return;
			}

			if ( isFunction ) {
				val = value.call( this, i, self.val() );
			} else {
				val = value;
			}

			// Treat null/undefined as ""; convert numbers to string
			if ( val == null ) {
				val = "";
			} else if ( typeof val === "number" ) {
				val += "";
			} else if ( jQuery.isArray( val ) ) {
				val = jQuery.map(val, function ( value ) {
					return value == null ? "" : value + "";
				});
			}

			hooks = jQuery.valHooks[ this.nodeName.toLowerCase() ] || jQuery.valHooks[ this.type ];

			// If set returns undefined, fall back to normal setting
			if ( !hooks || !("set" in hooks) || hooks.set( this, val, "value" ) === undefined ) {
				this.value = val;
			}
		});
	}
});

jQuery.extend({
	valHooks: {
		option: {
			get: function( elem ) {
				// attributes.value is undefined in Blackberry 4.7 but
				// uses .value. See #6932
				var val = elem.attributes.value;
				return !val || val.specified ? elem.value : elem.text;
			}
		},
		select: {
			get: function( elem ) {
				var value,
					index = elem.selectedIndex,
					values = [],
					options = elem.options,
					one = elem.type === "select-one";

				// Nothing was selected
				if ( index < 0 ) {
					return null;
				}

				// Loop through all the selected options
				for ( var i = one ? index : 0, max = one ? index + 1 : options.length; i < max; i++ ) {
					var option = options[ i ];

					// Don't return options that are disabled or in a disabled optgroup
					if ( option.selected && (jQuery.support.optDisabled ? !option.disabled : option.getAttribute("disabled") === null) &&
							(!option.parentNode.disabled || !jQuery.nodeName( option.parentNode, "optgroup" )) ) {

						// Get the specific value for the option
						value = jQuery( option ).val();

						// We don't need an array for one selects
						if ( one ) {
							return value;
						}

						// Multi-Selects return an array
						values.push( value );
					}
				}

				// Fixes Bug #2551 -- select.val() broken in IE after form.reset()
				if ( one && !values.length && options.length ) {
					return jQuery( options[ index ] ).val();
				}

				return values;
			},

			set: function( elem, value ) {
				var values = jQuery.makeArray( value );

				jQuery(elem).find("option").each(function() {
					this.selected = jQuery.inArray( jQuery(this).val(), values ) >= 0;
				});

				if ( !values.length ) {
					elem.selectedIndex = -1;
				}
				return values;
			}
		}
	},

	attrFn: {
		val: true,
		css: true,
		html: true,
		text: true,
		data: true,
		width: true,
		height: true,
		offset: true
	},
	
	attrFix: {
		// Always normalize to ensure hook usage
		tabindex: "tabIndex"
	},
	
	attr: function( elem, name, value, pass ) {
		var nType = elem.nodeType;
		
		// don't get/set attributes on text, comment and attribute nodes
		if ( !elem || nType === 3 || nType === 8 || nType === 2 ) {
			return undefined;
		}

		if ( pass && name in jQuery.attrFn ) {
			return jQuery( elem )[ name ]( value );
		}

		// Fallback to prop when attributes are not supported
		if ( !("getAttribute" in elem) ) {
			return jQuery.prop( elem, name, value );
		}

		var ret, hooks,
			notxml = nType !== 1 || !jQuery.isXMLDoc( elem );

		// Normalize the name if needed
		if ( notxml ) {
			name = jQuery.attrFix[ name ] || name;

			hooks = jQuery.attrHooks[ name ];

			if ( !hooks ) {
				// Use boolHook for boolean attributes
				if ( rboolean.test( name ) ) {

					hooks = boolHook;

				// Use formHook for forms and if the name contains certain characters
				} else if ( formHook && name !== "className" &&
					(jQuery.nodeName( elem, "form" ) || rinvalidChar.test( name )) ) {

					hooks = formHook;
				}
			}
		}

		if ( value !== undefined ) {

			if ( value === null ) {
				jQuery.removeAttr( elem, name );
				return undefined;

			} else if ( hooks && "set" in hooks && notxml && (ret = hooks.set( elem, value, name )) !== undefined ) {
				return ret;

			} else {
				elem.setAttribute( name, "" + value );
				return value;
			}

		} else if ( hooks && "get" in hooks && notxml && (ret = hooks.get( elem, name )) !== null ) {
			return ret;

		} else {

			ret = elem.getAttribute( name );

			// Non-existent attributes return null, we normalize to undefined
			return ret === null ?
				undefined :
				ret;
		}
	},

	removeAttr: function( elem, name ) {
		var propName;
		if ( elem.nodeType === 1 ) {
			name = jQuery.attrFix[ name ] || name;
		
			if ( jQuery.support.getSetAttribute ) {
				// Use removeAttribute in browsers that support it
				elem.removeAttribute( name );
			} else {
				jQuery.attr( elem, name, "" );
				elem.removeAttributeNode( elem.getAttributeNode( name ) );
			}

			// Set corresponding property to false for boolean attributes
			if ( rboolean.test( name ) && (propName = jQuery.propFix[ name ] || name) in elem ) {
				elem[ propName ] = false;
			}
		}
	},

	attrHooks: {
		type: {
			set: function( elem, value ) {
				// We can't allow the type property to be changed (since it causes problems in IE)
				if ( rtype.test( elem.nodeName ) && elem.parentNode ) {
					jQuery.error( "type property can't be changed" );
				} else if ( !jQuery.support.radioValue && value === "radio" && jQuery.nodeName(elem, "input") ) {
					// Setting the type on a radio button after the value resets the value in IE6-9
					// Reset value to it's default in case type is set after value
					// This is for element creation
					var val = elem.value;
					elem.setAttribute( "type", value );
					if ( val ) {
						elem.value = val;
					}
					return value;
				}
			}
		},
		tabIndex: {
			get: function( elem ) {
				// elem.tabIndex doesn't always return the correct value when it hasn't been explicitly set
				// http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
				var attributeNode = elem.getAttributeNode("tabIndex");

				return attributeNode && attributeNode.specified ?
					parseInt( attributeNode.value, 10 ) :
					rfocusable.test( elem.nodeName ) || rclickable.test( elem.nodeName ) && elem.href ?
						0 :
						undefined;
			}
		},
		// Use the value property for back compat
		// Use the formHook for button elements in IE6/7 (#1954)
		value: {
			get: function( elem, name ) {
				if ( formHook && jQuery.nodeName( elem, "button" ) ) {
					return formHook.get( elem, name );
				}
				return name in elem ?
					elem.value :
					null;
			},
			set: function( elem, value, name ) {
				if ( formHook && jQuery.nodeName( elem, "button" ) ) {
					return formHook.set( elem, value, name );
				}
				// Does not return so that setAttribute is also used
				elem.value = value;
			}
		}
	},

	propFix: {
		tabindex: "tabIndex",
		readonly: "readOnly",
		"for": "htmlFor",
		"class": "className",
		maxlength: "maxLength",
		cellspacing: "cellSpacing",
		cellpadding: "cellPadding",
		rowspan: "rowSpan",
		colspan: "colSpan",
		usemap: "useMap",
		frameborder: "frameBorder",
		contenteditable: "contentEditable"
	},
	
	prop: function( elem, name, value ) {
		var nType = elem.nodeType;

		// don't get/set properties on text, comment and attribute nodes
		if ( !elem || nType === 3 || nType === 8 || nType === 2 ) {
			return undefined;
		}

		var ret, hooks,
			notxml = nType !== 1 || !jQuery.isXMLDoc( elem );

		if ( notxml ) {
			// Fix name and attach hooks
			name = jQuery.propFix[ name ] || name;
			hooks = jQuery.propHooks[ name ];
		}

		if ( value !== undefined ) {
			if ( hooks && "set" in hooks && (ret = hooks.set( elem, value, name )) !== undefined ) {
				return ret;

			} else {
				return (elem[ name ] = value);
			}

		} else {
			if ( hooks && "get" in hooks && (ret = hooks.get( elem, name )) !== undefined ) {
				return ret;

			} else {
				return elem[ name ];
			}
		}
	},
	
	propHooks: {}
});

// Hook for boolean attributes
boolHook = {
	get: function( elem, name ) {
		// Align boolean attributes with corresponding properties
		return jQuery.prop( elem, name ) ?
			name.toLowerCase() :
			undefined;
	},
	set: function( elem, value, name ) {
		var propName;
		if ( value === false ) {
			// Remove boolean attributes when set to false
			jQuery.removeAttr( elem, name );
		} else {
			// value is true since we know at this point it's type boolean and not false
			// Set boolean attributes to the same name and set the DOM property
			propName = jQuery.propFix[ name ] || name;
			if ( propName in elem ) {
				// Only set the IDL specifically if it already exists on the element
				elem[ propName ] = true;
			}

			elem.setAttribute( name, name.toLowerCase() );
		}
		return name;
	}
};

// IE6/7 do not support getting/setting some attributes with get/setAttribute
if ( !jQuery.support.getSetAttribute ) {

	// propFix is more comprehensive and contains all fixes
	jQuery.attrFix = jQuery.propFix;
	
	// Use this for any attribute on a form in IE6/7
	formHook = jQuery.attrHooks.name = jQuery.attrHooks.title = jQuery.valHooks.button = {
		get: function( elem, name ) {
			var ret;
			ret = elem.getAttributeNode( name );
			// Return undefined if nodeValue is empty string
			return ret && ret.nodeValue !== "" ?
				ret.nodeValue :
				undefined;
		},
		set: function( elem, value, name ) {
			// Check form objects in IE (multiple bugs related)
			// Only use nodeValue if the attribute node exists on the form
			var ret = elem.getAttributeNode( name );
			if ( ret ) {
				ret.nodeValue = value;
				return value;
			}
		}
	};

	// Set width and height to auto instead of 0 on empty string( Bug #8150 )
	// This is for removals
	jQuery.each([ "width", "height" ], function( i, name ) {
		jQuery.attrHooks[ name ] = jQuery.extend( jQuery.attrHooks[ name ], {
			set: function( elem, value ) {
				if ( value === "" ) {
					elem.setAttribute( name, "auto" );
					return value;
				}
			}
		});
	});
}


// Some attributes require a special call on IE
if ( !jQuery.support.hrefNormalized ) {
	jQuery.each([ "href", "src", "width", "height" ], function( i, name ) {
		jQuery.attrHooks[ name ] = jQuery.extend( jQuery.attrHooks[ name ], {
			get: function( elem ) {
				var ret = elem.getAttribute( name, 2 );
				return ret === null ? undefined : ret;
			}
		});
	});
}

if ( !jQuery.support.style ) {
	jQuery.attrHooks.style = {
		get: function( elem ) {
			// Return undefined in the case of empty string
			// Normalize to lowercase since IE uppercases css property names
			return elem.style.cssText.toLowerCase() || undefined;
		},
		set: function( elem, value ) {
			return (elem.style.cssText = "" + value);
		}
	};
}

// Safari mis-reports the default selected property of an option
// Accessing the parent's selectedIndex property fixes it
if ( !jQuery.support.optSelected ) {
	jQuery.propHooks.selected = jQuery.extend( jQuery.propHooks.selected, {
		get: function( elem ) {
			var parent = elem.parentNode;

			if ( parent ) {
				parent.selectedIndex;

				// Make sure that it also works with optgroups, see #5701
				if ( parent.parentNode ) {
					parent.parentNode.selectedIndex;
				}
			}
		}
	});
}

// Radios and checkboxes getter/setter
if ( !jQuery.support.checkOn ) {
	jQuery.each([ "radio", "checkbox" ], function() {
		jQuery.valHooks[ this ] = {
			get: function( elem ) {
				// Handle the case where in Webkit "" is returned instead of "on" if a value isn't specified
				return elem.getAttribute("value") === null ? "on" : elem.value;
			}
		};
	});
}
jQuery.each([ "radio", "checkbox" ], function() {
	jQuery.valHooks[ this ] = jQuery.extend( jQuery.valHooks[ this ], {
		set: function( elem, value ) {
			if ( jQuery.isArray( value ) ) {
				return (elem.checked = jQuery.inArray( jQuery(elem).val(), value ) >= 0);
			}
		}
	});
});




var rnamespaces = /\.(.*)$/,
	rformElems = /^(?:textarea|input|select)$/i,
	rperiod = /\./g,
	rspaces = / /g,
	rescape = /[^\w\s.|`]/g,
	fcleanup = function( nm ) {
		return nm.replace(rescape, "\\$&");
	};

/*
 * A number of helper functions used for managing events.
 * Many of the ideas behind this code originated from
 * Dean Edwards' addEvent library.
 */
jQuery.event = {

	// Bind an event to an element
	// Original by Dean Edwards
	add: function( elem, types, handler, data ) {
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		if ( handler === false ) {
			handler = returnFalse;
		} else if ( !handler ) {
			// Fixes bug #7229. Fix recommended by jdalton
			return;
		}

		var handleObjIn, handleObj;

		if ( handler.handler ) {
			handleObjIn = handler;
			handler = handleObjIn.handler;
		}

		// Make sure that the function being executed has a unique ID
		if ( !handler.guid ) {
			handler.guid = jQuery.guid++;
		}

		// Init the element's event structure
		var elemData = jQuery._data( elem );

		// If no elemData is found then we must be trying to bind to one of the
		// banned noData elements
		if ( !elemData ) {
			return;
		}

		var events = elemData.events,
			eventHandle = elemData.handle;

		if ( !events ) {
			elemData.events = events = {};
		}

		if ( !eventHandle ) {
			elemData.handle = eventHandle = function( e ) {
				// Discard the second event of a jQuery.event.trigger() and
				// when an event is called after a page has unloaded
				return typeof jQuery !== "undefined" && (!e || jQuery.event.triggered !== e.type) ?
					jQuery.event.handle.apply( eventHandle.elem, arguments ) :
					undefined;
			};
		}

		// Add elem as a property of the handle function
		// This is to prevent a memory leak with non-native events in IE.
		eventHandle.elem = elem;

		// Handle multiple events separated by a space
		// jQuery(...).bind("mouseover mouseout", fn);
		types = types.split(" ");

		var type, i = 0, namespaces;

		while ( (type = types[ i++ ]) ) {
			handleObj = handleObjIn ?
				jQuery.extend({}, handleObjIn) :
				{ handler: handler, data: data };

			// Namespaced event handlers
			if ( type.indexOf(".") > -1 ) {
				namespaces = type.split(".");
				type = namespaces.shift();
				handleObj.namespace = namespaces.slice(0).sort().join(".");

			} else {
				namespaces = [];
				handleObj.namespace = "";
			}

			handleObj.type = type;
			if ( !handleObj.guid ) {
				handleObj.guid = handler.guid;
			}

			// Get the current list of functions bound to this event
			var handlers = events[ type ],
				special = jQuery.event.special[ type ] || {};

			// Init the event handler queue
			if ( !handlers ) {
				handlers = events[ type ] = [];

				// Check for a special event handler
				// Only use addEventListener/attachEvent if the special
				// events handler returns false
				if ( !special.setup || special.setup.call( elem, data, namespaces, eventHandle ) === false ) {
					// Bind the global event handler to the element
					if ( elem.addEventListener ) {
						elem.addEventListener( type, eventHandle, false );

					} else if ( elem.attachEvent ) {
						elem.attachEvent( "on" + type, eventHandle );
					}
				}
			}

			if ( special.add ) {
				special.add.call( elem, handleObj );

				if ( !handleObj.handler.guid ) {
					handleObj.handler.guid = handler.guid;
				}
			}

			// Add the function to the element's handler list
			handlers.push( handleObj );

			// Keep track of which events have been used, for event optimization
			jQuery.event.global[ type ] = true;
		}

		// Nullify elem to prevent memory leaks in IE
		elem = null;
	},

	global: {},

	// Detach an event or set of events from an element
	remove: function( elem, types, handler, pos ) {
		// don't do events on text and comment nodes
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		if ( handler === false ) {
			handler = returnFalse;
		}

		var ret, type, fn, j, i = 0, all, namespaces, namespace, special, eventType, handleObj, origType,
			elemData = jQuery.hasData( elem ) && jQuery._data( elem ),
			events = elemData && elemData.events;

		if ( !elemData || !events ) {
			return;
		}

		// types is actually an event object here
		if ( types && types.type ) {
			handler = types.handler;
			types = types.type;
		}

		// Unbind all events for the element
		if ( !types || typeof types === "string" && types.charAt(0) === "." ) {
			types = types || "";

			for ( type in events ) {
				jQuery.event.remove( elem, type + types );
			}

			return;
		}

		// Handle multiple events separated by a space
		// jQuery(...).unbind("mouseover mouseout", fn);
		types = types.split(" ");

		while ( (type = types[ i++ ]) ) {
			origType = type;
			handleObj = null;
			all = type.indexOf(".") < 0;
			namespaces = [];

			if ( !all ) {
				// Namespaced event handlers
				namespaces = type.split(".");
				type = namespaces.shift();

				namespace = new RegExp("(^|\\.)" +
					jQuery.map( namespaces.slice(0).sort(), fcleanup ).join("\\.(?:.*\\.)?") + "(\\.|$)");
			}

			eventType = events[ type ];

			if ( !eventType ) {
				continue;
			}

			if ( !handler ) {
				for ( j = 0; j < eventType.length; j++ ) {
					handleObj = eventType[ j ];

					if ( all || namespace.test( handleObj.namespace ) ) {
						jQuery.event.remove( elem, origType, handleObj.handler, j );
						eventType.splice( j--, 1 );
					}
				}

				continue;
			}

			special = jQuery.event.special[ type ] || {};

			for ( j = pos || 0; j < eventType.length; j++ ) {
				handleObj = eventType[ j ];

				if ( handler.guid === handleObj.guid ) {
					// remove the given handler for the given type
					if ( all || namespace.test( handleObj.namespace ) ) {
						if ( pos == null ) {
							eventType.splice( j--, 1 );
						}

						if ( special.remove ) {
							special.remove.call( elem, handleObj );
						}
					}

					if ( pos != null ) {
						break;
					}
				}
			}

			// remove generic event handler if no more handlers exist
			if ( eventType.length === 0 || pos != null && eventType.length === 1 ) {
				if ( !special.teardown || special.teardown.call( elem, namespaces ) === false ) {
					jQuery.removeEvent( elem, type, elemData.handle );
				}

				ret = null;
				delete events[ type ];
			}
		}

		// Remove the expando if it's no longer used
		if ( jQuery.isEmptyObject( events ) ) {
			var handle = elemData.handle;
			if ( handle ) {
				handle.elem = null;
			}

			delete elemData.events;
			delete elemData.handle;

			if ( jQuery.isEmptyObject( elemData ) ) {
				jQuery.removeData( elem, undefined, true );
			}
		}
	},
	
	// Events that are safe to short-circuit if no handlers are attached.
	// Native DOM events should not be added, they may have inline handlers.
	customEvent: {
		"getData": true,
		"setData": true,
		"changeData": true
	},

	trigger: function( event, data, elem, onlyHandlers ) {
		// Event object or event type
		var type = event.type || event,
			namespaces = [],
			exclusive;

		if ( type.indexOf("!") >= 0 ) {
			// Exclusive events trigger only for the exact event (no namespaces)
			type = type.slice(0, -1);
			exclusive = true;
		}

		if ( type.indexOf(".") >= 0 ) {
			// Namespaced trigger; create a regexp to match event type in handle()
			namespaces = type.split(".");
			type = namespaces.shift();
			namespaces.sort();
		}

		if ( (!elem || jQuery.event.customEvent[ type ]) && !jQuery.event.global[ type ] ) {
			// No jQuery handlers for this event type, and it can't have inline handlers
			return;
		}

		// Caller can pass in an Event, Object, or just an event type string
		event = typeof event === "object" ?
			// jQuery.Event object
			event[ jQuery.expando ] ? event :
			// Object literal
			new jQuery.Event( type, event ) :
			// Just the event type (string)
			new jQuery.Event( type );

		event.type = type;
		event.exclusive = exclusive;
		event.namespace = namespaces.join(".");
		event.namespace_re = new RegExp("(^|\\.)" + namespaces.join("\\.(?:.*\\.)?") + "(\\.|$)");
		
		// triggerHandler() and global events don't bubble or run the default action
		if ( onlyHandlers || !elem ) {
			event.preventDefault();
			event.stopPropagation();
		}

		// Handle a global trigger
		if ( !elem ) {
			// TODO: Stop taunting the data cache; remove global events and always attach to document
			jQuery.each( jQuery.cache, function() {
				// internalKey variable is just used to make it easier to find
				// and potentially change this stuff later; currently it just
				// points to jQuery.expando
				var internalKey = jQuery.expando,
					internalCache = this[ internalKey ];
				if ( internalCache && internalCache.events && internalCache.events[ type ] ) {
					jQuery.event.trigger( event, data, internalCache.handle.elem );
				}
			});
			return;
		}

		// Don't do events on text and comment nodes
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		// Clean up the event in case it is being reused
		event.result = undefined;
		event.target = elem;

		// Clone any incoming data and prepend the event, creating the handler arg list
		data = data != null ? jQuery.makeArray( data ) : [];
		data.unshift( event );

		var cur = elem,
			// IE doesn't like method names with a colon (#3533, #8272)
			ontype = type.indexOf(":") < 0 ? "on" + type : "";

		// Fire event on the current element, then bubble up the DOM tree
		do {
			var handle = jQuery._data( cur, "handle" );

			event.currentTarget = cur;
			if ( handle ) {
				handle.apply( cur, data );
			}

			// Trigger an inline bound script
			if ( ontype && jQuery.acceptData( cur ) && cur[ ontype ] && cur[ ontype ].apply( cur, data ) === false ) {
				event.result = false;
				event.preventDefault();
			}

			// Bubble up to document, then to window
			cur = cur.parentNode || cur.ownerDocument || cur === event.target.ownerDocument && window;
		} while ( cur && !event.isPropagationStopped() );

		// If nobody prevented the default action, do it now
		if ( !event.isDefaultPrevented() ) {
			var old,
				special = jQuery.event.special[ type ] || {};

			if ( (!special._default || special._default.call( elem.ownerDocument, event ) === false) &&
				!(type === "click" && jQuery.nodeName( elem, "a" )) && jQuery.acceptData( elem ) ) {

				// Call a native DOM method on the target with the same name name as the event.
				// Can't use an .isFunction)() check here because IE6/7 fails that test.
				// IE<9 dies on focus to hidden element (#1486), may want to revisit a try/catch.
				try {
					if ( ontype && elem[ type ] ) {
						// Don't re-trigger an onFOO event when we call its FOO() method
						old = elem[ ontype ];

						if ( old ) {
							elem[ ontype ] = null;
						}

						jQuery.event.triggered = type;
						elem[ type ]();
					}
				} catch ( ieError ) {}

				if ( old ) {
					elem[ ontype ] = old;
				}

				jQuery.event.triggered = undefined;
			}
		}
		
		return event.result;
	},

	handle: function( event ) {
		event = jQuery.event.fix( event || window.event );
		// Snapshot the handlers list since a called handler may add/remove events.
		var handlers = ((jQuery._data( this, "events" ) || {})[ event.type ] || []).slice(0),
			run_all = !event.exclusive && !event.namespace,
			args = Array.prototype.slice.call( arguments, 0 );

		// Use the fix-ed Event rather than the (read-only) native event
		args[0] = event;
		event.currentTarget = this;

		for ( var j = 0, l = handlers.length; j < l; j++ ) {
			var handleObj = handlers[ j ];

			// Triggered event must 1) be non-exclusive and have no namespace, or
			// 2) have namespace(s) a subset or equal to those in the bound event.
			if ( run_all || event.namespace_re.test( handleObj.namespace ) ) {
				// Pass in a reference to the handler function itself
				// So that we can later remove it
				event.handler = handleObj.handler;
				event.data = handleObj.data;
				event.handleObj = handleObj;

				var ret = handleObj.handler.apply( this, args );

				if ( ret !== undefined ) {
					event.result = ret;
					if ( ret === false ) {
						event.preventDefault();
						event.stopPropagation();
					}
				}

				if ( event.isImmediatePropagationStopped() ) {
					break;
				}
			}
		}
		return event.result;
	},

	props: "altKey attrChange attrName bubbles button cancelable charCode clientX clientY ctrlKey currentTarget data detail eventPhase fromElement handler keyCode layerX layerY metaKey newValue offsetX offsetY pageX pageY prevValue relatedNode relatedTarget screenX screenY shiftKey srcElement target toElement view wheelDelta which".split(" "),

	fix: function( event ) {
		if ( event[ jQuery.expando ] ) {
			return event;
		}

		// store a copy of the original event object
		// and "clone" to set read-only properties
		var originalEvent = event;
		event = jQuery.Event( originalEvent );

		for ( var i = this.props.length, prop; i; ) {
			prop = this.props[ --i ];
			event[ prop ] = originalEvent[ prop ];
		}

		// Fix target property, if necessary
		if ( !event.target ) {
			// Fixes #1925 where srcElement might not be defined either
			event.target = event.srcElement || document;
		}

		// check if target is a textnode (safari)
		if ( event.target.nodeType === 3 ) {
			event.target = event.target.parentNode;
		}

		// Add relatedTarget, if necessary
		if ( !event.relatedTarget && event.fromElement ) {
			event.relatedTarget = event.fromElement === event.target ? event.toElement : event.fromElement;
		}

		// Calculate pageX/Y if missing and clientX/Y available
		if ( event.pageX == null && event.clientX != null ) {
			var eventDocument = event.target.ownerDocument || document,
				doc = eventDocument.documentElement,
				body = eventDocument.body;

			event.pageX = event.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc && doc.clientLeft || body && body.clientLeft || 0);
			event.pageY = event.clientY + (doc && doc.scrollTop  || body && body.scrollTop  || 0) - (doc && doc.clientTop  || body && body.clientTop  || 0);
		}

		// Add which for key events
		if ( event.which == null && (event.charCode != null || event.keyCode != null) ) {
			event.which = event.charCode != null ? event.charCode : event.keyCode;
		}

		// Add metaKey to non-Mac browsers (use ctrl for PC's and Meta for Macs)
		if ( !event.metaKey && event.ctrlKey ) {
			event.metaKey = event.ctrlKey;
		}

		// Add which for click: 1 === left; 2 === middle; 3 === right
		// Note: button is not normalized, so don't use it
		if ( !event.which && event.button !== undefined ) {
			event.which = (event.button & 1 ? 1 : ( event.button & 2 ? 3 : ( event.button & 4 ? 2 : 0 ) ));
		}

		return event;
	},

	// Deprecated, use jQuery.guid instead
	guid: 1E8,

	// Deprecated, use jQuery.proxy instead
	proxy: jQuery.proxy,

	special: {
		ready: {
			// Make sure the ready event is setup
			setup: jQuery.bindReady,
			teardown: jQuery.noop
		},

		live: {
			add: function( handleObj ) {
				jQuery.event.add( this,
					liveConvert( handleObj.origType, handleObj.selector ),
					jQuery.extend({}, handleObj, {handler: liveHandler, guid: handleObj.handler.guid}) );
			},

			remove: function( handleObj ) {
				jQuery.event.remove( this, liveConvert( handleObj.origType, handleObj.selector ), handleObj );
			}
		},

		beforeunload: {
			setup: function( data, namespaces, eventHandle ) {
				// We only want to do this special case on windows
				if ( jQuery.isWindow( this ) ) {
					this.onbeforeunload = eventHandle;
				}
			},

			teardown: function( namespaces, eventHandle ) {
				if ( this.onbeforeunload === eventHandle ) {
					this.onbeforeunload = null;
				}
			}
		}
	}
};

jQuery.removeEvent = document.removeEventListener ?
	function( elem, type, handle ) {
		if ( elem.removeEventListener ) {
			elem.removeEventListener( type, handle, false );
		}
	} :
	function( elem, type, handle ) {
		if ( elem.detachEvent ) {
			elem.detachEvent( "on" + type, handle );
		}
	};

jQuery.Event = function( src, props ) {
	// Allow instantiation without the 'new' keyword
	if ( !this.preventDefault ) {
		return new jQuery.Event( src, props );
	}

	// Event object
	if ( src && src.type ) {
		this.originalEvent = src;
		this.type = src.type;

		// Events bubbling up the document may have been marked as prevented
		// by a handler lower down the tree; reflect the correct value.
		this.isDefaultPrevented = (src.defaultPrevented || src.returnValue === false ||
			src.getPreventDefault && src.getPreventDefault()) ? returnTrue : returnFalse;

	// Event type
	} else {
		this.type = src;
	}

	// Put explicitly provided properties onto the event object
	if ( props ) {
		jQuery.extend( this, props );
	}

	// timeStamp is buggy for some events on Firefox(#3843)
	// So we won't rely on the native value
	this.timeStamp = jQuery.now();

	// Mark it as fixed
	this[ jQuery.expando ] = true;
};

function returnFalse() {
	return false;
}
function returnTrue() {
	return true;
}

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
jQuery.Event.prototype = {
	preventDefault: function() {
		this.isDefaultPrevented = returnTrue;

		var e = this.originalEvent;
		if ( !e ) {
			return;
		}

		// if preventDefault exists run it on the original event
		if ( e.preventDefault ) {
			e.preventDefault();

		// otherwise set the returnValue property of the original event to false (IE)
		} else {
			e.returnValue = false;
		}
	},
	stopPropagation: function() {
		this.isPropagationStopped = returnTrue;

		var e = this.originalEvent;
		if ( !e ) {
			return;
		}
		// if stopPropagation exists run it on the original event
		if ( e.stopPropagation ) {
			e.stopPropagation();
		}
		// otherwise set the cancelBubble property of the original event to true (IE)
		e.cancelBubble = true;
	},
	stopImmediatePropagation: function() {
		this.isImmediatePropagationStopped = returnTrue;
		this.stopPropagation();
	},
	isDefaultPrevented: returnFalse,
	isPropagationStopped: returnFalse,
	isImmediatePropagationStopped: returnFalse
};

// Checks if an event happened on an element within another element
// Used in jQuery.event.special.mouseenter and mouseleave handlers
var withinElement = function( event ) {

	// Check if mouse(over|out) are still within the same parent element
	var related = event.relatedTarget,
		inside = false,
		eventType = event.type;

	event.type = event.data;

	if ( related !== this ) {

		if ( related ) {
			inside = jQuery.contains( this, related );
		}

		if ( !inside ) {

			jQuery.event.handle.apply( this, arguments );

			event.type = eventType;
		}
	}
},

// In case of event delegation, we only need to rename the event.type,
// liveHandler will take care of the rest.
delegate = function( event ) {
	event.type = event.data;
	jQuery.event.handle.apply( this, arguments );
};

// Create mouseenter and mouseleave events
jQuery.each({
	mouseenter: "mouseover",
	mouseleave: "mouseout"
}, function( orig, fix ) {
	jQuery.event.special[ orig ] = {
		setup: function( data ) {
			jQuery.event.add( this, fix, data && data.selector ? delegate : withinElement, orig );
		},
		teardown: function( data ) {
			jQuery.event.remove( this, fix, data && data.selector ? delegate : withinElement );
		}
	};
});

// submit delegation
if ( !jQuery.support.submitBubbles ) {

	jQuery.event.special.submit = {
		setup: function( data, namespaces ) {
			if ( !jQuery.nodeName( this, "form" ) ) {
				jQuery.event.add(this, "click.specialSubmit", function( e ) {
					var elem = e.target,
						type = elem.type;

					if ( (type === "submit" || type === "image") && jQuery( elem ).closest("form").length ) {
						trigger( "submit", this, arguments );
					}
				});

				jQuery.event.add(this, "keypress.specialSubmit", function( e ) {
					var elem = e.target,
						type = elem.type;

					if ( (type === "text" || type === "password") && jQuery( elem ).closest("form").length && e.keyCode === 13 ) {
						trigger( "submit", this, arguments );
					}
				});

			} else {
				return false;
			}
		},

		teardown: function( namespaces ) {
			jQuery.event.remove( this, ".specialSubmit" );
		}
	};

}

// change delegation, happens here so we have bind.
if ( !jQuery.support.changeBubbles ) {

	var changeFilters,

	getVal = function( elem ) {
		var type = elem.type, val = elem.value;

		if ( type === "radio" || type === "checkbox" ) {
			val = elem.checked;

		} else if ( type === "select-multiple" ) {
			val = elem.selectedIndex > -1 ?
				jQuery.map( elem.options, function( elem ) {
					return elem.selected;
				}).join("-") :
				"";

		} else if ( jQuery.nodeName( elem, "select" ) ) {
			val = elem.selectedIndex;
		}

		return val;
	},

	testChange = function testChange( e ) {
		var elem = e.target, data, val;

		if ( !rformElems.test( elem.nodeName ) || elem.readOnly ) {
			return;
		}

		data = jQuery._data( elem, "_change_data" );
		val = getVal(elem);

		// the current data will be also retrieved by beforeactivate
		if ( e.type !== "focusout" || elem.type !== "radio" ) {
			jQuery._data( elem, "_change_data", val );
		}

		if ( data === undefined || val === data ) {
			return;
		}

		if ( data != null || val ) {
			e.type = "change";
			e.liveFired = undefined;
			jQuery.event.trigger( e, arguments[1], elem );
		}
	};

	jQuery.event.special.change = {
		filters: {
			focusout: testChange,

			beforedeactivate: testChange,

			click: function( e ) {
				var elem = e.target, type = jQuery.nodeName( elem, "input" ) ? elem.type : "";

				if ( type === "radio" || type === "checkbox" || jQuery.nodeName( elem, "select" ) ) {
					testChange.call( this, e );
				}
			},

			// Change has to be called before submit
			// Keydown will be called before keypress, which is used in submit-event delegation
			keydown: function( e ) {
				var elem = e.target, type = jQuery.nodeName( elem, "input" ) ? elem.type : "";

				if ( (e.keyCode === 13 && !jQuery.nodeName( elem, "textarea" ) ) ||
					(e.keyCode === 32 && (type === "checkbox" || type === "radio")) ||
					type === "select-multiple" ) {
					testChange.call( this, e );
				}
			},

			// Beforeactivate happens also before the previous element is blurred
			// with this event you can't trigger a change event, but you can store
			// information
			beforeactivate: function( e ) {
				var elem = e.target;
				jQuery._data( elem, "_change_data", getVal(elem) );
			}
		},

		setup: function( data, namespaces ) {
			if ( this.type === "file" ) {
				return false;
			}

			for ( var type in changeFilters ) {
				jQuery.event.add( this, type + ".specialChange", changeFilters[type] );
			}

			return rformElems.test( this.nodeName );
		},

		teardown: function( namespaces ) {
			jQuery.event.remove( this, ".specialChange" );

			return rformElems.test( this.nodeName );
		}
	};

	changeFilters = jQuery.event.special.change.filters;

	// Handle when the input is .focus()'d
	changeFilters.focus = changeFilters.beforeactivate;
}

function trigger( type, elem, args ) {
	// Piggyback on a donor event to simulate a different one.
	// Fake originalEvent to avoid donor's stopPropagation, but if the
	// simulated event prevents default then we do the same on the donor.
	// Don't pass args or remember liveFired; they apply to the donor event.
	var event = jQuery.extend( {}, args[ 0 ] );
	event.type = type;
	event.originalEvent = {};
	event.liveFired = undefined;
	jQuery.event.handle.call( elem, event );
	if ( event.isDefaultPrevented() ) {
		args[ 0 ].preventDefault();
	}
}

// Create "bubbling" focus and blur events
if ( !jQuery.support.focusinBubbles ) {
	jQuery.each({ focus: "focusin", blur: "focusout" }, function( orig, fix ) {

		// Attach a single capturing handler while someone wants focusin/focusout
		var attaches = 0;

		jQuery.event.special[ fix ] = {
			setup: function() {
				if ( attaches++ === 0 ) {
					document.addEventListener( orig, handler, true );
				}
			},
			teardown: function() {
				if ( --attaches === 0 ) {
					document.removeEventListener( orig, handler, true );
				}
			}
		};

		function handler( donor ) {
			// Donor event is always a native one; fix it and switch its type.
			// Let focusin/out handler cancel the donor focus/blur event.
			var e = jQuery.event.fix( donor );
			e.type = fix;
			e.originalEvent = {};
			jQuery.event.trigger( e, null, e.target );
			if ( e.isDefaultPrevented() ) {
				donor.preventDefault();
			}
		}
	});
}

jQuery.each(["bind", "one"], function( i, name ) {
	jQuery.fn[ name ] = function( type, data, fn ) {
		var handler;

		// Handle object literals
		if ( typeof type === "object" ) {
			for ( var key in type ) {
				this[ name ](key, data, type[key], fn);
			}
			return this;
		}

		if ( arguments.length === 2 || data === false ) {
			fn = data;
			data = undefined;
		}

		if ( name === "one" ) {
			handler = function( event ) {
				jQuery( this ).unbind( event, handler );
				return fn.apply( this, arguments );
			};
			handler.guid = fn.guid || jQuery.guid++;
		} else {
			handler = fn;
		}

		if ( type === "unload" && name !== "one" ) {
			this.one( type, data, fn );

		} else {
			for ( var i = 0, l = this.length; i < l; i++ ) {
				jQuery.event.add( this[i], type, handler, data );
			}
		}

		return this;
	};
});

jQuery.fn.extend({
	unbind: function( type, fn ) {
		// Handle object literals
		if ( typeof type === "object" && !type.preventDefault ) {
			for ( var key in type ) {
				this.unbind(key, type[key]);
			}

		} else {
			for ( var i = 0, l = this.length; i < l; i++ ) {
				jQuery.event.remove( this[i], type, fn );
			}
		}

		return this;
	},

	delegate: function( selector, types, data, fn ) {
		return this.live( types, data, fn, selector );
	},

	undelegate: function( selector, types, fn ) {
		if ( arguments.length === 0 ) {
			return this.unbind( "live" );

		} else {
			return this.die( types, null, fn, selector );
		}
	},

	trigger: function( type, data ) {
		return this.each(function() {
			jQuery.event.trigger( type, data, this );
		});
	},

	triggerHandler: function( type, data ) {
		if ( this[0] ) {
			return jQuery.event.trigger( type, data, this[0], true );
		}
	},

	toggle: function( fn ) {
		// Save reference to arguments for access in closure
		var args = arguments,
			guid = fn.guid || jQuery.guid++,
			i = 0,
			toggler = function( event ) {
				// Figure out which function to execute
				var lastToggle = ( jQuery.data( this, "lastToggle" + fn.guid ) || 0 ) % i;
				jQuery.data( this, "lastToggle" + fn.guid, lastToggle + 1 );

				// Make sure that clicks stop
				event.preventDefault();

				// and execute the function
				return args[ lastToggle ].apply( this, arguments ) || false;
			};

		// link all the functions, so any of them can unbind this click handler
		toggler.guid = guid;
		while ( i < args.length ) {
			args[ i++ ].guid = guid;
		}

		return this.click( toggler );
	},

	hover: function( fnOver, fnOut ) {
		return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
	}
});

var liveMap = {
	focus: "focusin",
	blur: "focusout",
	mouseenter: "mouseover",
	mouseleave: "mouseout"
};

jQuery.each(["live", "die"], function( i, name ) {
	jQuery.fn[ name ] = function( types, data, fn, origSelector /* Internal Use Only */ ) {
		var type, i = 0, match, namespaces, preType,
			selector = origSelector || this.selector,
			context = origSelector ? this : jQuery( this.context );

		if ( typeof types === "object" && !types.preventDefault ) {
			for ( var key in types ) {
				context[ name ]( key, data, types[key], selector );
			}

			return this;
		}

		if ( name === "die" && !types &&
					origSelector && origSelector.charAt(0) === "." ) {

			context.unbind( origSelector );

			return this;
		}

		if ( data === false || jQuery.isFunction( data ) ) {
			fn = data || returnFalse;
			data = undefined;
		}

		types = (types || "").split(" ");

		while ( (type = types[ i++ ]) != null ) {
			match = rnamespaces.exec( type );
			namespaces = "";

			if ( match )  {
				namespaces = match[0];
				type = type.replace( rnamespaces, "" );
			}

			if ( type === "hover" ) {
				types.push( "mouseenter" + namespaces, "mouseleave" + namespaces );
				continue;
			}

			preType = type;

			if ( liveMap[ type ] ) {
				types.push( liveMap[ type ] + namespaces );
				type = type + namespaces;

			} else {
				type = (liveMap[ type ] || type) + namespaces;
			}

			if ( name === "live" ) {
				// bind live handler
				for ( var j = 0, l = context.length; j < l; j++ ) {
					jQuery.event.add( context[j], "live." + liveConvert( type, selector ),
						{ data: data, selector: selector, handler: fn, origType: type, origHandler: fn, preType: preType } );
				}

			} else {
				// unbind live handler
				context.unbind( "live." + liveConvert( type, selector ), fn );
			}
		}

		return this;
	};
});

function liveHandler( event ) {
	var stop, maxLevel, related, match, handleObj, elem, j, i, l, data, close, namespace, ret,
		elems = [],
		selectors = [],
		events = jQuery._data( this, "events" );

	// Make sure we avoid non-left-click bubbling in Firefox (#3861) and disabled elements in IE (#6911)
	if ( event.liveFired === this || !events || !events.live || event.target.disabled || event.button && event.type === "click" ) {
		return;
	}

	if ( event.namespace ) {
		namespace = new RegExp("(^|\\.)" + event.namespace.split(".").join("\\.(?:.*\\.)?") + "(\\.|$)");
	}

	event.liveFired = this;

	var live = events.live.slice(0);

	for ( j = 0; j < live.length; j++ ) {
		handleObj = live[j];

		if ( handleObj.origType.replace( rnamespaces, "" ) === event.type ) {
			selectors.push( handleObj.selector );

		} else {
			live.splice( j--, 1 );
		}
	}

	match = jQuery( event.target ).closest( selectors, event.currentTarget );

	for ( i = 0, l = match.length; i < l; i++ ) {
		close = match[i];

		for ( j = 0; j < live.length; j++ ) {
			handleObj = live[j];

			if ( close.selector === handleObj.selector && (!namespace || namespace.test( handleObj.namespace )) && !close.elem.disabled ) {
				elem = close.elem;
				related = null;

				// Those two events require additional checking
				if ( handleObj.preType === "mouseenter" || handleObj.preType === "mouseleave" ) {
					event.type = handleObj.preType;
					related = jQuery( event.relatedTarget ).closest( handleObj.selector )[0];

					// Make sure not to accidentally match a child element with the same selector
					if ( related && jQuery.contains( elem, related ) ) {
						related = elem;
					}
				}

				if ( !related || related !== elem ) {
					elems.push({ elem: elem, handleObj: handleObj, level: close.level });
				}
			}
		}
	}

	for ( i = 0, l = elems.length; i < l; i++ ) {
		match = elems[i];

		if ( maxLevel && match.level > maxLevel ) {
			break;
		}

		event.currentTarget = match.elem;
		event.data = match.handleObj.data;
		event.handleObj = match.handleObj;

		ret = match.handleObj.origHandler.apply( match.elem, arguments );

		if ( ret === false || event.isPropagationStopped() ) {
			maxLevel = match.level;

			if ( ret === false ) {
				stop = false;
			}
			if ( event.isImmediatePropagationStopped() ) {
				break;
			}
		}
	}

	return stop;
}

function liveConvert( type, selector ) {
	return (type && type !== "*" ? type + "." : "") + selector.replace(rperiod, "`").replace(rspaces, "&");
}

jQuery.each( ("blur focus focusin focusout load resize scroll unload click dblclick " +
	"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
	"change select submit keydown keypress keyup error").split(" "), function( i, name ) {

	// Handle event binding
	jQuery.fn[ name ] = function( data, fn ) {
		if ( fn == null ) {
			fn = data;
			data = null;
		}

		return arguments.length > 0 ?
			this.bind( name, data, fn ) :
			this.trigger( name );
	};

	if ( jQuery.attrFn ) {
		jQuery.attrFn[ name ] = true;
	}
});



/*!
 * Sizzle CSS Selector Engine
 *  Copyright 2011, The Dojo Foundation
 *  Released under the MIT, BSD, and GPL Licenses.
 *  More information: http://sizzlejs.com/
 */
(function(){

var chunker = /((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^\[\]]*\]|['"][^'"]*['"]|[^\[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g,
	done = 0,
	toString = Object.prototype.toString,
	hasDuplicate = false,
	baseHasDuplicate = true,
	rBackslash = /\\/g,
	rNonWord = /\W/;

// Here we check if the JavaScript engine is using some sort of
// optimization where it does not always call our comparision
// function. If that is the case, discard the hasDuplicate value.
//   Thus far that includes Google Chrome.
[0, 0].sort(function() {
	baseHasDuplicate = false;
	return 0;
});

var Sizzle = function( selector, context, results, seed ) {
	results = results || [];
	context = context || document;

	var origContext = context;

	if ( context.nodeType !== 1 && context.nodeType !== 9 ) {
		return [];
	}
	
	if ( !selector || typeof selector !== "string" ) {
		return results;
	}

	var m, set, checkSet, extra, ret, cur, pop, i,
		prune = true,
		contextXML = Sizzle.isXML( context ),
		parts = [],
		soFar = selector;
	
	// Reset the position of the chunker regexp (start from head)
	do {
		chunker.exec( "" );
		m = chunker.exec( soFar );

		if ( m ) {
			soFar = m[3];
		
			parts.push( m[1] );
		
			if ( m[2] ) {
				extra = m[3];
				break;
			}
		}
	} while ( m );

	if ( parts.length > 1 && origPOS.exec( selector ) ) {

		if ( parts.length === 2 && Expr.relative[ parts[0] ] ) {
			set = posProcess( parts[0] + parts[1], context );

		} else {
			set = Expr.relative[ parts[0] ] ?
				[ context ] :
				Sizzle( parts.shift(), context );

			while ( parts.length ) {
				selector = parts.shift();

				if ( Expr.relative[ selector ] ) {
					selector += parts.shift();
				}
				
				set = posProcess( selector, set );
			}
		}

	} else {
		// Take a shortcut and set the context if the root selector is an ID
		// (but not if it'll be faster if the inner selector is an ID)
		if ( !seed && parts.length > 1 && context.nodeType === 9 && !contextXML &&
				Expr.match.ID.test(parts[0]) && !Expr.match.ID.test(parts[parts.length - 1]) ) {

			ret = Sizzle.find( parts.shift(), context, contextXML );
			context = ret.expr ?
				Sizzle.filter( ret.expr, ret.set )[0] :
				ret.set[0];
		}

		if ( context ) {
			ret = seed ?
				{ expr: parts.pop(), set: makeArray(seed) } :
				Sizzle.find( parts.pop(), parts.length === 1 && (parts[0] === "~" || parts[0] === "+") && context.parentNode ? context.parentNode : context, contextXML );

			set = ret.expr ?
				Sizzle.filter( ret.expr, ret.set ) :
				ret.set;

			if ( parts.length > 0 ) {
				checkSet = makeArray( set );

			} else {
				prune = false;
			}

			while ( parts.length ) {
				cur = parts.pop();
				pop = cur;

				if ( !Expr.relative[ cur ] ) {
					cur = "";
				} else {
					pop = parts.pop();
				}

				if ( pop == null ) {
					pop = context;
				}

				Expr.relative[ cur ]( checkSet, pop, contextXML );
			}

		} else {
			checkSet = parts = [];
		}
	}

	if ( !checkSet ) {
		checkSet = set;
	}

	if ( !checkSet ) {
		Sizzle.error( cur || selector );
	}

	if ( toString.call(checkSet) === "[object Array]" ) {
		if ( !prune ) {
			results.push.apply( results, checkSet );

		} else if ( context && context.nodeType === 1 ) {
			for ( i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && (checkSet[i] === true || checkSet[i].nodeType === 1 && Sizzle.contains(context, checkSet[i])) ) {
					results.push( set[i] );
				}
			}

		} else {
			for ( i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && checkSet[i].nodeType === 1 ) {
					results.push( set[i] );
				}
			}
		}

	} else {
		makeArray( checkSet, results );
	}

	if ( extra ) {
		Sizzle( extra, origContext, results, seed );
		Sizzle.uniqueSort( results );
	}

	return results;
};

Sizzle.uniqueSort = function( results ) {
	if ( sortOrder ) {
		hasDuplicate = baseHasDuplicate;
		results.sort( sortOrder );

		if ( hasDuplicate ) {
			for ( var i = 1; i < results.length; i++ ) {
				if ( results[i] === results[ i - 1 ] ) {
					results.splice( i--, 1 );
				}
			}
		}
	}

	return results;
};

Sizzle.matches = function( expr, set ) {
	return Sizzle( expr, null, null, set );
};

Sizzle.matchesSelector = function( node, expr ) {
	return Sizzle( expr, null, null, [node] ).length > 0;
};

Sizzle.find = function( expr, context, isXML ) {
	var set;

	if ( !expr ) {
		return [];
	}

	for ( var i = 0, l = Expr.order.length; i < l; i++ ) {
		var match,
			type = Expr.order[i];
		
		if ( (match = Expr.leftMatch[ type ].exec( expr )) ) {
			var left = match[1];
			match.splice( 1, 1 );

			if ( left.substr( left.length - 1 ) !== "\\" ) {
				match[1] = (match[1] || "").replace( rBackslash, "" );
				set = Expr.find[ type ]( match, context, isXML );

				if ( set != null ) {
					expr = expr.replace( Expr.match[ type ], "" );
					break;
				}
			}
		}
	}

	if ( !set ) {
		set = typeof context.getElementsByTagName !== "undefined" ?
			context.getElementsByTagName( "*" ) :
			[];
	}

	return { set: set, expr: expr };
};

Sizzle.filter = function( expr, set, inplace, not ) {
	var match, anyFound,
		old = expr,
		result = [],
		curLoop = set,
		isXMLFilter = set && set[0] && Sizzle.isXML( set[0] );

	while ( expr && set.length ) {
		for ( var type in Expr.filter ) {
			if ( (match = Expr.leftMatch[ type ].exec( expr )) != null && match[2] ) {
				var found, item,
					filter = Expr.filter[ type ],
					left = match[1];

				anyFound = false;

				match.splice(1,1);

				if ( left.substr( left.length - 1 ) === "\\" ) {
					continue;
				}

				if ( curLoop === result ) {
					result = [];
				}

				if ( Expr.preFilter[ type ] ) {
					match = Expr.preFilter[ type ]( match, curLoop, inplace, result, not, isXMLFilter );

					if ( !match ) {
						anyFound = found = true;

					} else if ( match === true ) {
						continue;
					}
				}

				if ( match ) {
					for ( var i = 0; (item = curLoop[i]) != null; i++ ) {
						if ( item ) {
							found = filter( item, match, i, curLoop );
							var pass = not ^ !!found;

							if ( inplace && found != null ) {
								if ( pass ) {
									anyFound = true;

								} else {
									curLoop[i] = false;
								}

							} else if ( pass ) {
								result.push( item );
								anyFound = true;
							}
						}
					}
				}

				if ( found !== undefined ) {
					if ( !inplace ) {
						curLoop = result;
					}

					expr = expr.replace( Expr.match[ type ], "" );

					if ( !anyFound ) {
						return [];
					}

					break;
				}
			}
		}

		// Improper expression
		if ( expr === old ) {
			if ( anyFound == null ) {
				Sizzle.error( expr );

			} else {
				break;
			}
		}

		old = expr;
	}

	return curLoop;
};

Sizzle.error = function( msg ) {
	throw "Syntax error, unrecognized expression: " + msg;
};

var Expr = Sizzle.selectors = {
	order: [ "ID", "NAME", "TAG" ],

	match: {
		ID: /#((?:[\w\u00c0-\uFFFF\-]|\\.)+)/,
		CLASS: /\.((?:[\w\u00c0-\uFFFF\-]|\\.)+)/,
		NAME: /\[name=['"]*((?:[\w\u00c0-\uFFFF\-]|\\.)+)['"]*\]/,
		ATTR: /\[\s*((?:[\w\u00c0-\uFFFF\-]|\\.)+)\s*(?:(\S?=)\s*(?:(['"])(.*?)\3|(#?(?:[\w\u00c0-\uFFFF\-]|\\.)*)|)|)\s*\]/,
		TAG: /^((?:[\w\u00c0-\uFFFF\*\-]|\\.)+)/,
		CHILD: /:(only|nth|last|first)-child(?:\(\s*(even|odd|(?:[+\-]?\d+|(?:[+\-]?\d*)?n\s*(?:[+\-]\s*\d+)?))\s*\))?/,
		POS: /:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^\-]|$)/,
		PSEUDO: /:((?:[\w\u00c0-\uFFFF\-]|\\.)+)(?:\((['"]?)((?:\([^\)]+\)|[^\(\)]*)+)\2\))?/
	},

	leftMatch: {},

	attrMap: {
		"class": "className",
		"for": "htmlFor"
	},

	attrHandle: {
		href: function( elem ) {
			return elem.getAttribute( "href" );
		},
		type: function( elem ) {
			return elem.getAttribute( "type" );
		}
	},

	relative: {
		"+": function(checkSet, part){
			var isPartStr = typeof part === "string",
				isTag = isPartStr && !rNonWord.test( part ),
				isPartStrNotTag = isPartStr && !isTag;

			if ( isTag ) {
				part = part.toLowerCase();
			}

			for ( var i = 0, l = checkSet.length, elem; i < l; i++ ) {
				if ( (elem = checkSet[i]) ) {
					while ( (elem = elem.previousSibling) && elem.nodeType !== 1 ) {}

					checkSet[i] = isPartStrNotTag || elem && elem.nodeName.toLowerCase() === part ?
						elem || false :
						elem === part;
				}
			}

			if ( isPartStrNotTag ) {
				Sizzle.filter( part, checkSet, true );
			}
		},

		">": function( checkSet, part ) {
			var elem,
				isPartStr = typeof part === "string",
				i = 0,
				l = checkSet.length;

			if ( isPartStr && !rNonWord.test( part ) ) {
				part = part.toLowerCase();

				for ( ; i < l; i++ ) {
					elem = checkSet[i];

					if ( elem ) {
						var parent = elem.parentNode;
						checkSet[i] = parent.nodeName.toLowerCase() === part ? parent : false;
					}
				}

			} else {
				for ( ; i < l; i++ ) {
					elem = checkSet[i];

					if ( elem ) {
						checkSet[i] = isPartStr ?
							elem.parentNode :
							elem.parentNode === part;
					}
				}

				if ( isPartStr ) {
					Sizzle.filter( part, checkSet, true );
				}
			}
		},

		"": function(checkSet, part, isXML){
			var nodeCheck,
				doneName = done++,
				checkFn = dirCheck;

			if ( typeof part === "string" && !rNonWord.test( part ) ) {
				part = part.toLowerCase();
				nodeCheck = part;
				checkFn = dirNodeCheck;
			}

			checkFn( "parentNode", part, doneName, checkSet, nodeCheck, isXML );
		},

		"~": function( checkSet, part, isXML ) {
			var nodeCheck,
				doneName = done++,
				checkFn = dirCheck;

			if ( typeof part === "string" && !rNonWord.test( part ) ) {
				part = part.toLowerCase();
				nodeCheck = part;
				checkFn = dirNodeCheck;
			}

			checkFn( "previousSibling", part, doneName, checkSet, nodeCheck, isXML );
		}
	},

	find: {
		ID: function( match, context, isXML ) {
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				// Check parentNode to catch when Blackberry 4.6 returns
				// nodes that are no longer in the document #6963
				return m && m.parentNode ? [m] : [];
			}
		},

		NAME: function( match, context ) {
			if ( typeof context.getElementsByName !== "undefined" ) {
				var ret = [],
					results = context.getElementsByName( match[1] );

				for ( var i = 0, l = results.length; i < l; i++ ) {
					if ( results[i].getAttribute("name") === match[1] ) {
						ret.push( results[i] );
					}
				}

				return ret.length === 0 ? null : ret;
			}
		},

		TAG: function( match, context ) {
			if ( typeof context.getElementsByTagName !== "undefined" ) {
				return context.getElementsByTagName( match[1] );
			}
		}
	},
	preFilter: {
		CLASS: function( match, curLoop, inplace, result, not, isXML ) {
			match = " " + match[1].replace( rBackslash, "" ) + " ";

			if ( isXML ) {
				return match;
			}

			for ( var i = 0, elem; (elem = curLoop[i]) != null; i++ ) {
				if ( elem ) {
					if ( not ^ (elem.className && (" " + elem.className + " ").replace(/[\t\n\r]/g, " ").indexOf(match) >= 0) ) {
						if ( !inplace ) {
							result.push( elem );
						}

					} else if ( inplace ) {
						curLoop[i] = false;
					}
				}
			}

			return false;
		},

		ID: function( match ) {
			return match[1].replace( rBackslash, "" );
		},

		TAG: function( match, curLoop ) {
			return match[1].replace( rBackslash, "" ).toLowerCase();
		},

		CHILD: function( match ) {
			if ( match[1] === "nth" ) {
				if ( !match[2] ) {
					Sizzle.error( match[0] );
				}

				match[2] = match[2].replace(/^\+|\s*/g, '');

				// parse equations like 'even', 'odd', '5', '2n', '3n+2', '4n-1', '-n+6'
				var test = /(-?)(\d*)(?:n([+\-]?\d*))?/.exec(
					match[2] === "even" && "2n" || match[2] === "odd" && "2n+1" ||
					!/\D/.test( match[2] ) && "0n+" + match[2] || match[2]);

				// calculate the numbers (first)n+(last) including if they are negative
				match[2] = (test[1] + (test[2] || 1)) - 0;
				match[3] = test[3] - 0;
			}
			else if ( match[2] ) {
				Sizzle.error( match[0] );
			}

			// TODO: Move to normal caching system
			match[0] = done++;

			return match;
		},

		ATTR: function( match, curLoop, inplace, result, not, isXML ) {
			var name = match[1] = match[1].replace( rBackslash, "" );
			
			if ( !isXML && Expr.attrMap[name] ) {
				match[1] = Expr.attrMap[name];
			}

			// Handle if an un-quoted value was used
			match[4] = ( match[4] || match[5] || "" ).replace( rBackslash, "" );

			if ( match[2] === "~=" ) {
				match[4] = " " + match[4] + " ";
			}

			return match;
		},

		PSEUDO: function( match, curLoop, inplace, result, not ) {
			if ( match[1] === "not" ) {
				// If we're dealing with a complex expression, or a simple one
				if ( ( chunker.exec(match[3]) || "" ).length > 1 || /^\w/.test(match[3]) ) {
					match[3] = Sizzle(match[3], null, null, curLoop);

				} else {
					var ret = Sizzle.filter(match[3], curLoop, inplace, true ^ not);

					if ( !inplace ) {
						result.push.apply( result, ret );
					}

					return false;
				}

			} else if ( Expr.match.POS.test( match[0] ) || Expr.match.CHILD.test( match[0] ) ) {
				return true;
			}
			
			return match;
		},

		POS: function( match ) {
			match.unshift( true );

			return match;
		}
	},
	
	filters: {
		enabled: function( elem ) {
			return elem.disabled === false && elem.type !== "hidden";
		},

		disabled: function( elem ) {
			return elem.disabled === true;
		},

		checked: function( elem ) {
			return elem.checked === true;
		},
		
		selected: function( elem ) {
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}
			
			return elem.selected === true;
		},

		parent: function( elem ) {
			return !!elem.firstChild;
		},

		empty: function( elem ) {
			return !elem.firstChild;
		},

		has: function( elem, i, match ) {
			return !!Sizzle( match[3], elem ).length;
		},

		header: function( elem ) {
			return (/h\d/i).test( elem.nodeName );
		},

		text: function( elem ) {
			var attr = elem.getAttribute( "type" ), type = elem.type;
			// IE6 and 7 will map elem.type to 'text' for new HTML5 types (search, etc) 
			// use getAttribute instead to test this case
			return elem.nodeName.toLowerCase() === "input" && "text" === type && ( attr === type || attr === null );
		},

		radio: function( elem ) {
			return elem.nodeName.toLowerCase() === "input" && "radio" === elem.type;
		},

		checkbox: function( elem ) {
			return elem.nodeName.toLowerCase() === "input" && "checkbox" === elem.type;
		},

		file: function( elem ) {
			return elem.nodeName.toLowerCase() === "input" && "file" === elem.type;
		},

		password: function( elem ) {
			return elem.nodeName.toLowerCase() === "input" && "password" === elem.type;
		},

		submit: function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return (name === "input" || name === "button") && "submit" === elem.type;
		},

		image: function( elem ) {
			return elem.nodeName.toLowerCase() === "input" && "image" === elem.type;
		},

		reset: function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return (name === "input" || name === "button") && "reset" === elem.type;
		},

		button: function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && "button" === elem.type || name === "button";
		},

		input: function( elem ) {
			return (/input|select|textarea|button/i).test( elem.nodeName );
		},

		focus: function( elem ) {
			return elem === elem.ownerDocument.activeElement;
		}
	},
	setFilters: {
		first: function( elem, i ) {
			return i === 0;
		},

		last: function( elem, i, match, array ) {
			return i === array.length - 1;
		},

		even: function( elem, i ) {
			return i % 2 === 0;
		},

		odd: function( elem, i ) {
			return i % 2 === 1;
		},

		lt: function( elem, i, match ) {
			return i < match[3] - 0;
		},

		gt: function( elem, i, match ) {
			return i > match[3] - 0;
		},

		nth: function( elem, i, match ) {
			return match[3] - 0 === i;
		},

		eq: function( elem, i, match ) {
			return match[3] - 0 === i;
		}
	},
	filter: {
		PSEUDO: function( elem, match, i, array ) {
			var name = match[1],
				filter = Expr.filters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );

			} else if ( name === "contains" ) {
				return (elem.textContent || elem.innerText || Sizzle.getText([ elem ]) || "").indexOf(match[3]) >= 0;

			} else if ( name === "not" ) {
				var not = match[3];

				for ( var j = 0, l = not.length; j < l; j++ ) {
					if ( not[j] === elem ) {
						return false;
					}
				}

				return true;

			} else {
				Sizzle.error( name );
			}
		},

		CHILD: function( elem, match ) {
			var type = match[1],
				node = elem;

			switch ( type ) {
				case "only":
				case "first":
					while ( (node = node.previousSibling) )	 {
						if ( node.nodeType === 1 ) { 
							return false; 
						}
					}

					if ( type === "first" ) { 
						return true; 
					}

					node = elem;

				case "last":
					while ( (node = node.nextSibling) )	 {
						if ( node.nodeType === 1 ) { 
							return false; 
						}
					}

					return true;

				case "nth":
					var first = match[2],
						last = match[3];

					if ( first === 1 && last === 0 ) {
						return true;
					}
					
					var doneName = match[0],
						parent = elem.parentNode;
	
					if ( parent && (parent.sizcache !== doneName || !elem.nodeIndex) ) {
						var count = 0;
						
						for ( node = parent.firstChild; node; node = node.nextSibling ) {
							if ( node.nodeType === 1 ) {
								node.nodeIndex = ++count;
							}
						} 

						parent.sizcache = doneName;
					}
					
					var diff = elem.nodeIndex - last;

					if ( first === 0 ) {
						return diff === 0;

					} else {
						return ( diff % first === 0 && diff / first >= 0 );
					}
			}
		},

		ID: function( elem, match ) {
			return elem.nodeType === 1 && elem.getAttribute("id") === match;
		},

		TAG: function( elem, match ) {
			return (match === "*" && elem.nodeType === 1) || elem.nodeName.toLowerCase() === match;
		},
		
		CLASS: function( elem, match ) {
			return (" " + (elem.className || elem.getAttribute("class")) + " ")
				.indexOf( match ) > -1;
		},

		ATTR: function( elem, match ) {
			var name = match[1],
				result = Expr.attrHandle[ name ] ?
					Expr.attrHandle[ name ]( elem ) :
					elem[ name ] != null ?
						elem[ name ] :
						elem.getAttribute( name ),
				value = result + "",
				type = match[2],
				check = match[4];

			return result == null ?
				type === "!=" :
				type === "=" ?
				value === check :
				type === "*=" ?
				value.indexOf(check) >= 0 :
				type === "~=" ?
				(" " + value + " ").indexOf(check) >= 0 :
				!check ?
				value && result !== false :
				type === "!=" ?
				value !== check :
				type === "^=" ?
				value.indexOf(check) === 0 :
				type === "$=" ?
				value.substr(value.length - check.length) === check :
				type === "|=" ?
				value === check || value.substr(0, check.length + 1) === check + "-" :
				false;
		},

		POS: function( elem, match, i, array ) {
			var name = match[2],
				filter = Expr.setFilters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			}
		}
	}
};

var origPOS = Expr.match.POS,
	fescape = function(all, num){
		return "\\" + (num - 0 + 1);
	};

for ( var type in Expr.match ) {
	Expr.match[ type ] = new RegExp( Expr.match[ type ].source + (/(?![^\[]*\])(?![^\(]*\))/.source) );
	Expr.leftMatch[ type ] = new RegExp( /(^(?:.|\r|\n)*?)/.source + Expr.match[ type ].source.replace(/\\(\d+)/g, fescape) );
}

var makeArray = function( array, results ) {
	array = Array.prototype.slice.call( array, 0 );

	if ( results ) {
		results.push.apply( results, array );
		return results;
	}
	
	return array;
};

// Perform a simple check to determine if the browser is capable of
// converting a NodeList to an array using builtin methods.
// Also verifies that the returned array holds DOM nodes
// (which is not the case in the Blackberry browser)
try {
	Array.prototype.slice.call( document.documentElement.childNodes, 0 )[0].nodeType;

// Provide a fallback method if it does not work
} catch( e ) {
	makeArray = function( array, results ) {
		var i = 0,
			ret = results || [];

		if ( toString.call(array) === "[object Array]" ) {
			Array.prototype.push.apply( ret, array );

		} else {
			if ( typeof array.length === "number" ) {
				for ( var l = array.length; i < l; i++ ) {
					ret.push( array[i] );
				}

			} else {
				for ( ; array[i]; i++ ) {
					ret.push( array[i] );
				}
			}
		}

		return ret;
	};
}

var sortOrder, siblingCheck;

if ( document.documentElement.compareDocumentPosition ) {
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		if ( !a.compareDocumentPosition || !b.compareDocumentPosition ) {
			return a.compareDocumentPosition ? -1 : 1;
		}

		return a.compareDocumentPosition(b) & 4 ? -1 : 1;
	};

} else {
	sortOrder = function( a, b ) {
		// The nodes are identical, we can exit early
		if ( a === b ) {
			hasDuplicate = true;
			return 0;

		// Fallback to using sourceIndex (in IE) if it's available on both nodes
		} else if ( a.sourceIndex && b.sourceIndex ) {
			return a.sourceIndex - b.sourceIndex;
		}

		var al, bl,
			ap = [],
			bp = [],
			aup = a.parentNode,
			bup = b.parentNode,
			cur = aup;

		// If the nodes are siblings (or identical) we can do a quick check
		if ( aup === bup ) {
			return siblingCheck( a, b );

		// If no parents were found then the nodes are disconnected
		} else if ( !aup ) {
			return -1;

		} else if ( !bup ) {
			return 1;
		}

		// Otherwise they're somewhere else in the tree so we need
		// to build up a full list of the parentNodes for comparison
		while ( cur ) {
			ap.unshift( cur );
			cur = cur.parentNode;
		}

		cur = bup;

		while ( cur ) {
			bp.unshift( cur );
			cur = cur.parentNode;
		}

		al = ap.length;
		bl = bp.length;

		// Start walking down the tree looking for a discrepancy
		for ( var i = 0; i < al && i < bl; i++ ) {
			if ( ap[i] !== bp[i] ) {
				return siblingCheck( ap[i], bp[i] );
			}
		}

		// We ended someplace up the tree so do a sibling check
		return i === al ?
			siblingCheck( a, bp[i], -1 ) :
			siblingCheck( ap[i], b, 1 );
	};

	siblingCheck = function( a, b, ret ) {
		if ( a === b ) {
			return ret;
		}

		var cur = a.nextSibling;

		while ( cur ) {
			if ( cur === b ) {
				return -1;
			}

			cur = cur.nextSibling;
		}

		return 1;
	};
}

// Utility function for retreiving the text value of an array of DOM nodes
Sizzle.getText = function( elems ) {
	var ret = "", elem;

	for ( var i = 0; elems[i]; i++ ) {
		elem = elems[i];

		// Get the text from text nodes and CDATA nodes
		if ( elem.nodeType === 3 || elem.nodeType === 4 ) {
			ret += elem.nodeValue;

		// Traverse everything else, except comment nodes
		} else if ( elem.nodeType !== 8 ) {
			ret += Sizzle.getText( elem.childNodes );
		}
	}

	return ret;
};

// Check to see if the browser returns elements by name when
// querying by getElementById (and provide a workaround)
(function(){
	// We're going to inject a fake input element with a specified name
	var form = document.createElement("div"),
		id = "script" + (new Date()).getTime(),
		root = document.documentElement;

	form.innerHTML = "<a name='" + id + "'/>";

	// Inject it into the root element, check its status, and remove it quickly
	root.insertBefore( form, root.firstChild );

	// The workaround has to do additional checks after a getElementById
	// Which slows things down for other browsers (hence the branching)
	if ( document.getElementById( id ) ) {
		Expr.find.ID = function( match, context, isXML ) {
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);

				return m ?
					m.id === match[1] || typeof m.getAttributeNode !== "undefined" && m.getAttributeNode("id").nodeValue === match[1] ?
						[m] :
						undefined :
					[];
			}
		};

		Expr.filter.ID = function( elem, match ) {
			var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");

			return elem.nodeType === 1 && node && node.nodeValue === match;
		};
	}

	root.removeChild( form );

	// release memory in IE
	root = form = null;
})();

(function(){
	// Check to see if the browser returns only elements
	// when doing getElementsByTagName("*")

	// Create a fake element
	var div = document.createElement("div");
	div.appendChild( document.createComment("") );

	// Make sure no comments are found
	if ( div.getElementsByTagName("*").length > 0 ) {
		Expr.find.TAG = function( match, context ) {
			var results = context.getElementsByTagName( match[1] );

			// Filter out possible comments
			if ( match[1] === "*" ) {
				var tmp = [];

				for ( var i = 0; results[i]; i++ ) {
					if ( results[i].nodeType === 1 ) {
						tmp.push( results[i] );
					}
				}

				results = tmp;
			}

			return results;
		};
	}

	// Check to see if an attribute returns normalized href attributes
	div.innerHTML = "<a href='#'></a>";

	if ( div.firstChild && typeof div.firstChild.getAttribute !== "undefined" &&
			div.firstChild.getAttribute("href") !== "#" ) {

		Expr.attrHandle.href = function( elem ) {
			return elem.getAttribute( "href", 2 );
		};
	}

	// release memory in IE
	div = null;
})();

if ( document.querySelectorAll ) {
	(function(){
		var oldSizzle = Sizzle,
			div = document.createElement("div"),
			id = "__sizzle__";

		div.innerHTML = "<p class='TEST'></p>";

		// Safari can't handle uppercase or unicode characters when
		// in quirks mode.
		if ( div.querySelectorAll && div.querySelectorAll(".TEST").length === 0 ) {
			return;
		}
	
		Sizzle = function( query, context, extra, seed ) {
			context = context || document;

			// Only use querySelectorAll on non-XML documents
			// (ID selectors don't work in non-HTML documents)
			if ( !seed && !Sizzle.isXML(context) ) {
				// See if we find a selector to speed up
				var match = /^(\w+$)|^\.([\w\-]+$)|^#([\w\-]+$)/.exec( query );
				
				if ( match && (context.nodeType === 1 || context.nodeType === 9) ) {
					// Speed-up: Sizzle("TAG")
					if ( match[1] ) {
						return makeArray( context.getElementsByTagName( query ), extra );
					
					// Speed-up: Sizzle(".CLASS")
					} else if ( match[2] && Expr.find.CLASS && context.getElementsByClassName ) {
						return makeArray( context.getElementsByClassName( match[2] ), extra );
					}
				}
				
				if ( context.nodeType === 9 ) {
					// Speed-up: Sizzle("body")
					// The body element only exists once, optimize finding it
					if ( query === "body" && context.body ) {
						return makeArray( [ context.body ], extra );
						
					// Speed-up: Sizzle("#ID")
					} else if ( match && match[3] ) {
						var elem = context.getElementById( match[3] );

						// Check parentNode to catch when Blackberry 4.6 returns
						// nodes that are no longer in the document #6963
						if ( elem && elem.parentNode ) {
							// Handle the case where IE and Opera return items
							// by name instead of ID
							if ( elem.id === match[3] ) {
								return makeArray( [ elem ], extra );
							}
							
						} else {
							return makeArray( [], extra );
						}
					}
					
					try {
						return makeArray( context.querySelectorAll(query), extra );
					} catch(qsaError) {}

				// qSA works strangely on Element-rooted queries
				// We can work around this by specifying an extra ID on the root
				// and working up from there (Thanks to Andrew Dupont for the technique)
				// IE 8 doesn't work on object elements
				} else if ( context.nodeType === 1 && context.nodeName.toLowerCase() !== "object" ) {
					var oldContext = context,
						old = context.getAttribute( "id" ),
						nid = old || id,
						hasParent = context.parentNode,
						relativeHierarchySelector = /^\s*[+~]/.test( query );

					if ( !old ) {
						context.setAttribute( "id", nid );
					} else {
						nid = nid.replace( /'/g, "\\$&" );
					}
					if ( relativeHierarchySelector && hasParent ) {
						context = context.parentNode;
					}

					try {
						if ( !relativeHierarchySelector || hasParent ) {
							return makeArray( context.querySelectorAll( "[id='" + nid + "'] " + query ), extra );
						}

					} catch(pseudoError) {
					} finally {
						if ( !old ) {
							oldContext.removeAttribute( "id" );
						}
					}
				}
			}
		
			return oldSizzle(query, context, extra, seed);
		};

		for ( var prop in oldSizzle ) {
			Sizzle[ prop ] = oldSizzle[ prop ];
		}

		// release memory in IE
		div = null;
	})();
}

(function(){
	var html = document.documentElement,
		matches = html.matchesSelector || html.mozMatchesSelector || html.webkitMatchesSelector || html.msMatchesSelector;

	if ( matches ) {
		// Check to see if it's possible to do matchesSelector
		// on a disconnected node (IE 9 fails this)
		var disconnectedMatch = !matches.call( document.createElement( "div" ), "div" ),
			pseudoWorks = false;

		try {
			// This should fail with an exception
			// Gecko does not error, returns false instead
			matches.call( document.documentElement, "[test!='']:sizzle" );
	
		} catch( pseudoError ) {
			pseudoWorks = true;
		}

		Sizzle.matchesSelector = function( node, expr ) {
			// Make sure that attribute selectors are quoted
			expr = expr.replace(/\=\s*([^'"\]]*)\s*\]/g, "='$1']");

			if ( !Sizzle.isXML( node ) ) {
				try { 
					if ( pseudoWorks || !Expr.match.PSEUDO.test( expr ) && !/!=/.test( expr ) ) {
						var ret = matches.call( node, expr );

						// IE 9's matchesSelector returns false on disconnected nodes
						if ( ret || !disconnectedMatch ||
								// As well, disconnected nodes are said to be in a document
								// fragment in IE 9, so check for that
								node.document && node.document.nodeType !== 11 ) {
							return ret;
						}
					}
				} catch(e) {}
			}

			return Sizzle(expr, null, null, [node]).length > 0;
		};
	}
})();

(function(){
	var div = document.createElement("div");

	div.innerHTML = "<div class='test e'></div><div class='test'></div>";

	// Opera can't find a second classname (in 9.6)
	// Also, make sure that getElementsByClassName actually exists
	if ( !div.getElementsByClassName || div.getElementsByClassName("e").length === 0 ) {
		return;
	}

	// Safari caches class attributes, doesn't catch changes (in 3.2)
	div.lastChild.className = "e";

	if ( div.getElementsByClassName("e").length === 1 ) {
		return;
	}
	
	Expr.order.splice(1, 0, "CLASS");
	Expr.find.CLASS = function( match, context, isXML ) {
		if ( typeof context.getElementsByClassName !== "undefined" && !isXML ) {
			return context.getElementsByClassName(match[1]);
		}
	};

	// release memory in IE
	div = null;
})();

function dirNodeCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];

		if ( elem ) {
			var match = false;

			elem = elem[dir];

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 && !isXML ){
					elem.sizcache = doneName;
					elem.sizset = i;
				}

				if ( elem.nodeName.toLowerCase() === cur ) {
					match = elem;
					break;
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

function dirCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];

		if ( elem ) {
			var match = false;
			
			elem = elem[dir];

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 ) {
					if ( !isXML ) {
						elem.sizcache = doneName;
						elem.sizset = i;
					}

					if ( typeof cur !== "string" ) {
						if ( elem === cur ) {
							match = true;
							break;
						}

					} else if ( Sizzle.filter( cur, [elem] ).length > 0 ) {
						match = elem;
						break;
					}
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

if ( document.documentElement.contains ) {
	Sizzle.contains = function( a, b ) {
		return a !== b && (a.contains ? a.contains(b) : true);
	};

} else if ( document.documentElement.compareDocumentPosition ) {
	Sizzle.contains = function( a, b ) {
		return !!(a.compareDocumentPosition(b) & 16);
	};

} else {
	Sizzle.contains = function() {
		return false;
	};
}

Sizzle.isXML = function( elem ) {
	// documentElement is verified for cases where it doesn't yet exist
	// (such as loading iframes in IE - #4833) 
	var documentElement = (elem ? elem.ownerDocument || elem : 0).documentElement;

	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

var posProcess = function( selector, context ) {
	var match,
		tmpSet = [],
		later = "",
		root = context.nodeType ? [context] : context;

	// Position selectors must be done after the filter
	// And so must :not(positional) so we move all PSEUDOs to the end
	while ( (match = Expr.match.PSEUDO.exec( selector )) ) {
		later += match[0];
		selector = selector.replace( Expr.match.PSEUDO, "" );
	}

	selector = Expr.relative[selector] ? selector + "*" : selector;

	for ( var i = 0, l = root.length; i < l; i++ ) {
		Sizzle( selector, root[i], tmpSet );
	}

	return Sizzle.filter( later, tmpSet );
};

// EXPOSE
jQuery.find = Sizzle;
jQuery.expr = Sizzle.selectors;
jQuery.expr[":"] = jQuery.expr.filters;
jQuery.unique = Sizzle.uniqueSort;
jQuery.text = Sizzle.getText;
jQuery.isXMLDoc = Sizzle.isXML;
jQuery.contains = Sizzle.contains;


})();


var runtil = /Until$/,
	rparentsprev = /^(?:parents|prevUntil|prevAll)/,
	// Note: This RegExp should be improved, or likely pulled from Sizzle
	rmultiselector = /,/,
	isSimple = /^.[^:#\[\.,]*$/,
	slice = Array.prototype.slice,
	POS = jQuery.expr.match.POS,
	// methods guaranteed to produce a unique set when starting from a unique set
	guaranteedUnique = {
		children: true,
		contents: true,
		next: true,
		prev: true
	};

jQuery.fn.extend({
	find: function( selector ) {
		var self = this,
			i, l;

		if ( typeof selector !== "string" ) {
			return jQuery( selector ).filter(function() {
				for ( i = 0, l = self.length; i < l; i++ ) {
					if ( jQuery.contains( self[ i ], this ) ) {
						return true;
					}
				}
			});
		}

		var ret = this.pushStack( "", "find", selector ),
			length, n, r;

		for ( i = 0, l = this.length; i < l; i++ ) {
			length = ret.length;
			jQuery.find( selector, this[i], ret );

			if ( i > 0 ) {
				// Make sure that the results are unique
				for ( n = length; n < ret.length; n++ ) {
					for ( r = 0; r < length; r++ ) {
						if ( ret[r] === ret[n] ) {
							ret.splice(n--, 1);
							break;
						}
					}
				}
			}
		}

		return ret;
	},

	has: function( target ) {
		var targets = jQuery( target );
		return this.filter(function() {
			for ( var i = 0, l = targets.length; i < l; i++ ) {
				if ( jQuery.contains( this, targets[i] ) ) {
					return true;
				}
			}
		});
	},

	not: function( selector ) {
		return this.pushStack( winnow(this, selector, false), "not", selector);
	},

	filter: function( selector ) {
		return this.pushStack( winnow(this, selector, true), "filter", selector );
	},

	is: function( selector ) {
		return !!selector && ( typeof selector === "string" ?
			jQuery.filter( selector, this ).length > 0 :
			this.filter( selector ).length > 0 );
	},

	closest: function( selectors, context ) {
		var ret = [], i, l, cur = this[0];
		
		// Array
		if ( jQuery.isArray( selectors ) ) {
			var match, selector,
				matches = {},
				level = 1;

			if ( cur && selectors.length ) {
				for ( i = 0, l = selectors.length; i < l; i++ ) {
					selector = selectors[i];

					if ( !matches[ selector ] ) {
						matches[ selector ] = POS.test( selector ) ?
							jQuery( selector, context || this.context ) :
							selector;
					}
				}

				while ( cur && cur.ownerDocument && cur !== context ) {
					for ( selector in matches ) {
						match = matches[ selector ];

						if ( match.jquery ? match.index( cur ) > -1 : jQuery( cur ).is( match ) ) {
							ret.push({ selector: selector, elem: cur, level: level });
						}
					}

					cur = cur.parentNode;
					level++;
				}
			}

			return ret;
		}

		// String
		var pos = POS.test( selectors ) || typeof selectors !== "string" ?
				jQuery( selectors, context || this.context ) :
				0;

		for ( i = 0, l = this.length; i < l; i++ ) {
			cur = this[i];

			while ( cur ) {
				if ( pos ? pos.index(cur) > -1 : jQuery.find.matchesSelector(cur, selectors) ) {
					ret.push( cur );
					break;

				} else {
					cur = cur.parentNode;
					if ( !cur || !cur.ownerDocument || cur === context || cur.nodeType === 11 ) {
						break;
					}
				}
			}
		}

		ret = ret.length > 1 ? jQuery.unique( ret ) : ret;

		return this.pushStack( ret, "closest", selectors );
	},

	// Determine the position of an element within
	// the matched set of elements
	index: function( elem ) {
		if ( !elem || typeof elem === "string" ) {
			return jQuery.inArray( this[0],
				// If it receives a string, the selector is used
				// If it receives nothing, the siblings are used
				elem ? jQuery( elem ) : this.parent().children() );
		}
		// Locate the position of the desired element
		return jQuery.inArray(
			// If it receives a jQuery object, the first element is used
			elem.jquery ? elem[0] : elem, this );
	},

	add: function( selector, context ) {
		var set = typeof selector === "string" ?
				jQuery( selector, context ) :
				jQuery.makeArray( selector && selector.nodeType ? [ selector ] : selector ),
			all = jQuery.merge( this.get(), set );

		return this.pushStack( isDisconnected( set[0] ) || isDisconnected( all[0] ) ?
			all :
			jQuery.unique( all ) );
	},

	andSelf: function() {
		return this.add( this.prevObject );
	}
});

// A painfully simple check to see if an element is disconnected
// from a document (should be improved, where feasible).
function isDisconnected( node ) {
	return !node || !node.parentNode || node.parentNode.nodeType === 11;
}

jQuery.each({
	parent: function( elem ) {
		var parent = elem.parentNode;
		return parent && parent.nodeType !== 11 ? parent : null;
	},
	parents: function( elem ) {
		return jQuery.dir( elem, "parentNode" );
	},
	parentsUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "parentNode", until );
	},
	next: function( elem ) {
		return jQuery.nth( elem, 2, "nextSibling" );
	},
	prev: function( elem ) {
		return jQuery.nth( elem, 2, "previousSibling" );
	},
	nextAll: function( elem ) {
		return jQuery.dir( elem, "nextSibling" );
	},
	prevAll: function( elem ) {
		return jQuery.dir( elem, "previousSibling" );
	},
	nextUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "nextSibling", until );
	},
	prevUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "previousSibling", until );
	},
	siblings: function( elem ) {
		return jQuery.sibling( elem.parentNode.firstChild, elem );
	},
	children: function( elem ) {
		return jQuery.sibling( elem.firstChild );
	},
	contents: function( elem ) {
		return jQuery.nodeName( elem, "iframe" ) ?
			elem.contentDocument || elem.contentWindow.document :
			jQuery.makeArray( elem.childNodes );
	}
}, function( name, fn ) {
	jQuery.fn[ name ] = function( until, selector ) {
		var ret = jQuery.map( this, fn, until ),
			// The variable 'args' was introduced in
			// https://github.com/jquery/jquery/commit/52a0238
			// to work around a bug in Chrome 10 (Dev) and should be removed when the bug is fixed.
			// http://code.google.com/p/v8/issues/detail?id=1050
			args = slice.call(arguments);

		if ( !runtil.test( name ) ) {
			selector = until;
		}

		if ( selector && typeof selector === "string" ) {
			ret = jQuery.filter( selector, ret );
		}

		ret = this.length > 1 && !guaranteedUnique[ name ] ? jQuery.unique( ret ) : ret;

		if ( (this.length > 1 || rmultiselector.test( selector )) && rparentsprev.test( name ) ) {
			ret = ret.reverse();
		}

		return this.pushStack( ret, name, args.join(",") );
	};
});

jQuery.extend({
	filter: function( expr, elems, not ) {
		if ( not ) {
			expr = ":not(" + expr + ")";
		}

		return elems.length === 1 ?
			jQuery.find.matchesSelector(elems[0], expr) ? [ elems[0] ] : [] :
			jQuery.find.matches(expr, elems);
	},

	dir: function( elem, dir, until ) {
		var matched = [],
			cur = elem[ dir ];

		while ( cur && cur.nodeType !== 9 && (until === undefined || cur.nodeType !== 1 || !jQuery( cur ).is( until )) ) {
			if ( cur.nodeType === 1 ) {
				matched.push( cur );
			}
			cur = cur[dir];
		}
		return matched;
	},

	nth: function( cur, result, dir, elem ) {
		result = result || 1;
		var num = 0;

		for ( ; cur; cur = cur[dir] ) {
			if ( cur.nodeType === 1 && ++num === result ) {
				break;
			}
		}

		return cur;
	},

	sibling: function( n, elem ) {
		var r = [];

		for ( ; n; n = n.nextSibling ) {
			if ( n.nodeType === 1 && n !== elem ) {
				r.push( n );
			}
		}

		return r;
	}
});

// Implement the identical functionality for filter and not
function winnow( elements, qualifier, keep ) {

	// Can't pass null or undefined to indexOf in Firefox 4
	// Set to 0 to skip string check
	qualifier = qualifier || 0;

	if ( jQuery.isFunction( qualifier ) ) {
		return jQuery.grep(elements, function( elem, i ) {
			var retVal = !!qualifier.call( elem, i, elem );
			return retVal === keep;
		});

	} else if ( qualifier.nodeType ) {
		return jQuery.grep(elements, function( elem, i ) {
			return (elem === qualifier) === keep;
		});

	} else if ( typeof qualifier === "string" ) {
		var filtered = jQuery.grep(elements, function( elem ) {
			return elem.nodeType === 1;
		});

		if ( isSimple.test( qualifier ) ) {
			return jQuery.filter(qualifier, filtered, !keep);
		} else {
			qualifier = jQuery.filter( qualifier, filtered );
		}
	}

	return jQuery.grep(elements, function( elem, i ) {
		return (jQuery.inArray( elem, qualifier ) >= 0) === keep;
	});
}




var rinlinejQuery = / jQuery\d+="(?:\d+|null)"/g,
	rleadingWhitespace = /^\s+/,
	rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
	rtagName = /<([\w:]+)/,
	rtbody = /<tbody/i,
	rhtml = /<|&#?\w+;/,
	rnocache = /<(?:script|object|embed|option|style)/i,
	// checked="checked" or checked
	rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
	rscriptType = /\/(java|ecma)script/i,
	rcleanScript = /^\s*<!(?:\[CDATA\[|\-\-)/,
	wrapMap = {
		option: [ 1, "<select multiple='multiple'>", "</select>" ],
		legend: [ 1, "<fieldset>", "</fieldset>" ],
		thead: [ 1, "<table>", "</table>" ],
		tr: [ 2, "<table><tbody>", "</tbody></table>" ],
		td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],
		col: [ 2, "<table><tbody></tbody><colgroup>", "</colgroup></table>" ],
		area: [ 1, "<map>", "</map>" ],
		_default: [ 0, "", "" ]
	};

wrapMap.optgroup = wrapMap.option;
wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
wrapMap.th = wrapMap.td;

// IE can't serialize <link> and <script> tags normally
if ( !jQuery.support.htmlSerialize ) {
	wrapMap._default = [ 1, "div<div>", "</div>" ];
}

jQuery.fn.extend({
	text: function( text ) {
		if ( jQuery.isFunction(text) ) {
			return this.each(function(i) {
				var self = jQuery( this );

				self.text( text.call(this, i, self.text()) );
			});
		}

		if ( typeof text !== "object" && text !== undefined ) {
			return this.empty().append( (this[0] && this[0].ownerDocument || document).createTextNode( text ) );
		}

		return jQuery.text( this );
	},

	wrapAll: function( html ) {
		if ( jQuery.isFunction( html ) ) {
			return this.each(function(i) {
				jQuery(this).wrapAll( html.call(this, i) );
			});
		}

		if ( this[0] ) {
			// The elements to wrap the target around
			var wrap = jQuery( html, this[0].ownerDocument ).eq(0).clone(true);

			if ( this[0].parentNode ) {
				wrap.insertBefore( this[0] );
			}

			wrap.map(function() {
				var elem = this;

				while ( elem.firstChild && elem.firstChild.nodeType === 1 ) {
					elem = elem.firstChild;
				}

				return elem;
			}).append( this );
		}

		return this;
	},

	wrapInner: function( html ) {
		if ( jQuery.isFunction( html ) ) {
			return this.each(function(i) {
				jQuery(this).wrapInner( html.call(this, i) );
			});
		}

		return this.each(function() {
			var self = jQuery( this ),
				contents = self.contents();

			if ( contents.length ) {
				contents.wrapAll( html );

			} else {
				self.append( html );
			}
		});
	},

	wrap: function( html ) {
		return this.each(function() {
			jQuery( this ).wrapAll( html );
		});
	},

	unwrap: function() {
		return this.parent().each(function() {
			if ( !jQuery.nodeName( this, "body" ) ) {
				jQuery( this ).replaceWith( this.childNodes );
			}
		}).end();
	},

	append: function() {
		return this.domManip(arguments, true, function( elem ) {
			if ( this.nodeType === 1 ) {
				this.appendChild( elem );
			}
		});
	},

	prepend: function() {
		return this.domManip(arguments, true, function( elem ) {
			if ( this.nodeType === 1 ) {
				this.insertBefore( elem, this.firstChild );
			}
		});
	},

	before: function() {
		if ( this[0] && this[0].parentNode ) {
			return this.domManip(arguments, false, function( elem ) {
				this.parentNode.insertBefore( elem, this );
			});
		} else if ( arguments.length ) {
			var set = jQuery(arguments[0]);
			set.push.apply( set, this.toArray() );
			return this.pushStack( set, "before", arguments );
		}
	},

	after: function() {
		if ( this[0] && this[0].parentNode ) {
			return this.domManip(arguments, false, function( elem ) {
				this.parentNode.insertBefore( elem, this.nextSibling );
			});
		} else if ( arguments.length ) {
			var set = this.pushStack( this, "after", arguments );
			set.push.apply( set, jQuery(arguments[0]).toArray() );
			return set;
		}
	},

	// keepData is for internal use only--do not document
	remove: function( selector, keepData ) {
		for ( var i = 0, elem; (elem = this[i]) != null; i++ ) {
			if ( !selector || jQuery.filter( selector, [ elem ] ).length ) {
				if ( !keepData && elem.nodeType === 1 ) {
					jQuery.cleanData( elem.getElementsByTagName("*") );
					jQuery.cleanData( [ elem ] );
				}

				if ( elem.parentNode ) {
					elem.parentNode.removeChild( elem );
				}
			}
		}

		return this;
	},

	empty: function() {
		for ( var i = 0, elem; (elem = this[i]) != null; i++ ) {
			// Remove element nodes and prevent memory leaks
			if ( elem.nodeType === 1 ) {
				jQuery.cleanData( elem.getElementsByTagName("*") );
			}

			// Remove any remaining nodes
			while ( elem.firstChild ) {
				elem.removeChild( elem.firstChild );
			}
		}

		return this;
	},

	clone: function( dataAndEvents, deepDataAndEvents ) {
		dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
		deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

		return this.map( function () {
			return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
		});
	},

	html: function( value ) {
		if ( value === undefined ) {
			return this[0] && this[0].nodeType === 1 ?
				this[0].innerHTML.replace(rinlinejQuery, "") :
				null;

		// See if we can take a shortcut and just use innerHTML
		} else if ( typeof value === "string" && !rnocache.test( value ) &&
			(jQuery.support.leadingWhitespace || !rleadingWhitespace.test( value )) &&
			!wrapMap[ (rtagName.exec( value ) || ["", ""])[1].toLowerCase() ] ) {

			value = value.replace(rxhtmlTag, "<$1></$2>");

			try {
				for ( var i = 0, l = this.length; i < l; i++ ) {
					// Remove element nodes and prevent memory leaks
					if ( this[i].nodeType === 1 ) {
						jQuery.cleanData( this[i].getElementsByTagName("*") );
						this[i].innerHTML = value;
					}
				}

			// If using innerHTML throws an exception, use the fallback method
			} catch(e) {
				this.empty().append( value );
			}

		} else if ( jQuery.isFunction( value ) ) {
			this.each(function(i){
				var self = jQuery( this );

				self.html( value.call(this, i, self.html()) );
			});

		} else {
			this.empty().append( value );
		}

		return this;
	},

	replaceWith: function( value ) {
		if ( this[0] && this[0].parentNode ) {
			// Make sure that the elements are removed from the DOM before they are inserted
			// this can help fix replacing a parent with child elements
			if ( jQuery.isFunction( value ) ) {
				return this.each(function(i) {
					var self = jQuery(this), old = self.html();
					self.replaceWith( value.call( this, i, old ) );
				});
			}

			if ( typeof value !== "string" ) {
				value = jQuery( value ).detach();
			}

			return this.each(function() {
				var next = this.nextSibling,
					parent = this.parentNode;

				jQuery( this ).remove();

				if ( next ) {
					jQuery(next).before( value );
				} else {
					jQuery(parent).append( value );
				}
			});
		} else {
			return this.length ?
				this.pushStack( jQuery(jQuery.isFunction(value) ? value() : value), "replaceWith", value ) :
				this;
		}
	},

	detach: function( selector ) {
		return this.remove( selector, true );
	},

	domManip: function( args, table, callback ) {
		var results, first, fragment, parent,
			value = args[0],
			scripts = [];

		// We can't cloneNode fragments that contain checked, in WebKit
		if ( !jQuery.support.checkClone && arguments.length === 3 && typeof value === "string" && rchecked.test( value ) ) {
			return this.each(function() {
				jQuery(this).domManip( args, table, callback, true );
			});
		}

		if ( jQuery.isFunction(value) ) {
			return this.each(function(i) {
				var self = jQuery(this);
				args[0] = value.call(this, i, table ? self.html() : undefined);
				self.domManip( args, table, callback );
			});
		}

		if ( this[0] ) {
			parent = value && value.parentNode;

			// If we're in a fragment, just use that instead of building a new one
			if ( jQuery.support.parentNode && parent && parent.nodeType === 11 && parent.childNodes.length === this.length ) {
				results = { fragment: parent };

			} else {
				results = jQuery.buildFragment( args, this, scripts );
			}

			fragment = results.fragment;

			if ( fragment.childNodes.length === 1 ) {
				first = fragment = fragment.firstChild;
			} else {
				first = fragment.firstChild;
			}

			if ( first ) {
				table = table && jQuery.nodeName( first, "tr" );

				for ( var i = 0, l = this.length, lastIndex = l - 1; i < l; i++ ) {
					callback.call(
						table ?
							root(this[i], first) :
							this[i],
						// Make sure that we do not leak memory by inadvertently discarding
						// the original fragment (which might have attached data) instead of
						// using it; in addition, use the original fragment object for the last
						// item instead of first because it can end up being emptied incorrectly
						// in certain situations (Bug #8070).
						// Fragments from the fragment cache must always be cloned and never used
						// in place.
						results.cacheable || (l > 1 && i < lastIndex) ?
							jQuery.clone( fragment, true, true ) :
							fragment
					);
				}
			}

			if ( scripts.length ) {
				jQuery.each( scripts, evalScript );
			}
		}

		return this;
	}
});

function root( elem, cur ) {
	return jQuery.nodeName(elem, "table") ?
		(elem.getElementsByTagName("tbody")[0] ||
		elem.appendChild(elem.ownerDocument.createElement("tbody"))) :
		elem;
}

function cloneCopyEvent( src, dest ) {

	if ( dest.nodeType !== 1 || !jQuery.hasData( src ) ) {
		return;
	}

	var internalKey = jQuery.expando,
		oldData = jQuery.data( src ),
		curData = jQuery.data( dest, oldData );

	// Switch to use the internal data object, if it exists, for the next
	// stage of data copying
	if ( (oldData = oldData[ internalKey ]) ) {
		var events = oldData.events;
				curData = curData[ internalKey ] = jQuery.extend({}, oldData);

		if ( events ) {
			delete curData.handle;
			curData.events = {};

			for ( var type in events ) {
				for ( var i = 0, l = events[ type ].length; i < l; i++ ) {
					jQuery.event.add( dest, type + ( events[ type ][ i ].namespace ? "." : "" ) + events[ type ][ i ].namespace, events[ type ][ i ], events[ type ][ i ].data );
				}
			}
		}
	}
}

function cloneFixAttributes( src, dest ) {
	var nodeName;

	// We do not need to do anything for non-Elements
	if ( dest.nodeType !== 1 ) {
		return;
	}

	// clearAttributes removes the attributes, which we don't want,
	// but also removes the attachEvent events, which we *do* want
	if ( dest.clearAttributes ) {
		dest.clearAttributes();
	}

	// mergeAttributes, in contrast, only merges back on the
	// original attributes, not the events
	if ( dest.mergeAttributes ) {
		dest.mergeAttributes( src );
	}

	nodeName = dest.nodeName.toLowerCase();

	// IE6-8 fail to clone children inside object elements that use
	// the proprietary classid attribute value (rather than the type
	// attribute) to identify the type of content to display
	if ( nodeName === "object" ) {
		dest.outerHTML = src.outerHTML;

	} else if ( nodeName === "input" && (src.type === "checkbox" || src.type === "radio") ) {
		// IE6-8 fails to persist the checked state of a cloned checkbox
		// or radio button. Worse, IE6-7 fail to give the cloned element
		// a checked appearance if the defaultChecked value isn't also set
		if ( src.checked ) {
			dest.defaultChecked = dest.checked = src.checked;
		}

		// IE6-7 get confused and end up setting the value of a cloned
		// checkbox/radio button to an empty string instead of "on"
		if ( dest.value !== src.value ) {
			dest.value = src.value;
		}

	// IE6-8 fails to return the selected option to the default selected
	// state when cloning options
	} else if ( nodeName === "option" ) {
		dest.selected = src.defaultSelected;

	// IE6-8 fails to set the defaultValue to the correct value when
	// cloning other types of input fields
	} else if ( nodeName === "input" || nodeName === "textarea" ) {
		dest.defaultValue = src.defaultValue;
	}

	// Event data gets referenced instead of copied if the expando
	// gets copied too
	dest.removeAttribute( jQuery.expando );
}

jQuery.buildFragment = function( args, nodes, scripts ) {
	var fragment, cacheable, cacheresults, doc;

  // nodes may contain either an explicit document object,
  // a jQuery collection or context object.
  // If nodes[0] contains a valid object to assign to doc
  if ( nodes && nodes[0] ) {
    doc = nodes[0].ownerDocument || nodes[0];
  }

  // Ensure that an attr object doesn't incorrectly stand in as a document object
	// Chrome and Firefox seem to allow this to occur and will throw exception
	// Fixes #8950
	if ( !doc.createDocumentFragment ) {
		doc = document;
	}

	// Only cache "small" (1/2 KB) HTML strings that are associated with the main document
	// Cloning options loses the selected state, so don't cache them
	// IE 6 doesn't like it when you put <object> or <embed> elements in a fragment
	// Also, WebKit does not clone 'checked' attributes on cloneNode, so don't cache
	if ( args.length === 1 && typeof args[0] === "string" && args[0].length < 512 && doc === document &&
		args[0].charAt(0) === "<" && !rnocache.test( args[0] ) && (jQuery.support.checkClone || !rchecked.test( args[0] )) ) {

		cacheable = true;

		cacheresults = jQuery.fragments[ args[0] ];
		if ( cacheresults && cacheresults !== 1 ) {
			fragment = cacheresults;
		}
	}

	if ( !fragment ) {
		fragment = doc.createDocumentFragment();
		jQuery.clean( args, doc, fragment, scripts );
	}

	if ( cacheable ) {
		jQuery.fragments[ args[0] ] = cacheresults ? fragment : 1;
	}

	return { fragment: fragment, cacheable: cacheable };
};

jQuery.fragments = {};

jQuery.each({
	appendTo: "append",
	prependTo: "prepend",
	insertBefore: "before",
	insertAfter: "after",
	replaceAll: "replaceWith"
}, function( name, original ) {
	jQuery.fn[ name ] = function( selector ) {
		var ret = [],
			insert = jQuery( selector ),
			parent = this.length === 1 && this[0].parentNode;

		if ( parent && parent.nodeType === 11 && parent.childNodes.length === 1 && insert.length === 1 ) {
			insert[ original ]( this[0] );
			return this;

		} else {
			for ( var i = 0, l = insert.length; i < l; i++ ) {
				var elems = (i > 0 ? this.clone(true) : this).get();
				jQuery( insert[i] )[ original ]( elems );
				ret = ret.concat( elems );
			}

			return this.pushStack( ret, name, insert.selector );
		}
	};
});

function getAll( elem ) {
	if ( "getElementsByTagName" in elem ) {
		return elem.getElementsByTagName( "*" );

	} else if ( "querySelectorAll" in elem ) {
		return elem.querySelectorAll( "*" );

	} else {
		return [];
	}
}

// Used in clean, fixes the defaultChecked property
function fixDefaultChecked( elem ) {
	if ( elem.type === "checkbox" || elem.type === "radio" ) {
		elem.defaultChecked = elem.checked;
	}
}
// Finds all inputs and passes them to fixDefaultChecked
function findInputs( elem ) {
	if ( jQuery.nodeName( elem, "input" ) ) {
		fixDefaultChecked( elem );
	} else if ( "getElementsByTagName" in elem ) {
		jQuery.grep( elem.getElementsByTagName("input"), fixDefaultChecked );
	}
}

jQuery.extend({
	clone: function( elem, dataAndEvents, deepDataAndEvents ) {
		var clone = elem.cloneNode(true),
				srcElements,
				destElements,
				i;

		if ( (!jQuery.support.noCloneEvent || !jQuery.support.noCloneChecked) &&
				(elem.nodeType === 1 || elem.nodeType === 11) && !jQuery.isXMLDoc(elem) ) {
			// IE copies events bound via attachEvent when using cloneNode.
			// Calling detachEvent on the clone will also remove the events
			// from the original. In order to get around this, we use some
			// proprietary methods to clear the events. Thanks to MooTools
			// guys for this hotness.

			cloneFixAttributes( elem, clone );

			// Using Sizzle here is crazy slow, so we use getElementsByTagName
			// instead
			srcElements = getAll( elem );
			destElements = getAll( clone );

			// Weird iteration because IE will replace the length property
			// with an element if you are cloning the body and one of the
			// elements on the page has a name or id of "length"
			for ( i = 0; srcElements[i]; ++i ) {
				cloneFixAttributes( srcElements[i], destElements[i] );
			}
		}

		// Copy the events from the original to the clone
		if ( dataAndEvents ) {
			cloneCopyEvent( elem, clone );

			if ( deepDataAndEvents ) {
				srcElements = getAll( elem );
				destElements = getAll( clone );

				for ( i = 0; srcElements[i]; ++i ) {
					cloneCopyEvent( srcElements[i], destElements[i] );
				}
			}
		}

		srcElements = destElements = null;

		// Return the cloned set
		return clone;
	},

	clean: function( elems, context, fragment, scripts ) {
		var checkScriptType;

		context = context || document;

		// !context.createElement fails in IE with an error but returns typeof 'object'
		if ( typeof context.createElement === "undefined" ) {
			context = context.ownerDocument || context[0] && context[0].ownerDocument || document;
		}

		var ret = [], j;

		for ( var i = 0, elem; (elem = elems[i]) != null; i++ ) {
			if ( typeof elem === "number" ) {
				elem += "";
			}

			if ( !elem ) {
				continue;
			}

			// Convert html string into DOM nodes
			if ( typeof elem === "string" ) {
				if ( !rhtml.test( elem ) ) {
					elem = context.createTextNode( elem );
				} else {
					// Fix "XHTML"-style tags in all browsers
					elem = elem.replace(rxhtmlTag, "<$1></$2>");

					// Trim whitespace, otherwise indexOf won't work as expected
					var tag = (rtagName.exec( elem ) || ["", ""])[1].toLowerCase(),
						wrap = wrapMap[ tag ] || wrapMap._default,
						depth = wrap[0],
						div = context.createElement("div");

					// Go to html and back, then peel off extra wrappers
					div.innerHTML = wrap[1] + elem + wrap[2];

					// Move to the right depth
					while ( depth-- ) {
						div = div.lastChild;
					}

					// Remove IE's autoinserted <tbody> from table fragments
					if ( !jQuery.support.tbody ) {

						// String was a <table>, *may* have spurious <tbody>
						var hasBody = rtbody.test(elem),
							tbody = tag === "table" && !hasBody ?
								div.firstChild && div.firstChild.childNodes :

								// String was a bare <thead> or <tfoot>
								wrap[1] === "<table>" && !hasBody ?
									div.childNodes :
									[];

						for ( j = tbody.length - 1; j >= 0 ; --j ) {
							if ( jQuery.nodeName( tbody[ j ], "tbody" ) && !tbody[ j ].childNodes.length ) {
								tbody[ j ].parentNode.removeChild( tbody[ j ] );
							}
						}
					}

					// IE completely kills leading whitespace when innerHTML is used
					if ( !jQuery.support.leadingWhitespace && rleadingWhitespace.test( elem ) ) {
						div.insertBefore( context.createTextNode( rleadingWhitespace.exec(elem)[0] ), div.firstChild );
					}

					elem = div.childNodes;
				}
			}

			// Resets defaultChecked for any radios and checkboxes
			// about to be appended to the DOM in IE 6/7 (#8060)
			var len;
			if ( !jQuery.support.appendChecked ) {
				if ( elem[0] && typeof (len = elem.length) === "number" ) {
					for ( j = 0; j < len; j++ ) {
						findInputs( elem[j] );
					}
				} else {
					findInputs( elem );
				}
			}

			if ( elem.nodeType ) {
				ret.push( elem );
			} else {
				ret = jQuery.merge( ret, elem );
			}
		}

		if ( fragment ) {
			checkScriptType = function( elem ) {
				return !elem.type || rscriptType.test( elem.type );
			};
			for ( i = 0; ret[i]; i++ ) {
				if ( scripts && jQuery.nodeName( ret[i], "script" ) && (!ret[i].type || ret[i].type.toLowerCase() === "text/javascript") ) {
					scripts.push( ret[i].parentNode ? ret[i].parentNode.removeChild( ret[i] ) : ret[i] );

				} else {
					if ( ret[i].nodeType === 1 ) {
						var jsTags = jQuery.grep( ret[i].getElementsByTagName( "script" ), checkScriptType );

						ret.splice.apply( ret, [i + 1, 0].concat( jsTags ) );
					}
					fragment.appendChild( ret[i] );
				}
			}
		}

		return ret;
	},

	cleanData: function( elems ) {
		var data, id, cache = jQuery.cache, internalKey = jQuery.expando, special = jQuery.event.special,
			deleteExpando = jQuery.support.deleteExpando;

		for ( var i = 0, elem; (elem = elems[i]) != null; i++ ) {
			if ( elem.nodeName && jQuery.noData[elem.nodeName.toLowerCase()] ) {
				continue;
			}

			id = elem[ jQuery.expando ];

			if ( id ) {
				data = cache[ id ] && cache[ id ][ internalKey ];

				if ( data && data.events ) {
					for ( var type in data.events ) {
						if ( special[ type ] ) {
							jQuery.event.remove( elem, type );

						// This is a shortcut to avoid jQuery.event.remove's overhead
						} else {
							jQuery.removeEvent( elem, type, data.handle );
						}
					}

					// Null the DOM reference to avoid IE6/7/8 leak (#7054)
					if ( data.handle ) {
						data.handle.elem = null;
					}
				}

				if ( deleteExpando ) {
					delete elem[ jQuery.expando ];

				} else if ( elem.removeAttribute ) {
					elem.removeAttribute( jQuery.expando );
				}

				delete cache[ id ];
			}
		}
	}
});

function evalScript( i, elem ) {
	if ( elem.src ) {
		jQuery.ajax({
			url: elem.src,
			async: false,
			dataType: "script"
		});
	} else {
		jQuery.globalEval( ( elem.text || elem.textContent || elem.innerHTML || "" ).replace( rcleanScript, "/*$0*/" ) );
	}

	if ( elem.parentNode ) {
		elem.parentNode.removeChild( elem );
	}
}



var ralpha = /alpha\([^)]*\)/i,
	ropacity = /opacity=([^)]*)/,
	// fixed for IE9, see #8346
	rupper = /([A-Z]|^ms)/g,
	rnumpx = /^-?\d+(?:px)?$/i,
	rnum = /^-?\d/,
	rrelNum = /^[+\-]=/,
	rrelNumFilter = /[^+\-\.\de]+/g,

	cssShow = { position: "absolute", visibility: "hidden", display: "block" },
	cssWidth = [ "Left", "Right" ],
	cssHeight = [ "Top", "Bottom" ],
	curCSS,

	getComputedStyle,
	currentStyle;

jQuery.fn.css = function( name, value ) {
	// Setting 'undefined' is a no-op
	if ( arguments.length === 2 && value === undefined ) {
		return this;
	}

	return jQuery.access( this, name, value, true, function( elem, name, value ) {
		return value !== undefined ?
			jQuery.style( elem, name, value ) :
			jQuery.css( elem, name );
	});
};

jQuery.extend({
	// Add in style property hooks for overriding the default
	// behavior of getting and setting a style property
	cssHooks: {
		opacity: {
			get: function( elem, computed ) {
				if ( computed ) {
					// We should always get a number back from opacity
					var ret = curCSS( elem, "opacity", "opacity" );
					return ret === "" ? "1" : ret;

				} else {
					return elem.style.opacity;
				}
			}
		}
	},

	// Exclude the following css properties to add px
	cssNumber: {
		"fillOpacity": true,
		"fontWeight": true,
		"lineHeight": true,
		"opacity": true,
		"orphans": true,
		"widows": true,
		"zIndex": true,
		"zoom": true
	},

	// Add in properties whose names you wish to fix before
	// setting or getting the value
	cssProps: {
		// normalize float css property
		"float": jQuery.support.cssFloat ? "cssFloat" : "styleFloat"
	},

	// Get and set the style property on a DOM Node
	style: function( elem, name, value, extra ) {
		// Don't set styles on text and comment nodes
		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
			return;
		}

		// Make sure that we're working with the right name
		var ret, type, origName = jQuery.camelCase( name ),
			style = elem.style, hooks = jQuery.cssHooks[ origName ];

		name = jQuery.cssProps[ origName ] || origName;

		// Check if we're setting a value
		if ( value !== undefined ) {
			type = typeof value;

			// Make sure that NaN and null values aren't set. See: #7116
			if ( type === "number" && isNaN( value ) || value == null ) {
				return;
			}

			// convert relative number strings (+= or -=) to relative numbers. #7345
			if ( type === "string" && rrelNum.test( value ) ) {
				value = +value.replace( rrelNumFilter, "" ) + parseFloat( jQuery.css( elem, name ) );
				// Fixes bug #9237
				type = "number";
			}

			// If a number was passed in, add 'px' to the (except for certain CSS properties)
			if ( type === "number" && !jQuery.cssNumber[ origName ] ) {
				value += "px";
			}

			// If a hook was provided, use that value, otherwise just set the specified value
			if ( !hooks || !("set" in hooks) || (value = hooks.set( elem, value )) !== undefined ) {
				// Wrapped to prevent IE from throwing errors when 'invalid' values are provided
				// Fixes bug #5509
				try {
					style[ name ] = value;
				} catch(e) {}
			}

		} else {
			// If a hook was provided get the non-computed value from there
			if ( hooks && "get" in hooks && (ret = hooks.get( elem, false, extra )) !== undefined ) {
				return ret;
			}

			// Otherwise just get the value from the style object
			return style[ name ];
		}
	},

	css: function( elem, name, extra ) {
		var ret, hooks;

		// Make sure that we're working with the right name
		name = jQuery.camelCase( name );
		hooks = jQuery.cssHooks[ name ];
		name = jQuery.cssProps[ name ] || name;

		// cssFloat needs a special treatment
		if ( name === "cssFloat" ) {
			name = "float";
		}

		// If a hook was provided get the computed value from there
		if ( hooks && "get" in hooks && (ret = hooks.get( elem, true, extra )) !== undefined ) {
			return ret;

		// Otherwise, if a way to get the computed value exists, use that
		} else if ( curCSS ) {
			return curCSS( elem, name );
		}
	},

	// A method for quickly swapping in/out CSS properties to get correct calculations
	swap: function( elem, options, callback ) {
		var old = {};

		// Remember the old values, and insert the new ones
		for ( var name in options ) {
			old[ name ] = elem.style[ name ];
			elem.style[ name ] = options[ name ];
		}

		callback.call( elem );

		// Revert the old values
		for ( name in options ) {
			elem.style[ name ] = old[ name ];
		}
	}
});

// DEPRECATED, Use jQuery.css() instead
jQuery.curCSS = jQuery.css;

jQuery.each(["height", "width"], function( i, name ) {
	jQuery.cssHooks[ name ] = {
		get: function( elem, computed, extra ) {
			var val;

			if ( computed ) {
				if ( elem.offsetWidth !== 0 ) {
					return getWH( elem, name, extra );
				} else {
					jQuery.swap( elem, cssShow, function() {
						val = getWH( elem, name, extra );
					});
				}

				return val;
			}
		},

		set: function( elem, value ) {
			if ( rnumpx.test( value ) ) {
				// ignore negative width and height values #1599
				value = parseFloat( value );

				if ( value >= 0 ) {
					return value + "px";
				}

			} else {
				return value;
			}
		}
	};
});

if ( !jQuery.support.opacity ) {
	jQuery.cssHooks.opacity = {
		get: function( elem, computed ) {
			// IE uses filters for opacity
			return ropacity.test( (computed && elem.currentStyle ? elem.currentStyle.filter : elem.style.filter) || "" ) ?
				( parseFloat( RegExp.$1 ) / 100 ) + "" :
				computed ? "1" : "";
		},

		set: function( elem, value ) {
			var style = elem.style,
				currentStyle = elem.currentStyle;

			// IE has trouble with opacity if it does not have layout
			// Force it by setting the zoom level
			style.zoom = 1;

			// Set the alpha filter to set the opacity
			var opacity = jQuery.isNaN( value ) ?
				"" :
				"alpha(opacity=" + value * 100 + ")",
				filter = currentStyle && currentStyle.filter || style.filter || "";

			style.filter = ralpha.test( filter ) ?
				filter.replace( ralpha, opacity ) :
				filter + " " + opacity;
		}
	};
}

jQuery(function() {
	// This hook cannot be added until DOM ready because the support test
	// for it is not run until after DOM ready
	if ( !jQuery.support.reliableMarginRight ) {
		jQuery.cssHooks.marginRight = {
			get: function( elem, computed ) {
				// WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
				// Work around by temporarily setting element display to inline-block
				var ret;
				jQuery.swap( elem, { "display": "inline-block" }, function() {
					if ( computed ) {
						ret = curCSS( elem, "margin-right", "marginRight" );
					} else {
						ret = elem.style.marginRight;
					}
				});
				return ret;
			}
		};
	}
});

if ( document.defaultView && document.defaultView.getComputedStyle ) {
	getComputedStyle = function( elem, name ) {
		var ret, defaultView, computedStyle;

		name = name.replace( rupper, "-$1" ).toLowerCase();

		if ( !(defaultView = elem.ownerDocument.defaultView) ) {
			return undefined;
		}

		if ( (computedStyle = defaultView.getComputedStyle( elem, null )) ) {
			ret = computedStyle.getPropertyValue( name );
			if ( ret === "" && !jQuery.contains( elem.ownerDocument.documentElement, elem ) ) {
				ret = jQuery.style( elem, name );
			}
		}

		return ret;
	};
}

if ( document.documentElement.currentStyle ) {
	currentStyle = function( elem, name ) {
		var left,
			ret = elem.currentStyle && elem.currentStyle[ name ],
			rsLeft = elem.runtimeStyle && elem.runtimeStyle[ name ],
			style = elem.style;

		// From the awesome hack by Dean Edwards
		// http://erik.eae.net/archives/2007/07/27/18.54.15/#comment-102291

		// If we're not dealing with a regular pixel number
		// but a number that has a weird ending, we need to convert it to pixels
		if ( !rnumpx.test( ret ) && rnum.test( ret ) ) {
			// Remember the original values
			left = style.left;

			// Put in the new values to get a computed value out
			if ( rsLeft ) {
				elem.runtimeStyle.left = elem.currentStyle.left;
			}
			style.left = name === "fontSize" ? "1em" : (ret || 0);
			ret = style.pixelLeft + "px";

			// Revert the changed values
			style.left = left;
			if ( rsLeft ) {
				elem.runtimeStyle.left = rsLeft;
			}
		}

		return ret === "" ? "auto" : ret;
	};
}

curCSS = getComputedStyle || currentStyle;

function getWH( elem, name, extra ) {

	// Start with offset property
	var val = name === "width" ? elem.offsetWidth : elem.offsetHeight,
		which = name === "width" ? cssWidth : cssHeight;

	if ( val > 0 ) {
		if ( extra !== "border" ) {
			jQuery.each( which, function() {
				if ( !extra ) {
					val -= parseFloat( jQuery.css( elem, "padding" + this ) ) || 0;
				}
				if ( extra === "margin" ) {
					val += parseFloat( jQuery.css( elem, extra + this ) ) || 0;
				} else {
					val -= parseFloat( jQuery.css( elem, "border" + this + "Width" ) ) || 0;
				}
			});
		}

		return val + "px";
	}

	// Fall back to computed then uncomputed css if necessary
	val = curCSS( elem, name, name );
	if ( val < 0 || val == null ) {
		val = elem.style[ name ] || 0;
	}
	// Normalize "", auto, and prepare for extra
	val = parseFloat( val ) || 0;

	// Add padding, border, margin
	if ( extra ) {
		jQuery.each( which, function() {
			val += parseFloat( jQuery.css( elem, "padding" + this ) ) || 0;
			if ( extra !== "padding" ) {
				val += parseFloat( jQuery.css( elem, "border" + this + "Width" ) ) || 0;
			}
			if ( extra === "margin" ) {
				val += parseFloat( jQuery.css( elem, extra + this ) ) || 0;
			}
		});
	}

	return val + "px";
}

if ( jQuery.expr && jQuery.expr.filters ) {
	jQuery.expr.filters.hidden = function( elem ) {
		var width = elem.offsetWidth,
			height = elem.offsetHeight;

		return (width === 0 && height === 0) || (!jQuery.support.reliableHiddenOffsets && (elem.style.display || jQuery.css( elem, "display" )) === "none");
	};

	jQuery.expr.filters.visible = function( elem ) {
		return !jQuery.expr.filters.hidden( elem );
	};
}




var r20 = /%20/g,
	rbracket = /\[\]$/,
	rCRLF = /\r?\n/g,
	rhash = /#.*$/,
	rheaders = /^(.*?):[ \t]*([^\r\n]*)\r?$/mg, // IE leaves an \r character at EOL
	rinput = /^(?:color|date|datetime|email|hidden|month|number|password|range|search|tel|text|time|url|week)$/i,
	// #7653, #8125, #8152: local protocol detection
	rlocalProtocol = /^(?:about|app|app\-storage|.+\-extension|file|widget):$/,
	rnoContent = /^(?:GET|HEAD)$/,
	rprotocol = /^\/\//,
	rquery = /\?/,
	rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
	rselectTextarea = /^(?:select|textarea)/i,
	rspacesAjax = /\s+/,
	rts = /([?&])_=[^&]*/,
	rurl = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/,

	// Keep a copy of the old load method
	_load = jQuery.fn.load,

	/* Prefilters
	 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
	 * 2) These are called:
	 *    - BEFORE asking for a transport
	 *    - AFTER param serialization (s.data is a string if s.processData is true)
	 * 3) key is the dataType
	 * 4) the catchall symbol "*" can be used
	 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
	 */
	prefilters = {},

	/* Transports bindings
	 * 1) key is the dataType
	 * 2) the catchall symbol "*" can be used
	 * 3) selection will start with transport dataType and THEN go to "*" if needed
	 */
	transports = {},

	// Document location
	ajaxLocation,

	// Document location segments
	ajaxLocParts;

// #8138, IE may throw an exception when accessing
// a field from window.location if document.domain has been set
try {
	ajaxLocation = location.href;
} catch( e ) {
	// Use the href attribute of an A element
	// since IE will modify it given document.location
	ajaxLocation = document.createElement( "a" );
	ajaxLocation.href = "";
	ajaxLocation = ajaxLocation.href;
}

// Segment location into parts
ajaxLocParts = rurl.exec( ajaxLocation.toLowerCase() ) || [];

// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
function addToPrefiltersOrTransports( structure ) {

	// dataTypeExpression is optional and defaults to "*"
	return function( dataTypeExpression, func ) {

		if ( typeof dataTypeExpression !== "string" ) {
			func = dataTypeExpression;
			dataTypeExpression = "*";
		}

		if ( jQuery.isFunction( func ) ) {
			var dataTypes = dataTypeExpression.toLowerCase().split( rspacesAjax ),
				i = 0,
				length = dataTypes.length,
				dataType,
				list,
				placeBefore;

			// For each dataType in the dataTypeExpression
			for(; i < length; i++ ) {
				dataType = dataTypes[ i ];
				// We control if we're asked to add before
				// any existing element
				placeBefore = /^\+/.test( dataType );
				if ( placeBefore ) {
					dataType = dataType.substr( 1 ) || "*";
				}
				list = structure[ dataType ] = structure[ dataType ] || [];
				// then we add to the structure accordingly
				list[ placeBefore ? "unshift" : "push" ]( func );
			}
		}
	};
}

// Base inspection function for prefilters and transports
function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR,
		dataType /* internal */, inspected /* internal */ ) {

	dataType = dataType || options.dataTypes[ 0 ];
	inspected = inspected || {};

	inspected[ dataType ] = true;

	var list = structure[ dataType ],
		i = 0,
		length = list ? list.length : 0,
		executeOnly = ( structure === prefilters ),
		selection;

	for(; i < length && ( executeOnly || !selection ); i++ ) {
		selection = list[ i ]( options, originalOptions, jqXHR );
		// If we got redirected to another dataType
		// we try there if executing only and not done already
		if ( typeof selection === "string" ) {
			if ( !executeOnly || inspected[ selection ] ) {
				selection = undefined;
			} else {
				options.dataTypes.unshift( selection );
				selection = inspectPrefiltersOrTransports(
						structure, options, originalOptions, jqXHR, selection, inspected );
			}
		}
	}
	// If we're only executing or nothing was selected
	// we try the catchall dataType if not done already
	if ( ( executeOnly || !selection ) && !inspected[ "*" ] ) {
		selection = inspectPrefiltersOrTransports(
				structure, options, originalOptions, jqXHR, "*", inspected );
	}
	// unnecessary when only executing (prefilters)
	// but it'll be ignored by the caller in that case
	return selection;
}

jQuery.fn.extend({
	load: function( url, params, callback ) {
		if ( typeof url !== "string" && _load ) {
			return _load.apply( this, arguments );

		// Don't do a request if no elements are being requested
		} else if ( !this.length ) {
			return this;
		}

		var off = url.indexOf( " " );
		if ( off >= 0 ) {
			var selector = url.slice( off, url.length );
			url = url.slice( 0, off );
		}

		// Default to a GET request
		var type = "GET";

		// If the second parameter was provided
		if ( params ) {
			// If it's a function
			if ( jQuery.isFunction( params ) ) {
				// We assume that it's the callback
				callback = params;
				params = undefined;

			// Otherwise, build a param string
			} else if ( typeof params === "object" ) {
				params = jQuery.param( params, jQuery.ajaxSettings.traditional );
				type = "POST";
			}
		}

		var self = this;

		// Request the remote document
		jQuery.ajax({
			url: url,
			type: type,
			dataType: "html",
			data: params,
			// Complete callback (responseText is used internally)
			complete: function( jqXHR, status, responseText ) {
				// Store the response as specified by the jqXHR object
				responseText = jqXHR.responseText;
				// If successful, inject the HTML into all the matched elements
				if ( jqXHR.isResolved() ) {
					// #4825: Get the actual response in case
					// a dataFilter is present in ajaxSettings
					jqXHR.done(function( r ) {
						responseText = r;
					});
					// See if a selector was specified
					self.html( selector ?
						// Create a dummy div to hold the results
						jQuery("<div>")
							// inject the contents of the document in, removing the scripts
							// to avoid any 'Permission Denied' errors in IE
							.append(responseText.replace(rscript, ""))

							// Locate the specified elements
							.find(selector) :

						// If not, just inject the full result
						responseText );
				}

				if ( callback ) {
					self.each( callback, [ responseText, status, jqXHR ] );
				}
			}
		});

		return this;
	},

	serialize: function() {
		return jQuery.param( this.serializeArray() );
	},

	serializeArray: function() {
		return this.map(function(){
			return this.elements ? jQuery.makeArray( this.elements ) : this;
		})
		.filter(function(){
			return this.name && !this.disabled &&
				( this.checked || rselectTextarea.test( this.nodeName ) ||
					rinput.test( this.type ) );
		})
		.map(function( i, elem ){
			var val = jQuery( this ).val();

			return val == null ?
				null :
				jQuery.isArray( val ) ?
					jQuery.map( val, function( val, i ){
						return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
					}) :
					{ name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
		}).get();
	}
});

// Attach a bunch of functions for handling common AJAX events
jQuery.each( "ajaxStart ajaxStop ajaxComplete ajaxError ajaxSuccess ajaxSend".split( " " ), function( i, o ){
	jQuery.fn[ o ] = function( f ){
		return this.bind( o, f );
	};
});

jQuery.each( [ "get", "post" ], function( i, method ) {
	jQuery[ method ] = function( url, data, callback, type ) {
		// shift arguments if data argument was omitted
		if ( jQuery.isFunction( data ) ) {
			type = type || callback;
			callback = data;
			data = undefined;
		}

		return jQuery.ajax({
			type: method,
			url: url,
			data: data,
			success: callback,
			dataType: type
		});
	};
});

jQuery.extend({

	getScript: function( url, callback ) {
		return jQuery.get( url, undefined, callback, "script" );
	},

	getJSON: function( url, data, callback ) {
		return jQuery.get( url, data, callback, "json" );
	},

	// Creates a full fledged settings object into target
	// with both ajaxSettings and settings fields.
	// If target is omitted, writes into ajaxSettings.
	ajaxSetup: function ( target, settings ) {
		if ( !settings ) {
			// Only one parameter, we extend ajaxSettings
			settings = target;
			target = jQuery.extend( true, jQuery.ajaxSettings, settings );
		} else {
			// target was provided, we extend into it
			jQuery.extend( true, target, jQuery.ajaxSettings, settings );
		}
		// Flatten fields we don't want deep extended
		for( var field in { context: 1, url: 1 } ) {
			if ( field in settings ) {
				target[ field ] = settings[ field ];
			} else if( field in jQuery.ajaxSettings ) {
				target[ field ] = jQuery.ajaxSettings[ field ];
			}
		}
		return target;
	},

	ajaxSettings: {
		url: ajaxLocation,
		isLocal: rlocalProtocol.test( ajaxLocParts[ 1 ] ),
		global: true,
		type: "GET",
		contentType: "application/x-www-form-urlencoded",
		processData: true,
		async: true,
		/*
		timeout: 0,
		data: null,
		dataType: null,
		username: null,
		password: null,
		cache: null,
		traditional: false,
		headers: {},
		*/

		accepts: {
			xml: "application/xml, text/xml",
			html: "text/html",
			text: "text/plain",
			json: "application/json, text/javascript",
			"*": "*/*"
		},

		contents: {
			xml: /xml/,
			html: /html/,
			json: /json/
		},

		responseFields: {
			xml: "responseXML",
			text: "responseText"
		},

		// List of data converters
		// 1) key format is "source_type destination_type" (a single space in-between)
		// 2) the catchall symbol "*" can be used for source_type
		converters: {

			// Convert anything to text
			"* text": window.String,

			// Text to html (true = no transformation)
			"text html": true,

			// Evaluate text as a json expression
			"text json": jQuery.parseJSON,

			// Parse text as xml
			"text xml": jQuery.parseXML
		}
	},

	ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
	ajaxTransport: addToPrefiltersOrTransports( transports ),

	// Main method
	ajax: function( url, options ) {

		// If url is an object, simulate pre-1.5 signature
		if ( typeof url === "object" ) {
			options = url;
			url = undefined;
		}

		// Force options to be an object
		options = options || {};

		var // Create the final options object
			s = jQuery.ajaxSetup( {}, options ),
			// Callbacks context
			callbackContext = s.context || s,
			// Context for global events
			// It's the callbackContext if one was provided in the options
			// and if it's a DOM node or a jQuery collection
			globalEventContext = callbackContext !== s &&
				( callbackContext.nodeType || callbackContext instanceof jQuery ) ?
						jQuery( callbackContext ) : jQuery.event,
			// Deferreds
			deferred = jQuery.Deferred(),
			completeDeferred = jQuery._Deferred(),
			// Status-dependent callbacks
			statusCode = s.statusCode || {},
			// ifModified key
			ifModifiedKey,
			// Headers (they are sent all at once)
			requestHeaders = {},
			requestHeadersNames = {},
			// Response headers
			responseHeadersString,
			responseHeaders,
			// transport
			transport,
			// timeout handle
			timeoutTimer,
			// Cross-domain detection vars
			parts,
			// The jqXHR state
			state = 0,
			// To know if global events are to be dispatched
			fireGlobals,
			// Loop variable
			i,
			// Fake xhr
			jqXHR = {

				readyState: 0,

				// Caches the header
				setRequestHeader: function( name, value ) {
					if ( !state ) {
						var lname = name.toLowerCase();
						name = requestHeadersNames[ lname ] = requestHeadersNames[ lname ] || name;
						requestHeaders[ name ] = value;
					}
					return this;
				},

				// Raw string
				getAllResponseHeaders: function() {
					return state === 2 ? responseHeadersString : null;
				},

				// Builds headers hashtable if needed
				getResponseHeader: function( key ) {
					var match;
					if ( state === 2 ) {
						if ( !responseHeaders ) {
							responseHeaders = {};
							while( ( match = rheaders.exec( responseHeadersString ) ) ) {
								responseHeaders[ match[1].toLowerCase() ] = match[ 2 ];
							}
						}
						match = responseHeaders[ key.toLowerCase() ];
					}
					return match === undefined ? null : match;
				},

				// Overrides response content-type header
				overrideMimeType: function( type ) {
					if ( !state ) {
						s.mimeType = type;
					}
					return this;
				},

				// Cancel the request
				abort: function( statusText ) {
					statusText = statusText || "abort";
					if ( transport ) {
						transport.abort( statusText );
					}
					done( 0, statusText );
					return this;
				}
			};

		// Callback for when everything is done
		// It is defined here because jslint complains if it is declared
		// at the end of the function (which would be more logical and readable)
		function done( status, statusText, responses, headers ) {

			// Called once
			if ( state === 2 ) {
				return;
			}

			// State is "done" now
			state = 2;

			// Clear timeout if it exists
			if ( timeoutTimer ) {
				clearTimeout( timeoutTimer );
			}

			// Dereference transport for early garbage collection
			// (no matter how long the jqXHR object will be used)
			transport = undefined;

			// Cache response headers
			responseHeadersString = headers || "";

			// Set readyState
			jqXHR.readyState = status ? 4 : 0;

			var isSuccess,
				success,
				error,
				response = responses ? ajaxHandleResponses( s, jqXHR, responses ) : undefined,
				lastModified,
				etag;

			// If successful, handle type chaining
			if ( status >= 200 && status < 300 || status === 304 ) {

				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
				if ( s.ifModified ) {

					if ( ( lastModified = jqXHR.getResponseHeader( "Last-Modified" ) ) ) {
						jQuery.lastModified[ ifModifiedKey ] = lastModified;
					}
					if ( ( etag = jqXHR.getResponseHeader( "Etag" ) ) ) {
						jQuery.etag[ ifModifiedKey ] = etag;
					}
				}

				// If not modified
				if ( status === 304 ) {

					statusText = "notmodified";
					isSuccess = true;

				// If we have data
				} else {

					try {
						success = ajaxConvert( s, response );
						statusText = "success";
						isSuccess = true;
					} catch(e) {
						// We have a parsererror
						statusText = "parsererror";
						error = e;
					}
				}
			} else {
				// We extract error from statusText
				// then normalize statusText and status for non-aborts
				error = statusText;
				if( !statusText || status ) {
					statusText = "error";
					if ( status < 0 ) {
						status = 0;
					}
				}
			}

			// Set data for the fake xhr object
			jqXHR.status = status;
			jqXHR.statusText = statusText;

			// Success/Error
			if ( isSuccess ) {
				deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
			} else {
				deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
			}

			// Status-dependent callbacks
			jqXHR.statusCode( statusCode );
			statusCode = undefined;

			if ( fireGlobals ) {
				globalEventContext.trigger( "ajax" + ( isSuccess ? "Success" : "Error" ),
						[ jqXHR, s, isSuccess ? success : error ] );
			}

			// Complete
			completeDeferred.resolveWith( callbackContext, [ jqXHR, statusText ] );

			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxComplete", [ jqXHR, s] );
				// Handle the global AJAX counter
				if ( !( --jQuery.active ) ) {
					jQuery.event.trigger( "ajaxStop" );
				}
			}
		}

		// Attach deferreds
		deferred.promise( jqXHR );
		jqXHR.success = jqXHR.done;
		jqXHR.error = jqXHR.fail;
		jqXHR.complete = completeDeferred.done;

		// Status-dependent callbacks
		jqXHR.statusCode = function( map ) {
			if ( map ) {
				var tmp;
				if ( state < 2 ) {
					for( tmp in map ) {
						statusCode[ tmp ] = [ statusCode[tmp], map[tmp] ];
					}
				} else {
					tmp = map[ jqXHR.status ];
					jqXHR.then( tmp, tmp );
				}
			}
			return this;
		};

		// Remove hash character (#7531: and string promotion)
		// Add protocol if not provided (#5866: IE7 issue with protocol-less urls)
		// We also use the url parameter if available
		s.url = ( ( url || s.url ) + "" ).replace( rhash, "" ).replace( rprotocol, ajaxLocParts[ 1 ] + "//" );

		// Extract dataTypes list
		s.dataTypes = jQuery.trim( s.dataType || "*" ).toLowerCase().split( rspacesAjax );

		// Determine if a cross-domain request is in order
		if ( s.crossDomain == null ) {
			parts = rurl.exec( s.url.toLowerCase() );
			s.crossDomain = !!( parts &&
				( parts[ 1 ] != ajaxLocParts[ 1 ] || parts[ 2 ] != ajaxLocParts[ 2 ] ||
					( parts[ 3 ] || ( parts[ 1 ] === "http:" ? 80 : 443 ) ) !=
						( ajaxLocParts[ 3 ] || ( ajaxLocParts[ 1 ] === "http:" ? 80 : 443 ) ) )
			);
		}

		// Convert data if not already a string
		if ( s.data && s.processData && typeof s.data !== "string" ) {
			s.data = jQuery.param( s.data, s.traditional );
		}

		// Apply prefilters
		inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

		// If request was aborted inside a prefiler, stop there
		if ( state === 2 ) {
			return false;
		}

		// We can fire global events as of now if asked to
		fireGlobals = s.global;

		// Uppercase the type
		s.type = s.type.toUpperCase();

		// Determine if request has content
		s.hasContent = !rnoContent.test( s.type );

		// Watch for a new set of requests
		if ( fireGlobals && jQuery.active++ === 0 ) {
			jQuery.event.trigger( "ajaxStart" );
		}

		// More options handling for requests with no content
		if ( !s.hasContent ) {

			// If data is available, append data to url
			if ( s.data ) {
				s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.data;
			}

			// Get ifModifiedKey before adding the anti-cache parameter
			ifModifiedKey = s.url;

			// Add anti-cache in url if needed
			if ( s.cache === false ) {

				var ts = jQuery.now(),
					// try replacing _= if it is there
					ret = s.url.replace( rts, "$1_=" + ts );

				// if nothing was replaced, add timestamp to the end
				s.url = ret + ( (ret === s.url ) ? ( rquery.test( s.url ) ? "&" : "?" ) + "_=" + ts : "" );
			}
		}

		// Set the correct header, if data is being sent
		if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
			jqXHR.setRequestHeader( "Content-Type", s.contentType );
		}

		// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
		if ( s.ifModified ) {
			ifModifiedKey = ifModifiedKey || s.url;
			if ( jQuery.lastModified[ ifModifiedKey ] ) {
				jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ ifModifiedKey ] );
			}
			if ( jQuery.etag[ ifModifiedKey ] ) {
				jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ ifModifiedKey ] );
			}
		}

		// Set the Accepts header for the server, depending on the dataType
		jqXHR.setRequestHeader(
			"Accept",
			s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[0] ] ?
				s.accepts[ s.dataTypes[0] ] + ( s.dataTypes[ 0 ] !== "*" ? ", */*; q=0.01" : "" ) :
				s.accepts[ "*" ]
		);

		// Check for headers option
		for ( i in s.headers ) {
			jqXHR.setRequestHeader( i, s.headers[ i ] );
		}

		// Allow custom headers/mimetypes and early abort
		if ( s.beforeSend && ( s.beforeSend.call( callbackContext, jqXHR, s ) === false || state === 2 ) ) {
				// Abort if not done already
				jqXHR.abort();
				return false;

		}

		// Install callbacks on deferreds
		for ( i in { success: 1, error: 1, complete: 1 } ) {
			jqXHR[ i ]( s[ i ] );
		}

		// Get transport
		transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

		// If no transport, we auto-abort
		if ( !transport ) {
			done( -1, "No Transport" );
		} else {
			jqXHR.readyState = 1;
			// Send global event
			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
			}
			// Timeout
			if ( s.async && s.timeout > 0 ) {
				timeoutTimer = setTimeout( function(){
					jqXHR.abort( "timeout" );
				}, s.timeout );
			}

			try {
				state = 1;
				transport.send( requestHeaders, done );
			} catch (e) {
				// Propagate exception as error if not done
				if ( status < 2 ) {
					done( -1, e );
				// Simply rethrow otherwise
				} else {
					jQuery.error( e );
				}
			}
		}

		return jqXHR;
	},

	// Serialize an array of form elements or a set of
	// key/values into a query string
	param: function( a, traditional ) {
		var s = [],
			add = function( key, value ) {
				// If value is a function, invoke it and return its value
				value = jQuery.isFunction( value ) ? value() : value;
				s[ s.length ] = encodeURIComponent( key ) + "=" + encodeURIComponent( value );
			};

		// Set traditional to true for jQuery <= 1.3.2 behavior.
		if ( traditional === undefined ) {
			traditional = jQuery.ajaxSettings.traditional;
		}

		// If an array was passed in, assume that it is an array of form elements.
		if ( jQuery.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {
			// Serialize the form elements
			jQuery.each( a, function() {
				add( this.name, this.value );
			});

		} else {
			// If traditional, encode the "old" way (the way 1.3.2 or older
			// did it), otherwise encode params recursively.
			for ( var prefix in a ) {
				buildParams( prefix, a[ prefix ], traditional, add );
			}
		}

		// Return the resulting serialization
		return s.join( "&" ).replace( r20, "+" );
	}
});

function buildParams( prefix, obj, traditional, add ) {
	if ( jQuery.isArray( obj ) ) {
		// Serialize array item.
		jQuery.each( obj, function( i, v ) {
			if ( traditional || rbracket.test( prefix ) ) {
				// Treat each array item as a scalar.
				add( prefix, v );

			} else {
				// If array item is non-scalar (array or object), encode its
				// numeric index to resolve deserialization ambiguity issues.
				// Note that rack (as of 1.0.0) can't currently deserialize
				// nested arrays properly, and attempting to do so may cause
				// a server error. Possible fixes are to modify rack's
				// deserialization algorithm or to provide an option or flag
				// to force array serialization to be shallow.
				buildParams( prefix + "[" + ( typeof v === "object" || jQuery.isArray(v) ? i : "" ) + "]", v, traditional, add );
			}
		});

	} else if ( !traditional && obj != null && typeof obj === "object" ) {
		// Serialize object item.
		for ( var name in obj ) {
			buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
		}

	} else {
		// Serialize scalar item.
		add( prefix, obj );
	}
}

// This is still on the jQuery object... for now
// Want to move this to jQuery.ajax some day
jQuery.extend({

	// Counter for holding the number of active queries
	active: 0,

	// Last-Modified header cache for next request
	lastModified: {},
	etag: {}

});

/* Handles responses to an ajax request:
 * - sets all responseXXX fields accordingly
 * - finds the right dataType (mediates between content-type and expected dataType)
 * - returns the corresponding response
 */
function ajaxHandleResponses( s, jqXHR, responses ) {

	var contents = s.contents,
		dataTypes = s.dataTypes,
		responseFields = s.responseFields,
		ct,
		type,
		finalDataType,
		firstDataType;

	// Fill responseXXX fields
	for( type in responseFields ) {
		if ( type in responses ) {
			jqXHR[ responseFields[type] ] = responses[ type ];
		}
	}

	// Remove auto dataType and get content-type in the process
	while( dataTypes[ 0 ] === "*" ) {
		dataTypes.shift();
		if ( ct === undefined ) {
			ct = s.mimeType || jqXHR.getResponseHeader( "content-type" );
		}
	}

	// Check if we're dealing with a known content-type
	if ( ct ) {
		for ( type in contents ) {
			if ( contents[ type ] && contents[ type ].test( ct ) ) {
				dataTypes.unshift( type );
				break;
			}
		}
	}

	// Check to see if we have a response for the expected dataType
	if ( dataTypes[ 0 ] in responses ) {
		finalDataType = dataTypes[ 0 ];
	} else {
		// Try convertible dataTypes
		for ( type in responses ) {
			if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[0] ] ) {
				finalDataType = type;
				break;
			}
			if ( !firstDataType ) {
				firstDataType = type;
			}
		}
		// Or just use first one
		finalDataType = finalDataType || firstDataType;
	}

	// If we found a dataType
	// We add the dataType to the list if needed
	// and return the corresponding response
	if ( finalDataType ) {
		if ( finalDataType !== dataTypes[ 0 ] ) {
			dataTypes.unshift( finalDataType );
		}
		return responses[ finalDataType ];
	}
}

// Chain conversions given the request and the original response
function ajaxConvert( s, response ) {

	// Apply the dataFilter if provided
	if ( s.dataFilter ) {
		response = s.dataFilter( response, s.dataType );
	}

	var dataTypes = s.dataTypes,
		converters = {},
		i,
		key,
		length = dataTypes.length,
		tmp,
		// Current and previous dataTypes
		current = dataTypes[ 0 ],
		prev,
		// Conversion expression
		conversion,
		// Conversion function
		conv,
		// Conversion functions (transitive conversion)
		conv1,
		conv2;

	// For each dataType in the chain
	for( i = 1; i < length; i++ ) {

		// Create converters map
		// with lowercased keys
		if ( i === 1 ) {
			for( key in s.converters ) {
				if( typeof key === "string" ) {
					converters[ key.toLowerCase() ] = s.converters[ key ];
				}
			}
		}

		// Get the dataTypes
		prev = current;
		current = dataTypes[ i ];

		// If current is auto dataType, update it to prev
		if( current === "*" ) {
			current = prev;
		// If no auto and dataTypes are actually different
		} else if ( prev !== "*" && prev !== current ) {

			// Get the converter
			conversion = prev + " " + current;
			conv = converters[ conversion ] || converters[ "* " + current ];

			// If there is no direct converter, search transitively
			if ( !conv ) {
				conv2 = undefined;
				for( conv1 in converters ) {
					tmp = conv1.split( " " );
					if ( tmp[ 0 ] === prev || tmp[ 0 ] === "*" ) {
						conv2 = converters[ tmp[1] + " " + current ];
						if ( conv2 ) {
							conv1 = converters[ conv1 ];
							if ( conv1 === true ) {
								conv = conv2;
							} else if ( conv2 === true ) {
								conv = conv1;
							}
							break;
						}
					}
				}
			}
			// If we found no converter, dispatch an error
			if ( !( conv || conv2 ) ) {
				jQuery.error( "No conversion from " + conversion.replace(" "," to ") );
			}
			// If found converter is not an equivalence
			if ( conv !== true ) {
				// Convert with 1 or 2 converters accordingly
				response = conv ? conv( response ) : conv2( conv1(response) );
			}
		}
	}
	return response;
}




var jsc = jQuery.now(),
	jsre = /(\=)\?(&|$)|\?\?/i;

// Default jsonp settings
jQuery.ajaxSetup({
	jsonp: "callback",
	jsonpCallback: function() {
		return jQuery.expando + "_" + ( jsc++ );
	}
});

// Detect, normalize options and install callbacks for jsonp requests
jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

	var inspectData = s.contentType === "application/x-www-form-urlencoded" &&
		( typeof s.data === "string" );

	if ( s.dataTypes[ 0 ] === "jsonp" ||
		s.jsonp !== false && ( jsre.test( s.url ) ||
				inspectData && jsre.test( s.data ) ) ) {

		var responseContainer,
			jsonpCallback = s.jsonpCallback =
				jQuery.isFunction( s.jsonpCallback ) ? s.jsonpCallback() : s.jsonpCallback,
			previous = window[ jsonpCallback ],
			url = s.url,
			data = s.data,
			replace = "$1" + jsonpCallback + "$2";

		if ( s.jsonp !== false ) {
			url = url.replace( jsre, replace );
			if ( s.url === url ) {
				if ( inspectData ) {
					data = data.replace( jsre, replace );
				}
				if ( s.data === data ) {
					// Add callback manually
					url += (/\?/.test( url ) ? "&" : "?") + s.jsonp + "=" + jsonpCallback;
				}
			}
		}

		s.url = url;
		s.data = data;

		// Install callback
		window[ jsonpCallback ] = function( response ) {
			responseContainer = [ response ];
		};

		// Clean-up function
		jqXHR.always(function() {
			// Set callback back to previous value
			window[ jsonpCallback ] = previous;
			// Call if it was a function and we have a response
			if ( responseContainer && jQuery.isFunction( previous ) ) {
				window[ jsonpCallback ]( responseContainer[ 0 ] );
			}
		});

		// Use data converter to retrieve json after script execution
		s.converters["script json"] = function() {
			if ( !responseContainer ) {
				jQuery.error( jsonpCallback + " was not called" );
			}
			return responseContainer[ 0 ];
		};

		// force json dataType
		s.dataTypes[ 0 ] = "json";

		// Delegate to script
		return "script";
	}
});




// Install script dataType
jQuery.ajaxSetup({
	accepts: {
		script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"
	},
	contents: {
		script: /javascript|ecmascript/
	},
	converters: {
		"text script": function( text ) {
			jQuery.globalEval( text );
			return text;
		}
	}
});

// Handle cache's special case and global
jQuery.ajaxPrefilter( "script", function( s ) {
	if ( s.cache === undefined ) {
		s.cache = false;
	}
	if ( s.crossDomain ) {
		s.type = "GET";
		s.global = false;
	}
});

// Bind script tag hack transport
jQuery.ajaxTransport( "script", function(s) {

	// This transport only deals with cross domain requests
	if ( s.crossDomain ) {

		var script,
			head = document.head || document.getElementsByTagName( "head" )[0] || document.documentElement;

		return {

			send: function( _, callback ) {

				script = document.createElement( "script" );

				script.async = "async";

				if ( s.scriptCharset ) {
					script.charset = s.scriptCharset;
				}

				script.src = s.url;

				// Attach handlers for all browsers
				script.onload = script.onreadystatechange = function( _, isAbort ) {

					if ( isAbort || !script.readyState || /loaded|complete/.test( script.readyState ) ) {

						// Handle memory leak in IE
						script.onload = script.onreadystatechange = null;

						// Remove the script
						if ( head && script.parentNode ) {
							head.removeChild( script );
						}

						// Dereference the script
						script = undefined;

						// Callback if not abort
						if ( !isAbort ) {
							callback( 200, "success" );
						}
					}
				};
				// Use insertBefore instead of appendChild  to circumvent an IE6 bug.
				// This arises when a base node is used (#2709 and #4378).
				head.insertBefore( script, head.firstChild );
			},

			abort: function() {
				if ( script ) {
					script.onload( 0, 1 );
				}
			}
		};
	}
});




var // #5280: Internet Explorer will keep connections alive if we don't abort on unload
	xhrOnUnloadAbort = window.ActiveXObject ? function() {
		// Abort all pending requests
		for ( var key in xhrCallbacks ) {
			xhrCallbacks[ key ]( 0, 1 );
		}
	} : false,
	xhrId = 0,
	xhrCallbacks;

// Functions to create xhrs
function createStandardXHR() {
	try {
		return new window.XMLHttpRequest();
	} catch( e ) {}
}

function createActiveXHR() {
	try {
		return new window.ActiveXObject( "Microsoft.XMLHTTP" );
	} catch( e ) {}
}

// Create the request object
// (This is still attached to ajaxSettings for backward compatibility)
jQuery.ajaxSettings.xhr = window.ActiveXObject ?
	/* Microsoft failed to properly
	 * implement the XMLHttpRequest in IE7 (can't request local files),
	 * so we use the ActiveXObject when it is available
	 * Additionally XMLHttpRequest can be disabled in IE7/IE8 so
	 * we need a fallback.
	 */
	function() {
		return !this.isLocal && createStandardXHR() || createActiveXHR();
	} :
	// For all other browsers, use the standard XMLHttpRequest object
	createStandardXHR;

// Determine support properties
(function( xhr ) {
	jQuery.extend( jQuery.support, {
		ajax: !!xhr,
		cors: !!xhr && ( "withCredentials" in xhr )
	});
})( jQuery.ajaxSettings.xhr() );

// Create transport if the browser can provide an xhr
if ( jQuery.support.ajax ) {

	jQuery.ajaxTransport(function( s ) {
		// Cross domain only allowed if supported through XMLHttpRequest
		if ( !s.crossDomain || jQuery.support.cors ) {

			var callback;

			return {
				send: function( headers, complete ) {

					// Get a new xhr
					var xhr = s.xhr(),
						handle,
						i;

					// Open the socket
					// Passing null username, generates a login popup on Opera (#2865)
					if ( s.username ) {
						xhr.open( s.type, s.url, s.async, s.username, s.password );
					} else {
						xhr.open( s.type, s.url, s.async );
					}

					// Apply custom fields if provided
					if ( s.xhrFields ) {
						for ( i in s.xhrFields ) {
							xhr[ i ] = s.xhrFields[ i ];
						}
					}

					// Override mime type if needed
					if ( s.mimeType && xhr.overrideMimeType ) {
						xhr.overrideMimeType( s.mimeType );
					}

					// X-Requested-With header
					// For cross-domain requests, seeing as conditions for a preflight are
					// akin to a jigsaw puzzle, we simply never set it to be sure.
					// (it can always be set on a per-request basis or even using ajaxSetup)
					// For same-domain requests, won't change header if already provided.
					if ( !s.crossDomain && !headers["X-Requested-With"] ) {
						headers[ "X-Requested-With" ] = "XMLHttpRequest";
					}

					// Need an extra try/catch for cross domain requests in Firefox 3
					try {
						for ( i in headers ) {
							xhr.setRequestHeader( i, headers[ i ] );
						}
					} catch( _ ) {}

					// Do send the request
					// This may raise an exception which is actually
					// handled in jQuery.ajax (so no try/catch here)
					xhr.send( ( s.hasContent && s.data ) || null );

					// Listener
					callback = function( _, isAbort ) {

						var status,
							statusText,
							responseHeaders,
							responses,
							xml;

						// Firefox throws exceptions when accessing properties
						// of an xhr when a network error occured
						// http://helpful.knobs-dials.com/index.php/Component_returned_failure_code:_0x80040111_(NS_ERROR_NOT_AVAILABLE)
						try {

							// Was never called and is aborted or complete
							if ( callback && ( isAbort || xhr.readyState === 4 ) ) {

								// Only called once
								callback = undefined;

								// Do not keep as active anymore
								if ( handle ) {
									xhr.onreadystatechange = jQuery.noop;
									if ( xhrOnUnloadAbort ) {
										delete xhrCallbacks[ handle ];
									}
								}

								// If it's an abort
								if ( isAbort ) {
									// Abort it manually if needed
									if ( xhr.readyState !== 4 ) {
										xhr.abort();
									}
								} else {
									status = xhr.status;
									responseHeaders = xhr.getAllResponseHeaders();
									responses = {};
									xml = xhr.responseXML;

									// Construct response list
									if ( xml && xml.documentElement /* #4958 */ ) {
										responses.xml = xml;
									}
									responses.text = xhr.responseText;

									// Firefox throws an exception when accessing
									// statusText for faulty cross-domain requests
									try {
										statusText = xhr.statusText;
									} catch( e ) {
										// We normalize with Webkit giving an empty statusText
										statusText = "";
									}

									// Filter status for non standard behaviors

									// If the request is local and we have data: assume a success
									// (success with no data won't get notified, that's the best we
									// can do given current implementations)
									if ( !status && s.isLocal && !s.crossDomain ) {
										status = responses.text ? 200 : 404;
									// IE - #1450: sometimes returns 1223 when it should be 204
									} else if ( status === 1223 ) {
										status = 204;
									}
								}
							}
						} catch( firefoxAccessException ) {
							if ( !isAbort ) {
								complete( -1, firefoxAccessException );
							}
						}

						// Call complete if needed
						if ( responses ) {
							complete( status, statusText, responses, responseHeaders );
						}
					};

					// if we're in sync mode or it's in cache
					// and has been retrieved directly (IE6 & IE7)
					// we need to manually fire the callback
					if ( !s.async || xhr.readyState === 4 ) {
						callback();
					} else {
						handle = ++xhrId;
						if ( xhrOnUnloadAbort ) {
							// Create the active xhrs callbacks list if needed
							// and attach the unload handler
							if ( !xhrCallbacks ) {
								xhrCallbacks = {};
								jQuery( window ).unload( xhrOnUnloadAbort );
							}
							// Add to list of active xhrs callbacks
							xhrCallbacks[ handle ] = callback;
						}
						xhr.onreadystatechange = callback;
					}
				},

				abort: function() {
					if ( callback ) {
						callback(0,1);
					}
				}
			};
		}
	});
}




var elemdisplay = {},
	iframe, iframeDoc,
	rfxtypes = /^(?:toggle|show|hide)$/,
	rfxnum = /^([+\-]=)?([\d+.\-]+)([a-z%]*)$/i,
	timerId,
	fxAttrs = [
		// height animations
		[ "height", "marginTop", "marginBottom", "paddingTop", "paddingBottom" ],
		// width animations
		[ "width", "marginLeft", "marginRight", "paddingLeft", "paddingRight" ],
		// opacity animations
		[ "opacity" ]
	],
	fxNow,
	requestAnimationFrame = window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame;

jQuery.fn.extend({
	show: function( speed, easing, callback ) {
		var elem, display;

		if ( speed || speed === 0 ) {
			return this.animate( genFx("show", 3), speed, easing, callback);

		} else {
			for ( var i = 0, j = this.length; i < j; i++ ) {
				elem = this[i];

				if ( elem.style ) {
					display = elem.style.display;

					// Reset the inline display of this element to learn if it is
					// being hidden by cascaded rules or not
					if ( !jQuery._data(elem, "olddisplay") && display === "none" ) {
						display = elem.style.display = "";
					}

					// Set elements which have been overridden with display: none
					// in a stylesheet to whatever the default browser style is
					// for such an element
					if ( display === "" && jQuery.css( elem, "display" ) === "none" ) {
						jQuery._data(elem, "olddisplay", defaultDisplay(elem.nodeName));
					}
				}
			}

			// Set the display of most of the elements in a second loop
			// to avoid the constant reflow
			for ( i = 0; i < j; i++ ) {
				elem = this[i];

				if ( elem.style ) {
					display = elem.style.display;

					if ( display === "" || display === "none" ) {
						elem.style.display = jQuery._data(elem, "olddisplay") || "";
					}
				}
			}

			return this;
		}
	},

	hide: function( speed, easing, callback ) {
		if ( speed || speed === 0 ) {
			return this.animate( genFx("hide", 3), speed, easing, callback);

		} else {
			for ( var i = 0, j = this.length; i < j; i++ ) {
				if ( this[i].style ) {
					var display = jQuery.css( this[i], "display" );

					if ( display !== "none" && !jQuery._data( this[i], "olddisplay" ) ) {
						jQuery._data( this[i], "olddisplay", display );
					}
				}
			}

			// Set the display of the elements in a second loop
			// to avoid the constant reflow
			for ( i = 0; i < j; i++ ) {
				if ( this[i].style ) {
					this[i].style.display = "none";
				}
			}

			return this;
		}
	},

	// Save the old toggle function
	_toggle: jQuery.fn.toggle,

	toggle: function( fn, fn2, callback ) {
		var bool = typeof fn === "boolean";

		if ( jQuery.isFunction(fn) && jQuery.isFunction(fn2) ) {
			this._toggle.apply( this, arguments );

		} else if ( fn == null || bool ) {
			this.each(function() {
				var state = bool ? fn : jQuery(this).is(":hidden");
				jQuery(this)[ state ? "show" : "hide" ]();
			});

		} else {
			this.animate(genFx("toggle", 3), fn, fn2, callback);
		}

		return this;
	},

	fadeTo: function( speed, to, easing, callback ) {
		return this.filter(":hidden").css("opacity", 0).show().end()
					.animate({opacity: to}, speed, easing, callback);
	},

	animate: function( prop, speed, easing, callback ) {
		var optall = jQuery.speed(speed, easing, callback);

		if ( jQuery.isEmptyObject( prop ) ) {
			return this.each( optall.complete, [ false ] );
		}

		// Do not change referenced properties as per-property easing will be lost
		prop = jQuery.extend( {}, prop );

		return this[ optall.queue === false ? "each" : "queue" ](function() {
			// XXX 'this' does not always have a nodeName when running the
			// test suite

			if ( optall.queue === false ) {
				jQuery._mark( this );
			}

			var opt = jQuery.extend( {}, optall ),
				isElement = this.nodeType === 1,
				hidden = isElement && jQuery(this).is(":hidden"),
				name, val, p,
				display, e,
				parts, start, end, unit;

			// will store per property easing and be used to determine when an animation is complete
			opt.animatedProperties = {};

			for ( p in prop ) {

				// property name normalization
				name = jQuery.camelCase( p );
				if ( p !== name ) {
					prop[ name ] = prop[ p ];
					delete prop[ p ];
				}

				val = prop[ name ];

				// easing resolution: per property > opt.specialEasing > opt.easing > 'swing' (default)
				if ( jQuery.isArray( val ) ) {
					opt.animatedProperties[ name ] = val[ 1 ];
					val = prop[ name ] = val[ 0 ];
				} else {
					opt.animatedProperties[ name ] = opt.specialEasing && opt.specialEasing[ name ] || opt.easing || 'swing';
				}

				if ( val === "hide" && hidden || val === "show" && !hidden ) {
					return opt.complete.call( this );
				}

				if ( isElement && ( name === "height" || name === "width" ) ) {
					// Make sure that nothing sneaks out
					// Record all 3 overflow attributes because IE does not
					// change the overflow attribute when overflowX and
					// overflowY are set to the same value
					opt.overflow = [ this.style.overflow, this.style.overflowX, this.style.overflowY ];

					// Set display property to inline-block for height/width
					// animations on inline elements that are having width/height
					// animated
					if ( jQuery.css( this, "display" ) === "inline" &&
							jQuery.css( this, "float" ) === "none" ) {
						if ( !jQuery.support.inlineBlockNeedsLayout ) {
							this.style.display = "inline-block";

						} else {
							display = defaultDisplay( this.nodeName );

							// inline-level elements accept inline-block;
							// block-level elements need to be inline with layout
							if ( display === "inline" ) {
								this.style.display = "inline-block";

							} else {
								this.style.display = "inline";
								this.style.zoom = 1;
							}
						}
					}
				}
			}

			if ( opt.overflow != null ) {
				this.style.overflow = "hidden";
			}

			for ( p in prop ) {
				e = new jQuery.fx( this, opt, p );
				val = prop[ p ];

				if ( rfxtypes.test(val) ) {
					e[ val === "toggle" ? hidden ? "show" : "hide" : val ]();

				} else {
					parts = rfxnum.exec( val );
					start = e.cur();

					if ( parts ) {
						end = parseFloat( parts[2] );
						unit = parts[3] || ( jQuery.cssNumber[ p ] ? "" : "px" );

						// We need to compute starting value
						if ( unit !== "px" ) {
							jQuery.style( this, p, (end || 1) + unit);
							start = ((end || 1) / e.cur()) * start;
							jQuery.style( this, p, start + unit);
						}

						// If a +=/-= token was provided, we're doing a relative animation
						if ( parts[1] ) {
							end = ( (parts[ 1 ] === "-=" ? -1 : 1) * end ) + start;
						}

						e.custom( start, end, unit );

					} else {
						e.custom( start, val, "" );
					}
				}
			}

			// For JS strict compliance
			return true;
		});
	},

	stop: function( clearQueue, gotoEnd ) {
		if ( clearQueue ) {
			this.queue([]);
		}

		this.each(function() {
			var timers = jQuery.timers,
				i = timers.length;
			// clear marker counters if we know they won't be
			if ( !gotoEnd ) {
				jQuery._unmark( true, this );
			}
			while ( i-- ) {
				if ( timers[i].elem === this ) {
					if (gotoEnd) {
						// force the next step to be the last
						timers[i](true);
					}

					timers.splice(i, 1);
				}
			}
		});

		// start the next in the queue if the last step wasn't forced
		if ( !gotoEnd ) {
			this.dequeue();
		}

		return this;
	}

});

// Animations created synchronously will run synchronously
function createFxNow() {
	setTimeout( clearFxNow, 0 );
	return ( fxNow = jQuery.now() );
}

function clearFxNow() {
	fxNow = undefined;
}

// Generate parameters to create a standard animation
function genFx( type, num ) {
	var obj = {};

	jQuery.each( fxAttrs.concat.apply([], fxAttrs.slice(0,num)), function() {
		obj[ this ] = type;
	});

	return obj;
}

// Generate shortcuts for custom animations
jQuery.each({
	slideDown: genFx("show", 1),
	slideUp: genFx("hide", 1),
	slideToggle: genFx("toggle", 1),
	fadeIn: { opacity: "show" },
	fadeOut: { opacity: "hide" },
	fadeToggle: { opacity: "toggle" }
}, function( name, props ) {
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return this.animate( props, speed, easing, callback );
	};
});

jQuery.extend({
	speed: function( speed, easing, fn ) {
		var opt = speed && typeof speed === "object" ? jQuery.extend({}, speed) : {
			complete: fn || !fn && easing ||
				jQuery.isFunction( speed ) && speed,
			duration: speed,
			easing: fn && easing || easing && !jQuery.isFunction(easing) && easing
		};

		opt.duration = jQuery.fx.off ? 0 : typeof opt.duration === "number" ? opt.duration :
			opt.duration in jQuery.fx.speeds ? jQuery.fx.speeds[opt.duration] : jQuery.fx.speeds._default;

		// Queueing
		opt.old = opt.complete;
		opt.complete = function( noUnmark ) {
			if ( jQuery.isFunction( opt.old ) ) {
				opt.old.call( this );
			}

			if ( opt.queue !== false ) {
				jQuery.dequeue( this );
			} else if ( noUnmark !== false ) {
				jQuery._unmark( this );
			}
		};

		return opt;
	},

	easing: {
		linear: function( p, n, firstNum, diff ) {
			return firstNum + diff * p;
		},
		swing: function( p, n, firstNum, diff ) {
			return ((-Math.cos(p*Math.PI)/2) + 0.5) * diff + firstNum;
		}
	},

	timers: [],

	fx: function( elem, options, prop ) {
		this.options = options;
		this.elem = elem;
		this.prop = prop;

		options.orig = options.orig || {};
	}

});

jQuery.fx.prototype = {
	// Simple function for setting a style value
	update: function() {
		if ( this.options.step ) {
			this.options.step.call( this.elem, this.now, this );
		}

		(jQuery.fx.step[this.prop] || jQuery.fx.step._default)( this );
	},

	// Get the current size
	cur: function() {
		if ( this.elem[this.prop] != null && (!this.elem.style || this.elem.style[this.prop] == null) ) {
			return this.elem[ this.prop ];
		}

		var parsed,
			r = jQuery.css( this.elem, this.prop );
		// Empty strings, null, undefined and "auto" are converted to 0,
		// complex values such as "rotate(1rad)" are returned as is,
		// simple values such as "10px" are parsed to Float.
		return isNaN( parsed = parseFloat( r ) ) ? !r || r === "auto" ? 0 : r : parsed;
	},

	// Start an animation from one number to another
	custom: function( from, to, unit ) {
		var self = this,
			fx = jQuery.fx,
			raf;

		this.startTime = fxNow || createFxNow();
		this.start = from;
		this.end = to;
		this.unit = unit || this.unit || ( jQuery.cssNumber[ this.prop ] ? "" : "px" );
		this.now = this.start;
		this.pos = this.state = 0;

		function t( gotoEnd ) {
			return self.step(gotoEnd);
		}

		t.elem = this.elem;

		if ( t() && jQuery.timers.push(t) && !timerId ) {
			// Use requestAnimationFrame instead of setInterval if available
			if ( requestAnimationFrame ) {
				timerId = true;
				raf = function() {
					// When timerId gets set to null at any point, this stops
					if ( timerId ) {
						requestAnimationFrame( raf );
						fx.tick();
					}
				};
				requestAnimationFrame( raf );
			} else {
				timerId = setInterval( fx.tick, fx.interval );
			}
		}
	},

	// Simple 'show' function
	show: function() {
		// Remember where we started, so that we can go back to it later
		this.options.orig[this.prop] = jQuery.style( this.elem, this.prop );
		this.options.show = true;

		// Begin the animation
		// Make sure that we start at a small width/height to avoid any
		// flash of content
		this.custom(this.prop === "width" || this.prop === "height" ? 1 : 0, this.cur());

		// Start by showing the element
		jQuery( this.elem ).show();
	},

	// Simple 'hide' function
	hide: function() {
		// Remember where we started, so that we can go back to it later
		this.options.orig[this.prop] = jQuery.style( this.elem, this.prop );
		this.options.hide = true;

		// Begin the animation
		this.custom(this.cur(), 0);
	},

	// Each step of an animation
	step: function( gotoEnd ) {
		var t = fxNow || createFxNow(),
			done = true,
			elem = this.elem,
			options = this.options,
			i, n;

		if ( gotoEnd || t >= options.duration + this.startTime ) {
			this.now = this.end;
			this.pos = this.state = 1;
			this.update();

			options.animatedProperties[ this.prop ] = true;

			for ( i in options.animatedProperties ) {
				if ( options.animatedProperties[i] !== true ) {
					done = false;
				}
			}

			if ( done ) {
				// Reset the overflow
				if ( options.overflow != null && !jQuery.support.shrinkWrapBlocks ) {

					jQuery.each( [ "", "X", "Y" ], function (index, value) {
						elem.style[ "overflow" + value ] = options.overflow[index];
					});
				}

				// Hide the element if the "hide" operation was done
				if ( options.hide ) {
					jQuery(elem).hide();
				}

				// Reset the properties, if the item has been hidden or shown
				if ( options.hide || options.show ) {
					for ( var p in options.animatedProperties ) {
						jQuery.style( elem, p, options.orig[p] );
					}
				}

				// Execute the complete function
				options.complete.call( elem );
			}

			return false;

		} else {
			// classical easing cannot be used with an Infinity duration
			if ( options.duration == Infinity ) {
				this.now = t;
			} else {
				n = t - this.startTime;
				this.state = n / options.duration;

				// Perform the easing function, defaults to swing
				this.pos = jQuery.easing[ options.animatedProperties[ this.prop ] ]( this.state, n, 0, 1, options.duration );
				this.now = this.start + ((this.end - this.start) * this.pos);
			}
			// Perform the next step of the animation
			this.update();
		}

		return true;
	}
};

jQuery.extend( jQuery.fx, {
	tick: function() {
		for ( var timers = jQuery.timers, i = 0 ; i < timers.length ; ++i ) {
			if ( !timers[i]() ) {
				timers.splice(i--, 1);
			}
		}

		if ( !timers.length ) {
			jQuery.fx.stop();
		}
	},

	interval: 13,

	stop: function() {
		clearInterval( timerId );
		timerId = null;
	},

	speeds: {
		slow: 600,
		fast: 200,
		// Default speed
		_default: 400
	},

	step: {
		opacity: function( fx ) {
			jQuery.style( fx.elem, "opacity", fx.now );
		},

		_default: function( fx ) {
			if ( fx.elem.style && fx.elem.style[ fx.prop ] != null ) {
				fx.elem.style[ fx.prop ] = (fx.prop === "width" || fx.prop === "height" ? Math.max(0, fx.now) : fx.now) + fx.unit;
			} else {
				fx.elem[ fx.prop ] = fx.now;
			}
		}
	}
});

if ( jQuery.expr && jQuery.expr.filters ) {
	jQuery.expr.filters.animated = function( elem ) {
		return jQuery.grep(jQuery.timers, function( fn ) {
			return elem === fn.elem;
		}).length;
	};
}

// Try to restore the default display value of an element
function defaultDisplay( nodeName ) {

	if ( !elemdisplay[ nodeName ] ) {

		var body = document.body,
			elem = jQuery( "<" + nodeName + ">" ).appendTo( body ),
			display = elem.css( "display" );

		elem.remove();

		// If the simple way fails,
		// get element's real default display by attaching it to a temp iframe
		if ( display === "none" || display === "" ) {
			// No iframe to use yet, so create it
			if ( !iframe ) {
				iframe = document.createElement( "iframe" );
				iframe.frameBorder = iframe.width = iframe.height = 0;
			}

			body.appendChild( iframe );

			// Create a cacheable copy of the iframe document on first call.
			// IE and Opera will allow us to reuse the iframeDoc without re-writing the fake HTML
			// document to it; WebKit & Firefox won't allow reusing the iframe document.
			if ( !iframeDoc || !iframe.createElement ) {
				iframeDoc = ( iframe.contentWindow || iframe.contentDocument ).document;
				iframeDoc.write( ( document.compatMode === "CSS1Compat" ? "<!doctype html>" : "" ) + "<html><body>" );
				iframeDoc.close();
			}

			elem = iframeDoc.createElement( nodeName );

			iframeDoc.body.appendChild( elem );

			display = jQuery.css( elem, "display" );

			body.removeChild( iframe );
		}

		// Store the correct default display
		elemdisplay[ nodeName ] = display;
	}

	return elemdisplay[ nodeName ];
}




var rtable = /^t(?:able|d|h)$/i,
	rroot = /^(?:body|html)$/i;

if ( "getBoundingClientRect" in document.documentElement ) {
	jQuery.fn.offset = function( options ) {
		var elem = this[0], box;

		if ( options ) {
			return this.each(function( i ) {
				jQuery.offset.setOffset( this, options, i );
			});
		}

		if ( !elem || !elem.ownerDocument ) {
			return null;
		}

		if ( elem === elem.ownerDocument.body ) {
			return jQuery.offset.bodyOffset( elem );
		}

		try {
			box = elem.getBoundingClientRect();
		} catch(e) {}

		var doc = elem.ownerDocument,
			docElem = doc.documentElement;

		// Make sure we're not dealing with a disconnected DOM node
		if ( !box || !jQuery.contains( docElem, elem ) ) {
			return box ? { top: box.top, left: box.left } : { top: 0, left: 0 };
		}

		var body = doc.body,
			win = getWindow(doc),
			clientTop  = docElem.clientTop  || body.clientTop  || 0,
			clientLeft = docElem.clientLeft || body.clientLeft || 0,
			scrollTop  = win.pageYOffset || jQuery.support.boxModel && docElem.scrollTop  || body.scrollTop,
			scrollLeft = win.pageXOffset || jQuery.support.boxModel && docElem.scrollLeft || body.scrollLeft,
			top  = box.top  + scrollTop  - clientTop,
			left = box.left + scrollLeft - clientLeft;

		return { top: top, left: left };
	};

} else {
	jQuery.fn.offset = function( options ) {
		var elem = this[0];

		if ( options ) {
			return this.each(function( i ) {
				jQuery.offset.setOffset( this, options, i );
			});
		}

		if ( !elem || !elem.ownerDocument ) {
			return null;
		}

		if ( elem === elem.ownerDocument.body ) {
			return jQuery.offset.bodyOffset( elem );
		}

		jQuery.offset.initialize();

		var computedStyle,
			offsetParent = elem.offsetParent,
			prevOffsetParent = elem,
			doc = elem.ownerDocument,
			docElem = doc.documentElement,
			body = doc.body,
			defaultView = doc.defaultView,
			prevComputedStyle = defaultView ? defaultView.getComputedStyle( elem, null ) : elem.currentStyle,
			top = elem.offsetTop,
			left = elem.offsetLeft;

		while ( (elem = elem.parentNode) && elem !== body && elem !== docElem ) {
			if ( jQuery.offset.supportsFixedPosition && prevComputedStyle.position === "fixed" ) {
				break;
			}

			computedStyle = defaultView ? defaultView.getComputedStyle(elem, null) : elem.currentStyle;
			top  -= elem.scrollTop;
			left -= elem.scrollLeft;

			if ( elem === offsetParent ) {
				top  += elem.offsetTop;
				left += elem.offsetLeft;

				if ( jQuery.offset.doesNotAddBorder && !(jQuery.offset.doesAddBorderForTableAndCells && rtable.test(elem.nodeName)) ) {
					top  += parseFloat( computedStyle.borderTopWidth  ) || 0;
					left += parseFloat( computedStyle.borderLeftWidth ) || 0;
				}

				prevOffsetParent = offsetParent;
				offsetParent = elem.offsetParent;
			}

			if ( jQuery.offset.subtractsBorderForOverflowNotVisible && computedStyle.overflow !== "visible" ) {
				top  += parseFloat( computedStyle.borderTopWidth  ) || 0;
				left += parseFloat( computedStyle.borderLeftWidth ) || 0;
			}

			prevComputedStyle = computedStyle;
		}

		if ( prevComputedStyle.position === "relative" || prevComputedStyle.position === "static" ) {
			top  += body.offsetTop;
			left += body.offsetLeft;
		}

		if ( jQuery.offset.supportsFixedPosition && prevComputedStyle.position === "fixed" ) {
			top  += Math.max( docElem.scrollTop, body.scrollTop );
			left += Math.max( docElem.scrollLeft, body.scrollLeft );
		}

		return { top: top, left: left };
	};
}

jQuery.offset = {
	initialize: function() {
		var body = document.body, container = document.createElement("div"), innerDiv, checkDiv, table, td, bodyMarginTop = parseFloat( jQuery.css(body, "marginTop") ) || 0,
			html = "<div style='position:absolute;top:0;left:0;margin:0;border:5px solid #000;padding:0;width:1px;height:1px;'><div></div></div><table style='position:absolute;top:0;left:0;margin:0;border:5px solid #000;padding:0;width:1px;height:1px;' cellpadding='0' cellspacing='0'><tr><td></td></tr></table>";

		jQuery.extend( container.style, { position: "absolute", top: 0, left: 0, margin: 0, border: 0, width: "1px", height: "1px", visibility: "hidden" } );

		container.innerHTML = html;
		body.insertBefore( container, body.firstChild );
		innerDiv = container.firstChild;
		checkDiv = innerDiv.firstChild;
		td = innerDiv.nextSibling.firstChild.firstChild;

		this.doesNotAddBorder = (checkDiv.offsetTop !== 5);
		this.doesAddBorderForTableAndCells = (td.offsetTop === 5);

		checkDiv.style.position = "fixed";
		checkDiv.style.top = "20px";

		// safari subtracts parent border width here which is 5px
		this.supportsFixedPosition = (checkDiv.offsetTop === 20 || checkDiv.offsetTop === 15);
		checkDiv.style.position = checkDiv.style.top = "";

		innerDiv.style.overflow = "hidden";
		innerDiv.style.position = "relative";

		this.subtractsBorderForOverflowNotVisible = (checkDiv.offsetTop === -5);

		this.doesNotIncludeMarginInBodyOffset = (body.offsetTop !== bodyMarginTop);

		body.removeChild( container );
		jQuery.offset.initialize = jQuery.noop;
	},

	bodyOffset: function( body ) {
		var top = body.offsetTop,
			left = body.offsetLeft;

		jQuery.offset.initialize();

		if ( jQuery.offset.doesNotIncludeMarginInBodyOffset ) {
			top  += parseFloat( jQuery.css(body, "marginTop") ) || 0;
			left += parseFloat( jQuery.css(body, "marginLeft") ) || 0;
		}

		return { top: top, left: left };
	},

	setOffset: function( elem, options, i ) {
		var position = jQuery.css( elem, "position" );

		// set position first, in-case top/left are set even on static elem
		if ( position === "static" ) {
			elem.style.position = "relative";
		}

		var curElem = jQuery( elem ),
			curOffset = curElem.offset(),
			curCSSTop = jQuery.css( elem, "top" ),
			curCSSLeft = jQuery.css( elem, "left" ),
			calculatePosition = (position === "absolute" || position === "fixed") && jQuery.inArray("auto", [curCSSTop, curCSSLeft]) > -1,
			props = {}, curPosition = {}, curTop, curLeft;

		// need to be able to calculate position if either top or left is auto and position is either absolute or fixed
		if ( calculatePosition ) {
			curPosition = curElem.position();
			curTop = curPosition.top;
			curLeft = curPosition.left;
		} else {
			curTop = parseFloat( curCSSTop ) || 0;
			curLeft = parseFloat( curCSSLeft ) || 0;
		}

		if ( jQuery.isFunction( options ) ) {
			options = options.call( elem, i, curOffset );
		}

		if (options.top != null) {
			props.top = (options.top - curOffset.top) + curTop;
		}
		if (options.left != null) {
			props.left = (options.left - curOffset.left) + curLeft;
		}

		if ( "using" in options ) {
			options.using.call( elem, props );
		} else {
			curElem.css( props );
		}
	}
};


jQuery.fn.extend({
	position: function() {
		if ( !this[0] ) {
			return null;
		}

		var elem = this[0],

		// Get *real* offsetParent
		offsetParent = this.offsetParent(),

		// Get correct offsets
		offset       = this.offset(),
		parentOffset = rroot.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset();

		// Subtract element margins
		// note: when an element has margin: auto the offsetLeft and marginLeft
		// are the same in Safari causing offset.left to incorrectly be 0
		offset.top  -= parseFloat( jQuery.css(elem, "marginTop") ) || 0;
		offset.left -= parseFloat( jQuery.css(elem, "marginLeft") ) || 0;

		// Add offsetParent borders
		parentOffset.top  += parseFloat( jQuery.css(offsetParent[0], "borderTopWidth") ) || 0;
		parentOffset.left += parseFloat( jQuery.css(offsetParent[0], "borderLeftWidth") ) || 0;

		// Subtract the two offsets
		return {
			top:  offset.top  - parentOffset.top,
			left: offset.left - parentOffset.left
		};
	},

	offsetParent: function() {
		return this.map(function() {
			var offsetParent = this.offsetParent || document.body;
			while ( offsetParent && (!rroot.test(offsetParent.nodeName) && jQuery.css(offsetParent, "position") === "static") ) {
				offsetParent = offsetParent.offsetParent;
			}
			return offsetParent;
		});
	}
});


// Create scrollLeft and scrollTop methods
jQuery.each( ["Left", "Top"], function( i, name ) {
	var method = "scroll" + name;

	jQuery.fn[ method ] = function( val ) {
		var elem, win;

		if ( val === undefined ) {
			elem = this[ 0 ];

			if ( !elem ) {
				return null;
			}

			win = getWindow( elem );

			// Return the scroll offset
			return win ? ("pageXOffset" in win) ? win[ i ? "pageYOffset" : "pageXOffset" ] :
				jQuery.support.boxModel && win.document.documentElement[ method ] ||
					win.document.body[ method ] :
				elem[ method ];
		}

		// Set the scroll offset
		return this.each(function() {
			win = getWindow( this );

			if ( win ) {
				win.scrollTo(
					!i ? val : jQuery( win ).scrollLeft(),
					 i ? val : jQuery( win ).scrollTop()
				);

			} else {
				this[ method ] = val;
			}
		});
	};
});

function getWindow( elem ) {
	return jQuery.isWindow( elem ) ?
		elem :
		elem.nodeType === 9 ?
			elem.defaultView || elem.parentWindow :
			false;
}




// Create width, height, innerHeight, innerWidth, outerHeight and outerWidth methods
jQuery.each([ "Height", "Width" ], function( i, name ) {

	var type = name.toLowerCase();

	// innerHeight and innerWidth
	jQuery.fn[ "inner" + name ] = function() {
		var elem = this[0];
		return elem && elem.style ?
			parseFloat( jQuery.css( elem, type, "padding" ) ) :
			null;
	};

	// outerHeight and outerWidth
	jQuery.fn[ "outer" + name ] = function( margin ) {
		var elem = this[0];
		return elem && elem.style ?
			parseFloat( jQuery.css( elem, type, margin ? "margin" : "border" ) ) :
			null;
	};

	jQuery.fn[ type ] = function( size ) {
		// Get window width or height
		var elem = this[0];
		if ( !elem ) {
			return size == null ? null : this;
		}

		if ( jQuery.isFunction( size ) ) {
			return this.each(function( i ) {
				var self = jQuery( this );
				self[ type ]( size.call( this, i, self[ type ]() ) );
			});
		}

		if ( jQuery.isWindow( elem ) ) {
			// Everyone else use document.documentElement or document.body depending on Quirks vs Standards mode
			// 3rd condition allows Nokia support, as it supports the docElem prop but not CSS1Compat
			var docElemProp = elem.document.documentElement[ "client" + name ];
			return elem.document.compatMode === "CSS1Compat" && docElemProp ||
				elem.document.body[ "client" + name ] || docElemProp;

		// Get document width or height
		} else if ( elem.nodeType === 9 ) {
			// Either scroll[Width/Height] or offset[Width/Height], whichever is greater
			return Math.max(
				elem.documentElement["client" + name],
				elem.body["scroll" + name], elem.documentElement["scroll" + name],
				elem.body["offset" + name], elem.documentElement["offset" + name]
			);

		// Get or set width or height on the element
		} else if ( size === undefined ) {
			var orig = jQuery.css( elem, type ),
				ret = parseFloat( orig );

			return jQuery.isNaN( ret ) ? orig : ret;

		// Set the width or height on the element (default to pixels if value is unitless)
		} else {
			return this.css( type, typeof size === "string" ? size : size + "px" );
		}
	};

});


// Expose jQuery to the global object
window.jQuery = window.$ = jQuery;
})(window);
spade.register("sproutcore-views", {"name":"sproutcore-views","version":"2.0.beta.3","dependencies":{"spade":"~> 1.0","jquery":"~> 1.6","sproutcore-runtime":"2.0.beta.3"}});

spade.register("sproutcore-views/main", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire(\"sproutcore-runtime\");\n\nSC.$ = jQuery;\n\nrequire(\"sproutcore-views/system\");\nrequire(\"sproutcore-views/views\");\n\n});");spade.register("sproutcore-views/system", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire(\"sproutcore-views/system/render_buffer\");\nrequire(\"sproutcore-views/system/application\");\nrequire(\"sproutcore-views/system/event_dispatcher\");\nrequire(\"sproutcore-views/system/ext\");\n\n});");spade.register("sproutcore-views/system/application", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire(\"sproutcore-views/system/event_dispatcher\");\n\nvar get = SC.get, set = SC.set;\n\n/**\n  @class\n\n  An SC.Application instance serves as the namespace in which you define your\n  application's classes. You can also override the configuration of your\n  application.\n\n  By default, SC.Application will begin listening for events on the document.\n  If your application is embedded inside a page, instead of controlling the\n  entire document, you can specify which DOM element to attach to by setting\n  the `rootElement` property:\n\n      MyApp = SC.Application.create({\n        rootElement: $('#my-app')\n      });\n\n  The root of an SC.Application must not be removed during the course of the\n  page's lifetime. If you have only a single conceptual application for the\n  entire page, and are not embedding any third-party SproutCore applications\n  in your page, use the default document root for your application.\n\n  You only need to specify the root if your page contains multiple instances \n  of SC.Application.\n\n  @since SproutCore 2.0\n  @extends SC.Object\n*/\nSC.Application = SC.Namespace.extend(\n/** @scope SC.Application.prototype */{\n\n  /**\n    @type DOMElement\n    @default document\n  */\n  rootElement: document,\n\n  /**\n    @type SC.EventDispatcher\n    @default null\n  */\n  eventDispatcher: null,\n\n  /**\n    @type Object\n    @default null\n  */\n  customEvents: null,\n\n  /** @private */\n  init: function() {\n    var eventDispatcher,\n        rootElement = get(this, 'rootElement');\n\n    eventDispatcher = SC.EventDispatcher.create({\n      rootElement: rootElement\n    });\n\n    set(this, 'eventDispatcher', eventDispatcher);\n\n    var self = this;\n    SC.$(document).ready(function() {\n      self.ready();\n    });\n  },\n\n  ready: function() {\n    var eventDispatcher = get(this, 'eventDispatcher'),\n        customEvents    = get(this, 'customEvents');\n\n    eventDispatcher.setup(customEvents);\n  },\n\n  /** @private */\n  destroy: function() {\n    get(this, 'eventDispatcher').destroy();\n    return this._super();\n  }\n});\n\n\n\n});");spade.register("sproutcore-views/system/event_dispatcher", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nvar get = SC.get, set = SC.set, fmt = SC.String.fmt;\n\n/**\n  @ignore\n\n  SC.EventDispatcher handles delegating browser events to their corresponding\n  SC.Views. For example, when you click on a view, SC.EventDispatcher ensures\n  that that view's `mouseDown` method gets called.\n*/\nSC.EventDispatcher = SC.Object.extend(\n/** @scope SC.EventDispatcher.prototype */{\n\n  /**\n    @private\n\n    The root DOM element to which event listeners should be attached. Event\n    listeners will be attached to the document unless this is overridden.\n\n    @type DOMElement\n    @default document\n  */\n  rootElement: document,\n\n  /**\n    @private\n\n    Sets up event listeners for standard browser events.\n\n    This will be called after the browser sends a DOMContentReady event. By\n    default, it will set up all of the listeners on the document body. If you\n    would like to register the listeners on different element, set the event\n    dispatcher's `root` property.\n  */\n  setup: function(addedEvents) {\n    var event, events = {\n      touchstart  : 'touchStart',\n      touchmove   : 'touchMove',\n      touchend    : 'touchEnd',\n      touchcancel : 'touchCancel',\n      keydown     : 'keyDown',\n      keyup       : 'keyUp',\n      keypress    : 'keyPress',\n      mousedown   : 'mouseDown',\n      mouseup     : 'mouseUp',\n      click       : 'click',\n      dblclick    : 'doubleClick',\n      mousemove   : 'mouseMove',\n      focusin     : 'focusIn',\n      focusout    : 'focusOut',\n      mouseenter  : 'mouseEnter',\n      mouseleave  : 'mouseLeave',\n      submit      : 'submit',\n      change      : 'change'\n    };\n\n    jQuery.extend(events, addedEvents || {});\n\n    var rootElement = SC.$(get(this, 'rootElement'));\n\n    sc_assert(fmt('You cannot use the same root element (%@) multiple times in an SC.Application', [rootElement.selector || rootElement[0].tagName]), !rootElement.is('.sc-application'));\n    sc_assert('You cannot make a new SC.Application using a root element that is a descendent of an existing SC.Application', !rootElement.closest('.sc-application').length);\n    sc_assert('You cannot make a new SC.Application using a root element that is an ancestor of an existing SC.Application', !rootElement.find('.sc-application').length);\n\n    rootElement.addClass('sc-application')\n\n    for (event in events) {\n      if (events.hasOwnProperty(event)) {\n        this.setupHandler(rootElement, event, events[event]);\n      }\n    }\n  },\n\n  /**\n    @private\n\n    Registers an event listener on the document. If the given event is\n    triggered, the provided event handler will be triggered on the target\n    view.\n\n    If the target view does not implement the event handler, or if the handler\n    returns false, the parent view will be called. The event will continue to\n    bubble to each successive parent view until it reaches the top.\n\n    For example, to have the `mouseDown` method called on the target view when\n    a `mousedown` event is received from the browser, do the following:\n\n        setupHandler('mousedown', 'mouseDown');\n\n    @param {String} event the browser-originated event to listen to\n    @param {String} eventName the name of the method to call on the view\n  */\n  setupHandler: function(rootElement, event, eventName) {\n    var self = this;\n\n    rootElement.delegate('.sc-view', event + '.sproutcore', function(evt, triggeringManager) {\n\n      var view = SC.View.views[this.id],\n          result = true, manager = null;\n\n      manager = self._findNearestEventManager(view,eventName);\n\n      if (manager && manager !== triggeringManager) {\n        result = self._dispatchEvent(manager, evt, eventName, view);\n      } else if (view) {\n        result = self._bubbleEvent(view,evt,eventName);\n      } else {\n        evt.stopPropagation();\n      }\n\n      return result;\n    });\n  },\n\n  /** @private */\n  _findNearestEventManager: function(view, eventName) {\n    var manager = null;\n\n    while (view) {\n      manager = get(view, 'eventManager');\n      if (manager && manager[eventName]) { break; }\n\n      view = get(view, 'parentView');\n    }\n\n    return manager;\n  },\n\n  /** @private */\n  _dispatchEvent: function(object, evt, eventName, view) {\n    var result = true;\n\n    handler = object[eventName];\n    if (SC.typeOf(handler) === 'function') {\n      result = handler.call(object, evt, view);\n      evt.stopPropagation();\n    }\n    else {\n      result = this._bubbleEvent(view, evt, eventName);\n    }\n\n    return result;\n  },\n\n  /** @private */\n  _bubbleEvent: function(view, evt, eventName) {\n    var result = true, handler,\n        self = this;\n\n      SC.run(function() {\n        handler = view[eventName];\n        if (SC.typeOf(handler) === 'function') {\n          result = handler.call(view, evt);\n        }\n      });\n\n    return result;\n  },\n\n  /** @private */\n  destroy: function() {\n    var rootElement = get(this, 'rootElement');\n    SC.$(rootElement).undelegate('.sproutcore').removeClass('sc-application');\n    return this._super();\n  }\n});\n\n});");spade.register("sproutcore-views/system/ext", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\n// Add a new named queue for rendering views that happens\n// after bindings have synced.\nvar queues = SC.run.queues;\nqueues.insertAt(queues.indexOf('actions')+1, 'render');\n\n});");spade.register("sproutcore-views/system/render_buffer", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nvar get = SC.get, set = SC.set;\n\n/**\n  @class\n\n  SC.RenderBuffer gathers information regarding the a view and generates the\n  final representation. SC.RenderBuffer will generate HTML which can be pushed\n  to the DOM.\n\n  @extends SC.Object\n*/\nSC.RenderBuffer = function(tagName) {\n  return SC._RenderBuffer.create({ elementTag: tagName });\n};\n\nSC._RenderBuffer = SC.Object.extend(\n/** @scope SC.RenderBuffer.prototype */ {\n\n  /**\n    Array of class-names which will be applied in the class=\"\" attribute\n\n    You should not maintain this array yourself, rather, you should use\n    the addClass() method of SC.RenderBuffer.\n\n    @type Array\n    @default []\n  */\n  elementClasses: null,\n\n  /**\n    The id in of the element, to be applied in the id=\"\" attribute\n\n    You should not set this property yourself, rather, you should use\n    the id() method of SC.RenderBuffer.\n\n    @type String\n    @default null\n  */\n  elementId: null,\n\n  /**\n    A hash keyed on the name of the attribute and whose value will be\n    applied to that attribute. For example, if you wanted to apply a\n    data-view=\"Foo.bar\" property to an element, you would set the\n    elementAttributes hash to {'data-view':'Foo.bar'}\n\n    You should not maintain this hash yourself, rather, you should use\n    the attr() method of SC.RenderBuffer.\n\n    @type Hash\n    @default {}\n  */\n  elementAttributes: null,\n\n  /**\n    The tagname of the element an instance of SC.RenderBuffer represents.\n\n    Usually, this gets set as the first parameter to SC.RenderBuffer. For\n    example, if you wanted to create a `p` tag, then you would call\n\n      SC.RenderBuffer('p')\n\n    @type String\n    @default null\n  */\n  elementTag: null,\n\n  /**\n    A hash keyed on the name of the style attribute and whose value will\n    be applied to that attribute. For example, if you wanted to apply a\n    background-color:black;\" style to an element, you would set the\n    elementStyle hash to {'background-color':'black'}\n\n    You should not maintain this hash yourself, rather, you should use\n    the style() method of SC.RenderBuffer.\n\n    @type Hash\n    @default {}\n  */\n  elementStyle: null,\n\n  /**\n    Nested RenderBuffers will set this to their parent RenderBuffer\n    instance.\n\n    @type SC._RenderBuffer\n  */\n  parentBuffer: null,\n\n  /** @private */\n  init: function() {\n    this._super();\n\n    set(this ,'elementClasses', []);\n    set(this, 'elementAttributes', {});\n    set(this, 'elementStyle', {});\n    set(this, 'childBuffers', []);\n    set(this, 'elements', {});\n  },\n\n  /**\n    Adds a string of HTML to the RenderBuffer.\n\n    @param {String} string HTML to push into the buffer\n    @returns {SC.RenderBuffer} this\n  */\n  push: function(string) {\n    get(this, 'childBuffers').pushObject(String(string));\n    return this;\n  },\n\n  /**\n    Adds a class to the buffer, which will be rendered to the class attribute.\n\n    @param {String} className Class name to add to the buffer\n    @returns {SC.RenderBuffer} this\n  */\n  addClass: function(className) {\n    get(this, 'elementClasses').pushObject(className);\n    return this;\n  },\n\n  /**\n    Sets the elementID to be used for the element.\n\n    @param {Strign} id\n    @returns {SC.RenderBuffer} this\n  */\n  id: function(id) {\n    set(this, 'elementId', id);\n    return this;\n  },\n\n  /**\n    Adds an attribute which will be rendered to the element.\n\n    @param {String} name The name of the attribute\n    @param {String} value The value to add to the attribute\n    @returns {SC.RenderBuffer} this\n  */\n  attr: function(name, value) {\n    get(this, 'elementAttributes')[name] = value;\n    return this;\n  },\n\n  /**\n    Adds a style to the style attribute which will be rendered to the element.\n\n    @param {String} name Name of the style\n    @param {String} value\n    @returns {SC.RenderBuffer} this\n  */\n  style: function(name, value) {\n    get(this, 'elementStyle')[name] = value;\n    return this;\n  },\n\n  /**\n    Create a new child render buffer from a parent buffer. Optionally set\n    additional properties on the buffer. Optionally invoke a callback\n    with the newly created buffer.\n\n    This is a primitive method used by other public methods: `begin`,\n    `prepend`, `replaceWith`, `insertAfter`.\n\n    @private\n    @param {String} tagName Tag name to use for the child buffer's element\n    @param {SC._RenderBuffer} parent The parent render buffer that this\n      buffer should be appended to.\n    @param {Function} fn A callback to invoke with the newly created buffer.\n    @param {Object} other Additional properties to add to the newly created\n      buffer.\n  */\n  newBuffer: function(tagName, parent, fn, other) {\n    var buffer = SC._RenderBuffer.create({\n      parentBuffer: parent,\n      elementTag: tagName\n    });\n\n    if (other) { buffer.setProperties(other); }\n    if (fn) { fn.call(this, buffer); }\n\n    return buffer;\n  },\n\n  /**\n    Replace the current buffer with a new buffer. This is a primitive\n    used by `remove`, which passes `null` for `newBuffer`, and `replaceWith`,\n    which passes the new buffer it created.\n\n    @private\n    @param {SC._RenderBuffer} buffer The buffer to insert in place of\n      the existing buffer.\n  */\n  replaceWithBuffer: function(newBuffer) {\n    var parent = get(this, 'parentBuffer');\n    var childBuffers = get(parent, 'childBuffers');\n\n    var index = childBuffers.indexOf(this);\n\n    if (newBuffer) {\n      childBuffers.splice(index, 1, newBuffer);\n    } else {\n      childBuffers.splice(index, 1);\n    }\n  },\n\n  /**\n    Creates a new SC.RenderBuffer object with the provided tagName as\n    the element tag and with its parentBuffer property set to the current\n    SC.RenderBuffer.\n\n    @param {String} tagName Tag name to use for the child buffer's element\n    @returns {SC.RenderBuffer} A new RenderBuffer object\n  */\n  begin: function(tagName) {\n    return this.newBuffer(tagName, this, function(buffer) {\n      get(this, 'childBuffers').pushObject(buffer);\n    });\n  },\n\n  /**\n    Prepend a new child buffer to the current render buffer.\n\n    @param {String} tagName Tag name to use for the child buffer's element\n  */\n  prepend: function(tagName) {\n    return this.newBuffer(tagName, this, function(buffer) {\n      get(this, 'childBuffers').insertAt(0, buffer);\n    });\n  },\n\n  /**\n    Replace the current buffer with a new render buffer.\n\n    @param {String} tagName Tag name to use for the new buffer's element\n  */\n  replaceWith: function(tagName) {\n    var parentBuffer = get(this, 'parentBuffer');\n\n    return this.newBuffer(tagName, parentBuffer, function(buffer) {\n      this.replaceWithBuffer(buffer);\n    });\n  },\n\n  /**\n    Insert a new render buffer after the current render buffer.\n\n    @param {String} tagName Tag name to use for the new buffer's element\n  */\n  insertAfter: function(tagName) {\n    var parentBuffer = get(this, 'parentBuffer');\n\n    return this.newBuffer(tagName, parentBuffer, function(buffer) {\n      var siblings = get(parentBuffer, 'childBuffers');\n      var index = siblings.indexOf(this);\n      siblings.insertAt(index + 1, buffer);\n    });\n  },\n\n  /**\n    Closes the current buffer and adds its content to the parentBuffer.\n\n    @returns {SC.RenderBuffer} The parentBuffer, if one exists. Otherwise, this\n  */\n  end: function() {\n    var parent = get(this, 'parentBuffer');\n    return parent || this;\n  },\n\n  remove: function() {\n    this.replaceWithBuffer(null);\n  },\n\n  /**\n    @returns {DOMElement} The element corresponding to the generated HTML\n      of this buffer\n  */\n  element: function() {\n    return SC.$(this.string())[0];\n  },\n\n  /**\n    Generates the HTML content for this buffer.\n\n    @returns {String} The generated HTMl\n  */\n  string: function() {\n    var id = get(this, 'elementId'),\n        classes = get(this, 'elementClasses'),\n        attrs = get(this, 'elementAttributes'),\n        style = get(this, 'elementStyle'),\n        tag = get(this, 'elementTag'),\n        content = '',\n        styleBuffer = [], prop;\n\n    var openTag = [\"<\" + tag];\n\n    if (id) { openTag.push('id=\"' + id + '\"'); }\n    if (classes.length) { openTag.push('class=\"' + classes.join(\" \") + '\"'); }\n\n    if (!jQuery.isEmptyObject(style)) {\n      for (prop in style) {\n        if (style.hasOwnProperty(prop)) {\n          styleBuffer.push(prop + ':' + style[prop] + ';');\n        }\n      }\n\n      openTag.push('style=\"' + styleBuffer.join(\"\") + '\"');\n    }\n\n    for (prop in attrs) {\n      if (attrs.hasOwnProperty(prop)) {\n        openTag.push(prop + '=\"' + attrs[prop] + '\"');\n      }\n    }\n\n    openTag = openTag.join(\" \") + '>';\n\n    var childBuffers = get(this, 'childBuffers');\n\n    childBuffers.forEach(function(buffer) {\n      var stringy = typeof buffer === 'string';\n      content = content + (stringy ? buffer : buffer.string());\n    });\n\n    return openTag + content + \"</\" + tag + \">\";\n  }\n\n});\n\n});");spade.register("sproutcore-views/views", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire(\"sproutcore-views/views/view\");\nrequire(\"sproutcore-views/views/states\");\nrequire(\"sproutcore-views/views/container_view\");\nrequire(\"sproutcore-views/views/collection_view\");\n\n});");spade.register("sproutcore-views/views/collection_view", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-views/views/container_view');\nrequire('sproutcore-runtime/system/string');\n\nvar get = SC.get, set = SC.set, fmt = SC.String.fmt;\n\n/**\n  @class\n  @since SproutCore 2.0\n  @extends SC.View\n*/\nSC.CollectionView = SC.ContainerView.extend(\n/** @scope SC.CollectionView.prototype */ {\n\n  /**\n    A list of items to be displayed by the SC.CollectionView.\n\n    @type SC.Array\n    @default null\n  */\n  content: null,\n\n  /**\n    An optional view to display if content is set to an empty array.\n\n    @type SC.View\n    @default null\n  */\n  emptyView: null,\n\n  /**\n    @type SC.View\n    @default SC.View\n  */\n  itemViewClass: SC.View,\n\n  init: function() {\n    var ret = this._super();\n    this._contentDidChange();\n    return ret;\n  },\n\n  _contentWillChange: function() {\n    var content = this.get('content');\n\n    if (content) { content.removeArrayObserver(this); }\n    var len = content ? get(content, 'length') : 0;\n    this.arrayWillChange(content, 0, len);\n  }.observesBefore('content'),\n\n  /**\n    @private\n\n    Check to make sure that the content has changed, and if so,\n    update the children directly. This is always scheduled\n    asynchronously, to allow the element to be created before\n    bindings have synchronized and vice versa.\n  */\n  _contentDidChange: function() {\n    var content = get(this, 'content');\n\n    if (content) {\n      sc_assert(fmt(\"an ArrayController's content must implement SC.Array. You passed %@\", [content]), content.addArrayObserver != null);\n      content.addArrayObserver(this);\n    }\n\n    var len = content ? get(content, 'length') : 0;\n    this.arrayDidChange(content, 0, null, len);\n  }.observes('content'),\n\n  destroy: function() {\n    var content = get(this, 'content');\n    if (content) { content.removeArrayObserver(this); }\n\n    this._super();\n\n    return this;\n  },\n\n  arrayWillChange: function(content, start, removedCount) {\n    // If the contents were empty before and this template collection has an\n    // empty view remove it now.\n    var emptyView = get(this, 'emptyView');\n    if (emptyView && emptyView instanceof SC.View) {\n      emptyView.removeFromParent();\n    }\n\n    // Loop through child views that correspond with the removed items.\n    // Note that we loop from the end of the array to the beginning because\n    // we are mutating it as we go.\n    var childViews = get(this, 'childViews'), childView, idx, len;\n\n    len = get(childViews, 'length');\n    for (idx = start + removedCount - 1; idx >= start; idx--) {\n      childViews[idx].destroy();\n    }\n  },\n\n  /**\n    Called when a mutation to the underlying content array occurs.\n\n    This method will replay that mutation against the views that compose the\n    SC.CollectionView, ensuring that the view reflects the model.\n\n    This array observer is added in contentDidChange.\n\n    @param {Array} addedObjects\n      the objects that were added to the content\n\n    @param {Array} removedObjects\n      the objects that were removed from the content\n\n    @param {Number} changeIndex\n      the index at which the changes occurred\n  */\n  arrayDidChange: function(content, start, removed, added) {\n    var itemViewClass = get(this, 'itemViewClass'),\n        childViews = get(this, 'childViews'),\n        addedViews = [], view, item, idx, len, itemTagName;\n\n    sc_assert(fmt(\"itemViewClass must be a subclass of SC.View, not %@\", [itemViewClass]), SC.View.detect(itemViewClass));\n\n    len = content ? get(content, 'length') : 0;\n    if (len) {\n      for (idx = start; idx < start+added; idx++) {\n        item = content.objectAt(idx);\n\n        view = this.createChildView(itemViewClass, {\n          content: item,\n          contentIndex: idx\n        });\n\n        addedViews.push(view);\n      }\n    } else {\n      var emptyView = get(this, 'emptyView');\n      if (!emptyView) { return; }\n\n      emptyView = this.createChildView(emptyView)\n      addedViews.push(emptyView);\n      set(this, 'emptyView', emptyView);\n    }\n\n    childViews.replace(start, 0, addedViews);\n  },\n\n  createChildView: function(view, attrs) {\n    var view = this._super(view, attrs);\n\n    var itemTagName = get(view, 'tagName');\n    var tagName = itemTagName || SC.CollectionView.CONTAINER_MAP[get(this, 'tagName')];\n\n    set(view, 'tagName', tagName || null);\n\n    return view;\n  }\n});\n\n/**\n  @static\n\n  A map of parent tags to their default child tags. You can add\n  additional parent tags if you want collection views that use\n  a particular parent tag to default to a child tag.\n\n  @type Hash\n  @constant\n*/\nSC.CollectionView.CONTAINER_MAP = {\n  ul: 'li',\n  ol: 'li',\n  table: 'tr',\n  thead: 'tr',\n  tbody: 'tr',\n  tfoot: 'tr',\n  tr: 'td',\n  select: 'option'\n};\n\n});");spade.register("sproutcore-views/views/container_view", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-views/views/view');\nvar get = SC.get, set = SC.set, meta = SC.meta;\n\nSC.ContainerView = SC.View.extend({\n  /**\n    Extends SC.View's implementation of renderToBuffer to\n    set up an array observer on the child views array. This\n    observer will detect when child views are added or removed\n    and update the DOM to reflect the mutation.\n\n    Note that we set up this array observer in the `renderToBuffer`\n    method because any views set up previously will be rendered the first\n    time the container is rendered.\n\n    @private\n  */\n  renderToBuffer: function() {\n    var ret = this._super.apply(this, arguments);\n\n    get(this, 'childViews').addArrayObserver(this, {\n      willChange: 'childViewsWillChange',\n      didChange: 'childViewsDidChange'\n    });\n\n    return ret;\n  },\n\n  /**\n    Instructs each child view to render to the passed render buffer.\n\n    @param {SC.RenderBuffer} buffer the buffer to render to\n    @private\n  */\n  render: function(buffer) {\n    this.forEachChildView(function(view) {\n      view.renderToBuffer(buffer);\n    });\n  },\n\n  /**\n    When the container view is destroyer, tear down the child views\n    array observer.\n\n    @private\n  */\n  destroy: function() {\n    get(this, 'childViews').removeArrayObserver(this, {\n      willChange: 'childViewsWillChange',\n      didChange: 'childViewsDidChange'\n    });\n\n    this._super();\n  },\n\n  /**\n    When a child view is removed, destroy its element so that\n    it is removed from the DOM.\n\n    The array observer that triggers this action is set up in the\n    `renderToBuffer` method.\n\n    @private\n    @param {SC.Array} views the child views array before mutation\n    @param {Number} start the start position of the mutation\n    @param {Number} removed the number of child views removed\n  **/\n  childViewsWillChange: function(views, start, removed) {\n    this.invokeForState('childViewsWillChange', views, start, removed);\n  },\n\n  /**\n    When a child view is added, make sure the DOM gets updated appropriately.\n\n    If the view has already rendered an element, we tell the child view to\n    create an element and insert it into the DOM. If the enclosing container view\n    has already written to a buffer, but not yet converted that buffer into an\n    element, we insert the string representation of the child into the appropriate\n    place in the buffer.\n\n    @private\n    @param {SC.Array} views the array of child views afte the mutation has occurred\n    @param {Number} start the start position of the mutation\n    @param {Number} removed the number of child views removed\n    @param {Number} the number of child views added\n  */\n  childViewsDidChange: function(views, start, removed, added) {\n    var len = get(views, 'length');\n\n    // No new child views were added; bail out.\n    if (added === 0) return;\n\n    // Let the current state handle the changes\n    this.invokeForState('childViewsDidChange', views, start, added);\n  },\n\n  /**\n    Schedules a child view to be inserted into the DOM after bindings have\n    finished syncing for this run loop.\n\n    @param {SC.View} view the child view to insert\n    @param {SC.View} prev the child view after which the specified view should\n                     be inserted\n    @private\n  */\n  _scheduleInsertion: function(view, prev) {\n    var parent = this;\n\n    view._insertElementLater(function() {\n      if (prev) {\n        prev.$().after(view.$());\n      } else {\n        parent.$().prepend(view.$());\n      }\n    });\n  }\n});\n\n// SC.ContainerView extends the default view states to provide different\n// behavior for childViewsWillChange and childViewsDidChange.\nSC.ContainerView.states = {\n  parent: SC.View.states,\n\n  \"default\": {},\n\n  inBuffer: {\n    childViewsDidChange: function(parentView, views, start, added) {\n      var buffer = meta(parentView)['SC.View'].buffer,\n          startWith, prev, prevBuffer, view;\n\n      // Determine where to begin inserting the child view(s) in the\n      // render buffer.\n      if (start === 0) {\n        // If views were inserted at the beginning, prepend the first\n        // view to the render buffer, then begin inserting any\n        // additional views at the beginning.\n        view = views[start];\n        startWith = start + 1;\n        view.renderToBuffer(buffer, 'prepend');\n      } else {\n        // Otherwise, just insert them at the same place as the child\n        // views mutation.\n        view = views[start - 1];\n        startWith = start;\n      }\n\n      for (var i=startWith; i<start+added; i++) {\n        prev = view;\n        view = views[i];\n        prevBuffer = meta(prev)['SC.View'].buffer;\n        view.renderToBuffer(prevBuffer, 'insertAfter');\n      }\n    }\n  },\n\n  inDOM: {\n    childViewsWillChange: function(view, views, start, removed) {\n      for (var i=start; i<start+removed; i++) {\n        views[i].destroyElement();\n      }\n    },\n\n    childViewsDidChange: function(view, views, start, added) {\n      // If the DOM element for this container view already exists,\n      // schedule each child view to insert its DOM representation after\n      // bindings have finished syncing.\n      prev = start === 0 ? null : views[start-1];\n\n      for (var i=start; i<start+added; i++) {\n        view = views[i];\n        this._scheduleInsertion(view, prev);\n        prev = view;\n      }\n    }\n  }\n};\n\nSC.ContainerView.reopen({\n  states: SC.ContainerView.states\n});\n\n});");spade.register("sproutcore-views/views/states", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire(\"sproutcore-views/views/states/default\");\nrequire(\"sproutcore-views/views/states/pre_render\");\nrequire(\"sproutcore-views/views/states/in_buffer\");\nrequire(\"sproutcore-views/views/states/in_dom\");\nrequire(\"sproutcore-views/views/states/destroyed\");\n\n});");spade.register("sproutcore-views/views/states/default", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-views/views/view');\n\nvar get = SC.get, set = SC.set;\n\nSC.View.states = {\n  \"default\": {\n    // appendChild is only legal while rendering the buffer.\n    appendChild: function() {\n      throw \"You can't use appendChild outside of the rendering process\";\n    },\n\n    $: function() {\n      return SC.$();\n    },\n\n    getElement: function() {\n      return null;\n    },\n\n    setElement: function(value) {\n      if (value) {\n        view.clearBuffer();\n        view.transitionTo('inDOM');\n      } else {\n        throw \"You can't set an element to null when the view has not yet been inserted into the DOM\";\n      }\n\n      return value;\n    }\n  }\n};\n\nSC.View.reopen({\n  states: SC.View.states\n});\n\n});");spade.register("sproutcore-views/views/states/destroyed", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-views/views/states/default');\n\nvar destroyedError = \"You can't call %@ on a destroyed view\", fmt = SC.String.fmt;\n\nSC.View.states.destroyed = {\n  appendChild: function() {\n    throw fmt(destroyedError, ['appendChild']);\n  },\n  rerender: function() {\n    throw fmt(destroyedError, ['rerender']);\n  },\n  destroyElement: function() {\n    throw fmt(destroyedError, ['destroyElement']);\n  },\n\n  setElement: function() {\n    throw fmt(destroyedError, [\"set('element', ...)\"]);\n  },\n\n  // Since element insertion is scheduled, don't do anything if\n  // the view has been destroyed between scheduling and execution\n  insertElement: SC.K\n};\n\n\n});");spade.register("sproutcore-views/views/states/in_buffer", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-views/views/states/default');\n\nvar get = SC.get, set = SC.set, meta = SC.meta;\n\nSC.View.states.inBuffer = {\n  $: function(view, sel) {\n    // if we don't have an element yet, someone calling this.$() is\n    // trying to update an element that isn't in the DOM. Instead,\n    // rerender the view to allow the render method to reflect the\n    // changes.\n    view.rerender();\n    return SC.$();\n  },\n\n  // when a view is rendered in a buffer, rerendering it simply\n  // replaces the existing buffer with a new one\n  rerender: function(view) {\n    var buffer = meta(view)['SC.View'].buffer;\n\n    view.clearRenderedChildren();\n    view.renderToBuffer(buffer, 'replaceWith');\n  },\n\n  // when a view is rendered in a buffer, appending a child\n  // view will render that view and append the resulting\n  // buffer into its buffer.\n  appendChild: function(view, childView, options) {\n    var buffer = meta(view)['SC.View'].buffer;\n\n    childView = this.createChildView(childView, options);\n    view.childViews.pushObject(childView);\n    childView.renderToBuffer(buffer);\n    return childView;\n  },\n\n  // when a view is rendered in a buffer, destroying the\n  // element will simply destroy the buffer and put the\n  // state back into the preRender state.\n  destroyElement: function(view) {\n    view.clearBuffer();\n    view._notifyWillDestroyElement();\n    view.transitionTo('preRender');\n\n    return view;\n  },\n\n  // It should be impossible for a rendered view to be scheduled for\n  // insertion.\n  insertElement: function() {\n    throw \"You can't insert an element that has already been rendered\";\n  },\n\n  setElement: function(view, value) {\n    view.invalidateRecursively('element');\n\n    if (value === null) {\n      view.transitionTo('preRender');\n    } else {\n      view.clearBuffer();\n      view.transitionTo('inDOM');\n    }\n\n    return value;\n  }\n};\n\n\n});");spade.register("sproutcore-views/views/states/in_dom", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-views/views/states/default');\n\nvar get = SC.get, set = SC.set, meta = SC.meta;\n\nSC.View.states.inDOM = {\n\n  $: function(view, sel) {\n    var elem = get(view, 'element');\n    return sel ? SC.$(sel, elem) : SC.$(elem);\n  },\n\n  getElement: function(view) {\n    var parent = get(view, 'parentView');\n    if (parent) { parent = get(parent, 'element'); }\n    if (parent) { return ret = view.findElementInParentElement(parent); }\n  },\n\n  setElement: function(view, value) {\n\n    if (value === null) {\n      view.invalidateRecursively('element');\n      view.transitionTo('preRender');\n    } else {\n      throw \"You cannot set an element to a non-null value when the element is already in the DOM.\"\n    }\n\n    return value;\n  },\n\n  // once the view has been inserted into the DOM, rerendering is\n  // deferred to allow bindings to synchronize.\n  rerender: function(view) {\n    var element = get(view, 'element');\n\n    view.clearRenderedChildren();\n    set(view, 'element', null);\n\n    view._insertElementLater(function() {\n      SC.$(element).replaceWith(get(view, 'element'));\n    });\n  },\n\n  // once the view is already in the DOM, destroying it removes it\n  // from the DOM, nukes its element, and puts it back into the\n  // preRender state.\n  destroyElement: function(view) {\n    var elem = get(this, 'element');\n\n    view.invokeRecursively(function(view) {\n      this.willDestroyElement();\n    });\n\n    set(view, 'element', null);\n\n    SC.$(elem).remove();\n    return view;\n  },\n\n  // You shouldn't insert an element into the DOM that was already\n  // inserted into the DOM.\n  insertElement: function() {\n    throw \"You can't insert an element into the DOM that has already been inserted\";\n  }\n};\n\n});");spade.register("sproutcore-views/views/states/pre_render", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-views/views/states/default');\n\nSC.View.states.preRender = {\n  // a view leaves the preRender state once its element has been\n  // created (createElement).\n  insertElement: function(view, fn) {\n    // If we don't have an element, guarantee that it exists before\n    // invoking the willInsertElement event.\n    view.createElement();\n\n    view._notifyWillInsertElement();\n    fn.call(view);\n    view._notifyDidInsertElement();\n  },\n\n  setElement: function(view, value) {\n    view.beginPropertyChanges();\n    view.invalidateRecursively('element');\n\n    if (value !== null) {\n      view.transitionTo('inDOM');\n    }\n\n    view.endPropertyChanges();\n\n    return value;\n  }\n}\n\n});");spade.register("sproutcore-views/views/view", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore - JavaScript Application Framework\n// Copyright: ©2006-2011 Strobe Inc. and contributors.\n//            Portions ©2008-2011 Apple Inc. All rights reserved.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals sc_assert */\n\n\nrequire(\"sproutcore-views/system/render_buffer\");\nvar get = SC.get, set = SC.set, addObserver = SC.addObserver;\nvar getPath = SC.getPath, meta = SC.meta, fmt = SC.String.fmt;\n\n/**\n  @static\n\n  Global hash of shared templates. This will automatically be populated\n  by the build tools so that you can store your Handlebars templates in\n  separate files that get loaded into JavaScript at buildtime.\n\n  @type Hash\n*/\nSC.TEMPLATES = {};\n\n/**\n  @class\n  @since SproutCore 2.0\n  @extends SC.Object\n*/\nSC.View = SC.Object.extend(\n/** @scope SC.View.prototype */ {\n\n  /** @private */\n  concatenatedProperties: ['classNames', 'classNameBindings', 'attributeBindings'],\n\n  /**\n    @type Boolean\n    @default YES\n    @constant\n  */\n  isView: YES,\n\n  // ..........................................................\n  // TEMPLATE SUPPORT\n  //\n\n  /**\n    The name of the template to lookup if no template is provided.\n\n    SC.View will look for a template with this name in this view's\n    `templates` object. By default, this will be a global object\n    shared in `SC.TEMPLATES`.\n\n    @type String\n    @default null\n  */\n  templateName: null,\n\n  /**\n    The hash in which to look for `templateName`.\n\n    @type SC.Object\n    @default SC.TEMPLATES\n  */\n  templates: SC.TEMPLATES,\n\n  /**\n    The template used to render the view. This should be a function that\n    accepts an optional context parameter and returns a string of HTML that\n    will be inserted into the DOM relative to its parent view.\n\n    In general, you should set the `templateName` property instead of setting\n    the template yourself.\n\n    @field\n    @type Function\n  */\n  template: function(key, value) {\n    if (value !== undefined) { return value; }\n\n    var templateName = get(this, 'templateName'), template;\n\n    if (templateName) { template = get(get(this, 'templates'), templateName); }\n\n    // If there is no template but a templateName has been specified,\n    // try to lookup as a spade module\n    if (!template && templateName) {\n      if ('undefined' !== require && require.exists) {\n        if (require.exists(templateName)) { template = require(templateName); }\n      }\n\n      if (!template) {\n        throw new SC.Error('%@ - Unable to find template \"%@\".'.fmt(this, templateName));\n      }\n    }\n\n    // return the template, or undefined if no template was found\n    return template || get(this, 'defaultTemplate');\n  }.property('templateName').cacheable(),\n\n  /**\n    The object from which templates should access properties.\n\n    This object will be passed to the template function each time the render\n    method is called, but it is up to the individual function to decide what\n    to do with it.\n\n    By default, this will be the view itself.\n\n    @type Object\n  */\n  templateContext: function(key, value) {\n    return value !== undefined ? value : this;\n  }.property().cacheable(),\n\n  /**\n    If the view is currently inserted into the DOM of a parent view, this\n    property will point to the parent of the view.\n\n    @type SC.View\n    @default null\n  */\n  parentView: null,\n\n  /**\n    If false, the view will appear hidden in DOM.\n\n    @type Boolean\n    @default true\n  */\n  isVisible: true,\n\n  /**\n    Array of child views. You should never edit this array directly.\n    Instead, use appendChild and removeFromParent.\n\n    @private\n    @type Array\n    @default []\n  */\n  childViews: [],\n\n  /**\n    Return the nearest ancestor that is an instance of the provided\n    class.\n\n    @param {Class} klass Subclass of SC.View (or SC.View itself)\n    @returns SC.View\n  */\n  nearestInstanceOf: function(klass) {\n    var view = this.parentView;\n\n    while (view) {\n      if(view instanceof klass) { return view; }\n      view = view.parentView;\n    }\n  },\n\n  /**\n    Return the nearest ancestor that has a given property.\n\n    @param {String} property A property name\n    @returns SC.View\n  */\n  nearestWithProperty: function(property) {\n    var view = this.parentView;\n\n    while (view) {\n      if (property in view) { return view; }\n      view = view.parentView;\n    }\n  },\n\n  /**\n    Return the nearest ancestor that is a direct child of a\n    view of.\n\n    @param {Class} klass Subclass of SC.View (or SC.View itself)\n    @returns SC.View\n  */\n  nearestChildOf: function(klass) {\n    var view = this.parentView;\n\n    while (view) {\n      if(view.parentView instanceof klass) { return view; }\n      view = view.parentView;\n    }\n  },\n\n  /**\n    Return the nearest ancestor that is an SC.CollectionView\n\n    @returns SC.CollectionView\n  */\n  collectionView: function() {\n    return this.nearestInstanceOf(SC.CollectionView);\n  }.property().cacheable(),\n\n  /**\n    Return the nearest ancestor that is a direct child of\n    an SC.CollectionView\n\n    @returns SC.View\n  */\n  itemView: function() {\n    return this.nearestChildOf(SC.CollectionView);\n  }.property().cacheable(),\n\n  /**\n    Return the nearest ancestor that has the property\n    `content`.\n\n    @returns SC.View\n  */\n  contentView: function() {\n    return this.nearestWithProperty('content');\n  }.property().cacheable(),\n\n  /**\n    @private\n\n    When the parent view changes, recursively invalidate\n    collectionView, itemView, and contentView\n  */\n  _parentViewDidChange: function() {\n    this.invokeRecursively(function(view) {\n      view.propertyDidChange('collectionView');\n      view.propertyDidChange('itemView');\n      view.propertyDidChange('contentView');\n    });\n  }.observes('parentView'),\n\n  /**\n    Called on your view when it should push strings of HTML into a\n    SC.RenderBuffer. Most users will want to override the `template`\n    or `templateName` properties instead of this method.\n\n    By default, SC.View will look for a function in the `template`\n    property and invoke it with the value of `templateContext`. The value of\n    `templateContext` will be the view itself unless you override it.\n\n    @param {SC.RenderBuffer} buffer The render buffer\n  */\n  render: function(buffer) {\n    var template = get(this, 'template');\n\n    if (template) {\n      var context = get(this, 'templateContext'),\n          data = { view: this, buffer: buffer, isRenderData: true };\n\n      // Invoke the template with the provided template context, which\n      // is the view by default. A hash of data is also passed that provides\n      // the template with access to the view and render buffer.\n\n      // The template should write directly to the render buffer instead\n      // of returning a string.\n      var output = template(context, { data: data });\n\n      // If the template returned a string instead of writing to the buffer,\n      // push the string onto the buffer.\n      if (output !== undefined) { buffer.push(output); }\n    }\n  },\n\n  invokeForState: function(name) {\n    var parent = this, states = parent.states;\n\n    while (states) {\n      var stateName = get(this, 'state'),\n          state     = states[stateName];\n\n      if (state) {\n        var fn = state[name] || states[\"default\"][name];\n\n        if (fn) {\n          var args = Array.prototype.slice.call(arguments, 1);\n          args.unshift(this);\n\n          return fn.apply(this, args);\n        }\n      }\n\n      states = states.parent;\n    }\n  },\n\n  /**\n    Renders the view again. This will work regardless of whether the\n    view is already in the DOM or not. If the view is in the DOM, the\n    rendering process will be deferred to give bindings a chance\n    to synchronize.\n\n    If children were added during the rendering process using `appendChild`,\n    `rerender` will remove them, because they will be added again\n    if needed by the next `render`.\n\n    In general, if the display of your view changes, you should modify\n    the DOM element directly instead of manually calling `rerender`, which can\n    be slow.\n  */\n  rerender: function() {\n    return this.invokeForState('rerender');\n  },\n\n  clearRenderedChildren: function() {\n    var viewMeta = meta(this)['SC.View'],\n        lengthBefore = viewMeta.lengthBeforeRender,\n        lengthAfter  = viewMeta.lengthAfterRender;\n\n    // If there were child views created during the last call to render(),\n    // remove them under the assumption that they will be re-created when\n    // we re-render.\n\n    // VIEW-TODO: Unit test this path.\n    var childViews = get(this, 'childViews');\n    for (var i=lengthAfter-1; i>=lengthBefore; i--) {\n      childViews[i] && childViews[i].destroy();\n    }\n  },\n\n  /**\n    @private\n\n    Iterates over the view's `classNameBindings` array, inserts the value\n    of the specified property into the `classNames` array, then creates an\n    observer to update the view's element if the bound property ever changes\n    in the future.\n  */\n  _applyClassNameBindings: function() {\n    var classBindings = get(this, 'classNameBindings'),\n        classNames = get(this, 'classNames'),\n        elem, newClass, dasherizedClass;\n\n    if (!classBindings) { return; }\n\n    // Loop through all of the configured bindings. These will be either\n    // property names ('isUrgent') or property paths relative to the view\n    // ('content.isUrgent')\n    classBindings.forEach(function(binding) {\n\n      // Variable in which the old class value is saved. The observer function\n      // closes over this variable, so it knows which string to remove when\n      // the property changes.\n      var oldClass, property;\n\n      // Set up an observer on the context. If the property changes, toggle the\n      // class name.\n      var observer = function() {\n        // Get the current value of the property\n        newClass = this._classStringForProperty(binding);\n        elem = this.$();\n\n        // If we had previously added a class to the element, remove it.\n        if (oldClass) {\n          elem.removeClass(oldClass);\n        }\n\n        // If necessary, add a new class. Make sure we keep track of it so\n        // it can be removed in the future.\n        if (newClass) {\n          elem.addClass(newClass);\n          oldClass = newClass;\n        } else {\n          oldClass = null;\n        }\n      };\n\n      // Get the class name for the property at its current value\n      dasherizedClass = this._classStringForProperty(binding);\n\n      if (dasherizedClass) {\n        // Ensure that it gets into the classNames array\n        // so it is displayed when we render.\n        classNames.push(dasherizedClass);\n\n        // Save a reference to the class name so we can remove it\n        // if the observer fires. Remember that this variable has\n        // been closed over by the observer.\n        oldClass = dasherizedClass;\n      }\n\n      // Extract just the property name from bindings like 'foo:bar'\n      property = binding.split(':')[0];\n      addObserver(this, property, observer);\n    }, this);\n  },\n\n  /**\n    Iterates through the view's attribute bindings, sets up observers for each,\n    then applies the current value of the attributes to the passed render buffer.\n\n    @param {SC.RenderBuffer} buffer\n  */\n  _applyAttributeBindings: function(buffer) {\n    var attributeBindings = get(this, 'attributeBindings'),\n        attributeValue, elem, type;\n\n    if (!attributeBindings) { return; }\n\n    attributeBindings.forEach(function(attribute) {\n      // Create an observer to add/remove/change the attribute if the\n      // JavaScript property changes.\n      var observer = function() {\n        elem = this.$();\n        var currentValue = elem.attr(attribute);\n        attributeValue = get(this, attribute);\n\n        type = typeof attributeValue;\n\n        if ((type === 'string' || type === 'number') && attributeValue !== currentValue) {\n          elem.attr(attribute, attributeValue);\n        } else if (attributeValue && type === 'boolean') {\n          elem.attr(attribute, attribute);\n        } else if (attributeValue === NO) {\n          elem.removeAttr(attribute);\n        }\n      };\n\n      addObserver(this, attribute, observer);\n\n      // Determine the current value and add it to the render buffer\n      // if necessary.\n      attributeValue = get(this, attribute);\n      type = typeof attributeValue;\n\n      if (type === 'string' || type === 'number') {\n        buffer.attr(attribute, attributeValue);\n      } else if (attributeValue && type === 'boolean') {\n        // Apply boolean attributes in the form attribute=\"attribute\"\n        buffer.attr(attribute, attribute);\n      }\n    }, this);\n  },\n\n  /**\n    @private\n\n    Given a property name, returns a dasherized version of that\n    property name if the property evaluates to a non-falsy value.\n\n    For example, if the view has property `isUrgent` that evaluates to true,\n    passing `isUrgent` to this method will return `\"is-urgent\"`.\n  */\n  _classStringForProperty: function(property) {\n    var split = property.split(':'), className = split[1];\n    property = split[0];\n\n    var val = SC.getPath(this, property);\n\n    // If value is a Boolean and true, return the dasherized property\n    // name.\n    if (val === YES) {\n      if (className) { return className; }\n\n      // Normalize property path to be suitable for use\n      // as a class name. For exaple, content.foo.barBaz\n      // becomes bar-baz.\n      return SC.String.dasherize(get(property.split('.'), 'lastObject'));\n\n    // If the value is not NO, undefined, or null, return the current\n    // value of the property.\n    } else if (val !== NO && val !== undefined && val !== null) {\n      return val;\n\n    // Nothing to display. Return null so that the old class is removed\n    // but no new class is added.\n    } else {\n      return null;\n    }\n  },\n\n  // ..........................................................\n  // ELEMENT SUPPORT\n  //\n\n  /**\n    Returns the current DOM element for the view.\n\n    @field\n    @type DOMElement\n  */\n  element: function(key, value) {\n    if (value !== undefined) {\n      return this.invokeForState('setElement', value);\n    } else {\n      return this.invokeForState('getElement');\n    }\n  }.property('parentView', 'state').cacheable(),\n\n  /**\n    Returns a jQuery object for this view's element. If you pass in a selector\n    string, this method will return a jQuery object, using the current element\n    as its buffer.\n\n    For example, calling `view.$('li')` will return a jQuery object containing\n    all of the `li` elements inside the DOM element of this view.\n\n    @param {String} [selector] a jQuery-compatible selector string\n    @returns {SC.CoreQuery} the CoreQuery object for the DOM node\n  */\n  $: function(sel) {\n    return this.invokeForState('$', sel);\n  },\n\n  /** @private */\n  mutateChildViews: function(callback) {\n    var childViews = get(this, 'childViews'),\n        idx = get(childViews, 'length'),\n        view;\n\n    while(--idx >= 0) {\n      view = childViews[idx];\n      callback.call(this, view, idx);\n    }\n\n    return this;\n  },\n\n  /** @private */\n  forEachChildView: function(callback) {\n    var childViews = get(this, 'childViews'),\n        len = get(childViews, 'length'),\n        view, idx;\n\n    for(idx = 0; idx < len; idx++) {\n      view = childViews[idx];\n      callback.call(this, view);\n    }\n\n    return this;\n  },\n\n  /**\n    Appends the view's element to the specified parent element.\n\n    If the view does not have an HTML representation yet, `createElement()`\n    will be called automatically.\n\n    Note that this method just schedules the view to be appended; the DOM\n    element will not be appended to the given element until all bindings have\n    finished synchronizing.\n\n    @param {String|DOMElement|jQuery} A selector, element, HTML string, or jQuery object\n    @returns {SC.View} receiver\n  */\n  appendTo: function(target) {\n    // Schedule the DOM element to be created and appended to the given\n    // element after bindings have synchronized.\n    this._insertElementLater(function() {\n      this.$().appendTo(target);\n    });\n\n    return this;\n  },\n\n  /**\n    @private\n\n    Schedules a DOM operation to occur during the next render phase. This\n    ensures that all bindings have finished synchronizing before the view is\n    rendered.\n\n    To use, pass a function that performs a DOM operation..\n\n    Before your function is called, this view and all child views will receive\n    the `willInsertElement` event. After your function is invoked, this view\n    and all of its child views will receive the `didInsertElement` event.\n\n        view._insertElementLater(function() {\n          this.createElement();\n          this.$().appendTo('body');\n        });\n\n    @param {Function} fn the function that inserts the element into the DOM\n  */\n  _insertElementLater: function(fn) {\n    SC.run.schedule('render', this, 'invokeForState', 'insertElement', fn);\n  },\n\n  /**\n    Appends the view's element to the document body. If the view does\n    not have an HTML representation yet, `createElement()` will be called\n    automatically.\n\n    Note that this method just schedules the view to be appended; the DOM\n    element will not be appended to the document body until all bindings have\n    finished synchronizing.\n\n    @returns {SC.View} receiver\n  */\n  append: function() {\n    return this.appendTo(document.body);\n  },\n\n  /**\n    Removes the view's element from the element to which it is attached.\n\n    @returns {SC.View} receiver\n  */\n  remove: function() {\n    // What we should really do here is wait until the end of the run loop\n    // to determine if the element has been re-appended to a different\n    // element.\n    // In the interim, we will just re-render if that happens. It is more\n    // important than elements get garbage collected.\n    this.destroyElement();\n  },\n\n  /**\n    The ID to use when trying to locate the element in the DOM. If you do not\n    set the elementId explicitly, then the view's GUID will be used instead.\n    This ID must be set at the time the view is created.\n\n    @type String\n    @readOnly\n  */\n  elementId: function(key, value) {\n    return value !== undefined ? value : SC.guidFor(this);\n  }.property().cacheable(),\n\n  /**\n    Attempts to discover the element in the parent element. The default\n    implementation looks for an element with an ID of elementId (or the view's\n    guid if elementId is null). You can override this method to provide your\n    own form of lookup. For example, if you want to discover your element\n    using a CSS class name instead of an ID.\n\n    @param {DOMElement} parentElement The parent's DOM element\n    @returns {DOMElement} The discovered element\n  */\n  findElementInParentElement: function(parentElem) {\n    var id = \"#\" + get(this, 'elementId');\n    return jQuery(id)[0] || jQuery(id, parentElem)[0];\n  },\n\n  /**\n    Creates a new renderBuffer with the passed tagName. You can override this\n    method to provide further customization to the buffer if needed. Normally\n    you will not need to call or override this method.\n\n    @returns {SC.RenderBuffer}\n  */\n  renderBuffer: function(tagName) {\n    return SC.RenderBuffer(tagName || get(this, 'tagName') || 'div');\n  },\n\n  /**\n    Creates a DOM representation of the view and all of its\n    child views by recursively calling the `render()` method.\n\n    After the element has been created, `didCreateElement` will\n    be called on this view and all of its child views.\n\n    @returns {SC.View} receiver\n  */\n  createElement: function() {\n    if (get(this, 'element')) { return this; }\n\n    var buffer = this.renderToBuffer();\n    set(this, 'element', buffer.element());\n\n    return this;\n  },\n\n  /**\n    Called when the element of the view is created but before it is inserted\n    into the DOM.  Override this function to do any set up that requires an\n    element.\n  */\n  willInsertElement: SC.K,\n\n  /**\n    Called when the element of the view has been inserted into the DOM.\n    Override this function to do any set up that requires an element in the\n    document body.\n  */\n  didInsertElement: SC.K,\n\n  /**\n    Run this callback on the current view and recursively on child views.\n\n    @private\n  */\n  invokeRecursively: function(fn) {\n    fn.call(this, this);\n\n    this.forEachChildView(function(view) {\n      view.invokeRecursively(fn);\n    });\n  },\n\n  /**\n    Invalidates the cache for a property on all child views.\n  */\n  invalidateRecursively: function(key) {\n    this.forEachChildView(function(view) {\n      view.propertyDidChange(key);\n    });\n  },\n\n  /**\n    @private\n\n    Invokes the receiver's willInsertElement() method if it exists and then\n    invokes the same on all child views.\n  */\n  _notifyWillInsertElement: function() {\n    this.invokeRecursively(function(view) {\n      view.willInsertElement();\n    });\n  },\n\n  /**\n    @private\n\n    Invokes the receiver's didInsertElement() method if it exists and then\n    invokes the same on all child views.\n  */\n  _notifyDidInsertElement: function() {\n    this.invokeRecursively(function(view) {\n      view.didInsertElement();\n    });\n  },\n\n  /**\n    Destroys any existing element along with the element for any child views\n    as well. If the view does not currently have a element, then this method\n    will do nothing.\n\n    If you implement willDestroyElement() on your view, then this method will\n    be invoked on your view before your element is destroyed to give you a\n    chance to clean up any event handlers, etc.\n\n    If you write a willDestroyElement() handler, you can assume that your\n    didCreateElement() handler was called earlier for the same element.\n\n    Normally you will not call or override this method yourself, but you may\n    want to implement the above callbacks when it is run.\n\n    @returns {SC.View} receiver\n  */\n  destroyElement: function() {\n    return this.invokeForState('destroyElement');\n  },\n\n  /**\n    Called when the element of the view is going to be destroyed. Override\n    this function to do any teardown that requires an element, like removing\n    event listeners.\n  */\n  willDestroyElement: function() {},\n\n  /**\n    @private\n\n    Invokes the `willDestroyElement` callback on the view and child views.\n  */\n  _notifyWillDestroyElement: function() {\n    this.invokeRecursively(function(view) {\n      view.willDestroyElement();\n    });\n  },\n\n  /** @private (nodoc) */\n  _elementWillChange: function() {\n    this.forEachChildView(function(view) {\n      SC.propertyWillChange(view, 'element');\n    });\n  }.observesBefore('element'),\n\n  /**\n    @private\n\n    If this view's element changes, we need to invalidate the caches of our\n    child views so that we do not retain references to DOM elements that are\n    no longer needed.\n\n    @observes element\n  */\n  _elementDidChange: function() {\n    this.forEachChildView(function(view) {\n      SC.propertyDidChange(view, 'element');\n    });\n  }.observes('element'),\n\n  /**\n    Called when the parentView property has changed.\n\n    @function\n  */\n  parentViewDidChange: SC.K,\n\n  /**\n    @private\n\n    Invoked by the view system when this view needs to produce an HTML\n    representation. This method will create a new render buffer, if needed,\n    then apply any default attributes, such as class names and visibility.\n    Finally, the `render()` method is invoked, which is responsible for\n    doing the bulk of the rendering.\n\n    You should not need to override this method; instead, implement the\n    `template` property, or if you need more control, override the `render`\n    method.\n\n    @param {SC.RenderBuffer} buffer the render buffer. If no buffer is\n      passed, a default buffer, using the current view's `tagName`, will\n      be used.\n  */\n  renderToBuffer: function(parentBuffer, bufferOperation) {\n    var viewMeta = meta(this)['SC.View'];\n    var buffer;\n\n    SC.run.sync();\n\n    // Determine where in the parent buffer to start the new buffer.\n    // By default, a new buffer will be appended to the parent buffer.\n    // The buffer operation may be changed if the child views array is\n    // mutated by SC.ContainerView.\n    bufferOperation = bufferOperation || 'begin';\n\n    // If this is the top-most view, start a new buffer. Otherwise,\n    // create a new buffer relative to the original using the\n    // provided buffer operation (for example, `insertAfter` will\n    // insert a new buffer after the \"parent buffer\").\n    if (parentBuffer) {\n      buffer = parentBuffer[bufferOperation](get(this, 'tagName') || 'div');\n    } else {\n      buffer = this.renderBuffer();\n    }\n\n    viewMeta.buffer = buffer;\n    this.transitionTo('inBuffer');\n\n    viewMeta.lengthBeforeRender = getPath(this, 'childViews.length');\n\n    this.applyAttributesToBuffer(buffer);\n    this.render(buffer);\n\n    viewMeta.lengthAfterRender = getPath(this, 'childViews.length');\n\n    return buffer;\n  },\n\n  /**\n    @private\n  */\n  applyAttributesToBuffer: function(buffer) {\n    // Creates observers for all registered class name and attribute bindings,\n    // then adds them to the element.\n    this._applyClassNameBindings();\n\n    // Pass the render buffer so the method can apply attributes directly.\n    // This isn't needed for class name bindings because they use the\n    // existing classNames infrastructure.\n    this._applyAttributeBindings(buffer);\n\n\n    buffer.addClass(get(this, 'classNames').join(' '));\n    buffer.id(get(this, 'elementId'));\n\n    var role = get(this, 'ariaRole');\n    if (role) {\n      buffer.attr('role', role);\n    }\n\n    if (!get(this, 'isVisible')) {\n      buffer.style('display', 'none');\n    }\n  },\n\n  // ..........................................................\n  // STANDARD RENDER PROPERTIES\n  //\n\n  /**\n    Tag name for the view's outer element. The tag name is only used when\n    an element is first created. If you change the tagName for an element, you\n    must destroy and recreate the view element.\n\n    By default, the render buffer will use a `<div>` tag for views.\n\n    @type String\n    @default null\n  */\n\n  // We leave this null by default so we can tell the difference between\n  // the default case and a user-specified tag.\n  tagName: null,\n\n  /**\n    The WAI-ARIA role of the control represented by this view. For example, a\n    button may have a role of type 'button', or a pane may have a role of\n    type 'alertdialog'. This property is used by assistive software to help\n    visually challenged users navigate rich web applications.\n\n    The full list of valid WAI-ARIA roles is available at:\n    http://www.w3.org/TR/wai-aria/roles#roles_categorization\n\n    @type String\n    @default null\n  */\n  ariaRole: null,\n\n  /**\n    Standard CSS class names to apply to the view's outer element. This\n    property automatically inherits any class names defined by the view's\n    superclasses as well.\n\n    @type Array\n    @default ['sc-view']\n  */\n  classNames: ['sc-view'],\n\n  /**\n    A list of properties of the view to apply as class names. If the property\n    is a string value, the value of that string will be applied as a class\n    name.\n\n        // Applies the 'high' class to the view element\n        SC.View.create({\n          classNameBindings: ['priority']\n          priority: 'high'\n        });\n\n    If the value of the property is a Boolean, the name of that property is\n    added as a dasherized class name.\n\n        // Applies the 'is-urgent' class to the view element\n        SC.View.create({\n          classNameBindings: ['isUrgent']\n          isUrgent: true\n        });\n\n    If you would prefer to use a custom value instead of the dasherized\n    property name, you can pass a binding like this:\n\n        // Applies the 'urgent' class to the view element\n        SC.View.create({\n          classNameBindings: ['isUrgent:urgent']\n          isUrgent: true\n        });\n\n    This list of properties is inherited from the view's superclasses as well.\n\n    @type Array\n    @default []\n  */\n  classNameBindings: [],\n\n  /**\n    A list of properties of the view to apply as attributes. If the property is\n    a string value, the value of that string will be applied as the attribute.\n\n        // Applies the type attribute to the element\n        // with the value \"button\", like <div type=\"button\">\n        SC.View.create({\n          attributeBindings: ['type'],\n          type: 'button'\n        });\n\n    If the value of the property is a Boolean, the name of that property is\n    added as an attribute.\n\n        // Renders something like <div enabled=\"enabled\">\n        SC.View.create({\n          attributeBindings: ['enabled'],\n          enabled: true\n        });\n  */\n  attributeBindings: [],\n\n  // .......................................................\n  // CORE DISPLAY METHODS\n  //\n\n  /**\n    @private\n\n    Setup a view, but do not finish waking it up.\n    - configure childViews\n    - register the view with the global views hash, which is used for event\n      dispatch\n  */\n  init: function() {\n    set(this, 'state', 'preRender');\n\n    var parentView = get(this, 'parentView');\n\n    this._super();\n\n    // Register the view for event handling. This hash is used by\n    // SC.RootResponder to dispatch incoming events.\n    SC.View.views[get(this, 'elementId')] = this;\n\n    var childViews = get(this, 'childViews').slice();\n    // setup child views. be sure to clone the child views array first\n    set(this, 'childViews', childViews);\n\n    this.mutateChildViews(function(viewName, idx) {\n      var view;\n\n      if ('string' === typeof viewName) {\n        view = get(this, viewName);\n        view = this.createChildView(view);\n        childViews[idx] = view;\n        set(this, viewName, view);\n      } else if (viewName.isClass) {\n        view = this.createChildView(viewName);\n        childViews[idx] = view;\n      }\n    });\n\n    this.classNameBindings = get(this, 'classNameBindings').slice();\n    this.classNames = get(this, 'classNames').slice();\n\n    meta(this)[\"SC.View\"] = {};\n  },\n\n  appendChild: function(view, options) {\n    return this.invokeForState('appendChild', view, options);\n  },\n\n  /**\n    Removes the child view from the parent view.\n\n    @param {SC.View} view\n    @returns {SC.View} receiver\n  */\n  removeChild: function(view) {\n    // update parent node\n    set(view, 'parentView', null);\n\n    // remove view from childViews array.\n    var childViews = get(this, 'childViews');\n    childViews.removeObject(view);\n\n    return this;\n  },\n\n  /**\n    Removes all children from the parentView.\n\n    @returns {SC.View} receiver\n  */\n  removeAllChildren: function() {\n    return this.mutateChildViews(function(view) {\n      this.removeChild(view);\n    });\n  },\n\n  destroyAllChildren: function() {\n    return this.mutateChildViews(function(view) {\n      view.destroy();\n    });\n  },\n\n  /**\n    Removes the view from its parentView, if one is found. Otherwise\n    does nothing.\n\n    @returns {SC.View} receiver\n  */\n  removeFromParent: function() {\n    var parent = get(this, 'parentView');\n\n    // Remove DOM element from parent\n    this.remove();\n\n    if (parent) { parent.removeChild(this); }\n    return this;\n  },\n\n  /**\n    You must call this method on a view to destroy the view (and all of its\n    child views). This will remove the view from any parent node, then make\n    sure that the DOM element managed by the view can be released by the\n    memory manager.\n  */\n  destroy: function() {\n    if (get(this, 'isDestroyed')) { return; }\n\n    // calling this._super() will nuke computed properties and observers,\n    // so collect any information we need before calling super.\n    var viewMeta   = meta(this)['SC.View'],\n        childViews = get(this, 'childViews'),\n        parent     = get(this, 'parentView'),\n        elementId  = get(this, 'elementId'),\n        childLen   = childViews.length;\n\n    // destroy the element -- this will avoid each child view destroying\n    // the element over and over again...\n    this.destroyElement();\n\n    // remove from parent if found. Don't call removeFromParent,\n    // as removeFromParent will try to remove the element from\n    // the DOM again.\n    if (parent) { parent.removeChild(this); }\n    SC.Descriptor.setup(this, 'state', 'destroyed');\n\n    this._super();\n\n    for (var i=childLen-1; i>=0; i--) {\n      childViews[i].destroy();\n    }\n\n    // next remove view from global hash\n    delete SC.View.views[get(this, 'elementId')];\n\n    return this; // done with cleanup\n  },\n\n  /**\n    Instantiates a view to be added to the childViews array during view\n    initialization. You generally will not call this method directly unless\n    you are overriding createChildViews(). Note that this method will\n    automatically configure the correct settings on the new view instance to\n    act as a child of the parent.\n\n    @param {Class} viewClass\n    @param {Hash} [attrs] Attributes to add\n    @returns {SC.View} new instance\n    @test in createChildViews\n  */\n  createChildView: function(view, attrs) {\n    if (SC.View.detect(view)) {\n      view = view.create(attrs || {}, { parentView: this });\n    } else {\n      sc_assert('must pass instance of View', view instanceof SC.View);\n      set(view, 'parentView', this);\n    }\n    return view;\n  },\n\n  /**\n    @private\n\n    When the view's `isVisible` property changes, toggle the visibility\n    element of the actual DOM element.\n  */\n  _isVisibleDidChange: function() {\n    this.$().toggle(get(this, 'isVisible'));\n  }.observes('isVisible'),\n\n  clearBuffer: function() {\n    this.invokeRecursively(function(view) {\n      meta(view)['SC.View'].buffer = null;\n    });\n  },\n\n  transitionTo: function(state, children) {\n    set(this, 'state', state);\n\n    if (children !== false) {\n      this.forEachChildView(function(view) {\n        view.transitionTo(state);\n      });\n    }\n  }\n\n});\n\n/**\n  Describe how the specified actions should behave in the various\n  states that a view can exist in. Possible states:\n\n  * preRender: when a view is first instantiated, and after its\n    element was destroyed, it is in the preRender state\n  * inBuffer: once a view has been rendered, but before it has\n    been inserted into the DOM, it is in the inBuffer state\n  * inDOM: once a view has been inserted into the DOM it is in\n    the inDOM state. A view spends the vast majority of its\n    existence in this state.\n  * destroyed: once a view has been destroyed (using the destroy\n    method), it is in this state. No further actions can be invoked\n    on a destroyed view.\n*/\n\n  // in the destroyed state, everything is illegal\n\n  // before rendering has begun, all legal manipulations are noops.\n\n  // inside the buffer, legal manipulations are done on the buffer\n\n  // once the view has been inserted into the DOM, legal manipulations\n  // are done on the DOM element.\n\nSC.View.reopen({\n  states: SC.View.states\n});\n\n// Create a global view hash.\nSC.View.views = {};\n\n\n});");// lib/handlebars/base.js
var Handlebars = {};

window.Handlebars = Handlebars;

Handlebars.VERSION = "1.0.beta.2";

Handlebars.helpers  = {};
Handlebars.partials = {};

Handlebars.registerHelper = function(name, fn, inverse) {
  if(inverse) { fn.not = inverse; }
  this.helpers[name] = fn;
};

Handlebars.registerPartial = function(name, str) {
  this.partials[name] = str;
};

Handlebars.registerHelper('helperMissing', function(arg) {
  if(arguments.length === 2) {
    return undefined;
  } else {
    throw new Error("Could not find property '" + arg + "'");
  }
});

Handlebars.registerHelper('blockHelperMissing', function(context, options) {
  var inverse = options.inverse || function() {}, fn = options.fn;


  var ret = "";
  var type = Object.prototype.toString.call(context);

  if(type === "[object Function]") {
    context = context();
  }

  if(context === true) {
    return fn(this);
  } else if(context === false || context == null) {
    return inverse(this);
  } else if(type === "[object Array]") {
    if(context.length > 0) {
      for(var i=0, j=context.length; i<j; i++) {
        ret = ret + fn(context[i]);
      }
    } else {
      ret = inverse(this);
    }
    return ret;
  } else {
    return fn(context);
  }
});

Handlebars.registerHelper('each', function(context, options) {
  var fn = options.fn, inverse = options.inverse;
  var ret = "";

  if(context && context.length > 0) {
    for(var i=0, j=context.length; i<j; i++) {
      ret = ret + fn(context[i]);
    }
  } else {
    ret = inverse(this);
  }
  return ret;
});

Handlebars.registerHelper('if', function(context, options) {
  if(!context || Handlebars.Utils.isEmpty(context)) {
    return options.inverse(this);
  } else {
    return options.fn(this);
  }
});

Handlebars.registerHelper('unless', function(context, options) {
  var fn = options.fn, inverse = options.inverse;
  options.fn = inverse;
  options.inverse = fn;

  return Handlebars.helpers['if'].call(this, context, options);
});

Handlebars.registerHelper('with', function(context, options) {
  return options.fn(context);
});
;
// lib/handlebars/compiler/parser.js
/* Jison generated parser */
var handlebars = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"root":3,"program":4,"EOF":5,"statements":6,"simpleInverse":7,"statement":8,"openInverse":9,"closeBlock":10,"openBlock":11,"mustache":12,"partial":13,"CONTENT":14,"COMMENT":15,"OPEN_BLOCK":16,"inMustache":17,"CLOSE":18,"OPEN_INVERSE":19,"OPEN_ENDBLOCK":20,"path":21,"OPEN":22,"OPEN_UNESCAPED":23,"OPEN_PARTIAL":24,"params":25,"hash":26,"param":27,"STRING":28,"INTEGER":29,"BOOLEAN":30,"hashSegments":31,"hashSegment":32,"ID":33,"EQUALS":34,"pathSegments":35,"SEP":36,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",14:"CONTENT",15:"COMMENT",16:"OPEN_BLOCK",18:"CLOSE",19:"OPEN_INVERSE",20:"OPEN_ENDBLOCK",22:"OPEN",23:"OPEN_UNESCAPED",24:"OPEN_PARTIAL",28:"STRING",29:"INTEGER",30:"BOOLEAN",33:"ID",34:"EQUALS",36:"SEP"},
productions_: [0,[3,2],[4,3],[4,1],[4,0],[6,1],[6,2],[8,3],[8,3],[8,1],[8,1],[8,1],[8,1],[11,3],[9,3],[10,3],[12,3],[12,3],[13,3],[13,4],[7,2],[17,3],[17,2],[17,2],[17,1],[25,2],[25,1],[27,1],[27,1],[27,1],[27,1],[26,1],[31,2],[31,1],[32,3],[32,3],[32,3],[32,3],[21,1],[35,3],[35,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: return $$[$0-1] 
break;
case 2: this.$ = new yy.ProgramNode($$[$0-2], $$[$0]) 
break;
case 3: this.$ = new yy.ProgramNode($$[$0]) 
break;
case 4: this.$ = new yy.ProgramNode([]) 
break;
case 5: this.$ = [$$[$0]] 
break;
case 6: $$[$0-1].push($$[$0]); this.$ = $$[$0-1] 
break;
case 7: this.$ = new yy.InverseNode($$[$0-2], $$[$0-1], $$[$0]) 
break;
case 8: this.$ = new yy.BlockNode($$[$0-2], $$[$0-1], $$[$0]) 
break;
case 9: this.$ = $$[$0] 
break;
case 10: this.$ = $$[$0] 
break;
case 11: this.$ = new yy.ContentNode($$[$0]) 
break;
case 12: this.$ = new yy.CommentNode($$[$0]) 
break;
case 13: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]) 
break;
case 14: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]) 
break;
case 15: this.$ = $$[$0-1] 
break;
case 16: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]) 
break;
case 17: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1], true) 
break;
case 18: this.$ = new yy.PartialNode($$[$0-1]) 
break;
case 19: this.$ = new yy.PartialNode($$[$0-2], $$[$0-1]) 
break;
case 20: 
break;
case 21: this.$ = [[$$[$0-2]].concat($$[$0-1]), $$[$0]] 
break;
case 22: this.$ = [[$$[$0-1]].concat($$[$0]), null] 
break;
case 23: this.$ = [[$$[$0-1]], $$[$0]] 
break;
case 24: this.$ = [[$$[$0]], null] 
break;
case 25: $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 26: this.$ = [$$[$0]] 
break;
case 27: this.$ = $$[$0] 
break;
case 28: this.$ = new yy.StringNode($$[$0]) 
break;
case 29: this.$ = new yy.IntegerNode($$[$0]) 
break;
case 30: this.$ = new yy.BooleanNode($$[$0]) 
break;
case 31: this.$ = new yy.HashNode($$[$0]) 
break;
case 32: $$[$0-1].push($$[$0]); this.$ = $$[$0-1] 
break;
case 33: this.$ = [$$[$0]] 
break;
case 34: this.$ = [$$[$0-2], $$[$0]] 
break;
case 35: this.$ = [$$[$0-2], new yy.StringNode($$[$0])] 
break;
case 36: this.$ = [$$[$0-2], new yy.IntegerNode($$[$0])] 
break;
case 37: this.$ = [$$[$0-2], new yy.BooleanNode($$[$0])] 
break;
case 38: this.$ = new yy.IdNode($$[$0]) 
break;
case 39: $$[$0-2].push($$[$0]); this.$ = $$[$0-2]; 
break;
case 40: this.$ = [$$[$0]] 
break;
}
},
table: [{3:1,4:2,5:[2,4],6:3,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],22:[1,13],23:[1,14],24:[1,15]},{1:[3]},{5:[1,16]},{5:[2,3],7:17,8:18,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,19],20:[2,3],22:[1,13],23:[1,14],24:[1,15]},{5:[2,5],14:[2,5],15:[2,5],16:[2,5],19:[2,5],20:[2,5],22:[2,5],23:[2,5],24:[2,5]},{4:20,6:3,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,4],22:[1,13],23:[1,14],24:[1,15]},{4:21,6:3,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,4],22:[1,13],23:[1,14],24:[1,15]},{5:[2,9],14:[2,9],15:[2,9],16:[2,9],19:[2,9],20:[2,9],22:[2,9],23:[2,9],24:[2,9]},{5:[2,10],14:[2,10],15:[2,10],16:[2,10],19:[2,10],20:[2,10],22:[2,10],23:[2,10],24:[2,10]},{5:[2,11],14:[2,11],15:[2,11],16:[2,11],19:[2,11],20:[2,11],22:[2,11],23:[2,11],24:[2,11]},{5:[2,12],14:[2,12],15:[2,12],16:[2,12],19:[2,12],20:[2,12],22:[2,12],23:[2,12],24:[2,12]},{17:22,21:23,33:[1,25],35:24},{17:26,21:23,33:[1,25],35:24},{17:27,21:23,33:[1,25],35:24},{17:28,21:23,33:[1,25],35:24},{21:29,33:[1,25],35:24},{1:[2,1]},{6:30,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],22:[1,13],23:[1,14],24:[1,15]},{5:[2,6],14:[2,6],15:[2,6],16:[2,6],19:[2,6],20:[2,6],22:[2,6],23:[2,6],24:[2,6]},{17:22,18:[1,31],21:23,33:[1,25],35:24},{10:32,20:[1,33]},{10:34,20:[1,33]},{18:[1,35]},{18:[2,24],21:40,25:36,26:37,27:38,28:[1,41],29:[1,42],30:[1,43],31:39,32:44,33:[1,45],35:24},{18:[2,38],28:[2,38],29:[2,38],30:[2,38],33:[2,38],36:[1,46]},{18:[2,40],28:[2,40],29:[2,40],30:[2,40],33:[2,40],36:[2,40]},{18:[1,47]},{18:[1,48]},{18:[1,49]},{18:[1,50],21:51,33:[1,25],35:24},{5:[2,2],8:18,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,2],22:[1,13],23:[1,14],24:[1,15]},{14:[2,20],15:[2,20],16:[2,20],19:[2,20],22:[2,20],23:[2,20],24:[2,20]},{5:[2,7],14:[2,7],15:[2,7],16:[2,7],19:[2,7],20:[2,7],22:[2,7],23:[2,7],24:[2,7]},{21:52,33:[1,25],35:24},{5:[2,8],14:[2,8],15:[2,8],16:[2,8],19:[2,8],20:[2,8],22:[2,8],23:[2,8],24:[2,8]},{14:[2,14],15:[2,14],16:[2,14],19:[2,14],20:[2,14],22:[2,14],23:[2,14],24:[2,14]},{18:[2,22],21:40,26:53,27:54,28:[1,41],29:[1,42],30:[1,43],31:39,32:44,33:[1,45],35:24},{18:[2,23]},{18:[2,26],28:[2,26],29:[2,26],30:[2,26],33:[2,26]},{18:[2,31],32:55,33:[1,56]},{18:[2,27],28:[2,27],29:[2,27],30:[2,27],33:[2,27]},{18:[2,28],28:[2,28],29:[2,28],30:[2,28],33:[2,28]},{18:[2,29],28:[2,29],29:[2,29],30:[2,29],33:[2,29]},{18:[2,30],28:[2,30],29:[2,30],30:[2,30],33:[2,30]},{18:[2,33],33:[2,33]},{18:[2,40],28:[2,40],29:[2,40],30:[2,40],33:[2,40],34:[1,57],36:[2,40]},{33:[1,58]},{14:[2,13],15:[2,13],16:[2,13],19:[2,13],20:[2,13],22:[2,13],23:[2,13],24:[2,13]},{5:[2,16],14:[2,16],15:[2,16],16:[2,16],19:[2,16],20:[2,16],22:[2,16],23:[2,16],24:[2,16]},{5:[2,17],14:[2,17],15:[2,17],16:[2,17],19:[2,17],20:[2,17],22:[2,17],23:[2,17],24:[2,17]},{5:[2,18],14:[2,18],15:[2,18],16:[2,18],19:[2,18],20:[2,18],22:[2,18],23:[2,18],24:[2,18]},{18:[1,59]},{18:[1,60]},{18:[2,21]},{18:[2,25],28:[2,25],29:[2,25],30:[2,25],33:[2,25]},{18:[2,32],33:[2,32]},{34:[1,57]},{21:61,28:[1,62],29:[1,63],30:[1,64],33:[1,25],35:24},{18:[2,39],28:[2,39],29:[2,39],30:[2,39],33:[2,39],36:[2,39]},{5:[2,19],14:[2,19],15:[2,19],16:[2,19],19:[2,19],20:[2,19],22:[2,19],23:[2,19],24:[2,19]},{5:[2,15],14:[2,15],15:[2,15],16:[2,15],19:[2,15],20:[2,15],22:[2,15],23:[2,15],24:[2,15]},{18:[2,34],33:[2,34]},{18:[2,35],33:[2,35]},{18:[2,36],33:[2,36]},{18:[2,37],33:[2,37]}],
defaultActions: {16:[2,1],37:[2,23],53:[2,21]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        lstack = [], // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    if (typeof this.lexer.yylloc == 'undefined')
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    };

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];

        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }

        // handle parse error
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                var errStr = '';
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+'\nExpecting '+expected.join(', ');
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || 'Parsing halted.');
                }
                popStack(1);
                state = stack[stack.length-1];
            }

            preErrorSymbol = symbol; // save the lookahead token
            symbol = TERROR;         // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                lstack.push(this.lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    yyloc = this.lexer.yylloc;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack.length-(len||1)].first_line,
                    last_line: lstack[lstack.length-1].last_line,
                    first_column: lstack[lstack.length-(len||1)].first_column,
                    last_column: lstack[lstack.length-1].last_column
                };
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                    lstack = lstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
}};/* Jison generated lexer */
var lexer = (function(){var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parseError) {
            this.yy.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext+=ch;
        this.yyleng++;
        this.match+=ch;
        this.matched+=ch;
        var lines = ch.match(/\n/);
        if (lines) this.yylineno++;
        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        this._input = ch + this._input;
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            match = this._input.match(this.rules[rules[i]]);
            if (match) {
                lines = match[0].match(/\n.*/g);
                if (lines) this.yylineno += lines.length;
                this.yylloc = {first_line: this.yylloc.last_line,
                               last_line: this.yylineno+1,
                               first_column: this.yylloc.last_column,
                               last_column: lines ? lines[lines.length-1].length-1 : this.yylloc.last_column + match[0].length}
                this.yytext += match[0];
                this.match += match[0];
                this.matches = match;
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                this.matched += match[0];
                token = this.performAction.call(this, this.yy, this, rules[i],this.conditionStack[this.conditionStack.length-1]);
                if (token) return token;
                else return;
            }
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(), 
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    }});
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {

var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0: this.begin("mu"); if (yy_.yytext) return 14; 
break;
case 1: return 14; 
break;
case 2: return 24; 
break;
case 3: return 16; 
break;
case 4: return 20; 
break;
case 5: return 19; 
break;
case 6: return 19; 
break;
case 7: return 23; 
break;
case 8: return 23; 
break;
case 9: yy_.yytext = yy_.yytext.substr(3,yy_.yyleng-5); this.begin("INITIAL"); return 15; 
break;
case 10: return 22; 
break;
case 11: return 34; 
break;
case 12: return 33; 
break;
case 13: return 33; 
break;
case 14: return 36; 
break;
case 15: /*ignore whitespace*/ 
break;
case 16: this.begin("INITIAL"); return 18; 
break;
case 17: this.begin("INITIAL"); return 18; 
break;
case 18: yy_.yytext = yy_.yytext.substr(1,yy_.yyleng-2).replace(/\\"/g,'"'); return 28; 
break;
case 19: return 30; 
break;
case 20: return 30; 
break;
case 21: return 29; 
break;
case 22: return 33; 
break;
case 23: return 'INVALID'; 
break;
case 24: return 5; 
break;
}
};
lexer.rules = [/^[^\x00]*?(?=(\{\{))/,/^[^\x00]+/,/^\{\{>/,/^\{\{#/,/^\{\{\//,/^\{\{\^/,/^\{\{\s*else\b/,/^\{\{\{/,/^\{\{&/,/^\{\{![\s\S]*?\}\}/,/^\{\{/,/^=/,/^\.(?=[} ])/,/^\.\./,/^[/.]/,/^\s+/,/^\}\}\}/,/^\}\}/,/^"(\\["]|[^"])*"/,/^true(?=[}\s])/,/^false(?=[}\s])/,/^[0-9]+(?=[}\s])/,/^[a-zA-Z0-9_$-]+(?=[=}\s/.])/,/^./,/^$/];
lexer.conditions = {"mu":{"rules":[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24],"inclusive":false},"INITIAL":{"rules":[0,1,24],"inclusive":true}};return lexer;})()
parser.lexer = lexer;
return parser;
})();
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = handlebars;
exports.parse = function () { return handlebars.parse.apply(handlebars, arguments); }
exports.main = function commonjsMain(args) {
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    if (typeof process !== 'undefined') {
        var source = require('fs').readFileSync(require('path').join(process.cwd(), args[1]), "utf8");
    } else {
        var cwd = require("file").path(require("file").cwd());
        var source = cwd.join(args[1]).read({charset: "utf-8"});
    }
    return exports.parser.parse(source);
}
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require("system").args);
}
};
;
// lib/handlebars/compiler/base.js
Handlebars.Parser = handlebars;

Handlebars.parse = function(string) {
  Handlebars.Parser.yy = Handlebars.AST;
  return Handlebars.Parser.parse(string);
};

Handlebars.print = function(ast) {
  return new Handlebars.PrintVisitor().accept(ast);
};

Handlebars.logger = {
  DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, level: 3,

  // override in the host environment
  log: function(level, str) {}
};

Handlebars.log = function(level, str) { Handlebars.logger.log(level, str); };
;
// lib/handlebars/compiler/ast.js
(function() {

  Handlebars.AST = {};

  Handlebars.AST.ProgramNode = function(statements, inverse) {
    this.type = "program";
    this.statements = statements;
    if(inverse) { this.inverse = new Handlebars.AST.ProgramNode(inverse); }
  };

  Handlebars.AST.MustacheNode = function(params, hash, unescaped) {
    this.type = "mustache";
    this.id = params[0];
    this.params = params.slice(1);
    this.hash = hash;
    this.escaped = !unescaped;
  };

  Handlebars.AST.PartialNode = function(id, context) {
    this.type    = "partial";

    // TODO: disallow complex IDs

    this.id      = id;
    this.context = context;
  };

  var verifyMatch = function(open, close) {
    if(open.original !== close.original) {
      throw new Handlebars.Exception(open.original + " doesn't match " + close.original);
    }
  };

  Handlebars.AST.BlockNode = function(mustache, program, close) {
    verifyMatch(mustache.id, close);
    this.type = "block";
    this.mustache = mustache;
    this.program  = program;
  };

  Handlebars.AST.InverseNode = function(mustache, program, close) {
    verifyMatch(mustache.id, close);
    this.type = "inverse";
    this.mustache = mustache;
    this.program  = program;
  };

  Handlebars.AST.ContentNode = function(string) {
    this.type = "content";
    this.string = string;
  };

  Handlebars.AST.HashNode = function(pairs) {
    this.type = "hash";
    this.pairs = pairs;
  };

  Handlebars.AST.IdNode = function(parts) {
    this.type = "ID";
    this.original = parts.join(".");

    var dig = [], depth = 0;

    for(var i=0,l=parts.length; i<l; i++) {
      var part = parts[i];

      if(part === "..") { depth++; }
      else if(part === "." || part === "this") { this.isScoped = true; }
      else { dig.push(part); }
    }

    this.parts    = dig;
    this.string   = dig.join('.');
    this.depth    = depth;
    this.isSimple = (dig.length === 1) && (depth === 0);
  };

  Handlebars.AST.StringNode = function(string) {
    this.type = "STRING";
    this.string = string;
  };

  Handlebars.AST.IntegerNode = function(integer) {
    this.type = "INTEGER";
    this.integer = integer;
  };

  Handlebars.AST.BooleanNode = function(bool) {
    this.type = "BOOLEAN";
    this.bool = bool;
  };

  Handlebars.AST.CommentNode = function(comment) {
    this.type = "comment";
    this.comment = comment;
  };

})();;
// lib/handlebars/utils.js
Handlebars.Exception = function(message) {
  var tmp = Error.prototype.constructor.apply(this, arguments);

  for (var p in tmp) {
    if (tmp.hasOwnProperty(p)) { this[p] = tmp[p]; }
  }
};
Handlebars.Exception.prototype = new Error;

// Build out our basic SafeString type
Handlebars.SafeString = function(string) {
  this.string = string;
};
Handlebars.SafeString.prototype.toString = function() {
  return this.string.toString();
};

(function() {
  var escape = {
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "`": "&#x60;"
  };

  var badChars = /&(?!\w+;)|[<>"'`]/g;
  var possible = /[&<>"'`]/;

  var escapeChar = function(chr) {
    return escape[chr] || "&amp;";
  };

  Handlebars.Utils = {
    escapeExpression: function(string) {
      // don't escape SafeStrings, since they're already safe
      if (string instanceof Handlebars.SafeString) {
        return string.toString();
      } else if (string == null || string === false) {
        return "";
      }

      if(!possible.test(string)) { return string; }
      return string.replace(badChars, escapeChar);
    },

    isEmpty: function(value) {
      if (typeof value === "undefined") {
        return true;
      } else if (value === null) {
        return true;
      } else if (value === false) {
        return true;
      } else if(Object.prototype.toString.call(value) === "[object Array]" && value.length === 0) {
        return true;
      } else {
        return false;
      }
    }
  };
})();;
// lib/handlebars/compiler/compiler.js
Handlebars.Compiler = function() {};
Handlebars.JavaScriptCompiler = function() {};

(function(Compiler, JavaScriptCompiler) {
  Compiler.OPCODE_MAP = {
    appendContent: 1,
    getContext: 2,
    lookupWithHelpers: 3,
    lookup: 4,
    append: 5,
    invokeMustache: 6,
    appendEscaped: 7,
    pushString: 8,
    truthyOrFallback: 9,
    functionOrFallback: 10,
    invokeProgram: 11,
    invokePartial: 12,
    push: 13,
    assignToHash: 15,
    pushStringParam: 16
  };

  Compiler.MULTI_PARAM_OPCODES = {
    appendContent: 1,
    getContext: 1,
    lookupWithHelpers: 2,
    lookup: 1,
    invokeMustache: 3,
    pushString: 1,
    truthyOrFallback: 1,
    functionOrFallback: 1,
    invokeProgram: 3,
    invokePartial: 1,
    push: 1,
    assignToHash: 1,
    pushStringParam: 1
  };

  Compiler.DISASSEMBLE_MAP = {};

  for(var prop in Compiler.OPCODE_MAP) {
    var value = Compiler.OPCODE_MAP[prop];
    Compiler.DISASSEMBLE_MAP[value] = prop;
  }

  Compiler.multiParamSize = function(code) {
    return Compiler.MULTI_PARAM_OPCODES[Compiler.DISASSEMBLE_MAP[code]];
  };

  Compiler.prototype = {
    compiler: Compiler,

    disassemble: function() {
      var opcodes = this.opcodes, opcode, nextCode;
      var out = [], str, name, value;

      for(var i=0, l=opcodes.length; i<l; i++) {
        opcode = opcodes[i];

        if(opcode === 'DECLARE') {
          name = opcodes[++i];
          value = opcodes[++i];
          out.push("DECLARE " + name + " = " + value);
        } else {
          str = Compiler.DISASSEMBLE_MAP[opcode];

          var extraParams = Compiler.multiParamSize(opcode);
          var codes = [];

          for(var j=0; j<extraParams; j++) {
            nextCode = opcodes[++i];

            if(typeof nextCode === "string") {
              nextCode = "\"" + nextCode.replace("\n", "\\n") + "\"";
            }

            codes.push(nextCode);
          }

          str = str + " " + codes.join(" ");

          out.push(str);
        }
      }

      return out.join("\n");
    },

    guid: 0,

    compile: function(program, options) {
      this.children = [];
      this.depths = {list: []};
      this.options = options;

      // These changes will propagate to the other compiler components
      var knownHelpers = this.options.knownHelpers;
      this.options.knownHelpers = {
        'helperMissing': true,
        'blockHelperMissing': true,
        'each': true,
        'if': true,
        'unless': true,
        'with': true
      };
      if (knownHelpers) {
        for (var name in knownHelpers) {
          this.options.knownHelpers[name] = knownHelpers[name];
        }
      }

      return this.program(program);
    },

    accept: function(node) {
      return this[node.type](node);
    },

    program: function(program) {
      var statements = program.statements, statement;
      this.opcodes = [];

      for(var i=0, l=statements.length; i<l; i++) {
        statement = statements[i];
        this[statement.type](statement);
      }
      this.isSimple = l === 1;

      this.depths.list = this.depths.list.sort(function(a, b) {
        return a - b;
      });

      return this;
    },

    compileProgram: function(program) {
      var result = new this.compiler().compile(program, this.options);
      var guid = this.guid++;

      this.usePartial = this.usePartial || result.usePartial;

      this.children[guid] = result;

      for(var i=0, l=result.depths.list.length; i<l; i++) {
        depth = result.depths.list[i];

        if(depth < 2) { continue; }
        else { this.addDepth(depth - 1); }
      }

      return guid;
    },

    block: function(block) {
      var mustache = block.mustache;
      var depth, child, inverse, inverseGuid;

      var params = this.setupStackForMustache(mustache);

      var programGuid = this.compileProgram(block.program);

      if(block.program.inverse) {
        inverseGuid = this.compileProgram(block.program.inverse);
        this.declare('inverse', inverseGuid);
      }

      this.opcode('invokeProgram', programGuid, params.length, !!mustache.hash);
      this.declare('inverse', null);
      this.opcode('append');
    },

    inverse: function(block) {
      var params = this.setupStackForMustache(block.mustache);

      var programGuid = this.compileProgram(block.program);

      this.declare('inverse', programGuid);

      this.opcode('invokeProgram', null, params.length, !!block.mustache.hash);
      this.opcode('append');
    },

    hash: function(hash) {
      var pairs = hash.pairs, pair, val;

      this.opcode('push', '{}');

      for(var i=0, l=pairs.length; i<l; i++) {
        pair = pairs[i];
        val  = pair[1];

        this.accept(val);
        this.opcode('assignToHash', pair[0]);
      }
    },

    partial: function(partial) {
      var id = partial.id;
      this.usePartial = true;

      if(partial.context) {
        this.ID(partial.context);
      } else {
        this.opcode('push', 'depth0');
      }

      this.opcode('invokePartial', id.original);
      this.opcode('append');
    },

    content: function(content) {
      this.opcode('appendContent', content.string);
    },

    mustache: function(mustache) {
      var params = this.setupStackForMustache(mustache);

      this.opcode('invokeMustache', params.length, mustache.id.original, !!mustache.hash);

      if(mustache.escaped) {
        this.opcode('appendEscaped');
      } else {
        this.opcode('append');
      }
    },

    ID: function(id) {
      this.addDepth(id.depth);

      this.opcode('getContext', id.depth);

      this.opcode('lookupWithHelpers', id.parts[0] || null, id.isScoped || false);

      for(var i=1, l=id.parts.length; i<l; i++) {
        this.opcode('lookup', id.parts[i]);
      }
    },

    STRING: function(string) {
      this.opcode('pushString', string.string);
    },

    INTEGER: function(integer) {
      this.opcode('push', integer.integer);
    },

    BOOLEAN: function(bool) {
      this.opcode('push', bool.bool);
    },

    comment: function() {},

    // HELPERS
    pushParams: function(params) {
      var i = params.length, param;

      while(i--) {
        param = params[i];

        if(this.options.stringParams) {
          if(param.depth) {
            this.addDepth(param.depth);
          }

          this.opcode('getContext', param.depth || 0);
          this.opcode('pushStringParam', param.string);
        } else {
          this[param.type](param);
        }
      }
    },

    opcode: function(name, val1, val2, val3) {
      this.opcodes.push(Compiler.OPCODE_MAP[name]);
      if(val1 !== undefined) { this.opcodes.push(val1); }
      if(val2 !== undefined) { this.opcodes.push(val2); }
      if(val3 !== undefined) { this.opcodes.push(val3); }
    },

    declare: function(name, value) {
      this.opcodes.push('DECLARE');
      this.opcodes.push(name);
      this.opcodes.push(value);
    },

    addDepth: function(depth) {
      if(depth === 0) { return; }

      if(!this.depths[depth]) {
        this.depths[depth] = true;
        this.depths.list.push(depth);
      }
    },

    setupStackForMustache: function(mustache) {
      var params = mustache.params;

      this.pushParams(params);

      if(mustache.hash) {
        this.hash(mustache.hash);
      }

      this.ID(mustache.id);

      return params;
    }
  };

  JavaScriptCompiler.prototype = {
    // PUBLIC API: You can override these methods in a subclass to provide
    // alternative compiled forms for name lookup and buffering semantics
    nameLookup: function(parent, name, type) {
      if(JavaScriptCompiler.RESERVED_WORDS[name] || name.indexOf('-') !== -1 || !isNaN(name)) {
        return parent + "['" + name + "']";
      } else if (/^[0-9]+$/.test(name)) {
        return parent + "[" + name + "]";
      } else {
        return parent + "." + name;
      }
    },

    appendToBuffer: function(string) {
      if (this.environment.isSimple) {
        return "return " + string + ";";
      } else {
        return "buffer += " + string + ";";
      }
    },

    initializeBuffer: function() {
      return this.quotedString("");
    },
    // END PUBLIC API

    compile: function(environment, options, context, asObject) {
      this.environment = environment;
      this.options = options || {};

      this.name = this.environment.name;
      this.isChild = !!context;
      this.context = context || {
        programs: [],
        aliases: { self: 'this' },
        registers: {list: []}
      };

      this.preamble();

      this.stackSlot = 0;
      this.stackVars = [];

      this.compileChildren(environment, options);

      var opcodes = environment.opcodes, opcode;

      this.i = 0;

      for(l=opcodes.length; this.i<l; this.i++) {
        opcode = this.nextOpcode(0);

        if(opcode[0] === 'DECLARE') {
          this.i = this.i + 2;
          this[opcode[1]] = opcode[2];
        } else {
          this.i = this.i + opcode[1].length;
          this[opcode[0]].apply(this, opcode[1]);
        }
      }

      return this.createFunctionContext(asObject);
    },

    nextOpcode: function(n) {
      var opcodes = this.environment.opcodes, opcode = opcodes[this.i + n], name, val;
      var extraParams, codes;

      if(opcode === 'DECLARE') {
        name = opcodes[this.i + 1];
        val  = opcodes[this.i + 2];
        return ['DECLARE', name, val];
      } else {
        name = Compiler.DISASSEMBLE_MAP[opcode];

        extraParams = Compiler.multiParamSize(opcode);
        codes = [];

        for(var j=0; j<extraParams; j++) {
          codes.push(opcodes[this.i + j + 1 + n]);
        }

        return [name, codes];
      }
    },

    eat: function(opcode) {
      this.i = this.i + opcode.length;
    },

    preamble: function() {
      var out = [];

      if (!this.isChild) {
        var copies = "helpers = helpers || Handlebars.helpers;";
        if(this.environment.usePartial) { copies = copies + " partials = partials || Handlebars.partials;"; }
        out.push(copies);
      } else {
        out.push('');
      }

      if (!this.environment.isSimple) {
        out.push(", buffer = " + this.initializeBuffer());
      } else {
        out.push("");
      }

      // track the last context pushed into place to allow skipping the
      // getContext opcode when it would be a noop
      this.lastContext = 0;
      this.source = out;
    },

    createFunctionContext: function(asObject) {
      var locals = this.stackVars;
      if (!this.isChild) {
        locals = locals.concat(this.context.registers.list);
      }

      if(locals.length > 0) {
        this.source[1] = this.source[1] + ", " + locals.join(", ");
      }

      // Generate minimizer alias mappings
      if (!this.isChild) {
        var aliases = []
        for (var alias in this.context.aliases) {
          this.source[1] = this.source[1] + ', ' + alias + '=' + this.context.aliases[alias];
        }
      }

      if (this.source[1]) {
        this.source[1] = "var " + this.source[1].substring(2) + ";";
      }

      // Merge children
      if (!this.isChild) {
        this.source[1] += '\n' + this.context.programs.join('\n') + '\n';
      }

      if (!this.environment.isSimple) {
        this.source.push("return buffer;");
      }

      var params = this.isChild ? ["depth0", "data"] : ["Handlebars", "depth0", "helpers", "partials", "data"];

      for(var i=0, l=this.environment.depths.list.length; i<l; i++) {
        params.push("depth" + this.environment.depths.list[i]);
      }

      if(params.length === 4 && !this.environment.usePartial) { params.pop(); }

      if (asObject) {
        params.push(this.source.join("\n  "));

        return Function.apply(this, params);
      } else {
        var functionSource = 'function ' + (this.name || '') + '(' + params.join(',') + ') {\n  ' + this.source.join("\n  ") + '}';
        Handlebars.log(Handlebars.logger.DEBUG, functionSource + "\n\n");
        return functionSource;
      }
    },

    appendContent: function(content) {
      this.source.push(this.appendToBuffer(this.quotedString(content)));
    },

    append: function() {
      var local = this.popStack();
      this.source.push("if(" + local + " || " + local + " === 0) { " + this.appendToBuffer(local) + " }");
      if (this.environment.isSimple) {
        this.source.push("else { " + this.appendToBuffer("''") + " }");
      }
    },

    appendEscaped: function() {
      var opcode = this.nextOpcode(1), extra = "";
      this.context.aliases.escapeExpression = 'this.escapeExpression';

      if(opcode[0] === 'appendContent') {
        extra = " + " + this.quotedString(opcode[1][0]);
        this.eat(opcode);
      }

      this.source.push(this.appendToBuffer("escapeExpression(" + this.popStack() + ")" + extra));
    },

    getContext: function(depth) {
      if(this.lastContext !== depth) {
        this.lastContext = depth;
      }
    },

    lookupWithHelpers: function(name, isScoped) {
      if(name) {
        var topStack = this.nextStack();

        this.usingKnownHelper = false;

        var toPush;
        if (!isScoped && this.options.knownHelpers[name]) {
          toPush = topStack + " = " + this.nameLookup('helpers', name, 'helper');
          this.usingKnownHelper = true;
        } else if (isScoped || this.options.knownHelpersOnly) {
          toPush = topStack + " = " + this.nameLookup('depth' + this.lastContext, name, 'context');
        } else {
          toPush =  topStack + " = "
              + this.nameLookup('helpers', name, 'helper')
              + " || "
              + this.nameLookup('depth' + this.lastContext, name, 'context');
        }

        this.source.push(toPush);
      } else {
        this.pushStack('depth' + this.lastContext);
      }
    },

    lookup: function(name) {
      var topStack = this.topStack();
      this.source.push(topStack + " = " + this.nameLookup(topStack, name, 'context') + ";");
    },

    pushStringParam: function(string) {
      this.pushStack('depth' + this.lastContext);
      this.pushString(string);
    },

    pushString: function(string) {
      this.pushStack(this.quotedString(string));
    },

    push: function(name) {
      this.pushStack(name);
    },

    invokeMustache: function(paramSize, original, hasHash) {
      this.populateParams(paramSize, this.quotedString(original), "{}", null, hasHash, function(nextStack, helperMissingString, id) {
        if (!this.usingKnownHelper) {
          this.context.aliases.helperMissing = 'helpers.helperMissing';
          this.context.aliases.undef = 'void 0';
          this.source.push("else if(" + id + "=== undef) { " + nextStack + " = helperMissing.call(" + helperMissingString + "); }");
          if (nextStack !== id) {
            this.source.push("else { " + nextStack + " = " + id + "; }");
          }
        }
      });
    },

    invokeProgram: function(guid, paramSize, hasHash) {
      var inverse = this.programExpression(this.inverse);
      var mainProgram = this.programExpression(guid);

      this.populateParams(paramSize, null, mainProgram, inverse, hasHash, function(nextStack, helperMissingString, id) {
        if (!this.usingKnownHelper) {
          this.context.aliases.blockHelperMissing = 'helpers.blockHelperMissing';
          this.source.push("else { " + nextStack + " = blockHelperMissing.call(" + helperMissingString + "); }");
        }
      });
    },

    populateParams: function(paramSize, helperId, program, inverse, hasHash, fn) {
      var needsRegister = hasHash || this.options.stringParams || inverse || this.options.data;
      var id = this.popStack(), nextStack;
      var params = [], param, stringParam, stringOptions;

      if (needsRegister) {
        this.register('tmp1', program);
        stringOptions = 'tmp1';
      } else {
        stringOptions = '{ hash: {} }';
      }

      if (needsRegister) {
        var hash = (hasHash ? this.popStack() : '{}');
        this.source.push('tmp1.hash = ' + hash + ';');
      }

      if(this.options.stringParams) {
        this.source.push('tmp1.contexts = [];');
      }

      for(var i=0; i<paramSize; i++) {
        param = this.popStack();
        params.push(param);

        if(this.options.stringParams) {
          this.source.push('tmp1.contexts.push(' + this.popStack() + ');');
        }
      }

      if(inverse) {
        this.source.push('tmp1.fn = tmp1;');
        this.source.push('tmp1.inverse = ' + inverse + ';');
      }

      if(this.options.data) {
        this.source.push('tmp1.data = data;');
      }

      params.push(stringOptions);

      this.populateCall(params, id, helperId || id, fn);
    },

    populateCall: function(params, id, helperId, fn) {
      var paramString = ["depth0"].concat(params).join(", ");
      var helperMissingString = ["depth0"].concat(helperId).concat(params).join(", ");

      var nextStack = this.nextStack();

      if (this.usingKnownHelper) {
        this.source.push(nextStack + " = " + id + ".call(" + paramString + ");");
      } else {
        this.context.aliases.functionType = '"function"';
        this.source.push("if(typeof " + id + " === functionType) { " + nextStack + " = " + id + ".call(" + paramString + "); }");
      }
      fn.call(this, nextStack, helperMissingString, id);
      this.usingKnownHelper = false;
    },

    invokePartial: function(context) {
      this.pushStack("self.invokePartial(" + this.nameLookup('partials', context, 'partial') + ", '" + context + "', " + this.popStack() + ", helpers, partials);");
    },

    assignToHash: function(key) {
      var value = this.popStack();
      var hash = this.topStack();

      this.source.push(hash + "['" + key + "'] = " + value + ";");
    },

    // HELPERS

    compiler: JavaScriptCompiler,

    compileChildren: function(environment, options) {
      var children = environment.children, child, compiler;

      for(var i=0, l=children.length; i<l; i++) {
        child = children[i];
        compiler = new this.compiler();

        this.context.programs.push('');     // Placeholder to prevent name conflicts for nested children
        var index = this.context.programs.length;
        child.index = index;
        child.name = 'program' + index;
        this.context.programs[index] = compiler.compile(child, options, this.context);
      }
    },

    programExpression: function(guid) {
      if(guid == null) { return "self.noop"; }

      var child = this.environment.children[guid],
          depths = child.depths.list;
      var programParams = [child.index, child.name, "data"];

      for(var i=0, l = depths.length; i<l; i++) {
        depth = depths[i];

        if(depth === 1) { programParams.push("depth0"); }
        else { programParams.push("depth" + (depth - 1)); }
      }

      if(depths.length === 0) {
        return "self.program(" + programParams.join(", ") + ")";
      } else {
        programParams.shift();
        return "self.programWithDepth(" + programParams.join(", ") + ")";
      }
    },

    register: function(name, val) {
      this.useRegister(name);
      this.source.push(name + " = " + val + ";");
    },

    useRegister: function(name) {
      if(!this.context.registers[name]) {
        this.context.registers[name] = true;
        this.context.registers.list.push(name);
      }
    },

    pushStack: function(item) {
      this.source.push(this.nextStack() + " = " + item + ";");
      return "stack" + this.stackSlot;
    },

    nextStack: function() {
      this.stackSlot++;
      if(this.stackSlot > this.stackVars.length) { this.stackVars.push("stack" + this.stackSlot); }
      return "stack" + this.stackSlot;
    },

    popStack: function() {
      return "stack" + this.stackSlot--;
    },

    topStack: function() {
      return "stack" + this.stackSlot;
    },

    quotedString: function(str) {
      return '"' + str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r') + '"';
    }
  };

  var reservedWords = ("break case catch continue default delete do else finally " +
                       "for function if in instanceof new return switch this throw " + 
                       "try typeof var void while with null true false").split(" ");

  compilerWords = JavaScriptCompiler.RESERVED_WORDS = {};

  for(var i=0, l=reservedWords.length; i<l; i++) {
    compilerWords[reservedWords[i]] = true;
  }

})(Handlebars.Compiler, Handlebars.JavaScriptCompiler);

Handlebars.precompile = function(string, options) {
  options = options || {};

  var ast = Handlebars.parse(string);
  var environment = new Handlebars.Compiler().compile(ast, options);
  return new Handlebars.JavaScriptCompiler().compile(environment, options);
};

Handlebars.compile = function(string, options) {
  options = options || {};

  var ast = Handlebars.parse(string);
  var environment = new Handlebars.Compiler().compile(ast, options);
  var templateSpec = new Handlebars.JavaScriptCompiler().compile(environment, options, undefined, true);
  return Handlebars.template(templateSpec);
};
;
// lib/handlebars/vm.js
Handlebars.VM = {
  template: function(templateSpec) {
    // Just add water
    var container = {
      escapeExpression: Handlebars.Utils.escapeExpression,
      invokePartial: Handlebars.VM.invokePartial,
      programs: [],
      program: function(i, fn, data) {
        var programWrapper = this.programs[i];
        if(data) {
          return Handlebars.VM.program(fn, data);
        } else if(programWrapper) {
          return programWrapper;
        } else {
          programWrapper = this.programs[i] = Handlebars.VM.program(fn);
          return programWrapper;
        }
      },
      programWithDepth: Handlebars.VM.programWithDepth,
      noop: Handlebars.VM.noop
    };

    return function(context, options) {
      options = options || {};
      return templateSpec.call(container, Handlebars, context, options.helpers, options.partials, options.data);
    };
  },

  programWithDepth: function(fn, data, $depth) {
    var args = Array.prototype.slice.call(arguments, 2);

    return function(context, options) {
      options = options || {};

      return fn.apply(this, [context, options.data || data].concat(args));
    };
  },
  program: function(fn, data) {
    return function(context, options) {
      options = options || {};

      return fn(context, options.data || data);
    };
  },
  noop: function() { return ""; },
  invokePartial: function(partial, name, context, helpers, partials) {
    if(partial === undefined) {
      throw new Handlebars.Exception("The partial " + name + " could not be found");
    } else if(partial instanceof Function) {
      return partial(context, {helpers: helpers, partials: partials});
    } else if (!Handlebars.compile) {
      throw new Handlebars.Exception("The partial " + name + " could not be compiled when running in vm mode");
    } else {
      partials[name] = Handlebars.compile(partial);
      return partials[name](context, {helpers: helpers, partials: partials});
    }
  }
};

Handlebars.template = Handlebars.VM.template;
;
spade.register("sproutcore-handlebars/controls", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire(\"sproutcore-handlebars/controls/checkbox\");\nrequire(\"sproutcore-handlebars/controls/text_field\");\nrequire(\"sproutcore-handlebars/controls/button\");\nrequire(\"sproutcore-handlebars/controls/text_area\");\n\n});");spade.register("sproutcore-handlebars/controls/button", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nvar get = SC.get, set = SC.set;\n\nSC.Button = SC.View.extend({\n  classNames: ['sc-button'],\n  classNameBindings: ['isActive'],\n\n  tagName: 'button',\n  attributeBindings: ['type'],\n  type: 'button',\n  \n  targetObject: function() {\n    var target = get(this, 'target');\n\n    if (SC.typeOf(target) === \"string\") {\n      return SC.getPath(this, target);\n    } else {\n      return target;\n    }\n  }.property('target').cacheable(),\n\n  mouseDown: function() {\n    set(this, 'isActive', true);\n    this._mouseDown = true;\n    this._mouseEntered = true;\n  },\n\n  mouseLeave: function() {\n    if (this._mouseDown) {\n      set(this, 'isActive', false);\n      this._mouseEntered = false;\n    }\n  },\n\n  mouseEnter: function() {\n    if (this._mouseDown) {\n      set(this, 'isActive', true);\n      this._mouseEntered = true;\n    }\n  },\n\n  mouseUp: function(event) {\n    if (get(this, 'isActive')) {\n      var action = get(this, 'action'),\n          target = get(this, 'targetObject');\n\n      if (target && action) {\n        if (typeof action === 'string') {\n          action = target[action];\n        }\n        action.call(target, this);\n      }\n\n      set(this, 'isActive', false);\n    }\n\n    this._mouseDown = false;\n    this._mouseEntered = false;\n  },\n\n  // TODO: Handle proper touch behavior.  Including should make inactive when\n  // finger moves more than 20x outside of the edge of the button (vs mouse\n  // which goes inactive as soon as mouse goes out of edges.)\n\n  touchStart: function(touch) {\n    this.mouseDown(touch);\n  },\n\n  touchEnd: function(touch) {\n    this.mouseUp(touch);\n  }\n});\n\n});");spade.register("sproutcore-handlebars/controls/checkbox", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire(\"sproutcore-views/views/view\");\nrequire(\"sproutcore-handlebars/ext\");\n\nvar set = SC.set, get = SC.get;\n\n// TODO: Be explicit in the class documentation that you\n// *MUST* set the value of a checkbox through SproutCore.\n// Updating the value of a checkbox directly via jQuery objects\n// will not work.\n\nSC.Checkbox = SC.View.extend({\n  title: null,\n  value: false,\n\n  classNames: ['sc-checkbox'],\n\n  defaultTemplate: SC.Handlebars.compile('<label><input type=\"checkbox\" {{bindAttr checked=\"value\"}}>{{title}}</label>'),\n\n  change: function() {\n    SC.run.once(this, this._updateElementValue);\n    // returning false will cause IE to not change checkbox state\n  },\n\n  _updateElementValue: function() {\n    var input = this.$('input:checkbox');\n    set(this, 'value', input.prop('checked'));\n  }\n});\n\n\n});");spade.register("sproutcore-handlebars/controls/text_area", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire(\"sproutcore-handlebars/ext\");\nrequire(\"sproutcore-views/views/view\");\n/** @class */\n\nvar get = SC.get, set = SC.set;\n\nSC.TextArea = SC.View.extend({\n\n  classNames: ['sc-text-area'],\n\n  tagName: \"textarea\",\n  value: \"\",\n  attributeBindings: ['placeholder'],\n  placeholder: null,\n\n  insertNewline: SC.K,\n  cancel: SC.K,\n  \n  focusOut: function(event) {\n    this._elementValueDidChange();\n    return false;\n  },\n\n  change: function(event) {\n    this._elementValueDidChange();\n    return false;\n  },\n\n  keyUp: function(event) {\n    this.interpretKeyEvents(event);\n    return false;\n  },\n\n  /**\n    @private\n  */\n  willInsertElement: function() {\n    this._updateElementValue();\n  },\n\n  interpretKeyEvents: function(event) {\n    var map = SC.TextArea.KEY_EVENTS;\n    var method = map[event.keyCode];\n\n    this._elementValueDidChange();\n    if (method) { return this[method](event); }\n  },\n\n  _elementValueDidChange: function() {\n    set(this, 'value', this.$().val() || null);\n  },\n\n  _updateElementValue: function() {\n    this.$().val(get(this, 'value'));\n  }.observes('value')\n});\n\nSC.TextArea.KEY_EVENTS = {\n  13: 'insertNewline',\n  27: 'cancel'\n};\n\n});");spade.register("sproutcore-handlebars/controls/text_field", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire(\"sproutcore-handlebars/ext\");\nrequire(\"sproutcore-views/views/view\");\n/** @class */\n\nvar get = SC.get, set = SC.set;\n\nSC.TextField = SC.View.extend(\n  /** @scope SC.TextField.prototype */ {\n\n  classNames: ['sc-text-field'],\n\n  insertNewline: SC.K,\n  cancel: SC.K,\n\n  tagName: \"input\",\n  attributeBindings: ['type', 'placeholder', 'value'],\n  type: \"text\",\n  value: \"\",\n  placeholder: null,\n\n  focusOut: function(event) {\n    this._elementValueDidChange();\n    return false;\n  },\n\n  change: function(event) {\n    this._elementValueDidChange();\n    return false;\n  },\n\n  keyUp: function(event) {\n    this.interpretKeyEvents(event);\n    return false;\n  },\n\n  /**\n    @private\n  */\n  interpretKeyEvents: function(event) {\n    var map = SC.TextField.KEY_EVENTS;\n    var method = map[event.keyCode];\n\n    if (method) { return this[method](event); }\n    else { this._elementValueDidChange(); }\n  },\n\n  _elementValueDidChange: function() {\n    set(this, 'value', this.$().val());\n  },\n\n  _updateElementValue: function() {\n    this.$().val(get(this, 'value'));\n  }\n});\n\nSC.TextField.KEY_EVENTS = {\n  13: 'insertNewline',\n  27: 'cancel'\n};\n\n\n});");spade.register("sproutcore-handlebars/ext", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals Handlebars */\n\n/**\n  @class\n\n  Prepares the Handlebars templating library for use inside SproutCore's view\n  system.\n\n  The SC.Handlebars object is the standard Handlebars library, extended to use\n  SproutCore's get() method instead of direct property access, which allows\n  computed properties to be used inside templates.\n\n  To use SC.Handlebars, call SC.Handlebars.compile().  This will return a\n  function that you can call multiple times, with a context object as the first\n  parameter:\n\n      var template = SC.Handlebars.compile(\"my {{cool}} template\");\n      var result = template({\n        cool: \"awesome\"\n      });\n\n      console.log(result); // prints \"my awesome template\"\n\n  Note that you won't usually need to use SC.Handlebars yourself. Instead, use\n  SC.View, which takes care of integration into the view layer for you.\n*/\n\n\nrequire(\"sproutcore-views/system/render_buffer\");\n\n/**\n  @namespace\n\n  SproutCore Handlebars is an extension to Handlebars that makes the built-in\n  Handlebars helpers and {{mustaches}} binding-aware.\n*/\nSC.Handlebars = {};\n\n/**\n  Override the the opcode compiler and JavaScript compiler for Handlebars.\n*/\nSC.Handlebars.Compiler = function() {};\nSC.Handlebars.Compiler.prototype = SC.create(Handlebars.Compiler.prototype);\nSC.Handlebars.Compiler.prototype.compiler = SC.Handlebars.Compiler;\n\nSC.Handlebars.JavaScriptCompiler = function() {};\nSC.Handlebars.JavaScriptCompiler.prototype = SC.create(Handlebars.JavaScriptCompiler.prototype);\nSC.Handlebars.JavaScriptCompiler.prototype.compiler = SC.Handlebars.JavaScriptCompiler;\n\n/**\n  Override the default property lookup semantics of Handlebars.\n\n  By default, Handlebars uses object[property] to look up properties. SproutCore's Handlebars\n  uses SC.get().\n\n  @private\n*/\nSC.Handlebars.JavaScriptCompiler.prototype.nameLookup = function(parent, name, type) {\n  if (type === 'context') {\n    return \"SC.get(\" + parent + \", \" + this.quotedString(name) + \");\";\n  } else {\n    return Handlebars.JavaScriptCompiler.prototype.nameLookup.call(this, parent, name, type);\n  }\n};\n\nSC.Handlebars.JavaScriptCompiler.prototype.initializeBuffer = function() {\n  return \"''\";\n};\n\n/**\n  Override the default buffer for SproutCore Handlebars. By default, Handlebars creates\n  an empty String at the beginning of each invocation and appends to it. SproutCore's\n  Handlebars overrides this to append to a single shared buffer.\n\n  @private\n*/\nSC.Handlebars.JavaScriptCompiler.prototype.appendToBuffer = function(string) {\n  return \"data.buffer.push(\"+string+\");\";\n};\n\n/**\n  Rewrite simple mustaches from {{foo}} to {{bind \"foo\"}}. This means that all simple\n  mustaches in SproutCore's Handlebars will also set up an observer to keep the DOM\n  up to date when the underlying property changes.\n\n  @private\n*/\nSC.Handlebars.Compiler.prototype.mustache = function(mustache) {\n  if (mustache.params.length || mustache.hash) {\n    return Handlebars.Compiler.prototype.mustache.call(this, mustache);\n  } else {\n    var id = new Handlebars.AST.IdNode(['bind']);\n\n    // Update the mustache node to include a hash value indicating whether the original node\n    // was escaped. This will allow us to properly escape values when the underlying value\n    // changes and we need to re-render the value.\n    if(mustache.escaped) {\n      mustache.hash = mustache.hash || new Handlebars.AST.HashNode([]);\n      mustache.hash.pairs.push([\"escaped\", new Handlebars.AST.StringNode(\"true\")]);\n    }\n    mustache = new Handlebars.AST.MustacheNode([id].concat([mustache.id]), mustache.hash, !mustache.escaped);\n    return Handlebars.Compiler.prototype.mustache.call(this, mustache);\n  }\n};\n\n/**\n  The entry point for SproutCore Handlebars. This replaces the default Handlebars.compile and turns on\n  template-local data and String parameters.\n\n  @param {String} string The template to compile\n*/\nSC.Handlebars.compile = function(string) {\n  var ast = Handlebars.parse(string);\n  var options = { data: true, stringParams: true };\n  var environment = new SC.Handlebars.Compiler().compile(ast, options);\n  var templateSpec = new SC.Handlebars.JavaScriptCompiler().compile(environment, options, undefined, true);\n\n  return Handlebars.template(templateSpec);\n};\n\n/**\n  Registers a helper in Handlebars that will be called if no property with the\n  given name can be found on the current context object, and no helper with\n  that name is registered.\n\n  This throws an exception with a more helpful error message so the user can\n  track down where the problem is happening.\n\n  @name Handlebars.helpers.helperMissing\n  @param {String} path\n  @param {Hash} options\n*/\nHandlebars.registerHelper('helperMissing', function(path, options) {\n  var error, view = \"\";\n\n  error = \"%@ Handlebars error: Could not find property '%@' on object %@.\";\n  if (options.data){\n    view = options.data.view;\n  }\n  throw new SC.Error(SC.String.fmt(error, [view, path, this]));\n});\n\n\n});");spade.register("sproutcore-handlebars/helpers", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire(\"sproutcore-handlebars/helpers/binding\");\nrequire(\"sproutcore-handlebars/helpers/collection\");\nrequire(\"sproutcore-handlebars/helpers/view\");\nrequire(\"sproutcore-handlebars/helpers/unbound\");\nrequire(\"sproutcore-handlebars/helpers/debug\");\n\n});");spade.register("sproutcore-handlebars/helpers/binding", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals Handlebars */\n\n\nrequire('sproutcore-handlebars/ext');\nrequire('sproutcore-handlebars/views/bindable_span');\n\nvar get = SC.get, getPath = SC.getPath, fmt = SC.String.fmt;\n\n(function() {\n  // Binds a property into the DOM. This will create a hook in DOM that the\n  // KVO system will look for and upate if the property changes.\n  var bind = function(property, options, preserveContext, shouldDisplay) {\n    var data = options.data,\n        fn = options.fn,\n        inverse = options.inverse,\n        view = data.view,\n        ctx  = this;\n\n    // Set up observers for observable objects\n    if ('object' === typeof this) {\n      // Create the view that will wrap the output of this template/property \n      // and add it to the nearest view's childViews array.\n      // See the documentation of SC._BindableSpanView for more.\n      var bindView = view.createChildView(SC._BindableSpanView, {\n        preserveContext: preserveContext,\n        shouldDisplayFunc: shouldDisplay,\n        displayTemplate: fn,\n        inverseTemplate: inverse,\n        property: property,\n        previousContext: ctx,\n        isEscaped: options.hash.escaped,\n\ttagName: options.hash.tagName || 'span'\n      });\n\n      var observer, invoker;\n\n      view.appendChild(bindView);\n\n      observer = function() {\n        if (get(bindView, 'element')) {\n          bindView.rerender();\n        } else {\n          // If no layer can be found, we can assume somewhere\n          // above it has been re-rendered, so remove the\n          // observer.\n          SC.removeObserver(ctx, property, invoker);\n        }\n      };\n\n      invoker = function() {\n        SC.run.once(observer);\n      };\n\n      // Observes the given property on the context and\n      // tells the SC._BindableSpan to re-render.\n      SC.addObserver(ctx, property, invoker);\n    } else {\n      // The object is not observable, so just render it out and\n      // be done with it.\n      data.buffer.push(getPath(this, property));\n    }\n  };\n\n  /**\n    `bind` can be used to display a value, then update that value if it \n    changes. For example, if you wanted to print the `title` property of \n    `content`:\n\n        {{bind \"content.title\"}}\n\n    This will return the `title` property as a string, then create a new \n    observer at the specified path. If it changes, it will update the value in \n    DOM. Note that if you need to support IE7 and IE8 you must modify the \n    model objects properties using SC.get() and SC.set() for this to work as \n    it relies on SC's KVO system.  For all other browsers this will be handled\n    for you automatically.\n\n    @private\n    @name Handlebars.helpers.bind\n    @param {String} property Property to bind\n    @param {Function} fn Context to provide for rendering\n    @returns {String} HTML string\n  */\n  Handlebars.registerHelper('bind', function(property, fn) {\n    sc_assert(\"You cannot pass more than one argument to the bind helper\", arguments.length <= 2);\n\n    return bind.call(this, property, fn, false, function(result) {\n      return !SC.none(result);\n    });\n  });\n\n  /**\n    Use the `boundIf` helper to create a conditional that re-evaluates \n    whenever the bound value changes.\n\n        {{#boundIf \"content.shouldDisplayTitle\"}}\n          {{content.title}}\n        {{/boundIf}}\n\n    @private\n    @name Handlebars.helpers.boundIf\n    @param {String} property Property to bind\n    @param {Function} fn Context to provide for rendering\n    @returns {String} HTML string\n  */\n  Handlebars.registerHelper('boundIf', function(property, fn) {\n    return bind.call(this, property, fn, true, function(result) {\n      if (SC.typeOf(result) === 'array') {\n        return get(result, 'length') !== 0;\n      } else {\n        return !!result;\n      }\n    } );\n  });\n})();\n\n/**\n  @name Handlebars.helpers.with\n  @param {Function} context\n  @param {Hash} options\n  @returns {String} HTML string\n*/\nHandlebars.registerHelper('with', function(context, options) {\n  sc_assert(\"You must pass exactly one argument to the with helper\", arguments.length == 2);\n  sc_assert(\"You must pass a block to the with helper\", options.fn && options.fn !== Handlebars.VM.noop);\n\n  return Handlebars.helpers.bind.call(options.contexts[0], context, options);\n});\n\n\n/**\n  @name Handlebars.helpers.if\n  @param {Function} context\n  @param {Hash} options\n  @returns {String} HTML string\n*/\nHandlebars.registerHelper('if', function(context, options) {\n  sc_assert(\"You must pass exactly one argument to the if helper\", arguments.length == 2);\n  sc_assert(\"You must pass a block to the if helper\", options.fn && options.fn !== Handlebars.VM.noop);\n\n  return Handlebars.helpers.boundIf.call(options.contexts[0], context, options);\n});\n\n/**\n  @name Handlebars.helpers.unless\n  @param {Function} context\n  @param {Hash} options\n  @returns {String} HTML string\n*/\nHandlebars.registerHelper('unless', function(context, options) {\n  sc_assert(\"You must pass exactly one argument to the unless helper\", arguments.length == 2);\n  sc_assert(\"You must pass a block to the unless helper\", options.fn && options.fn !== Handlebars.VM.noop);\n\n  var fn = options.fn, inverse = options.inverse;\n\n  options.fn = inverse;\n  options.inverse = fn;\n\n  return Handlebars.helpers.boundIf.call(options.contexts[0], context, options);\n});\n\n/**\n  `bindAttr` allows you to create a binding between DOM element attributes and\n  SproutCore objects. For example:\n\n      <img {{bindAttr src=\"imageUrl\" alt=\"imageTitle\"}}>\n\n  @name Handlebars.helpers.bindAttr\n  @param {Hash} options\n  @returns {String} HTML string\n*/\nHandlebars.registerHelper('bindAttr', function(options) {\n\n  var attrs = options.hash;\n\n  sc_assert(\"You must specify at least one hash argument to bindAttr\", !!SC.keys(attrs).length);\n\n  var view = options.data.view;\n  var ret = [];\n  var ctx = this;\n\n  // Generate a unique id for this element. This will be added as a\n  // data attribute to the element so it can be looked up when\n  // the bound property changes.\n  var dataId = jQuery.uuid++;\n\n  // Handle classes differently, as we can bind multiple classes\n  var classBindings = attrs['class'];\n  if (classBindings !== null && classBindings !== undefined) {\n    var classResults = SC.Handlebars.bindClasses(this, classBindings, view, dataId);\n    ret.push('class=\"' + classResults.join(' ') + '\"');\n    delete attrs['class'];\n  }\n\n  var attrKeys = SC.keys(attrs);\n\n  // For each attribute passed, create an observer and emit the\n  // current value of the property as an attribute.\n  attrKeys.forEach(function(attr) {\n    var property = attrs[attr];\n\n    sc_assert(fmt(\"You must provide a String for a bound attribute, not %@\", [property]), typeof property === 'string');\n\n    var value = getPath(ctx, property);\n\n    sc_assert(fmt(\"Attributes must be numbers, strings or booleans, not %@\", [value]), value == null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean');\n\n    var observer, invoker;\n\n    observer = function observer() {\n      var result = getPath(ctx, property);\n\n      sc_assert(fmt(\"Attributes must be numbers, strings or booleans, not %@\", [result]), result == null || typeof result === 'number' || typeof result === 'string' || typeof result === 'boolean');\n\n      var elem = view.$(\"[data-handlebars-id='\" + dataId + \"']\");\n\n      // If we aren't able to find the element, it means the element\n      // to which we were bound has been removed from the view.\n      // In that case, we can assume the template has been re-rendered\n      // and we need to clean up the observer.\n      if (elem.length === 0) {\n        SC.removeObserver(ctx, property, invoker);\n        return;\n      }\n\n      var currentValue = elem.attr(attr);\n\n      // A false result will remove the attribute from the element. This is\n      // to support attributes such as disabled, whose presence is meaningful.\n      if (result === false && currentValue) {\n        elem.removeAttr(attr);\n\n      // Likewise, a true result will set the attribute's name as the value.\n      } else if (result === true && currentValue !== attr) {\n        elem.attr(attr, attr);\n\n      } else if (currentValue !== result) {\n        elem.attr(attr, result);\n      }\n    };\n\n    invoker = function() {\n      SC.run.once(observer);\n    };\n\n    // Add an observer to the view for when the property changes.\n    // When the observer fires, find the element using the\n    // unique data id and update the attribute to the new value.\n    SC.addObserver(ctx, property, invoker);\n\n    // Use the attribute's name as the value when it is YES\n    if (value === true) {\n      value = attr;\n    }\n\n    // Do not add the attribute when the value is false\n    if (value !== false) {\n      // Return the current value, in the form src=\"foo.jpg\"\n      ret.push(attr + '=\"' + value + '\"');\n    }\n  }, this);\n\n  // Add the unique identifier\n  ret.push('data-handlebars-id=\"' + dataId + '\"');\n  return new Handlebars.SafeString(ret.join(' '));\n});\n\n/**\n  Helper that, given a space-separated string of property paths and a context,\n  returns an array of class names. Calling this method also has the side \n  effect of setting up observers at those property paths, such that if they \n  change, the correct class name will be reapplied to the DOM element.\n\n  For example, if you pass the string \"fooBar\", it will first look up the \n  \"fooBar\" value of the context. If that value is YES, it will add the \n  \"foo-bar\" class to the current element (i.e., the dasherized form of \n  \"fooBar\"). If the value is a string, it will add that string as the class. \n  Otherwise, it will not add any new class name.\n\n  @param {SC.Object} context \n    The context from which to lookup properties\n\n  @param {String} classBindings \n    A string, space-separated, of class bindings to use\n\n  @param {SC.View} view\n    The view in which observers should look for the element to update\n\n  @param {String} id \n    Optional id use to lookup elements\n\n  @returns {Array} An array of class names to add\n*/\nSC.Handlebars.bindClasses = function(context, classBindings, view, id) {\n  var ret = [], newClass, value, elem;\n\n  // Helper method to retrieve the property from the context and\n  // determine which class string to return, based on whether it is\n  // a Boolean or not.\n  var classStringForProperty = function(property) {\n    var val = getPath(context, property);\n\n    // If value is a Boolean and true, return the dasherized property\n    // name.\n    if (val === YES) {\n      // Normalize property path to be suitable for use\n      // as a class name. For exaple, content.foo.barBaz\n      // becomes bar-baz.\n      return SC.String.dasherize(get(property.split('.'), 'lastObject'));\n\n    // If the value is not NO, undefined, or null, return the current\n    // value of the property.\n    } else if (val !== NO && val !== undefined && val !== null) {\n      return val;\n\n    // Nothing to display. Return null so that the old class is removed\n    // but no new class is added.\n    } else {\n      return null;\n    }\n  };\n\n  // For each property passed, loop through and setup\n  // an observer.\n  classBindings.split(' ').forEach(function(property) {\n\n    // Variable in which the old class value is saved. The observer function\n    // closes over this variable, so it knows which string to remove when\n    // the property changes.\n    var oldClass;\n\n    var observer, invoker;\n\n    // Set up an observer on the context. If the property changes, toggle the\n    // class name.\n    observer = function() {\n      // Get the current value of the property\n      newClass = classStringForProperty(property);\n      elem = id ? view.$(\"[data-handlebars-id='\" + id + \"']\") : view.$();\n\n      // If we can't find the element anymore, a parent template has been\n      // re-rendered and we've been nuked. Remove the observer.\n      if (elem.length === 0) {\n        SC.removeObserver(context, property, invoker);\n      } else {\n        // If we had previously added a class to the element, remove it.\n        if (oldClass) {\n          elem.removeClass(oldClass);\n        }\n\n        // If necessary, add a new class. Make sure we keep track of it so\n        // it can be removed in the future.\n        if (newClass) {\n          elem.addClass(newClass);\n          oldClass = newClass;\n        } else {\n          oldClass = null;\n        }\n      }\n    };\n\n    invoker = function() {\n      SC.run.once(observer);\n    };\n\n    SC.addObserver(context, property, invoker);\n\n    // We've already setup the observer; now we just need to figure out the \n    // correct behavior right now on the first pass through.\n    value = classStringForProperty(property);\n\n    if (value) {\n      ret.push(value);\n\n      // Make sure we save the current value so that it can be removed if the \n      // observer fires.\n      oldClass = value;\n    }\n  });\n\n  return ret;\n};\n\n\n});");spade.register("sproutcore-handlebars/helpers/collection", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals Handlebars sc_assert */\n\n// TODO: Don't require all of this module\nrequire('sproutcore-handlebars');\nrequire('sproutcore-handlebars/helpers/view');\n\nvar get = SC.get;\n\n/**\n  @name Handlebars.helpers.collection\n  @param {String} path\n  @param {Hash} options\n  @returns {String} HTML string\n*/\nHandlebars.registerHelper('collection', function(path, options) {\n  // If no path is provided, treat path param as options.\n  if (path && path.data && path.data.isRenderData) {\n    options = path;\n    path = undefined;\n    sc_assert(\"You cannot pass more than one argument to the collection helper\", arguments.length === 1);\n  } else {\n    sc_assert(\"You cannot pass more than one argument to the collection helper\", arguments.length === 2);\n  }\n\n  var fn = options.fn;\n  var data = options.data;\n  var inverse = options.inverse;\n\n  // If passed a path string, convert that into an object.\n  // Otherwise, just default to the standard class.\n  var collectionClass;\n  collectionClass = path ? SC.getPath(this, path) : SC.CollectionView;\n  sc_assert(\"%@ #collection: Could not find %@\".fmt(data.view, path), !!collectionClass);\n\n  var hash = options.hash, itemHash = {}, match;\n\n  // Extract item view class if provided else default to the standard class\n  var itemViewClass, itemViewPath = hash.itemViewClass;\n  var collectionPrototype = get(collectionClass, 'proto');\n  delete hash.itemViewClass;\n  itemViewClass = itemViewPath ? SC.getPath(collectionPrototype, itemViewPath) : collectionPrototype.itemViewClass;\n  sc_assert(\"%@ #collection: Could not find %@\".fmt(data.view, itemViewPath), !!itemViewClass);\n\n  // Go through options passed to the {{collection}} helper and extract options\n  // that configure item views instead of the collection itself.\n  for (var prop in hash) {\n    if (hash.hasOwnProperty(prop)) {\n      match = prop.match(/^item(.)(.*)$/);\n\n      if(match) {\n        // Convert itemShouldFoo -> shouldFoo\n        itemHash[match[1].toLowerCase() + match[2]] = hash[prop];\n        // Delete from hash as this will end up getting passed to the\n        // {{view}} helper method.\n        delete hash[prop];\n      }\n    }\n  }\n\n  var tagName = hash.tagName || get(collectionClass, 'proto').tagName;\n\n  if (fn) {\n    itemHash.template = fn;\n    delete options.fn;\n  }\n\n  if (inverse && inverse !== Handlebars.VM.noop) {\n    hash.emptyView = SC.View.extend({\n      template: inverse,\n      tagName: itemHash.tagName\n    });\n  }\n\n  if (hash.preserveContext) {\n    itemHash.templateContext = function() {\n      return get(this, 'content');\n    }.property('content');\n    delete hash.preserveContext;\n  }\n\n  hash.itemViewClass = SC.Handlebars.ViewHelper.viewClassFromHTMLOptions(itemViewClass, itemHash);\n\n  return Handlebars.helpers.view.call(this, collectionClass, options);\n});\n\n/**\n  @name Handlebars.helpers.each\n  @param {String} path\n  @param {Hash} options\n  @returns {String} HTML string\n*/\nHandlebars.registerHelper('each', function(path, options) {\n  options.hash.contentBinding = SC.Binding.from('parentView.'+path).oneWay();\n  options.hash.preserveContext = true;\n  return Handlebars.helpers.collection.call(this, null, options);\n});\n\n\n\n});");spade.register("sproutcore-handlebars/helpers/debug", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals Handlebars */\n\n\nrequire('sproutcore-handlebars/ext');\n\nvar getPath = SC.getPath;\n\n/**\n  `log` allows you to output the value of a value in the current rendering\n  context.\n\n    {{log myVariable}}\n\n  @name Handlebars.helpers.log\n  @param {String} property\n*/\nHandlebars.registerHelper('log', function(property) {\n  console.log(getPath(this, property));\n});\n\n/**\n  The `debugger` helper executes the `debugger` statement in the current\n  context.\n\n    {{debugger}}\n\n  @name Handlebars.helpers.debugger\n  @param {String} property\n*/\nHandlebars.registerHelper('debugger', function() {\n  debugger;\n});\n\n});");spade.register("sproutcore-handlebars/helpers/unbound", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals Handlebars */\n\n\nrequire('sproutcore-handlebars/ext');\n\nvar getPath = SC.getPath;\n\n/**\n  `unbound` allows you to output a property without binding. *Important:* The \n  output will not be updated if the property changes. Use with caution.\n\n      <div>{{unbound somePropertyThatDoesntChange}}</div>\n\n  @name Handlebars.helpers.unbound\n  @param {String} property\n  @returns {String} HTML string\n*/\nHandlebars.registerHelper('unbound', function(property) {\n  return getPath(this, property);\n});\n\n});");spade.register("sproutcore-handlebars/helpers/view", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals Handlebars sc_assert */\n\n// TODO: Don't require the entire module\nrequire(\"sproutcore-handlebars\");\n\nvar get = SC.get, set = SC.set;\nvar PARENT_VIEW_PATH = /^parentView\\./;\n\n/** @private */\nSC.Handlebars.ViewHelper = SC.Object.create({\n\n  viewClassFromHTMLOptions: function(viewClass, options, thisContext) {\n    var extensions = {},\n        classes = options['class'],\n        dup = false;\n\n    if (options.id) {\n      extensions.elementId = options.id;\n      dup = true;\n    }\n\n    if (classes) {\n      classes = classes.split(' ');\n      extensions.classNames = classes;\n      dup = true;\n    }\n\n    if (options.classBinding) {\n      extensions.classNameBindings = options.classBinding.split(' ');\n      dup = true;\n    }\n\n    if (dup) {\n      options = jQuery.extend({}, options);\n      delete options.id;\n      delete options['class'];\n      delete options.classBinding;\n    }\n\n    // Look for bindings passed to the helper and, if they are\n    // local, make them relative to the current context instead of the\n    // view.\n    var path;\n\n    for (var prop in options) {\n      if (!options.hasOwnProperty(prop)) { continue; }\n\n      // Test if the property ends in \"Binding\"\n      if (SC.IS_BINDING.test(prop)) {\n        path = options[prop];\n        if (!SC.isGlobalPath(path)) {\n\n          // Deprecation warning for users of beta 2 and lower, where\n          // this facility was not available. The workaround was to bind\n          // to parentViews; since this is no longer necessary, issue\n          // a notice.\n          if (PARENT_VIEW_PATH.test(path)) {\n            SC.Logger.warn(\"As of SproutCore 2.0 beta 3, it is no longer necessary to bind to parentViews. Instead, please provide binding paths relative to the current Handlebars context.\");\n          } else {\n            options[prop] = 'bindingContext.'+path;\n          }\n        }\n      }\n    }\n\n    // Make the current template context available to the view\n    // for the bindings set up above.\n    extensions.bindingContext = thisContext;\n\n    return viewClass.extend(options, extensions);\n  },\n\n  helper: function(thisContext, path, options) {\n    var inverse = options.inverse,\n        data = options.data,\n        view = data.view,\n        fn = options.fn,\n        hash = options.hash,\n        newView;\n\n    if ('string' === typeof path) {\n      newView = SC.getPath(thisContext, path);\n      sc_assert(\"Unable to find view at path '\" + path + \"'\", !!newView);\n    } else {\n      newView = path;\n    }\n\n    sc_assert(SC.String.fmt('You must pass a view class to the #view helper, not %@ (%@)', [path, newView]), SC.View.detect(newView));\n\n    newView = this.viewClassFromHTMLOptions(newView, hash, thisContext);\n    var currentView = data.view;\n    var viewOptions = {};\n\n    if (fn) {\n      sc_assert(\"You cannot provide a template block if you also specified a templateName\", !get(viewOptions, 'templateName') && !newView.PrototypeMixin.keys().indexOf('templateName') >= 0);\n      viewOptions.template = fn;\n    }\n\n    currentView.appendChild(newView, viewOptions);\n  }\n});\n\n/**\n  @name Handlebars.helpers.view\n  @param {String} path\n  @param {Hash} options\n  @returns {String} HTML string\n*/\nHandlebars.registerHelper('view', function(path, options) {\n  sc_assert(\"The view helper only takes a single argument\", arguments.length <= 2);\n\n  // If no path is provided, treat path param as options.\n  if (path && path.data && path.data.isRenderData) {\n    options = path;\n    path = \"SC.View\";\n  }\n\n  return SC.Handlebars.ViewHelper.helper(this, path, options);\n});\n\n\n});");spade.register("sproutcore-handlebars/loader", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals Handlebars */\n\n\nrequire(\"sproutcore-handlebars/ext\");\n\n// Find templates stored in the head tag as script tags and make them available\n// to SC.CoreView in the global SC.TEMPLATES object.\n\nSC.$(document).ready(function() {\n  SC.$('script[type=\"text/html\"], script[type=\"text/x-handlebars\"]')\n    .each(function() {\n    // Get a reference to the script tag\n    var script = SC.$(this),\n      // Get the name of the script, used by SC.View's templateName property.\n      // First look for data-template-name attribute, then fall back to its\n      // id if no name is found.\n      templateName = script.attr('data-template-name') || script.attr('id'),\n      template = SC.Handlebars.compile(script.html()),\n      view, viewPath;\n\n    if (templateName) {\n      // For templates which have a name, we save them and then remove them from the DOM\n      SC.TEMPLATES[templateName] = template;\n\n      // Remove script tag from DOM\n      script.remove();\n    } else {\n      if (script.parents('head').length !== 0) {\n        // don't allow inline templates in the head\n        throw new SC.Error(\"Template found in \\<head\\> without a name specified. \" +\n                         \"Please provide a data-template-name attribute.\\n\" +\n                         script.html());\n      }\n\n      // For templates which will be evaluated inline in the HTML document, instantiates a new\n      // view, and replaces the script tag holding the template with the new\n      // view's DOM representation.\n      //\n      // Users can optionally specify a custom view subclass to use by setting the\n      // data-view attribute of the script tag.\n      viewPath = script.attr('data-view');\n      view = viewPath ? SC.getPath(viewPath) : SC.View;\n\n      view = view.create({\n        template: template\n      });\n\n      view._insertElementLater(function() {\n        script.replaceWith(this.$());\n\n        // Avoid memory leak in IE\n        script = null;\n      });\n    }\n  });\n});\n\n});");spade.register("sproutcore-handlebars", {"name":"sproutcore-handlebars","version":"2.0.beta.3","dependencies":{"spade":"~> 1.0.0","handlebars":"~> 1.0.0.beta.3","sproutcore-views":"2.0.beta.3","sproutcore-handlebars-format":"~> 2.0.beta.3"}});

spade.register("sproutcore-handlebars/main", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire(\"sproutcore-runtime\");\nrequire(\"sproutcore-views\");\nrequire(\"sproutcore-handlebars/ext\");\nrequire(\"sproutcore-handlebars/helpers\");\nrequire(\"sproutcore-handlebars/views\");\nrequire(\"sproutcore-handlebars/controls\");\nrequire(\"sproutcore-handlebars/loader\");\n\n});");spade.register("sproutcore-handlebars/views", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire(\"sproutcore-handlebars/views/bindable_span\");\n\n});");spade.register("sproutcore-handlebars/views/bindable_span", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore Handlebar Views\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n/*globals Handlebars */\n\n\nvar get = SC.get, set = SC.set, getPath = SC.getPath;\n\nrequire('sproutcore-views/views/view');\n\n/**\n  @ignore\n  @private\n  @class\n\n  SC._BindableSpanView is a private view created by the Handlebars `{{bind}}` \n  helpers that is used to keep track of bound properties.\n\n  Every time a property is bound using a `{{mustache}}`, an anonymous subclass \n  of SC._BindableSpanView is created with the appropriate sub-template and \n  context set up. When the associated property changes, just the template for \n  this view will re-render.\n*/\nSC._BindableSpanView = SC.View.extend(\n/** @scope SC._BindableSpanView.prototype */{\n\n  /**\n   The type of HTML tag to use. To ensure compatibility with\n   Internet Explorer 7, a `<span>` tag is used to ensure that inline elements are\n   not rendered with display: block.\n\n   @type String\n   @default 'span'\n  */\n  tagName: 'span',\n\n  /**\n    The function used to determine if the `displayTemplate` or\n    `inverseTemplate` should be rendered. This should be a function that takes\n    a value and returns a Boolean.\n\n    @type Function\n    @default null\n  */\n  shouldDisplayFunc: null,\n\n  /**\n    Whether the template rendered by this view gets passed the context object\n    of its parent template, or gets passed the value of retrieving `property`\n    from the previous context.\n\n    For example, this is true when using the `{{#if}}` helper, because the \n    template inside the helper should look up properties relative to the same \n    object as outside the block. This would be NO when used with `{{#with \n    foo}}` because the template should receive the object found by evaluating \n    `foo`.\n\n    @type Boolean\n    @default false\n  */\n  preserveContext: false,\n\n  /**\n    The template to render when `shouldDisplayFunc` evaluates to true.\n\n    @type Function\n    @default null\n  */\n  displayTemplate: null,\n\n  /**\n    The template to render when `shouldDisplayFunc` evaluates to false.\n\n    @type Function\n    @default null\n  */\n  inverseTemplate: null,\n\n  /**\n    The key to look up on `previousContext` that is passed to\n    `shouldDisplayFunc` to determine which template to render.\n\n    In addition, if `preserveContext` is false, this object will be passed to \n    the template when rendering.\n\n    @type String\n    @default null\n  */\n  property: null,\n\n  /**\n    Determines which template to invoke, sets up the correct state based on\n    that logic, then invokes the default SC.View `render` implementation.\n\n    This method will first look up the `property` key on `previousContext`,\n    then pass that value to the `shouldDisplayFunc` function. If that returns\n    true, the `displayTemplate` function will be rendered to DOM. Otherwise,\n    `inverseTemplate`, if specified, will be rendered.\n\n    For example, if this SC._BindableSpan represented the {{#with foo}} \n    helper, it would look up the `foo` property of its context, and \n    `shouldDisplayFunc` would always return true. The object found by looking \n    up `foo` would be passed to `displayTemplate`.\n\n    @param {SC.RenderBuffer} buffer\n  */\n  render: function(buffer) {\n    // If not invoked via a triple-mustache ({{{foo}}}), escape\n    // the content of the template.\n    var escape = get(this, 'isEscaped');\n\n    var shouldDisplay = get(this, 'shouldDisplayFunc'),\n        property = get(this, 'property'),\n        preserveContext = get(this, 'preserveContext'),\n        context = get(this, 'previousContext');\n\n    var inverseTemplate = get(this, 'inverseTemplate'),\n        displayTemplate = get(this, 'displayTemplate');\n\n    var result = getPath(context, property);\n\n    // First, test the conditional to see if we should\n    // render the template or not.\n    if (shouldDisplay(result)) {\n      set(this, 'template', displayTemplate);\n\n      // If we are preserving the context (for example, if this\n      // is an #if block, call the template with the same object.\n      if (preserveContext) {\n        set(this, 'templateContext', context);\n      } else {\n      // Otherwise, determine if this is a block bind or not.\n      // If so, pass the specified object to the template\n        if (displayTemplate) {\n          set(this, 'templateContext', result);\n        } else {\n        // This is not a bind block, just push the result of the\n        // expression to the render context and return.\n          if (result == null) { result = \"\"; } else { result = String(result); }\n          if (escape) { result = Handlebars.Utils.escapeExpression(result); }\n          buffer.push(result);\n          return;\n        }\n      }\n    } else if (inverseTemplate) {\n      set(this, 'template', inverseTemplate);\n\n      if (preserveContext) {\n        set(this, 'templateContext', context);\n      } else {\n        set(this, 'templateContext', result);\n      }\n    } else {\n      set(this, 'template', function() { return ''; });\n    }\n\n    return this._super(buffer);\n  }\n});\n\n});");spade.register("sproutcore", {"name":"sproutcore","version":"2.0.beta.3","dependencies":{"spade":"~> 1.0.0","sproutcore-runtime":"2.0.beta.3","sproutcore-views":"2.0.beta.3","sproutcore-handlebars":"2.0.beta.3","sproutcore-handlebars-format":"~> 2.0.beta.3"}});

spade.register("sproutcore/main", "(function(require, exports, __module, ARGV, ENV, __filename){// ==========================================================================\n// Project:   SproutCore\n// Copyright: ©2011 Strobe Inc. and contributors.\n// License:   Licensed under MIT license (see license.js)\n// ==========================================================================\n\nrequire('sproutcore-metal');\nrequire('sproutcore-views');\nrequire('sproutcore-handlebars');\n\n});");// ==========================================================================
// Project:   newtwitter
// Copyright: ©2011 My Company Inc. All rights reserved.
// ==========================================================================

spade.require("sproutcore");

var NewTwitter = SC.Application.create({
});

NewTwitter.appController = SC.Object.create({
  selectedTab: "timeline",
  authorized: false,
  userName: null,

  changeTab: function(tabName) {
    var oldTabName = this.get('selectedTab');
    this.set('selectedTab', tabName);
    console.log("hiding " + oldTabName + ", showing " + tabName);
    $('#'+oldTabName).hide();
    $('#'+tabName).show();
  },

  currentView: function() {
    console.log('currentView observer fired');
    NewTwitter[this.get('selectedTab') + 'Controller'].load();
  }.observes('selectedTab', 'authorized'),

  auth: function(showPopup) {
    var self = this;
    $.getJSON("/_strobe/social/twitter/authentication", {oauth_callback: location.origin + "/_strobe/social/twitter/callback"}, function(data) {
      console.log(data);
      if (data.authentication.status === "authenticated") {
        clearInterval(NewTwitter.authPoller);
        $.getJSON("/_strobe/social/twitter/1/account/verify_credentials.json", function(data) {
          self.set("userName", data.screen_name);
          NewTwitter.userController.loadUser(data);
          NewTwitter.appController.set('authorized', true);
          $('#container').show();
        });
      } else if (showPopup === true) {
        NewTwitter.authWindow = window.open(data.authentication.authentication_uri, 'twitter_auth_window');
        if (!NewTwitter.authWindow) {
          alert('Please turn off your popup blocker...');
        } else {
          if (NewTwitter.authPoller) { clearInterval(NewTwitter.authPoller); }
          NewTwitter.authPoller = setInterval(function() {
            NewTwitter.appController.auth();
          }, 1000);
        }
      }
    });
  },

  deauth: function() {
    $.ajax("/_strobe/social/twitter/authentication", {type: "DELETE", complete: function(xhr, stat) {
      NewTwitter.appController.set('authorized', false);
      $('#container').hide();
    }});
  }
});

NewTwitter.Tweet = SC.Object.extend({
  body: null,
  screenName: null,
  name: null,
  time: null,
  profileImage: null,

  humanTime: function() {
    return jQuery.timeago(this.get('time'));
  }.property('time'),
  screenNameHash: function() {
    return '#' + this.get('screenName');
  }.property('screenName'),
  linkedBody: function() {
    var body = this.get('body');
    return body.replace(/@(\w+)/g, "<a href='#$1'>@$1</a>");
  }.property('body')
});

NewTwitter.timelineController = SC.ArrayProxy.create({
  content: [],
  loaded: false,

  load: function() {
    var self = this;
    $.getJSON("/_strobe/social/twitter/1/statuses/home_timeline.json?count=30", function(data) {
      NewTwitter.timelineController.loadTweets(data);
      self.set('loaded', true);
    });
    $.getJSON("/_strobe/social/twitter/1/friends/ids.json?include_entities=true", function(data) {
      NewTwitter.userController.loadFriends(data);
    });
    $.getJSON("/_strobe/social/twitter/1/followers/ids.json?include_entities=true", function(data, stat, xhr) {
      NewTwitter.userController.loadFollowers(data);
    });
  },

  loadTweets: function(tweets) {
    this.set('content', []);
    var self = this;
    tweets.forEach(function(data) {
      var tweet = NewTwitter.Tweet.create({
        body: data.text, screenName: data.user.screen_name, name: data.user.name,
        time: data.created_at, profileImage: data.user.profile_image_url
      });
      self.pushObject(tweet);
    });
  }
});

NewTwitter.mentionsController = SC.ArrayProxy.create({
  content: [],
  loaded: false,

  load: function() {
    var self = this;
    $.getJSON("/_strobe/social/twitter/1/statuses/mentions.json", function(data) {
      NewTwitter.mentionsController.loadTweets(data);
      self.set('loaded', true);
    });
  },

  loadTweets: function(tweets) {
    this.set('content', []);
    var self = this;
    tweets.forEach(function(data) {
      var tweet = NewTwitter.Tweet.create({
        body: data.text, screenName: data.user.screen_name, name: data.user.name,
        time: data.created_at, profileImage: data.user.profile_image_url
      });
      self.pushObject(tweet);
    });
  }
});

NewTwitter.userController = SC.Object.create({
  followersCount: null,
  followingCount: null,
  tweetCount: null,
  friends: [],
  followers: [],
  lastTweet: null,

  loadUser: function(data) {
    this.set('followersCount', data.followers_count);
    this.set('followingCount', data.friends_count);
    this.set('tweetCount', data.statuses_count);
    this.set('lastTweet', NewTwitter.Tweet.create({
      body: data.status.text, screenName: data.screen_name, name: data.name,
      time: data.status.created_at, profileImage: data.profile_image_url
    }));
  },

  loadFriends: function(data) {
    this.set('friends', []);
    var self = this;
    jQuery.getJSON("/_strobe/proxy/api.twitter.com/1/users/lookup.json", {user_id: data.slice(0, 5).join(',')}, function(friends_data) {
      friends_data.forEach(function(friend) {
        self.get('friends').pushObject(SC.Object.create({image: friend.profile_image_url}));
      });
    });
  },

  loadFollowers: function(data) {
    this.set('followers', []);
    var self = this;
    jQuery.getJSON("/_strobe/proxy/api.twitter.com/1/users/lookup.json", {user_id: data.slice(0, 5).join(',')}, function(friends_data) {
      friends_data.forEach(function(friend) {
        self.get('followers').pushObject(SC.Object.create({image: friend.profile_image_url}));
      });
    });

  }
});

NewTwitter.tweetController = SC.Object.create({
  content: null
});

NewTwitter.TweetStream = SC.CollectionView.extend({
  tagName: "div",
  itemViewClass: SC.View.extend({
    classNames: ['tweet'],
    click: function() {
      NewTwitter.tweetController.set('content', this.get('content'));
    }
  })
});

NewTwitter.DetailView = SC.View.extend({
  elementId: 'details',
  selectedTweetBinding: "NewTwitter.tweetController.content",
  isVisible: function(key, val) {
    if (this.get('selectedTweet')) { return true; }
    return false;
  }.property('selectedTweet'),
  close: function() {
    this.set('selectedTweet', null);
  }
});

NewTwitter.LastTweetView = SC.View.extend({
  contentBinding: 'NewTwitter.userController.lastTweet',
  countBinding: 'NewTwitter.userController.tweetCount',
  truncatedBody: function() {
    var content = this.get('content');
    if (!content) { return; }
    return content.get('body').substring(0, 35) + '...';
  }.property('content')
});

NewTwitter.FollowingView = SC.View.extend({
  countBinding: 'NewTwitter.userController.followingCount'
});

NewTwitter.FollowersView = SC.View.extend({
  countBinding: 'NewTwitter.userController.followersCount'
});

NewTwitter.TabItem = SC.View.extend({
  tagName: 'li',
  classNameBindings: ['isActive:active'],
  tabName: null,

  selectedTabBinding: "NewTwitter.appController.selectedTab",
  click: function() {
    NewTwitter.appController.changeTab(this.get('tabName'));
  },
  isActive: function() {
    return this.get('tabName') === this.get('selectedTab');
  }.property('selectedTab'),
});


NewTwitter.TweetForm = SC.View.extend({
  tagName: 'form',

  charsRemaining: function() {
    return 140 - this.getPath('textArea.charCount');
  }.property('textArea.charCount').cacheable(),

  textArea: null,
 
  TextArea: SC.TextArea.extend({
    init: function() {
      this._super();
      this.setPath('parentView.textArea', this);
    },
    charCount: function() {
      var val = this.get('value');
      return val ? val.length : 0;
    }.property('value').cacheable()
  }),

  submit: function(event) {
    var self = this;
    console.log('submit event: ' + event);
    $.post("/_strobe/social/twitter/1/statuses/update.json", {status: this.getPath('textArea.value')}, function(data) {
      self.setPath("textArea.value", "");
      NewTwitter.timelineController.load();
    });

    return false;
  }
});

$(function(){
  NewTwitter.appController.auth();
  NewTwitter.timelineController.load();
});
