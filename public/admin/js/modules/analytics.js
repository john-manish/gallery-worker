
const GALLERY_STORAGE_LIMIT_GB = 10;

let storageHistoryUnit = "AUTO";
let storageHistoryRange = "1M";


function setStorageHistoryUnit(unit){

    if(
        unit !== "AUTO" &&
        unit !== "GB" &&
        unit !== "MB"
    ){
        return;
    }

    storageHistoryUnit =
        unit;

    renderStorageHistory();

}


function setStorageHistoryRange(range){

    if(
        !["7D", "1M", "1Y"].includes(range)
    ){
        return;
    }

    storageHistoryRange =
        range;

    renderStorageHistory();

}

// ======================================
// ANALYTICS STATE
// ======================================

let analyticsData = {

    albums: 0,
    images: 0,

    storage: "0 MB",
    imagesStorage: "0 MB",
    thumbsStorage: "0 MB",

    uploadsToday: 0,

    largestAlbum: "-",
    mostActiveAlbum: "-",
    newestAlbum: "-",

    averageImageSize: "0 MB",
    spaceSaved: "0%",

    largestImage: "-",
    mostActiveDay: "-",

    health: null,

    albumDistribution: [],
    activity: [],
    uploadActivity: {},
    storageHistory: []

};



// ======================================
// INIT
// ======================================


function initAnalytics(){

    initStorageHistorySettings();

    initStorageHistoryCustomScrollbar();


    window.addEventListener(
        "resize",
        () => {

            renderAnalytics();

        }
    );

}


async function refreshAnalytics(){

    await loadAnalytics();

}



// ======================================
// LOAD ANALYTICS
// ======================================


async function loadAnalytics(){

    try{

        const [
            stats,
            storage,
            albums,
            imageData,
            activityData,
            history,
            health
        ] = await Promise.all([

            api(API.STATS),
            api(API.STORAGE),
            api(API.ALBUMS),
            api(API.IMAGES),
            api(API.ACTIVITY),
            api(API.HISTORY),
            api(API.HEALTH)

        ]);

        const images =
            imageData.images || [];

        analyticsData.albums =
            (albums.albums || []).length;

        analyticsData.images =
            stats.images || 0;

        analyticsData.storage =
            storage.storage || "0 MB";

        analyticsData.imagesStorage =
            storage.imagesStorage || "0 MB";

        analyticsData.thumbsStorage =
            storage.thumbsStorage || "0 MB";
        
        analyticsData.storageHistory =
            history.history || [];

        analyticsData.uploadsToday =
            stats.uploadsToday || 0;

        analyticsData.largestAlbum =
            stats.largestAlbum || "-";


        analyticsData.mostActiveAlbum =
            stats.mostActiveAlbum || "-";


        analyticsData.albumDistribution =
            albums.albums || [];

        analyticsData.activity =
    Array.isArray(activityData)
        ? activityData
        : activityData.activity || [];


        analyticsData.health = health;


        calculateStorageGrowth();

        calculateAnalytics(
            images
        );

        calculateMetricExtras(
            images
        );

        renderAnalytics();

    }
    catch(err){

        console.error(err);

        showToast(
            err.message
        );

    }

}












function calculateStorageGrowth(){

    const history =
        analyticsData
            .storageHistory;

    if(
        history.length < 2
    ){

        analyticsData.storageGrowth =
            null;

        return;
    }

    const current =
        history.at(-1)
            .storage;

    const previous =
        history.at(-2)
            .storage;

    if(
        previous <= 0
    ){

        analyticsData.storageGrowth =
            null;

        return;
    }

    const growth =
        (
            (
                current -
                previous
            ) /
            previous
        ) * 100;

    const sign =
        growth >= 0
            ? "+"
            : "";

    analyticsData.storageGrowth =
        `${sign}${growth.toFixed(1)}%`;

}





function calculateAnalytics(images){

    analyticsData.averageImageSize =
        "0 MB";

    analyticsData.spaceSaved =
        "0%";

    analyticsData.largestImage =
        "-";

    analyticsData.mostActiveDay =
        "-";

    analyticsData.newestAlbum =
        "-";

    analyticsData.uploadActivity =
        {};

    if(
        !images.length
    ){
        return;
    }

    const totalBytes =
        images.reduce(
            (
                sum,
                image
            ) =>
                sum +
                (image.size || 0),
            0
        );

    const totalThumbBytes =
        images.reduce(
            (
                sum,
                image
            ) =>
                sum +
                (image.thumbSize || 0),
            0
        );

    const average =
        totalBytes /
        images.length;

    analyticsData.averageImageSize =
        `${(
            average /
            1024 /
            1024
        ).toFixed(2)} MB`;

    const saved =
        totalBytes
            ? (
                  totalThumbBytes /
                  totalBytes
              ) * 100
            : 0;

    analyticsData.spaceSaved =
        `${saved.toFixed(1)}% `;

    const largest =
        images.reduce(
            (
                max,
                image
            ) =>
                (image.size || 0) >
                (max.size || 0)
                    ? image
                    : max
        );

    analyticsData.largestImage =
        largest.filename || "-";

    const days = {};

    for(
        const image
        of images
    ){

        if(
            !image.createdAt
        ){
            continue;
        }

        const day =
            formatDateTime(
                image.createdAt,
                {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit"
                }
            );


        days[day] =
            (days[day] || 0)
            + 1;

    }

    let activeDay = "-";
    let maxUploads = 0;

    for(
        const day
        in days
    ){

        if(
            days[day] >
            maxUploads
        ){

            maxUploads =
                days[day];

            activeDay =
                day;

        }

    }

    analyticsData.mostActiveDay =
        activeDay;

    analyticsData.uploadActivity =
        days;

    // =========================
    // NEWEST ALBUM
    // =========================

    const newest =
        images.reduce(
            (
                latest,
                image
            ) => {

                if(
                    !image.createdAt
                ){
                    return latest;
                }

                if(
                    !latest
                ){
                    return image;
                }

                return new Date(
                    image.createdAt
                ) >
                new Date(
                    latest.createdAt
                )
                    ? image
                    : latest;

            },
            null
        );

    analyticsData.newestAlbum =
        newest?.album || "-";

}






