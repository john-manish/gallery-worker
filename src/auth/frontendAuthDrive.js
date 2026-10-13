

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

const FRONTEND_ACCOUNT_TYPES = Object.freeze([
    "admin",
    "gallery",
    "articles"
]);

const FRONTEND_PERMISSION_SET = Object.freeze([
    "gallery",
    "articles",
    "dashboard"
]);

const DEFAULT_FRONTEND_ACCOUNT_CONFIG = Object.freeze({
    admin: {
        username: "admin",
        permissions: ["gallery", "articles", "dashboard"],
        // Admin remains disabled until an explicit password is configured.
        enabled: false
    },
    gallery: {
        username: "gallery",
        permissions: ["gallery"],
        enabled: true
    },
    articles: {
        username: "articles",
        permissions: ["articles"],
        enabled: true
    }
});

function hasUsableCredential(account) {
    if (!account || typeof account !== "object") {
        return false;
    }

    const hash = account.passwordHash;
    const hasBcryptHash =
        typeof hash === "string" &&
        /^\$2[aby]\$\d{2}\$/.test(hash);

    const encrypted = account.encryptedPassword;
    const hasEncryptedPassword =
        !!encrypted &&
        typeof encrypted === "object" &&
        typeof encrypted.iv === "string" &&
        typeof encrypted.content === "string" &&
        typeof encrypted.tag === "string";

    return hasBcryptHash || hasEncryptedPassword;
}

function createDefaultAccount(type, now) {
    const config = DEFAULT_FRONTEND_ACCOUNT_CONFIG[type];

    return {
        username: config.username,
        passwordHash: "",
        encryptedPassword: null,
        enabled: config.enabled,
        permissions: [...config.permissions],
        updatedAt: now
    };
}

function createDefaultFrontendAuth() {
    const now = new Date().toISOString();

    return {
        admin: createDefaultAccount("admin", now),
        gallery: createDefaultAccount("gallery", now),
        articles: createDefaultAccount("articles", now)
    };
}

/**
 * Upgrades legacy frontend-auth.json records without replacing credentials.
 *
 * Existing usernames, password hashes, encrypted passwords, enabled flags,
 * timestamps, and additional account metadata are retained. Missing accounts
 * and permissions are added using safe defaults.
 */
function normalizeFrontendAuth(input) {
    if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        !input.gallery ||
        !input.articles
    ) {
        throw new Error("Invalid frontend-auth.json account structure.");
    }

    const now = new Date().toISOString();
    const output = { ...input };

    for (const type of FRONTEND_ACCOUNT_TYPES) {
        const defaults = createDefaultAccount(type, now);
        const existing = input[type];

        if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
            output[type] = defaults;
            continue;
        }

        const account = { ...defaults, ...existing };

        if (
            typeof account.username !== "string" ||
            !account.username.trim()
        ) {
            account.username = defaults.username;
        }

        if (
            typeof account.passwordHash !== "string"
        ) {
            account.passwordHash = "";
        }

        if (
            account.encryptedPassword === undefined
        ) {
            account.encryptedPassword = null;
        }

        if (typeof account.enabled !== "boolean") {
            account.enabled = defaults.enabled;
        }

        if (
            typeof account.updatedAt !== "string" ||
            !account.updatedAt
        ) {
            account.updatedAt = now;
        }

        const rawPermissions = Array.isArray(existing.permissions)
            ? existing.permissions
            : defaults.permissions;

        account.permissions = [
            ...new Set(
                rawPermissions.filter(
                    permission =>
                        FRONTEND_PERMISSION_SET.includes(permission)
                )
            )
        ];

        // Never enable a newly-added or existing admin account without
        // a credential that the verifier can actually use.
        if (type === "admin" && !hasUsableCredential(account)) {
            account.enabled = false;
        }

        output[type] = account;
    }

    return output;
}

