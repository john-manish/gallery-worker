const DEFAULT_WORKSPACE = {
    appearance: {
        theme: "system",
        accent: "#6366f1",
        blur: true,
        glass: true,
        transitions: true
    },

    website: {
        title: "Gallery OS",
        description: "Private Gallery Workspace",
        logo: "",
        navbar: "compact",
        homepage: "dashboard",
        startup: "resume"
    },

    gallery: {
        view: "masonry",
        thumbSize: "medium",
        webp: true,
        thumbnails: true
    },

    storage: {
        used: "0 MB",
        cache: "0 MB"
    },

    security: {
        sessionTimeoutEnabled: true,
        sessionTimeout: 30,
        sessionUnit: "min",
        requireLogin: true,
        directUrls: false
    },

    backups: {
        lastBackup: null
    },

    performance: {
        imageCache: 100,
        thumbHealth: 100
    }
};


let sessionTimer = null;

let workspaceSettings =
    loadWorkspaceSettings();

applyAppearance();

let workspaceInitialized =
    false;


/* ============================================================
   WORKSPACE RENDERING
   ============================================================ */

function renderWorkspace() {

    applyAppearance();

    populateWorkspace();
    
    loadFrontendAccounts();
    
    loadStorageStats();
    loadAbout();
    populateSecurity();
    populateBackups();
    populatePerformance();

    if (!workspaceInitialized) {

        bindAppearance();
        bindAppearanceEditor();
        bindWebsite();
        bindGallery();
        bindSecurity();
        bindSecurityEditor();
        bindActions();
        bindFrontendManagement();
        
        bindFrontendPasswordEyes();

        bindWorkspaceCollapse();
        bindWorkspaceEditors();

        bindSessionActivity();

        workspaceInitialized = true;
    }

    updateWorkspaceMetrics();
    startSessionTimeout();
}


/* ============================================================
   SETTINGS LOAD / SAVE
   ============================================================ */

function loadWorkspaceSettings() {

    try {

        const saved = JSON.parse(
            localStorage.getItem(
                "galleryWorkspace"
            )
        );

        return {

            appearance: {
                ...DEFAULT_WORKSPACE.appearance,
                ...(saved?.appearance || {})
            },

            website: {
                ...DEFAULT_WORKSPACE.website,
                ...(saved?.website || {})
            },

            gallery: {
                ...DEFAULT_WORKSPACE.gallery,
                ...(saved?.gallery || {})
            },

            storage: {
                ...DEFAULT_WORKSPACE.storage,
                ...(saved?.storage || {})
            },

            security: {
                ...DEFAULT_WORKSPACE.security,
                ...(saved?.security || {})
            },

            backups: {
                ...DEFAULT_WORKSPACE.backups,
                ...(saved?.backups || {})
            },

            performance: {
                ...DEFAULT_WORKSPACE.performance,
                ...(saved?.performance || {})
            }
        };

    }
    catch {

        return structuredClone(
            DEFAULT_WORKSPACE
        );
    }
}


function saveWorkspaceSettings() {

    localStorage.setItem(
        "galleryWorkspace",
        JSON.stringify(
            workspaceSettings
        )
    );
}


/* ============================================================
   APPEARANCE
   ============================================================ */

function applyTheme(theme) {

    document.body.classList.remove(
        "theme-dark",
        "theme-light",
        "theme-amoled"
    );

    if (theme === "system") {

        theme =
            window.matchMedia(
                "(prefers-color-scheme: dark)"
            ).matches
                ? "dark"
                : "light";
    }

    document.body.classList.add(
        `theme-${theme}`
    );
}


function applyAppearance() {

    applyTheme(
        workspaceSettings
            .appearance
            .theme
    );

    const accent =
        workspaceSettings
            .appearance
            .accent;

    const root =
        document.body;

    root.style.setProperty(
        "--accent",
        accent
    );

    let accent2 =
        "#8b5cf6";

    switch (accent) {

        case "#3b82f6":
            accent2 = "#0ea5e9";
            break;

        case "#10b981":
            accent2 = "#22c55e";
            break;

        case "#f97316":
            accent2 = "#fb923c";
            break;

        default:
            accent2 = "#8b5cf6";
    }

    root.style.setProperty(
        "--accent-2",
        accent2
    );
}


