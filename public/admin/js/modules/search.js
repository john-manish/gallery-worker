

// ======================================
// SEARCH STATE
// ======================================


let searchResults = [];
let selectedResult = -1;

let recentCommands =
    JSON.parse(
        localStorage.getItem(
            "recentCommands"
        ) || "[]"
    );



// ======================================
// CONTEXT
// ======================================

function getSearchContext(){

    if(window.currentArticle){
        return "editor";
    }

    return state.currentPage || "global";

}




// ======================================
// FUZZY MATCH
// ======================================

function fuzzyMatch(text, query){

    text =
        text.toLowerCase();

    query =
        query.toLowerCase();

    let j = 0;

    for(const ch of text){

        if(ch === query[j]){
            j++;
        }

        if(j === query.length){
            return true;
        }

    }

    return false;

}



// ======================================
// SEARCH RANKING
// ======================================

function scoreCommand(item, query){

    const q =
        query.toLowerCase();

    const label =
        item.label.toLowerCase();

    if(
        label === q
    ){
        return 100;
    }

    if(
        label.startsWith(q)
    ){
        return 90;
    }

    if(
        item.keywords?.some(
            keyword =>
                String(keyword)
                    .toLowerCase()
                    .startsWith(q)
        )
    ){
        return 80;
    }

    if(
        label.includes(q)
    ){
        return 70;
    }

    if(
        item.keywords?.some(
            keyword =>
                String(keyword)
                    .toLowerCase()
                    .includes(q)
        )
    ){
        return 60;
    }

    if(
        item.type
            .toLowerCase()
            .includes(q)
    ){
        return 50;
    }

    // Fuzzy label match
    if(
        fuzzyMatch(
            label,
            q
        )
    ){
        return 40;
    }

    // Fuzzy keyword match
    if(
        item.keywords?.some(
            keyword =>
                fuzzyMatch(
                    String(keyword),
                    q
                )
        )
    ){
        return 30;
    }
    
    return 0;

}




// ======================================
// BUILD SEARCH INDEX
// ======================================

function buildSearchIndex(){

    const items = [];

    // Pages

    [
        "dashboard",
        "albums",
        "images",
        "upload",
        "analytics",
        "scanner",
        "explorer",
        "assistant",
        "settings"
    ].forEach(page => {

        items.push({

            type: "page",
            context: "global",

            label:
                page.charAt(0)
                    .toUpperCase() +
                page.slice(1),

            action(){
                showPage(page);
            }

        });

    });


    // Albums

    (state.albums || [])
        .forEach(album => {

            items.push({

                type: "album",
                context: "gallery",

                label: album.name,

                action(){

                    showPage("images");

                    if(
                        dom.imageAlbumFilter
                    ){

                        dom.imageAlbumFilter.value =
                            album.name;

                        renderImages();
                    }

                }

            });

        });


    // Images

    (state.allImages || [])
        .forEach(image => {

            items.push({
                type: "image",
                context: "gallery",

                label:
                    image.name ||
                    image.filename,

                thumb:
                   image.thumb ||
                   image.thumbnail ||
                   image.thumbUrl ||
                   image.url,


                keywords: [

                    image.name,
                    image.filename,
                    image.album,

                    "image",
                    "jpg",
                    "jpeg",
                    "png",
                    "webp",
                    "gif"

               ],

               action(){
    
                    showPage("images");

                    if(dom.imageSearch){

                        dom.imageSearch.value =
                            image.name ||
                            image.filename;

                        renderImages();
                      }
                  }
            });

        });


    // Actions

    [
        {
            label:
                "Create Album",

            action(){
                dom.newAlbumBtn?.click();
            }
        },

        {
            label:
                "Upload Images",

            action(){
                showPage("upload");
            }
        },

        {
            label:
                "Scan Gallery",

            action(){
                dom.scanGalleryBtn?.click();
            }
        },

        {
            label:
                "Refresh Albums",

            action(){
                dom.refreshAlbums?.click();
            }
        },

        {
            label:
                "Open Workspace",

            action(){
                showPage("settings");
            }
        }

    ].forEach(action => {

        items.push({

            type: "action",
            context: "global",

            label:
                action.label,

            action:
                action.action

        });

    });

 
   


    // ======================================
    // ARTICLE COMMANDS
    // ======================================

    if (
        typeof getArticleSearchCommands === "function"
    ) {

        items.push(
            ...getArticleSearchCommands()
        );

    }

   

    state.searchIndex =
        items;

    searchResults =
        [...items];
}


