


let articles = [];

let livePreviewToken = null;
let livePreviewUrl = null;
let livePreviewWindow = null;
let livePreviewInEditor = false;
let livePreviewOpened = false;

let livePreviewArticle = null;

let livePreviewTimer = null;



let editorListenerReady = false;


const HISTORY_STEP = 5;

let articleHistory = [];
let visibleHistory = HISTORY_STEP;


let articleHistoryCollapsed =
    localStorage.getItem(
        "articleHistoryCollapsed"
    ) !== "false";



/*
 * History must always belong to the article
 * currently being viewed.
 */
let articleHistoryArticle = null;
let articleHistoryRequestId = 0;



// ================================
// EDITOR UNDO / REDO HISTORY
// ================================

let undoStack = [];
let redoStack = [];

let historyApplying = false;



// Undo history debounce
let undoHistoryTimer = null;

const UNDO_HISTORY_DELAY = 600;

// Metadata undo debounce
let metadataHistoryTimer = null;

const METADATA_HISTORY_DELAY = 800;





let articleMedia = [];

// Media specifically used by Markdown autocomplete
let autocompleteMedia = [];


let currentMediaCard = null;

let currentHistoryVersion = null;



let currentGalleryAlbum = null;



let selectedMoveArticle = null;

let articleFindOpen = false;

let articleMatches = [];

let articleMatchIndex = -1;




let collapsedToc =
    JSON.parse(

        localStorage.getItem(
            "articleCollapsedToc"
        ) || "{}"

    );



let imagePickerMode = "markdown";


let articleDirty = false;

let lastSavedArticleState = null;


let autosaveTimer = null;

let draftDirty = false;

let autosaveSaving = false;



let articleSettings = {

    showOriginal:false,

    showRaw:false,

    showCopy:true,

    showShare:true,

    originalUrl:""

};





let articleLayoutMode =
    localStorage.getItem(
        "articleLayoutMode"
    ) || "editor";


let articleFullscreen =
    localStorage.getItem(
        "articleFullscreen"
    ) === "true";


let articleFocusMode =
    localStorage.getItem(
        "articleFocusMode"
    ) === "true";



let currentStickyHeading = null;



let articleSplitRatio =
    Number(
        localStorage.getItem(
            "articleSplitRatio"
        )
    ) || 50;




const AUTOSAVE_DELAY = 5000;


async function loadArticles() {

    const container =
        document.getElementById(
            "articleList"
        );

    if (!container) return;

    container.innerHTML =
        "Loading...";

    try {

        const json =
            await window.api(
                window.API.ARTICLES
            );

        if (!json.success) {

            container.innerHTML =
                "Unable to load articles.";

            return;

        }

        articles =
            json.articles;

        renderArticles();

    }
    catch (err) {

        console.error(err);

        container.innerHTML =
            "Unable to load articles.";

    }

}