/* ============================================================
   WORKSPACE UI POPULATION
   ============================================================ */

function populateWorkspace() {

    const s =
        workspaceSettings;

    workspaceSetChecked(
        "themeDark",
        s.appearance.theme === "dark"
    );

    workspaceSetChecked(
        "themeLight",
        s.appearance.theme === "light"
    );

    workspaceSetChecked(
        "themeSystem",
        s.appearance.theme === "system"
    );

    workspaceSetChecked(
        "blurEffects",
        s.appearance.blur
    );

    workspaceSetChecked(
        "glassEffects",
        s.appearance.glass
    );

    workspaceSetChecked(
        "pageTransitions",
        s.appearance.transitions
    );

    workspaceSetValue(
        "siteTitle",
        s.website.title
    );

    workspaceSetValue(
        "siteDescription",
        s.website.description
    );

    workspaceSetText(
        "brandTitle",
        s.website.title
    );

    workspaceSetText(
        "brandSubtitle",
        s.website.description
    );

    workspaceSetValue(
        "navbarStyle",
        s.website.navbar
    );

    workspaceSetValue(
        "homepageSelect",
        s.website.homepage
    );

    workspaceSetValue(
        "startupMode",
        s.website.startup
    );

    document.body.classList.toggle(
        "navbar-compact",
        s.website.navbar === "compact"
    );

    document.body.classList.toggle(
        "navbar-expanded",
        s.website.navbar === "expanded"
    );

    workspaceSetValue(
        "galleryView",
        s.gallery.view
    );

    workspaceSetValue(
        "thumbSize",
        s.gallery.thumbSize
    );

    workspaceSetChecked(
        "webpToggle",
        s.gallery.webp
    );

    workspaceSetChecked(
        "thumbsToggle",
        s.gallery.thumbnails
    );

    document
        .querySelectorAll(
            ".accent-dot"
        )
        .forEach(btn => {

            btn.classList.toggle(
                "active",
                btn.dataset.color ===
                s.appearance.accent
            );
        });

    updateWorkspaceSummary();
}


/* ============================================================
   APPEARANCE BINDINGS
   ============================================================ */

function bindAppearance() {

    bindTheme(
        "themeSystem",
        "system"
    );

    bindTheme(
        "themeDark",
        "dark"
    );

    bindTheme(
        "themeLight",
        "light"
    );

    bindCheck(
        "blurEffects",
        value => {

            workspaceSettings
                .appearance
                .blur =
                value;
        }
    );

    bindCheck(
        "glassEffects",
        value => {

            workspaceSettings
                .appearance
                .glass =
                value;
        }
    );

    bindCheck(
        "pageTransitions",
        value => {

            workspaceSettings
                .appearance
                .transitions =
                value;
        }
    );

    document
        .querySelectorAll(
            ".accent-dot"
        )
        .forEach(btn => {

            btn.addEventListener(
                "click",
                () => {

                    workspaceSettings
                        .appearance
                        .accent =
                        btn.dataset.color;

                    persist();
                    populateWorkspace();
                }
            );
        });
}




/* ============================================================
   APPEARANCE EDITOR
   ============================================================ */

function bindAppearanceEditor() {

    const btn =
        document.getElementById(
            "appearanceEditBtn"
        );

    if (!btn) return;

    const controls =
        document.querySelectorAll(`
            input[name="theme"],
            #blurEffects,
            #glassEffects,
            #pageTransitions,
            .accent-dot
        `);

    let editing = false;

    controls.forEach(el => {
        el.disabled = true;
    });

    btn.addEventListener(
        "click",
        () => {

            editing = !editing;

            controls.forEach(el => {
                el.disabled = !editing;
            });

            if (editing) {

                btn.textContent =
                    "Save";

            }
            else {

                persist();

                flashSaved(
                    "appearanceEditBtn"
                );
            }
        }
    );
}


/* ============================================================
   SECURITY EDITOR
   ============================================================ */

