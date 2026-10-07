
const ALGORITHM = "AES-GCM";

async function getKey(env) {
    const secret = env.FRONTEND_SECRET_KEY;

    if (!secret) {
        throw new Error("FRONTEND_SECRET_KEY missing");
    }

    const encoder = new TextEncoder();

    const hash = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(secret)
    );

    return crypto.subtle.importKey(
        "raw",
        hash,
        {
            name: ALGORITHM
        },
        false,
        ["encrypt", "decrypt"]
    );
}


export async function encryptPassword(password, env) {
    const key = await getKey(env);

    const iv = crypto.getRandomValues(
        new Uint8Array(12)
    );

    const encrypted = await crypto.subtle.encrypt(
        {
            name: ALGORITHM,
            iv
        },
        key,
        new TextEncoder().encode(password)
    );

    // AES-GCM appends the 16-byte authentication tag.
    const encryptedBytes =
        new Uint8Array(encrypted);

    const content =
        encryptedBytes.slice(
            0,
            encryptedBytes.length - 16
        );

    const tag =
        encryptedBytes.slice(
            encryptedBytes.length - 16
        );

    return {
        iv: bytesToHex(iv),
        content: bytesToHex(content),
        tag: bytesToHex(tag)
    };
}


export async function decryptPassword(data, env) {
    const key = await getKey(env);

    const iv = hexToBytes(data.iv);
    const content = hexToBytes(data.content);
    const tag = hexToBytes(data.tag);

    // Web Crypto expects ciphertext + authentication tag.
    const encrypted = new Uint8Array(
        content.length + tag.length
    );

    encrypted.set(content, 0);
    encrypted.set(tag, content.length);

    const decrypted = await crypto.subtle.decrypt(
        {
            name: ALGORITHM,
            iv
        },
        key,
        encrypted
    );

    return new TextDecoder().decode(decrypted);
}


function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}


function hexToBytes(hex) {
    if (
        typeof hex !== "string" ||
        hex.length % 2 !== 0
    ) {
        throw new Error("Invalid hex data");
    }

    const bytes = new Uint8Array(
        hex.length / 2
    );

    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(
            hex.slice(i * 2, i * 2 + 2),
            16
        );
    }

    return bytes;
}