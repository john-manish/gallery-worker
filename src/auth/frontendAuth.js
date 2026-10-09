
// =========================================================
// FRONTEND AUTH
// Cloudflare Worker version
// =========================================================

import {
    getCookie,
    verifyJwt
} from "./jwt.js";

import {
    getTokenVersion
} from "./auth.js";


// =========================================================
// COOKIE
// =========================================================

const FRONTEND_COOKIES = {
    gallery: "gallery_frontend_token",
    articles: "articles_frontend_token"
};


// =========================================================
// AUTHENTICATION
// =========================================================

export async function authenticateFrontend(
    request,
    env,
    expectedFrontend = null
) {

    const cookieName =
    FRONTEND_COOKIES[expectedFrontend];

    if (!cookieName) {
    return {
    authenticated: false,
    message: "Invalid frontend type"
    };
    }

    const token = getCookie(
    request,
    cookieName
    );


    // -----------------------------------------------------
    // No token
    // -----------------------------------------------------

    if (!token) {

        return {
            authenticated: false
        };
    }


    try {

        // -------------------------------------------------
        // Verify JWT
        // -------------------------------------------------

        const decoded =
            await verifyJwt(
                token,
                env.JWT_SECRET
            );


        // -------------------------------------------------
        // Validate frontend token
        // -------------------------------------------------

        if (
            decoded.type !== "frontend"
        ) {

            return {
                authenticated: false
            };
        }


// -------------------------------------------------
// Validate frontend account type
// -------------------------------------------------

if (
    expectedFrontend &&
    decoded.frontend !== expectedFrontend
) {
    return {
        authenticated: false
    };
}



        // -------------------------------------------------
        // Token version
        // -------------------------------------------------

        const currentVersion =
            await getTokenVersion(
                env
            );


        if (
            Number(
                decoded.version || 1
            ) !==
            Number(
                currentVersion
            )
        ) {

            return {
                authenticated: false
            };
        }


        // -------------------------------------------------
        // Authenticated
        // -------------------------------------------------

        return {
            authenticated: true,

            user: decoded,

            token
        };

    }

    catch (error) {

        console.warn(
            "Frontend authentication failed:",
            error?.message ||
            error
        );


        return {
            authenticated: false
        };
    }
}