function bindSecurityEditor() {

    const btn =
        document.getElementById(
            "securityEditBtn"
        );

    if (!btn) return;

    btn.addEventListener(
        "click",
        e => e.stopPropagation()
    );

    const controls =
        document.querySelectorAll(`
            #sessionTimeoutEnabled,
            #sessionTimeout,
            #sessionTimeoutUnit,
            #requireLogin,
            #hideDirectUrls,
            #changePasswordBtn,
            #logoutEverywhereBtn
        `);

    let editing = false;

    controls.forEach(el => {
        el.disabled = true;
    });

    btn.addEventListener(
        "click",
        () => {

            editing = !editing;

            controls.forEach(el => {
                el.disabled = !editing;
            });

            if (editing) {

                btn.textContent =
                    "Save";

            }
            else {

                persist();

                flashSaved(
                    "securityEditBtn"
                );
            }
        }
    );
}


/* ============================================================
   WEBSITE SETTINGS
   ============================================================ */

function bindWebsite() {

    bindInput(
        "siteTitle",
        value => {

            workspaceSettings
                .website
                .title =
                value;

            document.title =
                value ||
                "Gallery OS";

            const title =
                document.getElementById(
                    "brandTitle"
                );

            if (title) {

                title.textContent =
                    value ||
                    "Gallery OS";
            }
        }
    );


    bindInput(
        "siteDescription",
        value => {

            workspaceSettings
                .website
                .description =
                value;

            const subtitle =
                document.getElementById(
                    "brandSubtitle"
                );

            if (subtitle) {

                subtitle.textContent =
                    value ||
                    "Admin V2.0";
            }
        }
    );


    bindInput(
        "navbarStyle",
        value => {

            workspaceSettings
                .website
                .navbar =
                value;

            document.body.classList.toggle(
                "navbar-compact",
                value === "compact"
            );

            document.body.classList.toggle(
                "navbar-expanded",
                value === "expanded"
            );
        }
    );


    bindInput(
        "homepageSelect",
        value => {

            workspaceSettings
                .website
                .homepage =
                value;
        }
    );


    bindInput(
        "startupMode",
        value => {

            workspaceSettings
                .website
                .startup =
                value;
        }
    );
}


/* ============================================================
   GALLERY SETTINGS
   ============================================================ */

function bindGallery() {

    bindInput(
        "galleryView",
        value => {

            workspaceSettings
                .gallery
                .view =
                value;
        }
    );


    bindInput(
        "thumbSize",
        value => {

            workspaceSettings
                .gallery
                .thumbSize =
                value;
        }
    );


    bindCheck(
        "webpToggle",
        value => {

            workspaceSettings
                .gallery
                .webp =
                value;
        }
    );


    bindCheck(
        "thumbsToggle",
        value => {

            workspaceSettings
                .gallery
                .thumbnails =
                value;
        }
    );
}


/* ============================================================
   MOBILE WORKSPACE COLLAPSE
   ============================================================ */

function bindWorkspaceCollapse() {

    if (window.innerWidth > 768) {
        return;
    }

    document
        .querySelectorAll(
            ".workspace-collapse-trigger"
        )
        .forEach(header => {

            header.addEventListener(
                "click",
                () => {

                    header
                        .closest(
                            ".workspace-card"
                        )
                        .classList
                        .toggle(
                            "expanded"
                        );
                }
            );

        });
}


/* ============================================================
   WORKSPACE SUMMARY / EDITORS
   ============================================================ */

function bindWorkspaceEditors() {

    setupEditor(
        "editWebsiteBtn",
        "saveWebsiteBtn",
        "cancelWebsiteBtn",
        "websiteSummary",
        "websiteEditor"
    );

    setupEditor(
        "editGalleryBtn",
        "saveGalleryBtn",
        "cancelGalleryBtn",
        "gallerySummary",
        "galleryEditor"
    );
}


function setupEditor(
    editId,
    saveId,
    cancelId,
    summaryId,
    editorId
) {

    const summary =
        document.getElementById(
            summaryId
        );

    const editor =
        document.getElementById(
            editorId
        );

    if (!summary || !editor) {
        return;
    }

    bindButton(
        editId,
        () => {

            summary.classList.add(
                "hidden"
            );

            editor.classList.remove(
                "hidden"
            );

            const editButton =
                document.getElementById(
                    editId
                );

            if (editButton) {
                editButton.textContent =
                    "Editing";
            }
        }
    );


    bindButton(
        saveId,
        () => {

            updateWorkspaceSummary();

            editor.classList.add(
                "hidden"
            );

            summary.classList.remove(
                "hidden"
            );

            persist();

            flashSaved(
                editId
            );

            toast(
                "Saved"
            );
        }
    );


    bindButton(
        cancelId,
        () => {

            editor.classList.add(
                "hidden"
            );

            summary.classList.remove(
                "hidden"
            );

            const editButton =
                document.getElementById(
                    editId
                );

            if (editButton) {
                editButton.textContent =
                    "Edit";
            }
        }
    );
}





