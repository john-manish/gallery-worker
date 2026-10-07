// ======================================
// PAGE SYSTEM
// ======================================

window.pages = {};

window.cachePages = function(){

    Object.assign(
        pages,
        {
            dashboard:
                $("dashboardPage"),

            albums:
                $("albumsPage"),

            upload:
                $("uploadPage"),

            images:
                $("imagesPage"),

            analytics:
                $("analyticsPage"),

            scanner:
                $("scannerPage"),

            explorer:
                $("explorerPage"),

            assistant:
                $("assistantPage"),

            settings:
                $("settingsPage"),

            manageFrontend:
                $("manageFrontendPage"),

            articles:
                $("articlesPage"),

            articleEditor:
                $("articleEditorPage"),
        }
    );

};







/* ===========
   HELPERS
============== */

/* Time Conversion */

window.formatDateTime = function(date, options = {}) {

    if (!date)
        return "-";

    const formatOptions = {
        timeZone: "Asia/Kolkata"
    };

    if (Object.keys(options).length) {

        Object.assign(
            formatOptions,
            options
        );

    } else {

        formatOptions.dateStyle =
            "medium";

        formatOptions.timeStyle =
            "short";

    }

    // Always keep the global timezone
    formatOptions.timeZone =
        "Asia/Kolkata";

    return new Intl.DateTimeFormat(
        "en-IN",
        formatOptions
    ).format(
        new Date(date)
    );

};



/* Size Conversion */

window.formatBytes = function(bytes) {

    const value =
        Number(bytes);

    if (
        !Number.isFinite(value) ||
        value < 0
    ) {
        return "0 B";
    }

    if (value < 1024) {
        return `${value} B`;
    }

    if (value < 1024 ** 2) {
        return `${(value / 1024).toFixed(1)} KB`;
    }

    if (value < 1024 ** 3) {
        return `${(value / 1024 ** 2).toFixed(1)} MB`;
    }

    if (value < 1024 ** 4) {
        return `${(value / 1024 ** 3).toFixed(2)} GB`;
    }

    return `${(value / 1024 ** 4).toFixed(2)} TB`;

};







window.parseSizeToGB = function(value){

    if(!value)
        return 0;

    const size =
        parseFloat(value) || 0;

    const unit =
        String(value).toUpperCase();

    if(unit.includes("TB"))
        return size * 1024;

    if(unit.includes("GB"))
        return size;

    if(unit.includes("MB"))
        return size / 1024;

    if(unit.includes("KB"))
        return size / 1024 / 1024;

    return size;

};





/* ==========================================
   GLOBAL DYNAMIC TOOLTIP
   ========================================== */