function renderArticles(list = articles) {

    const container =
        document.getElementById(
            "articleList"
        );

    if (!list.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div>📄</div>
                <p>No Articles</p>
                <small>Create your first article.</small>
            </div>
        `;

        return;

    }

    container.innerHTML =
        list.map(article => {

            const statusClass =
                article.draft
                    ? "draft"
                    : article.protected
                        ? "protected"
                        : "public";

            const statusText =
                article.draft
                    ? '<i class="bi bi-pencil-square"></i> Draft'
                    : article.protected
                        ? '<i class="bi bi-lock-fill"></i> Protected'
                        : '<i class="bi bi-globe"></i> Public';

            return `

    <div class="list-item article-row">

        <div class="article-info">

            <strong class="article-title">
                ${article.title}
            </strong>

        

            <small class="article-meta">

                ${article.displayDate}
                •
                ${article.readTime}

            </small>

        </div>


    <span class="status-pill ${statusClass}">

        ${statusText}

    </span>


    <div class="article-actions">

        <button
            class="btn article-edit"
            data-article="${article.slug}"
        >
            <i class="bi bi-pencil"></i>
            Edit
        </button>


        <button
            class="btn article-duplicate"
            data-article="${article.article}"
        >
             <i class="bi bi-copy"></i>
             Duplicate
        </button>


        <button
            class="btn danger article-delete"
            data-article="${article.slug}"
        >
            <i class="bi bi-trash"></i>
            Delete
        </button>

    </div>

</div>

`;

}).join("");

}









function notifyHeroChanged(){

    const hero =
        document.getElementById(
            "metaHero"
        );

    if(!hero)
        return;

    hero.dispatchEvent(
        new Event(
            "input",
            {
                bubbles: true
            }
        )
    );

}













async function resetLivePreviewSession(closeWindow = true){

    clearTimeout(livePreviewTimer);
    livePreviewTimer = null;


    /*
     * Save the old token before clearing state.
     */
    const token =
        livePreviewToken;


    /*
     * Close external preview window.
     */
    if(
        closeWindow &&
        livePreviewWindow &&
        !livePreviewWindow.closed
    ){
        livePreviewWindow.close();
    }


    /*
     * Clear frontend session state.
     */
    livePreviewWindow = null;

    livePreviewToken = null;
    livePreviewUrl = null;
    livePreviewArticle = null;

    livePreviewInEditor = false;
    livePreviewOpened = false;


    /*
     * Destroy backend session.
     */
    if(token){

        try{

            await window.api(
                `${window.API.ARTICLES}/live-preview/${token}`,
                {
                    method:"DELETE"
                }
            );

        }
        catch(err){

            console.warn(
                "Unable to destroy live preview session:",
                err
            );

        }

    }

}




function handleEditorChange(){


    if(!historyApplying){

        scheduleUndoSnapshot();

    } 
    
    

    articleDirty = true;
    draftDirty = true;


    scheduleAutosave();


    updateArticleStats();

    updateWritingInsights();

    updateSeoScore();

    updateArticleToc();

    updateActiveToc();

    updateStickyHeading();



    if(
        !livePreviewInEditor &&
        (
            articleLayoutMode === "split" ||
            articleLayoutMode === "preview"
        )
    ){
        renderArticlePreview();
    }



    clearTimeout(
        livePreviewTimer
    );


    if(
        livePreviewToken &&
        (
            livePreviewInEditor ||
            (
                livePreviewWindow &&
                !livePreviewWindow.closed
            )
        )
    ){

        livePreviewTimer =
        setTimeout(
            ()=>{

                updateLivePreview();

            },
            800
        );

    }

}










function setAutosaveStatus(text, state = "") {

    const el =
        document.getElementById(
            "autosaveStatus"
        );

    if (!el)
        return;

    el.textContent = text;

    el.className =
        "autosave-status";

    if (state) {

        el.classList.add(
            state
        );

    }

}





function scheduleAutosave() {

    clearTimeout(
        autosaveTimer
    );

    setAutosaveStatus(
        "Saving...",
        "saving"
    );

    autosaveTimer = setTimeout(

        autosaveDraft,

        AUTOSAVE_DELAY

    );

}



async function autosaveDraft() {

    if (
        autosaveSaving ||
        !draftDirty ||
        !window.currentArticle
    ) {
        return;
    }

    autosaveSaving = true;

    try {

        // Save only to localStorage.
        // Do NOT send anything to the server/Appwrite.
        saveDraftLocally();

        draftDirty = false;

        setAutosaveStatus(
            "Draft Saved",
            "saved"
        );

    }
    catch (err) {

        console.error(err);

        setAutosaveStatus(
            "Autosave Failed",
            "error"
        );

    }
    finally {

        autosaveSaving = false;

    }

}




function getDraftKey(article){

    return `article-draft-${article}`;

}



function saveDraftLocally(){

    if(!window.currentArticle)
        return;

    const draft={

        meta:{

            title:document.getElementById("metaTitle").value,

            slug:
                document.getElementById("metaSlug").value,

            author:document.getElementById("metaAuthor").value,

            role:document.getElementById("metaRole").value,

            date:document.getElementById("metaDate").value,

            hero:document.getElementById("metaHero").value,

            tags:document.getElementById("metaTags").value,

            draft:document.getElementById("metaDraft").checked,

            popular:document.getElementById("metaPopular").checked,

            protected:document.getElementById("metaProtected").checked

        },
        
        display:getDisplaySettings(),

        markdown:

            document.getElementById(
                "articleEditor"
            ).value,

        time:Date.now()

    };

    localStorage.setItem(

        getDraftKey(
            window.currentArticle
        ),

        JSON.stringify(draft)

    );

}




function loadLocalDraft(article){

    const raw = localStorage.getItem(
        getDraftKey(article)
    );

    if(!raw)
        return null;

    try{

        return JSON.parse(raw);

    }
    catch{

        return null;

    }

}



function deleteLocalDraft(article){

    localStorage.removeItem(
        getDraftKey(article)
    );

}






function parseFrontMatter(markdown) {

    // Support Windows + Linux line endings
    markdown = markdown.replace(/\r\n/g, "\n");

    if (!markdown.startsWith("---")) {
        return {
            meta: {},
            body: markdown
        };
    }

    const end = markdown.indexOf("\n---\n", 4);

    if (end === -1) {
        return {
            meta: {},
            body: markdown
        };
    }

    const frontMatter = markdown.slice(4, end);
    const body = markdown.slice(end + 5);

    const meta = {};

    frontMatter.split("\n").forEach(line => {

        const idx = line.indexOf(":");

        if (idx === -1) return;

        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();

        meta[key] = value;

    });

    return {
        meta,
        body
    };

}







async function confirmDiscardChanges() {

    if (!articleStateChanged()) {
        return true;
    }

    return confirm(
        "You have unsaved changes.\n\nDiscard them?"
    );
}





function getDisplaySettings(){

    return {

        showOriginal:
            document.getElementById("metaShowOriginal")?.checked || false,

        showRaw:
            document.getElementById("metaShowRaw")?.checked || false,

        showCopy:
            document.getElementById("metaShowCopy")?.checked ?? true,

        showShare:
            document.getElementById("metaShowShare")?.checked ?? true,

        originalUrl:
            document.getElementById("metaOriginalUrl")?.value.trim() || ""

    };

}



function applyDisplaySettings(settings = {}){

    document.getElementById("metaShowOriginal").checked =
        !!settings.showOriginal;


    document.getElementById("metaShowRaw").checked =
        !!settings.showRaw;


    document.getElementById("metaShowCopy").checked =
        settings.showCopy !== false;


    document.getElementById("metaShowShare").checked =
        settings.showShare !== false;


    document.getElementById("metaOriginalUrl").value =
        settings.originalUrl || "";


    articleSettings = {
        showOriginal: !!settings.showOriginal,
        showRaw: !!settings.showRaw,
        showCopy: settings.showCopy !== false,
        showShare: settings.showShare !== false,
        originalUrl: settings.originalUrl || ""
    };

}








function getCurrentArticleState() {

    return JSON.stringify({

        meta: {

            title:
                document.getElementById("metaTitle").value.trim(),

            slug:
                document.getElementById("metaSlug").value.trim(),

            author:
                document.getElementById("metaAuthor").value.trim(),

            role:
                document.getElementById("metaRole").value.trim(),

            date:
                document.getElementById("metaDate").value,

            hero:
                document.getElementById("metaHero").value.trim(),

            tags:
                document.getElementById("metaTags").value.trim(),

            draft:
                document.getElementById("metaDraft").checked,

            popular:
                document.getElementById("metaPopular").checked,

            protected:
                document.getElementById("metaProtected").checked
        },
        
        display:getDisplaySettings(),

        markdown:
            document.getElementById("articleEditor").value,

        scope:
            document.getElementById("articleMediaScope").value
    });
}




function captureEditorSnapshot(label = "Edit"){

    return {
        state:getCurrentArticleState(),
        label,
        time:Date.now()
    };

}

 

function scheduleUndoSnapshot(){

    clearTimeout(
        undoHistoryTimer
    );


    undoHistoryTimer =
        setTimeout(()=>{

            pushUndoState("Type Text");

        }, UNDO_HISTORY_DELAY);

}



function pushUndoState(label = "Type Text"){

    console.log(
        "PUSH HISTORY:",
        label
    );

    const snapshot =
        captureEditorSnapshot(label);


    const last =
        undoStack[
            undoStack.length - 1
        ];


    // avoid duplicate states
    if(
        last &&
        last.state === snapshot.state
    ){
        return;
    }


    undoStack.push(snapshot);
    
    


    if(undoStack.length > 100){

        undoStack.shift();

    }


    redoStack = [];


    updateHistoryButtons();

}





function scheduleMetadataHistory(label){

    clearTimeout(
        metadataHistoryTimer
    );


    metadataHistoryTimer =
        setTimeout(()=>{

            pushUndoState(label);

        }, METADATA_HISTORY_DELAY);

}






function undoArticle(){

    if(undoStack.length <= 1)
        return;

    clearTimeout(undoHistoryTimer);
    undoHistoryTimer = null;

    clearTimeout(metadataHistoryTimer);
    metadataHistoryTimer = null;

    historyApplying = true;

    const current =
        undoStack.pop();

    redoStack.push(current);

    const previous =
        undoStack[
            undoStack.length - 1
        ];

    restoreEditorSnapshot(previous);

    historyApplying = false;

    updateHistoryButtons();

}



function redoArticle(){

    if(!redoStack.length)
        return;

    clearTimeout(undoHistoryTimer);
    undoHistoryTimer = null;

    clearTimeout(metadataHistoryTimer);
    metadataHistoryTimer = null;

    historyApplying = true;

    const next =
        redoStack.pop();

    undoStack.push(next);

    restoreEditorSnapshot(next);

    historyApplying = false;

    updateHistoryButtons();

}





function updateHistoryButtons(){

    const undo =
        document.getElementById(
            "undoEditorBtn"
        );

    const redo =
        document.getElementById(
            "redoEditorBtn"
        );


    const lastUndo =
        undoStack[
            undoStack.length - 1
        ];

    const lastRedo =
        redoStack[
            redoStack.length - 1
        ];


    if(undo){

        undo.disabled =
            undoStack.length <= 1;


        undo.dataset.tooltip =
            undoStack.length > 1 &&
            lastUndo?.label
                ? `Undo: ${lastUndo.label}`
                : "Undo (Ctrl + Z)";

    }


    if(redo){

        redo.disabled =
            redoStack.length === 0;


        redo.dataset.tooltip =
            lastRedo?.label
                ? `Redo: ${lastRedo.label}`
                : "Redo (Ctrl + Y)";

    }

}





function restoreEditorSnapshot(snapshot){

    const data =
        JSON.parse(snapshot.state);


    document.getElementById("metaTitle").value =
        data.meta.title;


    document.getElementById("metaSlug").value =
        data.meta.slug;


    document.getElementById("metaAuthor").value =
        data.meta.author;


    document.getElementById("metaRole").value =
        data.meta.role;


    document.getElementById("metaDate").value =
        data.meta.date;


    document.getElementById("metaHero").value =
        data.meta.hero;


    document.getElementById("metaTags").value =
        data.meta.tags;


    document.getElementById("metaDraft").checked =
        data.meta.draft;


    document.getElementById("metaPopular").checked =
        data.meta.popular;


    document.getElementById("metaProtected").checked =
        data.meta.protected;
        
    
    applyDisplaySettings(
        data.display ?? {}
    );


    document.getElementById("articleEditor").value =
        data.markdown;


    updateHeroPreview(data.meta.hero);

    updateArticleStats();
    updateWritingInsights();
    updateSeoScore();
    updateArticleToc();
    updateStickyHeading();

}






function articleStateChanged() {

    if (!lastSavedArticleState) {
        return false;
    }

    return (
        getCurrentArticleState() !==
        lastSavedArticleState
    );
}





/* ==========================================================
   EDITOR LAYOUT
   ========================================================== */

function setArticleLayout(mode) {

    articleLayoutMode = mode;

    localStorage.setItem(
        "articleLayoutMode",
        mode
    );

    document.body.classList.remove(

        "article-editor-mode",

        "article-split-mode",

        "article-preview-mode"

    );

    document.body.classList.add(
        `article-${mode}-mode`
    );


    document.documentElement.style.setProperty(

        "--split-left",

        articleSplitRatio + "%"

    );

    document.body.classList.toggle(
        "article-fullscreen",
        articleFullscreen
    );


    document.body.classList.toggle(
        "article-focus",
         articleFocusMode
    );


    const preview =
        document.getElementById(
            "articlePreview"
        );

    if (preview) {

        if (

            mode === "split"

            ||

            mode === "preview"

        ) {

            preview.classList.remove(
                "hidden"
            );

            if(!livePreviewInEditor){

                renderArticlePreview();

            }


            preview.scrollTop = 0;

        }
        else {

            preview.classList.add(
                "hidden"
            );

        }

    }

    [
        "editorModeBtn",
        "splitModeBtn",
        "previewModeBtn",
        "livePreviewBtn"
    ].forEach(id => {

        document
            .getElementById(id)
            ?.classList.remove(
                "active"
            );

    });

    document
        .getElementById("toggleFullscreenBtn")
        ?.classList.toggle(
            "active",
            articleFullscreen
        );


    document
        .getElementById("toggleFocusBtn")
        ?.classList.toggle(
            "active",
            articleFocusMode
        );

    switch(mode){

    /* ========================================
       EDITOR
       ======================================== */

        case "editor":

            document
                .getElementById(
                    "editorModeBtn"
                )
                ?.classList.add(
                    "active"
                );

            break;


    /* ========================================
       SPLIT
       ======================================== */

        case "split":

        /*
         * Split is always active.
         */
            document
                .getElementById(
                    "splitModeBtn"
                )
                ?.classList.add(
                    "active"
                );
    

        /*
         * The second active button tells us
         * which preview is inside the split pane.
         */

            if(livePreviewInEditor){
    
                document
                    .getElementById(
                        "livePreviewBtn"
                    )
                    ?.classList.add(
                        "active"
                    );

            }
            else{
    
                document
                    .getElementById(
                        "previewModeBtn"
                    )
                    ?.classList.add(
                        "active"
                    );
    
            }
    
            break;


    /* ========================================
       FULL PREVIEW
       ======================================== */

        case "preview":

        /*
         * Only the currently selected preview
         * source is active.
         */

            if(livePreviewInEditor){

                document
                    .getElementById(
                        "livePreviewBtn"
                    )
                    ?.classList.add(
                        "active"
                    );

            }
            else{

                document
                    .getElementById(
                        "previewModeBtn"
                    )
                    ?.classList.add(
                        "active"
                    );

            }

            break;

    }

}





function setupSplitResize(){

    const divider =
        document.getElementById(
            "articleSplitDivider"
        );

    const workspace =
        document.querySelector(
            ".editor-workspace"
        );

    if(!divider || !workspace)
        return;

    let dragging = false;

    divider.addEventListener(
        "mousedown",
        () => dragging = true
    );



    divider.addEventListener(
        "dblclick",
        () => {

            articleSplitRatio = 50;

            document.documentElement.style.setProperty(
                "--split-left",
                "50%"
            );

            localStorage.setItem(
            "articleSplitRatio",
                50
            );

        }
    );



    document.addEventListener(
        "mouseup",
        () => {

            if (!dragging)
                return;

            dragging = false;

            localStorage.setItem(
                "articleSplitRatio",
                articleSplitRatio
            );

        }
    );

    document.addEventListener(
        "mousemove",
        e=>{

            if(

                !dragging ||

                articleLayoutMode !== "split"

            ) return;

            const rect =
                workspace.getBoundingClientRect();

            let ratio =
                (
                    (e.clientX - rect.left)
                    /
                    rect.width
                ) * 100;

            ratio =
                Math.max(
                    20,
                    Math.min(
                        80,
                        ratio
                    )
                );

            articleSplitRatio =
                ratio;

            document.documentElement.style.setProperty(

                "--split-left",

                ratio + "%"

            );

        }

    );

}





function setupPreviewScrollSync(){

    const editor =
        document.getElementById(
            "articleEditor"
        );

    const preview =
        document.getElementById(
            "articlePreview"
        );

    if(!editor || !preview)
        return;

    let syncing = false;

    editor.addEventListener(
        "scroll",
        () => {

            if(

                syncing ||

                articleLayoutMode !== "split"

            ) return;

            syncing = true;

            const ratio =

                editor.scrollTop /

                Math.max(

                    1,

                    editor.scrollHeight -

                    editor.clientHeight

                );

            preview.scrollTop =

                ratio *

                (

                    preview.scrollHeight -

                    preview.clientHeight

                );

            requestAnimationFrame(
                () => syncing = false
            );

        }
    );

}








/* ==========================================================
   TABLE OF CONTENTS
   ========================================================== */

function updateArticleToc() {

    const editor =
        document.getElementById(
            "articleEditor"
        );

    const list =
        document.getElementById(
            "articleTocList"
        );

    if (!editor || !list) return;

    const regex =
        /^(#{1,6})\s+(.+)$/gm;

    const headings = [];

    let match;

    while (
        (match = regex.exec(editor.value))
    ) {

        headings.push({

            level:
                match[1].length,

            title:
                match[2],

            position:
                match.index

        });

    }

    if (!headings.length) {

        list.innerHTML =
            "<div>No headings</div>";

        return;

    }

    let collapsedLevel = 0;

    
    list.innerHTML =
        headings.map((h,index)=>{

            const next =
                headings[index+1];

            const hasChildren =

                next &&

                next.level > h.level;

            if(

               collapsedLevel &&

               h.level > collapsedLevel

           ){

               return "";

           }

           if(

               collapsedLevel &&

               h.level <= collapsedLevel

           ){

               collapsedLevel = 0;

           }

           if(

               hasChildren &&

               collapsedToc[h.title]

           ){

               collapsedLevel = h.level;

           }

            return `

<div
    class="toc-item"
    data-position="${h.position}"
    style="padding-left:${10 + (h.level-1)*18}px"
>

    ${hasChildren ? `

    <span

        class="toc-toggle"

        data-section="${h.title}"

    >

        ${

            collapsedToc[h.title]

                ? "▶"

                : "▼"

        }

    </span>

    ` : ""}

    ${h.title}

</div>

`;

    }).join("");

updateActiveToc();

}




function updateActiveToc(){

    const editor =
        document.getElementById(
            "articleEditor"
        );

    if(!editor)
        return;

    const position =
        editor.selectionStart;

    const items =
        document.querySelectorAll(
            ".toc-item"
        );

    let active = null;

    items.forEach(item=>{

        const start =
            Number(
                item.dataset.position
            );

        if(start <= position){

            active = item;

        }

    });

    items.forEach(item=>

        item.classList.remove(
            "active"
        )

    );

    active?.classList.add(
        "active"
    );

}




function toggleTocSection(name){

    collapsedToc[name] =
        !collapsedToc[name];

    localStorage.setItem(

        "articleCollapsedToc",

        JSON.stringify(collapsedToc)

    );

    updateArticleToc();

}





function setArticleHistoryCollapsed(
    collapsed
){

    articleHistoryCollapsed =
        collapsed;

    localStorage.setItem(
        "articleHistoryCollapsed",
        String(collapsed)
    );

    const section =
        document.getElementById(
            "articleHistorySection"
        );

    const button =
        document.getElementById(
            "toggleArticleHistoryBtn"
        );

    if (!section || !button)
        return;

    section.classList.toggle(
        "is-collapsed",
        collapsed
    );

    button.setAttribute(
        "aria-expanded",
        String(!collapsed)
    );

    button.dataset.tooltip =
        collapsed
            ? "Expand history"
            : "Collapse history";
}





function updateStickyHeading(){

    const editor =
        document.getElementById(
            "articleEditor"
        );

    const container =
        document.getElementById(
            "stickyHeading"
        );

    const text =
        document.getElementById(
            "stickyHeadingText"
        );

    if(
        !editor ||
        !container ||
        !text
    ){
        return;
    }

    const cursor =
    editor.selectionStart;

const regex =
    /^(#{1,6})\s+(.+)$/gm;

let match;

let active = null;

while(
    (match = regex.exec(editor.value))
){

    if(match.index > cursor){
        break;
    }

    active = {

        level:
            match[1].length,

        title:
            match[2]

    };

}

if(!active){

    currentStickyHeading = null;

    container.classList.add(
        "hidden"
    );

    return;

}

currentStickyHeading = active;

container.classList.remove(
    "hidden"
);

container.querySelector(
    ".sticky-heading-level"
).textContent =
    "H" + active.level;

text.textContent =
    active.title;
}



/* ==========================================================
   FIND & REPLACE
   ========================================================== */


function openFindBar(){

    articleFindOpen = true;

    document
        .getElementById("articleFindBar")
        ?.classList.remove("hidden");

    document
        .getElementById("findInput")
        ?.focus();

}

function closeFindBar(){

    articleFindOpen = false;

    document
        .getElementById("articleFindBar")
        ?.classList.add("hidden");

}




function updateArticleMatches(){

    const editor =
        document.getElementById(
            "articleEditor"
        );

    const query =
        document.getElementById(
            "findInput"
        ).value;

    const matchCase =
        document.getElementById(
            "findMatchCase"
        ).checked;

    articleMatches = [];

    articleMatchIndex = -1;

    if(!query){

        updateFindCounter();

        return;

    }

    const text =
        matchCase
            ? editor.value
            : editor.value.toLowerCase();

    const search =
        matchCase
            ? query
            : query.toLowerCase();

    let index = 0;

    while(true){

        index =
            text.indexOf(
                search,
                index
            );

        if(index === -1)
            break;

        articleMatches.push(index);

        index += search.length;

    }


    if(articleMatches.length){

        articleMatchIndex = 0;

    }

    updateFindCounter();

}



function gotoArticleMatch(next = true){

    if(!articleMatches.length)
        return;

    if(articleMatchIndex === -1){

             articleMatchIndex = 0;

    }else if(next){

        articleMatchIndex =
            (articleMatchIndex + 1) %
            articleMatches.length;

    }else{

        articleMatchIndex =
            (articleMatchIndex - 1 + articleMatches.length) %
            articleMatches.length;

    }

    const editor =
        document.getElementById("articleEditor");

    const query =
        document.getElementById("findInput").value;

    const start =
    articleMatches[articleMatchIndex];

const temp =
    editor.selectionStart;

editor.blur();

editor.focus();

editor.setSelectionRange(
    start,
    start + query.length
);


    const lineHeight =
    parseFloat(
        getComputedStyle(editor).lineHeight
    ) || 20;

const before =
    editor.value
        .substring(0, start);

const line =
    before.split("\n").length - 1;

editor.scrollTop =
    Math.max(
        0,
        line * lineHeight -
        editor.clientHeight / 2
    );

updateFindCounter();

}






function replaceCurrentMatch(){

    if(

        articleMatchIndex < 0 ||

        !articleMatches.length

    ) return;

    const editor =
        document.getElementById(
            "articleEditor"
        );

    const find =
        document.getElementById(
            "findInput"
        ).value;

    const replace =
        document.getElementById(
            "replaceInput"
        ).value;

    const start =
        articleMatches[
            articleMatchIndex
        ];

    editor.setSelectionRange(

        start,

        start + find.length

    );

    editor.setRangeText(

        replace,

        start,

        start + find.length,

        "end"

    );
    
    pushUndoState("Replace Text");

    handleEditorChange();

    

    updateArticleMatches();

    gotoArticleMatch(true);

}





function replaceAllMatches(){

    const editor =
        document.getElementById(
            "articleEditor"
        );

    const find =
        document.getElementById(
            "findInput"
        ).value;

    const replace =
        document.getElementById(
            "replaceInput"
        ).value;

    const matchCase =
        document.getElementById(
            "findMatchCase"
        ).checked;

    if(!find)
        return;

    const escaped =

        find.replace(

            /[.*+?^${}()|[\]\\]/g,

            "\\$&"

        );

    const flags =
        matchCase
            ? "g"
            : "gi";

    const regex =
        new RegExp(
            escaped,
            flags
        );

    const matches =
        editor.value.match(regex);

    if(!matches)
        return;

    editor.value =
        editor.value.replace(
            regex,
            replace
        );
        
    
    pushUndoState("Replace All");

    handleEditorChange();

    

    updateArticleMatches();

    updateFindCounter();

    alert(
        `Replaced ${matches.length} occurrence${matches.length===1?"":"s"}.`
    );

}



function updateFindCounter(){

    const counter =
        document.getElementById(
            "findCounter"
        );

    if(!counter)
        return;

    const query =
        document.getElementById(
            "findInput"
        ).value.trim();

    const disabled =
        !articleMatches.length;

    findNextBtn.disabled =
        disabled;

    findPrevBtn.disabled =
        disabled;

    replaceBtn.disabled =
        disabled;

    replaceAllBtn.disabled =
        disabled;

    if(!query){

        counter.textContent =
            "0 / 0";

        counter.classList.remove(
            "no-match"
        );

        return;

    }

    if(!articleMatches.length){

        counter.textContent =
            "0 / 0";

        counter.classList.add(
            "no-match"
        );

        return;

    }

    counter.classList.remove(
        "no-match"
    );

    counter.textContent =

        `${articleMatchIndex + 1} / ${articleMatches.length}`;

}











async function editArticle(article) {


    if (!(await confirmDiscardChanges())) {

        return;

    }

    resetLivePreviewSession();


    try {


        const json = await window.api(
            `${window.API.ARTICLES}/${article}`
        );

        if (!json.success) {

            window.showToast(json.message, "error");

            return;

        }

        const parsed =
            parseFrontMatter(
                json.markdown
            );

            console.log(json);

        // Metadata

        document.getElementById(
            "metaTitle"
        ).value =
            parsed.meta.title || "";

        document.getElementById(
            "metaAuthor"
        ).value =
            parsed.meta.author || "";

        document.getElementById(
            "metaRole"
        ).value =
            parsed.meta.role || "";

        document.getElementById(
            "metaDate"
        ).value =
            parsed.meta.date || "";

        document.getElementById(
            "metaHero"
        ).value =
            parsed.meta.hero || "";

        
        updateHeroPreview(
            document.getElementById(
                "metaHero"
            ).value
        );


        document.getElementById(
            "metaTags"
        ).value =
            parsed.meta.tags || "";

        document.getElementById(
            "metaPopular"
        ).checked =
            parsed.meta.popular === "true";


        document.getElementById(
            "metaDraft"
        ).checked =
            parsed.meta.draft === "true";


        document.getElementById(
            "metaProtected"
        ).checked =
            json.protected ?? false;
            
            
        // Article Display Settings

        applyDisplaySettings(
            json.settings || {}
        );

        // Markdown body

        document.getElementById(
            "articleEditor"
        ).value =
            parsed.body.trim();

        // Current article

        window.currentArticle =
            article;



        clearTimeout(
            undoHistoryTimer
        );

        undoHistoryTimer = null;   


        
        clearTimeout(
            metadataHistoryTimer
        );

        metadataHistoryTimer = null;


            
        undoStack = [];
        redoStack = [];

        updateHistoryButtons();
        


        localStorage.setItem(
            "galleryCurrentArticle",
            article
        );



        window.refreshSearchIndex?.();
        
        document.getElementById(
            "metaSlug"
        ).value = article;



        lastSavedArticleState =
            getCurrentArticleState();


        let restoredDraft = false;

        const draft =
            loadLocalDraft(article);

if(
    draft &&
    confirm(
        `An unsaved draft was found.\n\nRestore it?`
    )
){

    restoredDraft = true;

    document.getElementById(
        "metaSlug"
    ).value =
        draft.meta.slug || article;


    document.getElementById(
        "metaTitle"
    ).value =
        draft.meta.title;

    document.getElementById(
        "metaAuthor"
    ).value =
        draft.meta.author;

    document.getElementById(
        "metaRole"
    ).value =
        draft.meta.role;

    document.getElementById(
        "metaDate"
    ).value =
        draft.meta.date;

    document.getElementById(
        "metaHero"
    ).value =
        draft.meta.hero;

    document.getElementById(
        "metaTags"
    ).value =
        draft.meta.tags;

    document.getElementById(
        "metaDraft"
    ).checked =
        draft.meta.draft;

    document.getElementById(
        "metaPopular"
    ).checked =
        draft.meta.popular;

    document.getElementById(
        "metaProtected"
    ).checked =
        draft.meta.protected;
        
    
    applyDisplaySettings(
       draft.display || {}
    );

    document.getElementById(
        "articleEditor"
    ).value =
        draft.markdown;

    updateHeroPreview(
        draft.meta.hero
    );

}


        undoStack = [
            captureEditorSnapshot("Initial")
        ];

        redoStack = [];

        updateHistoryButtons();



        showPage("articleEditor");

        const sidebar =
            document.querySelector(
                ".article-editor-sidebar"
            );

        const arrow =
            document.getElementById(
                "metaArrow"
            );

        sidebar?.classList.add(
            "collapsed"
        );

        if (arrow) {
 
            arrow.className =
                "bi bi-chevron-down";

        }

        articleDirty = restoredDraft;
        draftDirty = restoredDraft;

        setAutosaveStatus(
            restoredDraft
                ? "Draft Restored"
                : "Ready",
            restoredDraft
                ? "saving"
                : ""
        );



        updateArticleStatus();

        updateArticleStats();

        updateWritingInsights();

        updateSeoScore();

        updateArticleToc();

        updateStickyHeading();

        updateSlugStatus();
        
        await loadAutocompleteMedia();
 
        await loadArticleMedia();
        
        await loadArticleHistory();

        setArticleLayout(
            articleLayoutMode
        );
        

    } 
   
    catch (err) {
        console.error("EDIT ARTICLE FAILED:", err);

        window.showToast(
            `Unable to load article: ${err.message || err}`,
            "error"
        );
    }

}






function openNewArticleModal() {

    document.getElementById(
        "newArticleTitle"
    ).value = "";

    document.getElementById(
        "newArticleSlug"
    ).value = "";

    const modal =
        document.getElementById(
            "newArticleModal"
        );

    modal.classList.add("open");

    document.body.classList.add(
        "modal-open"
    );

    document.getElementById(
        "newArticleTitle"
    ).focus();

}



function closeNewArticleModal() {

    const modal =
        document.getElementById(
            "newArticleModal"
        );

    modal.classList.remove("open");

    document.body.classList.remove(
        "modal-open"
    );

}



/* =========================================
   ARTICLE MEDIA
   ======================================== */

async function loadAutocompleteMedia() {
    if (!window.currentArticle) {
        autocompleteMedia = [];
        return;
    }

    try {
        const json =
            await window.api(
                `${window.API.ARTICLE_ASSETS}/${window.currentArticle}` +
                `?type=images&scope=autocomplete`
            );

        if (!json.success) {
            throw new Error(
                json.message ||
                "Unable to load autocomplete media."
            );
        }

        autocompleteMedia =
            json.files || [];

        console.log(
            "Autocomplete media loaded:",
            autocompleteMedia.length
        );
    }
    catch (err) {
        console.error(
            "Unable to load autocomplete media:",
            err
        );

        autocompleteMedia = [];
    }
}





function updateUnsavedMediaBar(){

    const temp =
        articleMedia.filter(
            file => file.temporary
        );


    const bar =
        document.getElementById(
            "mediaUnsavedBar"
        );


    const count =
        document.getElementById(
            "unsavedMediaCount"
        );


    if(!bar || !count)
        return;


    count.textContent = temp.length;


    bar.classList.toggle(
        "hidden",
        temp.length === 0
    );

}




async function openImagePicker(
    mode = "markdown"
) {

    imagePickerMode = mode;

    const modal =
        document.getElementById(
            "imagePickerModal"
        );

    modal.classList.add("open");

    document.body.classList.add(
        "modal-open"
    );

    const grid =
        document.getElementById(
            "imagePickerGrid"
        );

    grid.innerHTML = "Loading...";

    try {

        const json =
            await window.api(
                `${window.API.IMAGES}/search`
            );

        if (!json.success) {

            grid.innerHTML =
                "Unable to load images.";

            return;

        }

        renderImagePicker(
            json.images || []
        );

    }
    catch (err) {

        console.error(err);

        grid.innerHTML =
            "Unable to load images.";

    }

}





function closeImagePicker() {

    document
        .getElementById(
            "imagePickerModal"
        )
        .classList.remove("open");

    document.body.classList.remove(
        "modal-open"
    );

}






async function openArticleMedia() {

    const modal =
        document.getElementById(
            "articleMediaModal"
        );

    modal.classList.add("open");

    document.body.classList.add(
        "modal-open"
    );

    await loadArticleMedia();

}




function closeArticleMedia() {

    document
        .getElementById(
            "articleMediaModal"
        )
        .classList.remove("open");

    document.body.classList.remove(
        "modal-open");

}



// ===== Media Library Listeners =====

document
    .getElementById("articleMediaType")
    ?.addEventListener("change", loadArticleMedia);

document
    .getElementById("articleMediaScope")
    ?.addEventListener("change", loadArticleMedia);


document
    .getElementById("articleMediaSearch")
    ?.addEventListener("input", filterArticleMedia);


document
    .getElementById("articleMediaSort")
    ?.addEventListener("change", filterArticleMedia);







document
    .getElementById("moveArticleSearch")
    ?.addEventListener("input", e => {

        const query =
            e.target.value.toLowerCase();

        renderMoveArticleList(

            articles.filter(article =>

                article.title
                    .toLowerCase()
                    .includes(query)

                ||

                article.article
                    .toLowerCase()
                    .includes(query)

            )

        );

    });

document
    .getElementById("cancelMoveArticle")
    ?.addEventListener(
        "click",
        closeMoveArticleModal
    );

document
    .getElementById("moveArticleModal")
    ?.addEventListener("click", e => {

        if (e.target !== e.currentTarget) {
            return;
        }

        closeMoveArticleModal();

    });

document
    .getElementById("confirmMoveArticle")
    ?.addEventListener("click", async () => {

        if (!selectedMoveArticle) {
            return;
        }

        try {

            window.showToast(
                "Moving asset...",
                "loading"
            );

            await moveSharedAsset(

                currentMediaCard.id,

                selectedMoveArticle

            );

            closeMoveArticleModal();

            await loadArticleMedia();

            window.showToast(
                "Asset moved.",
                "success"
            );

        }
        catch (err) {

            window.showToast(
                err.message,
                "error"
            );

        }

    });




document
    .getElementById("saveMediaBtn")
    ?.addEventListener(
        "click",
        savePendingMedia
    );
    
    
  
document
    .getElementById("discardMediaBtn")
    ?.addEventListener(
        "click",
        discardPendingMedia
    );
    
    
    


async function loadArticleMedia() {

    const grid =
        document.getElementById(
            "articleMediaGrid"
        );

    grid.innerHTML = "Loading...";

    const type =
        document.getElementById(
            "articleMediaType"
        )?.value || "images";

    const scope =
        document.getElementById(
            "articleMediaScope"
        )?.value || "current";

    try {

        const json =
            await window.api(

                `${window.API.ARTICLE_ASSETS}/${window.currentArticle}` +
                `?type=${encodeURIComponent(type)}` +
                `&scope=${encodeURIComponent(scope)}`

            );

        if (!json.success) {

            throw new Error(
                json.message ||
                "Unable to load media."
            );

        }

        articleMedia =
            json.files || [];
            
        updateUnsavedMediaBar();

        filterArticleMedia();

    }
    catch (err) {

        console.error(err);

        articleMedia = [];

        grid.innerHTML = `
            <div class="empty-state">
                <div>⚠️</div>
                <h3>Unable to load media</h3>
                <p>${err.message || "Please try again."}</p>
            </div>
        `;

    }

}





async function toggleArticleMediaShare(id){

    const json =
        await window.api(

            `${window.API.ARTICLE_ASSETS}/share/${id}`,

            {
                method:"PATCH"
            }

        );

    if (!json.success) {
        throw new Error(json.message || "Unable to update sharing.");
    }

    return json;

}







async function openMoveArticleModal() {

    selectedMoveArticle = null;

    document.getElementById("moveArticleSearch").value = "";

    document.getElementById("confirmMoveArticle").disabled = true;

    // Make sure the article list is available
    if (!articles.length) {
        await loadArticles();
    }

    renderMoveArticleList(articles);

    const modal =
        document.getElementById("moveArticleModal");

    modal.classList.remove("hidden");
    modal.classList.add("open");

    document.body.classList.add("modal-open");

}



function closeMoveArticleModal() {

    selectedMoveArticle = null;

    document
        .getElementById("moveArticleSearch")
        .value = "";

    document
        .getElementById("confirmMoveArticle")
        .disabled = true;

    document
        .querySelectorAll(".article-picker-item.active")
        .forEach(item =>
            item.classList.remove("active")
        );

    const modal =
        document.getElementById("moveArticleModal");

    modal.classList.remove("open");
    modal.classList.add("hidden");

    document.body.classList.remove("modal-open");

}




function renderMoveArticleList(list) {

    const container =
        document.getElementById("moveArticleList");

    container.innerHTML = list.map(article => `

        <button
            type="button"
            class="article-picker-item"
            data-article="${article.article}"
        >

            <strong>
                ${article.title}
            </strong>

            <small>
                ${article.article}
            </small>

        </button>

    `).join("");

    container
        .querySelectorAll(".article-picker-item")
        .forEach(item => {

            item.addEventListener("click", () => {

                container
                    .querySelectorAll(".article-picker-item")
                    .forEach(btn =>
                        btn.classList.remove("active")
                    );

                item.classList.add("active");

                selectedMoveArticle =
                    item.dataset.article;

                document
                    .getElementById("confirmMoveArticle")
                    .disabled = false;

            });

        });

}








async function deleteArticleMedia(media) {

    let url;


    if (media.temporary) {

        url =
        `${window.API.ARTICLE_ASSETS}/temp/${window.currentArticle}/${encodeURIComponent(media.filename)}`;

    }
    else {

        url =
        `${window.API.ARTICLE_ASSETS}/${media.id}`;

    }


    const json =
        await window.api(
            url,
            {
                method:"DELETE"
            }
        );


    if(!json.success){

        throw new Error(
            json.message || "Unable to delete media."
        );

    }

    return json;

}





async function uploadArticleMedia(e){

    const files=[...e.target.files];

    if(!files.length)
        return;

    window.showToast(
        "Adding media...",
        "loading"
    );

    const form = new FormData();

    form.append(
        "type",
        document.getElementById(
            "articleMediaType"
        ).value
    );

    form.append(
        "scope",
        document.getElementById(
            "articleMediaScope"
        ).value
    );

    

    files.forEach(file=>
        form.append("files",file)
    );

    const progress=
        document.getElementById(
            "articleUploadProgress"
        );

    const bar=
        document.getElementById(
            "articleUploadProgressBar"
        );

    const text=
        document.getElementById(
            "articleUploadProgressText"
        );

    progress.classList.remove(
        "hidden"
    );

    bar.style.width="0%";

    text.textContent="Adding...";

    const xhr=new XMLHttpRequest();

    xhr.open(

        "POST",

        `${window.API.ARTICLE_ASSETS}/${window.currentArticle}`

    );

    xhr.withCredentials=true;

    xhr.upload.onprogress=e=>{

        if(!e.lengthComputable)
            return;

        const percent=Math.round(

            e.loaded/e.total*100

        );

        bar.style.width=
            percent+"%";

        text.textContent=
            `Adding... ${percent}%`;

    };

    xhr.onload=async()=>{

        progress.classList.add(
            "hidden"
        );

        e.target.value="";

        try{

            const json=
                JSON.parse(
                    xhr.responseText
                );

            if(!json.success){

                throw new Error(
                    json.message
                );

            }

            await loadArticleMedia();

            window.showToast(
                "Media added. Save to commit.",
                "success"
            );            

        }
        catch(err){

            window.showToast(
                err.message,
                "error"
            );

        }

    };

    xhr.onerror=()=>{

        progress.classList.add(
            "hidden"
        );

        window.showToast(
            "Upload failed.",
            "error"
        );

    };

    xhr.send(form);

}




async function savePendingMedia(){

    try{

        window.showToast(
            "Uploading to storage...",
            "loading"
        );


        const scope =
            document.getElementById(
                "articleMediaScope"
            ).value;


        const response =
            await fetch(
                `${window.API.ARTICLES}/${window.currentArticle}/media/save`,
                {
                    method:"POST",

                    headers:{
                        "Content-Type":"application/json"
                    },

                    body:JSON.stringify({
                        scope
                    })
                }
            );


        const reader =
            response.body.getReader();


        const decoder =
            new TextDecoder();


        let json = null;

        let buffer = "";

        while(true){

            const {
                done,
                value
            } =
                await reader.read();


            if(done)
                break;


            buffer += decoder.decode(
                value,
                {
                    stream:true
                }
            );


            const lines =
                buffer.split("\n\n");

            buffer =
                lines.pop();
                

            for(const line of lines){

                if(!line.startsWith("data:"))
                    continue;

        
                const data =
                    JSON.parse(
                        line.replace(
                            "data:",
                            ""
                        )
                    );



                // progress event
                if(!data.success){

                    const progress =
                        document.getElementById(
                    "articleUploadProgress"
                        );


                    const bar =
                        document.getElementById(
                    "articleUploadProgressBar"
                        );


                    const text =
                        document.getElementById(
                    "articleUploadProgressText"
                        );


                    progress?.classList.remove(
                        "hidden"
                    );


                    const percent =
                        data.overall ??
                        data.percent ??
                        0;


                    if(bar)
                        bar.style.width =
                            percent + "%";


                    if(text){

                        if(data.current && data.total){

                            text.textContent =
                                `Uploading image ${data.current}/${data.total} ${percent}%`;

                        }
                        else{

                            text.textContent =
                                `Uploading ${data.filename || ""} ${percent}%`;

                        }

                    }

                }


                // final response
                else{

                    json = data;

                }

            }

        }


        if(!json.success){

            throw new Error(
                json.message ||
                "Unable to save media."
            );

        }


        let markdown =
            document.getElementById(
                "articleEditor"
            ).value;


        let updatedHero =
            document.getElementById(
                "metaHero"
            ).value;



        for(const asset of json.uploaded){

            const temp =
                `/temp/article-assets/${window.currentArticle}/${asset.filename}`;


            const url =
                asset.url;



            // Replace image links in markdown

            markdown =
                markdown.replaceAll(
                    temp,
                    url
                );



            // Replace hero if it was temporary

            if(updatedHero === temp){

                updatedHero = url;

            }

        }



        // Update editor

        document.getElementById(
            "articleEditor"
        ).value = markdown;

        
        pushUndoState("Insert Media");
        
        handleEditorChange();


        // Update hero field

        document.getElementById(
            "metaHero"
        ).value = updatedHero;



        // Update hero preview

        updateHeroPreview(
            updatedHero
        );



        await loadArticleMedia();


        const progress =
            document.getElementById(
                "articleUploadProgress"
            );

        const bar =
            document.getElementById(
                "articleUploadProgressBar"
            );

        const text =
            document.getElementById(
                "articleUploadProgressText"
            );

        progress?.classList.add(
            "hidden"
        );

        if(bar)
            bar.style.width = "0%";

        if(text)
            text.textContent = "";



        window.showToast(
            "Media saved.",
            "success"
        );


    }
    catch(err){

        document.getElementById(
            "articleUploadProgress"
        )?.classList.add(
            "hidden"
        );

        console.error(err);

        window.showToast(
            err.message,
            "error"
        );

    }

}




async function discardPendingMedia(){

    try{

        const ok =
            confirm(
                "Discard uploaded media?"
            );


        if(!ok)
            return;


        window.showToast(
            "Discarding media...",
            "loading"
        );


        const json =
            await window.api(

                `${window.API.ARTICLES}/${window.currentArticle}/media/temp`,

                {
                    method:"DELETE"
                }

            );


        if(!json.success){

            throw new Error(
                json.message ||
                "Unable to discard media."
            );

        }


        await loadArticleMedia();


        updateUnsavedMediaBar();


        window.showToast(
            "Media discarded.",
            "success"
        );


    }
    catch(err){

        console.error(err);


        window.showToast(
            err.message,
            "error"
        );

    }

}


function renderArticleMedia(files) {

    const grid =
        document.getElementById(
            "articleMediaGrid"
        );

    const scope =
        document
            .getElementById(
                "articleMediaScope"
            )
            .value;

    const mediaType =
        document
            .getElementById(
                "articleMediaType"
            )
            .value;

    const labels = {

        images: ["Image", "Images"],

        files: ["File", "Files"]

    };

    const [singular, plural] =
        labels[mediaType] || ["Item", "Items"];


    
    // Toggle grouped layout
    grid.classList.toggle(
        "grouped",
        scope === "everything"
    );

    // Empty state
    if (!files.length) {

        grid.innerHTML = `

<div class="empty-state">

    <div>🖼</div>

    <h3>No Media</h3>

    <p>
        Upload your first article image.
    </p>

</div>

`;

        return;

    }

    // ==========================================
    // Everything (Grouped)
    // ==========================================

    if (scope === "everything") {

        const groups = [];

        const groupMap = new Map();


        files.forEach(file => {

            let key;

            if (file.temporary) {

                key = "__temp__";

            }
            else if (file.scope === "shared") {

                key = "__shared__";

            }
            else {

                key = file.article;

            }


            let group =
                groupMap.get(key);

            if (!group) {

                let title;

                if (key === "__temp__") {

                    title = "📝 Unsaved";

                }
                else if (key === "__shared__") {

                    title = "📁 Shared Library";

                }
                else {

                    const article =
                        articles.find(

                            a => a.article === key

                        );

                    title =
                        `📄 ${article?.title || key}`;

                }


                group = {

                    key,

                    title,

                    files: []

                };

                groupMap.set(
                    key,
                    group
                );

                groups.push(group);

            }

            group.files.push(file);

        });


        grid.innerHTML = groups.map(group => `

<div class="media-group">

    <div class="media-group-header">

        <h3 class="media-section-title">

            ${group.title}

        </h3>

        <span class="media-group-count">

            ${group.files.length}
            ${group.files.length === 1 ? singular : plural}

        </span>

    </div>

    <div class="media-group-grid">

        ${renderMediaCards(group.files)}

    </div>

</div>

`).join("");

        return;

    }


    // ==========================================
    // Current / Shared
    // ==========================================

    grid.innerHTML =
        renderMediaCards(files);

}



function renderMediaCards(files) {

    const hero =
        document.getElementById("metaHero")?.value || "";

    return files.map(file => {

        const isHero =
            hero === file.url;

        const extension =
            (file.filename.split(".").pop() || "")
                .toUpperCase();



        const badges = [];

        if (file.scope === "shared") {

            badges.push(`
                <span class="media-badge shared">
                    <i class="bi bi-globe2"></i>
                    Shared
                </span>
            `);

        }

        if (file.temporary) {

            badges.push(`
                <span class="media-badge temp">
                    <i class="bi bi-pencil-square"></i>
                    Unsaved
                </span>
            `);

        }

        if (isHero) {

            badges.push(`
                <span class="media-badge hero">
                    ⭐ Hero
                </span>
            `);

        }

        const badgeHtml = badges.length
            ? `
                <div class="article-media-top">
                    <div class="article-media-badges">
                        ${badges.join("")}
                    </div>
                </div>
              `
            : "";


        

        const hasBadges = badges.length > 0;


        return `

<div class="article-media-card ${hasBadges ? "has-badges" : "no-badges"}">

    ${badgeHtml}

    <div class="article-media-thumb">

        <img
            class="article-media-image"
            src="${file.thumbnailUrl}"
            data-full="${file.url}"
            loading="lazy"
            decoding="async"
            fetchpriority="low"

            draggable="false"
            ondblclick="this.closest('.article-media-card').querySelector('.media-insert').click()"
        >

        <span class="article-media-type ${extension.toLowerCase()}">
            ${extension}
        </span>

    </div>


    <div class="article-media-info">

        <strong
            class="article-media-name"
            title="${file.filename}"
        >
            ${file.filename}
        </strong>

        <small class="article-media-meta">

            ${formatBytes(file.size)}
            
            ${file.createdAt
                ? ` • ${formatRelativeDate(file.createdAt)}`
                : ""}

        </small>

    </div>


    <div class="article-media-actions">

        <button
            class="btn media-insert"
            data-url="${file.url}"
            data-name="${file.filename}"
        >
            📝 Insert
        </button>

        <button
            class="btn btn-icon article-media-menu"
            data-menu="articleMediaMenu"

            data-id="${file.id || ""}"
            data-url="${file.url}"
            data-name="${file.filename}"
            data-filename="${file.filename}"
            data-temp="${file.temporary}"
            data-scope="${file.scope}"
            data-original-article="${file.originalArticle || ""}"

            data-tooltip="More actions"
        >
            <i class="bi bi-three-dots"></i>
        </button>

    </div>

</div>

`;

    }).join("");

}





























const globalActionMenu =
    document.getElementById(
        "globalActionMenu"
    );




const GLOBAL_ACTION_MENUS = {


    articleMediaMenu: {

        actions: [

            {
                action: "setMediaHero",
                icon: "bi-star",
                label: "Set Hero"
            },

            {
                action: "shareMedia",
                icon: "bi-globe",
                label: "Share Library",
                labelClass: "share-label"
            },

            {
                action: "copyMediaUrl",
                icon: "bi-link-45deg",
                label: "Copy URL"
            },

            {
                action: "copyMediaMarkdown",
                icon: "bi-markdown",
                label: "Copy Markdown"
            },

            {
                separator: true
            },

            {
                action: "deleteMedia",
                icon: "bi-trash",
                label: "Delete",
                danger: true
            }

        ],

        position: "media"

    },



    articleHistoryMenu: {

        actions: [

            {
                action: "restore",
                icon: "bi-arrow-counterclockwise",
                label: "Restore"
            },

            {
                action: "delete",
                icon: "bi-trash",
                label: "Delete Version",
                danger: true
            }

        ],

        position: "version"

    },


    historyHeaderMenu: {

        actions: [

            {
                action: "delete-old",
                icon: "bi-clock-history",
                label: "Delete Old Versions"
            },

            {
                action: "clear-history",
                icon: "bi-trash",
                label: "Clear History",
                danger: true
            }

        ],

        position: "header"

    },


    galleryAlbumMenu: {

        actions: [

            {
                action: "open",
                icon: "bi-folder2-open",
                label: "Open"
            },

            {
                action: "rename",
                icon: "bi-pencil",
                label: "Rename"
            },

            {
                action: "detailsAlbum",
                icon: "bi-info-circle",
                label: "Details"
            },

            {
                action: "deleteAlbum",
                icon: "bi-trash",
                label: "Delete",
                danger: true
            }

        ]

    },
    
    
    galleryImageMenu: {

        actions: [

            {
                action:"viewImage",
                icon: "bi-eye",
                label: "View"
            },

            {
                action: "detailsImage",
                icon: "bi-info-circle",
                label: "Details"
            },

            {
                action: "moveImage",
                icon: "bi-folder-symlink",
                label: "Move"
            },

            {
                action:"deleteImage",
                icon: "bi-trash",
                label: "Delete",
                danger: true
            }

        ]

    }




};






function renderGlobalActionMenu(
    menuType
){

    const config =
        GLOBAL_ACTION_MENUS[
            menuType
        ];

    if (!config)
        return false;


    globalActionMenu.innerHTML =
        config.actions
            .map(item => {

                if (item.separator) {

                    return `
                        <hr>
                    `;

                }

                return `
                    <button
                        type="button"
                        data-action="${item.action}"
                        ${item.danger
                            ? 'class="danger"'
                            : ""
                        }
                    >
    
                        <i
                            class="bi ${item.icon}"
                        ></i>
    
                        <span
                            ${item.labelClass
                                ? `class="${item.labelClass}"`
                                : ""
                            }
                        >
                            ${item.label}
                        </span>
    
                    </button>
                `;

            })
            .join("");


    return true;

}




// ==================================
// CLOSE GLOBAL ACTION MENU
// ==================================

function closeGlobalActionMenu(){

    if(!globalActionMenu)
        return;


    globalActionMenu.classList.add(
        "hidden"
    );


    globalActionMenu.innerHTML = "";


    globalActionMenu.removeAttribute(
        "data-menu"
    );


    globalActionMenu.removeAttribute(
        "data-image"
    );


    globalActionMenu.removeAttribute(
        "data-album"
    );


    globalActionMenu.removeAttribute(
        "data-url"
    );


    document
        .querySelectorAll(
            "[data-menu].active"
        )
        .forEach(button =>
            button.classList.remove(
                "active"
            )
        );


    currentHistoryVersion = null;
    currentGalleryAlbum = null;
    currentMediaCard = null;

}


window.closeGlobalActionMenu =
    closeGlobalActionMenu;



document.addEventListener(
    "click",
    e => {

        if (!globalActionMenu)
            return;


        // ==================================
        // GLOBAL MENU TRIGGER
        // ==================================

        const trigger =
            e.target.closest(
                "[data-menu]"
            );


        // ==================================
        // OPEN
        // ==================================

        if (trigger) {

            const menuType =
                trigger.dataset.menu;


            const config =
                GLOBAL_ACTION_MENUS[
                    menuType
                ];


            if (!config)
                return;


            e.preventDefault();
            e.stopPropagation();


            // ==================================
            // HISTORY VERSION
            // ==================================

            if (
                menuType ===
                "articleHistoryMenu"
            ){

                currentHistoryVersion =
                    trigger.dataset.version;

            }




            // ==================================
            // GALLERY ALBUM
            // ==================================

            if (
                menuType ===
                "galleryAlbumMenu"
            ){

                currentGalleryAlbum =
                    trigger.dataset.album;

            }




            // ==================================
            // ARTICLE MEDIA
            // ==================================

            if (
                menuType ===
                "articleMediaMenu"
            ){

                currentMediaCard = {

                    id:
                        trigger.dataset.id ||
                        null,

                    filename:
                        trigger.dataset.filename,

                    url:
                        trigger.dataset.url,

                    name:
                        trigger.dataset.name,

                    scope:
                        trigger.dataset.scope,

                    originalArticle:
                        trigger.dataset.originalArticle ||
                        null,

                    temporary:
                        trigger.dataset.temp === "true"

                };

            }




            // ==================================
            // GALLERY IMAGE
            // ==================================

            if (
                menuType ===
                "galleryImageMenu"
            ){

                globalActionMenu.dataset.image =
                    trigger.dataset.image;


                globalActionMenu.dataset.album =
                    trigger.dataset.album;


                globalActionMenu.dataset.url =
                    trigger
                        .closest(".image-item")
                        ?.dataset.url
                        || "";

            }

            // ==================================
            // ACTIVE TRIGGER
            // ==================================

            document
                .querySelectorAll(
                    "[data-menu].active"
                )
                .forEach(button =>
                    button.classList.remove(
                        "active"
                    )
                );


            trigger.classList.add(
                "active"
            );

            

            // ==================================
            // STORE ACTIVE MENU TYPE
            // ==================================

            globalActionMenu.dataset.menu =
                menuType;



            // ==================================
            // BUILD MENU
            // ==================================

            renderGlobalActionMenu(
                menuType
            );




            // ==================================
            // ARTICLE MEDIA DYNAMIC LABEL
            // ==================================

            if (
                menuType ===
                "articleMediaMenu"
            ){

                const shareButton =
                    globalActionMenu.querySelector(
                        '[data-action="shareMedia"]'
                    );

                const shareLabel =
                    shareButton?.querySelector(
                        ".share-label"
                    );

                if (shareLabel) {

                    if (
                        currentMediaCard.scope !==
                        "shared"
                    ){
            
                        shareLabel.textContent =
                            "Share Library";
            
                    }
            
                    else if (
                        currentMediaCard.originalArticle
                    ){
            
                        shareLabel.textContent =
                            "Remove from Shared";
            
                    }
            
                    else {
            
                        shareLabel.textContent =
                            "Move to Article";
            
                    }
            
                }

            }




            // ==================================
            // POSITION
            // ==================================

            const rect =
                trigger.getBoundingClientRect();


// ==================================
// ATTACHED MENU POSITIONING
// ==================================

const container =
    menuType === "articleMediaMenu"

        ? document.querySelector(
            ".article-media-modal"
        )

        : document.querySelector(
            ".main-content"
        );

if (!container)
    return;

const containerRect =
    container.getBoundingClientRect();


// ==================================
// SHOW MENU
// ==================================

globalActionMenu.classList.remove(
    "hidden"
);


// ==================================
// MEASURE
// ==================================

const menuWidth =
    globalActionMenu.offsetWidth;

const menuHeight =
    globalActionMenu.offsetHeight;

const GAP = 8;
const MARGIN = 12;


// ==========================================================
// ARTICLE MEDIA
// Calculate against MODAL,
// then convert viewport coordinates to the
// actual absolute-positioning parent.
// ==========================================================

if (
    menuType ===
    "articleMediaMenu"
){

    const parent =
        globalActionMenu.offsetParent;

    if (!parent)
        return;

    const parentRect =
        parent.getBoundingClientRect();

    const parentScrollLeft =
        parent.scrollLeft || 0;

    const parentScrollTop =
        parent.scrollTop || 0;


    // ==================================
    // AVAILABLE SPACE INSIDE MODAL
    // ==================================

    const leftSpace =
        rect.left -
        containerRect.left;

    const rightSpace =
        containerRect.right -
        rect.right;


    const canOpenRight =
        rightSpace >=
        menuWidth +
        GAP +
        MARGIN;

    const canOpenLeft =
        leftSpace >=
        menuWidth +
        GAP +
        MARGIN;


    // ==================================
    // HORIZONTAL — VIEWPORT COORDINATE
    // ==================================

    let viewportLeft;


    if (canOpenRight) {

        viewportLeft =
            rect.right +
            GAP;

    }

    else if (canOpenLeft) {

        viewportLeft =
            rect.left -
            menuWidth -
            GAP;

    }

    else {

        viewportLeft =
            rightSpace >= leftSpace

                ? rect.right + GAP

                : rect.left -
                  menuWidth -
                  GAP;

    }


    // ==================================
    // CLAMP INSIDE MODAL
    // ==================================

    viewportLeft =
        Math.max(

            containerRect.left +
            MARGIN,

            Math.min(

                viewportLeft,

                containerRect.right -
                menuWidth -
                MARGIN

            )

        );


    // ==================================
    // VERTICAL — VIEWPORT COORDINATE
    // ==================================

    let viewportTop =
        rect.top +
        (
            rect.height -
            menuHeight
        ) / 2;


    // ==================================
    // CLAMP INSIDE MODAL
    // ==================================

    viewportTop =
        Math.max(

            containerRect.top +
            MARGIN,

            Math.min(

                viewportTop,

                containerRect.bottom -
                menuHeight -
                MARGIN

            )

        );


    // ==================================
    // CONVERT VIEWPORT → ABSOLUTE PARENT
    // ==================================

    const left =
        viewportLeft -
        parentRect.left +
        parentScrollLeft;


    const top =
        viewportTop -
        parentRect.top +
        parentScrollTop;


    // ==================================
    // DIRECTION
    // ==================================

    globalActionMenu.classList.remove(
        "menu-left",
        "menu-right"
    );


    if (
        viewportLeft <
        rect.left
    ){

        globalActionMenu.classList.add(
            "menu-left"
        );

    }
    else {

        globalActionMenu.classList.add(
            "menu-right"
        );

    }


    // ==================================
    // ARROW
    // ==================================

    const arrowTop =
        rect.top +
        rect.height / 2 -
        viewportTop;


    globalActionMenu.style.setProperty(

        "--arrow-top",

        `${Math.round(arrowTop)}px`

    );


    // ==================================
    // APPLY
    // ==================================

    globalActionMenu.style.left =
        `${Math.round(left)}px`;

    globalActionMenu.style.top =
        `${Math.round(top)}px`;


    return;

}


// ==========================================================
// NORMAL GLOBAL MENUS
// Position directly from the clicked 3-dot button
// ==========================================================

const parent =
    globalActionMenu.offsetParent;

if (!parent)
    return;

const parentRect =
    parent.getBoundingClientRect();

const parentScrollLeft =
    parent.scrollLeft || 0;

const parentScrollTop =
    parent.scrollTop || 0;


// ==================================
// VIEWPORT POSITION
// ==================================

let viewportLeft;
let viewportTop;


// ==================================
// HORIZONTAL
// ==================================

const spaceRight =
    window.innerWidth -
    rect.right;

const spaceLeft =
    rect.left;


if (
    spaceRight >=
    menuWidth +
    GAP +
    MARGIN
){

    // Open to the RIGHT of 3-dot
    viewportLeft =
        rect.right +
        GAP;

}
else {

    // Open to the LEFT of 3-dot
    viewportLeft =
        rect.left -
        menuWidth -
        GAP;

}


// ==================================
// VERTICAL
// ==================================
//
// SAME BEHAVIOUR FOR EVERY 3-DOT MENU
//
// 1. Normally center the menu on the button
// 2. If it would overflow bottom,
//    move it upward while keeping it ATTACHED
// 3. If it would overflow top,
//    move it downward while keeping it ATTACHED
//
// NO special "header" dropdown positioning.
// ==================================

viewportTop =
    rect.top +
    (
        rect.height -
        menuHeight
    ) / 2;


// ==================================
// CONVERT VIEWPORT → MENU PARENT
// ==================================

let left =
    viewportLeft -
    parentRect.left +
    parentScrollLeft;

let top =
    viewportTop -
    parentRect.top +
    parentScrollTop;


// ==================================
// DIRECTION
// ==================================

globalActionMenu.classList.remove(
    "menu-left",
    "menu-right"
);


if (
    viewportLeft <
    rect.left
){

    globalActionMenu.classList.add(
        "menu-left"
    );

}
else {

    globalActionMenu.classList.add(
        "menu-right"
    );

}


// ==================================
// ARROW
// ==================================

const arrowTop =
    rect.top +
    rect.height / 2 -
    viewportTop;


globalActionMenu.style.setProperty(
    "--arrow-top",
    `${Math.round(arrowTop)}px`
);


// ==================================
// APPLY
// ==================================

globalActionMenu.style.left =
    `${Math.round(left)}px`;

globalActionMenu.style.top =
    `${Math.round(top)}px`;

return;

        }


        // ==================================
        // CLICK INSIDE GLOBAL MENU
        // ==================================

        if (
            e.target.closest(
                "#globalActionMenu"
            )
        ){

            return;

        }


        // ==================================
        // CLOSE
        // ==================================

        document
            .querySelectorAll(
                "[data-menu].active"
            )
            .forEach(button =>
                button.classList.remove(
                    "active"
                )
            );


        globalActionMenu.classList.add(
            "hidden"
        );

    }
);






// ===========================
// Restore History Version
// ===========================

async function restoreHistoryVersion(version){

    if (!version)
        return;

    if (
        !confirm(
            "Restore this version?"
        )
    ){
        return;
    }

    try{

        const json =
            await window.api(

                `${window.API.ARTICLES}/${window.currentArticle}/history/${version}/restore`,

                {
                    method: "POST"
                }

            );

        if (!json.success){

            throw new Error(
                json.message
            );

        }

        await editArticle(
            window.currentArticle
        );

        window.showToast(
            "Version restored.",
            "success"
        );

    }

    catch(err){

        console.error(err);

        window.showToast(
            err.message,
            "error"
        );

    }

}






// ===========================
// Delete History Version
// ===========================

async function deleteHistoryVersion(version){

    if(!version)
        return;

    const ok = confirm(

        `Delete version ${version}?\n\n` +

        "This cannot be undone."

    );

    if(!ok)
        return;

    try{

        window.showToast(

            "Deleting version...",

            "loading"

        );

        const json =
            await window.api(

                `${window.API.ARTICLES}/${
                    window.currentArticle
                }/history/${encodeURIComponent(version)}`,

                {
                    method:"DELETE"
                }

            );

        if(!json.success){

            throw new Error(

                json.message ||

                "Unable to delete version."

            );

        }

        window.showToast(

            "History version deleted.",

            "success"

        );

        currentHistoryVersion = null;

        await loadArticleHistory();

    }

    catch(err){

        console.error(err);

        window.showToast(

            err.message,

            "error"

        );

    }

}






/* Delete Header Function */

// ===========================
// Delete Old History
// ===========================

async function deleteOldHistory(){

    const ok = confirm(

        "Delete old history versions?\n\n" +

        "The latest 20 versions will be kept."

    );

    if(!ok)
        return;

    try{

        window.showToast(

            "Deleting old history...",

            "loading"

        );

        const json =
            await window.api(

                `${window.API.ARTICLES}/${
                    window.currentArticle
                }/history/old`,

                {
                    method:"DELETE"
                }

            );

        if(!json.success){

            throw new Error(

                json.message ||

                "Unable to delete old history."

            );

        }

        window.showToast(

            json.message,

            "success"

        );

        await loadArticleHistory();

    }

    catch(err){

        console.error(err);

        window.showToast(

            err.message,

            "error"

        );

    }

}




// ===========================
// Clear History
// ===========================

async function clearHistory(){

    const ok = confirm(

        "Clear history?\n\n" +

        "The newest version will be kept."

    );

    if(!ok)
        return;

    try{

        window.showToast(

            "Clearing history...",

            "loading"

        );

        const json =
            await window.api(

                `${window.API.ARTICLES}/${
                    window.currentArticle
                }/history/clear`,

                {
                    method:"DELETE"
                }

            );

        if(!json.success){

            throw new Error(

                json.message ||

                "Unable to clear history."

            );

        }

        window.showToast(

            json.message,

            "success"

        );

        await loadArticleHistory();

    }

    catch(err){

        console.error(err);

        window.showToast(

            err.message,

            "error"

        );

    }

}


// ===========================
// History Context Menu
// ===========================

globalActionMenu?.addEventListener(
    "click",
    async e => {

        const button =
            e.target.closest(
                "button"
            );


        if (!button)
            return;

        const menuType =
            globalActionMenu.dataset.menu;



        switch (
            button.dataset.action
        ){

            


            // =========================
            // ARTICLE MEDIA
            // =========================

            case "setMediaHero":
            {
                const media =
                    currentMediaCard;

                closeGlobalActionMenu();

                if (!media)
                    break;

                document
                    .getElementById(
                        "metaHero"
                    )
                    .value =
                        media.url;
            
                updateHeroPreview(
                    media.url
                );



                notifyHeroChanged();


            
                articleDirty = true;
                draftDirty = true;
            
                scheduleAutosave();
            
                updateArticleStats();
                updateWritingInsights();
                updateSeoScore();
                updateArticleToc();
            
                filterArticleMedia();
            
                window.showToast(
                    "Hero image updated.",
                    "success"
                );
            
                break;
            }


            case "shareMedia":
            {
                const media =
                    currentMediaCard;

                if (!media)
                    break;
            
                // Move shared asset to article
                if (
                    media.scope === "shared"
                    &&
                    !media.originalArticle
                ){
            
                    closeGlobalActionMenu();

                    openMoveArticleModal();

                    break;
                }


                try {

                    const removing =
                        media.scope === "shared";

                    closeGlobalActionMenu();

                    window.showToast(
                        removing
                            ? "Removing from Shared..."
                            : "Adding to Shared...",
                        "loading"
                    );
            
                    const result =
                        await toggleArticleMediaShare(
                            media.id
                        );

                    await loadArticleMedia();

                    window.showToast(
                        result.scope === "shared"
                            ? "Added to Shared."
                            : "Removed from Shared.",
                        "success"
                    );

                }
                catch (err) {

                    window.showToast(
                        err.message,
                        "error"
                    );

                }

                break;
            }


            case "copyMediaUrl":
            {
                const media =
                    currentMediaCard;

                closeGlobalActionMenu();

                if (!media)
                    break;

                try {

                    await navigator.clipboard.writeText(
                        media.url
                    );

                    window.showToast(
                        "URL copied.",
                        "success"
                    );

                }
                catch {

                    window.showToast(
                        "Unable to copy.",
                        "error"
                    );

                }

                break;
            }


            case "copyMediaMarkdown":
            {
                const media =
                    currentMediaCard;

                closeGlobalActionMenu();

                if (!media)
                    break;

                try {

                    await navigator.clipboard.writeText(
                        `![${media.name}](${media.url})`
                    );

                    window.showToast(
                        "Markdown copied.",
                        "success"
                    );

                }
                catch {

                    window.showToast(
                        "Unable to copy.",
                        "error"
                    );

                }

                break;
            }


            case "deleteMedia":
            {
                const media =
                    currentMediaCard;

                if (!media)
                    break;

                if (
                    !confirm(
                        "Delete this image?"
                    )
                ){
                    break;
                }
            
                try {

                    closeGlobalActionMenu();

                    window.showToast(
                        "Deleting media...",
                        "loading"
                    );

                    await deleteArticleMedia(
                        media
                    );

                    await loadArticleMedia();

                    window.showToast(
                        "Media deleted.",
                        "success"
                    );

                }
                catch (err) {

                    window.showToast(
                        err.message,
                        "error"
                    );

                }

                break;
            }




            // =========================
            // ARTICLE HISTORY
            // =========================

            case "restore":
            {

                const version =
                    currentHistoryVersion;


                closeGlobalActionMenu();


                await restoreHistoryVersion(
                    version
                );


                break;
            }
                

        /* Single History Delete */

            case "delete":
            {

                const version =
                    currentHistoryVersion;


                closeGlobalActionMenu();


                await deleteHistoryVersion(
                    version
                );


                break;
            }

            /* History Other Delete Case */

            case "delete-old":
              
                closeGlobalActionMenu();

                await deleteOldHistory();

                break;


            case "clear-history":
              
                closeGlobalActionMenu();

                await clearHistory();

                break;



            // =========================
            // GALLERY ALBUM
            // =========================


            case "open":
            {

                const album =
                    currentGalleryAlbum;


                closeGlobalActionMenu();


                state.selectedAlbum =
                    album;


                imagesOrigin =
                    "album";


                populateAlbumFilter();


                showPage(
                    "images"
                );


                filterImages();

                updateImagesHeader();


                break;
            }




            case "rename":
            {

                const album =
                    currentGalleryAlbum;


                closeGlobalActionMenu();


                await renameAlbum(
                    album
                );


                break;
            }


            case "detailsAlbum":
            {

                const albumName =
                    currentGalleryAlbum;


                const album =
                    state.albums.find(
                        album =>
                            album.name === albumName
                    );


                closeGlobalActionMenu();


                if(album){

                    showAlbumInfo(
                        album
                    );

                }


                break;
            }
            
            
            
            case "deleteAlbum":
            {

                const album =
                    currentGalleryAlbum;


                closeGlobalActionMenu();


                await deleteAlbum(
                    album
                );


                break;
            }
            
            
            // =========================
            // GALLERY IMAGE
            // =========================


            case "viewImage":

                const url =
                    globalActionMenu.dataset.url;

                closeGlobalActionMenu();

                viewImage(url);

            break;



            case "detailsImage":
            {

                const album =
                    globalActionMenu.dataset.album;

                const filename =
                    globalActionMenu.dataset.image;


                const image =
                    state.allImages.find(
                        image =>
                            image.album === album &&
                            image.filename === filename
                    );


                closeGlobalActionMenu();


                if(image){

                    showImageInfo(
                        image
                    );

                }


                break;
            }



            case "moveImage":
            {

                const album =
                    globalActionMenu.dataset.album;

                const filename =
                    globalActionMenu.dataset.image;


                closeGlobalActionMenu();


                state.selectedImages = [
                    {
                        album,
                        filename
                    }
                ];


                showMoveModal();


                break;
            }
                
                
            case "deleteImage":

               const album =
                   globalActionMenu.dataset.album;

               const image =
                   globalActionMenu.dataset.image;


               closeGlobalActionMenu();


               await deleteImage(
                   album,
                   image
               );

               break;


        }


        // ==================================
        // CLOSE GLOBAL MENU
        // ==================================

        

    }
);





function filterArticleMedia() {

    const query =
        document
            .getElementById(
                "articleMediaSearch"
            )
            .value
            .trim()
            .toLowerCase();

    const sort =
        document
            .getElementById(
                "articleMediaSort"
            )
            ?.value || "newest";

    let files = [...articleMedia];

    // ----------------------------------
    // Search
    // ----------------------------------

    if (query) {

        files = files.filter(file =>

            file.filename
                .toLowerCase()
                .includes(query)

        );

    }

    // ----------------------------------
    // Article title lookup
    // ----------------------------------

    const articleTitles = Object.fromEntries(

        articles.map(article => [

            article.article,

            article.title || article.article

        ])

    );

    // ----------------------------------
    // Sort
    // ----------------------------------

    switch (sort) {

        case "oldest":

            files.sort((a, b) =>

                (a.createdAt || a.created || 0) -

                (b.createdAt || b.created || 0)

            );

            break;

        case "az":

            files.sort((a, b) =>

                (articleTitles[a.article] || a.article || "")

                    .localeCompare(

                        articleTitles[b.article] || b.article || "",

                        undefined,

                        {

                            sensitivity: "base",

                            numeric: true

                        }

                    )

            );

            break;

        case "za":

            files.sort((a, b) =>

                (articleTitles[b.article] || b.article || "")

                    .localeCompare(

                        articleTitles[a.article] || a.article || "",

                        undefined,

                        {

                            sensitivity: "base",

                            numeric: true

                        }

                    )

            );

            break;

        case "newest":

        default:

            files.sort((a, b) =>

                (b.createdAt || b.created || 0) -

                (a.createdAt || a.created || 0)

            );

            break;

    }

    renderArticleMedia(files);

}





function updateHeroPreview(url){

    const preview =
        document.getElementById("heroPreview");

    const img =
        document.getElementById("heroPreviewImage");

    if(!url){

        preview.classList.remove("has-image");

        img.hidden = true;

        img.removeAttribute("src");

        return;

    }

    img.hidden = false;

    preview.classList.add("has-image");

    img.src = url;

}






function renderImagePicker(images) {

    const grid =
        document.getElementById(
            "imagePickerGrid"
        );

    const search =
        document.getElementById(
            "imagePickerSearch"
        );

    function render(list) {

        if (!list.length) {

            grid.innerHTML = `

<div class="empty-state">

    <h3>No images found</h3>

</div>

`;

            return;

        }

        grid.innerHTML =
            list.map(image => `

<div
    class="image-picker-item"
    data-url="${image.url}"
    data-name="${image.filename}"
>

    <img

        src="${image.thumb}"

        loading="lazy"

        draggable="false"

    >

    <div class="image-picker-info">

        <div class="image-picker-title">

            ${image.filename}

        </div>

        <div class="image-picker-album">

            ${image.album}

        </div>

    </div>

</div>

`).join("");

    }

    render(images);

    search.value = "";

    search.oninput = () => {

        const q =
            search.value
                .trim()
                .toLowerCase();

        render(

            images.filter(img =>

                img.filename
                    .toLowerCase()
                    .includes(q)

                ||

                img.album
                    .toLowerCase()
                    .includes(q)

            )

        );

    };

    grid.onclick = e => {

        const card =
            e.target.closest(
                ".image-picker-item"
            );

        if (!card) return;

        const editor =
            document.getElementById(
                "articleEditor"
            );



        if (
    imagePickerMode === "hero"
) {

    document
        .getElementById(
            "metaHero"
        )
        .value =
            card.dataset.url;

        updateHeroPreview(
            card.dataset.url
        );


        notifyHeroChanged();



    articleDirty = true;

    draftDirty = true;

    scheduleAutosave();


    window.showToast(
        "Hero image updated.",
        "success"
    );


    closeImagePicker();

    return;

}

        const markdown =
        `![${card.dataset.name}](${card.dataset.url})`;

        const start =
            editor.selectionStart;

        const end =
            editor.selectionEnd;

        editor.setRangeText(

            markdown,

            start,

            end,

            "end"

        );

        articleDirty = true;

        draftDirty = true;

        scheduleAutosave();

        updateArticleStats();

        updateWritingInsights();

        updateSeoScore();

        updateArticleToc();



        window.showToast(
            "Image inserted.",
            "success"
        );



        closeImagePicker();

        editor.focus();

    };

}





/* ========================================
   ARTICLE MANAGEMENT
   ====================================== */

function generateArticleSlug(title) {

    return title

        .toLowerCase()

        .trim()

        .replace(/[^a-z0-9\s-]/g, "")

        .replace(/\s+/g, "-")

        .replace(/-+/g, "-");

}



function updateSlugStatus(){

    const input =
        document.getElementById(
            "metaSlug"
        );

    const status =
        document.getElementById(
            "slugStatus"
        );

    if(!input || !status)
        return;

    const slug =
        input.value
            .trim();

    if(!slug){

        status.textContent = "";

        status.classList.remove(
            "success",
            "warning",
            "error"
        );

        return;

    }

    if(!/^[a-z0-9-]+$/.test(slug)){

        status.textContent =
            "❌ Invalid characters";

        status.classList.remove(
            "success",
            "warning",
            "error"
        );

        status.classList.add(
            "error"
        );

        return;

    }

    const reserved = [

        "admin",
        "api",
        "gallery",
        "articles",
        "login"

    ];

    if(
        reserved.includes(slug)
    ){

        status.textContent =
            "⚠ Reserved slug";

        status.classList.remove(
            "success",
            "warning",
            "error"
        );

        status.classList.add(
            "warning"
        );

        return;

    }

    const duplicate =
        articles.some(article =>

            article.article === slug &&

            article.article !==
            window.currentArticle

        );

    if(duplicate){

        status.textContent =
            "❌ Slug already exists";

        status.classList.remove(
            "success",
            "warning",
            "error"
        );

        status.classList.add(
            "error"
        );

        return;

    }

    status.textContent =
        "✓ Slug available";

    status.classList.remove(
        "success",
        "warning",
        "error"
    );

    status.classList.add(
        "success"
    );

}









async function createNewArticle() {

    const title =
        document
            .getElementById("newArticleTitle")
            .value
            .trim();

    const article =
        document
            .getElementById("newArticleSlug")
            .value
            .trim();

    if (!title) {

        window.showToast(
            "Please enter a title.",
            "warning"
        );

        document
            .getElementById("newArticleTitle")
            .focus();

        return;

    }

    if (!article) {
 
        window.showToast(
            "Invalid article slug.",
            "warning"
        );

        return;

    }

    try {

        window.showToast(
            "Creating article...",
            "loading"
        );

        const json =
            await window.api(

                window.API.ARTICLES,

                {

                    method: "POST",

                    body: JSON.stringify({

                        article,

                        title

                    })

                }

            );

        if (!json.success) {

            throw new Error(
                json.message
            );

        }

        closeNewArticleModal();

        await loadArticles();

        await editArticle(json.article);

        updateArticleStats();

        updateWritingInsights();

        updateSeoScore();


        const sidebar =
    document.querySelector(
        ".article-editor-sidebar"
    );

sidebar?.classList.remove(
    "collapsed"
);

const arrow =
    document.getElementById(
        "metaArrow"
    );

if (arrow) {

    arrow.className =
        "bi bi-chevron-up";

}


        window.showToast(
            "Article created successfully.",
            "success"
        );


    }
    catch (err) {

        console.error(err);

        window.showToast(
            err.message ||
            "Unable to create article.",
            "error"
        );

    }

}





async function deleteArticle(article) {

    const confirmed = confirm(
        `Delete "${article}"?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    try {

        window.showToast(
            "Deleting article...",
            "loading"
        );

        const json =
            await window.api(
                `${window.API.ARTICLES}/${article}`,
                {
                    method: "DELETE"
                }
            );

        if (!json.success) {

            throw new Error(
                json.message
            );

        }

        if (window.currentArticle === article) {

            window.currentArticle = null;

            if (await confirmDiscardChanges()) {

                showPage("articles");

            }

        }

        await loadArticles();

        window.showToast(
            "Article deleted.",
            "success"
        );

    }
    catch (err) {

        console.error(err);

        window.showToast(
            err.message ||
            "Unable to delete article.",
            "error"
        );

    }

}





async function duplicateArticle(article) {

    try {

        window.showToast(
            "Duplicating article...",
            "loading"
        );

        const json =
            await window.api(
                `${window.API.ARTICLES}/${article}/duplicate`,
                {
                    method: "POST"
                }
            );

        if (!json.success) {

            throw new Error(
                json.message
            );

        }

        await loadArticles();

        await editArticle(
            json.article
        );

        window.showToast(
            "Article duplicated.",
            "success"
        );

    }
    catch (err) {

        console.error(err);

        window.showToast(
            err.message ||
            "Unable to duplicate article.",
            "error"
        );

    }

}






async function saveArticle(showToast = true) {
    try {

        if (!articleStateChanged()) {

            articleDirty = false;

            window.showToast(
                "No changes to save.",
                "success"
            );

            return;
        }


        if (showToast) {

            window.showToast(
                "Saving article...",
                "loading"
            );
        }


        const payload = {

            meta: {

                title: document.getElementById("metaTitle").value.trim(),

                author: document.getElementById("metaAuthor").value.trim(),

                role: document.getElementById("metaRole").value.trim(),

                date: document.getElementById("metaDate").value,

                hero: document.getElementById("metaHero").value.trim(),

                tags: document.getElementById("metaTags").value.trim(),

                draft: document.getElementById("metaDraft").checked,

                popular: document.getElementById("metaPopular").checked,

                protected: document.getElementById("metaProtected").checked

            },
            
            settings: getDisplaySettings(),

            
            markdown: document.getElementById(
                "articleEditor"
            ).value,

            scope: document.getElementById(
                "articleMediaScope"
            ).value



        };

        const json =
            await window.api(

                `${window.API.ARTICLES}/${window.currentArticle}`,

                {

                    method: "PUT",

                    body: JSON.stringify(payload)

                }

            );

        if (!json.success) {

            throw new Error(
                json.message
            );

        }

        if (showToast) {

            window.showToast(
                "Article saved successfully.",
                "success"
            );

        }

        lastSavedArticleState =
            getCurrentArticleState();


        articleDirty = false;

        draftDirty = false;

        deleteLocalDraft(
            window.currentArticle
        );

        setAutosaveStatus(
            "Saved",
            "saved"
        );

        await loadArticles();

        window.refreshSearchIndex?.();

        await loadArticleHistory();


    }
    catch (err) {

        console.error(err);

        window.showToast(
            err.message ||
            "Unable to save article.",
            "error"
        );

    }

}





/* ======================================
   EDITOR
   ==================================== */

function setupArticleDragDrop() {

    const zone =
        document.getElementById(
            "articleEditorDropZone"
        );

    const overlay =
        document.getElementById(
            "articleDropOverlay"
        );

    if (!zone || !overlay) return;

    ["dragenter","dragover"].forEach(type => {

        zone.addEventListener(type, e => {

            e.preventDefault();

            overlay.classList.remove(
                "hidden"
            );

        });

    });

    ["dragleave","dragend"].forEach(type => {

        zone.addEventListener(type, e => {

            if (e.target !== zone) return;

            overlay.classList.add(
                "hidden"
            );

        });

    });

    zone.addEventListener(
        "drop",
        e => {

            e.preventDefault();

            overlay.classList.add(
                "hidden"
            );

            const file =
                e.dataTransfer.files[0];

            if (!file) return;

            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                alert(
                    "Only image files can be dropped."
                );

                return;

            }

            uploadDroppedImage(file);

        }

    );

}