/* ============================================================
   SECURITY SETTINGS
   ============================================================ */

function bindSecurity() {

    bindInput(
        "sessionTimeout",
        value => {

            workspaceSettings
                .security
                .sessionTimeout =
                Number(value) || 30;

            startSessionTimeout();
        }
    );


    bindInput(
        "sessionTimeoutUnit",
        value => {

            workspaceSettings
                .security
                .sessionUnit =
                value;

            startSessionTimeout();
        }
    );



    bindCheck(
    "sessionTimeoutEnabled",
    value => {

        workspaceSettings
            .security
            .sessionTimeoutEnabled =
            value;

        startSessionTimeout();

        updateSessionTimeoutVisibility();
    }
);



    bindCheck(
        "requireLogin",
        value => {

            workspaceSettings
                .security
                .requireLogin =
                value;

            startSessionTimeout();
        }
    );


    bindCheck(
        "hideDirectUrls",
        value => {

            workspaceSettings
                .security
                .directUrls =
                value;
        }
    );
}


/* ============================================================
   SESSION TIMEOUT
   ============================================================ */

function startSessionTimeout() {

    clearTimeout(
        sessionTimer
    );

    if (
        !workspaceSettings
            .security
            .requireLogin ||
        !workspaceSettings
            .security
            .sessionTimeoutEnabled
    ) {
        return;
    }


    const amount =
        workspaceSettings
            .security
            .sessionTimeout;

    const unit =
        workspaceSettings
            .security
            .sessionUnit;

    const ms =
        unit === "hr"
            ? amount * 60 * 60 * 1000
            : amount * 60 * 1000;

    sessionTimer =
        setTimeout(
            handleSessionExpired,
            ms
        );
}


let lastActivity = 0;


function resetSessionTimeout() {

    const now =
        Date.now();

    if (
        now - lastActivity < 1000
    ) {
        return;
    }

    lastActivity =
        now;

    startSessionTimeout();
}


async function handleSessionExpired() {

    toast(
        "Session expired"
    );

    try {

        await api(
            API.LOGOUT,
            {
                method: "POST"
            }
        );

    }
    catch {}


    localStorage.removeItem(
        "galleryAuth"
    );


    document
        .getElementById(
            "app"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "loginOverlay"
        )
        .classList
        .remove(
            "hidden"
        );


    lockPageScroll();
}


let sessionEventsBound =
    false;


function bindSessionActivity() {

    if (sessionEventsBound) {
        return;
    }

    sessionEventsBound =
        true;

    [
        "click",
        "keydown",
        "mousemove",
        "touchstart"
    ]
        .forEach(evt => {

            document.addEventListener(
                evt,
                resetSessionTimeout,
                {
                    passive: true
                }
            );
        });
}


/* ============================================================
   WORKSPACE METRICS
   ============================================================ */

function updateWorkspaceMetrics() {
    return;
}


/* ============================================================
   PERSIST SETTINGS
   ============================================================ */

function persist() {

    saveWorkspaceSettings();

    applyAppearance();


}


/* ============================================================
   STORAGE
   ============================================================ */

function populateStorage() {

    workspaceSetText(
        "storageUsed",
        workspaceSettings.storage.used
    );

    workspaceSetText(
        "thumbCacheSize",
        workspaceSettings.storage.cache
    );
}


async function loadStorageStats() {

    try {

        const data =
            await api(
                API.STORAGE
            );

        workspaceSettings
            .storage
            .used =
            data.storage ||
            "0 MB";

        workspaceSettings
            .storage
            .cache =
            data.thumbsStorage ||
            "0 MB";

        populateStorage();

    }
    catch (err) {

        console.error(
            "Storage load failed",
            err
        );
    }
}


/* ============================================================
   ABOUT / SYSTEM INFORMATION
   ============================================================ */

