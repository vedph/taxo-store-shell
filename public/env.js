// https://www.jvandemo.com/how-to-use-environment-variables-to-configure-your-angular-application-without-a-rebuild/
(function (window) {
  window.__env = window.__env || {};

  // environment-dependent settings
  window.__env.apiUrl = "http://localhost:5168/api/";
  window.__env.taxoUrl = "http://localhost:5168/api/";
  window.__env.version = '0.0.1';
  // enable thesaurus import in thesaurus list for admins
  window.__env.thesImportEnabled = true;
})(this);