(function(){

    let tooltip = null;
    let activeTarget = null;

    const GAP = 8;
    const MARGIN = 8;


    /* --------------------------------------
       Create tooltip
       -------------------------------------- */

    function createTooltip(){

        if (tooltip)
            return tooltip;

        tooltip =
            document.createElement("div");

        tooltip.className =
            "global-tooltip";

        document.body.appendChild(
            tooltip
        );

        return tooltip;
    }


    /* --------------------------------------
       Hide
       -------------------------------------- */

    function hideTooltip(){

        if (!tooltip)
            return;

        tooltip.classList.remove(
            "show",
            "tooltip-top",
            "tooltip-bottom",
            "tooltip-left",
            "tooltip-right"
        );

        activeTarget = null;
    }


    /* --------------------------------------
       Position
       -------------------------------------- */

    function positionTooltip(target){

        if (!target)
            return;

        const text =
            target.dataset.tooltip;

        if (!text)
            return;

        const tip =
            createTooltip();

        tip.textContent = text;


        /* Reset positioning */

        tip.classList.remove(
            "tooltip-top",
            "tooltip-bottom",
            "tooltip-left",
            "tooltip-right"
        );


        /*
         * Temporarily make visible so
         * we can measure its real size.
         */

        tip.style.left = "0px";
        tip.style.top = "0px";

        tip.classList.add("show");


        const rect =
            target.getBoundingClientRect();

        const tipRect =
            tip.getBoundingClientRect();

        const viewportWidth =
            window.innerWidth;

        const viewportHeight =
            window.innerHeight;


        const spaces = {

            top:
                rect.top - MARGIN,

            bottom:
                viewportHeight -
                rect.bottom -
                MARGIN,

            left:
                rect.left - MARGIN,

            right:
                viewportWidth -
                rect.right -
                MARGIN

        };


        let direction = "top";


        /*
         * Priority:
         *
         * 1. Above
         * 2. Below
         * 3. Right
         * 4. Left
         * 5. Largest available space
         */


        if (
            spaces.top >=
            tipRect.height + GAP
        ){

            direction = "top";

        }

        else if (
            spaces.bottom >=
            tipRect.height + GAP
        ){

            direction = "bottom";

        }

        else if (
            spaces.right >=
            tipRect.width + GAP
        ){

            direction = "right";

        }

        else if (
            spaces.left >=
            tipRect.width + GAP
        ){

            direction = "left";

        }

        else {

            direction =
                Object.keys(spaces)
                    .sort(
                        (a,b) =>
                            spaces[b] -
                            spaces[a]
                    )[0];

        }


        tip.classList.add(
            `tooltip-${direction}`
        );


        let left;
        let top;


        /* ----------------------------------
           TOP
           ---------------------------------- */

        if (direction === "top"){

            left =
                rect.left +
                (rect.width -
                 tipRect.width) / 2;

            top =
                rect.top -
                tipRect.height -
                GAP;

        }


        /* ----------------------------------
           BOTTOM
           ---------------------------------- */

        else if (
            direction === "bottom"
        ){

            left =
                rect.left +
                (rect.width -
                 tipRect.width) / 2;

            top =
                rect.bottom +
                GAP;

        }


        /* ----------------------------------
           LEFT
           ---------------------------------- */

        else if (
            direction === "left"
        ){

            left =
                rect.left -
                tipRect.width -
                GAP;

            top =
                rect.top +
                (rect.height -
                 tipRect.height) / 2;

        }


        /* ----------------------------------
           RIGHT
           ---------------------------------- */

        else {

            left =
                rect.right +
                GAP;

            top =
                rect.top +
                (rect.height -
                 tipRect.height) / 2;

        }


        /*
         * Final viewport clamping.
         *
         * This is what makes it work even
         * when the target is near an edge.
         */

        left = Math.max(
            MARGIN,
            Math.min(
                left,
                viewportWidth -
                tipRect.width -
                MARGIN
            )
        );


        top = Math.max(
            MARGIN,
            Math.min(
                top,
                viewportHeight -
                tipRect.height -
                MARGIN
            )
        );


        tip.style.left =
            `${Math.round(left)}px`;

        tip.style.top =
            `${Math.round(top)}px`;

    }


/* ======================================
   DESKTOP TOOLTIP
   ====================================== */

document.addEventListener(
    "mouseover",
    e => {

        const target =
            e.target.closest(
                "[data-tooltip]"
            );

        if (!target)
            return;


        /*
         * Ignore movement inside
         * the same element.
         */

        if (
            activeTarget === target
        )
            return;


        activeTarget =
            target;

        positionTooltip(
            target
        );

    }
);


document.addEventListener(
    "mouseout",
    e => {

        const target =
            e.target.closest(
                "[data-tooltip]"
            );

        if (!target)
            return;


        /*
         * Don't hide when moving
         * between children of
         * the same element.
         */

        if (
            target.contains(
                e.relatedTarget
            )
        )
            return;


        hideTooltip();

    }
);


/* ======================================
   HIDE TOOLTIP ON CLICK
   ====================================== */

document.addEventListener(
    "click",
    e => {

        /*
         * If the click is on a
         * tooltip-enabled element,
         * hide its tooltip.
         *
         * Normal click behavior
         * continues normally.
         */

        const target =
            e.target.closest(
                "[data-tooltip]"
            );

        if (target){

            hideTooltip();

            return;

        }


        /*
         * Clicking anywhere else
         * also dismisses a tooltip.
         */

        if (activeTarget){

            hideTooltip();

        }

    },
    true
);


/* ======================================
   MOBILE / TOUCH
   LONG PRESS TOOLTIP
   ====================================== */

let tooltipPressTimer = null;

let tooltipPressTarget = null;

let tooltipLongPressTriggered =
    false;


/* --------------------------------------
   Long press configuration
   -------------------------------------- */

const TOOLTIP_LONG_PRESS_DELAY =
    500;


/* --------------------------------------
   Start long press
   -------------------------------------- */

document.addEventListener(
    "pointerdown",
    e => {

        /*
         * Only handle touch / pen.
         *
         * Mouse continues to use
         * normal hover behavior.
         */

        if (
            e.pointerType === "mouse"
        )
            return;


        const target =
            e.target.closest(
                "[data-tooltip]"
            );


        /*
         * Touch started somewhere
         * without a tooltip.
         */

        if (!target){

            clearTooltipLongPress();

            return;

        }


        tooltipPressTarget =
            target;

        tooltipLongPressTriggered =
            false;


        clearTimeout(
            tooltipPressTimer
        );


        /*
         * Wait before showing
         * the tooltip.
         */

        tooltipPressTimer =
            setTimeout(
                () => {

                    /*
                     * Make sure the
                     * target is still
                     * the same element.
                     */

                    if (
                        tooltipPressTarget !==
                        target
                    )
                        return;


                    tooltipLongPressTriggered =
                        true;


                    activeTarget =
                        target;


                    positionTooltip(
                        target
                    );

                },
                TOOLTIP_LONG_PRESS_DELAY
            );

    }
);


/* --------------------------------------
   End long press
   -------------------------------------- */

document.addEventListener(
    "pointerup",
    e => {

        if (
            e.pointerType === "mouse"
        )
            return;


        clearTooltipLongPress();

    }
);


/* --------------------------------------
   Cancel long press
   -------------------------------------- */

document.addEventListener(
    "pointercancel",
    e => {

        if (
            e.pointerType === "mouse"
        )
            return;


        clearTooltipLongPress();

    }
);


/* --------------------------------------
   Moving finger cancels
   long press
   -------------------------------------- */

document.addEventListener(
    "pointermove",
    e => {

        if (
            e.pointerType === "mouse"
        )
            return;


        clearTooltipLongPress();

    }
);


/* --------------------------------------
   Clear long press timer
   -------------------------------------- */

function clearTooltipLongPress(){

    if (
        tooltipPressTimer
    ){

        clearTimeout(
            tooltipPressTimer
        );

        tooltipPressTimer =
            null;

    }

    tooltipPressTarget =
        null;

}


    /* ======================================
       Keep tooltip attached while scrolling
       ====================================== */

    window.addEventListener(
        "scroll",
        () => {

            if (activeTarget)
                positionTooltip(
                    activeTarget
                );

        },
        true
    );


    /* ======================================
       Keep tooltip correct on resize
       ====================================== */

    window.addEventListener(
        "resize",
        () => {

            if (activeTarget)
                positionTooltip(
                    activeTarget
                );

        }
    );


})();












