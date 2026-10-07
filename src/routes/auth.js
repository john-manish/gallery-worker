
// =========================================================
// ADMIN AUTH ROUTES
// Cloudflare Worker version
// =========================================================

import {
    verifyPassword,
    changePassword,
    incrementTokenVersion,
    loadAuth
} from "../auth/auth.js";

import {
    signJwt,
    createCookie,
    clearCookie
} from "../auth/jwt.js";

import {
    requireAdmin
} from "../auth/authMiddleware.js";


// =========================================================
// CONSTANTS
// =========================================================

const DEFAULT_COOKIE_NAME =
    "gallery_token";

const TOKEN_MAX_AGE =
    7 * 24 * 60 * 60;


// =========================================================
// HELPERS
// =========================================================

function json(
    data,
    status = 200,
    extraHeaders = {}
) {

    return Response.json(
        data,
        {
            status,
            headers: {
                "Cache-Control":
                    "no-store, private",

                ...extraHeaders
            }
        }
    );
}


function getCookieName(env) {

    return (
        env.COOKIE_NAME ||
        DEFAULT_COOKIE_NAME
    );
}


function isLocalRequest(request) {

    const url =
        new URL(request.url);

    return (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1"
    );
}


function getCookieOptions(request) {

    const isLocal =
        isLocalRequest(request);

    return {
        httpOnly: true,
        secure: !isLocal,
        sameSite: isLocal ? "Lax" : "None",
        path: "/",
        maxAge: TOKEN_MAX_AGE
    };
}


function getClearCookieOptions(request) {

    const isLocal =
        isLocalRequest(request);

    return {
        httpOnly: true,
        secure: !isLocal,
        sameSite: isLocal ? "Lax" : "None",
        path: "/"
    };
}


async function readJson(request) {

    try {

        return await request.json();

    } catch {

        return null;
    }
}


// =========================================================
// POST /auth/login
// =========================================================

export async function login(
    request,
    env
) {

    try {

        const body =
            await readJson(request);


        const password =
            body?.password;


        if (!password) {

            return json(
                {
                    success: false,
                    message:
                        "Password is required"
                },
                400
            );
        }


        // -------------------------------------------------
        // Verify password
        // -------------------------------------------------

        const valid =
            await verifyPassword(
                env,
                password
            );


        if (!valid) {

            return json(
                {
                    success: false,
                    message:
                        "Incorrect password"
                },
                401
            );
        }


        // -------------------------------------------------
        // Load current auth data
        // -------------------------------------------------

        const authData =
            await loadAuth(env);


        // -------------------------------------------------
        // Create JWT
        // -------------------------------------------------

        const token =
            await signJwt(
                {
                    authenticated: true,

                    version:
                        Number(
                            authData.tokenVersion ||
                            1
                        )
                },

                env.JWT_SECRET,

                {
                    expiresIn:
                        TOKEN_MAX_AGE
                }
            );


        // -------------------------------------------------
        // Cookie
        // -------------------------------------------------

        const cookie =
            createCookie(
                getCookieName(env),
                token,
                getCookieOptions(request)
            );


        return json(
            {
                success: true,
                message:
                    "Login successful"
            },
            200,
            {
                "Set-Cookie":
                    cookie
            }
        );

    }

    catch (error) {

        console.error(
            "LOGIN ERROR:",
            error?.stack ||
            error?.message ||
            error
        );

        return json(
            {
                success: false,
                message:
                    env.NODE_ENV === "production"
                        ? "Server error"
                        : (
                            error?.message ||
                            "Server error"
                        )
            },
            500
        );
    }
}


// =========================================================
// POST /auth/logout
// =========================================================

export async function logout(
    request,
    env
) {

    const cookie =
        clearCookie(
            getCookieName(env),
            getClearCookieOptions(request)
        );


    return json(
        {
            success: true,
            message:
                "Logged out"
        },
        200,
        {
            "Set-Cookie":
                cookie
        }
    );
}


// =========================================================
// POST /auth/logout-all
// =========================================================

