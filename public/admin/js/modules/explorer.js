
// ======================================
// GALLERY OS EXPLORER V2
// Part 1 - Core + Data Layer
// ======================================


// ======================================
// STATE
// ======================================

let explorerState = {

    source: "hybrid",

    data: {

        images: [],
        health: {},
        storage: {},
        tree: null

    },

    currentFolder: null,
     
    
    breadcrumb:[
        {
            name:"Explorer"
        }
    ],

    selectedImage: null,

    expandedFolders: []

};





// ======================================
// PUBLIC API
// ======================================


async function renderExplorer(){

    const tree =
        document.getElementById(
            "explorerTree"
        );


    const files =
        document.getElementById(
            "explorerFiles"
        );


    if(!tree || !files){
        return;
    }


    try{


        tree.innerHTML = `
            <div class="empty-state">
                Loading explorer...
            </div>
        `;


        files.innerHTML = "";



        const data =
            await getExplorerData();



        explorerState.data =
            data;



        renderExplorerUI();



        initExplorerEvents();


    }
    catch(err){


        console.error(
            "Explorer error:",
            err
        );


        tree.innerHTML = `

            <div class="empty-state">

                <div>📂</div>

                <p>
                    Failed loading explorer
                </p>

            </div>

        `;

    }


}





// ======================================
// DATA FETCHING
// ======================================


async function getExplorerData(){


const source =
    explorerState.source;



const [
    filesRes,
    storageRes,
    healthRes,
    treeRes
] = await Promise.all([


    fetch(
        `/admin/explorer/files?source=${source}`
    ),


    fetch(
        "/admin/explorer/storage"
    ),


    fetch(
        "/admin/health"
    )
    
    ,
    fetch(
     `/admin/explorer/tree?source=${source}`
   )


]);



const filesData =
    await filesRes.json();


const storage =
    await storageRes.json();


const health =
    await healthRes.json();

const tree =
    await treeRes.json();
    
    

return {

    images:
        filesData.files || [],

    health,

    storage:
        storage.storage || {},

    tree:
        tree.tree || null
};


}










// ======================================
// MAIN UI RENDER
// ======================================


function renderExplorerUI(){


    renderExplorerBreadcrumb();


    renderExplorerTree();


    const files =
        document.getElementById(
            "explorerFiles"
        );


    if(files){

        files.innerHTML =
            explorerEmpty(
                "Select a folder"
            );

    }


    renderExplorerStorage();


}




function renderExplorerBreadcrumb(){

    const el =
        document.getElementById(
            "explorerBreadcrumb"
        );

    if(!el){
        return;
    }

    el.innerHTML =
        explorerState.breadcrumb
        .map(
            (item,index)=>{

                const name =
                    typeof item === "string"
                        ? item
                        : item.name;

                const clickable =
                    index <
                    explorerState.breadcrumb.length - 1;

                return `

                    <span
                        class="explorer-breadcrumb-item ${
                            clickable
                                ? "clickable"
                                : "current"
                        }"
                        data-breadcrumb-index="${index}"
                    >
                        ${escapeExplorerText(name)}
                    </span>

                    ${
                        clickable
                            ? " / "
                            : ""
                    }

                `;

            }
        )
        .join("");


    bindBreadcrumbClicks();

}






function findExplorerNode(
    node,
    targetPath,
    parents = []
){

    if(!node){
        return null;
    }

    const nodePath =
        node.id ||
        node.path ||
        "";

    if(
        node.type !== "root" &&
        nodePath === targetPath
    ){

        return {
            node,
            parents
        };

    }

    const nextParents =
        node.type === "root"
            ? []
            : [
                ...parents,
                node
            ];

    for(
        const child of (
            node.children || []
        )
    ){

        const result =
            findExplorerNode(
                child,
                targetPath,
                nextParents
            );

        if(result){
            return result;
        }

    }

    return null;
}



