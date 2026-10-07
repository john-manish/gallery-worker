import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import worker from "../src/index.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");


function loadEnvFile() {

  const envPath = path.join(
    PROJECT_ROOT,
    ".dev.vars"
  );

  if (!fs.existsSync(envPath)) {
    return {};
  }

  const env = {};

  for (
    const line of fs.readFileSync(
      envPath,
      "utf8"
    ).split(/\r?\n/)
  ) {

    const trimmed = line.trim();

    if (
      !trimmed ||
      trimmed.startsWith("#")
    ) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key =
      trimmed.slice(0, index).trim();

    let value =
      trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') &&
       value.endsWith('"')) ||
      (value.startsWith("'") &&
       value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}


// =========================================================
// MIME TYPES
// =========================================================

function getContentType(filePath) {

  const ext =
    path.extname(filePath)
      .toLowerCase();

  const types = {

    ".html": "text/html; charset=utf-8",

    ".css": "text/css; charset=utf-8",

    ".js": "application/javascript; charset=utf-8",

    ".json": "application/json; charset=utf-8",

    ".webmanifest": "application/manifest+json",

    ".svg": "image/svg+xml",

    ".png": "image/png",

    ".jpg": "image/jpeg",

    ".jpeg": "image/jpeg",

    ".webp": "image/webp",

    ".gif": "image/gif",

    ".ico": "image/x-icon",

    ".txt": "text/plain; charset=utf-8",

    ".xml": "application/xml; charset=utf-8"

  };

  return (
    types[ext] ||
    "application/octet-stream"
  );
}


// =========================================================
// LOCAL ASSETS BINDING
// =========================================================

const env = loadEnvFile();

// =========================================================
// REMOTE CLOUDFLARE KV ADAPTER — LOCAL DEVELOPMENT
// =========================================================

function createRemoteKV(namespaceId) {
  const accountId =
    env.CLOUDFLARE_ACCOUNT_ID;

  const apiToken =
    env.CLOUDFLARE_API_TOKEN;

  if (
    !accountId ||
    !namespaceId ||
    !apiToken
  ) {
    throw new Error(
      "Missing Cloudflare KV credentials in .dev.vars"
    );
  }

  const baseUrl =
    `https://api.cloudflare.com/client/v4/accounts/` +
    `${accountId}/storage/kv/namespaces/` +
    `${namespaceId}/values/`;

  async function request(
    key,
    options = {}
  ) {
    const response =
      await fetch(
        baseUrl +
          encodeURIComponent(key),
        {
          ...options,

          headers: {
            Authorization:
              `Bearer ${apiToken}`,

            ...(options.headers || {})
          }
        }
      );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText =
        await response.text();

      throw new Error(
        `Cloudflare KV ${response.status}: ${errorText}`
      );
    }

    return response;
  }

  return {

    async get(key, type = "text") {
      const response =
        await request(key);

      if (!response) {
        return null;
      }

      const text =
        await response.text();

      if (type === "json") {
        return JSON.parse(text);
      }

      return text;
    },

    async put(key, value) {
      await request(key, {
        method: "PUT",

        headers: {
          "Content-Type":
            "text/plain; charset=utf-8"
        },

        body: String(value)
      });
    },

    async delete(key) {
      await request(key, {
        method: "DELETE"
      });
    }

  };
}

// Cloudflare Worker-compatible KV binding
env.GALLERY_CACHE =
  createRemoteKV(
    env.GALLERY_CACHE_NAMESPACE_ID
  );

env.ARTICLE_CACHE =
  createRemoteKV(
    env.ARTICLE_CACHE_NAMESPACE_ID
  );

env.ASSETS = {

  async fetch(request) {

    const url =
      new URL(request.url);

    let pathname =
      decodeURIComponent(
        url.pathname
      );


    // -------------------------------------
    // Frontend root
    // -------------------------------------

    if (pathname === "/") {

      pathname =
        "/admin/index.html";

    }


    // -------------------------------------
    // /admin
    // -------------------------------------

    if (pathname === "/admin") {

      pathname =
        "/admin/index.html";

    }


    // -------------------------------------
    // Prevent path traversal
    // -------------------------------------

    const relativePath =
      pathname.replace(
        /^\/+/,
        ""
      );

    const filePath =
      path.resolve(
        PUBLIC_DIR,
        relativePath
      );

    if (
      filePath !== PUBLIC_DIR &&
      !filePath.startsWith(
        PUBLIC_DIR + path.sep
      )
    ) {

      return new Response(
        "Forbidden",
        {
          status: 403
        }
      );

    }


    // -------------------------------------
    // File exists?
    // -------------------------------------

    if (
      !fs.existsSync(filePath) ||
      !fs.statSync(filePath).isFile()
    ) {

      return new Response(
        "Not Found",
        {
          status: 404
        }
      );

    }


    // -------------------------------------
    // HEAD
    // -------------------------------------

    if (request.method === "HEAD") {

      return new Response(
        null,
        {
          status: 200,
          headers: {
            "Content-Type":
              getContentType(filePath)
          }
        }
      );

    }


    // -------------------------------------
    // GET
    // -------------------------------------

    const file =
      fs.readFileSync(filePath);

    return new Response(
      file,
      {
        status: 200,
        headers: {
          "Content-Type":
            getContentType(filePath),

          "Cache-Control":
            "no-cache"
        }
      }
    );

  }

};


const server =
  http.createServer(
    async (req, res) => {

      try {

        const url =
          `http://${req.headers.host || "localhost:8787"}${req.url}`;


        // =====================================
        // REQUEST HEADERS
        // =====================================

        const headers =
          new Headers();

        for (
          const [key, value]
          of Object.entries(req.headers)
        ) {

          if (value !== undefined) {

            headers.set(
              key,
              Array.isArray(value)
                ? value.join(", ")
                : value
            );

          }

        }


        // =====================================
        // REQUEST BODY
        // =====================================

        const chunks = [];

        for await (
          const chunk of req
        ) {

          chunks.push(chunk);

        }

        const body =
          chunks.length > 0
            ? Buffer.concat(chunks)
            : undefined;


        // =====================================
        // WEB REQUEST
        // =====================================

        const request =
          new Request(
            url,
            {
              method: req.method,

              headers,

              body:
                ["GET", "HEAD"].includes(
                  req.method
                )
                  ? undefined
                  : body
            }
          );


        // =====================================
        // WORKER
        // =====================================

        const response =
          await worker.fetch(
            request,
            env,
            {}
          );


        // =====================================
        // RESPONSE
        // =====================================

        res.statusCode =
          response.status;

        response.headers.forEach(
          (value, key) => {

            res.setHeader(
              key,
              value
            );

          }
        );


        const responseBody =
          Buffer.from(
            await response.arrayBuffer()
          );

        res.end(
          responseBody
        );


      } catch (error) {

        console.error(
          error
        );

        res.statusCode =
          500;

        res.setHeader(
          "content-type",
          "application/json"
        );

        res.end(
          JSON.stringify({
            ok: false,
            error:
              error?.message ||
              String(error)
          })
        );

      }

    }
  );


const PORT =
  Number(
    process.env.PORT ||
    8787
  );


server.listen(
  PORT,
  "127.0.0.1",
  () => {

    console.log(
      `Local Worker server running at http://localhost:${PORT}`
    );

    console.log(
      `Static frontend directory: ${PUBLIC_DIR}`
    );

  }
);