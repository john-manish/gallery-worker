// =========================================================
// API ROUTES
// =========================================================

import { requireAdmin } from "./auth/authMiddleware.js";
import { requireImageAuth } from "./auth/imageAuth.js";
import {
    authenticateFrontend
} from "./auth/frontendAuth.js";


import { adminRoute } from "./routes/admin.js";
import { adminArticlesRoute } from "./routes/adminArticles.js";
import { isAdminApiPath } from "./routes/adminApiPaths.js";

import { authRoute } from "./routes/auth.js";
import { frontendAuthRoute } from "./routes/frontendAuth.js";
import { frontendAdminRoute } from "./routes/frontendAdmin.js";

import { articlesRoute } from "./routes/articles.js";
import { galleryRoute } from "./routes/gallery.js";
import { imageRoute } from "./routes/image.js";
import { thumbRoute } from "./routes/thumb.js";

import { getDriveFile } from "./drive/google.js";
import { readGallery } from "./gallery/repository.js";


// =========================================================
// HELPERS
// =========================================================

function jsonError(message, status = 404) {
  return Response.json(
    {
      ok: false,
      error: message
    },
    { status }
  );
}




// =========================================================
// CENTRALIZED CORS — Render-style allowlist
// =========================================================

function getAllowedOrigins(env) {
  return [
    "https://manish8090.dpdns.org",
    "https://manish8090.pages.dev",
    "https://gallery-worker.manish8090101.workers.dev",
    "https://api.manish8090.dpdns.org",

    env.RENDER_EXTERNAL_URL,

    "http://localhost:3000",
    "http://localhost:8080",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:8788",
    "http://127.0.0.1:8080"
  ].filter(Boolean);
}

function applyCors(request, response, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins(env);

  const headers = new Headers(response.headers);

  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    headers.set(
      "Access-Control-Allow-Headers",
      request.headers.get("Access-Control-Request-Headers") ||
        "Content-Type, Authorization"
    );
    headers.append("Vary", "Origin");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}




// =========================================================
// WORKER
// =========================================================