function buildExplorerBreadcrumb(targetPath){

    const found =
        findExplorerNode(
            explorerState.data.tree,
            targetPath
        );

    if(!found){

        return [
            {
                name:"Explorer"
            }
        ];

    }


    const chain = [
        ...found.parents,
        found.node
    ];


    /*
     * Remove the internal API root.
     * Gallery OS is no longer a navigation level.
     */
    const filteredChain =
        chain.filter(
            node =>
                node.type !== "root" &&
                node.name !== "Gallery OS"
        );


    return [
        {
            name:"Explorer"
        },

        ...filteredChain.map(
            node => ({

                name:
                    node.name ||
                    "Unknown",

                id:
                    node.id ||
                    node.path ||
                    "",

                source:
                    node.source ||
                    explorerState.source

            })
        )

    ];

}



function expandExplorerPath(targetPath){

    const found =
        findExplorerNode(
            explorerState.data.tree,
            targetPath
        );

    if(!found){
        return;
    }

    const nodes =
        found.parents;

    let parentKey = "root";

    nodes.forEach(node => {

        if(node.type === "root"){
            return;
        }

        const nodeKey =
            `${parentKey}/${node.source || ""}/${node.name || node.id || node.path}`;

        if(
            !explorerState.expandedFolders.includes(
                nodeKey
            )
        ){

            explorerState.expandedFolders.push(
                nodeKey
            );

        }

        parentKey = nodeKey;

    });

}




function collapseExplorerBelow(targetPath){

    const found =
        findExplorerNode(
            explorerState.data.tree,
            targetPath
        );

    if(!found){
        return;
    }


    /*
     * Build the complete path:
     * root -> parents -> selected folder
     */
    const nodes = [
        ...found.parents,
        found.node
    ];


    const validKeys = [];

    let parentKey = "root";


    nodes.forEach(node => {

        if(node.type === "root"){
            return;
        }


        const nodeKey =
            `${parentKey}/${node.source || ""}/${node.name || node.id || node.path}`;


        validKeys.push(nodeKey);

        parentKey = nodeKey;

    });


    /*
     * Keep only the folders required
     * to reach the selected folder.
     *
     * Everything below it is collapsed.
     */
    explorerState.expandedFolders =
        explorerState.expandedFolders.filter(
            key =>
                validKeys.includes(key)
        );

}




function bindBreadcrumbClicks(){

    document
        .querySelectorAll(
            ".explorer-breadcrumb-item.clickable"
        )
        .forEach(item=>{

            item.onclick = ()=>{

                const index =
                    Number(
                        item.dataset.breadcrumbIndex
                    );


                const entry =
                    explorerState.breadcrumb[
                        index
                    ];


                /*
                 * =========================
                 * ROOT
                 * =========================
                 */
                if(index === 0){

                    explorerState.currentFolder =
                        null;

                    explorerState.currentSource =
                        explorerState.source;


                    explorerState.breadcrumb = [
                        {
                            name:"Explorer"
                        }
                    ];


                    /*
                     * Completely collapse tree
                     * when returning to root.
                     */
                    explorerState.expandedFolders = [];


                    renderExplorerBreadcrumb();

                    renderExplorerTree();

                    bindTree();


                    const files =
                        document.getElementById(
                            "explorerFiles"
                        );


                    if(files){

                        files.innerHTML =
                            explorerEmpty(
                                "Select a folder"
                            );

                    }


                    return;

                }


                /*
                 * =========================
                 * VALIDATE
                 * =========================
                 */
                if(
                    !entry ||
                    !entry.id
                ){

                    return;

                }


                /*
                 * IMPORTANT:
                 * Always use the source stored
                 * inside this breadcrumb entry.
                 *
                 * This prevents Drive from
                 * accidentally becoming Hybrid.
                 */
                const source =
                    entry.source ||
                    explorerState.source;


                /*
                 * =========================
                 * CUT BREADCRUMB
                 * =========================
                 */
                explorerState.breadcrumb =
                    explorerState.breadcrumb.slice(
                        0,
                        index + 1
                    );


                explorerState.currentFolder =
                    entry.name;

                explorerState.currentSource =
                    source;


                /*
                 * =========================
                 * AUTO COLLAPSE
                 * =========================
                 *
                 * Remove folders deeper than
                 * the selected breadcrumb.
                 */
                collapseExplorerBelow(
                    entry.id
                );


                /*
                 * Make sure all ancestors required
                 * to reach this folder are expanded.
                 */
                expandExplorerPath(
                    entry.id
                );


                /*
                 * =========================
                 * TREE
                 * =========================
                 */
                renderExplorerTree();

                bindTree();


                /*
                 * Mark selected folder active.
                 */
                document
                    .querySelectorAll(
                        ".explorer-tree-item"
                    )
                    .forEach(
                        el =>
                            el.classList.remove(
                                "active"
                            )
                    );


                const matchingTreeItem =
                    document.querySelector(
                        `.explorer-tree-item[data-path="${CSS.escape(
                            encodeURIComponent(
                                entry.id
                            )
                        )}"]`
                    );


                if(matchingTreeItem){

                    matchingTreeItem.classList.add(
                        "active"
                    );

                }


                /*
                 * =========================
                 * BREADCRUMB
                 * =========================
                 */
                renderExplorerBreadcrumb();


                /*
                 * =========================
                 * LOAD FOLDER
                 * =========================
                 *
                 * Use the exact Drive/Local
                 * source stored in breadcrumb.
                 */
                renderExplorerFolderContents(
                    entry.id,
                    source
                );

            };

        });

}



