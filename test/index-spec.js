
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";

import {
  describe,
  it,
  expect,
} from "vitest";

import worker from "../src";

/**
 * ==========================================================
 * WORKER TEST CONFIGURATION
 * ==========================================================
 *
 * Articles API: /articles
 * Gallery API:  /gallery
 *
 * These tests run against the local Worker test runtime.
 * They do not call the deployed Render or Pages services.
 */

const BASE_URL = "https://worker.test";

const ROUTES = {
  root: "/",
  articles: "/articles",
  gallery: "/gallery",

  // Shared frontend authentication
  galleryCheck: "/frontend/check?type=gallery",
  articlesCheck: "/frontend/check?type=articles",

  galleryLogout: "/frontend/logout?type=gallery",
  articlesLogout: "/frontend/logout?type=articles",
};

const METHODS = ["GET", "HEAD"];

function createRequest(path, options = {}) {
  return new Request(`${BASE_URL}${path}`, options);
}

async function callWorker(path, options = {}) {
  return worker.fetch(
    createRequest(path, options),
    env,
    createExecutionContext(),
  );
}

async function expectHandledResponse(response) {
  // Authentication errors are valid responses for protected routes.
  // Server errors and missing routes should be investigated.
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(500);
  expect(response.status).not.toBe(404);
}

async function expectJsonResponse(response) {
  const contentType =
    response.headers.get("content-type") || "";

  expect(contentType).toContain("application/json");

  return response.json();
}

/**
 * ==========================================================
 * 1. WORKER ENTRY POINT
 * ==========================================================
 */

describe("Worker entry point", () => {
  it("handles a basic request", async () => {
    const response = await callWorker(ROUTES.root);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBeGreaterThan(0);
  });

  it("returns a valid HTTP response through SELF", async () => {
    const response = await SELF.fetch(
      createRequest(ROUTES.root),
    );

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBeGreaterThan(0);
  });

  it("supports normal HTTP response headers", async () => {
    const response = await callWorker(ROUTES.root);

    expect(response.headers).toBeInstanceOf(Headers);
  });
});

/**
 * ==========================================================
 * 2. ARTICLES API
 * ==========================================================
 */

describe("Articles API", () => {
  it("responds to GET /articles", async () => {
    const response = await callWorker(ROUTES.articles);

    await expectHandledResponse(response);
  });

  it("returns JSON for a successful or error API response", async () => {
    const response = await callWorker(ROUTES.articles);

    const contentType =
      response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await response.json();

      expect(body).toBeDefined();
      expect(body).not.toBeNull();
    } else {
      // Report unexpected HTML or another response format.
      expect(contentType).not.toContain("text/html");
    }
  });

  it.each(METHODS)(
    "handles %s requests for /articles",
    async (method) => {
      const response = await callWorker(
        ROUTES.articles,
        { method },
      );

      await expectHandledResponse(response);
    },
  );
});

/**
 * ==========================================================
 * 3. GALLERY API
 * ==========================================================
 */

describe("Gallery API", () => {
  it("responds to GET /gallery", async () => {
    const response = await callWorker(ROUTES.gallery);

    // 401/403 can be valid when authentication is required.
    await expectHandledResponse(response);
  });

  it.each(METHODS)(
    "handles %s requests for /gallery",
    async (method) => {
      const response = await callWorker(
        ROUTES.gallery,
        { method },
      );

      await expectHandledResponse(response);
    },
  );

  it("returns an API response rather than the Hello World placeholder", async () => {
    const response = await callWorker(ROUTES.gallery);
    const body = await response.text();

    expect(body).not.toBe("Hello World!");
  });
});

/**
 * ==========================================================
 * 4. SHARED FRONTEND AUTHENTICATION
 * ==========================================================
 */

describe("Shared frontend authentication", () => {
  it.each([
    ["gallery", ROUTES.galleryCheck],
    ["articles", ROUTES.articlesCheck],
  ])(
    "handles the %s session check route",
    async (_frontend, path) => {
      const response = await callWorker(path);

      // A session check may return 200, 401, or 403
      // depending on whether a session is present.
      await expectHandledResponse(response);
    },
  );

  it.each([
    ["gallery", ROUTES.galleryLogout],
    ["articles", ROUTES.articlesLogout],
  ])(
    "handles the %s logout route",
    async (_frontend, path) => {
      const response = await callWorker(path, {
        method: "POST",
      });

      await expectHandledResponse(response);
    },
  );
});

/**
 * ==========================================================
 * 5. API ERROR HANDLING
 * ==========================================================
 */

describe("API error handling", () => {
  it("does not crash on an unknown API route", async () => {
    const response = await callWorker(
      "/this-route-should-not-exist",
    );

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBeGreaterThan(0);
  });

  it("returns a valid status code for malformed JSON login input", async () => {
    const response = await callWorker("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{ invalid json",
    });

    // The route may reject the input or require a different
    // authentication path; inspect the result if it is a 404.
    expect(response.status).toBeGreaterThan(0);
    expect(response.status).toBeLessThan(500);
  });
});

/**
 * ==========================================================
 * 6. RESPONSE CLEANUP
 * ==========================================================
 */

describe("Execution context", () => {
  it("waits for background work to settle", async () => {
    const request = createRequest(ROUTES.articles);
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, env, ctx);

    await waitOnExecutionContext(ctx);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBeGreaterThan(0);
  });
});
