
// =========================================================
// JWT UTILITIES
// Cloudflare Worker / Web Crypto version
// =========================================================


// =========================================================
// BASE64URL
// =========================================================

function base64urlEncode(input) {

    let bytes;

    if (typeof input === "string") {

        bytes =
            new TextEncoder().encode(input);

    } else {

        bytes =
            new Uint8Array(input);
    }

    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


function base64urlDecode(value) {

    const normalized =
        value
            .replace(/-/g, "+")
            .replace(/_/g, "/");

    const padding =
        "=".repeat(
            (4 - normalized.length % 4) % 4
        );

    const binary =
        atob(
            normalized + padding
        );

    const bytes =
        new Uint8Array(
            binary.length
        );

    for (let i = 0; i < binary.length; i++) {
        bytes[i] =
            binary.charCodeAt(i);
    }

    return bytes;
}


function decodeJsonPart(part) {

    const bytes =
        base64urlDecode(part);

    return JSON.parse(
        new TextDecoder().decode(bytes)
    );
}


// =========================================================
// IMPORT SECRET
// =========================================================

async function getSecretKey(secret) {

    if (!secret) {
        throw new Error(
            "JWT_SECRET is not configured."
        );
    }

    return crypto.subtle.importKey(
        "raw",

        new TextEncoder().encode(secret),

        {
            name: "HMAC",
            hash: "SHA-256"
        },

        false,

        [
            "sign",
            "verify"
        ]
    );
}


// =========================================================
// SIGN JWT
// =========================================================

export async function signJwt(
    payload,
    secret,
    options = {}
) {

    const header = {
        alg: "HS256",
        typ: "JWT"
    };


    // -----------------------------------------------------
    // Clone payload
    // -----------------------------------------------------

    const now =
        Math.floor(
            Date.now() / 1000
        );

    const finalPayload = {
        ...payload
    };


    // -----------------------------------------------------
    // Issued-at
    // -----------------------------------------------------

    if (
        finalPayload.iat === undefined
    ) {

        finalPayload.iat =
            now;
    }


    // -----------------------------------------------------
    // Expiration
    // -----------------------------------------------------

    if (
        options.expiresIn !== undefined
    ) {

        finalPayload.exp =
            now +
            Number(
                options.expiresIn
            );
    }


    const encodedHeader =
        base64urlEncode(
            JSON.stringify(header)
        );

    const encodedPayload =
        base64urlEncode(
            JSON.stringify(finalPayload)
        );

    const signingInput =
        `${encodedHeader}.${encodedPayload}`;


    const key =
        await getSecretKey(secret);


    const signature =
        await crypto.subtle.sign(
            "HMAC",
            key,
            new TextEncoder().encode(
                signingInput
            )
        );


    const encodedSignature =
        base64urlEncode(
            signature
        );


    return (
        `${signingInput}.${encodedSignature}`
    );
}


// =========================================================
// VERIFY JWT
// =========================================================

export async function verifyJwt(
    token,
    secret
) {

    if (
        !token ||
        typeof token !== "string"
    ) {

        throw new Error(
            "Missing JWT"
        );
    }


    const parts =
        token.split(".");


    if (parts.length !== 3) {

        throw new Error(
            "Invalid JWT format"
        );
    }


    const [
        encodedHeader,
        encodedPayload,
        encodedSignature
    ] = parts;


    // -----------------------------------------------------
    // Header
    // -----------------------------------------------------

    const header =
        decodeJsonPart(
            encodedHeader
        );


    if (
        header.alg !== "HS256" ||
        header.typ !== "JWT"
    ) {

        throw new Error(
            "Invalid JWT algorithm"
        );
    }


    // -----------------------------------------------------
    // Verify signature
    // -----------------------------------------------------

    const signingInput =
        `${encodedHeader}.${encodedPayload}`;


    const key =
        await getSecretKey(secret);


    const signature =
        base64urlDecode(
            encodedSignature
        );


    const valid =
        await crypto.subtle.verify(
            "HMAC",
            key,
            signature,
            new TextEncoder().encode(
                signingInput
            )
        );


    if (!valid) {

        throw new Error(
            "Invalid JWT signature"
        );
    }


    // -----------------------------------------------------
    // Decode payload
    // -----------------------------------------------------

    const payload =
        decodeJsonPart(
            encodedPayload
        );


    // -----------------------------------------------------
    // Expiration
    // -----------------------------------------------------

    if (
        payload.exp !== undefined
    ) {

        const now =
            Math.floor(
                Date.now() / 1000
            );

        if (
            Number(payload.exp) <= now
        ) {

            throw new Error(
                "JWT expired"
            );
        }
    }


    return payload;
}


// =========================================================
// COOKIE VALUE HELPERS
// =========================================================

export function getCookie(
    request,
    name
) {

    const cookieHeader =
        request.headers.get(
            "Cookie"
        );

    if (!cookieHeader) {
        return null;
    }


    const cookies =
        cookieHeader.split(";");


    for (const cookie of cookies) {

        const index =
            cookie.indexOf("=");

        if (index === -1) {
            continue;
        }


        const key =
            cookie
                .slice(0, index)
                .trim();


        if (key !== name) {
            continue;
        }


        return decodeURIComponent(
            cookie
                .slice(index + 1)
                .trim()
        );
    }


    return null;
}


// =========================================================
// SET COOKIE
// =========================================================

export function createCookie(
    name,
    value,
    options = {}
) {

    const parts = [
        `${name}=${encodeURIComponent(value)}`
    ];


    if (
        options.maxAge !== undefined
    ) {

        parts.push(
            `Max-Age=${Math.floor(options.maxAge)}`
        );
    }


    if (options.path) {

        parts.push(
            `Path=${options.path}`
        );

    } else {

        parts.push(
            "Path=/"
        );
    }


    if (options.httpOnly !== false) {
        parts.push("HttpOnly");
    }


    if (options.secure !== false) {
        parts.push("Secure");
    }


    if (options.sameSite) {

        parts.push(
            `SameSite=${options.sameSite}`
        );
    }


    if (options.domain) {

        parts.push(
            `Domain=${options.domain}`
        );
    }


    return parts.join("; ");
}


// =========================================================
// CLEAR COOKIE
// =========================================================

export function clearCookie(
    name,
    options = {}
) {

    return createCookie(
        name,
        "",
        {
            ...options,
            maxAge: 0
        }
    );
}