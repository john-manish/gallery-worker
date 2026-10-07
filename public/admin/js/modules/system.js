// ======================================
// HELPERS
// ======================================

async function initializeWorkspace() {

    document.body.classList.add(
        "compact-image-cards"
    );

    // Initialize workspace module
    // so its controls work even when
    // Workspace is not the startup page.
    renderWorkspace();


    // --------------------------------------------------
    // Startup page
    //
    // Resume last page:
    //   Uses galleryCurrentPage from localStorage.
    //
    // Always use homepage:
    //   Uses the configured homepage.
    //
    // If the saved page no longer exists:
    //   Falls back to the configured homepage.
    // --------------------------------------------------

    const configuredHomepage =
        workspaceSettings
            ?.website
            ?.homepage ||
        "dashboard";


    const startupMode =
        workspaceSettings
            ?.website
            ?.startup ||
        "resume";


    const savedPage =
        localStorage.getItem(
            "galleryCurrentPage"
        );


    const startupPage =
        startupMode === "homepage"
            ? configuredHomepage
            : (
                savedPage &&
                window.pages?.[savedPage]
                    ? savedPage
                    : configuredHomepage
            );


    if (
        startupPage === "articleEditor"
    ) {

        const currentArticle =
            localStorage.getItem(
                "galleryCurrentArticle"
            );

        if (currentArticle) {

            await editArticle(
                currentArticle
            );

        }
        else {

            showPage(
                "articles",
                {
                    pushHistory: false
                }
            );

        }

    }
    else {

        showPage(
            startupPage,
            {
                pushHistory: false
            }
        );

    }


    // --------------------------------------------------
    // Load workspace data
    // --------------------------------------------------

    await Promise.all([
        loadDashboard(),
        loadAlbums(),
        loadAllImages(),
        loadActivity(),
        loadSidebarStorage()
    ]);


    buildSearchIndex();

    populateAlbumFilter();

    bindSessionActivity();


    // --------------------------------------------------
    // Global workspace initialization
    // --------------------------------------------------

    ensureInfoModal();

    backgroundSync();
}


// ======================================
// BACKGROUND SYNC
// ======================================

async function backgroundSync() {

    try {

        const result =
            await api(
                "/admin/sync",
                {
                    method: "POST"
                }
            );


        if (
            !result.success ||
            !result.changed
        ) {
            return;
        }


        await Promise.all([
            loadDashboard(),
            loadAlbums(),
            loadAllImages()
        ]);


        buildSearchIndex();

        populateAlbumFilter();


        if (
            state.currentPage ===
            "albums"
        ) {

            renderAlbums();

        }


        if (
            state.currentPage ===
            "images"
        ) {

            filterImages();

        }


        showToast(
            "Gallery synchronized"
        );

    }
    catch (err) {

        console.error(
            "Background sync failed",
            err
        );

    }
}


// ======================================
// PAGE SCROLL LOCK
// ======================================

let scrollLocks = 0;

function lockPageScroll(){

    const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;


    document.documentElement.style.setProperty(
        "--scrollbar-width",
        `${scrollbarWidth}px`
    );


    document.body.classList.add("scroll-locked");

}


function unlockPageScroll(){

    document.body.classList.remove(
        "scroll-locked"
    );

    document.documentElement.style.removeProperty(
        "--scrollbar-width"
    );

}


// ======================================
// AUTH MODULE
// ======================================

const passwordInput =
document.getElementById("password");

const passwordToggle =
document.getElementById("passwordToggle");


if(passwordToggle){

    passwordToggle.addEventListener("click",()=>{

        const hidden =
        passwordInput.type === "password";


        passwordInput.type =
        hidden ? "text" : "password";


        passwordToggle.innerHTML =
        hidden
        ? '<i class="bi bi-eye-slash"></i>'
        : '<i class="bi bi-eye"></i>';


        passwordToggle.setAttribute(
            "aria-label",
            hidden
            ? "Hide password"
            : "Show password"
        );

    });

}




passwordInput?.addEventListener(
"input",
()=>{

    const error =
    document.getElementById("loginError");


    if(error){

        error.textContent="";

    }

});





function loginShake(){

    const card =
    document.querySelector(".login-card");

    if(!card) return;
    
    card.classList.remove("shake");


    void card.offsetWidth;


    card.classList.add("shake");


}




