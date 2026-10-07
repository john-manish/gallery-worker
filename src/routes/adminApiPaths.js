
// =========================================================
// ADMIN API PATH MATCHING
// =========================================================
//
// This file only decides which /admin/* requests
// should be handled by routes/admin.js.
//
// It does NOT implement the routes themselves.
// =========================================================

export function isAdminApiPath(pathname) {

    return (

        // ==============================
        // DASHBOARD
        // ==============================
        pathname === "/admin/stats" ||
        pathname === "/admin/storage" ||

        // ==============================
        // ALBUMS
        // ==============================
        pathname === "/admin/albums" ||
        pathname === "/admin/album" ||
        pathname.startsWith("/admin/album/") ||

        // ==============================
        // IMAGES
        // ==============================
        pathname === "/admin/images" ||
        pathname === "/admin/images/search" ||
        pathname.startsWith("/admin/images/") ||

        // ==============================
        // UPLOAD
        // ==============================
        pathname === "/admin/upload" ||

        // ==============================
        // SCANNER
        // ==============================
        pathname === "/admin/health" ||
        pathname === "/admin/report" ||
        pathname === "/admin/duplicates" ||
        pathname === "/admin/rebuild" ||
        pathname === "/admin/repair" ||
        pathname === "/admin/clean" ||
        pathname === "/admin/rebuild-thumbs" ||
        pathname === "/admin/sync" ||

        // ==============================
        // ANALYTICS
        // ==============================
        pathname === "/admin/history" ||
        pathname === "/admin/activity" ||
        pathname === "/admin/activity/session" ||

        // ==============================
        // EXPLORER
        // ==============================
        pathname === "/admin/explorer/tree" ||
        pathname === "/admin/explorer/files" ||
        pathname === "/admin/explorer/storage" ||
        pathname === "/admin/explorer/folder" ||
        pathname === "/admin/explorer/file" ||

        // ==============================
        // EXISTING ADMIN DEBUG
        // ==============================
        pathname === "/admin/drive-files" ||
        pathname === "/admin/env-debug"
    );
}