function renderUploadActivity(){

    const container =
        document.getElementById(
            "uploadActivityChart"
        );

    if(!container){
        return;
    }

    const days =
        Object.entries(
            analyticsData.uploadActivity
        );

    if(!days.length){

        container.innerHTML = `
            <div class="upload-empty">
                No uploads yet
            </div>
        `;

        return;
    }

    const sortedDays =
        [...days].sort(
            (a, b) =>
                new Date(a[0]) -
                new Date(b[0])
        );

    const total =
        sortedDays.reduce(
            (sum, [, count]) =>
                sum + count,
            0
        );

    setText(
        document.getElementById(
            "uploadTotal"
        ),
        `${total} Total Uploads`
    );


    setText(
        dom.storageGrowth,
        analyticsData.storageGrowth
    );


    const max =
        Math.max(
            ...sortedDays.map(
                d => d[1]
            ),
            1
        );

    container.innerHTML = `

        <div class="upload-list">

            ${sortedDays.map(
                ([date, count]) => {

                    const width =
                        (
                            count /
                            max
                        ) * 100;

                    const percent =
                        (
                            count /
                            total
                        ) * 100;

                    return `

                        <div class="upload-row">

                            <div class="upload-top">

                                <span class="upload-date">
                                    ${date}
                                </span>

                                <span class="upload-meta">
                                    ${count}
                                    ${
                                        count === 1
                                            ? " upload"
                                            : " uploads"
                                    }
                                    •
                                    ${percent.toFixed(0)}%
                                </span>

                            </div>

                            <div class="upload-bar">

                                <div
                                    class="upload-fill"
                                    style="
                                        width:${width}%;
                                    "
                                ></div>

                            </div>

                        </div>

                    `;

                }
            ).join("")}

        </div>

    `;

}






function renderUploadChart(){

    const canvas =
        document.getElementById(
            "uploadActivityCanvas"
        );

    if(!canvas){
        return;
    }

    const ctx =
        canvas.getContext(
            "2d"
        );

    const width =
        canvas.parentElement
            .clientWidth;

    const height =
        300;

    canvas.width =
        width;

    canvas.height =
        height;

    const days =
        Object.entries(
            analyticsData
                .uploadActivity
        );

    const max =
        Math.max(
            ...days.map(
                d => d[1]
            ),
            1
        );

    const left = 40;
    const right = 40;
    const top = 30;
    const bottom =
        height - 40;

    const graphWidth =
        width -
        left -
        right;

    const graphHeight =
        bottom -
        top;

    const step =
        graphWidth /
        (
            days.length - 1
        );

    const points = [];

    days.forEach(
        (
            [, count],
            index
        ) => {

            const x =
                left +
                index * step;

            const y =
                bottom -
                (
                    count /
                    max
                ) *
                graphHeight;

            points.push({
                x,
                y
            });

        }
    );

    const gradient =
        ctx.createLinearGradient(
            0,
            top,
            0,
            bottom
        );

    gradient.addColorStop(
        0,
        "rgba(124,92,255,.35)"
    );

    gradient.addColorStop(
        1,
        "rgba(124,92,255,0)"
    );

    ctx.beginPath();

    ctx.moveTo(
        points[0].x,
        bottom
    );

    points.forEach(
        p =>
            ctx.lineTo(
                p.x,
                p.y
            )
    );

    ctx.lineTo(
        points.at(-1).x,
        bottom
    );

    ctx.closePath();

    ctx.fillStyle =
        gradient;

    ctx.fill();

    ctx.beginPath();

    ctx.strokeStyle =
        "#7c5cff";

    ctx.lineWidth = 3;

    points.forEach(
        (
            p,
            i
        ) => {

            if(i === 0){

                ctx.moveTo(
                    p.x,
                    p.y
                );

            }
            else{

                ctx.lineTo(
                    p.x,
                    p.y
                );

            }

        }
    );

    ctx.stroke();

    points.forEach(
        p => {

            ctx.beginPath();

            ctx.fillStyle =
                "#ffffff";

            ctx.arc(
                p.x,
                p.y,
                5,
                0,
                Math.PI * 2
            );

            ctx.fill();

            ctx.beginPath();

            ctx.fillStyle =
                "#7c5cff";

            ctx.arc(
                p.x,
                p.y,
                3,
                0,
                Math.PI * 2
            );

            ctx.fill();

        }
    );

}