async function handleRequest(request, env, ctx) {

    const url = new URL(request.url);

    const pathname =
      url.pathname;


    try {

      // =======================================================
      // SYSTEM
      // =======================================================

      if (
        request.method === "GET" &&
        pathname === "/health"
      ) {

        return Response.json({
          ok: true,
          service: "gallery-worker"
        });

      }


      // =======================================================
      // DEVELOPMENT / DIAGNOSTIC
      // =======================================================

      if (
        request.method === "GET" &&
        pathname === "/drive/test"
      ) {

        if (!env.GOOGLE_CLIENT_EMAIL) {

          return jsonError(
            "GOOGLE_CLIENT_EMAIL is missing",
            500
          );

        }

        if (!env.GOOGLE_PRIVATE_KEY) {

          return jsonError(
            "GOOGLE_PRIVATE_KEY is missing",
            500
          );

        }

        if (!env.DRIVE_METADATA_ID) {

          return jsonError(
            "DRIVE_METADATA_ID is missing",
            500
          );

        }

        const file =
          await getDriveFile(
            env,
            env.DRIVE_METADATA_ID
          );

        return Response.json({
          ok: true,
          drive: file
        });

      }





            if (
        request.method === "GET" &&
        pathname === "/test/articles"
      ) {

        try {

          const {
            listDriveFiles
          } = await import(
            "./drive/google.js"
          );

          if (!env.DRIVE_ARTICLES_DATABASE_ID) {
            return Response.json({
              success: false,
              error:
                "DRIVE_ARTICLES_DATABASE_ID is missing"
            }, {
              status: 500
            });
          }

          const result =
            await listDriveFiles(
              env,
              [
                `'${env.DRIVE_ARTICLES_DATABASE_ID}' in parents`,
                "trashed=false"
              ].join(" and "),
              "files(id,name,mimeType,size,modifiedTime,createdTime,parents)"
            );

          return Response.json({
            success: true,
            folderId:
              env.DRIVE_ARTICLES_DATABASE_ID,
            total:
              result.files?.length || 0,
            files:
              result.files || []
          });

        } catch (error) {

          console.error(
            "Article Drive folder test failed:",
            error
          );

          return Response.json({
            success: false,
            error: error.message
          }, {
            status: 500
          });

        }

      }





if (
  request.method === "GET" &&
  pathname === "/test/articles-provider"
) {

  try {

    const {
      listArticles
    } = await import(
      "./articles/articleDrive.js"
    );

    const result =
      await listArticles(env);

    return Response.json({
      success: true,
      total: result.total,
      articles: result.rows
    });

  } catch (error) {

    console.error(
      "Article provider test failed:",
      error
    );

    return Response.json({
      success: false,
      error: error.message
    }, {
      status: 500
    });

  }

}




if (
  request.method === "GET" &&
  pathname === "/test/articles-root"
) {

  try {

    const {
      listDriveFiles
    } = await import("./drive/google.js");

    if (!env.DRIVE_ARTICLES_ROOT_ID) {
      return Response.json({
        success: false,
        error: "DRIVE_ARTICLES_ROOT_ID is missing"
      }, {
        status: 500
      });
    }

    const result =
      await listDriveFiles(
        env,
        [
          `'${env.DRIVE_ARTICLES_ROOT_ID}' in parents`,
          "trashed=false"
        ].join(" and "),
        "files(id,name,mimeType,size,modifiedTime,createdTime,parents)"
      );

    return Response.json({
      success: true,
      folderId: env.DRIVE_ARTICLES_ROOT_ID,
      total: result.files?.length || 0,
      files: result.files || []
    });

  } catch (error) {

    console.error(
      "Article root Drive test failed:",
      error
    );

    return Response.json({
      success: false,
      error: error.message
    }, {
      status: 500
    });

  }

}








// =======================================================
// AUTH
// =======================================================

// -------------------------------------------------------
// FRONTEND AUTH
// Must come before the general /auth/ route.
// -------------------------------------------------------

// -------------------------------------------------------
// FRONTEND AUTH
// Supports both Render-compatible and Worker paths.
// -------------------------------------------------------

if (
    pathname.startsWith("/auth/frontend/") ||
    pathname === "/frontend/login" ||
    pathname === "/frontend/check" ||
    pathname === "/frontend/logout"
) {
    const authPath = pathname.startsWith("/frontend/")
        ? pathname.replace(
            "/frontend/",
            "/auth/frontend/"
        )
        : pathname;

    const authRequest = new Request(
        new URL(authPath, request.url),
        request
    );

    return frontendAuthRoute(
        authRequest,
        env
    );
}


// -------------------------------------------------------
// ADMIN AUTH
// -------------------------------------------------------

if (
    pathname.startsWith("/auth/")
) {
    return authRoute(
        request,
        env
    );
}




// =======================================================
// PUBLIC ARTICLES
// =======================================================
//
// Public article API:
//
// GET  /articles
// GET  /articles/popular
// GET  /articles/:slug
// GET  /articles/:slug/status
// GET  /articles/:slug/content
// GET  /articles/:slug/raw
//
// POST /articles/login
// POST /articles/logout
//
// IMPORTANT:
// This route is PUBLIC.
// It must NOT use requireAdmin().
//
// =======================================================

if (
  pathname === "/articles" ||
  pathname === "/articles/" ||
  pathname.startsWith("/articles/")
) {
  return articlesRoute(
    request,
    env
  );
}



      // =======================================================
      // GALLERY
      // =======================================================

// =======================================================
// GALLERY
// =======================================================

if (
    pathname === "/gallery" ||
    pathname.startsWith("/gallery/")
) {
    // First, allow an existing admin session.
    const adminAuth = await requireAdmin(
        request,
        env
    );

    if (adminAuth.authenticated) {
        return galleryRoute(
            request,
            env,
            ctx
        );
    }

    // Otherwise, require the gallery frontend account.
    const frontendAuth = await authenticateFrontend(
        request,
        env,
        "gallery"
    );

    if (!frontendAuth.authenticated) {
        return adminAuth.response;
    }

    return galleryRoute(
        request,
        env,
        ctx
    );
}


      // =======================================================
      // GALLERY TEST
      // =======================================================

      if (
        request.method === "GET" &&
        pathname === "/gallery/test"
      ) {

        const authResponse =
          await requireAdmin(
            request,
            env
          );

        if (!authResponse.authenticated) {
  return authResponse.response;
}

        const gallery =
          await readGallery(env);

        return Response.json({
          ok: true,
          count: gallery.length,
          gallery
        });
      }


      // =======================================================
      // IMAGES
      // =======================================================

      if (pathname.startsWith("/image/")) {

        const id =
          pathname.slice("/image/".length).split("/")[0];

        if (!id) {
          return jsonError(
            "Image ID is required",
            400
          );
        }

        const authResponse =
          await requireImageAuth(
            request,
            env
          );

        if (!authResponse.authenticated) {
  return authResponse.response;
}

        return imageRoute(
          request,
          env,
          id
        );
      }


      // =======================================================
      // THUMBNAILS
      // =======================================================

      if (pathname.startsWith("/thumb/")) {

        const id =
          pathname.slice("/thumb/".length).split("/")[0];

        if (!id) {
          return jsonError(
            "Image ID is required",
            400
          );
        }

        const authResponse =
          await requireImageAuth(
            request,
            env
          );

        if (!authResponse.authenticated) {
  return authResponse.response;
}

        return thumbRoute(
          request,
          env,
          id
        );
      }




// =======================================================
// FRONTEND ADMIN
// =======================================================

if (
    pathname === "/admin/frontend/accounts" ||
    /^\/admin\/frontend\/(gallery|articles)\/password$/.test(pathname)
) {

    const authResponse =
        await requireAdmin(
            request,
            env
        );

    if (!authResponse.authenticated) {
        return authResponse.response;
    }

    return frontendAdminRoute(
        request,
        env
    );
}



      // =======================================================
      // ADMIN API
      // =======================================================
      //
      // IMPORTANT:
      //
      // Only known API endpoints are sent to adminRoute().
      //
      // This prevents:
      //
      // /admin/admin.css
      // /admin/admin.js
      // /admin/js/...
      //
      // from being mistaken for API requests.
      //
      // =======================================================

      // =======================================================
      // ADMIN ARTICLES API
      // =======================================================
      //
      // Article management has its own route module.
      //
      // /admin/articles
      // /admin/articles/*
      //
      // =======================================================

      if (
        pathname === "/admin/articles" ||
        pathname.startsWith("/admin/articles/")
      ) {

        const authResponse =
          await requireAdmin(
            request,
            env
          );

        if (!authResponse.authenticated) {
          return authResponse.response;
        }

        return adminArticlesRoute(
          request,
          env,
          ctx
        );
      }


      if (
        isAdminApiPath(pathname)
      ) {

        const authResponse =
          await requireAdmin(
            request,
            env
          );

        if (!authResponse.authenticated) {
  return authResponse.response;
}

        return adminRoute(
          request,
          env,
          ctx
        );
      }


      // =======================================================
      // STATIC FRONTEND
      // =======================================================

      if (env.ASSETS) {

        // -------------------------------------------------------
        // /
        // -------------------------------------------------------
        //
        // Open the admin application.
        //
        // /
        //   ↓
        // /admin/index.html
        //
        // -------------------------------------------------------

        if (pathname === "/") {
          return Response.redirect(
            new URL("/admin/", request.url),
            302
          );
        }


        // -------------------------------------------------------
        // /admin
        // -------------------------------------------------------
        //
        // Open the admin application.
        //
        // -------------------------------------------------------

        if (pathname === "/admin" || pathname === "/admin/") {

          const frontendURL =
            new URL(
              "/admin/index.html",
              request.url
            );

          return env.ASSETS.fetch(
            new Request(
              frontendURL,
              request
            )
          );

        }


        // -------------------------------------------------------
        // STATIC FILES
        // -------------------------------------------------------
        //
        // Examples:
        //
        // /admin/index.html
        // /admin/admin.css
        // /admin/admin.js
        // /admin/js/core/config.js
        // /admin/js/modules/dashboard.js
        // /admin/icons/favicon.ico
        //
        // -------------------------------------------------------

        const assetResponse =
          await env.ASSETS.fetch(
            request
          );


        if (
          assetResponse.status !== 404
        ) {

          return assetResponse;

        }

      }


      // =======================================================
      // NOT FOUND
      // =======================================================

      return jsonError(
        "Not found",
        404
      );


    } catch (error) {

      console.error(
        "Worker request failed:",
        error
      );

      return Response.json(
        {
          ok: false,
          error:
            error?.message ||
            String(error)
        },
        {
          status: 500
        }
      );

    }

}

    export default {
      async fetch(request, env, ctx) {
        const origin = request.headers.get("Origin");
        const allowedOrigins = getAllowedOrigins(env);

        // Centralized preflight handling.
        if (request.method === "OPTIONS") {
          if (!origin || !allowedOrigins.includes(origin)) {
            return new Response(null, { status: 403 });
          }

          return applyCors(
            request,
            new Response(null, { status: 204 }),
            env
          );
        }

        const response = await handleRequest(
          request,
          env,
          ctx
        );

        return applyCors(request, response, env);
      }
    };