// ======================================
// OPEN
// ======================================

function openCommandPalette(){

    if(
        !dom.commandOverlay
    ){
        return;
    }
    
    if(
        !state.searchIndex.length
    ){
        buildSearchIndex();
    }

    dom.commandOverlay
        .classList
        .remove(
            "hidden"
        );

    selectedResult = -1;

    dom.commandInput.value =
        "";

    requestAnimationFrame(() => {
        searchCommands("");
    });

  
    requestAnimationFrame(() => {
    if (!dom.commandInput) return;

    dom.commandInput.focus();
    dom.commandInput.click();

    requestAnimationFrame(() => {
        dom.commandInput.focus();
    });

});


}

 
// ======================================
// CLOSE
// ======================================

function closeCommandPalette(){

    dom.commandOverlay
        ?.classList
        .add(
            "hidden"
        );

    selectedResult = -1;
}


// ======================================
// SEARCH
// ======================================

function searchCommands(query){

    const q =
        query
            .trim()
            .toLowerCase();

    searchResults =
        !q
            ? [

                ...recentCommands
                    .map(
                        label =>
                            state.searchIndex.find(
                                item =>
                                    item.label ===
                                    label
                            )
                    )
                    .filter(Boolean),

                ...state.searchIndex.filter(
                    item =>
                        !recentCommands
                            .includes(
                                item.label
                            )
                )

            ]

            : state.searchIndex

                .filter(item => {

                    const context =
                        getSearchContext();

                    return (

                        !item.context ||
            
                        item.context === "global" ||
            
                        item.context === context ||

                        (
                            context === "editor" &&
                            item.context === "gallery"
                        )

                    );

                })

                .map(item => ({

                    item,

                    score: scoreCommand(
                        item,
                        q
                    )

                }))

                .filter(result =>
                    result.score > 0
                )

                .sort(
                    (a, b) =>
                        b.score - a.score
                )

                .map(result =>
                    result.item
                );

    searchResults =
        searchResults.slice(0, 20);

    selectedResult =
        searchResults.length
            ? 0
            : -1;

    renderCommandResults(
        searchResults
    );
}


// ======================================
// RENDER
// ======================================

function renderCommandResults(results){

    if(
        !dom.commandResults
    ){
        return;
    }

    if(
        !results.length
    ){

        dom.commandResults.innerHTML =
        `
            <div class="command-empty">
                No results found
            </div>
        `;

        return;
    }
    
    
    const showRecent =
        recentCommands.length &&
        !dom.commandInput.value.trim();

    if(showRecent){

        const recentLabels =
            new Set(recentCommands);

        const recentItems =
            results.filter(
                item =>
                    recentLabels.has(
                        item.label
                    )
            );

        const otherItems =
            results.filter(
                item =>
                    !recentLabels.has(
                        item.label
                    )
            );

        results = [

            ...(recentItems.length
                ? [
                    {
                        type: "header",
                        label: "Recent"
                    },
                    ...recentItems
                ]
                : []),

            ...(otherItems.length
                ? [
                    {
                        type: "header",
                        label: "All Results"
                    },
                    ...otherItems
                ]
                : [])

        ];
    }
    
    let realIndex = -1;

    dom.commandResults.innerHTML =
        results.map(
            (
               item,
               index
            ) => {

              if(
                   item.type ===
                  "header"
             ){

                  return `
                      <div
                           class="
                              command-section
                          "
                      >
                          ${item.label}
                      </div>
                   `;
               }

               return `
                   <div
                       class="
                          command-item
                          ${
                              realIndex + 1 ===       selectedResult
                              ? "active"
                              : ""
                          }
                      "
                      data-index="${
                          ++realIndex
                      }"
                  >

            <div class="command-icon">

               ${
                   item.type === "image" && item.thumb
                       ? `
                          <img
                            src="${item.thumb}"
                            alt=""
                            loading="lazy"
                            decoding="async"
                          >
                        `
                       : item.icon
                            ? item.icon
                       : item.type === "page"
                           ? "📄"
                       : item.type === "album"
                           ? "📁"
                       : item.type === "image"
                           ? "🖼"
                       : "⚡"
             }

            </div>

            <div class="command-body">

                <div class="command-title">
                    ${item.label}
                </div>

                <div class="command-subtitle">
                    ${
                        item.category ||
                        ({
                            page: "Navigation",
                            album: "Album",
                            image: "Image",
                            action: "Action",
                            article: "Article"
                        }[item.type] || item.type)
                    }
                </div>

            </div>

        </div>
        
        `;
        
      }
    ).join("");
}