async function loadAbout() {

    try {

        const data =
            await api(
                "/admin/about"
            );

        const version =
            document.getElementById(
                "aboutVersion"
            );

        if (version) {

            version.textContent =
                `v${data.galleryVersion}`;
        }


        const frontend =
            document.getElementById(
                "aboutFrontend"
            );

        if (frontend) {

            frontend.textContent =
                `v${data.frontendVersion}`;
        }


        const backend =
            document.getElementById(
                "aboutBackend"
            );

        if (backend) {

            backend.textContent =
                `${data.backendUrl}`;
        }


        const storage =
            document.getElementById(
                "aboutStorage"
            );

        if (storage) {

            storage.textContent =
                `${data.storagePath}`;
        }

    }
    catch (err) {

        console.error(
            err
        );
    }
}





/* ============================================================
   SECURITY / BACKUP / PERFORMANCE UI
   ============================================================ */

function populateSecurity() {


    workspaceSetChecked(
        "sessionTimeoutEnabled",
        workspaceSettings
            .security
            .sessionTimeoutEnabled
    );


    workspaceSetValue(
        "sessionTimeout",
        workspaceSettings
            .security
            .sessionTimeout
    );

    workspaceSetValue(
        "sessionTimeoutUnit",
        workspaceSettings
            .security
            .sessionUnit
    );

    workspaceSetChecked(
        "requireLogin",
        workspaceSettings
            .security
            .requireLogin
    );

    workspaceSetChecked(
        "hideDirectUrls",
        workspaceSettings
            .security
            .directUrls
    );
    
    updateSessionTimeoutVisibility();


}






function updateSessionTimeoutVisibility() {

    const toggle =
        document.getElementById(
            "sessionTimeoutEnabled"
        );

    const duration =
        document.querySelector(
            ".session-timeout-duration"
        );

    if (!toggle || !duration) {
        return;
    }

    duration.classList.toggle(
        "is-disabled",
        !toggle.checked
    );
}




function populateBackups() {

    workspaceSetText(
        "lastBackupDate",
        workspaceSettings
            .backups
            .lastBackup
            ? formatDateTime(
                workspaceSettings
                    .backups
                    .lastBackup
            )
            : "Never"
    );

}


function populatePerformance() {

    workspaceSetText(
        "imageCacheHealth",
        workspaceSettings
            .performance
            .imageCache +
        "%"
    );

    workspaceSetText(
        "thumbHealth",
        workspaceSettings
            .performance
            .thumbHealth +
        "%"
    );
}


/* ============================================================
   WORKSPACE SUMMARY
   ============================================================ */

function updateWorkspaceSummary() {

    const s =
        workspaceSettings;


    workspaceSetText(
        "siteTitleSummary",
        s.website.title
    );


    workspaceSetText(
        "siteDescriptionSummary",
        s.website.description
    );


    workspaceSetText(
        "navbarSummary",
        capitalize(
            s.website.navbar
        )
    );


    workspaceSetText(
        "homepageSummary",
        capitalize(
            s.website.homepage
        )
    );


    workspaceSetText(
        "startupModeSummary",
        s.website.startup === "homepage"
            ? "Always use Homepage"
            : "Resume Last Page"
    );


    workspaceSetText(
        "galleryViewSummary",
        capitalize(
            s.gallery.view
        )
    );


    workspaceSetText(
        "thumbSizeSummary",
        capitalize(
            s.gallery.thumbSize
        )
    );


    workspaceSetText(
        "webpSummary",
        s.gallery.webp
            ? "Enabled"
            : "Disabled"
    );


    workspaceSetText(
        "thumbsSummary",
        s.gallery.thumbnails
            ? "Enabled"
            : "Disabled"
    );
}


function capitalize(text) {

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}





/* ============================================================
   WORKSPACE ACTIONS
   ============================================================ */