async function login() {

    const btn =
        document.querySelector(".login-submit");


    if(btn){

        btn.disabled = true;

        btn.innerHTML =
            '<i class="bi bi-arrow-repeat"></i> Unlocking...';

    }


    try {

        const password =
            dom.password.value;


        await api(
            API.LOGIN,
            {
                method: "POST",
                body: JSON.stringify({
                    password
                })
            }
        );


        state.authenticated =
            true;


        $("profileName").textContent =
            "Manish Kumar";


        $("profileStatus").textContent =
            "🟢 Workspace Owner";


        $("profileBtn").textContent =
            "M";


        $("profileAvatar").textContent =
            "M";


        dom.logoutBtn.textContent =
            "🚪 Sign Out";


        dom.profileLogoutBtn.innerHTML =
            '<i class="bi bi-box-arrow-right"></i> Sign Out';


        dom.loginOverlay
            ?.classList.add(
                "hidden"
            );


        unlockPageScroll();


        await initializeWorkspace();


        if(btn){

            btn.disabled = false;

            btn.innerHTML =
                "Unlock Workspace";

        }


        showToast(
            "Signed in"
        );

    }
    catch (err) {

        loginShake();


        if(navigator.vibrate){

            navigator.vibrate(150);

        }


        const error =
        document.getElementById("loginError");


        if(error){

            error.textContent =
            err.message;

        }


        if(btn){

            btn.disabled = false;

            btn.innerHTML =
                "Unlock Workspace";

        }



        showToast(
            err.message
        );

    }
}


// ======================================
// LOGOUT
// ======================================

async function logout() {

    try {

        await fetch(
            API.LOGOUT,
            {
                method: "POST",
                credentials: "include"
            }
        );


        state.authenticated =
            false;


        $("profileName").textContent =
            "Guest";


        $("profileStatus").textContent =
            "Not Signed In";


        $("profileBtn").textContent =
            "👤";


        $("profileAvatar").textContent =
            "👤";


        dom.logoutBtn.textContent =
            "🔑 Sign In";


        dom.profileLogoutBtn.textContent =
            "🔑 Sign In";


        state.selectedImages = [];

        state.images = [];

        state.allImages = [];


        dom.imageGrid.innerHTML =
            "";


        dom.loginOverlay
            ?.classList.add(
                "hidden"
            );


        await initializeWorkspace();


        showToast(
            "Signed out"
        );

    }
    catch (err) {

        handleError(
            err,
            "Unable to sign out"
        );

    }
}


// ======================================
// LOGIN CHECK
// ======================================

async function checkLogin() {

    dom.app?.classList.remove(
        "hidden"
    );


    try {

        await api(
            "/auth/check"
        );


        state.authenticated =
            true;


        $("profileName").textContent =
            "Manish Kumar";


        $("profileStatus").textContent =
            "🟢 Workspace Owner";


        $("profileBtn").textContent =
            "M";


        $("profileAvatar").textContent =
            "M";


        dom.logoutBtn.textContent =
            "🚪 Sign Out";


        dom.profileLogoutBtn.innerHTML =
            '<i class="bi bi-box-arrow-right"></i> Sign Out';

    }
    catch {

        state.authenticated =
            false;


        $("profileName").textContent =
            "Guest";


        $("profileStatus").textContent =
            "Not Signed In";


        $("profileBtn").textContent =
            "👤";


        $("profileAvatar").textContent =
            "👤";


        dom.logoutBtn.textContent =
            "🔑 Sign In";


        dom.profileLogoutBtn.textContent =
            "🔑 Sign In";
    }


    dom.loginOverlay
        ?.classList.add(
            "hidden"
        );


    await initializeWorkspace();
}


// ======================================
// AUTH BUTTON
// ======================================

function handleAuthButton() {

    if (
        state.authenticated
    ) {

        logout();

        return;
    }


    dom.password.value =
        "";


    dom.loginOverlay
        ?.classList.remove(
            "hidden"
        );


    lockPageScroll();
}


// ======================================
// CLOSE LOGIN
// ======================================

$("closeLoginBtn")
    ?.addEventListener(
        "click",
        () => {

            dom.loginOverlay
                ?.classList.add(
                    "hidden"
                );


            unlockPageScroll();

        }
    );


// ======================================
// LOGIN OVERLAY CLICK
// ======================================

dom.loginOverlay
    ?.addEventListener(
        "click",
        e => {

            if (
                e.target ===
                dom.loginOverlay
            ) {

                dom.loginOverlay
                    ?.classList.add(
                        "hidden"
                    );


                unlockPageScroll();

            }

        }
    );