async function uploadDroppedImage(file) {

    try {

        const form = new FormData();

        form.append(
            "files",
            file
        );

        const response =
            await fetch(

                `${window.API.ARTICLE_ASSETS}/${window.currentArticle}`,

                {

                    method: "POST",

                    credentials: "include",

                    body: form

                }

            );

        const json =
            await response.json();

        if (!json.success) {

            throw new Error(
                json.message
            );

        }

        const image =
            json.files[0];

        const editor =
            document.getElementById(
                "articleEditor"
            );

        const markdown =
`![${image.filename}](${image.url})`;

        editor.setRangeText(

            markdown,

            editor.selectionStart,

            editor.selectionEnd,

            "end"

        );

        editor.focus();

        articleDirty = true;

        draftDirty = true;

        scheduleAutosave();

        updateArticleStats();

        updateWritingInsights();

        updateSeoScore();

    }
    catch (err) {

        console.error(err);

        window.showToast(

            err.message ||

            "Unable to upload image."

        );

    }

}








async function importArticle(file) {

    if (!file) return;

    try {

        const markdown =
            await file.text();

        const parsed =
            parseFrontMatter(
                markdown
            );

        document.getElementById(
            "metaTitle"
        ).value =
            parsed.meta.title || "";

        document.getElementById(
            "metaAuthor"
        ).value =
            parsed.meta.author || "";

        document.getElementById(
            "metaRole"
        ).value =
            parsed.meta.role || "";

        document.getElementById(
            "metaDate"
        ).value =
            parsed.meta.date || "";

        document.getElementById(
            "metaHero"
        ).value =
            parsed.meta.hero || "";

        document.getElementById(
            "metaTags"
        ).value =
            parsed.meta.tags || "";

        document.getElementById(
            "metaPopular"
        ).checked =
            parsed.meta.popular === "true";

        document.getElementById(
            "metaDraft"
        ).checked =
            parsed.meta.draft === "true";

        document.getElementById(
            "articleEditor"
        ).value =
            parsed.body.trim();

        updateHeroPreview(
            document.getElementById(
                "metaHero"
            ).value
        );

        updateArticleStatus();

        updateArticleStats();

        updateWritingInsights();

        updateSeoScore();

        updateArticleToc();

        articleDirty = true;

        draftDirty = true;

        scheduleAutosave();

    }
    catch (err) {

        console.error(err);

        alert(
            "Unable to import markdown."
        );

    }

}