function bindActions() {

    /* --------------------------------------------------------
       Cache
       -------------------------------------------------------- */

    bindButton(
        "clearCacheBtn",
        () => {

            workspaceSettings
                .storage
                .cache =
                "0 MB";

            populateStorage();

            persist();

            toast(
                "Cache cleared"
            );
        }
    );


    /* --------------------------------------------------------
       Thumbnail rebuild
       -------------------------------------------------------- */

    bindButton(
        "rebuildThumbsWorkspaceBtn",
        () => {

            toast(
                "Rebuilding thumbnails..."
            );
        }
    );


    /* --------------------------------------------------------
       Metadata export
       -------------------------------------------------------- */

    bindButton(
        "exportMetadataBtn",
        () => {

            toast(
                "Metadata exported"
            );
        }
    );


    /* --------------------------------------------------------
       Change password
       -------------------------------------------------------- */

    bindButton(
    "changePasswordBtn",
    () => {

        openPasswordModal(
            "admin"
        );

    }
);


    bindButton(
        "cancelPasswordBtn",
        () => {

            document
                .getElementById(
                    "passwordModal"
                )
                .classList
                .remove(
                    "open"
                );

            unlockPageScroll();
        }
    );


    /* --------------------------------------------------------
       Save password
       -------------------------------------------------------- */

/* --------------------------------------------------------
   Save password
   Handles:
   1. Admin password change
   2. Frontend password change
   -------------------------------------------------------- */

bindButton(
    "savePasswordBtn",
    async () => {


        /*
            FRONTEND PASSWORD MODE

            Used by:
            - Gallery Frontend
            - Articles Frontend

            Example:
            /admin/frontend/gallery/password
            /admin/frontend/articles/password
        */

if(passwordModalMode === "frontend"){


    const currentPassword =
        document
        .getElementById(
            "currentPassword"
        )
        .value
        .trim();


    const newPassword =
        document
        .getElementById(
            "newPassword"
        )
        .value
        .trim();



    if(
        !currentPassword ||
        !newPassword
    ){

        toast(
            "Fill both fields",
            "error"
        );

        return;

    }



    toast(
        "Changing frontend password...",
        "info"
    );


    await changeFrontendPassword(
        frontendPasswordTarget,
        currentPassword,
        newPassword
    );



    // Clear inputs

    document
    .getElementById(
        "currentPassword"
    )
    .value = "";


    document
    .getElementById(
        "newPassword"
    )
    .value = "";



    // Close modal

    document
    .getElementById(
        "passwordModal"
    )
    .classList
    .remove(
        "open"
    );


    unlockPageScroll();


    return;

}



        /*
            ADMIN PASSWORD MODE

            Uses:
            /auth/change-password

            Requires:
            - Current password
            - New password
        */


        try {


            const currentPassword =
                document
                .getElementById(
                    "currentPassword"
                )
                .value
                .trim();



            const newPassword =
                document
                .getElementById(
                    "newPassword"
                )
                .value
                .trim();



            if(
                !currentPassword ||
                !newPassword
            ){

                toast(
                    "Fill both fields",
                    "error"
                );

                return;

            }



            toast(
                "Changing password...",
                "info"
            );



            const res =
                await fetch(
                    "/auth/change-password",
                    {

                        method:"POST",

                        credentials:"include",


                        headers:{
                            "Content-Type":
                            "application/json"
                        },


                        body:
                        JSON.stringify({

                            currentPassword,

                            newPassword

                        })

                    }
                );



            const data =
                await res.json();



            console.log(
                "CHANGE PASSWORD RESPONSE",
                res.status,
                data
            );



            if(
                !data.success
            ){

                toast(
                    data.message ||
                    "Wrong password",
                    "error"
                );

                return;

            }



            toast(
                "Password changed successfully",
                "success"
            );



            // Clear fields

            document
            .getElementById(
                "currentPassword"
            )
            .value = "";



            document
            .getElementById(
                "newPassword"
            )
            .value = "";



            // Close modal

            document
            .getElementById(
                "passwordModal"
            )
            .classList
            .remove(
                "open"
            );



            unlockPageScroll();



        }
        catch(err){


            console.error(
                "CHANGE PASSWORD ERROR:",
                err
            );


            toast(
                "Unable to change password",
                "error"
            );


        }


    }
);





    /* --------------------------------------------------------
       Logout everywhere
       -------------------------------------------------------- */

    bindButton(
        "logoutEverywhereBtn",
        async () => {

            try {

                await api(
                    API.LOGOUT_ALL,
                    {
                        method: "POST"
                    }
                );


                localStorage.removeItem(
                    "galleryAuth"
                );


                document
                    .getElementById(
                        "app"
                    )
                    .classList
                    .add(
                        "hidden"
                    );


                document
                    .getElementById(
                        "loginOverlay"
                    )
                    .classList
                    .remove(
                        "hidden"
                    );


                lockPageScroll();


                toast(
                    "Logged out everywhere"
                );

            }
            catch {

                toast(
                    "Unable to logout"
                );
            }
        }
    );


    /* --------------------------------------------------------
       Create backup
       -------------------------------------------------------- */

    bindButton(
        "createBackupBtn",
        () => {

            workspaceSettings
                .backups
                .lastBackup =
                new Date()
                    .toISOString();


            populateBackups();

            persist();


            toast(
                "Backup created"
            );
        }
    );


    /* --------------------------------------------------------
       Download backup
       -------------------------------------------------------- */

    bindButton(
        "downloadBackupBtn",
        () => {

            toast(
                "Preparing backup..."
            );
        }
    );


    /* --------------------------------------------------------
       Restore backup
       -------------------------------------------------------- */

    bindButton(
        "restoreBackupBtn",
        () => {

            toast(
                "Restore started"
            );
        }
    );


    /* --------------------------------------------------------
       Optimize
       -------------------------------------------------------- */

    bindButton(
        "optimizeBtn",
        () => {

            workspaceSettings
                .performance
                .imageCache =
                100;


            workspaceSettings
                .performance
                .thumbHealth =
                100;


            populatePerformance();

            persist();


            toast(
                "Optimization complete"
            );
        }
    );


    /* --------------------------------------------------------
       Temporary files
       -------------------------------------------------------- */

    bindButton(
        "cleanTempBtn",
        () => {

            toast(
                "Temporary files removed"
            );
        }
    );
}