// ======================================
// SOURCE MODE
// ======================================


function setExplorerSource(
    source
){


    explorerState.source =
        source;



    renderExplorerUI();


}







function getSourceIcon(
    source
){


    switch(source){


        case "drive":

            return "☁";


        case "local":

            return "📁";


        default:

            return "🔄";

    }

}






function getSourceLabel(
    source
){


    switch(source){


        case "drive":

            return "DRIVE";


        case "local":

            return "LOCAL";


        default:

            return "HYBRID";


    }

}





// ======================================
// SOURCE FILTERING
// ======================================














// ======================================
// SOURCE BADGE
// ======================================


function renderSourceBadge(
    source="hybrid"
){


    return `

        <span class="source-badge source-${source}">

            ${getSourceIcon(source)}
            ${getSourceLabel(source)}

        </span>

    `;

}







// ======================================
// EMPTY STATE
// ======================================


function explorerEmpty(
    text
){


    return `

        <div class="empty-state">

            <div>📂</div>

            <p>
                ${text}
            </p>

        </div>

    `;


}







// ======================================
// TREE RENDERER
// ======================================



function filterExplorerTree(node, source){

    if(!node) return null;

    if(node.type === "file")
        return null;


    const children =
        (node.children || [])
        .map(child =>
            filterExplorerTree(child, source)
        )
        .filter(Boolean);


    // keep root always
    if(node.type === "root"){
        return {
            ...node,
            children
        };
    }


    // source match
    if(
        source === "hybrid" ||
        node.source === source ||
        node.source === "hybrid"
    ){
        return {
            ...node,
            children
        };
    }


    // keep parent if children match
    if(children.length){
        return {
            ...node,
            children
        };
    }


    return null;
}




function renderExplorerTree(){

    const tree =
        document.getElementById(
            "explorerTree"
        );

    if(!tree)
        return;


    const data =
        filterExplorerTree(
            explorerState.data.tree,
            explorerState.source
        );


    if(!data){

        tree.innerHTML =
            explorerEmpty(
                "No folders"
            );

        return;

    }


    /*
     * Do NOT render the internal API root.
     *
     * Its children are the real storage roots:
     * Google Drive
     * Server Storage
     */
    tree.innerHTML =
        (data.children || [])
            .map(
                child =>
                    renderTreeNode(
                        child,
                        0,
                        "root"
                    )
            )
            .join("");

}