function getStorageHistoryForRange(){

    const history =
        [...analyticsData.storageHistory]
            .filter(
                item =>
                    item &&
                    item.date &&
                    Number.isFinite(
                        Number(item.storage)
                    )
            )
            .sort(
                (a, b) =>
                    new Date(a.date) -
                    new Date(b.date)
            );


    if(!history.length){
        return [];
    }


    const now =
        new Date();


    // ======================================
    // 7 DAYS
    // ======================================

    if(
        storageHistoryRange === "7D"
    ){

        const start =
            new Date(now);

        start.setHours(
            0,
            0,
            0,
            0
        );

        start.setDate(
            start.getDate() - 6
        );


        return history.filter(
            item =>
                new Date(
                    item.date
                ) >= start
        );

    }


    // ======================================
    // 1 MONTH
    // ======================================

    if(
        storageHistoryRange === "1M"
    ){

        const start =
            new Date(now);

        start.setHours(
            0,
            0,
            0,
            0
        );

        start.setDate(
            start.getDate() - 29
        );


        return history.filter(
            item =>
                new Date(
                    item.date
                ) >= start
        );

    }


    // ======================================
    // 1 YEAR
    // ======================================

    const start =
        new Date(now);

    start.setHours(
        0,
        0,
        0,
        0
    );

    start.setMonth(
        start.getMonth() - 11
    );

    start.setDate(1);


    const monthly = new Map();


    history
        .filter(
            item =>
                new Date(
                    item.date
                ) >= start
        )
        .forEach(
            item => {

                const date =
                    new Date(
                        item.date
                    );


                const key =
                    `${date.getFullYear()}-${String(
                        date.getMonth() + 1
                    ).padStart(
                        2,
                        "0"
                    )}`;


                // Keep the latest snapshot
                // in each month.
                monthly.set(
                    key,
                    item
                );

            }
        );


    return [
        ...monthly.values()
    ];

}



function initStorageHistoryCustomScrollbar(){

    const viewport =
        document.getElementById(
            "storageHistoryViewport"
        );


    const scroll =
        viewport?.querySelector(
            ".storage-history-scroll"
        );
        

    if(scroll){

        scroll.style.touchAction =
            "pan-y";

    }


    const scrollbar =
        document.getElementById(
            "storageHistoryCustomScrollbar"
        );


    const thumb =
        document.getElementById(
            "storageHistoryCustomThumb"
        );


    if(
        !viewport ||
        !scroll ||
        !scrollbar ||
        !thumb
    ){
        return;
    }


    if(
        scrollbar.dataset.initialized === "true"
    ){
        return;
    }


    scrollbar.dataset.initialized =
        "true";


    let dragging = false;

    let dragStartX = 0;

    let dragStartScrollLeft = 0;

    let touchStartX = 0;

    let touchStartScrollLeft = 0;



    function update(){

        const scrollWidth =
            scroll.scrollWidth;


        const clientWidth =
            scroll.clientWidth;


        const maxScroll =
            Math.max(
                0,
                scrollWidth -
                clientWidth
            );


        if(
            maxScroll <= 0
        ){

            scrollbar.classList.add(
                "hidden"
            );

            return;

        }


        scrollbar.classList.remove(
            "hidden"
        );


        const trackWidth =
            scrollbar.clientWidth;


        const availableWidth =
            Math.max(
                0,
                trackWidth - 8
            );


        const thumbWidth =
            Math.max(
                28,
                (
                    clientWidth /
                    scrollWidth
                ) *
                availableWidth
            );


        const maxThumbLeft =
            Math.max(
                0,
                availableWidth -
                thumbWidth
            );


        const thumbLeft =
            maxScroll > 0
                ? (
                    scroll.scrollLeft /
                    maxScroll
                ) *
                maxThumbLeft
                : 0;


        thumb.style.width =
            `${thumbWidth}px`;


        thumb.style.transform =
            `translateX(${thumbLeft}px)`;

    }




    /* ======================================
   WHEEL SCROLL
====================================== */

scroll.addEventListener(
    "wheel",
    event => {

        if(
            scroll.scrollWidth <=
            scroll.clientWidth
        ){

            return;

        }


        const delta =
            Math.abs(event.deltaX) >
            Math.abs(event.deltaY)
                ? event.deltaX
                : event.deltaY;


        if(
            delta === 0
        ){

            return;

        }


        event.preventDefault();


        scroll.scrollLeft +=
            delta;

    },
    {
        passive:false
    }
);


/* ======================================
   TOUCH / POINTER SCROLL
====================================== */

scroll.addEventListener(
    "pointerdown",
    event => {

        if(
            event.pointerType !== "touch"
        ){

            return;

        }


        touchStartX =
            event.clientX;


        touchStartScrollLeft =
            scroll.scrollLeft;


        scroll.setPointerCapture(
            event.pointerId
        );

    }
);


scroll.addEventListener(
    "pointermove",
    event => {

        if(
            event.pointerType !== "touch" ||
            !scroll.hasPointerCapture(
                event.pointerId
            )
        ){

            return;

        }


        const delta =
            event.clientX -
            touchStartX;


        scroll.scrollLeft =
            touchStartScrollLeft -
            delta;

    }
);


scroll.addEventListener(
    "pointerup",
    event => {

        if(
            event.pointerType === "touch" &&
            scroll.hasPointerCapture(
                event.pointerId
            )
        ){

            scroll.releasePointerCapture(
                event.pointerId
            );

        }

    }
);







    scroll.addEventListener(
        "scroll",
        update,
        {
            passive:true
        }
    );


    window.addEventListener(
        "resize",
        update
    );


    /*
     * Click track to jump.
     */

    scrollbar.addEventListener(
        "pointerdown",
        event => {

            if(
                event.target === thumb
            ){

                return;

            }


            const rect =
                scrollbar.getBoundingClientRect();


            const trackWidth =
                scrollbar.clientWidth -
                8;


            const clickX =
                event.clientX -
                rect.left -
                4;


            const ratio =
                Math.max(
                    0,
                    Math.min(
                        1,
                        clickX /
                        trackWidth
                    )
                );


            const maxScroll =
                scroll.scrollWidth -
                scroll.clientWidth;


            scroll.scrollLeft =
                ratio *
                maxScroll;

        }
    );


    /*
     * Drag thumb.
     */

    thumb.addEventListener(
        "pointerdown",
        event => {

            event.preventDefault();

            event.stopPropagation();


            dragging =
                true;


            dragStartX =
                event.clientX;


            dragStartScrollLeft =
                scroll.scrollLeft;


            thumb.classList.add(
                "dragging"
            );


            thumb.setPointerCapture(
                event.pointerId
            );

        }
    );


    thumb.addEventListener(
        "pointermove",
        event => {

            if(!dragging){

                return;

            }


            const delta =
                event.clientX -
                dragStartX;


            const trackWidth =
                scrollbar.clientWidth -
                8;


            const thumbWidth =
                thumb.offsetWidth;


            const maxThumbLeft =
                Math.max(
                    0,
                    trackWidth -
                    thumbWidth
                );


            const maxScroll =
                Math.max(
                    0,
                    scroll.scrollWidth -
                    scroll.clientWidth
                );


            if(
                maxThumbLeft <= 0 ||
                maxScroll <= 0
            ){

                return;

            }


            const scrollDelta =
                (
                    delta /
                    maxThumbLeft
                ) *
                maxScroll;


            scroll.scrollLeft =
                dragStartScrollLeft +
                scrollDelta;

        }
    );


    function stopDragging(){

        dragging =
            false;


        thumb.classList.remove(
            "dragging"
        );

    }


    thumb.addEventListener(
        "pointerup",
        stopDragging
    );


    thumb.addEventListener(
        "pointercancel",
        stopDragging
    );


    update();

}