/* ============================================================
   DOM HELPERS
   ============================================================ */

function workspaceSetValue(
    id,
    value
) {

    const el =
        document.getElementById(
            id
        );

    if (el) {

        el.value =
            value ?? "";
    }
}


function workspaceSetChecked(
    id,
    value
) {

    const el =
        document.getElementById(
            id
        );

    if (el) {

        el.checked =
            !!value;
    }
}


function workspaceSetText(
    id,
    value
) {

    const el =
        document.getElementById(
            id
        );

    if (el) {

        el.textContent =
            value;
    }
}


/* ============================================================
   INPUT BINDING
   ============================================================ */

function bindInput(
    id,
    callback
) {

    const el =
        document.getElementById(
            id
        );

    if (!el) {
        return;
    }

    [
        "input",
        "change"
    ]
        .forEach(evt => {

            el.addEventListener(
                evt,
                e => {

                    callback(
                        e.target.value
                    );

                    persist();
                }
            );
        });
}


/* ============================================================
   CHECKBOX BINDING
   ============================================================ */

function bindCheck(
    id,
    callback
) {

    document
        .getElementById(
            id
        )
        ?.addEventListener(
            "change",
            e => {

                callback(
                    e.target.checked
                );

                persist();
            }
        );
}


/* ============================================================
   THEME BINDING
   ============================================================ */

function bindTheme(
    id,
    theme
) {

    document
        .getElementById(
            id
        )
        ?.addEventListener(
            "change",
            () => {

                workspaceSettings
                    .appearance
                    .theme =
                    theme;

                persist();
            }
        );
}


/* ============================================================
   BUTTON BINDING
   ============================================================ */

function bindButton(
    id,
    callback
) {

    document
        .getElementById(
            id
        )
        ?.addEventListener(
            "click",
            callback
        );
}


/* ============================================================
   TOAST
   ============================================================ */

function toast(
    message,
    type = "success"
) {

    if (
        typeof showToast ===
        "function"
    ) {

        showToast(
            message,
            type
        );

    }
    else {

        console.log(
            message
        );
    }
}


/* ============================================================
   SAVED STATE FEEDBACK
   ============================================================ */

function flashSaved(
    editId
) {

    const btn =
        document.getElementById(
            editId
        );

    if (!btn) {
        return;
    }

    btn.disabled =
        true;

    btn.classList.add(
        "saved"
    );

    btn.innerHTML =
        "✓ Saved";


    setTimeout(
        () => {

            btn.innerHTML =
                "Edit";

            btn.classList.remove(
                "saved"
            );

            btn.disabled =
                false;

        },
        1800
    );
}






function bindFrontendManagement(){


    bindButton(
        "galleryFrontendPasswordBtn",
        ()=>{
            openFrontendPasswordModal("gallery");
        }
    );


    bindButton(
        "articlesFrontendPasswordBtn",
        ()=>{
            openFrontendPasswordModal("articles");
        }
    );

}