function renderTreeNode(
    node,
    level = 0,
    parentKey = "root"
){

    if(node.type === "file"){
        return "";
    }

    // Actual folder ID/path used by the API
    const nodePath =
        node.id ||
        node.path ||
        "";

    // Unique key used ONLY for expand/collapse
    const nodeKey =
        node.type === "root"
            ? "root"
            : `${parentKey}/${node.source || ""}/${node.name || nodePath}`;

    const isExpanded =
        node.type === "root" ||
        explorerState.expandedFolders.includes(
            nodeKey
        );

    return `

    <div class="explorer-node">

        <div
            class="explorer-tree-item"
            data-path="${encodeURIComponent(nodePath)}"
            data-node-key="${encodeURIComponent(nodeKey)}"
            data-folder="${escapeExplorerText(node.name || "")}"
            data-type="${node.type}"
            data-source="${node.source || ""}"
            style="--level:${level}"
        >

            <span class="explorer-tree-indent"></span>

            <span class="explorer-tree-icon">
                ${
                    node.children &&
                    node.children.length
                        ? (
                            isExpanded
                                ? "📂"
                                : "📁"
                        )
                        : "📁"
                }
            </span>

            <span class="explorer-tree-name">
                ${escapeExplorerText(node.name)}
            </span>

        </div>

        ${
            node.children &&
            node.children.length &&
            isExpanded

            ?

            `
            <div class="explorer-tree-children">

                ${
                    node.children
                        .map(
                            child =>
                                renderTreeNode(
                                    child,
                                    level + 1,
                                    nodeKey
                                )
                        )
                        .join("")
                }

            </div>
            `

            :

            ""
        }

    </div>

    `;
}







// ======================================
// FILE PANEL
// ======================================





















// ======================================
// STORAGE VIEW
// ======================================


function renderExplorerStorage(){

    const container =
        document.getElementById(
            "explorerStorage"
        );

    if(!container){
        return;
    }

    const storage =
        explorerState.data.storage || {};

    const driveBytes =
        Number(storage.drive || 0);

    const localBytes =
        Number(storage.local || 0);

    const totalBytes =
        Number(storage.total || 0);


    container.innerHTML = `

        <div class="explorer-storage-card">

            <small>
                ☁ Drive
            </small>

            <strong>
                ${formatBytes(driveBytes)}
            </strong>

        </div>


        <div class="explorer-storage-card">

            <small>
                📁 Local
            </small>

            <strong>
                ${formatBytes(localBytes)}
            </strong>

        </div>


        <div class="explorer-storage-card">

            <small>
                Total
            </small>

            <strong>
                ${formatBytes(totalBytes)}
            </strong>

        </div>

    `;

}









// ======================================
// SEARCH SUPPORT
// ======================================


function filterExplorer(){


    const input =
        document.getElementById(
            "explorerSearch"
        );



    if(!input){
        return;
    }



    input.oninput = () => {


        const query =
            input.value
                .trim()
                .toLowerCase();



        document
            .querySelectorAll(
                ".explorer-file"
            )
            .forEach(
                item => {


                const match =
                    item.textContent
                        .toLowerCase()
                        .includes(
                            query
                        );



                item.style.display =
                    match
                    ? ""
                    : "none";


            });


    };


}









// ======================================
// HELPERS
// ======================================








function getImageSize(image){

    if(!image.size){
        return "Unknown";
    }

    const bytes = Number(image.size);

    if(bytes < 1024 * 1024){

        return (
            bytes / 1024
        ).toFixed(1) + " KB";

    }

    return (
        bytes / 1024 / 1024
    ).toFixed(1) + " MB";

}




function getExplorerFolderCount(item){

    if(!item){
        return null;
    }

    // Use an explicit count if the API provides one
    const count =
        item.itemCount ??
        item.count ??
        item.childCount ??
        item.childrenCount ??
        item.fileCount;

    if(
        count !== undefined &&
        count !== null
    ){
        return Number(count);
    }

    // Otherwise derive the count from the Explorer tree
    const folderId =
        item.id ||
        item.path ||
        "";

    const found =
        findExplorerNode(
            explorerState.data.tree,
            folderId
        );

    if(
        found &&
        found.node &&
        Array.isArray(found.node.children)
    ){
        return found.node.children.length;
    }

    return null;
}




function escapeExplorerText(
    value
){


    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        );

}







// ======================================
// EVENTS
// ======================================


function initExplorerEvents(){


    bindSourceSelector();


    bindRefresh();


    bindTree();


    filterExplorer();


}








// ======================================
// SOURCE SELECTOR
// ======================================