function renderStorageHistory(){

    const canvas =
        document.getElementById(
            "storageChart"
        );


    if(!canvas){
        return;
    }


    const viewport =
        document.getElementById(
            "storageHistoryViewport"
        );


    const axis =
        document.getElementById(
            "storageHistoryAxis"
        );


    const scroll =
        viewport?.querySelector(
            ".storage-history-scroll"
        );


        initStorageHistoryCustomScrollbar();

    if(
        !viewport ||
        !axis ||
        !scroll
    ){
        return;
    }


    const ctx =
        canvas.getContext(
            "2d"
        );


    const styles =
        getComputedStyle(
            document.body
        );


    const textColor =
        styles
            .getPropertyValue(
                "--text"
            )
            .trim();


    const mutedColor =
        styles
            .getPropertyValue(
                "--text-muted"
            )
            .trim();


    // ======================================
    // FILTERED HISTORY
    // ======================================

    const history =
        getStorageHistoryForRange();


    // ======================================
    // EMPTY STATE
    // ======================================

    if(!history.length){

        const width =
            scroll.clientWidth;


        const height =
            200;


        canvas.width =
            width;


        canvas.height =
            height;


        canvas.style.width =
            `${width}px`;


        canvas.style.height =
            `${height}px`;


        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        axis.innerHTML =
            "";


        ctx.fillStyle =
            mutedColor;


        ctx.font =
            "500 14px Inter";


        ctx.textAlign =
            "center";


        ctx.fillText(
            "No storage history for this range",
            width / 2,
            height / 2
        );


        return;
    }


    // ======================================
    // VIEWPORT / RANGE LAYOUT
    // ======================================

    const viewportWidth =
        scroll.clientWidth;


    let chartWidth =
        viewportWidth;


    // 7 DAYS
    // Entire graph fits the card.

    if(
        storageHistoryRange === "7D"
    ){

        chartWidth =
            viewportWidth;

    }


    // 1 MONTH
    // Keep every daily snapshot detailed.
    // Graph becomes wider than viewport.

    else if(
        storageHistoryRange === "1M"
    ){

        chartWidth =
            Math.max(
                viewportWidth,
                (
                    history.length *
                    42
                ) + 20
            );

    }


    // ======================================
// 1 YEAR
// Keep every month detailed.
// Graph becomes wider than viewport.
// ======================================

else if(
    storageHistoryRange === "1Y"
){

    chartWidth =
        Math.max(
            viewportWidth,
            (
                history.length *
                50
            ) + 24
        );

}


    // ======================================
// RANGE SCROLL MODE
// ======================================

scroll.classList.remove(
    "storage-range-scroll",
    "storage-range-fit"
);


if(
    storageHistoryRange === "1M" ||
    storageHistoryRange === "1Y"
){

    scroll.classList.add(
        "storage-range-scroll"
    );

}
else{

    scroll.classList.add(
        "storage-range-fit"
    );

}


    // ======================================
    // CANVAS SIZE
    // ======================================

    const width =
        chartWidth;


    const height =
        200;


    canvas.width =
        chartWidth;


    canvas.height =
        height;


    canvas.style.width =
        `${chartWidth}px`;


    canvas.style.height =
        `${height}px`;


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    // ======================================
    // UNIT
    // ======================================

    let unit =
        storageHistoryUnit;


    // AUTO
    if(unit === "AUTO"){

        const maxStorage =
            Math.max(
                ...history.map(
                    item =>
                        Number(
                            item.storage
                        ) || 0
                ),
                0
            );

        unit =
            maxStorage >= 1
                ? "GB"
                : "MB";
    }


    const multiplier =
        unit === "MB"
            ? 1024
            : 1;


    const precision =
        unit === "MB"
            ? 0
            : 1;


    const formatValue =
        value =>
            `${value.toFixed(
                precision
            )} ${unit}`;


    // ======================================
    // VALUES
    // ======================================

    const values =
        history.map(
            item =>
                (
                    Number(
                        item.storage
                    ) || 0
                ) * multiplier
        );


    // ======================================
    // SINGLE POINT
    // ======================================

    if(
        history.length === 1
    ){

        const value =
            values[0];


        const x =
            width / 2;


        const y =
            height / 2;


        axis.innerHTML =
            "";


        ctx.beginPath();


        ctx.fillStyle =
            "#8b5cf6";


        ctx.arc(
            x,
            y,
            6,
            0,
            Math.PI * 2
        );


        ctx.fill();


        ctx.fillStyle =
            textColor;


        ctx.font =
            "600 14px Inter";


        ctx.textAlign =
            "center";


        ctx.fillText(
            formatValue(value),
            x,
            y + 35
        );


        return;
    }


    // ======================================
    // LAYOUT
    // ======================================

    /*
     * The y-axis is now outside the canvas.
     *
     * Therefore:
     *
     * left = 0
     *
     * The fixed 65px axis is handled by
     * #storageHistoryAxis.
     */

    const left =
        20;


    const right =
        20;


    const top =
        20;


    const bottom =
        height - 35;


    const graphWidth =
        width -
        left -
        right;


    const graphHeight =
        bottom -
        top;


    // ======================================
    // SCALE
    // ======================================

    const max =
        Math.max(
            ...values,
            1
        );


    // ======================================
    // FIXED Y-AXIS
    // ======================================

    axis.innerHTML =
        "";


    for(
        let i = 0;
        i <= 4;
        i++
    ){

        const value =
            max -
            (
                max / 4
            ) * i;


        const y =
            top +
            (
                graphHeight / 4
            ) * i;


        const label =
            document.createElement(
                "div"
            );


        label.textContent =
            formatValue(
                value
            );


        label.style.position =
            "absolute";


        label.style.right =
            "8px";


        label.style.top =
            `${y}px`;


        label.style.transform =
            "translateY(-50%)";


        label.style.color =
            mutedColor;


        label.style.font =
            "500 11px Inter";


        label.style.lineHeight =
            "1";


        label.style.whiteSpace =
            "nowrap";


        axis.appendChild(
            label
        );

    }


    // ======================================
    // GRID
    // ======================================

    ctx.strokeStyle =
        "rgba(255,255,255,.06)";


    ctx.lineWidth =
        1;


    for(
        let i = 0;
        i <= 4;
        i++
    ){

        const y =
            top +
            (
                graphHeight / 4
            ) * i;


        ctx.beginPath();


        ctx.moveTo(
            left,
            y
        );


        ctx.lineTo(
            width - right,
            y
        );


        ctx.stroke();

    }


    // ======================================
    // POINTS
    // ======================================

    const points =
        history.map(
            (
                item,
                index
            ) => {

                const x =
                    left +
                    (
                        graphWidth /
                        (
                            history.length - 1
                        )
                    ) *
                    index;


                const y =
                    bottom -
                    (
                        values[index] /
                        max
                    ) *
                    graphHeight;


                return {
                    x,
                    y,
                    item
                };

            }
        );


    // ======================================
    // AREA FILL
    // ======================================

    const gradient =
        ctx.createLinearGradient(
            0,
            top,
            0,
            bottom
        );


    gradient.addColorStop(
        0,
        "rgba(139,92,246,.35)"
    );


    gradient.addColorStop(
        1,
        "rgba(139,92,246,0)"
    );


    ctx.beginPath();


    ctx.moveTo(
        points[0].x,
        bottom
    );


    points.forEach(
        (
            p,
            i
        ) => {

            if(i === 0){

                ctx.lineTo(
                    p.x,
                    p.y
                );

            }
            else{

                const prev =
                    points[i - 1];


                const cx =
                    (
                        prev.x +
                        p.x
                    ) / 2;


                ctx.quadraticCurveTo(
                    prev.x,
                    prev.y,
                    cx,
                    (
                        prev.y +
                        p.y
                    ) / 2
                );

            }

        }
    );


    ctx.lineTo(
        points.at(-1).x,
        bottom
    );


    ctx.closePath();


    ctx.fillStyle =
        gradient;


    ctx.fill();


    // ======================================
    // LINE
    // ======================================

    ctx.beginPath();


    ctx.strokeStyle =
        "#8b5cf6";


    ctx.lineWidth =
        3;


    ctx.moveTo(
        points[0].x,
        points[0].y
    );


    for(
        let i = 1;
        i < points.length;
        i++
    ){

        const prev =
            points[i - 1];


        const current =
            points[i];


        const cx =
            (
                prev.x +
                current.x
            ) / 2;


        ctx.quadraticCurveTo(
            prev.x,
            prev.y,
            cx,
            (
                prev.y +
                current.y
            ) / 2
        );

    }


    ctx.lineTo(
        points.at(-1).x,
        points.at(-1).y
    );


    ctx.stroke();


    // ======================================
    // DOTS + DATE LABELS
    // ======================================

    points.forEach(
        p => {

            ctx.beginPath();


            ctx.fillStyle =
                "#ffffff";


            ctx.arc(
                p.x,
                p.y,
                5,
                0,
                Math.PI * 2
            );


            ctx.fill();


            ctx.beginPath();


            ctx.fillStyle =
                "#8b5cf6";


            ctx.arc(
                p.x,
                p.y,
                3,
                0,
                Math.PI * 2
            );


            ctx.fill();


            const date =
                new Date(
                    p.item.date
                );


            const label =
                storageHistoryRange === "1Y"
                    ? formatDateTime(
                        date,
                        {
                            month: "short",
                            year: "2-digit"
                        }
                    )
                    : formatDateTime(
                        date,
                        {
                            day: "2-digit",
                            month: "short"
                        }
                    );


            ctx.fillStyle =
                mutedColor;


            ctx.font =
                "500 11px Inter";


            ctx.textAlign =
                "center";


            ctx.fillText(
                label,
                p.x,
                height - 10
            );

        }
    );


    const customScrollbar =
    document.getElementById(
        "storageHistoryCustomScrollbar"
    );


if(
    customScrollbar
){

    const event =
        new Event(
            "scroll"
        );

    scroll.dispatchEvent(
        event
    );

}


}









