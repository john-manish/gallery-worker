const CACHE_NAME = "gallery-os-v2";


self.addEventListener("install", event => {

    self.skipWaiting();

});


self.addEventListener("activate", event => {

    event.waitUntil(
        self.clients.claim()
    );

});


self.addEventListener("fetch", event => {

    // Do not intercept admin requests.
    // Let the browser handle everything normally.

    return;

});