function bindSourceSelector(){


    const selector =
        document.getElementById(
            "explorerSource"
        );



    if(!selector){
        return;
    }



    selector.value =
        explorerState.source;



    selector.onchange =
        () => {


            setExplorerSource(
                selector.value
            );


        };


}








// ======================================
// REFRESH
// ======================================


function bindRefresh(){


    const btn =
        document.getElementById(
            "refreshExplorerBtn"
        );



    if(!btn){
        return;
    }



    btn.onclick =
        () => {


            renderExplorer();


        };


}









// ======================================
// FILE EVENTS
// ======================================








// ======================================
// TREE EVENTS
// ======================================

function bindTree(){

    document
    .querySelectorAll(
        ".explorer-tree-item"
    )
    .forEach(item=>{

        item.onclick = ()=>{

            document
            .querySelectorAll(
                ".explorer-tree-item"
            )
            .forEach(
                el =>
                    el.classList.remove(
                        "active"
                    )
            );

            item.classList.add(
                "active"
            );


            const folder =
                item.dataset.folder;

            const nodePath =
                decodeURIComponent(
                    item.dataset.path
                );

            const source =
                item.dataset.source ||
                explorerState.source;


            /*
             * Expand / collapse tree node
             */
            const nodeKey =
                decodeURIComponent(
                    item.dataset.nodeKey
                );

            const expanded =
                explorerState.expandedFolders;

            if(
                expanded.includes(nodeKey)
            ){

                explorerState.expandedFolders =
                    expanded.filter(
                        key =>
                            key !== nodeKey
                    );

            }else{

                explorerState.expandedFolders =
                    [
                        ...expanded,
                        nodeKey
                    ];

            }


            /*
             * Current folder
             */
            explorerState.currentFolder =
                folder;

            explorerState.currentSource =
                source;


            /*
             * Build the COMPLETE
             * breadcrumb from the tree.
             */
            explorerState.breadcrumb =
                buildExplorerBreadcrumb(
                    nodePath
                );


            renderExplorerBreadcrumb();


            /*
             * Re-render tree so
             * expansion state stays correct.
             */
            renderExplorerTree();

            bindTree();


            /*
             * Browse folder contents.
             */
            if(
                item.dataset.type === "folder"
            ){

                renderExplorerFolderContents(
                    nodePath,
                    source
                );

            }

        };

    });

}


 