function renderAnalyticsActivity(){

    const timeline =
        document.getElementById(
            "analyticsActivity"
        );

    if(!timeline){
        return;
    }


    const activity =
        analyticsData.activity || [];


    if(!activity.length){

    timeline.innerHTML = `
        <div class="activity-empty">
            Waiting for activity...
        </div>
    `;

    return;
}


    const recent =
        activity
            .filter(
                item =>
                    item.action !==
                    "Thumbnail rebuild"
            )
            .slice(0, 5);


    function getActivityIcon(
        action
    ){

        const text =
            String(
                action || ""
            ).toLowerCase();


        if(
            text.includes("upload")
        ){
            return "⬆️";
        }


        if(
            text.includes("delete")
        ){
            return "🗑️";
        }


        if(
            text.includes("album")
        ){
            return "📁";
        }


        if(
            text.includes("scan")
        ){
            return "🔍";
        }


        if(
            text.includes("repair")
        ){
            return "🛠️";
        }


        if(
            text.includes("thumbnail") ||
            text.includes("thumb")
        ){
            return "🖼️";
        }


        if(
            text.includes("move")
        ){
            return "↗️";
        }


        return "•";
    }


    timeline.innerHTML =
        recent.map(
            item => {

                const icon =
                    getActivityIcon(
                        item.action
                    );


                const date =
                    item.time
                        ? formatDateTime(
                            item.time
                        )
                        : "";


                return `
                    <div class="timeline-item">

                        <div class="activity-icon">
                            ${icon}
                        </div>

                        <div class="activity-content">

                            <strong>
                                ${item.action || ""}
                            </strong>

                            ${
                                item.meta
                                    ? `
                                        <div class="activity-meta">
                                            ${item.meta}
                                        </div>
                                      `
                                    : ""
                            }

                        </div>

                        <div class="activity-time">
                            ${date}
                        </div>

                        <div class="activity-arrow">
                            ›
                        </div>

                    </div>
                `;

            }
        ).join("");

}








