// ======================================
// DASHBOARD MODULE
// ======================================


async function loadDashboard(){

    try{

        const [
            stats,
            storage,
            imageData,
            health,
            articleData
        ] = await Promise.all([

            api(API.STATS),
            api(API.STORAGE),
            api(API.IMAGES),
            api(API.HEALTH),
            api(API.ARTICLES)

        ]);


        // ==============================
        // DASHBOARD STATS
        // ==============================

        setText(
            dom.albumsCount,
            stats.albums || 0
        );

        setText(
            dom.imagesCount,
            stats.images || 0
        );

        setText(
            dom.storageSize,
            storage.storage || "0 MB"
        );

        setText(
            dom.uploadsTodayDashboard,
            stats.uploadsToday || 0
        );


        // ==============================
        // HEALTH SCORE
        // ==============================

        const score =
            calculateHealthScore(
                health
            );

        setText(
            dom.dashboardHealth,
            `${score}%`
        );


        // ==============================
        // RECENT UPLOADS
        // ==============================

        renderRecentUploads(
            imageData.images || []
        );


        // ==============================
        // RECENT ARTICLES
        // ==============================

        renderRecentArticles(
            articleData.articles || []
        );


    }
    catch(err){

        handleError(
            err,
            "Unable to load dashboard"
        );

    }

}




// ======================================
// RECENT UPLOADS
// ======================================


function renderRecentUploads(images){

    if(!dom.recentUploads){
        return;
    }


    if(!images.length){

        dom.recentUploads.innerHTML = `
            <div>
                No uploads yet
            </div>
        `;

        return;
    }


    const recent =
        [...images]
            .sort(
                (a, b) =>
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
            )
            .slice(0, 5);


    dom.recentUploads.innerHTML =
        recent
            .map(
                image => `
                    <div class="timeline-item list-item">

                        <strong>
                            ${image.filename}
                        </strong>

                        <small>
                            ${image.album}
                        </small>

                    </div>
                `
            )
            .join("");

}




// ======================================
// RECENT ARTICLES
// ======================================


function renderRecentArticles(articles){

    const container =
        document.getElementById(
            "recentArticles"
        );


    if(!container){
        return;
    }


    if(!articles.length){

        container.innerHTML = `
            <div class="list-item">
                No articles yet
            </div>
        `;

        return;
    }


    const recent =
        [...articles]
            .sort(
                (a, b) =>
                    new Date(b.date || 0) -
                    new Date(a.date || 0)
            )
            .slice(0, 5);


    container.innerHTML =
        recent
            .map(article => {

                const status =
                    article.draft
                        ? "Draft"
                        : article.protected
                            ? "Protected"
                            : "Public";


                return `
                    <div class="dashboard-article-item">

                        <div class="dashboard-article-info">

                            <strong>
                                ${article.title}
                            </strong>

                            <small>
                                ${article.displayDate || article.date || ""}
                                ${article.readTime
                                    ? ` • ${article.readTime}`
                                    : ""}
                            </small>

                        </div>

                        <span class="dashboard-article-status">
                            ${status}
                        </span>

                    </div>
                `;

            })
            .join("");

}




// ======================================
// DASHBOARD STATS
// ======================================


function updateStats(){

    // Reserved for future live stat updates

}




// ======================================
// DASHBOARD ACTIONS
// ======================================


function openCreateAlbum(){

    showPage(
        "albums"
    );

    dom.newAlbumBtn?.click();

}




function openUploadPage(){

    showPage(
        "upload"
    );

}




function openScannerPage(){

    showPage(
        "scanner"
    );

}




function openImagesPage(){

    imagesOrigin = null;

    showPage(
        "images"
    );

    dom.imageSearch?.focus();

}