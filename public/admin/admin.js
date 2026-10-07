

// ======================================
// BOOTSTRAP
// ======================================

document.addEventListener(
    "DOMContentLoaded",
    init
);








// ======================================
// ACTIVITY RAIL
// ======================================

let activityData = [];

let activityTimer = null;

let backgroundTasks = [];


// ======================================
// THEME REGISTRY
// ======================================

const THEMES = [
    {
        id: "system",
        icon: "bi bi-display",
        label: "System"
    },
    {
        id: "dark",
        icon: "bi bi-moon-fill",
        label: "Dark"
    },
    {
        id: "light",
        icon: "bi bi-sun-fill",
        label: "Light"
    }
];


async function loadActivity(){

    try{

        const data =
            await api(
                API.SESSION_ACTIVITY
            );

        activityData =
            data.activity || [];

        renderActivity();

    }
    catch(err){

        console.error(err);

    }

}




function renderActivity(){


    backgroundTasks =
        activityData.filter(item => {

            const action =
                (item.action || "")
                    .toLowerCase();

            return (
                action.includes("thumbnail rebuild") &&
                !action.includes("completed")
            );
        });

    renderBackgroundTasks();



    if(
        !dom.activityFeed
    ){
        return;
    }

    if(
        !activityData.length
    ){

        dom.activityFeed.innerHTML = `
           <div class="empty-state">

               <div>
                📋
               </div>

               <p>
                  No recent activity
               </p>

               <small>
                   Scanner and gallery actions will appear here.
               </small>

           </div>
      `;

        return;
    }

    dom.activityFeed.innerHTML =
        activityData
            .map(
                item => `
                   <div class="timeline-item ${getActivityType(item.action)}">

                        <strong>
                            ${item.action}
                        </strong>

                        <small>
                            ${item.meta || ""}
                            ${item.meta ? " • " : ""}
                            ${new Date(
                              item.time
                            ).toLocaleString()}
                        </small>

                    </div>
                `
            )
            .join("");

}






function renderBackgroundTasks(){

    const card =
        document.getElementById(
            "backgroundTasks"
        );

    const list =
        document.getElementById(
            "backgroundTasksList"
        );

    if(
        !card ||
        !list
    ){
        return;
    }

    if(
        !backgroundTasks.length
    ){
        card.classList.add(
            "hidden"
        );

        return;
    }

    card.classList.remove(
        "hidden"
    );

    list.innerHTML =
        backgroundTasks
            .map(
                task => `
                    <div class="timeline-item info">
                        <strong>
                            🔄 ${task.action}
                        </strong>

                        <small>
                            ${task.meta || ""}
                        </small>
                    </div>
                `
            )
            .join("");
}





/* ======================================
   ACTIVITY RAIL RESIZER
====================================== */