// ======================================
// RENDER ANALYTICS
// ======================================

function renderAnalytics(){

    // =========================
    // TOP STATS
    // =========================

    setText(
        dom.analyticsAlbums,
        analyticsData.albums
    );

    setText(
        dom.analyticsImages,
        analyticsData.images
    );

    setText(
        dom.analyticsStorage,
        analyticsData.storage
    );

    

    setText(
        dom.uploadsToday,
        analyticsData.uploadsToday
    );



    



// =========================
// GALLERY HEALTH
// Same score as Scanner
// =========================

const health =
    analyticsData.health;

const healthScore =
    document.getElementById(
        "healthScoreMetric"
    );

const healthStatus =
    document.getElementById(
        "healthStatusMetric"
    );

if (
    health &&
    healthScore &&
    healthStatus
) {

    const scannerData = {
        albums:
            health.albums || 0,

        images:
            health.images || 0,

        missingThumbs:
            health.missingThumbs || 0,

        brokenImages:
            health.brokenImages || 0,

        duplicateImages:
            health.duplicateImages || 0,

        emptyAlbums:
            health.emptyAlbums || 0
    };

    const score =
        calculateHealthScore(
            scannerData
        );

    healthScore.textContent =
        `${score}%`;

    let label =
        "Excellent";

    if (score < 90) {
        label = "Good";
    }

    if (score < 70) {
        label = "Warning";
    }

    if (score < 50) {
        label = "Critical";
    }

    healthStatus.textContent =
        label;
}





    // =========================
    // SECONDARY STATS
    // =========================

    setText(
        dom.largestAlbumAnalytics,
        analyticsData.largestAlbum
    );

    setText(
        dom.averageImageSize,
        analyticsData.averageImageSize
    );

    setText(
        dom.spaceSaved,
        analyticsData.spaceSaved
    );

    // NEWEST ALBUM
    setText(
        dom.newestAlbum,
        analyticsData.newestAlbum
    );


    

    // =========================
    // INSIGHTS
    // =========================

    setText(
        dom.mostActiveAlbum,
        analyticsData.mostActiveAlbum
    );

    setText(
        dom.largestImage,
        analyticsData.largestImage
    );

    setText(
        dom.mostActiveDay,
        analyticsData.mostActiveDay
    );

    // =========================
    // STORAGE BREAKDOWN
    // =========================

    setText(
        dom.totalStorage,
        analyticsData.storage
    );

    setText(
        dom.imagesStorage,
        analyticsData.imagesStorage
    );

    setText(
        dom.thumbsStorage,
        analyticsData.thumbsStorage
    );



    // =========================
    // METRIC SUBTEXTS
    // =========================

    setText(
        dom.albumsGrowthText,
        analyticsData.albumGrowthText
    );

    setText(
        dom.imagesGrowthText,
        analyticsData.imageGrowthText
    );

    setText(
        dom.storageSubtextMetric,
        analyticsData.storageSubtext ||
        (
            analyticsData.storageGrowth
                ? `${analyticsData.storageGrowth} growth`
                : "Not enough history"
        )
    );


    setText(
        dom.uploadsChangeText,
        analyticsData.uploadsChangeText ||
        "No uploads today"
    );

    setText(
        dom.spaceSavedText,
        analyticsData.spaceSavedText ||
        "Thumbnail compression"
    );


    // =========================
    // CHARTS
    // =========================

    renderStorageBreakdown();
    renderAlbumDistribution();
    renderUploadActivity();
    renderStorageHistory();
    renderAnalyticsActivity();

}






