import {
  listArticles,
  getArticleBySlug,
  updateArticle,
  getArticleHistory,
  restoreArticleHistory,
  deleteArticleHistory,
  deleteOldArticleHistory,
  clearArticleHistory
} from "../articles/articleDrive.js";


function jsonResponse(body, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}


function buildEditorMarkdown(article) {
  return `---
title: ${article.title || ""}
author: ${article.author || ""}
role: ${article.role || ""}
date: ${article.date || ""}
hero: ${article.hero || ""}
tags: ${article.tags || ""}
popular: ${article.popular ? "true" : "false"}
draft: ${article.draft ? "true" : "false"}
---

${(article.markdown || "").trim()}
`;
}


export async function adminArticlesRoute(
  request,
  env,
  ctx
) {

  const url =
    new URL(request.url);

  const pathname =
    url.pathname;


// =========================================================
// GET /admin/articles
// =========================================================

if (
  pathname === "/admin/articles" &&
  request.method === "GET"
) {

  try {

    const result =
      await listArticles(env);


    const articles =
      (result.rows || []).map(article => {

        const date =
          article.date ||
          article.$createdAt ||
          article.created_at ||
          "";


        const displayDate =
          date
            ? new Date(date).toLocaleDateString(
                "en-IN",
                {
                  day: "2-digit",
                  month: "long",
                  year: "numeric"
                }
              )
            : "";


        const words =
          String(article.markdown || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .length;


        const readTime =
          Math.max(
            1,
            Math.ceil(words / 200)
          ) + " min read";


        return {

          ...article,

          article:
            article.slug,

          date,

          displayDate,

          readTime,

          title:
            article.title || "",

          author:
            article.author || "",

          role:
            article.role || "",

          hero:
            article.hero || "",

          tags:
            article.tags || "",

          popular:
            !!article.popular,

          protected:
            !!article.protected,

          draft:
            !!article.draft,

          settings:
            article.settings || {}

        };

      });


    return jsonResponse({

      success: true,

      articles

    });

  }
  catch (error) {

    console.error(
      "Admin articles list error:",
      error
    );


    return jsonResponse(
      {
        success: false,

        message:
          error.message ||
          "Failed to load articles"
      },
      500
    );

  }

}


  // =========================================================
  // ARTICLE HISTORY
  // =========================================================

  const historyMatch =
    pathname.match(
      /^\/admin\/articles\/([^/]+)\/history(?:\/(.+))?$/
    );


  if (historyMatch) {

    const slug =
      decodeURIComponent(
        historyMatch[1]
      );

    const historyPath =
      historyMatch[2]
        ? decodeURIComponent(
            historyMatch[2]
          )
        : null;


    // -------------------------------------------------------
    // GET /admin/articles/:slug/history
    // -------------------------------------------------------

    if (
      request.method === "GET" &&
      !historyPath
    ) {

      try {

        const versions =
          await getArticleHistory(
            env,
            slug
          );

        return jsonResponse({
          success: true,
          versions
        });

      }
      catch (error) {

        console.error(
          "Article history load error:",
          error
        );

        return jsonResponse(
          {
            success: false,
            message:
              error.message ||
              "Failed to load article history"
          },
          500
        );

      }

    }


    // -------------------------------------------------------
    // POST /admin/articles/:slug/history/:version/restore
    // -------------------------------------------------------

    const restoreMatch =
      historyPath?.match(
        /^(.+)\/restore$/
      );

    if (
      request.method === "POST" &&
      restoreMatch
    ) {

      const version =
        restoreMatch[1];

      try {

        const article =
          await restoreArticleHistory(
            env,
            slug,
            version
          );

        return jsonResponse({
          success: true,
          article,
          message:
            "History version restored."
        });

      }
      catch (error) {

        console.error(
          "Article history restore error:",
          error
        );

        return jsonResponse(
          {
            success: false,
            message:
              error.message ||
              "Failed to restore history version"
          },
          500
        );

      }

    }


    // -------------------------------------------------------
    // DELETE /admin/articles/:slug/history/old
    // -------------------------------------------------------

    if (
      request.method === "DELETE" &&
      historyPath === "old"
    ) {

      try {

        const deleted =
          await deleteOldArticleHistory(
            env,
            slug
          );

        return jsonResponse({
          success: true,
          deleted,
          message:
            `Deleted ${deleted} old history version(s).`
        });

      }
      catch (error) {

        console.error(
          "Delete old article history error:",
          error
        );

        return jsonResponse(
          {
            success: false,
            message:
              error.message ||
              "Failed to delete old history"
          },
          500
        );

      }

    }


    // -------------------------------------------------------
    // DELETE /admin/articles/:slug/history/clear
    // -------------------------------------------------------

    if (
      request.method === "DELETE" &&
      historyPath === "clear"
    ) {

      try {

        const deleted =
          await clearArticleHistory(
            env,
            slug
          );

        return jsonResponse({
          success: true,
          deleted,
          message:
            `Cleared ${deleted} history version(s).`
        });

      }
      catch (error) {

        console.error(
          "Clear article history error:",
          error
        );

        return jsonResponse(
          {
            success: false,
            message:
              error.message ||
              "Failed to clear history"
          },
          500
        );

      }

    }


    // -------------------------------------------------------
    // DELETE /admin/articles/:slug/history/:version
    // -------------------------------------------------------

    if (
      request.method === "DELETE" &&
      historyPath
    ) {

      try {

        await deleteArticleHistory(
          env,
          slug,
          historyPath
        );

        return jsonResponse({
          success: true,
          message:
            "History version deleted."
        });

      }
      catch (error) {

        console.error(
          "Delete article history error:",
          error
        );

        return jsonResponse(
          {
            success: false,
            message:
              error.message ||
              "Failed to delete history version"
          },
          500
        );

      }

    }

  }


  // =========================================================
  // GET /admin/articles/:slug
  // =========================================================

  const match =
    pathname.match(
      /^\/admin\/articles\/([^/]+)$/
    );


  if (
    match &&
    request.method === "GET"
  ) {

    try {

      const slug =
        decodeURIComponent(
          match[1]
        );

      const article =
        await getArticleBySlug(
          env,
          slug
        );


      if (!article) {

        return jsonResponse(
          {
            success: false,
            message:
              "Article not found"
          },
          404
        );

      }


      return jsonResponse({
        success: true,

        ...article,

        markdown:
          buildEditorMarkdown(article),

        protected:
          article.protected ?? false,

        settings:
          article.settings || {}
      });

    }
    catch (error) {

      console.error(
        "Admin article load error:",
        error
      );

      return jsonResponse(
        {
          success: false,
          message:
            error.message ||
            "Failed to load article"
        },
        500
      );

    }

  }


  // =========================================================
  // PUT /admin/articles/:slug
  // =========================================================

  if (
    match &&
    request.method === "PUT"
  ) {

    try {

      const slug =
        decodeURIComponent(
          match[1]
        );

      const body =
        await request.json();

      const meta =
        body?.meta || {};

      const articleData = {
        slug,

        title:
          meta.title || "",

        author:
          meta.author || "",

        role:
          meta.role || "",

        date:
          meta.date || "",

        hero:
          meta.hero || "",

        tags:
          meta.tags || "",

        markdown:
          body.markdown || "",

        draft:
          !!meta.draft,

        protected:
          !!meta.protected,

        popular:
          !!meta.popular,

        settings:
          body.settings || {}
      };


      const updated =
        await updateArticle(
          env,
          slug,
          articleData
        );


      return jsonResponse({
        success: true,
        message:
          "Article saved successfully.",
        article:
          updated
      });

    }
    catch (error) {

      console.error(
        "Admin article save error:",
        error
      );

      return jsonResponse(
        {
          success: false,
          message:
            error.message ||
            "Failed to save article"
        },
        500
      );

    }

  }


  // =========================================================
  // NOT FOUND
  // =========================================================

  return jsonResponse(
    {
      success: false,
      message: "Not found"
    },
    404
  );

}