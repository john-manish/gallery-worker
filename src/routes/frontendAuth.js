
import {
    loadFrontendAuth,
    verifyFrontendPassword
} from "../auth/frontendAuthDrive.js";

import {
    getTokenVersion
} from "../auth/auth.js";

import {
    authenticateFrontend
} from "../auth/frontendAuth.js";

import {
    signJwt,
    createCookie,
    clearCookie
} from "../auth/jwt.js";

/* =========================================================
   CONFIGURATION
========================================================= */

const FRONTEND_COOKIES = Object.freeze({
    gallery: "gallery_frontend_token",
    articles: "articles_frontend_token"
});

const TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

const VALID_TYPES = new Set([
    "gallery",
    "articles"
]);

/* =========================================================
   RESPONSE HELPERS
========================================================= */

function json(data, status = 200, extraHeaders = {}) {
    const headers = new Headers(extraHeaders);

    headers.set("Cache-Control", "no-store, private");
    headers.set("Content-Type", "application/json; charset=utf-8");

    return Response.json(data, {
        status,
        headers
    });
}

function error(message, status = 400, extra = {}) {
    return json({
        success: false,
        authenticated: false,
        message,
        ...extra
    }, status);
}

async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

function isValidFrontendType(type) {
    return VALID_TYPES.has(type);
}

/* =========================================================
   COOKIE OPTIONS
========================================================= */

function isLocalRequest(request) {
    const hostname = new URL(request.url).hostname;

    return (
        hostname === "localhost" ||
        hostname === "127.0.0.1"
    );
}

function getCookieOptions(request) {
    const local = isLocalRequest(request);

    return {
        httpOnly: true,
        secure: !local,
        sameSite: local ? "Lax" : "None",
        path: "/",
        maxAge: TOKEN_MAX_AGE
    };
}

function getClearCookieOptions(request) {
    const local = isLocalRequest(request);

    return {
        httpOnly: true,
        secure: !local,
        sameSite: local ? "Lax" : "None",
        path: "/"
    };
}

/* =========================================================
   COOKIE HELPERS
========================================================= */

function getCookieValue(request, name) {
    const header = request.headers.get("Cookie") || "";

    for (const part of header.split(";")) {
        const separator = part.indexOf("=");

        if (separator === -1) {
            continue;
        }

        const key = part.slice(0, separator).trim();

        if (key !== name) {
            continue;
        }

        return part.slice(separator + 1).trim();
    }

    return null;
}

function getPresentFrontendCookies(request) {
    return Object.entries(FRONTEND_COOKIES)
        .filter(([, cookieName]) => {
            return Boolean(getCookieValue(request, cookieName));
        })
        .map(([type]) => type);
}

/* =========================================================
   FRONTEND TYPE RESOLUTION

   Priority:
   1. Explicit ?type=gallery or ?type=articles
   2. Requesting page's Referer path
   3. Exactly one frontend session cookie

   Never silently assume Gallery when the request is
   ambiguous.
========================================================= */

function resolveFrontendType(request) {
    const url = new URL(request.url);

    if (url.searchParams.has("type")) {
        const explicitType = url.searchParams.get("type");

        return isValidFrontendType(explicitType)
            ? explicitType
            : null;
    }

    const referer = request.headers.get("Referer");

    if (referer) {
        try {
            const refererUrl = new URL(referer);

            // Only trust same-origin page context.
            if (refererUrl.origin === url.origin) {
                const path = refererUrl.pathname.toLowerCase();

                // Articles pages.
                if (
                    path === "/articles" ||
                    path.startsWith("/articles/")
                ) {
                    return "articles";
                }

                // Known Gallery pages.
                if (
                    path === "/gallery" ||
                    path.startsWith("/gallery/") ||
                    path.endsWith("/gallery.html") ||
                    path === "/pass.html"
                ) {
                    return "gallery";
                }
            }
        } catch {
            // Ignore an invalid Referer and try cookie detection.
        }
    }

    // Cookie-based fallback is safe only when exactly one
    // frontend session cookie is present.
    const present = getPresentFrontendCookies(request);

    if (present.length === 1) {
        return present[0];
    }

    return null;
}

/* =========================================================
   POST /auth/frontend/login

   Body:
   {
       "type": "gallery",
       "username": "gallery",
       "password": "..."
   }

   The Articles account uses type: "articles".
========================================================= */