function isFrontendAccountType(type) {
    return FRONTEND_ACCOUNT_TYPES.includes(type);
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
        accessToken = await getAccessToken(env);
        file = await findFrontendAuthFile(env, accessToken);
    } catch (error) {
        console.warn(
            "Frontend auth Drive unavailable. Trying KV backup:",
            error?.message || error
        );

        const backup = await readKVFrontendAuth(env);

        if (backup) {
            cachedFrontendAuth = normalizeFrontendAuth(backup);
            return cachedFrontendAuth;
        }

        throw error;
    }

    // -----------------------------------------------------
    // FILE DOES NOT EXIST
    // -----------------------------------------------------
    if (!file) {
        const backup = await readKVFrontendAuth(env);

        if (backup) {
            const normalizedBackup = normalizeFrontendAuth(backup);

            // Drive is the source of truth. Since the Drive file is absent,
            // attempt to restore it from the last known KV backup.
            try {
                await writeFrontendAuthFile(
                    env,
                    accessToken,
                    normalizedBackup
                );
                await writeKVFrontendAuth(env, normalizedBackup);
            } catch (error) {
                console.warn(
                    "Unable to restore frontend auth file from KV:",
                    error?.message || error
                );
            }

            cachedFrontendAuth = normalizedBackup;
            return cachedFrontendAuth;
        }

        const initial = createDefaultFrontendAuth();

        await writeFrontendAuthFile(
            env,
            accessToken,
            initial
        );

        try {
            await writeKVFrontendAuth(env, initial);
        } catch (error) {
            console.warn(
                "Unable to create frontend auth KV backup:",
                error?.message || error
            );
        }

        cachedFrontendAuth = initial;
        return cachedFrontendAuth;
    }

    // -----------------------------------------------------
    // DRIVE FILE EXISTS
    // -----------------------------------------------------
    let storedData;

    try {
        storedData = await readFrontendAuthFile(accessToken, file);
    } catch (error) {
        console.warn(
            "Unable to read frontend-auth.json from Google Drive. Trying KV backup:",
            error?.message || error
        );

        const backup = await readKVFrontendAuth(env);

        if (backup) {
            cachedFrontendAuth = normalizeFrontendAuth(backup);
            return cachedFrontendAuth;
        }

        throw error;
    }

    // Add the new account/permission schema while preserving the stored
    // credentials for existing accounts.
    const normalizedData = normalizeFrontendAuth(storedData);
    const schemaChanged =
        JSON.stringify(storedData) !== JSON.stringify(normalizedData);

    if (schemaChanged) {
        try {
            await writeFrontendAuthFile(
                env,
                accessToken,
                normalizedData,
                file
            );
        } catch (error) {
            // Continue with normalized data for this isolate, but report
            // that the migration did not persist to Drive.
            console.error(
                "Frontend auth schema migration could not be saved to Drive:",
                error?.message || error
            );
        }
    }

    // Drive remains the source of truth; refresh KV with normalized data.
    try {
        await writeKVFrontendAuth(env, normalizedData);
    } catch (error) {
        console.warn(
            "Unable to update frontend auth KV backup:",
            error?.message || error
        );
    }

    cachedFrontendAuth = normalizedData;
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
    if (!isFrontendAccountType(type)) {
        throw new Error("Invalid frontend account type.");
    }

    if (typeof password !== "string" || password.length === 0) {
        throw new Error("Password must be a non-empty string.");
    }

    if (password.length > 1024) {
        throw new Error("Password is too long.");
    }

    // Copy before changing so a failed Drive save does not mutate the
    // in-memory object that was previously loaded from storage.
    const current = await loadFrontendAuth(env);
    const data = JSON.parse(JSON.stringify(current));
    const now = new Date().toISOString();

    if (!data[type]) {
        data[type] = createDefaultAccount(type, now);
    }

    data[type].passwordHash = await bcrypt.hash(password, 12);
    data[type].encryptedPassword = await encryptPassword(password, env);
    data[type].updatedAt = now;

    // Setting an admin password is an explicit provisioning action.
    // It enables the account only after both credential formats are made.
    if (type === "admin") {
        data[type].enabled = true;
    }

    await saveFrontendAuth(env, normalizeFrontendAuth(data));

    return {
        username: data[type].username,
        enabled: data[type].enabled,
        permissions: [...data[type].permissions],
        updatedAt: data[type].updatedAt
    };
}


// =========================================================
// VERIFY FRONTEND PASSWORD
// =========================================================



export async function verifyFrontendPassword(
    env,
    type,
    password
) {
    if (!isFrontendAccountType(type)) {
        return false;
    }

    if (typeof password !== "string" || !password) {
        return false;
    }

    try {
        const data = await loadFrontendAuth(env);
        const account = data?.[type];

        if (!account || account.enabled === false) {
            return false;
        }

        const encryptedPassword = account.encryptedPassword;

        // Preferred path: decrypt the existing AES-GCM
        // credential and compare without expensive bcrypt.
        if (
            encryptedPassword &&
            typeof encryptedPassword === "object" &&
            typeof encryptedPassword.iv === "string" &&
            typeof encryptedPassword.content === "string" &&
            typeof encryptedPassword.tag === "string"
        ) {
            const storedPassword = await decryptPassword(
                encryptedPassword,
                env
            );

            return (
                typeof storedPassword === "string" &&
                storedPassword === password
            );
        }

        // Compatibility path for accounts that only have
        // a valid bcrypt hash.
        const passwordHash = account.passwordHash;

        if (
            typeof passwordHash === "string" &&
            /^\$2[aby]\$\d{2}\$/.test(passwordHash)
        ) {
            return await bcrypt.compare(
                password,
                passwordHash
            );
        }

        console.warn(
            `Frontend account "${type}" has no usable password credential.`
        );

        return false;
    } catch (error) {
        console.error(
            `Frontend password verification failed for "${type}":`,
            error?.message || error
        );

        return false;
    }
}




// =========================================================
// FRONTEND ACCOUNT INFO
// =========================================================

export async function getFrontendAccounts(
    env
) {
    const data = await loadFrontendAuth(env);

    return Object.fromEntries(
        FRONTEND_ACCOUNT_TYPES.map(type => {
            const account = data[type];

            return [
                type,
                {
                    username: account.username,
                    enabled: account.enabled,
                    permissions: [...account.permissions],
                    updatedAt: account.updatedAt,
                    hasPassword: hasUsableCredential(account)
                }
            ];
        })
    );
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
    if (!isFrontendAccountType(type)) {
        throw new Error("Invalid frontend account type.");
    }

    const data = await loadFrontendAuth(env);
    const encryptedPassword = data[type]?.encryptedPassword;

    if (
        !encryptedPassword ||
        typeof encryptedPassword !== "object" ||
        typeof encryptedPassword.iv !== "string" ||
        typeof encryptedPassword.content !== "string" ||
        typeof encryptedPassword.tag !== "string"
    ) {
        throw new Error("Password reveal unavailable.");
    }

    return decryptPassword(encryptedPassword, env);
}


// =========================================================
// CLEAR MEMORY CACHE
// =========================================================

export function clearFrontendAuthCache() {
    cachedFrontendAuth = null;
}