async function renderExplorerFolderContents(
    folderId,
    source
){

    const files =
        document.getElementById(
            "explorerFiles"
        );


    if(!files)
        return;


    files.innerHTML =
        explorerEmpty(
            "Loading..."
        );


    try{


        const res =
            await fetch(
                `/admin/explorer/folder?id=${encodeURIComponent(folderId)}&source=${source}`
            );


        const data =
            await res.json();



        const items =
            data.items || [];


        // Folders first, then files.
        // Alphabetical within each group.
        const sortedItems =
            [...items].sort((a, b) => {

                const aIsFolder =
                    a.type === "folder";

                const bIsFolder =
                    b.type === "folder";

                if(aIsFolder !== bIsFolder){
                    return aIsFolder ? -1 : 1;
                }

                return String(a.name || "")
                    .localeCompare(
                        String(b.name || ""),
                        undefined,
                        { sensitivity:"base" }
                    );
            });



        if(!items.length){

            files.innerHTML =
                explorerEmpty(
                    "Empty folder"
                );

            return;

        }



        files.innerHTML = `

        <div class="explorer-file-grid">

        ${
            sortedItems.map(item => {

    const isFolder =
        item.type === "folder";

    const isImage =
        !isFolder && isImageFile(item);

    const source =
        item.source || source;

    const fileUrl =
        !isFolder
            ? getExplorerFileUrl({
                ...item,
                source
            })
            : null;

    return `
        <div
            class="explorer-file folder-content-item ${
                isFolder
                    ? "is-folder"
                    : "is-file"
            }"
            data-id="${encodeURIComponent(
                item.id || item.path || ""
            )}"
            data-name="${escapeExplorerText(
                item.name || ""
            )}"
            data-source="${source}"
            data-type="${item.type}"
            data-url="${
                item.url
                    ? escapeExplorerText(item.url)
                    : ""
            }"
            data-mime="${escapeExplorerText(
                item.mimeType ||
                item.mime ||
                item.contentType ||
                ""
            )}"
        >

            <div class="explorer-file-preview">

                ${
                    isFolder

                    ? `
                        <div class="explorer-folder-icon">
                            📁
                        </div>
                    `

                    : isImage && fileUrl

                    ? `
                        <img
                            class="explorer-file-thumb"
                            src="${escapeExplorerText(fileUrl)}"
                            alt=""
                            loading="lazy"
                            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                        >

                        <div
                            class="explorer-file-fallback"
                            style="display:none"
                        >
                            📄
                        </div>
                    `

                    : `
                        <div class="explorer-file-icon">
                            📄
                        </div>
                    `
                }

            </div>


            <div class="explorer-file-info">

                <strong
                    class="explorer-file-name"
                    title="${escapeExplorerText(
                        item.name || ""
                    )}"
                >
                    ${escapeExplorerText(
                        item.name || "Unnamed"
                    )}
                </strong>


                <div class="explorer-file-meta">

                    ${
                        isFolder

                        ? `
                            <span>
                                Folder
                            </span>

                            ${
                                getExplorerFolderCount(item) !== null
                                    ? `
                                        <span>·</span>
                                        <span>
                                            ${getExplorerFolderCount(item)} items
                                        </span>
                                    `
                                    : ""
                            }
                        `

                        : `
                            <span>
                                ${
                                    getFileExtension(
                                        item.name
                                    ).toUpperCase() ||
                                    "FILE"
                                }
                            </span>

                            ${
                                item.size
                                    ? `
                                        <span>·</span>
                                        <span>
                                            ${getImageSize(item)}
                                        </span>
                                    `
                                    : ""
                            }
                        `
                    }

                </div>


                <div class="explorer-file-source">
                    ${renderSourceBadge(source)}
                </div>

            </div>

        </div>
    `;

}).join("")
        }

        </div>

        `;


        bindFolderContentClicks();



    }
    catch(err){

        console.error(
            "Folder loading failed:",
            err
        );


        files.innerHTML =
            explorerEmpty(
                "Failed loading folder"
            );

    }

}





function bindFolderContentClicks(){

    document
        .querySelectorAll(
            ".folder-content-item"
        )
        .forEach(item => {

            item.onclick = async () => {

                const type =
                    item.dataset.type;


                const id =
                    decodeURIComponent(
                        item.dataset.id
                    );


                const source =
                    item.dataset.source ||
                    explorerState.source;


                const name =
                    item.dataset.name ||
                    item.textContent.trim();


                /*
                 * =========================
                 * FOLDER
                 * =========================
                 */

                if(type === "folder"){

                    explorerState.currentFolder =
                        name;

                    explorerState.currentSource =
                        source;


                    explorerState.breadcrumb.push({

                        name,

                        id,

                        source

                    });


                    expandExplorerPath(
                        id
                    );


                    renderExplorerTree();

                    bindTree();


                    document
                        .querySelectorAll(
                            ".explorer-tree-item"
                        )
                        .forEach(
                            el =>
                                el.classList.remove(
                                    "active"
                                )
                        );


                    const matchingTreeItem =
                        document.querySelector(
                            `.explorer-tree-item[data-path="${CSS.escape(
                                encodeURIComponent(id)
                            )}"]`
                        );


                    if(matchingTreeItem){

                        matchingTreeItem.classList.add(
                            "active"
                        );

                    }


                    renderExplorerBreadcrumb();


                    await renderExplorerFolderContents(
                        id,
                        source
                    );


                    return;

                }


                /*
                 * =========================
                 * FILE
                 * =========================
                 */

                if(type === "file"){

                    const file = {

                        id,

                        path: id,

                        name,

                        source,

                        url:
                            item.dataset.url ||
                            null,

                        mimeType:
                            item.dataset.mime ||
                            ""

                    };


                    await previewExplorerFile(
                        file
                    );

                }

            };

        });

}




















// ======================================
// FILE PREVIEW SYSTEM
// ======================================