function historyStatePage() {

    return (
        window.history.state?.page ||
        null
    );

}




window.showPage = function(name, options = {}) {

    const {
        pushHistory = true
    } = options;


    // Ignore invalid pages
    if (!pages[name]) {
        return;
    }


    state.currentPage = name;


    localStorage.setItem(
        "galleryCurrentPage",
        name
    );


    Object.values(pages).forEach(
        page =>
            page?.classList.remove(
                "active"
            )
    );


    pages[name]?.classList.add(
        "active"
    );


    dom.pageButtons.forEach(btn => {

        btn.classList.toggle(
            "active",
            btn.dataset.page === name
        );

    });


    document.body.classList.toggle(
        "dashboard-page",
        name === "dashboard"
    );


    const btn =
        document.querySelector(
            `[data-page="${name}"]`
        );


    if (btn) {

        $("mobilePageTitle").textContent =
            btn.textContent
                .replace(/^[^\w]+\s*/, "")
                .trim();

    }


    /*
     * Browser history
     *
     * Only create a history entry when
     * the user actually navigates to a page.
     *
     * popstate calls showPage(..., {
     *     history: false
     * })
     * so Back does not create another
     * history entry.
     */
    if (pushHistory) {

        const current =
            historyStatePage();


        if (current !== name) {

            window.history.pushState(
                {
                    page: name
                },
                "",
                window.location.pathname
            );

        }

    }


    switch (name) {

        case "articles":
            loadArticles();
            break;


        case "settings":
            renderWorkspace();
            break;


        case "analytics":
            loadAnalytics();
            break;


        case "scanner":
            loadScannerState();
            break;


        case "explorer":
            renderExplorer();
            break;

    }

};








window.addEventListener(
    "popstate",
    event => {

        const page =
            event.state?.page ||
            "dashboard";


        showPage(
            page,
            {
                pushHistory: false
            }
        );

    }
);




// ======================================
// SIDEBAR MODULE
// ======================================

function openSidebar(){

    closeCustomSelects();

    state.sidebarOpen = true;

    dom.sidebar?.classList.add("open");

    toggle(
        dom.overlay,
        "show",
        true
    );

    requestAnimationFrame(() => {
        lockPageScroll();
    }); 
}


function closeSidebar(){

    closeCustomSelects();

    state.sidebarOpen = false;

    dom.sidebar?.classList.remove(
        "open"
    );

    toggle(
        dom.overlay,
        "show",
        false
    );
    
    unlockPageScroll();
  
}



function toggleSidebar(e){

    e?.stopPropagation();

    state.sidebarOpen
        ? closeSidebar()
        : openSidebar();

}




// ======================================
// ACTIVITY RAIL MODULE
// ======================================

function openRail(e){

    e?.stopPropagation();

    state.railOpen = true;

    dom.rail
        ?.classList.add("open");

    toggle(
        dom.overlay,
        "show",
        true
    );

    lockPageScroll();
    loadActivity();
}

function closeRail(){

    state.railOpen = false;

    dom.rail
        ?.classList.remove(
            "open"
        );

    toggle(
          dom.overlay,
          "show",
          false
         );
         
    unlockPageScroll();

}





document.addEventListener(
    "click",
    e => {

        // Sidebar
        if (
            state.sidebarOpen &&
            !dom.sidebar?.contains(e.target) &&
            !dom.mobileMenuBtn?.contains(e.target)
        ) {
            closeSidebar();
        }

        // Activity rail
        if (
            state.railOpen &&
            !dom.rail?.contains(e.target) &&
            !dom.notificationBtn?.contains(e.target)
        ) {
            closeRail();
        }

    }
);