let passwordModalMode = "admin";
let frontendPasswordTarget = null;


function openPasswordModal(mode="admin", target=null){

    passwordModalMode = mode;
    frontendPasswordTarget = target;


    const modal =
    document.getElementById("passwordModal");


    const current =
    document.getElementById("currentPassword");


    // Always show current password field
    current.style.display = "block";


    modal.classList.add("open");

    lockPageScroll();

}


function openFrontendPasswordModal(type){

    openPasswordModal(
        "frontend",
        type
    );

}



async function changeFrontendPassword(
    type,
    currentPassword,
    newPassword
){

    try{

        const res =
            await fetch(
                `/admin/frontend/${type}/password`,
                {
                    method:"POST",

                    credentials:"include",

                    headers:{
                        "Content-Type":
                        "application/json"
                    },

                    body:
                    JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                }
            );


        const data =
            await res.json();


        if(!data.success){

            toast(
                data.message ||
                "Failed",
                "error"
            );

            return;
        }


        await loadFrontendAccounts();
        toast(
            `${type} password updated`,
            "success"
        );


    }
    catch(err){

        console.error(
            err
        );

        toast(
            "Frontend password update failed",
            "error"
        );

    }

}






async function loadFrontendAccounts(){

    try{

        const data =
            await api(
                "/admin/frontend/accounts"
            );


        if(!data)
            return;


        const gallery =
            data.gallery || {};


        const articles =
            data.articles || {};



        /*
            Gallery
        */

        const galleryUpdated =
            document.getElementById(
                "galleryFrontendUpdated"
            );


        if(galleryUpdated){

            galleryUpdated.textContent =
                `Last updated: ${
                    gallery.updatedAt
                        ? formatDateTime(gallery.updatedAt)
                        : "Never"
                }`;

        }



        const galleryStatus =
            document.getElementById(
                "galleryFrontendStatus"
            );


        if(galleryStatus){

            galleryStatus.textContent =
                gallery.enabled
                ? "● Enabled"
                : "● Disabled";


            galleryStatus.classList.toggle(
                "disabled",
                !gallery.enabled
            );

        }




        /*
            Articles
        */

        const articlesUpdated =
            document.getElementById(
                "articlesFrontendUpdated"
            );


        if(articlesUpdated){

            articlesUpdated.textContent =
                `Last updated: ${
                    articles.updatedAt
                        ? formatDateTime(articles.updatedAt)
                        : "Never"
                }`;

        }



        const articlesStatus =
            document.getElementById(
                "articlesFrontendStatus"
            );


        if(articlesStatus){

            articlesStatus.textContent =
                articles.enabled
                ? "● Enabled"
                : "● Disabled";


            articlesStatus.classList.toggle(
                "disabled",
                !articles.enabled
            );

        }



    }
    catch(err){

        console.error(
            "Frontend accounts load failed:",
            err
        );

        toast(
            "Unable to load frontend accounts",
            "error"
        );

    }

}






function bindFrontendPasswordEyes(){

    const buttons = [
        ["galleryPasswordEye","galleryFrontendPassword","gallery"],
        ["articlesPasswordEye","articlesFrontendPassword","articles"]
    ];


    buttons.forEach(
        ([btnId,inputId,type])=>{


        const btn =
            document.getElementById(btnId);


        const pass =
            document.getElementById(inputId);


        if(!btn || !pass)
            return;



        btn.onclick = async()=>{


            try{


                // hide again
                if(pass.dataset.visible === "true"){


                    pass.textContent =
                        "••••••••";


                    pass.dataset.visible =
                        "false";


                    btn.textContent =
                        "👁";


                    return;

                }



                const data =
                    await api(
                        `/admin/frontend/${type}/password`
                    );



                if(
                    !data.success
                ){

                    throw new Error(
                        data.message ||
                        "Unable to reveal password"
                    );

                }



                pass.textContent =
                    data.password;



                pass.dataset.visible =
                    "true";


                btn.textContent =
                    "🙈";


            }
            catch(err){


                console.error(
                    "Password reveal failed",
                    err
                );


                toast(
                    "Unable to reveal password",
                    "error"
                );

            }


        };


    });

}