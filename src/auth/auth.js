// =========================================================
// MAIN ADMIN AUTH
// Cloudflare Worker version
// Google Drive (OAuth2 refresh-token) source of truth
// =========================================================

import bcrypt from "bcryptjs";

const AUTH_FILE_NAME = "auth.json";
const JSON_MIME = "application/json";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const AUTH_KV_KEY = "auth.json";

// =========================================================
// HELPERS
// =========================================================

function requireEnv(env, name) {
    if (!env?.[name]) {
        throw new Error(`${name} is not configured.`);
    }

    return env[name];
}

function escapeDriveQuery(value) {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}

// =========================================================
// GOOGLE DRIVE ACCESS
// Uses OAuth2 refresh token, matching the old backend.
// =========================================================

async function getAccessToken(env) {
    const clientId =
        requireEnv(env, "GOOGLE_CLIENT_ID");

    const clientSecret =
        requireEnv(env, "GOOGLE_CLIENT_SECRET");

    const refreshToken =
        requireEnv(env, "GOOGLE_REFRESH_TOKEN");

    const response = await fetch(TOKEN_URL, {
        method: "POST",

        headers: {
            "Content-Type":
                "application/x-www-form-urlencoded"
        },

        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token"
        })
    });

    if (!response.ok) {
        const text = await response.text();

        throw new Error(
            `Google OAuth failed: ${text}`
        );
    }

    const data = await response.json();

    if (!data?.access_token) {
        throw new Error(
            "Google OAuth did not return an access token."
        );
    }

    return data.access_token;
}

// =========================================================
// DRIVE FILE FIND
// =========================================================

async function findAuthFile(
    env,
    accessToken
) {
    const systemFolderId =
        requireEnv(
            env,
            "DRIVE_SYSTEM_ID"
        );

    const query = [
        `name='${escapeDriveQuery(AUTH_FILE_NAME)}'`,
        `'${escapeDriveQuery(systemFolderId)}' in parents`,
        "trashed=false"
    ].join(" and ");

    const url =
        new URL(`${DRIVE_API}/files`);

    url.searchParams.set(
        "q",
        query
    );

    url.searchParams.set(
        "fields",
        "files(id,name,mimeType,size,createdTime,modifiedTime)"
    );

    url.searchParams.set(
        "pageSize",
        "1"
    );

    const response =
        await fetch(url, {
            headers: {
                Authorization:
                    `Bearer ${accessToken}`
            }
        });

    if (!response.ok) {
        const text =
            await response.text();

        throw new Error(
            `Drive file lookup failed: ${text}`
        );
    }

    const data =
        await response.json();

    return data.files?.[0] || null;
}

// =========================================================
// READ AUTH FILE
// =========================================================

async function readAuthFile(
    accessToken,
    file
) {
    const response =
        await fetch(
            `${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media`,
            {
                headers: {
                    Authorization:
                        `Bearer ${accessToken}`
                }
            }
        );

    if (!response.ok) {
        const text =
            await response.text();

        throw new Error(
            `Unable to read auth.json: ${text}`
        );
    }

    const data =
        await response.json();

    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        throw new Error(
            "Invalid auth.json"
        );
    }

    if (!data.passwordHash) {
        throw new Error(
            "auth.json does not contain passwordHash."
        );
    }

    return data;
}

// =========================================================
// WRITE AUTH FILE
// =========================================================

async function writeAuthFile(
    env,
    accessToken,
    data,
    existingFile = null
) {
    const systemFolderId =
        requireEnv(
            env,
            "DRIVE_SYSTEM_ID"
        );

    const body =
        JSON.stringify(
            data,
            null,
            4
        );

    // -----------------------------------------------------
    // UPDATE EXISTING auth.json
    // -----------------------------------------------------

    if (existingFile) {
        const response =
            await fetch(
                `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(existingFile.id)}?uploadType=media`,
                {
                    method: "PATCH",

                    headers: {
                        Authorization:
                            `Bearer ${accessToken}`,

                        "Content-Type":
                            JSON_MIME
                    },

                    body
                }
            );

        if (!response.ok) {
            const text =
                await response.text();

            throw new Error(
                `Unable to update auth.json: ${text}`
            );
        }

        return;
    }

    // -----------------------------------------------------
    // CREATE auth.json
    //
    // This is only used by saveAuth() if the file is absent.
    // loadAuth() NEVER bootstraps from PASSWORD_HASH.
    // -----------------------------------------------------

    const metadata = {
        name: AUTH_FILE_NAME,
        parents: [systemFolderId],
        mimeType: JSON_MIME
    };

    const boundary =
        `----CloudflareAuth${crypto.randomUUID()}`;

    const multipartBody =
        new Blob([
            `--${boundary}\r\n`,
            "Content-Type: application/json; charset=UTF-8\r\n\r\n",
            JSON.stringify(metadata),
            "\r\n",

            `--${boundary}\r\n`,
            `Content-Type: ${JSON_MIME}\r\n\r\n`,
            body,
            "\r\n",

            `--${boundary}--\r\n`
        ]);

    const response =
        await fetch(
            `${DRIVE_UPLOAD_API}/files?uploadType=multipart`,
            {
                method: "POST",

                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,

                    "Content-Type":
                        `multipart/related; boundary=${boundary}`
                },

                body: multipartBody
            }
        );

    if (!response.ok) {
        const text =
            await response.text();

        throw new Error(
            `Unable to create auth.json: ${text}`
        );
    }
}

