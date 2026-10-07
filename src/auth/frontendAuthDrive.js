

import {
    encryptPassword,
    decryptPassword
} from "../utils/passwordCrypto.js";

// =========================================================
// FRONTEND AUTH STORAGE
// Cloudflare Worker version
//
// Google Drive = source of truth
// Workers KV = persistent backup/cache
// Worker memory = warm cache only
// =========================================================

import bcrypt from "bcryptjs";

const FRONTEND_AUTH_FILE_NAME =
    "frontend-auth.json";

const FRONTEND_AUTH_KV_KEY =
    "frontend-auth.json";

const JSON_MIME =
    "application/json";

const DRIVE_API =
    "https://www.googleapis.com/drive/v3";

const DRIVE_UPLOAD_API =
    "https://www.googleapis.com/upload/drive/v3";

const TOKEN_URL =
    "https://oauth2.googleapis.com/token";


// =========================================================
// MEMORY CACHE
// =========================================================

let cachedFrontendAuth = null;


// =========================================================
// HELPERS
// =========================================================

function requireEnv(env, name) {
    if (!env?.[name]) {
        throw new Error(
            `${name} is not configured.`
        );
    }

    return env[name];
}


function escapeDriveQuery(value) {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}


// =========================================================
// GOOGLE ACCESS TOKEN
// =========================================================

async function getAccessToken(env) {

    const clientId =
        requireEnv(
            env,
            "GOOGLE_CLIENT_ID"
        );

    const clientSecret =
        requireEnv(
            env,
            "GOOGLE_CLIENT_SECRET"
        );

    const refreshToken =
        requireEnv(
            env,
            "GOOGLE_REFRESH_TOKEN"
        );

    const response =
        await fetch(
            TOKEN_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body:
                    new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        refresh_token: refreshToken,
                        grant_type: "refresh_token"
                    })
            }
        );

    if (!response.ok) {
        const text =
            await response.text();

        throw new Error(
            `Google OAuth failed: ${text}`
        );
    }

    const data =
        await response.json();

    if (!data?.access_token) {
        throw new Error(
            "Google OAuth did not return an access token."
        );
    }

    return data.access_token;
}


// =========================================================
// FIND frontend-auth.json
// =========================================================

async function findFrontendAuthFile(
    env,
    accessToken
) {

    const systemFolderId =
        requireEnv(
            env,
            "DRIVE_SYSTEM_ID"
        );

    const query = [
        `name='${escapeDriveQuery(
            FRONTEND_AUTH_FILE_NAME
        )}'`,

        `'${escapeDriveQuery(
            systemFolderId
        )}' in parents`,

        "trashed=false"

    ].join(" and ");

    const url =
        new URL(
            `${DRIVE_API}/files`
        );

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
        await fetch(
            url,
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
            `Frontend auth file lookup failed: ${text}`
        );
    }

    const data =
        await response.json();

    return (
        data.files?.[0] ||
        null
    );
}


// =========================================================
// READ frontend-auth.json
// =========================================================

async function readFrontendAuthFile(
    accessToken,
    file
) {

    const url =
        `${DRIVE_API}/files/` +
        `${encodeURIComponent(file.id)}` +
        `?alt=media`;

    const response =
        await fetch(
            url,
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
            `Unable to read frontend-auth.json: ${text}`
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
            "Invalid frontend-auth.json"
        );
    }

    return data;
}


// =========================================================
// WRITE frontend-auth.json
// =========================================================

async function writeFrontendAuthFile(
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
    // UPDATE EXISTING FILE
    // -----------------------------------------------------

    if (existingFile) {

        const response =
            await fetch(
                `${DRIVE_UPLOAD_API}/files/` +
                `${encodeURIComponent(existingFile.id)}` +
                `?uploadType=media`,
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
                `Unable to update frontend-auth.json: ${text}`
            );
        }

        return;
    }


    // -----------------------------------------------------
    // CREATE FILE
    // -----------------------------------------------------

    const metadata = {
        name:
            FRONTEND_AUTH_FILE_NAME,

        parents: [
            systemFolderId
        ],

        mimeType:
            JSON_MIME
    };

    const boundary =
        `----CloudflareFrontendAuth` +
        `${crypto.randomUUID()}`;

    const multipartBody =
        new Blob([
            `--${boundary}\r\n`,

            "Content-Type: " +
            "application/json; charset=UTF-8\r\n\r\n",

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
            `${DRIVE_UPLOAD_API}/files` +
            `?uploadType=multipart`,
            {
                method: "POST",

                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,

                    "Content-Type":
                        `multipart/related; boundary=${boundary}`
                },

                body:
                    multipartBody
            }
        );

    if (!response.ok) {
        const text =
            await response.text();

        throw new Error(
            `Unable to create frontend-auth.json: ${text}`
        );
    }
}