function exportArticle() {

    const frontMatter =
`---
title: ${document.getElementById("metaTitle").value.trim()}
author: ${document.getElementById("metaAuthor").value.trim()}
role: ${document.getElementById("metaRole").value.trim()}
date: ${document.getElementById("metaDate").value}
hero: ${document.getElementById("metaHero").value.trim()}
tags: ${document.getElementById("metaTags").value.trim()}
popular: ${document.getElementById("metaPopular").checked}
draft: ${document.getElementById("metaDraft").checked}
---

`;

    const markdown =
        frontMatter +
        document.getElementById(
            "articleEditor"
        ).value.trim();

    const blob =
        new Blob(
            [markdown],
            {
                type: "text/markdown"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        `${window.currentArticle || "article"}.md`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

}








function toggleMetadata() {

    const sidebar =
        document.querySelector(
            ".article-editor-sidebar"
        );

    if (!sidebar) return;

    const collapsed =
        sidebar.classList.toggle(
            "collapsed"
        );

    const arrow =
        document.getElementById(
            "metaArrow"
        );

    if (arrow) {

        arrow.className = collapsed
            ? "bi bi-chevron-down"
            : "bi bi-chevron-up";

    }

}



function toggleDisplay(){

    const content = document.getElementById("displayContent");
    const arrow = document.getElementById("displayArrow");

    if(!content || !arrow) return;


    const collapsed =
        content.classList.toggle("collapsed");


    arrow.className = collapsed
        ? "bi bi-chevron-down"
        : "bi bi-chevron-up";

}












async function renderArticlePreview() {

    const editor =
        document.getElementById(
            "articleEditor"
        );

    const preview =
        document.getElementById(
            "articlePreview"
        );

    if (!editor || !preview)
        return;

    try {

        const json =
            await window.api(

                `${window.API.ARTICLES}/preview`,

                {
                    method: "POST",

                    body: JSON.stringify({
                        markdown: editor.value
                    })
                }

            );

        if (json.success) {

            const scroll = preview.scrollTop;

            preview.innerHTML = json.html;

            preview.scrollTop = scroll;

        }

    }
    catch (err) {

        console.error(err);

    }

}







/* ==========================================================
   LIVE PREVIEW STATUS
   ========================================================== */

function setLivePreviewStatus(
    state,
    text
){

    const status =
        document.getElementById(
            "livePreviewStatus"
        );

    if(!status)
        return;

    const textEl =
        status.querySelector(
            ".live-preview-status-text"
        );

    status.dataset.state =
        state;

    if(textEl){
        textEl.textContent =
            text;
    }

}





/* ==========================================================
   LIVE ARTICLE PREVIEW
   ========================================================== */


function showLivePreviewInEditor(previewUrl){

    const preview =
        document.getElementById(
            "articlePreview"
        );

    if(!preview)
        return;


    setLivePreviewStatus(
        "connecting",
        "Connecting to Live Preview..."
    );


    preview.innerHTML = `
        <iframe
            id="livePreviewFrame"
            src="${previewUrl}"
            title="Live Article Preview"
            style="
                width:100%;
                height:100%;
                border:0;
                display:block;
                background:transparent;
            "
        ></iframe>
    `;


    const frame =
        document.getElementById(
            "livePreviewFrame"
        );

    if(!frame)
        return;


    frame.addEventListener(
        "load",
        () => {

            setLivePreviewStatus(
                "connected",
                "Live Preview Connected"
            );

        },
        {
            once:true
        }
    );

}






function showLocalPreviewInEditor(){

    const preview =
        document.getElementById(
            "articlePreview"
        );

    if(!preview)
        return;

    livePreviewInEditor = false;

    renderArticlePreview();

}



function openLivePreviewWindow(){

    livePreviewWindow =
        window.open(
            livePreviewUrl,
            "_blank",
            "noopener,noreferrer"
        );

    if(!livePreviewWindow){

        window.showToast(
            "Preview tab was blocked by the browser.",
            "warning"
        );

        return false;
    }

    livePreviewOpened = true;

    return true;
}




async function openLivePreview(openExternal = false){


    setLivePreviewStatus(
        "connecting",
        "Starting Live Preview..."
    );

    /*
     * ========================================
     * EXISTING LIVE PREVIEW SESSION
     * ========================================
     *
     * Reuse the existing session.
     * Do NOT create another API preview.
     */

    if(
        livePreviewToken &&
        livePreviewUrl
    ){




    /*
     * ========================================
     * EXTERNAL PREVIEW
     * ========================================
     *
     * Reuse the existing session.
     * Do NOT change the editor layout.
     */
        if(openExternal){

            const opened =
                openLivePreviewWindow();

            if(opened){

                setLivePreviewStatus(
                    "connected",
                    "Live Preview Active"
                );

            }

            return;
        }



        livePreviewInEditor = true;


        /*
         * If currently in Editor mode,
         * Live Preview opens in Split mode.
         *
         * If already in Split or Preview mode,
         * preserve the current layout.
         */

        if(
            articleLayoutMode === "editor"
        ){

            setArticleLayout(
                "split"
            );

        }
        else{

            setArticleLayout(
                articleLayoutMode
            );

        }


        /*
         * Reuse the existing live-preview URL.
         */

        showLivePreviewInEditor(
            livePreviewUrl
        );


        return;

    }



    /*
     * ========================================
     * NO LIVE PREVIEW SESSION
     * ========================================
     */

    if(
        !window.currentArticle
    ){

        window.showToast(
            "No article is currently open.",
            "warning"
        );

        return;

    }


    const editor =
        document.getElementById(
            "articleEditor"
        );


    if(!editor){

        return;

    }


    try{

        /*
         * ========================================
         * CREATE LIVE PREVIEW SESSION
         * ========================================
         */

        const json =
            await window.api(
                `${window.API.ARTICLES}/live-preview`,
                {
                    method:"POST",

                    body:JSON.stringify({

                        article:
                            window.currentArticle,

                        markdown:
                            editor.value,

                        meta:{

                            title:
                                document
                                    .getElementById(
                                        "metaTitle"
                                    )
                                    ?.value
                                    .trim(),

                            author:
                                document
                                    .getElementById(
                                        "metaAuthor"
                                    )
                                    ?.value
                                    .trim(),

                            role:
                                document
                                    .getElementById(
                                        "metaRole"
                                    )
                                    ?.value
                                    .trim(),

                            date:
                                document
                                    .getElementById(
                                        "metaDate"
                                    )
                                    ?.value,

                            hero:
                                document
                                    .getElementById(
                                        "metaHero"
                                    )
                                    ?.value
                                    .trim(),

                            tags:
                                document
                                    .getElementById(
                                        "metaTags"
                                    )
                                    ?.value
                                    .trim(),

                            popular:
                                document
                                    .getElementById(
                                        "metaPopular"
                                    )
                                    ?.checked,

                            draft:
                                document
                                    .getElementById(
                                        "metaDraft"
                                    )
                                    ?.checked,

                            protected:
                                document
                                    .getElementById(
                                        "metaProtected"
                                    )
                                    ?.checked

                        }

                    })

                }
            );


        /*
         * ========================================
         * CHECK RESPONSE
         * ========================================
         */

        if(!json.success){

            throw new Error(
                json.message ||
                "Unable to create live preview."
            );

        }


        if(!json.previewUrl){

            throw new Error(
                "Live preview URL was not returned."
            );

        }


        /*
         * ========================================
         * SAVE SESSION
         * ========================================
         *
         * URL → iframe
         * Token → PUT updates
         */

        livePreviewUrl =
            json.previewUrl;


        livePreviewToken =
            json.previewUrl
                .split("/")
                .pop();


        livePreviewArticle =
            window.currentArticle;


        livePreviewOpened =
            true;


        /*
         * ========================================
         * EXTERNAL PREVIEW
         * ========================================
         *
         * Session was just created specifically
         * for an external preview tab.
         *
         * Do NOT change editor layout.
         */
        if(openExternal){

            const opened =
                openLivePreviewWindow();

            if(opened){

                setLivePreviewStatus(
                    "connected",
                    "Live Preview Active"
                );

            }

            return;
        }


        /*
         * ========================================
         * EMBEDDED LIVE PREVIEW
         * ========================================
         *
         * Always start Live Preview in Split mode.
         * 
         * Normal Live Preview behavior.
         */
        livePreviewInEditor =
            true;

        setArticleLayout(
            "split"
        );

        showLivePreviewInEditor(
            livePreviewUrl
        );





    }
    catch(err){

        console.error(
            "Live preview error:",
            err
        );


        setLivePreviewStatus(
            "error",
            "Live Preview Error"
        );


        window.showToast(
            err.message ||
            "Unable to open live preview.",
            "error"
        );

    }

}




function openPreviewInNewTab(){

    /*
     * Reuse the existing Live Preview session
     * if one already exists.
     *
     * Otherwise create one and open it externally.
     *
     * IMPORTANT:
     * This does NOT activate Split/Live Preview
     * inside the editor.
     */
    openLivePreview(true);

}







async function updateLivePreview(){

    console.log(
        "livePreviewToken:",
        livePreviewToken
    );

    if(!livePreviewToken)
        return;

    const editor =
        document.getElementById(
            "articleEditor"
        );

    if(!editor)
        return;

    try{

        const json =
            await window.api(
                `${window.API.ARTICLES}/live-preview/${livePreviewToken}`,
                {
                    method:"PUT",

                    body:JSON.stringify({

                        article:
                            window.currentArticle,

                        markdown:
                            editor.value,

                        meta:{

                            title:
                                document
                                    .getElementById("metaTitle")
                                    ?.value
                                    .trim() || "",

                            author:
                                document
                                    .getElementById("metaAuthor")
                                    ?.value
                                    .trim() || "",

                            role:
                                document
                                    .getElementById("metaRole")
                                    ?.value
                                    .trim() || "",

                            date:
                                document
                                    .getElementById("metaDate")
                                    ?.value || "",

                            hero:
                                document
                                    .getElementById("metaHero")
                                    ?.value
                                    .trim() || "",

                            tags:
                                document
                                    .getElementById("metaTags")
                                    ?.value
                                    .trim() || "",

                            popular:
                                document
                                    .getElementById("metaPopular")
                                    ?.checked || false,

                            draft:
                                document
                                    .getElementById("metaDraft")
                                    ?.checked || false,

                            protected:
                                document
                                    .getElementById("metaProtected")
                                    ?.checked || false

                        }

                    })
                }
            );

        if(!json?.success){

            console.error(
                "Live preview update failed:",
                json
            );

            setLivePreviewStatus(
                "error",
                "Live Preview Update Failed"
            );

            return;
        }

        console.log(
            "Live preview updated"
        );


        setLivePreviewStatus(
            "connected",
            "Live Preview Connected"
        );


    }
    catch(err){

        console.error(
            "Live preview update error:",
            err
        );


        setLivePreviewStatus(
            "error",
            "Live Preview Update Failed"
        );


    }

}








function filterArticles(query) {

    query = query.trim().toLowerCase();

    if (!query) {

        renderArticles();
        return;

    }

    const filtered = articles.filter(article =>

        article.title.toLowerCase().includes(query) ||

        article.article.toLowerCase().includes(query) ||

        (Array.isArray(article.tags)
            ? article.tags.join(" ")
            : (article.tags || "")
        )
        .toLowerCase()
        .includes(query)

    );

    renderArticles(filtered);

}





/* ========================================
   ANALYTICS
   ====================================== */

function updateArticleStatus() {

    const badge =
        document.getElementById(
            "articleStatusBadge"
        );

    const publishBtn =
        document.getElementById(
            "publishArticleBtn"
        );

    if (!badge || !publishBtn) return;

    const draft =
        document.getElementById(
            "metaDraft"
        ).checked;

    const protectedArticle =
        document.getElementById(
            "metaProtected"
        ).checked;

    if (protectedArticle) {

        badge.textContent =
            "🔒 Protected";

        badge.className =
            "status-pill protected";

    }
    else if (draft) {

        badge.textContent =
            "🟡 Draft";

        badge.className =
            "status-pill draft";

    }
    else {

        badge.textContent =
            "🟢 Published";

        badge.className =
            "status-pill public";

    }


    // Button should always control publish state
    if (draft) {

        publishBtn.textContent =
            "Publish";

    }
    else {

        publishBtn.textContent =
            "Unpublish";

    }

}




function updateArticleStats() {

    const editor =
        document.getElementById(
            "articleEditor"
        );

    if (!editor) return;

    const text = editor.value;

    const words =
        text
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    const wordCount =
        words.length;

    const characterCount =
        text.length;

    const readingTime =
        Math.max(
            1,
            Math.ceil(wordCount / 200)
        );

    const headingCount =
        (text.match(/^#{1,6}\s/gm) || [])
            .length;

    const imageCount =
        (text.match(/!\[.*?\]\(.*?\)/g) || [])
            .length;

    document.getElementById(
        "articleWordCount"
    ).textContent =
        `${wordCount} Words`;

    document.getElementById(
        "articleCharacterCount"
    ).textContent =
        `${characterCount} Characters`;

    document.getElementById(
        "articleReadingTime"
    ).textContent =
        `${readingTime} min read`;

    document.getElementById(
        "articleHeadingCount"
    ).textContent =
        `${headingCount} Headings`;

    document.getElementById(
        "articleImageCount"
    ).textContent =
        `${imageCount} Images`;

}





function updateWritingInsights(){

    const editor =
        document.getElementById(
            "articleEditor"
        );

    if(!editor)
        return;

    const text =
        editor.value;

    const sentences =

        text.match(
            /[^.!?]+[.!?]+/g
        ) || [];

    const longSentences =

        sentences.filter(
            sentence =>

                sentence
                    .trim()
                    .split(/\s+/)
                    .length > 30
        );

    const paragraphs =

        text.split(/\n\s*\n/);

    
    const words =

        text
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    const syllables =

        words.reduce(

            (count, word) =>

                count +

                Math.max(

                    1,

                    (
                        word
                            .toLowerCase()
                            .match(/[aeiouy]+/g) || []
                    ).length
    
                ),
    
            0
    
        );

    const averageSentenceLength =

        words.length /

        Math.max(
            1,
            sentences.length
        );
    
    const averageSyllables =
    
        syllables /
    
        Math.max(
            1,
            words.length
        );



    const longParagraphs =

        paragraphs.filter(
            paragraph =>

                paragraph
                    .trim()
                    .split(/\s+/)
                    .length > 120
        );

    document.getElementById(
    "insightLongSentences"
).textContent =
    longSentences.length;

document.getElementById(
    "insightLongParagraphs"
).textContent =
    longParagraphs.length;



    
const readingScore =

    206.835

    -

    1.015 * averageSentenceLength

    -

    84.6 * averageSyllables;

let readability;

if (readingScore >= 80) {

    readability = "Easy";

}
else if (readingScore >= 60) {

    readability = "Good";

}
else if (readingScore >= 40) {

    readability = "Medium";

}
else {

    readability = "Difficult";

}




const readabilityElement =

    document.getElementById(
        "insightReadability"
    );

readabilityElement.textContent =
    readability;

readabilityElement.className =
    "";

readabilityElement.classList.add(

    readability === "Excellent"

        ? "insight-good"

    : readability === "Good"

        ? "insight-ok"

    : readability === "Fair"

        ? "insight-warning"

        : "insight-danger"

);


const suggestions = [];


const wikiLinks = [

    ...text.matchAll(
        /\[\[([^\]]+)\]\]/g
    )

].map(match =>

    match[1].trim()

);

const missingWikiLinks =
    wikiLinks.filter(link =>

        !articles.some(article =>

            article.title === link ||

            article.article === link

        )

    );




if (longSentences.length > 0) {

    suggestions.push(
        `• ${longSentences.length} long sentence${longSentences.length > 1 ? "s" : ""}. Try splitting them into shorter sentences.`
    );

}

if (longParagraphs.length > 0) {

    suggestions.push(
        `• ${longParagraphs.length} long paragraph${longParagraphs.length > 1 ? "s" : ""}. Consider breaking them into smaller paragraphs.`
    );

}

if (!text.match(/^#\s.+$/m)) {

    suggestions.push(
        "• Add an H1 heading near the top of the article."
    );

}

if (!text.includes("![")) {

    suggestions.push(
        "• Add at least one image to improve readability."
    );

}




for (const link of missingWikiLinks) {

    suggestions.push(

        `⚠ Missing article: [[${link}]]`

    );

}



const suggestionBox =
    document.getElementById(
        "writingSuggestions"
    );

if (suggestionBox) {

    suggestionBox.innerHTML = suggestions.length

        ? suggestions.map(item => `

            <div class="writing-suggestion">

                ${item}

            </div>

        `).join("")

        : `

            <div class="writing-suggestion insight-good">

                ✓ No writing issues detected.

            </div>

        `;

}

}





function updateSeoScore() {

    const markdown =
        document.getElementById(
            "articleEditor"
        ).value;

    const title =
        document.getElementById(
            "metaTitle"
        ).value.trim();

    const list =
        document.getElementById(
            "articleSeoList"
        );

    const score =
        document.getElementById(
            "articleSeoScore"
        );

    if (!list || !score) return;

    let points = 0;

    const checks = [];

    // Title

    const goodTitle =
        title.length >= 30 &&
        title.length <= 60;

    if (goodTitle) points += 15;

    checks.push({

        label: "Title Length",

        ok: goodTitle

    });

    // Words

    const words =
        markdown
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .length;

    const goodWords =
        words >= 300;

    if (goodWords) points += 20;

    checks.push({

        label: "Word Count",

        ok: goodWords

    });

    // H1

    const hasH1 =
        /^#\s.+$/m.test(markdown);

    if (hasH1) points += 15;

    checks.push({

        label: "H1 Heading",

        ok: hasH1

    });

    // H2+

    const hasSections =
        /^##\s.+$/m.test(markdown);

    if (hasSections) points += 10;

    checks.push({

        label: "Sections",

        ok: hasSections

    });

    // Images

    const images =
        (markdown.match(
            /!\[.*?\]\(.*?\)/g
        ) || []).length;

    const hasImages =
        images > 0;

    if (hasImages) points += 10;

    checks.push({

        label: "Images",

        ok: hasImages

    });

    // Internal Links

    const internal =
        (markdown.match(
            /\]\(\/.*?\)/g
        ) || []).length;

    const hasInternal =
        internal > 0;

    if (hasInternal) points += 10;

    checks.push({

        label: "Internal Links",

        ok: hasInternal

    });

    // External Links

    const external =
        (markdown.match(
            /\]\(https?:\/\/.*?\)/g
        ) || []).length;

    const hasExternal =
        external > 0;

    if (hasExternal) points += 10;

    checks.push({

        label: "External Links",

        ok: hasExternal

    });

    // Reading Time

    const minutes =
        Math.max(
            1,
            Math.ceil(words / 200)
        );

    if (minutes >= 2) {

        points += 10;

    }

    checks.push({

        label: "Reading Time",

        ok: minutes >= 2

    });

    score.textContent =
        `${points} / 100`;

    list.innerHTML =
        checks.map(item => `

<div class="seo-item">

    <span>

        ${item.label}

    </span>

    <span class="${
        item.ok
            ? "seo-good"
            : "seo-warn"
    }">

        ${
            item.ok
                ? "✓"
                : "⚠"
        }

    </span>

</div>

`).join("");

}









function resetArticleHistoryUI(
    message = "No history"
) {

    const list =
        document.getElementById(
            "articleHistoryList"
        );

    const historyCount =
        document.getElementById(
            "historyCount"
        );

    const loadMore =
        document.getElementById(
            "historyLoadMore"
        );

    if (historyCount) {

        historyCount.textContent =
            "0 Versions";

    }

    if (list) {

        list.innerHTML =
            message;

    }

    if (loadMore) {

        loadMore.classList.add(
            "hidden"
        );

        loadMore.textContent = "";

    }
}







async function loadArticleHistory() {

    const article =
        window.currentArticle;

    if (!article)
        return;

    const list =
        document.getElementById(
            "articleHistoryList"
        );

    if (!list)
        return;

    /*
     * Every request gets its own id.
     *
     * If the user switches articles while this
     * request is running, the old response is ignored.
     */
    const requestId =
        ++articleHistoryRequestId;

    /*
     * Mark which article owns the current history.
     */
    articleHistoryArticle =
        article;

    /*
     * Clear old article history immediately.
     */
    articleHistory = [];

    visibleHistory =
        HISTORY_STEP;

    resetArticleHistoryUI(
        "Loading..."
    );

    try {

        const json =
            await window.api(
                `${window.API.ARTICLES}/${article}/history`
            );

        /*
         * Ignore stale responses.
         */
        if (
            requestId !== articleHistoryRequestId ||
            window.currentArticle !== article ||
            articleHistoryArticle !== article
        ) {
            return;
        }

        if (!json.success) {
            throw new Error(
                json.message ||
                "Unable to load history."
            );
        }

        /*
         * Always replace the array.
         *
         * Even when the article has zero history.
         */
        articleHistory =
            Array.isArray(json.versions)
                ? json.versions
                : [];

        visibleHistory =
            HISTORY_STEP;

        if (!articleHistory.length) {

            resetArticleHistoryUI(
                "No history"
            );


            return;
        }

        renderArticleHistory();

    }
    catch (err) {

        /*
         * Ignore errors belonging to an old article.
         */
        if (
            requestId !== articleHistoryRequestId ||
            window.currentArticle !== article ||
            articleHistoryArticle !== article
        ) {
            return;
        }

        articleHistory = [];

        visibleHistory =
            HISTORY_STEP;

        resetArticleHistoryUI(
            "Unable to load history"
        );


    }
}










function formatHistoryDate(version) {

    if (!version)
        return "Unknown date";


    /*
     * History filenames use:
     *
     * 2026-08-08T01-55-51.828Z
     *
     * Convert it back to a valid ISO timestamp:
     *
     * 2026-08-08T01:55:51.828Z
     */

    const normalized =
        version.replace(
            /^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})(\.\d+)?Z$/,
            "$1:$2:$3$4Z"
        );


    const date =
        new Date(normalized);


    if (
        Number.isNaN(
            date.getTime()
        )
    ){
        return "Unknown date";
    }


    /*
     * Use the global formatter for
     * all timezone-aware date handling.
     */

    const dateKey =
        formatDateTime(
            date,
            {
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        );


    const now =
        new Date();


    const todayKey =
        formatDateTime(
            now,
            {
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        );


    const time =
        formatDateTime(
            date,
            {
                hour: "numeric",
                minute: "2-digit"
            }
        );


    if (
        dateKey ===
        todayKey
    ){
        return `Today • ${time}`;
    }


    /*
     * India has no DST, so subtracting
     * exactly 24 hours is safe for the
     * Asia/Kolkata calendar date.
     */

    const yesterday =
        new Date(
            now.getTime() -
            24 * 60 * 60 * 1000
        );


    const yesterdayKey =
        formatDateTime(
            yesterday,
            {
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        );


    if (
        dateKey ===
        yesterdayKey
    ){
        return `Yesterday • ${time}`;
    }


    const oldDate =
        formatDateTime(
            date,
            {
                month: "short",
                day: "numeric"
            }
        );


    return (
        oldDate +
        " • " +
        time
    );
}








function renderArticleHistory() {

    /*
     * Never render history belonging to another article.
     */
    if (
        !window.currentArticle ||
        articleHistoryArticle !==
            window.currentArticle
    ) {
        return;
    }

    const list =
        document.getElementById(
            "articleHistoryList"
        );

    if (!list)
        return;


    const historyCount =
        document.getElementById(
            "historyCount"
        );

    if (historyCount) {

        historyCount.textContent =
            `${articleHistory.length} Versions`;

    }



    list.innerHTML =

        articleHistory

            .slice(0, visibleHistory)

            .map(version => `

<div
    class="history-item"
    data-version="${version.version}"
>

    <div class="history-summary">

        <div class="history-info">

            <div class="history-time">

                <span class="history-dot"></span>

                <span>
                    ${formatHistoryDate(
                        version.version
                    )}
                </span>

            </div>

            <div class="history-change">

                ${version.summary || "Updated content"}

            </div>

            <div class="history-size">

                ${formatBytes(
                    version.size
                )}

            </div>

        </div>


        <button
            class="btn btn-icon history-menu"
            data-menu="articleHistoryMenu"
            data-version="${version.version}"
            data-tooltip="More actions"
        >

            <i class="bi bi-three-dots-vertical"></i>

        </button>

    </div>

</div>

`)

            .join("");

    const loadMore =
        document.getElementById(
            "historyLoadMore"
        );

    if (!loadMore)
        return;

    const remaining =
        articleHistory.length - visibleHistory;

    if (remaining > 0) {

        loadMore.classList.remove("hidden");

        loadMore.textContent =
            remaining > HISTORY_STEP
                ? `Load ${HISTORY_STEP} More`
                : `Show Remaining ${remaining}`;

    }
    else {

        loadMore.classList.add("hidden");

    }

}




async function togglePublishArticle() {

    const draft =
        document.getElementById(
            "metaDraft"
        );

    const protectedArticle =
        document.getElementById(
            "metaProtected"
        );

    if (protectedArticle.checked) {

        const confirmPublish = confirm(
            "This article is protected. It will be published but readers will need access to view it.\n\nContinue?"
        );

        if (!confirmPublish) {
            return;
        }

    }

    draft.checked = !draft.checked;

    updateArticleStatus();

    articleDirty = true;

    draftDirty = true;

    scheduleAutosave();

    await saveArticle();

}





/* ==========================================================
   MARKDOWN EDITOR
   ========================================================== */

function wrapSelection(before, after = before) {

    const editor = document.getElementById("articleEditor");

    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    const selected = editor.value.substring(start, end);

    editor.setRangeText(
        before + selected + after,
        start,
        end,
        "end"
    );

    editor.focus();

    handleEditorChange();

}

function insertLine(text) {

    const editor = document.getElementById("articleEditor");

    const pos = editor.selectionStart;

    editor.setRangeText(
        text,
        pos,
        pos,
        "end"
    );

    editor.focus();

    handleEditorChange();

}







function setupMarkdownShortcuts() {

    const editor =
        document.getElementById(
            "articleEditor"
        );

    if (!editor) return;

    editor.addEventListener(
        "keydown",
        e => {



            if (

                e.key === "Escape"

                &&

               articleFullscreen

            ){

             e.preventDefault();

             articleFullscreen = false;

             localStorage.setItem(
                 "articleFullscreen",
                 false
             );

             setArticleLayout(
                 articleLayoutMode
             );

             return;

            }



            // -----------------------------
            // Autocomplete
            // -----------------------------
            if (autocompleteOpen) {

                if (e.key === "ArrowDown") {
            
                    e.preventDefault();
            
                    autocompleteSelected =
            
                        (autocompleteSelected + 1)
            
                        %
            
                        autocompleteItems.length;
            
                    renderAutocomplete();
            
                    return;
            
                }
            
                if (e.key === "ArrowUp") {
            
                    e.preventDefault();
            
                    autocompleteSelected =

                        (

                            autocompleteSelected - 1 +

                            autocompleteItems.length

                        )

                        %

                        autocompleteItems.length;

                    renderAutocomplete();

                    return;

                }

                if (

                    e.key === "Enter" ||

                    e.key === "Tab"

                ){

                    e.preventDefault();

                    insertAutocomplete(

                        autocompleteItems[
                            autocompleteSelected
                        ]

                    );

                    return;

                }

                

                if (

                    e.key === "Escape"

                ) {

                    e.preventDefault();

                    closeAutocomplete();

                    return;

                }

            }



            // -----------------------------
            // Slash Commands
            // -----------------------------

            if (slashOpen) {

                if (e.key === "ArrowDown") {

                    e.preventDefault();

                    slashSelected =
                        (slashSelected + 1) %
                        filteredSlashCommands.length;
            
                    renderSlashMenu();
            
                    return;
            
                }

                if (e.key === "ArrowUp") {

                    e.preventDefault();

                    slashSelected =
                        (
                            slashSelected -
                            1 +
                            filteredSlashCommands.length
                        ) %
                        filteredSlashCommands.length;
            
                    renderSlashMenu();
            
                    return;
            
                }
            
                if (e.key === "Escape") {
            
                    e.preventDefault();
            
                    closeSlashMenu();
            
                    return;
            
                }
            
                if (e.key === "Enter") {
            
                    e.preventDefault();
            
                    insertSlashCommand(
                        filteredSlashCommands[
                            slashSelected
                        ]
                    );
            
                    return;
            
                }


                if (e.key === "Tab") {

                    e.preventDefault();

                    insertSlashCommand(
                        filteredSlashCommands[
                            slashSelected
                        ]
                    );

                    return;

                }

            }

            

            if (

                !e.ctrlKey &&
                !e.altKey &&
                !e.metaKey

            ){

                requestAnimationFrame(() => {

                    const pos =
                        editor.selectionStart;

                    const before =
                        editor.value.substring(
                            0,
                            pos
                        );

                    const line =
                        before.substring(
                            before.lastIndexOf("\n") + 1
                        );
            


                    const result =
                        getAutocomplete(line);
            
                    if(result){
            
                        autocompleteProvider =
                            result;
            
                        openAutocomplete(
                            result.items
                        );
            
                    }
                    else{
            
                        closeAutocomplete();
            
                    }
            
                });

            }





            if (

                e.ctrlKey &&

                e.key.toLowerCase() === "f"

            ){

                e.preventDefault();

                openFindBar();

            }

            if (

                e.ctrlKey &&

                e.key.toLowerCase() === "h"

            ){

                e.preventDefault();

                openFindBar();

                document
                    .getElementById("replaceInput")
                    ?.focus();

            }



            if (e.key === "Tab") {

                e.preventDefault();

                const start = editor.selectionStart;
                const end = editor.selectionEnd;

                if (e.shiftKey) {

                    const before =
                        editor.value.substring(
                            Math.max(0, start - 4),
                            start
                        );

                if (before === "    ") {

                    editor.setSelectionRange(
                        start - 4,
                        end
                    );

                    editor.setRangeText(
                        "",
                        start - 4,
                        start,
                        "end"
                    );

                }

            } else {

                editor.setRangeText(
                    "    ",
                    start,
                    end,
                    "end"
                );

            }

            handleEditorChange();

            return;

        }

        if (e.key === "Enter") {

    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    if (start !== end) return;

    const value = editor.value;

    const lineStart =
        value.lastIndexOf("\n", start - 1) + 1;

    const line =
        value.substring(lineStart, start);



        // -----------------------------
        // Smart newline inside pairs
        // -----------------------------

        const pairs = {
        
            "(": ")",
        
            "[": "]",

            "{": "}"

        };

        const left =
            value[start - 1];

        const right =
            value[start];

        if (

            pairs[left] === right

        ){

            e.preventDefault();

            editor.setRangeText(

                "\n    \n",

                start,

                start,

                "end"

            );

            editor.setSelectionRange(

                start + 5,

                start + 5

            );

            handleEditorChange();

            return;

        }




    // Exit empty bullet list
if (/^\s*[-*+]\s*$/.test(line)) {

    e.preventDefault();

    editor.setSelectionRange(
        lineStart,
        start
    );

    editor.setRangeText(
        "",
        lineStart,
        start,
        "end"
    );

    handleEditorChange();

    return;

}

// Exit empty numbered list
if (/^\s*\d+\.\s*$/.test(line)) {

    e.preventDefault();

    editor.setSelectionRange(
        lineStart,
        start
    );

    editor.setRangeText(
        "",
        lineStart,
        start,
        "end"
    );

    handleEditorChange();

    return;

}

// Exit empty quote
if (/^\s*>\s*$/.test(line)) {

    e.preventDefault();

    editor.setSelectionRange(
        lineStart,
        start
    );

    editor.setRangeText(
        "",
        lineStart,
        start,
        "end"
    );

    handleEditorChange();

    return;

}

// Exit empty checklist
if (/^\s*[-*+]\s+\[[ xX]\]\s*$/.test(line)) {

    e.preventDefault();

    editor.setSelectionRange(
        lineStart,
        start
    );

    editor.setRangeText(
        "",
        lineStart,
        start,
        "end"
    );

    handleEditorChange();

    return;

}



    // -----------------------------
    // Checklist (FIRST)
    // -----------------------------
    const checklist =
        line.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)/);

    if (checklist) {

        e.preventDefault();

        editor.setRangeText(
            "\n" + checklist[1],
            start,
            end,
            "end"
        );

        handleEditorChange();

        return;

    }

    // -----------------------------
    // Numbered list
    // -----------------------------
    const numbered =
        line.match(/^(\s*)(\d+)\.\s+/);

    if (numbered) {

        e.preventDefault();

        editor.setRangeText(
            `\n${numbered[1]}${Number(numbered[2]) + 1}. `,
            start,
            end,
            "end"
        );

        handleEditorChange();

        return;

    }

    // -----------------------------
    // Quote
    // -----------------------------
    const quote =
        line.match(/^(\s*>\s*)/);

    if (quote) {

        e.preventDefault();

        editor.setRangeText(
            "\n" + quote[1],
            start,
            end,
            "end"
        );

        handleEditorChange();

        return;

    }

    // -----------------------------
    // Bullet list (LAST)
    // -----------------------------
    const bullet =
        line.match(/^(\s*[-*+]\s+)/);

    if (bullet) {

        e.preventDefault();

        editor.setRangeText(
            "\n" + bullet[1],
            start,
            end,
            "end"
        );

        handleEditorChange();

        return;

    }

}




// -----------------------------
// Skip existing closing pair
// -----------------------------

if (

    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey

) {

    const closing = {

        ")": "(",

        "]": "[",

        "}": "{",

        "\"": "\"",

        "'": "'",

        "`": "`",

        "*": "*",

        "_": "_"

    };

    if (

        closing[e.key] &&

        editor.selectionStart ===

        editor.selectionEnd

    ) {

        const pos = editor.selectionStart;

        if (

            editor.value[pos] === e.key

        ) {

            e.preventDefault();

            editor.setSelectionRange(

                pos + 1,

                pos + 1

            );

            return;

        }

    }

}


// -----------------------------
// Smart pair deletion
// -----------------------------

if (

    e.key === "Backspace" &&

    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey &&

    editor.selectionStart ===
    editor.selectionEnd

) {

    const pairs = {

        "(": ")",

        "[": "]",

        "{": "}",

        "\"": "\"",

        "'": "'",

        "`": "`",

        "*": "*",

        "_": "_"

    };

    const pos = editor.selectionStart;

    const left = editor.value[pos - 1];

    const right = editor.value[pos];

    if (

        pairs[left] === right

    ) {

        e.preventDefault();

        editor.setSelectionRange(

            pos - 1,

            pos + 1

        );

        editor.setRangeText(

            "",

            pos - 1,

            pos + 1,

            "end"

        );

        handleEditorChange();

        return;

    }

}





// -----------------------------
// Smart Home key
// -----------------------------

if (

    e.key === "Home" &&

    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey

){

    e.preventDefault();

    const pos =
        editor.selectionStart;

    const value =
        editor.value;

    const lineStart =
        value.lastIndexOf(
            "\n",
            pos - 1
        ) + 1;

    const lineEnd =
        value.indexOf(
            "\n",
            pos
        );

    const end =
        lineEnd === -1
            ? value.length
            : lineEnd;

    const line =
        value.substring(
            lineStart,
            end
        );

    const indent =
        line.match(/^\s*/)[0].length;

    const target =

        pos === lineStart + indent

            ? lineStart

            : lineStart + indent;

    editor.setSelectionRange(
        target,
        target
    );

    return;

}






// -----------------------------
// Smart Markdown Pairs
// -----------------------------

if (

    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey 

) {

    const pairs = {

        "(": ")",

        "[": "]",

        "{": "}",

        "\"": "\"",

        "'": "'",

        "`": "`",

        "*": "*",

        "_": "_"

    };

    const close = pairs[e.key];

    if (close) {

        const start = editor.selectionStart;

        const end = editor.selectionEnd;

        if (start !== end) {

            e.preventDefault();

            const selected =
                editor.value.substring(
                    start,
                    end
                );

            editor.setRangeText(

                e.key +

                selected +

                close,

                start,

                end,

                "end"

            );

            editor.setSelectionRange(

                start + 1,

                end + 1

            );

            handleEditorChange();

            return;

        }

    }

}


// Auto-close empty pair

if (

    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey 

) {

    const pairs = {

        "(": ")",

        "[": "]",

        "{": "}",

        "\"": "\"",

        "'": "'",

        "`": "`",

        "*": "*",

        "_": "_"

    };

    const close = pairs[e.key];

    if (
        close &&
        editor.selectionStart ===
        editor.selectionEnd &&
        !(e.key === "[" &&
          editor.value[editor.selectionStart - 1] === "!")
    ) {

        e.preventDefault();

        const pos =
            editor.selectionStart;

        editor.setRangeText(

            e.key + close,

            pos,

            pos,

            "end"

        );

        editor.setSelectionRange(

            pos + 1,

            pos + 1

        );

        handleEditorChange();

        return;

    }

}




            if (!e.ctrlKey) return;

            switch (e.key.toLowerCase()) {

                case "b":

                    e.preventDefault();
                    wrapSelection("**");
                    break;

                case "i":

                    e.preventDefault();
                    wrapSelection("*");
                    break;

                case "k":

                    e.preventDefault();

                    const url =
                        prompt("Enter URL");

                    if (url) {

                        wrapSelection(
                            "[",
                            `](${url})`
                        );

                    }

                    break;

                case "s":

                    e.preventDefault();
                    saveArticle();
                    break;

            }

        }

    );


        // ======================================
       // MOBILE / INPUT SLASH DETECTION
      // ======================================



       






    editor.addEventListener(

        "keyup",

        () => {

            updateActiveToc();

            updateStickyHeading();

        }

    );



    editor.addEventListener(
    "input",
    () => {

        updateStickyHeading();
        updateActiveToc();


        const pos =
            editor.selectionStart;

        const before =
            editor.value.substring(
                0,
                pos
            );

        const line =
            before.substring(
                before.lastIndexOf("\n") + 1
            );

        const trimmed =
            line.trim();


        /*
         * Slash command handling
         */

        if (
            trimmed.startsWith("/")
        ) {

            const query =
                trimmed.substring(1);


            if (!slashOpen) {

                openSlashMenu(
                    query
                );

            }
            else {

                filterSlashCommands(
                    query
                );

                renderSlashMenu();

                positionSlashMenu();

            }

        }
        else if (slashOpen) {

            closeSlashMenu();

        }

    }
);




    editor.addEventListener(

            "paste",

            e => {

                const text =

                    (e.clipboardData || window.clipboardData)
                        .getData("text");
        
                const cleaned =
        
                    text

                        .replace(/\u00A0/g, " ")

                        .replace(/\u200B/g, "")

                        .replace(/\uFEFF/g, "")

                        .replace(/[“”]/g, "\"")

                        .replace(/[‘’]/g, "'");

                if (cleaned === text)
                    return;

                e.preventDefault();

                const start =
                    editor.selectionStart;
        
                const end =
                    editor.selectionEnd;
        
                editor.setRangeText(
        
                    cleaned,
        
                    start,
        
                    end,
        
                    "end"
        
                );
        
                handleEditorChange();
        
            }

        );




    editor.addEventListener(

        "click",

        () => {

            updateActiveToc();

            updateStickyHeading();

        }

    );


    editor.addEventListener(

        "scroll",

        updateActiveToc

    );

}


/* ==========================================================
   SLASH COMMANDS
   ========================================================== */

let slashOpen = false;

let slashSelected = 0;

let filteredSlashCommands = [];


let autocompleteOpen = false;

let autocompleteSelected = 0;

let autocompleteItems = [];

let autocompleteProvider = null;



const slashCommands = [

    {
        icon: '<i class="bi bi-type-h1"></i>',
        tone: "purple",
        label: "Heading 1",
        description: "# Heading",
        shortcut: "/h1",
        keywords: [
            "heading",
            "title",
            "h1"
        ],
        insert: "# ",
        cursor:2
    },

    {
        icon: '<i class="bi bi-type-h2"></i>',
        tone: "purple",
        label: "Heading 2",
        description: "## Heading",
        shortcut: "/h2",
        keywords: [
            "heading",
            "subtitle",
            "h2"
        ],
        insert: "## ",
        cursor:3
    },

    {
        icon: '<i class="bi bi-quote"></i>',
        tone: "purple",
        label: "Quote",
        description: "> Quote",
        shortcut: "/quote",
        keywords: [
            "quote",
            "blockquote"
        ],
        insert: "> ",
        cursor:2
    },

    {
        icon: '<i class="bi bi-check2-square"></i>',
        tone: "green",
        label: "Checklist",
        description: "- [ ] Task",
        shortcut: "/task",
        keywords: [
            "checklist",
            "todo",
            "task"
        ],
        insert: "- [ ] ",
        cursor:6
    },

    {
        icon: '<i class="bi bi-code-slash"></i>',
        tone: "blue",
        label: "Code Block",
        description: "```",
        shortcut: "/code",
        keywords: [
            "code",
            "snippet"
        ],
        insert:
`\`\`\`

\`\`\``,
        cursor:4
    },

    {
        icon: '<i class="bi bi-dash-lg"></i>',
        tone: "pink",
        label: "Divider",
        description: "---",
        shortcut: "/hr",
        keywords: [
            "divider",
            "hr"
        ],
        insert: "\n---\n",
        cursor:5
    },

    {
        icon: '<i class="bi bi-image"></i>',
        tone: "orange",
        label: "Image",
        description: "Markdown image",
        shortcut: "/image",
        keywords: [
            "image",
            "photo"
        ],
        insert: "![]()",
        cursor:2
    },

    {
        icon: '<i class="bi bi-table"></i>',
        tone: "cyan",
        label: "Table",
        description: "Markdown table",
        shortcut: "/table",
        keywords: [
            "table"
        ],
        insert:
`| Column | Column |
|--------|--------|
|        |        |`,

         cursor:37

    }

];






function renderMarkdownHelp(){

    const container =
        document.getElementById(
            "markdownHelpContent"
        );

    if(!container)
        return;

    container.innerHTML = `

        <h4>Formatting</h4>

        <p><kbd>Ctrl+B</kbd> → Bold</p>
        <p><kbd>Ctrl+I</kbd> → Italic</p>
        <p><kbd>Ctrl+K</kbd> → Link</p>


        <h4>Markdown</h4>

        <p><code># Heading</code></p>
        <p><code>**bold**</code></p>
        <p><code>![image](url)</code></p>
        <p><code>\`\`\`javascript</code></p>


        <h4>Editor Commands</h4>

        ${slashCommands.map(command => `
            <p>
                <span class="help-command">
                    ${command.shortcut}
                </span>
                → ${command.label}
            </p>
        `).join("")}

    `;
}





function fuzzyMatch(text, query){

    text =
        text.toLowerCase();

    query =
        query.toLowerCase();

    let i = 0;

    for(const ch of text){

        if(ch === query[i]){

            i++;

            if(i === query.length){

                return true;

            }

        }

    }

    return false;

}



function scoreAutocomplete(text, query){

    text =
        text.toLowerCase();

    query =
        query.toLowerCase();

    if(text === query)
        return 100;

    if(text.startsWith(query))
        return 80;

    if(text.includes(query))
        return 60;

    if(fuzzyMatch(text, query))
        return 40;

    return 0;

}


function highlightAutocomplete(text, query){

    if(!query)
        return text;

    const lower =
        text.toLowerCase();

    const search =
        query.toLowerCase();

    const index =
        lower.indexOf(search);

    if(index === -1)
        return text;

    return (

        text.substring(
            0,
            index
        )

        +

        "<mark>"

        +

        text.substring(

            index,

            index + query.length

        )

        +

        "</mark>"

        +

        text.substring(

            index + query.length

        )

    );

}



function applySnippet(text){

    const cursor =
        text.indexOf("$0");

    return {

        text:

            text.replace(

                "$0",

                ""

            ),

        cursor

    };

}



function scoreSlashCommand(command, query){

    const q =
        query.toLowerCase();

    const label =
        command.label.toLowerCase();

    if(label === q)
        return 100;

    if(label.startsWith(q))
        return 90;

    if(
        command.keywords?.some(
            keyword =>
                keyword
                    .toLowerCase()
                    .startsWith(q)
        )
    ){
        return 80;
    }

    if(label.includes(q))
        return 70;

    if(
        command.description
            .toLowerCase()
            .includes(q)
    ){
        return 60;
    }

    if(
        command.keywords?.some(
            keyword =>
                keyword
                    .toLowerCase()
                    .includes(q)
        )
    ){
        return 50;
    }

    if(
        fuzzyMatch(
            label,
            q
        )
    ){
        return 40;
    }

    if(
        command.keywords?.some(
            keyword =>
                fuzzyMatch(
                    keyword,
                    q
                )
        )
    ){
        return 30;
    }

    return 0;

}




function filterSlashCommands(query = ""){

    query =
        query.trim().toLowerCase();

    if(!query){

        filteredSlashCommands = [
            ...slashCommands
        ];

        return;

    }

    filteredSlashCommands =

        slashCommands.filter(command => {

            const fields = [

                command.label,

                command.description,

                ...(command.keywords || [])

            ];

            return fields.some(field =>

                field
                &&
                (

                    field.toLowerCase().includes(query) ||
                    fuzzyMatch(field, query)

                )

            );

        })

        .sort(

            (a,b)=>

                scoreSlashCommand(b,query)

                -

                scoreSlashCommand(a,query)

        );

}




function renderSlashMenu(){

    const menu =
        document.getElementById(
            "slashMenu"
        );

    const results =
        document.getElementById(
            "slashResults"
        );

    const previousScroll =
        results.scrollTop;


    if(
        !menu ||
        !results
    ){
        return;
    }

    if(
        !filteredSlashCommands.length
    ){

        menu.classList.add(
            "hidden"
        );

        slashOpen = false;

        return;

    }

    slashSelected =
        Math.min(
            slashSelected,
            filteredSlashCommands.length - 1
        );

    results.innerHTML =

        filteredSlashCommands
            .map((command,index)=>`

<div
    class="slash-item ${
        index === slashSelected
            ? "active"
            : ""
    }"
    data-index="${index}"
>

    <div class="slash-icon ${command.tone || ""}">

        ${command.icon}

    </div>

    <div class="slash-body">

        <div class="slash-title">

            ${command.label}

        </div>

        <div class="slash-subtitle">

            ${command.description}

        </div>

    </div>

    <div class="slash-command">
        ${command.shortcut}
    </div>

</div>

`).join("");

results.scrollTop =
    previousScroll;


results.querySelectorAll(".slash-item")
    .forEach(item => {

        item.addEventListener(
                "mouseenter",
                () => {

                    slashSelected =
                        Number(item.dataset.index);

                    results
                        .querySelectorAll(".slash-item")
                        .forEach(el =>
                            el.classList.remove("active")
                        );

                    item.classList.add("active");

                    item.scrollIntoView({

                        block: "nearest",

                        behavior: "instant"

                    });

                }

            );

        item.addEventListener(
            "mousedown",
            e => {

                e.preventDefault();

                insertSlashCommand(

                    filteredSlashCommands[
                        Number(item.dataset.index)
                    ]

                );

            }

        );

    });



    menu.classList.remove("hidden");

    const active =
        results.querySelector(
            ".slash-item.active"
        );

    active?.scrollIntoView({
    
        block: "nearest",

        behavior: "instant"

    });



    slashOpen = true;

    positionSlashMenu();

}



function openSlashMenu(query = ""){

    slashSelected = 0;

    query = query.trim();

    filterSlashCommands(query);

    renderSlashMenu();

    positionSlashMenu();

}

function closeSlashMenu(){

    slashOpen = false;

    slashSelected = 0;

    filteredSlashCommands = [];

    document
        .getElementById(
            "slashMenu"
        )
        ?.classList.add(
            "hidden"
        );

}





// ======================================
// AUTOCOMPLETE PROVIDERS
// ======================================

const autocompleteProviders = [];

function registerAutocompleteProvider(provider){

    autocompleteProviders.push(provider);

}



function getAutocomplete(query){

    for(const provider of autocompleteProviders){

        const result = provider(query);

        if(result){

            return result;

        }

    }

    return null;

}


function renderAutocomplete(){

    const menu =
        document.getElementById(
            "autocompleteMenu"
        );

    const results =
        document.getElementById(
            "autocompleteResults"
        );

    if(

        !autocompleteItems.length

    ){

        menu.classList.add(
            "hidden"
        );

        return;

    }

    menu.classList.remove(
        "hidden"
    );

    results.innerHTML =

        autocompleteItems

            .map(

                (item,index)=>`

<div

    class="slash-item ${

        index === autocompleteSelected

            ? "active"

            : ""

    }"

    data-index="${index}"

>

    <div
        class="slash-icon"
    >

        ⚡

    </div>

    <div
        class="slash-content"
    >

        <div
            class="slash-title"
        >

            ${highlightAutocomplete(

                typeof item === "object"

                    ? item.label

                    : item,

                autocompleteProvider?.query || ""

            )}

        </div>

    </div>

</div>

`

            )

            .join("");


            results
    .querySelectorAll(".slash-item")
    .forEach(item => {

        item.addEventListener(
            "mousedown",
            e => {

                e.preventDefault();

                insertAutocomplete(
                    autocompleteItems[
                        Number(item.dataset.index)
                    ]
                );

            }
        );

    });


    positionAutocompleteMenu();
    

}




function openAutocomplete(items){

    autocompleteItems = items;

    autocompleteSelected = 0;

    autocompleteOpen = true;

    renderAutocomplete();

}


function closeAutocomplete(){

    autocompleteOpen = false;

    autocompleteItems = [];

    autocompleteSelected = 0;

    document
        .getElementById(
            "autocompleteMenu"
        )
        ?.classList.add(
            "hidden"
        );

}



document.addEventListener(
    "mousedown",
    e => {

        if (!autocompleteOpen)
            return;

        const menu =
            document.getElementById(
                "autocompleteMenu"
            );

        if (
            menu &&
            menu.contains(e.target)
        ){
            return;
        }

        closeAutocomplete();

    }
);





function insertAutocomplete(item){

    const editor =
        document.getElementById(
            "articleEditor"
        );

    if(!editor)
        return;

    const pos =
        editor.selectionStart;

    const before =
        editor.value.substring(
            0,
            pos
        );

    const lineStart =
        before.lastIndexOf("\n") + 1;

    const line =
        before.substring(lineStart);

    const label =

        typeof item === "object"

            ? item.label

            : item;

    const insert =

        typeof item === "object"

            ? item.insert

            : item;

    const codeIndex =
        line.lastIndexOf("```");

    const wikiIndex =
        line.lastIndexOf("[[");

    const imageIndex =
        line.lastIndexOf("![");


    if (codeIndex !== -1) {

        const snippet = applySnippet(
            `\`\`\`${insert}

    $0
    \`\`\``
        );

        editor.setSelectionRange(
            lineStart + codeIndex,
            pos
        );

        editor.setRangeText(
            snippet.text,
            lineStart + codeIndex,
            pos,
            "end"
        );
    
        if (snippet.cursor !== -1) {
    
            const cursor =
                lineStart +
                codeIndex +
                snippet.cursor;
    
            editor.setSelectionRange(
                cursor,
                cursor
            );
    
        }

    }




    else if (wikiIndex !== -1) {

        editor.setSelectionRange(

            lineStart + wikiIndex,

            pos

        );

        editor.setRangeText(

            `[[${insert}]]`,

            lineStart + wikiIndex,

            pos,

            "end"

        );

    }

    else if (imageIndex !== -1) {

        editor.setSelectionRange(

            lineStart + imageIndex,

            pos

        );

        editor.setRangeText(

            `![${insert})`,

            lineStart + imageIndex,

            pos,

            "end"

        );

    }

    
    else{

        editor.setRangeText(

            insert,

            pos,

            pos,

            "end"

        );

    }

    closeAutocomplete();

    handleEditorChange();

    editor.focus();

}




registerAutocompleteProvider(query => {

    if(query !== "#"){
        return null;
    }

    return {

        items: [

            "# ",
            "## ",
            "### ",
            "#### ",
            "##### ",
            "###### "

        ],

        query: ""

    };

});



registerAutocompleteProvider(query => {

    const index = query.lastIndexOf("[[");

    if(index === -1){
        return null;
    }

    const search =
        query
            .substring(index + 2)
            .trim()
            .toLowerCase();

    const items =

        articles

            .map(article => ({

                title: article.title,

                score: scoreAutocomplete(

                    article.title,

                    search

                )

            }))
    
            .filter(item =>
    
                item.score > 0
    
            )
    
            .sort(
    
                (a,b)=>
    
                    b.score-a.score
    
            )
    
            .map(item=>item.title);

    if(!items.length){
        return null;
    }

    return {
        items,

        query: search

    };

});





registerAutocompleteProvider(line => {

    const index =
        line.lastIndexOf("![");

    if(index === -1)
        return null;

    const query =
        line.substring(
            index + 2
        ).toLowerCase();

    const items =
    autocompleteMedia
        .filter(file =>
            file.filename &&
            file.filename
                .toLowerCase()
                .includes(query)
        )
        .map(file => ({
            label: file.filename,

            insert:
                `${file.filename}](${file.url}`
        }));

        

    if(!items.length)
        return null;

    return {

        items,

        replaceStart:
            index + 2

    };

});





registerAutocompleteProvider(query => {

    const index =
        query.lastIndexOf("```");

    if(index === -1){
        return null;
    }

    const search =
        query
            .substring(index + 3)
            .trim()
            .toLowerCase();

    const languages = [

        "javascript",
        "typescript",
        "html",
        "css",
        "json",
        "markdown",
        "bash",
        "python",
        "java",
        "c",
        "cpp",
        "sql",
        "yaml",
        "xml"

    ];

    const items =

        languages.filter(language =>

            language.includes(search)

        );

    if(!items.length){
        return null;
    }

    return {

        items,
        query: search

    };

});







function positionEditorMenu(menuId){

    const menu =
        document.getElementById(
            menuId
        );

    const editor =
        document.getElementById(
            "articleEditor"
        );

    if(
        !menu ||
        !editor
    ){
        return;
    }

    const mirror =
        document.createElement(
            "div"
        );

    const style =
        getComputedStyle(editor);

    [
        "font",
        "fontSize",
        "fontFamily",
        "fontWeight",
        "lineHeight",
        "letterSpacing",
        "padding",
        "border",
        "boxSizing",
        "whiteSpace",
        "wordWrap",
        "overflowWrap",
        "width"
    ].forEach(prop => {

        mirror.style[prop] =
            style[prop];

    });

    mirror.style.position =
        "absolute";

    mirror.style.visibility =
        "hidden";

    mirror.style.whiteSpace =
        "pre-wrap";

    mirror.style.wordWrap =
        "break-word";

    mirror.style.width =
        editor.clientWidth + "px";

    const pos =
        editor.selectionStart;

    mirror.textContent =
        editor.value.substring(
            0,
            pos
        );

    const caret =
        document.createElement(
            "span"
        );

    caret.textContent =
        "\u200B";

    mirror.appendChild(
        caret
    );

    editor.parentElement.appendChild(
        mirror
    );

    const editorRect =
        editor.getBoundingClientRect();

    const parentRect =
        editor.parentElement
            .getBoundingClientRect();

    const caretRect =
        caret.getBoundingClientRect();

    const mirrorRect =
        mirror.getBoundingClientRect();

    menu.style.left =
        (
            editorRect.left -
            parentRect.left +
            caretRect.left -
            mirrorRect.left -
            editor.scrollLeft
        ) + "px";

    menu.style.top =
        (
            editorRect.top -
            parentRect.top +
            caretRect.top -
            mirrorRect.top +
            parseFloat(
                style.lineHeight
            ) -
            editor.scrollTop
        ) + "px";

    mirror.remove();
}


function positionSlashMenu(){

    positionEditorMenu(
        "slashMenu"
    );

}


function positionAutocompleteMenu(){

    positionEditorMenu(
        "autocompleteMenu"
    );

}



// TODO:
// Position beside caret instead of
// top-left of editor.





function insertSlashCommand(command){
    
    const editor =
        document.getElementById(
            "articleEditor"
        );

    if(!editor || !command)
        return;

    const cursor =
        editor.selectionStart;

    const before =
        editor.value.substring(
            0,
            cursor
        );

    const lineStart =
        before.lastIndexOf("\n") + 1;

    const line =
        before.substring(lineStart);

    // Remove the "/" (and optional search text)
    editor.setSelectionRange(
        lineStart,
        cursor
    );

    editor.setRangeText(
        command.insert,
        lineStart,
        cursor,
        "end"
    );



    if(

        Number.isFinite(
            command.cursor
        )

    ){

        const pos =
            lineStart +
            command.cursor;

        editor.setSelectionRange(
            pos,
            pos
        );

    }



    closeSlashMenu();

    filteredSlashCommands = [];
    slashSelected = 0;

    handleEditorChange();

    editor.focus();

}



/* ==========================================================
   SEARCH PROVIDER
   ========================================================== */

function getArticleSearchCommands(){

    if(
        !window.currentArticle
    ){
        return [];
    }

    return [

        {
            type: "article",
            context: "editor",
            category: "Editor",
            icon: "💾",
            label: "Save Article",
            keywords: ["save","write"],
            action(){
                saveArticle();
            }
        },

        {
            type: "article",
            context: "editor",
            category: "Layout",
            icon: "📝",
            label: "Editor Mode",
            keywords:["editor"],
            action(){
                setArticleLayout("editor");
            }
        },

        {
            type: "article",
            context: "editor",
            category: "Layout",
            icon: "🪟",
            label: "Split View",
            keywords:["split","preview"],
            action(){
                setArticleLayout("split");
            }
        },

        {
            type: "article",
            context: "editor",
            category: "Layout",
            icon: "👁️",
            label: "Preview Mode",
            keywords:["preview"],
            action(){
                setArticleLayout("preview");
            }
        },

        {
            type: "article",
            context: "editor",
            category: "Editor",
            icon: "🔍",
            label: "Find",
            keywords:["find","search"],
            action(){
                openFindBar();
            }
        },

        {
            type: "article",
            context: "editor",
            category: "Layout",
            icon: "⛶",
            label: "Toggle Fullscreen",
            keywords:["fullscreen","focus"],
            action(){
                document
                    .getElementById("toggleFullscreenBtn")
                    ?.click();
            }
        },

        {
            type: "article",
            context: "editor",
            category: "Layout",
            icon: "🎯",
            label: "Toggle Focus Mode",
            keywords:["focus","zen"],
            action(){
                document
                    .getElementById("toggleFocusBtn")
                    ?.click();
            }
        },

        {
            type: "article",
            context: "editor",
            category: "Export",
            icon: "📤",
            label: "Export Article",
            keywords:["export","markdown","download"],
            action(){
                exportArticle();
            }
        },

        {
            type: "article",
            context: "editor",
            category: "Media",
            icon: "📂",
            label: "Open Media Library",
            keywords:["media","images","gallery"],
            action(){
                openArticleMedia();
            }
        },

        {
            type: "article",
            context: "editor",
            category: "Media",
            icon: "🖼️",
            label: "Insert Image",
            keywords:["image","insert"],
            action(){
                openImagePicker();
            }
        }

    ];

}




function setupArticleEditor(){

    setupMarkdownShortcuts();

    setupArticleDragDrop();

    setupSplitResize();

    setupPreviewScrollSync();

    

}



window.loadArticles =
    loadArticles;


window.getArticleSearchCommands =
    getArticleSearchCommands;





document.addEventListener(
    "click",
    (e) => {

        const editBtn =
            e.target.closest(
                ".article-edit"
            );

        if (editBtn) {

            editArticle(
                editBtn.dataset.article
            );

            return;

        }



        const duplicateBtn =
            e.target.closest(
                ".article-duplicate"
            );

        if (duplicateBtn) {

            duplicateArticle(
                 duplicateBtn.dataset.article
            );

            return;

        }




        const deleteBtn =
            e.target.closest(
                ".article-delete"
            );

        if (deleteBtn) {

            deleteArticle(
                deleteBtn.dataset.article
            );

        }

    }
);










/* ==========================================================
   ARTICLE HEADER
   ========================================================== */


document
    .getElementById("backToArticlesBtn")
    ?.addEventListener(
        "click",
        async () => {

            if (
                await confirmDiscardChanges()
            ) {

                window.currentArticle = null;

                localStorage.removeItem(
                    "galleryCurrentArticle"
                );


                window.refreshSearchIndex?.();

                showPage("articles");

            }

        }
    );





document
    .getElementById("saveArticleBtn")
    ?.addEventListener(
        "click",
        saveArticle
    );





document
    .getElementById("publishArticleBtn")
    ?.addEventListener(
        "click",
        togglePublishArticle
    );





document
    .getElementById(
        "importArticleBtn"
    )
    ?.addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "importArticleFile"
                )
                .click();

        }
    );

