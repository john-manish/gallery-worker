import {
    loadFrontendAuth,
    verifyFrontendPassword
} from "../auth/frontendAuthDrive.js";

import {
    getTokenVersion
} from "../auth/auth.js";

import {
    authenticateFrontend,
    FRONTEND_COOKIES
} from "../auth/frontendAuth.js";

import {
    signJwt,
    createCookie,
    clearCookie
} from "../auth/jwt.js";

/* =========================================================
   SHARED FRONTEND AUTH ROUTES

   Request body:
   {
       "type": "gallery" | "articles" | "dashboard",
       "username": "...",
       "password": "..."
   }

   `type` means the area being opened, not the stored account type.

   Accounts:
     admin    -> gallery, articles, dashboard
     gallery  -> gallery
     articles -> articles

   A successful login creates a session cookie for the requested
   area only. Admin can separately sign in to each permitted area.
========================================================= */

const TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

const VALID_AREAS = new Set([
    "gallery",
    "articles",
    "dashboard"
]);

const DEFAULT_PERMISSIONS = Object.freeze({
    admin: ["gallery", "articles", "dashboard"],
    gallery: ["gallery"],
    articles: ["articles"]
});


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

function isValidArea(area) {
    return VALID_AREAS.has(area);
}

function isLocalRequest(request) {
    const hostname = new URL(request.url).hostname;

    return hostname === "localhost" ||
        hostname === "127.0.0.1";
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

        if (separator === -1) continue;

        const key = part.slice(0, separator).trim();

        if (key === name) {
            return part.slice(separator + 1).trim();
        }
    }

    return null;
}

function getPresentFrontendCookies(request) {
    return Object.entries(FRONTEND_COOKIES)
        .filter(([, cookieName]) =>
            Boolean(getCookieValue(request, cookieName))
        )
        .map(([area]) => area);
}


/* =========================================================
   FRONTEND AREA RESOLUTION

   Priority:
   1. Explicit ?type=gallery|articles|dashboard
   2. Same-origin Referer path
   3. Exactly one frontend cookie

   Ambiguous requests fail closed.
========================================================= */

function resolveFrontendType(request) {
    const url = new URL(request.url);

    if (url.searchParams.has("type")) {
        const explicitType = url.searchParams.get("type");
        return isValidArea(explicitType) ? explicitType : null;
    }

    const referer = request.headers.get("Referer");

    if (referer) {
        try {
            const refererUrl = new URL(referer);

            if (refererUrl.origin === url.origin) {
                const path = refererUrl.pathname.toLowerCase();

                if (
                    path === "/articles" ||
                    path.startsWith("/articles/")
                ) {
                    return "articles";
                }

                if (
                    path === "/dashboard" ||
                    path.startsWith("/dashboard/") ||
                    path === "/dashboard.html"
                ) {
                    return "dashboard";
                }

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
            // Ignore invalid Referer and use cookie fallback.
        }
    }

    const present = getPresentFrontendCookies(request);

    return present.length === 1 ? present[0] : null;
}


/* =========================================================
   ACCOUNT HELPERS
========================================================= */

function getAccountPermissions(account, accountType) {
    const permissions = Array.isArray(account?.permissions)
        ? account.permissions
        : DEFAULT_PERMISSIONS[accountType] || [];

    return [...new Set(
        permissions.filter(permission => VALID_AREAS.has(permission))
    )];
}

function findAccountByUsername(authData, username) {
    const matches = Object.entries(authData || {})
        .filter(([accountType, account]) => {
            return (
                ["admin", "gallery", "articles"].includes(accountType) &&
                account &&
                typeof account.username === "string" &&
                account.username === username
            );
        });

    // Refuse ambiguous usernames rather than choosing an account
    // unpredictably if storage has duplicate usernames.
    return matches.length === 1
        ? { accountType: matches[0][0], account: matches[0][1] }
        : null;
}


/* =========================================================
   POST /auth/frontend/login

   The request `type` is the target area. The username determines
   which stored account is authenticating.
========================================================= */

export async function login(request, env) {
    try {
        const body = await readJson(request);

        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return error("Invalid JSON body", 400);
        }

        const { type: area, username, password } = body;

        if (!isValidArea(area)) {
            return error(
                "Invalid frontend area. Use gallery, articles, or dashboard.",
                400
            );
        }

        if (
            typeof username !== "string" ||
            !username.trim() ||
            typeof password !== "string" ||
            !password
        ) {
            return error("Username and password are required", 400);
        }

        if (username.length > 256 || password.length > 1024) {
            return error("Invalid username or password", 400);
        }

        if (!env?.JWT_SECRET) {
            console.error("JWT_SECRET is not configured");
            return error("Authentication is unavailable", 500);
        }

        const authData = await loadFrontendAuth(env);
        const match = findAccountByUsername(authData, username);

        // Use a generic response for unknown accounts to avoid revealing
        // whether a username exists.
        if (!match) {
            return error("Invalid username or password", 401);
        }

        const { accountType, account } = match;

        if (account.enabled === false) {
            return error("This account is disabled", 403);
        }

        const permissions = getAccountPermissions(account, accountType);

        if (!permissions.includes(area)) {
            return error("This account does not have access to this area", 403);
        }

        const valid = await verifyFrontendPassword(
            env,
            accountType,
            password
        );

        if (!valid) {
            return error("Invalid username or password", 401);
        }

        const tokenVersion = await getTokenVersion(env);

        const token = await signJwt(
            {
                type: "frontend",
                frontend: area,
                accountType,
                username: account.username,
                permissions,
                version: tokenVersion
            },
            env.JWT_SECRET,
            {
                expiresIn: TOKEN_MAX_AGE
            }
        );

        const cookieName = FRONTEND_COOKIES[area];

        if (!cookieName) {
            return error("Session configuration is invalid", 500);
        }

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
                    type: accountType,
                    username: account.username,
                    frontend: area,
                    permissions
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
            env?.NODE_ENV === "production"
                ? "Server error"
                : err?.message || "Server error",
            500
        );
    }
}


/* =========================================================
   GET /auth/frontend/check

   Existing Gallery/Articles calls remain supported.
   Dashboard may use ?type=dashboard.
========================================================= */

export async function check(request, env) {
    try {
        const area = resolveFrontendType(request);

        if (!area) {
            return error(
                "Unable to determine frontend area. " +
                "Provide ?type=gallery, ?type=articles, or ?type=dashboard.",
                400
            );
        }

        const auth = await authenticateFrontend(request, env, area);

        if (!auth?.authenticated) {
            const status = auth?.message === "Permission denied" ? 403 : 401;
            return error(auth?.message || "Not authenticated", status);
        }

        if (auth.user?.frontend !== area) {
            return error("Frontend session mismatch", 401);
        }

        return json({
            success: true,
            authenticated: true,
            user: {
                type: auth.user.accountType || auth.user.frontend,
                username: auth.user.username,
                frontend: auth.user.frontend,
                permissions: auth.permissions || auth.user.permissions || []
            }
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

   Clears only the requested area's cookie.
========================================================= */

export async function logout(request, env) {
    try {
        const area = resolveFrontendType(request);

        if (!area) {
            return error(
                "Unable to determine which frontend to log out. " +
                "Provide ?type=gallery, ?type=articles, or ?type=dashboard.",
                400
            );
        }

        const cookieName = FRONTEND_COOKIES[area];

        const cookie = clearCookie(
            cookieName,
            getClearCookieOptions(request)
        );

        return json(
            {
                success: true,
                message: "Logged out",
                frontend: area
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
