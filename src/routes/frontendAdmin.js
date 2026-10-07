/*
 * FRONTEND ADMIN ROUTES
 *
 * GET  /admin/frontend/accounts
 * POST /admin/frontend/:type/password
 * GET  /admin/frontend/:type/password
 */

import {
    getFrontendAccounts,
    verifyFrontendPassword,
    updateFrontendPassword,
    getFrontendPassword
} from "../auth/frontendAuthDrive.js";

function json(data, status = 200) {
    return Response.json(
        data,
        {
            status,
            headers: {
                "Cache-Control": "no-store, private"
            }
        }
    );
}

function isValidFrontendType(type) {
    return (
        type === "gallery" ||
        type === "articles"
    );
}

async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}


/*
 * GET /admin/frontend/accounts
 */
async function accounts(request, env) {

    try {

        const accounts =
            await getFrontendAccounts(env);

        return json({
            success: true,
            ...accounts
        });

    } catch (error) {

        console.error(
            "FRONTEND ACCOUNTS ERROR:",
            error
        );

        return json({
            success: false,
            message: "Unable to load frontend accounts"
        }, 500);
    }
}


/*
 * POST /admin/frontend/:type/password
 */
async function updatePassword(request, env, type) {

    try {

        if (!isValidFrontendType(type)) {

            return json({
                success: false,
                message: "Invalid frontend type"
            }, 400);
        }


        const body =
            await readJson(request);

        const currentPassword =
            body?.currentPassword;

        const newPassword =
            body?.newPassword;


        if (
            !currentPassword ||
            !newPassword
        ) {

            return json({
                success: false,
                message:
                    "Current password and new password required"
            }, 400);
        }


        /*
         * Verify old password first
         */
        const valid =
            await verifyFrontendPassword(
                env,
                type,
                currentPassword
            );


        if (!valid) {

            return json({
                success: false,
                message: "Wrong current password"
            }, 401);
        }


        /*
         * Password rules
         */
        if (newPassword.length < 8) {

            return json({
                success: false,
                message:
                    "Password must be at least 8 characters"
            }, 400);
        }


        /*
         * Update password
         */
        await updateFrontendPassword(
            env,
            type,
            newPassword
        );


        return json({
            success: true,
            message:
                "Frontend password updated successfully"
        });

    } catch (error) {

        console.error(
            "FRONTEND PASSWORD UPDATE ERROR:",
            error
        );

        return json({
            success: false,
            message:
                "Unable to update frontend password"
        }, 500);
    }
}


/*
 * GET /admin/frontend/:type/password
 */
async function revealPassword(request, env, type) {

    try {

        if (!isValidFrontendType(type)) {

            return json({
                success: false,
                message: "Invalid frontend type"
            }, 400);
        }


        const password =
            await getFrontendPassword(
                env,
                type
            );


        return json({
            success: true,
            password
        });

    } catch (error) {

        console.error(
            "FRONTEND PASSWORD REVEAL ERROR:",
            error
        );

        return json({
            success: false,
            message:
                "Unable to reveal password"
        }, 500);
    }
}


/*
 * ROUTER
 */
export async function frontendAdminRoute(
    request,
    env
) {

    const url =
        new URL(request.url);

    const pathname =
        url.pathname;


    /*
     * GET /admin/frontend/accounts
     */
    if (
        request.method === "GET" &&
        pathname === "/admin/frontend/accounts"
    ) {

        return accounts(
            request,
            env
        );
    }


    /*
     * /admin/frontend/:type/password
     */
    const match =
        pathname.match(
            /^\/admin\/frontend\/(gallery|articles)\/password$/
        );


    if (match) {

        const type =
            match[1];


        if (request.method === "POST") {

            return updatePassword(
                request,
                env,
                type
            );
        }


        if (request.method === "GET") {

            return revealPassword(
                request,
                env,
                type
            );
        }
    }


    return json({
        success: false,
        message: "Not found"
    }, 404);
}