const IMAGE_EXTENSIONS = new Set([
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "svg",
    "ico",
    "avif",
    "apng",
    "tif",
    "tiff"
]);


const TEXT_EXTENSIONS = new Set([
    "txt",
    "json",
    "js",
    "mjs",
    "cjs",
    "css",
    "html",
    "htm",
    "xml",
    "md",
    "markdown",
    "csv",
    "tsv",
    "yaml",
    "yml",
    "log",
    "ini",
    "conf",
    "env",
    "sql",
    "sh",
    "bat",
    "ps1"
]);


function getFileExtension(name){

    return String(name || "")
        .split(".")
        .pop()
        .toLowerCase();

}


function isImageFile(file){

    const mime =
        file.mimeType ||
        file.mime ||
        file.contentType ||
        "";

    if(mime.startsWith("image/")){
        return true;
    }

    return IMAGE_EXTENSIONS.has(
        getFileExtension(file.name)
    );

}


function isTextFile(file){

    const mime =
        file.mimeType ||
        file.mime ||
        file.contentType ||
        "";

    if(
        mime.startsWith("text/") ||
        mime === "application/json" ||
        mime === "application/javascript" ||
        mime === "application/xml"
    ){
        return true;
    }

    return TEXT_EXTENSIONS.has(
        getFileExtension(file.name)
    );

}


// ======================================
// MAIN PREVIEW ENTRY
// ======================================

async function previewExplorerFile(file){

    if(!file || file.type === "folder"){
        return;
    }


    if(isImageFile(file)){

        openExplorerImagePreview(file);

        return;

    }


    if(isTextFile(file)){

        await openExplorerTextPreview(file);

        return;

    }


    openExplorerUnsupportedPreview(file);

}


// ======================================
// IMAGE PREVIEW
// ======================================

function openExplorerImagePreview(file){

    const modal =
        document.getElementById(
            "imageModal"
        );

    const img =
        document.getElementById(
            "modalImage"
        );

    if(!modal || !img){

        console.warn(
            "Image preview modal not found"
        );

        return;

    }


    const url =
        getExplorerFileUrl(file);


    if(!url){

        showToast(
            "Image URL unavailable"
        );

        return;

    }


    img.src = url;

    img.alt =
        file.name || "Image";


    modal.classList.add(
        "open"
    );

}


// ======================================
// TEXT / CODE / JSON PREVIEW
// ======================================