document
    .getElementById(
        "importArticleFile"
    )
    ?.addEventListener(
        "change",
        e => {

            importArticle(
                e.target.files[0]
            );

            e.target.value = "";

        }
    ); 
    





document
    .getElementById("exportArticleBtn")
    ?.addEventListener(
        "click",
        exportArticle
    );




// ===== Editor Listeners =====




function setupEditorListeners(){

    if(editorListenerReady)
        return;


    const editor =
        document.getElementById(
            "articleEditor"
        );


    if(!editor)
        return;


    editor.addEventListener(
        "input",
        handleEditorChange
    );


    editorListenerReady = true;

}


setupEditorListeners();









document
    .getElementById(
        "toggleArticleHistoryBtn"
    )
    ?.addEventListener(
        "click",
        () => {

            setArticleHistoryCollapsed(
                !articleHistoryCollapsed
            );

        }
    );

setArticleHistoryCollapsed(
    articleHistoryCollapsed
);





document
    .getElementById("historyLoadMore")
    ?.addEventListener("click", () => {

        /*
         * Make sure this history belongs to
         * the currently open article.
         */
        if (
            !window.currentArticle ||
            articleHistoryArticle !==
                window.currentArticle
        ) {
            return;
        }

        /*
         * Nothing more to load.
         */
        if (
            visibleHistory >=
            articleHistory.length
        ) {
            return;
        }

        visibleHistory +=
            HISTORY_STEP;

        renderArticleHistory();

    });