function renderAlbumDistribution() {

    const container =
        document.getElementById(
            "albumDistributionChart"
        );

    const donut =
        document.getElementById(
            "albumDonut"
        );

    const totalEl =
        document.getElementById(
            "albumTotal"
        );

    if (
        !container ||
        !donut ||
        !totalEl
    ) {
        return;
    }

    const albums =
        [...analyticsData.albumDistribution]
            .sort(
                (a, b) =>
                    (b.images || 0) -
                    (a.images || 0)
            )
            .slice(0, 5);

    if (!albums.length) {

        totalEl.textContent = "0";

        donut.innerHTML = "";

        container.innerHTML = `
            <div class="empty-chart">
                No album data
            </div>
        `;

        return;
    }

    const totalImages =
        albums.reduce(
            (sum, album) =>
                sum +
                (album.images || 0),
            0
        );

    totalEl.textContent =
        totalImages;

    const colors = [
        "#8b5cf6",
        "#5ea8ff",
        "#22c55e",
        "#f59e0b",
        "#ef4444"
    ];

    // ======================
    // MULTI-SEGMENT DONUT
    // ======================

    donut.innerHTML = "";

    const radius = 32;

    const circumference =
        2 *
        Math.PI *
        radius;

    let offset = 0;

    albums.forEach(
        (
            album,
            index
        ) => {

            const percent =
                (album.images || 0) /
                totalImages;

            const length =
                circumference *
                percent;

            const color =
                colors[
                    index %
                    colors.length
                ];

            const circle =
                document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "circle"
                );

            circle.setAttribute(
                "cx",
                "50"
            );

            circle.setAttribute(
                "cy",
                "50"
            );

            circle.setAttribute(
                "r",
                radius
            );

            circle.setAttribute(
                "fill",
                "none"
            );

            circle.setAttribute(
                "stroke",
                color
            );

            circle.setAttribute(
                "stroke-width",
                "10"
            );

            circle.setAttribute(
                "stroke-linecap",
                "round"
            );

            circle.setAttribute(
                "stroke-dasharray",
                `${length} ${circumference}`
            );

            circle.setAttribute(
                "stroke-dashoffset",
                -offset
            );

            circle.style.transform =
                "rotate(-90deg)";

            circle.style.transformOrigin =
                "50% 50%";

            donut.appendChild(
                circle
            );

            offset += length;
        }
    );

    // ======================
    // ALBUM LIST
    // ======================

    container.innerHTML =
        albums.map(
            (
                album,
                index
            ) => {

                const count =
                    album.images || 0;

                const percent =
                    totalImages
                        ? (
                              count /
                              totalImages
                          ) * 100
                        : 0;

                const color =
                    colors[
                        index %
                        colors.length
                    ];

                return `

<div class="album-row">

    <div class="album-row-top">

        <span
            class="album-color"
            style="
                background:${color};
            "
        ></span>

        <span class="album-name">
            ${album.name}
        </span>

        <span class="album-count">
            ${count}
            ${
                count === 1
                    ? " image"
                    : " images"
            }
        </span>

        <span class="album-percent">
            ${percent.toFixed(1)}%
        </span>

    </div>

    <div class="album-progress">

        <div
            class="album-progress-fill"
            style="
                width:${percent}%;
                background:${color};
            "
        ></div>

    </div>

</div>

`;

            }
        )
        .join("");
}






// ======================================
// STORAGE RING
// ======================================


function renderStorageBreakdown(){

    const imagesCircle =
        document.getElementById(
            "imagesCircle"
        );

    const thumbsCircle =
        document.getElementById(
            "thumbsCircle"
        );

    if(
        !imagesCircle ||
        !thumbsCircle
    ){
        return;
    }

    

    const totalGB =
        parseSizeToGB(
            analyticsData.storage
        );

    const imagesGB =
        parseSizeToGB(
            analyticsData.imagesStorage
        );

    const thumbsGB =
        parseSizeToGB(
            analyticsData.thumbsStorage
        );

    const maxStorage =
        GALLERY_STORAGE_LIMIT_GB;

    const usedPercent =
        Math.min(
            totalGB /
            maxStorage,
            1
        );

    const thumbPercent =
        totalGB
            ? thumbsGB /
              totalGB
            : 0;

    const radius = 40;

    const circumference =
        2 *
        Math.PI *
        radius;

    const usedLength =
        circumference *
        usedPercent;

    const thumbLength =
        usedLength *
        thumbPercent;

    imagesCircle.style.strokeDasharray =
        `${usedLength}
         ${circumference}`;

    imagesCircle.style.strokeDashoffset =
        "0";

    thumbsCircle.style.strokeDasharray =
        `${thumbLength}
         ${circumference}`;

    thumbsCircle.style.strokeDashoffset =
        -usedLength;

    setText(
        document.getElementById(
            "totalStorage"
        ),
        analyticsData.storage
    );

    setText(
        document.getElementById(
            "imagesStorage"
        ),
        analyticsData.imagesStorage
    );

    setText(
        document.getElementById(
            "thumbsStorage"
        ),
        analyticsData.thumbsStorage
    );

    const percentText =
        (
            usedPercent *
            100
        ).toFixed(1);

    setText(
        document.getElementById(
            "storagePercent"
        ),
        `${percentText}% used`
    );
}







