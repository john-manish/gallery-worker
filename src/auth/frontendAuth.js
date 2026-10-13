// =========================================================
// FRONTEND AUTHORIZATION
// Cloudflare Worker version
//
// Shared account model:
//   admin    -> gallery, articles, dashboard
//   gallery  -> gallery
//   articles -> articles
//
// Session cookies remain separate by protected area.
// The login route must issue matching claims/cookies.
// =========================================================

import {
    getCookie,
    verifyJwt
} from "./jwt.js";

import {
    getTokenVersion
} from "./auth.js";

import {
    loadFrontendAuth
} from "./frontendAuthDrive.js";


// =========================================================
// SESSION COOKIES
// =========================================================

export const FRONTEND_COOKIES = Object.freeze({
    gallery: "gallery_frontend_token",
    articles: "articles_frontend_token",
    dashboard: "dashboard_frontend_token"
});

const FRONTEND_AREAS = Object.freeze([
    "gallery",
    "articles",
    "dashboard"
]);


// =========================================================
// HELPERS
// =========================================================

function unauthenticated(message = "Not authenticated") {
    return {
        authenticated: false,
        message
    };
}

function isFrontendArea(value) {
    return FRONTEND_AREAS.includes(value);
}

function getLegacyPermissions(frontend) {
    // Compatibility for tokens created before the permissions claim existed.
    // Legacy tokens can access only their original area, never Dashboard.
    if (frontend === "gallery") return ["gallery"];
    if (frontend === "articles") return ["articles"];
    return [];
}

function normalizePermissions(value) {
    if (!Array.isArray(value)) return [];

    return [...new Set(
        value.filter(permission => FRONTEND_AREAS.includes(permission))
    )];
}


// =========================================================
// AUTHENTICATION + AUTHORIZATION
// =========================================================
//
// expectedFrontend is the protected area, not necessarily the account
// identity. For example, the admin account may have a Dashboard session
// whose token has accountType="admin" and frontend="dashboard".
//
// Existing callers for "gallery" and "articles" remain compatible.
// =========================================================

export async function authenticateFrontend(
    request,
    env,
    expectedFrontend = null
) {
    if (!isFrontendArea(expectedFrontend)) {
        return unauthenticated("Invalid frontend type");
    }

    const cookieName = FRONTEND_COOKIES[expectedFrontend];
    const token = getCookie(request, cookieName);

    if (!token) {
        return unauthenticated();
    }

    try {
        if (!env?.JWT_SECRET) {
            console.error("JWT_SECRET is not configured");
            return unauthenticated("Authentication is unavailable");
        }

        const decoded = await verifyJwt(token, env.JWT_SECRET);

        if (
            !decoded ||
            decoded.type !== "frontend" ||
            decoded.frontend !== expectedFrontend
        ) {
            return unauthenticated();
        }

        // Preserve the existing global token-version revocation mechanism.
        const currentVersion = await getTokenVersion(env);

        if (
            Number(decoded.version || 1) !==
            Number(currentVersion)
        ) {
            return unauthenticated("Session has expired");
        }

        // accountType identifies which stored account authenticated.
        // Tokens created before this claim existed remain valid for their
        // original Gallery/Articles area only.
        const accountType =
            typeof decoded.accountType === "string" &&
            decoded.accountType
                ? decoded.accountType
                : decoded.frontend;

        if (
            accountType !== "admin" &&
            accountType !== "gallery" &&
            accountType !== "articles"
        ) {
            return unauthenticated();
        }

        // Read current account state so disabled accounts and changed
        // permissions can be enforced, rather than trusting only stale
        // permission claims embedded in a still-valid JWT.
        const authData = await loadFrontendAuth(env);
        const account = authData?.[accountType];

        if (
            !account ||
            account.enabled === false ||
            (typeof decoded.username === "string" &&
                decoded.username !== account.username)
        ) {
            return unauthenticated("Account is disabled or unavailable");
        }

        // Prefer current server-side permissions. For legacy records that
        // have not yet been normalized, use only the safe default for that
        // account type; never grant Dashboard through a legacy token.
        const accountPermissions = normalizePermissions(
            Array.isArray(account.permissions)
                ? account.permissions
                : accountType === "admin"
                    ? ["gallery", "articles", "dashboard"]
                    : getLegacyPermissions(accountType)
        );

        // A token's permissions can restrict access further, but cannot
        // grant access beyond the account's current server-side permissions.
        const tokenPermissions = Array.isArray(decoded.permissions)
            ? normalizePermissions(decoded.permissions)
            : getLegacyPermissions(decoded.frontend);

        const effectivePermissions = accountPermissions.filter(
            permission => tokenPermissions.includes(permission)
        );

        if (!effectivePermissions.includes(expectedFrontend)) {
            return unauthenticated("Permission denied");
        }

        return {
            authenticated: true,
            user: {
                ...decoded,
                accountType,
                permissions: effectivePermissions
            },
            token,
            frontend: expectedFrontend,
            permissions: effectivePermissions
        };
    } catch (error) {
        console.warn(
            "Frontend authentication failed:",
            error?.message || error
        );

        return unauthenticated();
    }
}


// =========================================================
// PERMISSION HELPER
// =========================================================
//
// Use this for code that already has an authenticated result.
// Do not use it instead of authenticateFrontend() on a request.
// =========================================================

export function hasFrontendPermission(authResult, permission) {
    if (
        !authResult ||
        authResult.authenticated !== true ||
        !isFrontendArea(permission)
    ) {
        return false;
    }

    const permissions = Array.isArray(authResult.permissions)
        ? authResult.permissions
        : Array.isArray(authResult.user?.permissions)
            ? authResult.user.permissions
            : [];

    return permissions.includes(permission);
}