document
    .getElementById(
        "toggleFullscreenBtn"
    )
    ?.addEventListener(
        "click",
        () => {

            articleFullscreen =
                !articleFullscreen;

            localStorage.setItem(

                "articleFullscreen",

                articleFullscreen

            );

            setArticleLayout(
                articleLayoutMode
            );

        }
    );







document.addEventListener(
    "DOMContentLoaded",
    () => {

        const markdownHelpBtn =
            document.getElementById(
                "markdownHelpBtn"
            );

        const markdownHelpModal =
            document.getElementById(
                "markdownHelpModal"
            );

        const closeMarkdownHelpBtn =
            document.getElementById(
                "closeMarkdownHelpBtn"
            );


        if (
            !markdownHelpBtn ||
            !markdownHelpModal
        ) {
            console.warn(
                "Markdown help elements not found"
            );
            return;
        }


        renderMarkdownHelp();


        // Open Help Modal
        markdownHelpBtn.addEventListener(
            "click",
            () => {

                markdownHelpModal.classList.remove(
                    "hidden"
                );

                markdownHelpModal.classList.add(
                    "open"
                );

                document.body.classList.add(
                    "modal-open"
                );

            }
        );


        // Close button
        closeMarkdownHelpBtn?.addEventListener(
            "click",
            () => {

                markdownHelpModal.classList.remove(
                    "open"
                );

                markdownHelpModal.classList.add(
                    "hidden"
                );

                document.body.classList.remove(
                    "modal-open"
                );

            }
        );


        // Click outside modal to close
        markdownHelpModal.addEventListener(
            "click",
            e => {

                if (
                    e.target.id === "markdownHelpModal"
                ) {

                    markdownHelpModal.classList.remove(
                        "open"
                    );

                    markdownHelpModal.classList.add(
                        "hidden"
                    );

                    document.body.classList.remove(
                        "modal-open"
                    );

                }

            }
        );


    }
);




    