// ======================================
// SELECT
// ======================================

function selectCommandItem(index){

    const item =
        searchResults[index];

    if(
        !item
    ){
        return;
    }

    recentCommands.unshift(
        item.label
    );

    recentCommands =
    [
        ...new Set(
            recentCommands
        )
    ].slice(0, 6);
    
    
    localStorage.setItem(
        "recentCommands",
        JSON.stringify(
            recentCommands
        )
    );
    

    item.action?.();

    closeCommandPalette();
    }


// ======================================
// KEYBOARD
// ======================================

function moveSelection(direction){

    if(
        !searchResults.length
    ){
        return;
    }

    selectedResult +=
        direction;

    if(
        selectedResult < 0
    ){
        selectedResult =
            searchResults.length - 1;
    }

    if(
        selectedResult >=
        searchResults.length
    ){
        selectedResult = 0;
    }

    updateActiveResult();

    
}




function updateActiveResult(){

    const items =
        dom.commandResults
            .querySelectorAll(
                ".command-item"
            );

    items.forEach(
        item =>
            item.classList.remove(
                "active"
            )
    );

    items[
        selectedResult
    ]?.classList.add(
        "active"
    );

    items[
        selectedResult
    ]?.scrollIntoView({
        block:"nearest"
    });
}




// ======================================
// EVENTS
// ======================================

function bindSearchEvents(){

    on(
        dom.globalSearch,
        "click",
        openCommandPalette
    );

    on(
        dom.globalSearch,
        "focus",
        openCommandPalette
    );
    
    
    on(
        dom.mobileSearchBtn,
        "click",
        openCommandPalette
    );

on(
    dom.mobileSearchBtn,
    "touchstart",
    e => {
        e.preventDefault();
        openCommandPalette();
    }
);

    let searchTimer;

    on(
        dom.commandInput,
        "input",
        e => {

            clearTimeout(searchTimer);

            searchTimer =
                setTimeout(() => {

                    searchCommands(
                        e.target.value
                    );

                }, 50);

        }
    );

    on(
        dom.commandResults,
        "click",
        e => {

            const item =
                e.target.closest(
                    ".command-item"
                );

            if(
                !item
            ){
                return;
            }

            selectCommandItem(
                Number(
                    item.dataset
                        .index
                )
            );

        }
    );

    on(
        dom.commandOverlay,
        "click",
        e => {

            if(
                e.target ===
                dom.commandOverlay
            ){
                closeCommandPalette();
            }

        }
    );

    document
        .addEventListener(
            "keydown",
            e => {

                if(
                    (
                        e.ctrlKey ||
                        e.metaKey
                    ) &&
                    e.key
                        .toLowerCase() ===
                    "k"
                ){

                    e.preventDefault();

                    openCommandPalette();

                    return;
                }

                if(
                    dom.commandOverlay
                        ?.classList
                        .contains(
                            "hidden"
                        )
                ){
                    return;
                }

                switch(
                    e.key
                ){

                    case
                    "ArrowDown":

                        e.preventDefault();

                        moveSelection(
                            1
                        );

                        break;

                    case
                    "ArrowUp":

                        e.preventDefault();

                        moveSelection(
                            -1
                        );

                        break;

                    case
                    "Enter":

                        e.preventDefault();

                        selectCommandItem(
                            selectedResult
                        );

                        break;

                    case
                    "Escape":

                        closeCommandPalette();

                        break;
                }
            }
        );
}


// ======================================
// PUBLIC
// ======================================

window.refreshSearchIndex =
    function(){

        buildSearchIndex();

    };

