import assert from "node:assert/strict";

const BASE_URL = "http://127.0.0.1:8787";
const results = [];

let galleryCookie = null;
let articlesCookie = null;

async function request(path, options = {}) {
  return fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    ...options,
  });
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error(`Expected JSON; received HTTP ${response.status}`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    results.push(true);
    console.log(`\x1b[32m✓ PASS\x1b[0m ${name}`);
  } catch (error) {
    results.push(false);
    console.log(`\x1b[31m✗ FAIL\x1b[0m ${name}`);
    console.log(`  ${error.message}`);
  }
}

// Read credentials directly in the terminal.
// Password input is hidden and never written to a file.
async function ask(prompt, hidden = false) {
  const input = process.stdin;

  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Run this script directly in an interactive terminal.");
  }

  process.stdout.write(prompt);
  input.setEncoding("utf8");
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = "";

    function cleanup() {
      input.removeListener("data", onData);
      input.setRawMode(false);
      input.pause();
    }

    function onData(chunk) {
      for (const char of chunk) {
        if (char === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Input cancelled."));
          return;
        }

        if (char === "\r" || char === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (!hidden) process.stdout.write("\b \b");
          }
          continue;
        }

        if (char >= " ") {
          value += char;
          if (!hidden) process.stdout.write(char);
        }
      }
    }

    input.on("data", onData);
  });
}

function cookieFrom(response, name) {
  const headers = response.headers;
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);

  const header = setCookies.find((value) =>
    value.startsWith(`${name}=`)
  );

  if (!header) {
    throw new Error(`Response did not set ${name}`);
  }

  const pair = header.split(";")[0];

  if (!pair || pair === `${name}=`) {
    throw new Error(`${name} cookie is empty`);
  }

  return pair;
}

async function login(type, username, password) {
  const response = await request("/frontend/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type, username, password }),
  });

  const body = await readJson(response);

  assert.equal(
    response.status,
    200,
    `${type} login failed: ${body.message || response.status}`
  );
  assert.equal(body.success, true, body.message || "Login unsuccessful");
  assert.equal(body.authenticated, true);

  const cookieName =
    type === "gallery"
      ? "gallery_frontend_token"
      : "articles_frontend_token";

  return cookieFrom(response, cookieName);
}

async function checkSession(type, cookie) {
  const response = await request(
    `/frontend/check?type=${type}`,
    {
      headers: cookie ? { Cookie: cookie } : {},
    }
  );

  const body = await readJson(response);

  return { response, body };
}

async function logout(type, cookie) {
  const response = await request(
    `/frontend/logout?type=${type}`,
    {
      method: "POST",
      headers: cookie ? { Cookie: cookie } : {},
    }
  );

  const body = await readJson(response);

  assert.equal(
    response.status,
    200,
    `${type} logout returned HTTP ${response.status}`
  );
  assert.equal(body.success, true, body.message || "Logout unsuccessful");

  const cookieName =
    type === "gallery"
      ? "gallery_frontend_token"
      : "articles_frontend_token";

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);

  const clearHeader = setCookies.find((value) =>
    value.startsWith(`${cookieName}=`)
  );

  assert.ok(clearHeader, `Logout did not clear ${cookieName}`);

  return body;
}

console.log("\nGallery Worker — API & Session Tests\n");

await test("Local Worker server is reachable", async () => {
  const response = await request("/");
  assert.ok(response.status < 500, `HTTP ${response.status}`);
});

if (results.length === 0 || !results[0]) {
  console.log("\nStart the local server with: npm run local");
  process.exit(1);
}

let galleryUsername;
let galleryPassword;
let articlesUsername;
let articlesPassword;

try {
  console.log("\nEnter credentials locally. Passwords will be hidden.\n");

  galleryUsername = await ask("Gallery username: ");
  galleryPassword = await ask("Gallery password: ", true);

  articlesUsername = await ask("Articles username: ");
  articlesPassword = await ask("Articles password: ", true);
} catch (error) {
  console.error(`\n${error.message}`);
  process.exit(1);
}

await test("Gallery login succeeds and sets its own cookie", async () => {
  galleryCookie = await login(
    "gallery",
    galleryUsername,
    galleryPassword
  );
});

await test("Articles login succeeds and sets its own cookie", async () => {
  articlesCookie = await login(
    "articles",
    articlesUsername,
    articlesPassword
  );
});

await test("Gallery cookie authenticates Gallery", async () => {
  assert.ok(galleryCookie, "Gallery login did not establish a session");
  const { response, body } = await checkSession("gallery", galleryCookie);
  assert.equal(response.status, 200, body.message || "Gallery check failed");
  assert.equal(body.authenticated, true);
});

await test("Articles cookie authenticates Articles", async () => {
  assert.ok(articlesCookie, "Articles login did not establish a session");
  const { response, body } = await checkSession("articles", articlesCookie);
  assert.equal(response.status, 200, body.message || "Articles check failed");
  assert.equal(body.authenticated, true);
});

await test("Gallery cookie cannot authenticate Articles", async () => {
  assert.ok(galleryCookie, "Gallery login did not establish a session");
  const { response } = await checkSession("articles", galleryCookie);
  assert.equal(response.status, 401);
});

await test("Articles cookie cannot authenticate Gallery", async () => {
  assert.ok(articlesCookie, "Articles login did not establish a session");
  const { response } = await checkSession("gallery", articlesCookie);
  assert.equal(response.status, 401);
});

await test("Gallery logout clears only the Gallery cookie", async () => {
  assert.ok(galleryCookie, "Gallery login did not establish a session");

  await logout("gallery", galleryCookie);
  galleryCookie = null;

  const { response } = await checkSession("gallery", articlesCookie);
  assert.equal(response.status, 401, "Gallery should now be unauthenticated");
});

await test("Articles session remains valid after Gallery logout", async () => {
  assert.ok(articlesCookie, "Articles login did not establish a session");

  const { response, body } = await checkSession("articles", articlesCookie);
  assert.equal(response.status, 200, body.message || "Articles session was lost");
  assert.equal(body.authenticated, true);
});

await test("Articles logout clears the Articles cookie", async () => {
  assert.ok(articlesCookie, "Articles login did not establish a session");

  await logout("articles", articlesCookie);
  articlesCookie = null;

  const { response } = await checkSession("articles", null);
  assert.equal(response.status, 401, "Articles should now be unauthenticated");
});

const passed = results.filter(Boolean).length;
const failed = results.length - passed;

console.log("\n--------------------------------");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("--------------------------------");

if (failed > 0) {
  process.exitCode = 1;
}