function initActivityRailResizer(){

    const rail =
        document.querySelector(".activity-rail");

    const backgroundCard =
        document.getElementById(
            "backgroundTasks"
        );

    const splitter =
        document.getElementById(
            "activityRailSplitter"
        );

    const logsCard =
        document.getElementById(
            "activityLogs"
        );

    if(
        !rail ||
        !backgroundCard ||
        !splitter ||
        !logsCard
    ){
        return;
    }


    let dragging = false;


    function getLimits(){

        const railStyle =
            getComputedStyle(rail);

        const paddingTop =
            parseFloat(
                railStyle.paddingTop
            ) || 0;

        const paddingBottom =
            parseFloat(
                railStyle.paddingBottom
            ) || 0;

        const gap =
            parseFloat(
                railStyle.rowGap ||
                railStyle.gap
            ) || 0;

        const splitterHeight =
            splitter.offsetHeight;

        const minBackground =
            120;

        const minLogs =
            120;

        const available =
            rail.clientHeight -
            paddingTop -
            paddingBottom -
            (gap * 2) -
            splitterHeight;

        return {
            min:
                minBackground,

            max:
                Math.max(
                    minBackground,
                    available - minLogs
                )
        };

    }


    function setBackgroundHeight(
        height
    ){

        const limits =
            getLimits();

        const clamped =
            Math.max(
                limits.min,
                Math.min(
                    limits.max,
                    height
                )
            );

        backgroundCard.style.flexBasis =
            `${clamped}px`;

    }


    function startResize(e){

        if(
            e.button !== undefined &&
            e.button !== 0
        ){
            return;
        }


        /*
         * Don't start resizing while
         * Background Tasks is hidden.
         */

        if(
            backgroundCard.classList.contains(
                "hidden"
            )
        ){
            return;
        }


        dragging = true;

        rail.classList.add(
            "is-resizing"
        );

        splitter.classList.add(
            "dragging"
        );


        /*
         * Capture the pointer so dragging
         * continues even if the pointer
         * leaves the splitter.
         */

        splitter.setPointerCapture?.(
            e.pointerId
        );


        e.preventDefault();

    }


    function resize(e){

        if(!dragging){
            return;
        }


        const railRect =
            rail.getBoundingClientRect();


        /*
         * Pointer distance from the top
         * of the rail's content area.
         */

        const railStyle =
            getComputedStyle(rail);

        const paddingTop =
            parseFloat(
                railStyle.paddingTop
            ) || 0;


        const height =
            e.clientY -
            railRect.top -
            paddingTop;


        setBackgroundHeight(
            height
        );


        e.preventDefault();

    }


    function stopResize(e){

        if(!dragging){
            return;
        }


        dragging = false;


        rail.classList.remove(
            "is-resizing"
        );

        splitter.classList.remove(
            "dragging"
        );


        if(
            e?.pointerId !== undefined
        ){
            try{
                splitter.releasePointerCapture(
                    e.pointerId
                );
            }
            catch{}
        }

    }


    splitter.addEventListener(
        "pointerdown",
        startResize
    );


    splitter.addEventListener(
        "pointermove",
        resize
    );


    splitter.addEventListener(
        "pointerup",
        stopResize
    );


    splitter.addEventListener(
        "pointercancel",
        stopResize
    );


    /*
     * Recalculate limits when the viewport
     * changes size.
     */

    window.addEventListener(
        "resize",
        () => {

            if(!dragging){
                return;
            }

            const currentHeight =
                backgroundCard.getBoundingClientRect()
                    .height;

            setBackgroundHeight(
                currentHeight
            );

        }
    );

}





function getActivityType(action){

    action =
        (action || "")
            .toLowerCase();

    if(
        action.includes("delete")
    ){
        return "danger";
    }

    if(
        action.includes("clean")
    ){
        return "warning";
    }

    if(
        action.includes("repair")
    ){
        return "success";
    }

    if(
        action.includes("upload")
    ){
        return "info";
    }

    return "info";
}





// ======================================
// EVENT HANDLERS
// ======================================


function handleAlbumGridClick(e){

    if(
        e.target.closest("[data-menu]")
    ){
        return;
    }


    const card =
        e.target.closest(".album-card");


    if(!card){
        return;
    }


    const album =
        card.dataset.album;


    const albumData =
        state.albums.find(
            a => a.name === album
        );


    if(!albumData){
        return;
    }


    showAlbumInfo(albumData);

}





function handleImageGridClick(e){


    // Ignore global menu triggers
    if(
        e.target.closest(
            "[data-menu]"
        )
    ){
        return;
    }


    const checkbox =
        e.target.closest(
            'input[data-action="select-image"]'
        );
        
        
        

    if(checkbox){

        toggleImageSelection(
            checkbox.dataset.album,
            checkbox.dataset.image,
            checkbox.checked
        );

        return;
    }

    const actionEl =
        e.target.closest(
            "[data-action]"
        );

    if(!actionEl){
        return;
    }

    const action =
        actionEl.dataset.action;

    const image =
        actionEl.dataset.image;

    const url =
        actionEl.dataset.url;

    const album =
        actionEl.dataset.album;

    switch(action){

        case "view-image":


            if(imageSelectionMode){

                toggleImageSelection(
                    album,
                    image,
                    !state.selectedImages.some(
                        item =>
                            item.album === album &&
                            item.filename === image
                    )
                );

                return;

            }


            viewImage(url);

            break;

        

    }

}





