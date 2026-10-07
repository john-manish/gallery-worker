// ======================================
// API ENDPOINTS
// ======================================

window.API = {

    // AUTH
    LOGIN:
        "/auth/login",

    LOGOUT:
        "/auth/logout",

    LOGOUT_ALL:
        "/auth/logout-all",


    // DASHBOARD
    STATS:
        "/admin/stats",

    HEALTH:
        "/admin/health",

    STORAGE:
        "/admin/storage",

    HISTORY:
        "/admin/history",


    // GALLERY
    ALBUMS:
        "/admin/albums",

    ALBUM:
        "/admin/album",

    IMAGES:
        "/admin/images",

    IMAGE:
        "/admin/image",

    UPLOAD:
        "/admin/upload",


    // ARTICLES
    ARTICLES:
        "/admin/articles",

    ARTICLE_ASSETS:
        "/api/admin/article-assets",

    ARTICLE_MEDIA: article =>
        `/admin/article-media/${encodeURIComponent(article)}`,


    // SCANNER
    SCAN:
        "/admin/scan",

    THUMBS:
        "/admin/rebuild-thumbs",

    REPAIR:
        "/admin/repair",

    CLEAN:
        "/admin/clean",

    REPORT:
        "/admin/report",


    // ACTIVITY
    ACTIVITY:
        "/admin/activity",

    SESSION_ACTIVITY:
        "/admin/activity/session",


    // EXPLORER
    EXPLORER_TREE:
        "/admin/explorer/tree",

    EXPLORER_FOLDER:
        "/admin/explorer/folder",

    EXPLORER_FILE:
        "/admin/explorer/file",


    // SEARCH
    IMAGE_SEARCH:
        "/admin/images/search",

    // DUPLICATES
    DUPLICATES:
        "/admin/duplicates"

};


// ======================================
// API HELPER
// ======================================

window.api = async function(
    url,
    options = {}
) {

    const requestOptions = {
        credentials: "include",
        ...options,
        headers: {
            ...(options.body instanceof FormData
                ? {}
                : {
                    "Content-Type": "application/json"
                }),
            ...(options.headers || {})
        }
    };


    const response =
        await fetch(
            url,
            requestOptions
        );


    /*
     * Some endpoints may return
     * an empty response.
     */

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";


    let data;


    if(
        contentType.includes(
            "application/json"
        )
    ){

        data =
            await response.json();

    } else {

        data =
            await response.text();

    }


    if(!response.ok){

        const message =
            typeof data === "object"
                ? (
                    data.message ||
                    data.error ||
                    "Request failed"
                )
                : (
                    data ||
                    "Request failed"
                );

        throw new Error(message);

    }


    return data;

};