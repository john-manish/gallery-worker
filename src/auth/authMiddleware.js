// =========================================================
// ADMIN AUTH MIDDLEWARE
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

const DEFAULT_COOKIE_NAME =
    "gallery_token";


// =========================================================
// AUTHENTICATION
// =========================================================

export async function authenticateAdmin(
    request,
    env
) {

    const cookieName =
        env.COOKIE_NAME ||
        DEFAULT_COOKIE_NAME;


    const token =
        getCookie(
            request,
            cookieName
        );


    // -----------------------------------------------------
    // No token
    // -----------------------------------------------------

    if (!token) {

        return {
            authenticated: false,
            response: unauthorized(
                "Authentication required"
            )
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
        // Validate admin token
        // -------------------------------------------------

        if (
            decoded.authenticated !== true
        ) {

            return {
                authenticated: false,
                response: unauthorized(
                    "Invalid authentication token"
                )
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
                authenticated: false,
                response: unauthorized(
                    "Session expired"
                )
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
            "Admin authentication failed:",
            error?.message ||
            error
        );


        return {
            authenticated: false,

            response: unauthorized(
                "Invalid or expired token"
            )
        };
    }
}


// =========================================================
// REQUIRE ADMIN
// =========================================================
//
// Convenience wrapper for Worker routes.
//
// Usage:
//
// const auth = await requireAdmin(request, env);
//
// if (!auth.authenticated) {
//     return auth.response;
// }
//
// const user = auth.user;
//

export async function requireAdmin(
    request,
    env
) {

    return authenticateAdmin(
        request,
        env
    );
}


// =========================================================
// UNAUTHORIZED RESPONSE
// =========================================================

function unauthorized(
    message
) {

    return new Response(
        JSON.stringify({
            success: false,
            message
        }),
        {
            status: 401,

            headers: {
                "Content-Type":
                    "application/json",

                "Cache-Control":
                    "no-store, private",

                "X-Robots-Tag":
                    "noindex, nofollow, noimageindex"
            }
        }
    );
}


// =========================================================
// PROTECTED RESOURCE RESPONSE
// =========================================================
//
// This is useful for image/thumb routes.
//
// Old Express middleware returned:
//   private.html for /image/*
//   locked.webp for /thumb/*
//
// The Worker route can use these helpers when ASSETS
// is available.
//

export async function denyProtectedResource(
    request,
    env
) {

    const pathname =
        new URL(
            request.url
        ).pathname;


    // -----------------------------------------------------
    // Full image
    // -----------------------------------------------------

    if (
        pathname.startsWith(
            "/image/"
        )
    ) {

        if (env.ASSETS) {

            const privateResponse =
                await env.ASSETS.fetch(
                    new Request(
                        new URL(
                            "/private.html",
                            request.url
                        ),
                        request
                    )
                );


            if (
                privateResponse.status !== 404
            ) {

                return new Response(
                    privateResponse.body,
                    {
                        status: 401,

                        headers: {
                            ...Object.fromEntries(
                                privateResponse.headers
                            ),

                            "Cache-Control":
                                "no-store, private",

                            "X-Robots-Tag":
                                "noindex, nofollow, noimageindex"
                        }
                    }
                );
            }
        }


        return new Response(
            "Authentication required",
            {
                status: 401,

                headers: {
                    "Cache-Control":
                        "no-store, private",

                    "X-Robots-Tag":
                        "noindex, nofollow, noimageindex"
                }
            }
        );
    }


    // -----------------------------------------------------
    // Thumbnail
    // -----------------------------------------------------

    if (
        pathname.startsWith(
            "/thumb/"
        )
    ) {

        if (env.ASSETS) {

            const lockedResponse =
                await env.ASSETS.fetch(
                    new Request(
                        new URL(
                            "/locked.webp",
                            request.url
                        ),
                        request
                    )
                );


            if (
                lockedResponse.status !== 404
            ) {

                return new Response(
                    lockedResponse.body,
                    {
                        status: 401,

                        headers: {
                            ...Object.fromEntries(
                                lockedResponse.headers
                            ),

                            "Cache-Control":
                                "no-store, private",

                            "X-Robots-Tag":
                                "noindex, nofollow, noimageindex"
                        }
                    }
                );
            }
        }


        return new Response(
            "Authentication required",
            {
                status: 401,

                headers: {
                    "Cache-Control":
                        "no-store, private",

                    "X-Robots-Tag":
                        "noindex, nofollow, noimageindex"
                }
            }
        );
    }


    // -----------------------------------------------------
    // API
    // -----------------------------------------------------

    return unauthorized(
        "Authentication required"
    );
}