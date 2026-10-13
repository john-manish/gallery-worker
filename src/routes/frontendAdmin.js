/*
 * FRONTEND ADMIN ROUTES
 *
 * GET  /admin/frontend/accounts
 * POST /admin/frontend/:type/password
 * GET  /admin/frontend/:type/password
 *
 * These routes must remain protected by requireAdmin() in index.js.
 * The initial shared Admin password can only be provisioned through that
 * existing authenticated admin session.
 */

import {
    getFrontendAccounts,
    verifyFrontendPassword,
    updateFrontendPassword,
    getFrontendPassword
} from "../auth/frontendAuthDrive.js";

function json(data, status = 200) {
    return Response.json(data, {
        status,
        headers: {
            "Cache-Control": "no-store, private"
        }
    });
}

function isValidFrontendType(type) {
    return (
        type === "admin" ||
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
        const accountData = await getFrontendAccounts(env);

        return json({
            success: true,
            ...accountData
        });
    } catch (error) {
        console.error("FRONTEND ACCOUNTS ERROR:", error);

        return json({
            success: false,
            message: "Unable to load frontend accounts"
        }, 500);
    }
}

/*
 * POST /admin/frontend/:type/password
 *
 * For admin:
 * - If no usable password exists yet, allow one-time provisioning through
 *   the existing requireAdmin()-protected route.
 * - Once a password exists, require the current password for changes.
 *
 * Gallery and Articles retain their existing current-password requirement.
 */
async function updatePassword(request, env, type) {
    try {
        if (!isValidFrontendType(type)) {
            return json({
                success: false,
                message: "Invalid frontend type"
            }, 400);
        }

        const body = await readJson(request);

        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return json({
                success: false,
                message: "Invalid JSON body"
            }, 400);
        }

        const { currentPassword, newPassword } = body;

        if (
            typeof newPassword !== "string" ||
            newPassword.length < 8 ||
            newPassword.length > 1024
        ) {
            return json({
                success: false,
                message: "New password must be between 8 and 1024 characters"
            }, 400);
        }

        // Account metadata includes hasPassword and is loaded from the
        // Drive/KV-backed account store.
        const accountData = await getFrontendAccounts(env);
        const account = accountData?.[type];

        if (!account) {
            return json({
                success: false,
                message: "Frontend account not found"
            }, 404);
        }

        const firstAdminProvisioning =
            type === "admin" &&
            account.hasPassword === false;

        if (!firstAdminProvisioning) {
            if (
                typeof currentPassword !== "string" ||
                currentPassword.length === 0
            ) {
                return json({
                    success: false,
                    message: "Current password and new password required"
                }, 400);
            }

            const valid = await verifyFrontendPassword(
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
        }

        await updateFrontendPassword(env, type, newPassword);

        return json({
            success: true,
            message: firstAdminProvisioning
                ? "Shared Admin password provisioned successfully"
                : "Frontend password updated successfully"
        });
    } catch (error) {
        console.error("FRONTEND PASSWORD UPDATE ERROR:", error);

        return json({
            success: false,
            message: "Unable to update frontend password"
        }, 500);
    }
}

/*
 * GET /admin/frontend/:type/password
 *
 * Password reveal remains available only through the existing protected
 * admin route. It is not used for initial Admin provisioning.
 */
async function revealPassword(request, env, type) {
    try {
        if (!isValidFrontendType(type)) {
            return json({
                success: false,
                message: "Invalid frontend type"
            }, 400);
        }

        const password = await getFrontendPassword(env, type);

        return json({
            success: true,
            password
        });
    } catch (error) {
        console.error("FRONTEND PASSWORD REVEAL ERROR:", error);

        return json({
            success: false,
            message: "Unable to reveal password"
        }, 500);
    }
}

/*
 * ROUTER
 */
export async function frontendAdminRoute(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (
        request.method === "GET" &&
        pathname === "/admin/frontend/accounts"
    ) {
        return accounts(request, env);
    }

    const match = pathname.match(
        /^\/admin\/frontend\/(admin|gallery|articles)\/password$/
    );

    if (match) {
        const type = match[1];

        if (request.method === "POST") {
            return updatePassword(request, env, type);
        }

        if (request.method === "GET") {
            return revealPassword(request, env, type);
        }
    }

    return json({
        success: false,
        message: "Not found"
    }, 404);
}
