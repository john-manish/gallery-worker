
// =========================================================
// FRONTEND AUTH ROUTES
// Cloudflare Worker version
//
// Frontend authentication:
//   POST /auth/frontend/login
//   GET  /auth/frontend/check
//   POST /auth/frontend/logout
//
// Supported frontend accounts:
//   gallery
//   articles
// =========================================================

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


// =========================================================
// CONSTANTS
// =========================================================

const FRONTEND_COOKIE_NAME =
    "frontend_token";

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


async function readJson(request) {

    try {

        return await request.json();

    } catch {

        return null;
    }
}


function isValidFrontendType(type) {

    return (
        type === "gallery" ||
        type === "articles"
    );
}


function getCookieOptions(request) {
    const url = new URL(request.url);

    const isLocal =
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1";

    return {
        httpOnly: true,
        secure: !isLocal,
        sameSite: isLocal ? "Lax" : "None",
        path: "/",
        maxAge: TOKEN_MAX_AGE
    };
}


function getClearCookieOptions(request) {
    const url = new URL(request.url);

    const isLocal =
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1";

    return {
        httpOnly: true,
        secure: !isLocal,
        sameSite: isLocal ? "Lax" : "None",
        path: "/"
    };
}

// =========================================================
// POST /auth/frontend/login
// =========================================================

export async function login(
    request,
    env
) {

    try {

        const body =
            await readJson(request);


        const type =
            body?.type;

        const username =
            body?.username;

        const password =
            body?.password;


        // -------------------------------------------------
        // Validate account type
        // -------------------------------------------------

        if (
            !isValidFrontendType(type)
        ) {

            return json(
                {
                    success: false,
                    message:
                        "Invalid frontend account type"
                },
                400
            );
        }


        // -------------------------------------------------
        // Required fields
        // -------------------------------------------------

        if (
            !username ||
            !password
        ) {

            return json(
                {
                    success: false,
                    message:
                        "Username and password are required"
                },
                400
            );
        }


        // -------------------------------------------------
        // Load frontend authentication data
        //
        // Drive -> KV -> memory
        // -------------------------------------------------

        const authData =
            await loadFrontendAuth(
                env
            );


        const account =
            authData?.[type];


        if (!account) {

            return json(
                {
                    success: false,
                    message:
                        "Frontend account not found"
                },
                401
            );
        }


        // -------------------------------------------------
        // Check account enabled
        // -------------------------------------------------

        if (
            account.enabled === false
        ) {

            return json(
                {
                    success: false,
                    message:
                        "This account is disabled"
                },
                403
            );
        }


        // -------------------------------------------------
        // Check username
        // -------------------------------------------------

        if (
            account.username !==
            username
        ) {

            return json(
                {
                    success: false,
                    message:
                        "Invalid username or password"
                },
                401
            );
        }


        // -------------------------------------------------
        // Verify password
        // -------------------------------------------------

        const valid =
            await verifyFrontendPassword(
                env,
                type,
                password
            );


        if (!valid) {

            return json(
                {
                    success: false,
                    message:
                        "Invalid username or password"
                },
                401
            );
        }


        // -------------------------------------------------
        // Get current global token version
        //
        // frontendAuth.js also validates this version when
        // checking an existing frontend JWT.
        // -------------------------------------------------

        const tokenVersion =
            await getTokenVersion(env);


        // -------------------------------------------------
        // Create frontend JWT
        // -------------------------------------------------

        const token =
            await signJwt(
                {
                    type:
                        "frontend",

                    frontend:
                        type,

                    username:
                        account.username,

                    version:
                        tokenVersion
                },

                env.JWT_SECRET,

                {
                    expiresIn:
                        TOKEN_MAX_AGE
                }
            );


        // -------------------------------------------------
        // Create cookie
        // -------------------------------------------------

        const cookie =
            createCookie(
                FRONTEND_COOKIE_NAME,
                token,
                getCookieOptions(request)
            );


        return json(
            {
                success: true,
                authenticated: true,

                user: {
                    type,
                    username:
                        account.username
                },

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
            "FRONTEND LOGIN ERROR:",
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
// GET /auth/frontend/check
// =========================================================

export async function check(
    request,
    env
) {

    try {

        const auth =
            await authenticateFrontend(
                request,
                env
            );


        if (
            !auth ||
            !auth.authenticated
        ) {

            return json(
                {
                    success: false,
                    authenticated: false,

                    message:
                        auth?.message ||
                        "Not authenticated"
                },
                401
            );
        }


        return json(
            {
                success: true,
                authenticated: true,

                user:
                    auth.user
            }
        );

    }

    catch (error) {

        console.error(
            "FRONTEND AUTH CHECK ERROR:",
            error?.stack ||
            error?.message ||
            error
        );


        return json(
            {
                success: false,
                authenticated: false,

                message:
                    "Authentication check failed"
            },
            401
        );
    }
}


// =========================================================
// POST /auth/frontend/logout
// =========================================================

export async function logout(
    request,
    env
) {

    const cookie =
        clearCookie(
            FRONTEND_COOKIE_NAME,
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
// ROUTER
// =========================================================

export async function frontendAuthRoute(
    request,
    env
) {

    const url =
        new URL(request.url);

    const pathname =
        url.pathname;


    // -----------------------------------------------------
    // POST /auth/frontend/login
    // -----------------------------------------------------

    if (
        pathname === "/auth/frontend/login" &&
        request.method === "POST"
    ) {

        return login(
            request,
            env
        );
    }


    // -----------------------------------------------------
    // GET /auth/frontend/check
    // -----------------------------------------------------

    if (
        pathname === "/auth/frontend/check" &&
        request.method === "GET"
    ) {

        return check(
            request,
            env
        );
    }


    // -----------------------------------------------------
    // POST /auth/frontend/logout
    // -----------------------------------------------------

    if (
        pathname === "/auth/frontend/logout" &&
        request.method === "POST"
    ) {

        return logout(
            request,
            env
        );
    }


    // -----------------------------------------------------
    // Not found
    // -----------------------------------------------------

    return json(
        {
            success: false,
            message:
                "Not found"
        },
        404
    );
}