// =========================================================
// AUTH CACHE
// =========================================================
//
// Google Drive = source of truth.
// cachedAuth = warm Worker instance cache only.
//

let cachedAuth = null;



// =========================================================
// KV AUTH BACKUP
// =========================================================

async function readKVAuthBackup(env) {
    if (!env?.GALLERY_CACHE) {
        return null;
    }

    try {
        const data =
            await env.GALLERY_CACHE.get(
                AUTH_KV_KEY,
                "json"
            );

        if (
            !data ||
            typeof data !== "object" ||
            Array.isArray(data) ||
            !data.passwordHash
        ) {
            return null;
        }

        return data;
    }
    catch (error) {
        console.warn(
            "Unable to read auth backup from KV:",
            error?.message || error
        );

        return null;
    }
}


async function writeKVAuthBackup(
    env,
    data
) {
    if (!env?.GALLERY_CACHE) {
        return;
    }

    await env.GALLERY_CACHE.put(
        AUTH_KV_KEY,
        JSON.stringify(data)
    );
}

// =========================================================
// LOAD AUTH
// =========================================================

export async function loadAuth(env) {

    if (cachedAuth) {
        return cachedAuth;
    }

    let accessToken;
    let file;

    // -----------------------------------------------------
    // Try Google Drive
    // -----------------------------------------------------

    try {

        accessToken =
            await getAccessToken(env);

        file =
            await findAuthFile(
                env,
                accessToken
            );

    }
    catch (error) {

        console.warn(
            "Google Drive unavailable. Trying KV auth backup:",
            error?.message || error
        );

        const backup =
            await readKVAuthBackup(env);

        if (backup) {

            cachedAuth =
                backup;

            return cachedAuth;
        }

        throw error;
    }


    // -----------------------------------------------------
    // auth.json genuinely does not exist
    // -----------------------------------------------------

    if (!file) {

        const backup =
            await readKVAuthBackup(env);

        if (backup) {

            cachedAuth =
                backup;

            return cachedAuth;
        }

        throw new Error(
            "auth.json was not found in the Google Drive System folder."
        );
    }


    // -----------------------------------------------------
    // Drive is available — Drive remains source of truth
    // -----------------------------------------------------



    let auth;

    try {

        auth =
            await readAuthFile(
                accessToken,
                file
            );

    }
    catch (error) {

        console.warn(
            "Unable to read auth.json from Google Drive. Trying KV auth backup:",
            error?.message || error
        );

        const backup =
            await readKVAuthBackup(env);

        if (backup) {

            cachedAuth =
                backup;

            return cachedAuth;
        }

        throw error;
    }


    // -----------------------------------------------------
    // Refresh KV backup
    // -----------------------------------------------------

    try {

        await writeKVAuthBackup(
            env,
            auth
        );

    }
    catch (error) {

        // KV is only the backup.
        // A KV failure must not make valid
        // Google Drive authentication fail.

        console.warn(
            "Unable to update KV auth backup:",
            error?.message || error
        );
    }


    cachedAuth =
        auth;

    return cachedAuth;
}

// =========================================================
// SAVE AUTH
// =========================================================

export async function saveAuth(
    env,
    data
) {
    const accessToken =
        await getAccessToken(env);

    const file =
        await findAuthFile(
            env,
            accessToken
        );

    await writeAuthFile(
        env,
        accessToken,
        data,
        file
    );

    // -----------------------------------------------------
    // Update KV backup after Drive succeeds
    // -----------------------------------------------------

    try {

        await writeKVAuthBackup(
            env,
            data
        );

    }
    catch (error) {

        console.warn(
            "Unable to update KV auth backup:",
            error?.message || error
        );
    }


    // -----------------------------------------------------
    // Update Worker memory
    // -----------------------------------------------------

    cachedAuth =
        data;

    return cachedAuth;
    }

// =========================================================
// VERIFY PASSWORD
// =========================================================

export async function verifyPassword(
    env,
    password
) {
    const auth =
        await loadAuth(env);

    return bcrypt.compare(
        password,
        auth.passwordHash
    );
}

// =========================================================
// CHANGE PASSWORD
// =========================================================

export async function changePassword(
    env,
    currentPassword,
    newPassword
) {
    const auth =
        await loadAuth(env);

    const valid =
        await bcrypt.compare(
            currentPassword,
            auth.passwordHash
        );

    if (!valid) {
        return {
            success: false,
            message: "Wrong password"
        };
    }

    const passwordHash =
        await bcrypt.hash(
            newPassword,
            12
        );

    const updated = {
        ...auth,

        passwordHash,

        tokenVersion:
            Number(
                auth.tokenVersion || 1
            ) + 1,

        updatedAt:
            new Date().toISOString()
    };

    await saveAuth(
        env,
        updated
    );

    return {
        success: true,
        auth: updated
    };
}

// =========================================================
// INCREMENT TOKEN VERSION
// =========================================================

export async function incrementTokenVersion(
    env
) {
    const auth =
        await loadAuth(env);

    const updated = {
        ...auth,

        tokenVersion:
            Number(
                auth.tokenVersion || 1
            ) + 1,

        updatedAt:
            new Date().toISOString()
    };

    await saveAuth(
        env,
        updated
    );

    return updated.tokenVersion;
}

// =========================================================
// GET TOKEN VERSION
// =========================================================

export async function getTokenVersion(
    env
) {
    const auth =
        await loadAuth(env);

    return Number(
        auth.tokenVersion || 1
    );
}

// =========================================================
// CLEAR CACHE
// =========================================================

export function clearAuthCache() {
    cachedAuth = null;
}