let imageLongPressTimer = null;


document.addEventListener(
    "touchstart",
    e => {


        const image =
            e.target.closest(
                ".image-item"
            );


        if(!image)
            return;


        imageLongPressTimer =
            setTimeout(()=>{


                toggleImageSelectionMode(
                    true
                );


            },600);


    },
    {
        passive:true
    }
);



document.addEventListener(
    "touchend",
    ()=>{

        clearTimeout(
            imageLongPressTimer
        );

    }
);







function closeImageModal(){

    dom.imageModal
        ?.classList.remove(
            "open"
        );


    if(
        dom.modalImage
    ){
        dom.modalImage.src =
            "";
    }


    unlockPageScroll();

}



function handleModalClick(e){

    if(
        e.target !==
        dom.imageModal
    ){
        return;
    }

    closeImageModal();

}





function handlePageNavigation(){

    dom.pageButtons
        .forEach(btn => {

            on(
                btn,
                "click",
                () => {

                    const page =
    btn.dataset.page;


                      closeCustomSelects();

                       showPage(page);


                   closeSidebar();

                }
            );

        });

}








function toggleProfileMenu(){

    dom.profileMenu
        ?.classList.toggle("hidden");

}














function renderThemeMenu(){

    if(!dom.themeMenu){
        return;
    }

    const current =
        workspaceSettings
            .appearance
            .theme;

    dom.themeMenu.innerHTML =
        THEMES
            .map(
                theme => `
                    <button
                        type="button"
                        class="theme-icon-btn ${
                            current === theme.id
                                ? "active"
                                : ""
                        }"
                        data-theme="${theme.id}"
                        data-tooltip="${theme.label} theme"
                        aria-label="${theme.label} theme"
                        aria-pressed="${
                            current === theme.id
                        }"
                    >
                        <i
                            class="${theme.icon}"
                            aria-hidden="true"
                        ></i>
                    </button>
                `
            )
            .join("");
}




async function loadSidebarStorage() {
    try {

        const data =
            await api(
                API.STORAGE
            );

        const el =
            document.getElementById(
                "sidebarStorage"
            );

        if (!el) {
            return;
        }

        const used =
            data.storage || "0 MB";

        const total =
            workspaceSettings
                ?.storage
                ?.maxSize ||
            "10 GB";

        el.textContent =
            `${used} / ${total}`;

    }
    catch (err) {

        console.error(
            "Sidebar storage:",
            err
        );

        const el =
            document.getElementById(
                "sidebarStorage"
            );

        if (el) {
            el.textContent =
                "--";
        }
    }
}



// ======================================
// EVENT BINDINGS
// ======================================