// =========================================================
// KV BACKUP
// =========================================================

async function readKVFrontendAuth(
    env
) {

    if (!env?.GALLERY_CACHE) {
        return null;
    }

    try {

        const data =
            await env.GALLERY_CACHE.get(
                FRONTEND_AUTH_KV_KEY,
                "json"
            );

        if (
            !data ||
            typeof data !== "object" ||
            Array.isArray(data)
        ) {
            return null;
        }

        if (
            !data.gallery ||
            !data.articles
        ) {
            return null;
        }

        return data;

    }
    catch (error) {

        console.warn(
            "Unable to read frontend auth backup from KV:",
            error?.message ||
            error
        );

        return null;
    }
}


async function writeKVFrontendAuth(
    env,
    data
) {

    if (!env?.GALLERY_CACHE) {
        return;
    }

    await env.GALLERY_CACHE.put(
        FRONTEND_AUTH_KV_KEY,
        JSON.stringify(data)
    );
}


// =========================================================
// DEFAULT STRUCTURE
// =========================================================

function createDefaultFrontendAuth() {

    const now =
        new Date().toISOString();

    return {

        gallery: {
            username:
                "gallery",

            passwordHash:
                "",

            encryptedPassword:
                null,

            enabled:
                true,

            updatedAt:
                now
        },

        articles: {
            username:
                "articles",

            passwordHash:
                "",

            encryptedPassword:
                null,

            enabled:
                true,

            updatedAt:
                now
        }
    };
}


// =========================================================
// LOAD FRONTEND AUTH
// =========================================================
//
// Priority:
//
// 1. Worker memory
// 2. Google Drive
// 3. KV backup
//
// When Drive succeeds:
//
// Drive → KV → memory
// =========================================================

export async function loadFrontendAuth(
    env
) {

    if (cachedFrontendAuth) {
        return cachedFrontendAuth;
    }


    let accessToken;
    let file;


    // -----------------------------------------------------
    // TRY GOOGLE DRIVE
    // -----------------------------------------------------

    try {

        accessToken =
            await getAccessToken(env);

        file =
            await findFrontendAuthFile(
                env,
                accessToken
            );

    }
    catch (error) {

        console.warn(
            "Frontend auth Drive unavailable. " +
            "Trying KV backup:",
            error?.message ||
            error
        );

        const backup =
            await readKVFrontendAuth(
                env
            );

        if (backup) {

            cachedFrontendAuth =
                backup;

            return cachedFrontendAuth;
        }

        throw error;
    }


    // -----------------------------------------------------
    // FILE DOES NOT EXIST
    // -----------------------------------------------------

    if (!file) {

        const backup =
            await readKVFrontendAuth(
                env
            );

        if (backup) {

            cachedFrontendAuth =
                backup;

            return cachedFrontendAuth;
        }


        // Match old backend:
        // create frontend-auth.json if absent.

        const initial =
            createDefaultFrontendAuth();

        await writeFrontendAuthFile(
            env,
            accessToken,
            initial
        );

        try {

            await writeKVFrontendAuth(
                env,
                initial
            );

        }
        catch (error) {

            console.warn(
                "Unable to create frontend auth KV backup:",
                error?.message ||
                error
            );
        }

        cachedFrontendAuth =
            initial;

        return cachedFrontendAuth;
    }


    // -----------------------------------------------------
    // DRIVE FILE EXISTS
    // -----------------------------------------------------

    let data;

    try {

        data =
            await readFrontendAuthFile(
                accessToken,
                file
            );

    }
    catch (error) {

        console.warn(
            "Unable to read frontend-auth.json " +
            "from Google Drive. Trying KV backup:",
            error?.message ||
            error
        );

        const backup =
            await readKVFrontendAuth(
                env
            );

        if (backup) {

            cachedFrontendAuth =
                backup;

            return cachedFrontendAuth;
        }

        throw error;
    }


    // -----------------------------------------------------
    // DRIVE IS SOURCE OF TRUTH
    // REFRESH KV BACKUP
    // -----------------------------------------------------

    try {

        await writeKVFrontendAuth(
            env,
            data
        );

    }
    catch (error) {

        console.warn(
            "Unable to update frontend auth KV backup:",
            error?.message ||
            error
        );
    }


    cachedFrontendAuth =
        data;

    return cachedFrontendAuth;
}