export async function logoutAll(
    request,
    env
) {

    try {

        const auth =
            await requireAdmin(
                request,
                env
            );


        if (!auth.authenticated) {
            return auth.response;
        }


        // -------------------------------------------------
        // Increment global token version
        // -------------------------------------------------

        await incrementTokenVersion(
            env
        );


        // -------------------------------------------------
        // Clear current cookie
        // -------------------------------------------------

        const cookie =
            clearCookie(
                getCookieName(env),
                getClearCookieOptions(request)
            );


        return json(
            {
                success: true,
                message:
                    "Logged out everywhere"
            },
            200,
            {
                "Set-Cookie":
                    cookie
            }
        );

    }

    catch (error) {

        console.error(
            "Logout-all error:",
            error
        );


        return json(
            {
                success: false,
                message:
                    "Unable to logout everywhere"
            },
            500
        );
    }
}


// =========================================================
// POST /auth/change-password
// =========================================================

export async function changeAdminPassword(
    request,
    env
) {

    try {

        // -------------------------------------------------
        // Require current session
        // -------------------------------------------------

        const auth =
            await requireAdmin(
                request,
                env
            );


        if (!auth.authenticated) {
            return auth.response;
        }


        const body =
            await readJson(request);


        const currentPassword =
            body?.currentPassword;


        const newPassword =
            body?.newPassword;


        // -------------------------------------------------
        // Required fields
        // -------------------------------------------------

        if (
            !currentPassword ||
            !newPassword
        ) {

            return json(
                {
                    success: false,
                    message:
                        "Current and new password are required"
                },
                400
            );
        }


        // -------------------------------------------------
        // Password length
        // -------------------------------------------------

        if (
            newPassword.length < 8
        ) {

            return json(
                {
                    success: false,
                    message:
                        "New password must be at least 8 characters"
                },
                400
            );
        }


        // -------------------------------------------------
        // Same password
        // -------------------------------------------------

        if (
            currentPassword ===
            newPassword
        ) {

            return json(
                {
                    success: false,
                    message:
                        "New password must be different from current password"
                },
                400
            );
        }


        // -------------------------------------------------
        // Change password
        // -------------------------------------------------

        const result =
            await changePassword(
                env,
                currentPassword,
                newPassword
            );


        if (!result.success) {

            return json(
                {
                    success: false,
                    message:
                        result.message ||
                        "Current password is incorrect"
                },
                401
            );
        }


        // -------------------------------------------------
        // Password change increments tokenVersion.
        //
        // Therefore the existing JWT is now invalid.
        // -------------------------------------------------

        const cookie =
            clearCookie(
                getCookieName(env),
                getClearCookieOptions(request)
            );


        return json(
            {
                success: true,
                message:
                    "Password changed successfully"
            },
            200,
            {
                "Set-Cookie":
                    cookie
            }
        );

    }

    catch (error) {

        console.error(
            "Change password error:",
            error
        );


        return json(
            {
                success: false,
                message:
                    "Unable to change password"
            },
            500
        );
    }
}


// =========================================================
// GET /auth/check
// =========================================================

export async function check(
    request,
    env
) {

    const auth =
        await requireAdmin(
            request,
            env
        );


    if (!auth.authenticated) {
        return auth.response;
    }


    return json(
        {
            success: true,
            authenticated: true,
            user: auth.user
        }
    );
}


// =========================================================
// ROUTER
// =========================================================

export async function authRoute(
    request,
    env
) {

    const url =
        new URL(request.url);


    const pathname =
        url.pathname;


    // -----------------------------------------------------
    // POST /auth/login
    // -----------------------------------------------------

    if (
        pathname === "/auth/login" &&
        request.method === "POST"
    ) {

        return login(
            request,
            env
        );
    }


    // -----------------------------------------------------
    // POST /auth/logout
    // -----------------------------------------------------

    if (
        pathname === "/auth/logout" &&
        request.method === "POST"
    ) {

        return logout(
            request,
            env
        );
    }


    // -----------------------------------------------------
    // POST /auth/logout-all
    // -----------------------------------------------------

    if (
        pathname === "/auth/logout-all" &&
        request.method === "POST"
    ) {

        return logoutAll(
            request,
            env
        );
    }


    // -----------------------------------------------------
    // POST /auth/change-password
    // -----------------------------------------------------

    if (
        pathname === "/auth/change-password" &&
        request.method === "POST"
    ) {

        return changeAdminPassword(
            request,
            env
        );
    }


    // -----------------------------------------------------
    // GET /auth/check
    // -----------------------------------------------------

    if (
        pathname === "/auth/check" &&
        request.method === "GET"
    ) {

        return check(
            request,
            env
        );
    }


    return json(
        {
            success: false,
            message: "Not found"
        },
        404
    );
}