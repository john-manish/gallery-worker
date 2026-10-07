
// =========================================================
// IMAGE AUTH
// Cloudflare Worker version
//
// Allows:
//   1. Admin users via gallery_token
//   2. Frontend users via frontend_token
//
// Denies:
//   - No valid authentication
// =========================================================

import {
    getCookie,
    verifyJwt
} from "./jwt.js";

import {
    getTokenVersion
} from "./auth.js";

import {
    denyProtectedResource
} from "./authMiddleware.js";

import {
    authenticateFrontend
} from "./frontendAuth.js";


// =========================================================
// ADMIN AUTH
// =========================================================

async function authenticateAdminForImages(
    request,
    env
) {

    const cookieName =
        env.COOKIE_NAME ||
        "gallery_token";

    const token =
        getCookie(
            request,
            cookieName
        );


    if (!token) {
        return null;
    }


    try {

        const decoded =
            await verifyJwt(
                token,
                env.JWT_SECRET
            );


        // Admin JWT must contain authenticated=true
        if (
            decoded.authenticated !== true
        ) {
            return null;
        }


        // Check current token version
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

            return null;
        }


        return {
            authenticated: true,

            user: {
                ...decoded,
                type: "admin",

                permissions: [
                    "view_images",
                    "view_thumbs",
                    "manage_gallery"
                ]
            },

            token
        };

    }

    catch (error) {

        console.warn(
            "Image admin authentication failed:",
            error?.message ||
            error
        );

        return null;
    }
}


// =========================================================
// IMAGE AUTHENTICATION
// =========================================================

export async function authenticateImage(
    request,
    env
) {

    // -----------------------------------------------------
    // 1. Try admin authentication first
    // -----------------------------------------------------

    const admin =
        await authenticateAdminForImages(
            request,
            env
        );


    if (admin) {

        return admin;
    }


    // -----------------------------------------------------
    // 2. Try frontend authentication
    // -----------------------------------------------------

    const frontend =
        await authenticateFrontend(
            request,
            env
        );


    if (
        frontend &&
        frontend.authenticated
    ) {

        return {

            authenticated: true,

            user: {
                ...frontend.user,

                type: "frontend",

                permissions: [
                    "view_images",
                    "view_thumbs"
                ]
            },

            token: frontend.token
        };
    }


    // -----------------------------------------------------
    // 3. Nobody authenticated
    // -----------------------------------------------------

    return {
        authenticated: false,

        response:
            await denyProtectedResource(
                request,
                env
            )
    };
}


// =========================================================
// REQUIRE IMAGE AUTH
// =========================================================

export async function requireImageAuth(
    request,
    env
) {

    return authenticateImage(
        request,
        env
    );
}