// =========================================================
// SAVE FRONTEND AUTH
// =========================================================
//
// Drive first.
// KV only after Drive succeeds.
// Memory only after Drive + KV attempt.
// =========================================================

export async function saveFrontendAuth(
    env,
    data
) {

    const accessToken =
        await getAccessToken(env);

    const file =
        await findFrontendAuthFile(
            env,
            accessToken
        );

    await writeFrontendAuthFile(
        env,
        accessToken,
        data,
        file
    );


    // -----------------------------------------------------
    // DRIVE SUCCESS
    // UPDATE KV
    // -----------------------------------------------------

    try {

        await writeKVFrontendAuth(
            env,
            data
        );

    }
    catch (error) {

        console.warn(
            "Unable to update frontend auth KV backup:",
            error?.message ||
            error
        );
    }


    cachedFrontendAuth =
        data;

    return cachedFrontendAuth;
}


// =========================================================
// UPDATE FRONTEND PASSWORD
// =========================================================

export async function updateFrontendPassword(
    env,
    type,
    password
) {

    if (
        type !== "gallery" &&
        type !== "articles"
    ) {
        throw new Error(
            "Invalid frontend type"
        );
    }

    const data =
        await loadFrontendAuth(
            env
        );


    data[type].passwordHash =
        await bcrypt.hash(
            password,
            12
        );
        
    
    data[type].encryptedPassword =
        await encryptPassword(
            password,
            env
        );


    // NOTE:
    // The old backend also stores encryptedPassword.
    // Keep this field intact unless your Worker already
    // has the same passwordCrypto implementation.

    data[type].updatedAt =
        new Date().toISOString();


    await saveFrontendAuth(
        env,
        data
    );

    return data[type];
}


// =========================================================
// VERIFY FRONTEND PASSWORD
// =========================================================

export async function verifyFrontendPassword(
    env,
    type,
    password
) {

    const data =
        await loadFrontendAuth(
            env
        );

    if (!data[type]) {
        return false;
    }

    if (
        data[type].enabled === false
    ) {
        return false;
    }

    return bcrypt.compare(
        password,
        data[type].passwordHash
    );
}


// =========================================================
// FRONTEND ACCOUNT INFO
// =========================================================

export async function getFrontendAccounts(
    env
) {

    const data =
        await loadFrontendAuth(
            env
        );

    return {

        gallery: {
            username:
                data.gallery.username,

            enabled:
                data.gallery.enabled,

            updatedAt:
                data.gallery.updatedAt
        },

        articles: {
            username:
                data.articles.username,

            enabled:
                data.articles.enabled,

            updatedAt:
                data.articles.updatedAt
        }
    };
}


// =========================================================
// GET STORED FRONTEND PASSWORD
// =========================================================
//
// This requires encryptedPassword to be compatible with
// the old passwordCrypto implementation.
// We deliberately do NOT invent a new encryption format.
// =========================================================

export async function getFrontendPassword(
    env,
    type
    
) {

    const data =
        await loadFrontendAuth(
            env
        );

    if (
        !data[type]?.encryptedPassword
    ) {
        throw new Error(
            "Password reveal unavailable"
        );
    }

    return decryptPassword(
        data[type].encryptedPassword,
        env
    );
}


// =========================================================
// CLEAR MEMORY CACHE
// =========================================================

export function clearFrontendAuthCache() {
    cachedFrontendAuth = null;
}