function bindEvents(){

    on(
        dom.mobileMenuBtn,
        "click",
        toggleSidebar
    );

    on(
        dom.notificationBtn,
        "click",
        openRail
    );

    on(
        dom.closeRailBtn,
        "click",
        closeRail
    );


    initActivityRailResizer();



    on(
        dom.profileBtn,
        "click",
        toggleProfileMenu
    );

    on(
        dom.profileLogoutBtn,
        "click",
        handleAuthButton
    );

    on(
        dom.profileWorkspaceBtn,
        "click",
        () => {

            showPage("settings");
            renderWorkspace();
            closeSidebar();

            dom.profileMenu
                ?.classList.add("hidden");
        }
    );








on(
    dom.themeMenu,
    "click",
    e => {

        const btn =
            e.target.closest(
                ".theme-icon-btn"
            );

        if(!btn){
            return;
        }

        const theme =
            THEMES.find(
                item =>
                    item.id ===
                    btn.dataset.theme
            );

        if(!theme){
            return;
        }

        workspaceSettings
            .appearance
            .theme =
            theme.id;

        persist();

        renderThemeMenu();

        toast(
            `${theme.label} theme selected`
        );
    }
);




on(
    dom.profileBackupBtn,
    "click",
    () => {

        showPage("settings");

        dom.profileMenu
            ?.classList.add("hidden");

        requestAnimationFrame(() => {

            document
                .getElementById(
                    "createBackupBtn"
                )
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
        });
    }
);





    






    dom.topbarAlbumBtn
        ?.addEventListener(
            "click",
             openCreateAlbum
        );

    dom.topbarUploadBtn
        ?.addEventListener(
            "click",
            openUploadPage
        );

    dom.topbarScanBtn
        ?.addEventListener(
            "click",
            openScannerPage
        );
















    on(
        dom.refreshAlbums,
        "click",
        async () => {

            await loadAlbums();
            searchAlbums();

        }
    );

    on(
        dom.albumSearch,
        "input",
        searchAlbums
    );


     
    on(
        dom.albumSort,
        "change",
        sortAlbums
    );
     



    on(
        dom.newAlbumBtn,
        "click",
        createAlbum
    );

    on(
        dom.imageAlbumFilter,
        "change",
        filterImages
    );

    on(
        dom.imageSearch,
        "input",
        filterImages
    );




    on(
        dom.backToAlbumsBtn,
        "click",
        () => {

            state.selectedAlbum = "";

            imagesOrigin = null;

            dom.imageAlbumFilter.value = "";

            filterImages();

            showPage("albums");

        }
    );





    on(
        dom.selectAllImages,
        "change",
        e =>
            toggleSelectAll(
                e.target.checked
            )
    );

    on(
        dom.deleteSelectedBtn,
        "click",
        deleteSelectedImages
    );

    on(
        dom.moveSelectedBtn,
        "click",
        moveSelectedImages
    );

    on(
        dom.downloadZipBtn,
        "click",
        downloadZip
    );

    on(
        dom.rebuildThumbsBtn,
        "click",
        rebuildThumbnails
    );

    on(
        dom.logoutBtn,
        "click",
        handleAuthButton
    );

    on(
        dom.loginForm,
        "submit",
        e => {

            e.preventDefault();
            login();

        }
    );

    on(
        dom.albumGrid,
        "click",
        handleAlbumGridClick
    );

    on(
        dom.imageGrid,
        "click",
        handleImageGridClick
    );


    on(
        dom.closeModal,
        "click",
        closeImageModal
    );

    on(
        dom.imageModal,
        "click",
        handleModalClick
    );

    

    handlePageNavigation();

}







document.addEventListener(
    "click",
    e => {

        if (
            !dom.profileMenu
                ?.contains(
                    e.target
                ) &&
            !dom.profileBtn
                ?.contains(
                    e.target
                )
        ) {

            dom.profileMenu
                ?.classList.add(
                    "hidden"
                );

            
        }
        
        
        document
            .querySelectorAll(
                ".custom-select-menu"
             )
             .forEach(menu =>
                menu.classList.add(
                    "hidden"
                )
             );
        
        
    }
);




// ======================================
// INITIALIZATION
// ======================================

async function init(){

    cacheDom();
    cachePages();


    
    bindSearchEvents();

    workspaceSettings =
        loadWorkspaceSettings();

    applyAppearance();

    
    renderThemeMenu();

    initUpload();
    initScanner();
    initAnalytics();

    bindEvents();

    await checkLogin();




    if (state.loggedIn) {

      await loadActivity();

      if (!activityTimer) {
        activityTimer =
          setInterval(
            loadActivity,
            3000
          );
      }

    }
    

    
}