document
    .getElementById(
        "toggleFocusBtn"
    )
    ?.addEventListener(
        "click",
        () => {

            articleFocusMode =
                !articleFocusMode;

            localStorage.setItem(

                "articleFocusMode",

                articleFocusMode

            );

            setArticleLayout(
                articleLayoutMode
            );

        }
    );


    


document
    .getElementById("editorModeBtn")
    ?.addEventListener(
        "click",
        () => {

            setArticleLayout(
                "editor"
            );

        }
    );





document
    .getElementById("splitModeBtn")
    ?.addEventListener(
        "click",
        () => {

            /*
             * Live Preview is currently visible
             * in Split mode.
             *
             * Clicking Split again collapses
             * the editor and leaves Live Preview.
             */

            if(
                livePreviewInEditor &&
                articleLayoutMode === "split"
            ){

                setArticleLayout(
                    "preview"
                );

                return;

            }

            /*
             * Otherwise normal Split behavior.
             */

            setArticleLayout(
                "split"
            );

        }
    );






document
    .getElementById("previewModeBtn")
    ?.addEventListener(
        "click",
        () => {

            /*
             * Switch to Local Preview.
             *
             * Keep the Live Preview session alive
             * so it can be restored instantly.
             */

            livePreviewInEditor = false;

            setArticleLayout(
                "preview"
            );

            showLocalPreviewInEditor();

        }
    );






