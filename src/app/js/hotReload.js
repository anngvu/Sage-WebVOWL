/**
 * Reloads the ontology in place when its JSON changes on disk.
 *
 * This exists because the usual route -- grunt-contrib-watch's livereload --
 * does not work in this dependency stack: the watcher and its livereload server
 * run fine, but connect-livereload (0.6, ~10 years old) never injects its
 * snippet into the served page, so the browser is never told to refresh. Rather
 * than carry a patched fork of that, the app polls for a changed ontology
 * itself, which also means hot reload works behind *any* static server --
 * `make serve`, `npx serve`, grunt, or a published copy.
 *
 * Only the ontology is refetched, not the page, so the reload path is exactly
 * the one the app already uses for a manual reload.
 *
 * Off unless window.WEBVOWL_HOT_RELOAD is set. index.html sets it inside a
 * `build:remove release` block, so it is present in `grunt package` (dev) and
 * stripped from `grunt release`.
 *
 * @param graph the graph whose ontology should be reloaded
 */
module.exports = function ( graph ){

  var hotReload = {},
    DEFAULT_INTERVAL_MS = 1500,
    timer,
    lastSignature;


  function config(){
    return typeof window !== "undefined" ? window.WEBVOWL_HOT_RELOAD : undefined;
  }

  hotReload.enabled = function (){
    var options = config();
    return !!(options && options.enabled !== false);
  };

  /**
   * The identity of the currently served ontology file. ETag is preferred;
   * Last-Modified is the fallback for servers that do not send one.
   */
  function signatureOf( request ){
    var etag = request.getResponseHeader("ETag");
    var modified = request.getResponseHeader("Last-Modified");
    var length = request.getResponseHeader("Content-Length");
    return [etag, modified, length].join("|");
  }

  function check( url, onChange ){
    var request = new XMLHttpRequest();

    // HEAD, so polling does not refetch a megabyte of JSON every tick.
    request.open("HEAD", url, true);
    request.onload = function (){
      if ( request.status < 200 || request.status >= 300 ) {
        return;
      }

      var signature = signatureOf(request);

      if ( lastSignature === undefined ) {
        lastSignature = signature;   // first poll only establishes a baseline
        return;
      }
      if ( signature === lastSignature ) {
        return;
      }

      lastSignature = signature;
      onChange();
    };
    request.onerror = function (){
      // A dev server restarting is normal; keep polling.
    };
    request.send();
  }

  function reloadOntology(){
    console.log("[hot reload] ontology changed, reloading");
    var ontologyMenu = graph.options().ontologyMenu();

    if ( ontologyMenu && ontologyMenu.reloadCachedOntology ) {
      // Drops the in-app cache first, otherwise the reload just re-parses the
      // copy already in memory.
      ontologyMenu.reloadCachedOntology();
    }
  }

  hotReload.setup = function (){
    if ( !hotReload.enabled() ) {
      return;
    }

    var options = config();
    var interval = options.intervalMs || DEFAULT_INTERVAL_MS;
    var name = options.ontology || graph.options().loadingModule().getDefaultJsonName();
    var url = "./data/" + name + ".json";

    console.log("[hot reload] watching " + url + " every " + interval + "ms");

    timer = setInterval(function (){
      check(url, reloadOntology);
    }, interval);
  };

  hotReload.stop = function (){
    if ( timer ) {
      clearInterval(timer);
      timer = undefined;
    }
  };


  return hotReload;
};