export async function login(request, env) {
    try {
        const body = await readJson(request);

        if (!body || typeof body !== "object") {
            return error("Invalid JSON body", 400);
        }

        const { type, username, password } = body;

        if (!isValidFrontendType(type)) {
            return error("Invalid frontend account type", 400);
        }

        if (
            typeof username !== "string" ||
            !username.trim() ||
            typeof password !== "string" ||
            !password
        ) {
            return error(
                "Username and password are required",
                400
            );
        }

        if (!env.JWT_SECRET) {
            console.error("JWT_SECRET is not configured");

            return error("Authentication is unavailable", 500);
        }

        const authData = await loadFrontendAuth(env);
        const account = authData?.[type];

        if (!account) {
            return error("Frontend account not found", 401);
        }

        if (account.enabled === false) {
            return error("This account is disabled", 403);
        }

        if (account.username !== username) {
            return error("Invalid username or password", 401);
        }

        const valid = await verifyFrontendPassword(
            env,
            type,
            password
        );

        if (!valid) {
            return error("Invalid username or password", 401);
        }

        const tokenVersion = await getTokenVersion(env);

        const token = await signJwt(
            {
                type: "frontend",
                frontend: type,
                username: account.username,
                version: tokenVersion
            },
            env.JWT_SECRET,
            {
                expiresIn: TOKEN_MAX_AGE
            }
        );

        const cookieName = FRONTEND_COOKIES[type];

        const cookie = createCookie(
            cookieName,
            token,
            getCookieOptions(request)
        );

        return json(
            {
                success: true,
                authenticated: true,
                user: {
                    type,
                    username: account.username
                },
                message: "Login successful"
            },
            200,
            {
                "Set-Cookie": cookie
            }
        );
    } catch (err) {
        console.error(
            "FRONTEND LOGIN ERROR:",
            err?.stack || err?.message || err
        );

        return error(
            env.NODE_ENV === "production"
                ? "Server error"
                : err?.message || "Server error",
            500
        );
    }
}

/* =========================================================
   GET /auth/frontend/check

   Supports existing calls without ?type= when the type
   can be resolved safely from the request context.
========================================================= */

export async function check(request, env) {
    try {
        const type = resolveFrontendType(request);

        if (!type) {
            return error(
                "Unable to determine frontend type. " +
                "Provide ?type=gallery or ?type=articles.",
                400
            );
        }

        const auth = await authenticateFrontend(
            request,
            env,
            type
        );

        if (!auth?.authenticated) {
            return error(
                auth?.message || "Not authenticated",
                401
            );
        }

        if (auth.user?.frontend !== type) {
            return error("Frontend session mismatch", 401);
        }

        return json({
            success: true,
            authenticated: true,
            user: auth.user
        });
    } catch (err) {
        console.error(
            "FRONTEND AUTH CHECK ERROR:",
            err?.stack || err?.message || err
        );

        return error("Authentication check failed", 401);
    }
}

/* =========================================================
   POST /auth/frontend/logout

   Clears only the resolved frontend cookie.
   Does not clear gallery_token or article_session.
========================================================= */

export async function logout(request, env) {
    try {
        const type = resolveFrontendType(request);

        if (!type) {
            return error(
                "Unable to determine which frontend to log out. " +
                "Provide ?type=gallery or ?type=articles.",
                400
            );
        }

        const cookieName = FRONTEND_COOKIES[type];

        const cookie = clearCookie(
            cookieName,
            getClearCookieOptions(request)
        );

        return json(
            {
                success: true,
                message: "Logged out",
                frontend: type
            },
            200,
            {
                "Set-Cookie": cookie
            }
        );
    } catch (err) {
        console.error(
            "FRONTEND LOGOUT ERROR:",
            err?.stack || err?.message || err
        );

        return error("Logout failed", 500);
    }
}

/* =========================================================
   ROUTER
========================================================= */

export async function frontendAuthRoute(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (
        pathname === "/auth/frontend/login" &&
        request.method === "POST"
    ) {
        return login(request, env);
    }

    if (
        pathname === "/auth/frontend/check" &&
        request.method === "GET"
    ) {
        return check(request, env);
    }

    if (
        pathname === "/auth/frontend/logout" &&
        request.method === "POST"
    ) {
        return logout(request, env);
    }

    return json({
        success: false,
        message: "Not found"
    }, 404);
}
