const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

let cachedToken = null;
let tokenExpiresAt = 0;

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function base64url(input) {
  const bytes = new TextEncoder().encode(input);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function arrayBufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function createJwt(env) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const payload = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/drive",
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));

  const unsignedToken =
    `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(env.GOOGLE_PRIVATE_KEY),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  return `${unsignedToken}.${arrayBufferToBase64url(signature)}`;
}

async function getAccessToken(env) {
  if (
    cachedToken &&
    Date.now() < tokenExpiresAt
  ) {
    return cachedToken;
  }

  const assertion = await createJwt(env);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type":
        "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type:
        "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  if (!response.ok) {
    const error = await response.text();

    throw new Error(
      `Google token request failed: ${response.status} ${error}`
    );
  }

  const data = await response.json();

  cachedToken = data.access_token;

  tokenExpiresAt =
    Date.now() + ((data.expires_in || 3600) - 60) * 1000;

  return cachedToken;
}

export async function driveFetch(
  env,
  path,
  options = {}
) {
  const token = await getAccessToken(env);

  const response = await fetch(
    `${DRIVE_API}${path}`,
    {
      ...options,
      headers: {
        authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();

    throw new Error(
      `Google Drive API failed: ${response.status} ${error}`
    );
  }

  return response;
}

export async function getDriveFile(env, fileId) {
  const response = await driveFetch(
    env,
    `/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,parents`
  );

  return response.json();
}

export async function listDriveFiles(
  env,
  query,
  fields =
    "files(id,name,mimeType,size,modifiedTime,parents)"
) {
  const params = new URLSearchParams({
    q: query,
    fields,
    pageSize: "1000"
  });

  const response = await driveFetch(
    env,
    `/files?${params.toString()}`
  );

  return response.json();
}