async function openExplorerTextPreview(file){

    const modal =
        document.getElementById(
            "fileViewerModal"
        );

    const title =
        document.getElementById(
            "fileViewerTitle"
        );

    const content =
        document.getElementById(
            "fileViewerContent"
        );

    if(!modal || !content){

        console.warn(
            "File viewer modal not found"
        );

        return;

    }


    title.textContent =
        file.name || "File";


    content.textContent =
        "Loading...";


    modal.classList.add(
        "open"
    );


    try{

        const url =
            getExplorerFileContentUrl(
                file
            );


        if(!url){

            throw new Error(
                "File content URL unavailable"
            );

        }


        const response =
            await fetch(url);


        if(!response.ok){

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const text =
            await response.text();


        /*
         * Pretty-print JSON when possible.
         */
        if(
            getFileExtension(file.name) ===
            "json"
        ){

            try{

                const parsed =
                    JSON.parse(text);


                content.textContent =
                    JSON.stringify(
                        parsed,
                        null,
                        2
                    );

            }
            catch{

                content.textContent =
                    text;

            }

        }
        else{

            content.textContent =
                text;

        }

    }
    catch(err){

        console.error(
            "File preview failed:",
            err
        );


        content.textContent =
            `Unable to preview this file.\n\n${err.message}`;

    }

}


// ======================================
// UNSUPPORTED FILE
// ======================================

function openExplorerUnsupportedPreview(file){

    const modal =
        document.getElementById(
            "fileViewerModal"
        );

    const title =
        document.getElementById(
            "fileViewerTitle"
        );

    const content =
        document.getElementById(
            "fileViewerContent"
        );

    if(!modal || !content){
        return;
    }


    title.textContent =
        file.name || "File";


    content.textContent =
`Preview is not available for this file type.

File:
${file.name || "-"}

Type:
${file.mimeType || file.mime || getFileExtension(file.name) || "Unknown"}

Size:
${getImageSize(file)}`;


    modal.classList.add(
        "open"
    );

}


// ======================================
// FILE URL
// ======================================

function getExplorerFileUrl(file){

    /*
     * Drive files already provide a URL
     * through the Explorer API.
     */
    if(file.url){
        return file.url;
    }


    /*
     * Local files should be served
     * through the Explorer backend.
     */
    return getExplorerFileContentUrl(
        file
    );

}


function getExplorerFileContentUrl(file){

    if(!file){
        return null;
    }


    /*
     * Backend endpoint for generic
     * file content.
     */
    return `/admin/explorer/file?id=${
        encodeURIComponent(
            file.id || file.path || ""
        )
    }&source=${
        encodeURIComponent(
            file.source ||
            explorerState.source
        )
    }`;

}







function closeExplorerFileViewer(){

    const modal =
        document.getElementById(
            "fileViewerModal"
        );

    if(modal){

        modal.classList.remove(
            "open"
        );

    }

}






// ======================================
// IMAGE ACTIONS
// ======================================


function downloadImage(
    id
){


    window.open(

        `/image/${id}`,

        "_blank"

    );


}





async function copyImageUrl(
    id
){


    const url =
        `${location.origin}/image/${id}`;



    await navigator
        .clipboard
        .writeText(
            url
        );



    showToast(
        "Image URL copied"
    );


}







function showImageMetadata(
    id
){


    const image =
        explorerState.data.images
            .find(
                item =>
                    item.id == id
            );



    if(!image){

        showToast(
            "Image not found"
        );

        return;

    }




    alert(

`
Filename:
${image.filename}

Album:
${image.album || "-"}

Size:
${getImageSize(image)}

Source:
${image.source || "unknown"}
`

    );


}








function openImageManager(
    id
){


    document
        .querySelector(
            '[data-page="images"]'
        )
        ?.click();



    showToast(
        `Opened image ${id}`
    );


}








// ======================================
// CONTEXT MENU
// ======================================


function openExplorerMenu(
    event,
    id
){


    const menu =
        document.getElementById(
            "explorerMenu"
        );



    if(!menu){
        return;
    }



    explorerState.selectedImage =
        id;



    menu.classList.remove(
        "hidden"
    );



    menu.style.left =
        `${event.clientX}px`;



    menu.style.top =
        `${event.clientY}px`;



}








function initExplorerMenu(){


    const menu =
        document.getElementById(
            "explorerMenu"
        );



    if(!menu){
        return;
    }



    menu.onclick =
        async event => {


            const action =
                event.target.dataset.action;



            const id =
                explorerState.selectedImage;



            if(!action || !id){
                return;
            }



            switch(action){


                case "preview":

                    previewImage(id);

                    break;



                case "download":

                    downloadImage(id);

                    break;



                case "copy":

                    await copyImageUrl(id);

                    break;



                case "metadata":

                    showImageMetadata(id);

                    break;



                case "manager":

                    openImageManager(id);

                    break;


            }



            menu.classList.add(
                "hidden"
            );


        };


}









// ======================================
// GLOBAL CLICK CLOSE
// ======================================


document.addEventListener(

    "click",

    event => {


        const menu =
            document.getElementById(
                "explorerMenu"
            );



        if(
            menu &&
            !event.target.closest(
                "#explorerMenu"
            )
        ){

            menu.classList.add(
                "hidden"
            );

        }


    }

);







document.addEventListener(
    "click",
    event => {

        if(
            event.target.classList.contains(
                "explorer-modal-backdrop"
            )
        ){

            closeExplorerFileViewer();

        }

    }
);




document.addEventListener(
    "click",
    event => {

        if(
            event.target.closest(
                "#closeFileViewer"
            )
        ){

            closeExplorerFileViewer();

        }

    }
);


// ======================================
// START
// ======================================


document.addEventListener(
    "DOMContentLoaded",
    () => {


        renderExplorer();


        initExplorerMenu();


    }
);