/* Calculate additional metrics based on images and albums */



function calculateMetricExtras(images){

    const now = new Date();

    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(
        now.getDate() - now.getDay()
    );

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    analyticsData.imageGrowth = images.filter(image =>
        image.createdAt &&
        new Date(image.createdAt) >= startOfWeek
    ).length;


    analyticsData.imageGrowthText =
    analyticsData.imageGrowth === 0
        ? "No new images"
        : `${analyticsData.imageGrowth} new ${
              analyticsData.imageGrowth === 1
                  ? "image"
                  : "images"
          } this week`;



    analyticsData.albumGrowth =
        analyticsData.albumDistribution.filter(album =>
            album.updatedAt &&
            new Date(album.updatedAt) >= startOfWeek
        ).length;


    analyticsData.albumGrowthText =
    analyticsData.albumGrowth === 0
        ? "No album updates"
        : `${analyticsData.albumGrowth} album ${
              analyticsData.albumGrowth === 1
                  ? "update"
                  : "updates"
          } this week`;



    const uploadsYesterday = images.filter(image => {

        if(!image.createdAt){
            return false;
        }

        const date = new Date(image.createdAt);

        return (
            date.getFullYear() ===
            yesterday.getFullYear()
            &&
            date.getMonth() ===
            yesterday.getMonth()
            &&
            date.getDate() ===
            yesterday.getDate()
        );

    }).length;

    analyticsData.uploadsChange =
        analyticsData.uploadsToday -
        uploadsYesterday;


    analyticsData.uploadsChangeText =
    analyticsData.uploadsToday === 0
        ? "No uploads today"
        : `${analyticsData.uploadsToday} uploads today`;



    analyticsData.storageSubtext =
        `of ${GALLERY_STORAGE_LIMIT_GB} GB`;

    analyticsData.spaceSavedText =
        "Thumbnail storage vs originals";
}





function initStorageHistorySettings(){

    const button =
        document.getElementById(
            "storageHistorySettingsBtn"
        );


    const menu =
        document.getElementById(
            "storageHistorySettingsMenu"
        );


    if(
        !button ||
        !menu
    ){
        return;
    }


    if(
        button.dataset.initialized === "true"
    ){
        return;
    }


    button.dataset.initialized =
        "true";


    function positionMenu(){

        const rect =
            button.getBoundingClientRect();


        const gap =
            8;


        const menuWidth =
            190;


        const menuHeight =
            menu.offsetHeight;


        let left =
            rect.right -
            menuWidth;


        let top =
            rect.bottom +
            gap;


        // Keep inside viewport horizontally

        left =
            Math.max(
                8,
                Math.min(
                    left,
                    window.innerWidth -
                    menuWidth -
                    8
                )
            );


        // If it would go below the screen,
        // open upward instead.

        if(
            top +
            menuHeight >
            window.innerHeight -
            8
        ){

            top =
                rect.top -
                menuHeight -
                gap;

        }


        top =
            Math.max(
                8,
                top
            );


        menu.style.left =
            `${left}px`;


        menu.style.top =
            `${top}px`;

    }


    function openMenu(){

        menu.classList.remove(
            "hidden"
        );


        updateStorageHistorySettingsUI();


        /*
         * Append to body so the menu is no longer
         * trapped inside the chart card's
         * overflow:hidden.
         */

        if(
            menu.parentElement !==
            document.body
        ){

            document.body.appendChild(
                menu
            );

        }


        positionMenu();

    }


    function closeMenu(){

        menu.classList.add(
            "hidden"
        );

    }


    button.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            if(
                menu.classList.contains(
                    "hidden"
                )
            ){

                openMenu();

            }
            else{

                closeMenu();

            }

        }
    );


    menu.addEventListener(
        "click",
        event => {

            const rangeButton =
                event.target.closest(
                    "[data-storage-range]"
                );


            if(rangeButton){

                setStorageHistoryRange(
                    rangeButton.dataset
                        .storageRange
                );


                updateStorageHistorySettingsUI();


                closeMenu();


                return;

            }


            const unitButton =
                event.target.closest(
                    "[data-storage-unit]"
                );


            if(unitButton){

                setStorageHistoryUnit(
                    unitButton.dataset
                        .storageUnit
                );


                updateStorageHistorySettingsUI();


                closeMenu();


                return;

            }

        }
    );


    document.addEventListener(
        "click",
        event => {

            if(
                event.target === button ||
                button.contains(
                    event.target
                ) ||
                menu.contains(
                    event.target
                )
            ){

                return;

            }


            closeMenu();

        }
    );


    window.addEventListener(
        "resize",
        () => {

            if(
                !menu.classList.contains(
                    "hidden"
                )
            ){

                positionMenu();

            }

        }
    );


    window.addEventListener(
        "scroll",
        () => {

            if(
                !menu.classList.contains(
                    "hidden"
                )
            ){

                positionMenu();

            }

        },
        true
    );

}


function updateStorageHistorySettingsUI(){

    document
        .querySelectorAll(
            "[data-storage-range]"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset
                        .storageRange ===
                    storageHistoryRange
                );

            }
        );


    document
        .querySelectorAll(
            "[data-storage-unit]"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset
                        .storageUnit ===
                    storageHistoryUnit
                );

            }
        );

}