document
    .getElementById("livePreviewBtn")
    ?.addEventListener(
        "click",
        () => openLivePreview()
    );

    

document
    .getElementById("openPreviewBtn")
    ?.addEventListener(
        "click",
        openPreviewInNewTab
    );



/* ==========================================================
   MARKDOWN TOOLBAR
   ========================================================== */



document
.getElementById("mdBoldBtn")
.onclick = () =>
    wrapSelection("**");

document
.getElementById("mdItalicBtn")
.onclick = () =>
    wrapSelection("*");

document
.getElementById("mdH1Btn")
.onclick = () =>
    insertLine("# ");

document
.getElementById("mdH2Btn")
.onclick = () =>
    insertLine("## ");

document
.getElementById("mdQuoteBtn")
.onclick = () =>
    insertLine("> ");

document
.getElementById("mdCodeBtn")
.onclick = () =>
    insertLine("\n```\n\n```\n");



document
.getElementById("mdLinkBtn")
.onclick = () => {

    const url = prompt("Enter URL");

    if (!url) return;

    wrapSelection("[", `](${url})`);

};




document
    .getElementById("mdMediaBtn")
    ?.addEventListener(
        "click",
        openArticleMedia
    );




/* ==========================================================
   FIND BAR
   ========================================================== */

document
    .getElementById("closeFindBtn")
    ?.addEventListener(
        "click",
        closeFindBar
    );





document.getElementById("findInput")?.addEventListener(

    "input",

    ()=>{

        updateArticleMatches();

    }

);



document
    .getElementById("findMatchCase")
    ?.addEventListener(

        "change",

        updateArticleMatches

    );




document.getElementById("findNextBtn")?.addEventListener(

    "click",

    ()=>{

        gotoArticleMatch(true);

        

    }

);

document.getElementById("findPrevBtn")?.addEventListener(

    "click",

    ()=>{

        gotoArticleMatch(false);

        

    }

);




document.getElementById("replaceBtn")?.addEventListener(

    "click",

    replaceCurrentMatch

);


document.getElementById("replaceAllBtn")?.addEventListener(

    "click",

    replaceAllMatches

);




document
    .getElementById("findInput")
    ?.addEventListener(

    "keydown",

    e=>{

        if(e.key==="Enter"){

            e.preventDefault();

            gotoArticleMatch(!e.shiftKey);

            

        }


        if(

            e.key === "F2"

        ){

            e.preventDefault();

            replaceCurrentMatch();

        }

    }

);



/* ==========================================================
   ARTICLE MEDIA
   ========================================================== */
    

document
    .getElementById(
        "closeArticleMediaBtn"
    )
    ?.addEventListener(
        "click",
        closeArticleMedia
    );

document
    .getElementById(
        "uploadArticleMediaBtn"
    )
    ?.addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "articleMediaFiles"
                )
                .click();

        }
    );





document
    .getElementById(
        "articleMediaFiles"
    )
    ?.addEventListener(
        "change",
        uploadArticleMedia
    );




document
    .getElementById(
        "articleMediaSearch"
    )
    ?.addEventListener(

        "input",

        filterArticleMedia

    );



    
document.addEventListener(

    "click",

    e => {

        const btn =
            e.target.closest(
                ".media-insert"
            );

        if (!btn)
            return;

        const editor =
            document.getElementById(
                "articleEditor"
            );

        const markdown =

`![${btn.dataset.name}](${btn.dataset.url})`;

        editor.setRangeText(

            markdown,

            editor.selectionStart,

            editor.selectionEnd,

            "end"

        );

        handleEditorChange();



        window.showToast(
            "Image inserted.",
            "success"
        );



        editor.focus();

        closeArticleMedia();

    }

);






















/* ==========================================================
   IMAGE PICKER
   ========================================================== */


document
    .getElementById(
        "closeImagePickerBtn"
    )
    ?.addEventListener(
        "click",
        closeImagePicker
    );



document
    .getElementById("pickHeroBtn")
    ?.addEventListener(
        "click",
        () => openImagePicker("hero")
    );



document
    .getElementById("insertImageBtn")
    ?.addEventListener(
        "click",
        () => openImagePicker("markdown")
    );




document
    .getElementById(
        "metaHero"
    )
    ?.addEventListener(
        "input",
        e => {

            updateHeroPreview(
                e.target.value
            );

        }
    );






document.addEventListener(

    "click",

    e=>{

        const img =
            e.target.closest(
                ".article-media-image"
            );

        if(!img)
            return;

        const url = img.dataset.full;

        if (url) {
            window.open(url, "_blank");
        }

    }

);






document.addEventListener(

    "click",

    async e => {

        const btn =
            e.target.closest(
                ".article-media-share"
            );

        if(!btn)
            return;

        const res =
            await window.api(

                `${window.API.ARTICLE_MEDIA}/share/${btn.dataset.id}`,

                {

                    method:"PATCH"

                }

            );

        if(!res.success){

            alert(res.message);

            return;

        }

        await loadArticleMedia();

    }

);



/* ==========================================================
   NEW ARTICLE MODAL
   ========================================================== */

document
    .getElementById("newArticleBtn")
    ?.addEventListener(
        "click",
        openNewArticleModal
    );




document
    .getElementById("newArticleTitle")
    ?.addEventListener(
        "input",
        e => {

            document.getElementById(
                "newArticleSlug"
            ).value =
                generateArticleSlug(
                    e.target.value
                );

        }
    );



document
    .getElementById("cancelNewArticleBtn")
    ?.addEventListener(
        "click",
        closeNewArticleModal
    );





document
    .getElementById("createNewArticleBtn")
    ?.addEventListener(
        "click",
        createNewArticle
    );



document.addEventListener(
    "keydown",
    e => {

        if (
            e.key === "Escape" &&
            document
                .getElementById("newArticleModal")
                ?.classList.contains("open")
        ) {

            closeNewArticleModal();

        }

    }
);








document
    .getElementById("newArticleModal")
    ?.addEventListener(
        "click",
        e => {

            if (
                e.target.id ===
                "newArticleModal"
            ) {

                closeNewArticleModal();

            }

        }
    );



document
    .getElementById("newArticleModal")
    ?.addEventListener(
        "keydown",
        e => {

            if (e.key === "Enter") {

                e.preventDefault();

                createNewArticle();

            }

        }
    );




/* ==========================================================
   METADATA
   ========================================================== */

[
    "metaTitle",
    "metaAuthor",
    "metaRole",
    "metaDate",
    "metaHero",
    "metaTags",
    "metaSlug",
    "metaDraft",
    "metaPopular",
    "metaProtected",
    
    "metaShowOriginal",
    "metaShowRaw",
    "metaShowCopy",
    "metaShowShare",
    "metaOriginalUrl"
    
].forEach(id => {

    const el = document.getElementById(id);

    if (!el) return;

    const event =
        el.type === "checkbox"
            ? "change"
            : "input";

    el.addEventListener(event, () => {


    // -----------------------------
    // Metadata Undo History
    // -----------------------------

        if(id === "metaTitle"){

            scheduleMetadataHistory(
                "Change Title"
            );

        }

        else if(id === "metaAuthor"){

            scheduleMetadataHistory(
                "Change Author"
            );

        }

        else if(id === "metaRole"){

            scheduleMetadataHistory(
                "Change Role"
            );

        }

        else if(id === "metaDate"){

            scheduleMetadataHistory(
                "Change Date"
            );

        }

        else if(id === "metaHero"){

            scheduleMetadataHistory(
                "Change Hero"
            );

        }

        else if(id === "metaTags"){

            scheduleMetadataHistory(
                "Change Tags"
            );

        }

        else if(id === "metaSlug"){

            scheduleMetadataHistory(
                "Change Slug"
            );

        }

        else if(id === "metaDraft"){

            pushUndoState(
                "Toggle Draft"
            );

        }

        else if(id === "metaPopular"){

            pushUndoState(
                "Toggle Popular"
            );

        }

        else if(id === "metaProtected"){

            pushUndoState(
                "Toggle Protected"
            );

        }



        articleDirty = true;
    
        draftDirty = true;

        scheduleAutosave();
            
            
            
            clearTimeout(livePreviewTimer);

            livePreviewTimer = setTimeout(
                () => {
                    updateLivePreview();
                },
                800
            );
            
            

            if (id === "metaSlug") {

                const status =
                    document.getElementById(
                        "slugStatus"
                    );

                status?.classList.add(
                    "show"
                );

                updateSlugStatus();

            }




            if (
               id === "metaDraft" ||
               id === "metaProtected"
            ) {

               updateArticleStatus();

            }


            

        }
    );

});



const slugInput =
    document.getElementById(
        "metaSlug"
    );

slugInput?.addEventListener(
    "blur",
    () => {

        document
            .getElementById(
                "slugStatus"
            )
            ?.classList.remove(
                "show"
            );

    }
);


/* SLASH */


document.addEventListener(

    "click",

    e => {

        const item =
            e.target.closest(
                ".slash-item"
            );

        if(!item)
            return;

        insertSlashCommand(

            filteredSlashCommands[
                Number(
                    item.dataset.index
                )
            ]

        );

    }

);



/* ==========================================================
   GLOBAL EVENTS
   ========================================================== */


window.addEventListener(
    "beforeunload",
    e => {

        if (!articleStateChanged()) {

            return;

        }

        e.preventDefault();

        e.returnValue = "";

    }
);




document
    .getElementById("metaHeader")
    ?.addEventListener(
        "click",
        toggleMetadata
    );



document
    .getElementById("displayHeader")
    ?.addEventListener(
        "click",
        toggleDisplay
    );







document
    .getElementById("articleSearch")
    ?.addEventListener("input", e => {

        filterArticles(e.target.value);

    });











/* ==========================================================
   TABLE OF CONTENTS
   ========================================================== */


document
    .getElementById(
        "articleTocList"
    )
    ?.addEventListener(
        "click",
        e => {


            const toggle =
                e.target.closest(
                    ".toc-toggle"
                );

            if(toggle){

                e.stopPropagation();

                toggleTocSection(
                    toggle.dataset.section
                );

                return;

            }

            const item =
                e.target.closest(
                    ".toc-item"
                );

            if (!item) return;

            const editor =
                document.getElementById(
                    "articleEditor"
                );

            const position =
                Number(
                    item.dataset.position
                );

            editor.focus();

            editor.setSelectionRange(
                position,
                position
            );



            document
                .querySelectorAll(".toc-item")
                .forEach(item =>

                    item.classList.remove(
                        "active"
                    )

                );

            item.classList.add(
                "active"
            );




            updateActiveToc();

            const lineHeight =
                parseFloat(
                    getComputedStyle(editor).lineHeight
                ) || 20;

            const line =
                editor.value
                    .substring(0, position)
                    .split("\n").length - 1;

            const target =

                Math.max(

                    0,

                    line * lineHeight -

                    editor.clientHeight / 2

                );

            editor.scrollTo({

                top: target,

                behavior: "smooth"

            });

        }
    );











document
.getElementById("undoEditorBtn")
?.addEventListener(
    "click",
    undoArticle
);


document
.getElementById("redoEditorBtn")
?.addEventListener(
    "click",
    redoArticle
);





document.addEventListener(
    "keydown",
    e => {

        if(
            !(e.ctrlKey || e.metaKey)
        ){
            return;
        }


        const target = e.target;
        
        
        const editorPage =
        document.getElementById("articleEditorPage");


        if(
            !editorPage ||
            !editorPage.contains(target)
        ){
            return;
        }


        // Ignore controls
        if(
            target.tagName === "BUTTON" ||
            target.tagName === "SELECT"
        ){
            return;
        }



        // Undo
        if(
            e.key.toLowerCase() === "z" &&
            !e.shiftKey
        ){

            e.preventDefault();

            undoArticle();

            return;
        }



        // Redo Ctrl + Y
        if(
            e.key.toLowerCase() === "y"
        ){

            e.preventDefault();

            redoArticle();

            return;
        }



        // Redo Ctrl + Shift + Z
        if(
            e.key.toLowerCase() === "z" &&
            e.shiftKey
        ){

            e.preventDefault();

            redoArticle();

            return;
        }


    }
);











setupArticleEditor();