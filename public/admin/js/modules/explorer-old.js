// ======================================
// PUBLIC API
// ======================================

let currentExplorerImage = null;




async function renderExplorer(){

    const tree =
        document.getElementById(
            "explorerTree"
        );

    if(!tree){
        return;
    }

    try{

        tree.innerHTML = `
            <div class="empty-state">
                Loading Explorer...
            </div>
        `;

        const data =
            await getExplorerData();

        buildExplorer(data);
        initExplorer();
        filterExplorer();

    }
    catch(err){

        console.error(
            "Explorer failed:",
            err
        );

        const tree =
            document.getElementById(
                "explorerTree"
            );

        if(tree){

            tree.innerHTML = `
                <div class="empty-state">

                    <div>
                        📂
                    </div>

                    <p>
                        Failed to load explorer
                    </p>

                </div>
            `;

        }

    }

}



// ======================================
// DATA FETCHING
// ======================================

async function getExplorerData(){

    const [
        albumsRes,
        imagesRes,
        healthRes,
        storageRes
    ] = await Promise.all([

        fetch("/admin/albums"),
        fetch("/admin/images"),
        fetch("/admin/health"),
        fetch("/admin/storage")

    ]);

    const albumsData =
        await albumsRes.json();

    const imagesData =
        await imagesRes.json();

    const health =
        await healthRes.json();

    const storage =
        await storageRes.json();

    return {

        albums:
            Array.isArray(
                albumsData?.albums
            )
                ? albumsData.albums
                : [],

        images:
            Array.isArray(
                imagesData?.images
            )
                ? imagesData.images
                : [],

        health:
            health || {},

        storage:
            storage || {}

    };

}



// ======================================
// MAIN RENDER
// ======================================

function buildExplorer(data){

    const tree =
        document.getElementById(
            "explorerTree"
        );

    if(!tree){
        return;
    }

    const {
        albums = [],
        images = [],
        health = {},
        storage = {}
    } = data || {};

    const totalAlbums =
        albums.length;

    const totalImages =
        images.length;

    const totalStorage =
        storage.storage ||
        "0 MB";

    tree.innerHTML = `

<div class="explorer-root">

    <div class="explorer-banner">

        <div>

            <h2>
                📂 Gallery OS
            </h2>

            <small>
                ${totalAlbums} Albums •
                ${totalImages} Images •
                ${totalStorage}
            </small>

        </div>

    </div>

    <div class="explorer-group">

        ${renderExplorerAlbums(
            albums,
            images
        )}

        ${renderThumbnails(
            albums,
            images
        )}

        ${renderSystemFiles(
            health,
            storage
        )}

        ${renderExplorerWorkspaceInfo(
            health,
            storage,
            totalAlbums,
            totalImages
        )}

    </div>

</div>

`;

}



// ======================================
// NODE RENDERERS
// ======================================


// ======================================
// TREE BUILDERS
// ======================================





function getImageType(
    image
){

    const ext =
        image.filename
            .split(".")
            .pop()
            ?.toUpperCase();

    return ext || "FILE";
}


function getImageSize(
    image
){

    if(!image.size){
        return "Unknown";
    }

    return (
        image.size /
        1024 /
        1024
    ).toFixed(1) + " MB";

}





function renderExplorerAlbums(
    albums = [],
    images = []
){

    const children =
        albums.map(album => {

            const albumImages =
                images.filter(
                    image =>
                        image.album ===
                        album.name
                );

            const imageNodes =
                albumImages
                    .map(image => `

<div
    class="explorer-image"
    data-id="${image.id || ""}"
>

    <div class="explorer-image-info">

        <div
            class="explorer-image-main"
        >
            🖼 ${image.filename}
        </div>

        <div
            class="explorer-image-meta"
        >
            ${getImageType(image)}
            •
            ${getImageSize(image)}
        </div>

    </div>

    <button
        class="explorer-menu-btn"
    >
        ⋮
    </button>

</div>

`)
                    .join("");

            return `

<div class="explorer-folder">

    <div
        class="explorer-folder-row"
        data-album="${album.name}"
    >

        <span class="folder-arrow">
            ▶
        </span>

        <span class="folder-name">
            📁 ${album.name}
        </span>

        <small>
            (${albumImages.length})
        </small>

    </div>

    <div
        class="explorer-folder-images"
        style="display:none"
    >

        ${
            imageNodes ||
            `
            <div class="explorer-image">
                Empty folder
            </div>
            `
        }

    </div>

</div>

`;

        })
        .join("");

    return createNode({

        node: "albums",
        icon: "📁",
        title: "Albums",
        description:
            "Collections and images",
        count:
            albums.length,
        children,
        expanded: true

    });

}



function renderThumbnails(
    albums = [],
    images = []
){

    const children =
        albums
            .map(album => {

                const albumImages =
                    images.filter(
                        image =>
                            image.album ===
                            album.name
                    );

                const thumbNodes =
                    albumImages
                        .map(image => `

<div
    class="thumb-card"
    data-id="${image.id || ""}"
>

    <img
        src="${image.thumb}"
        loading="lazy"
        alt="${image.filename}"
    >

    <small>
        ${image.filename}
    </small>

</div>

`)
                        .join("");

                return `

<div class="thumb-folder">

    <div
        class="thumb-folder-row"
        data-album="${album.name}"
    >

        <span class="folder-arrow">
            ▶
        </span>

        <span>
            🖼 ${album.name}
        </span>

        <small>
            (${albumImages.length})
        </small>

    </div>

    <div
        class="thumb-grid"
        style="display:none"
    >

        ${
            thumbNodes ||
            `
            <div class="explorer-image">
                No thumbnails
            </div>
            `
        }

    </div>

</div>

`;

            })
            .join("");

    return createNode({

        node: "thumbnails",

        icon: "🖼",

        title: "Thumbnails",

        description:
            "Generated previews",

        count:
            images.length,

        children,

        expanded: false

    });

}



function renderSystemFiles(
    health = {},
    storage = {}
){

    const children = `

<div
    class="system-file"
    data-type="json"
    data-path="/storage/gallery/gallery.json"
>
    <span>📄 gallery.json</span>
    <small>Gallery metadata</small>
</div>

<div
    class="system-file"
    data-type="json"
    data-path="/storage/gallery/activity.json"
>
    <span>📄 activity.json</span>
    <small>Upload activity</small>
</div>

<div
    class="system-file"
    data-type="json"
    data-path="/storage/gallery/albums.json"
>
    <span>📄 albums.json</span>
    <small>Album index</small>
</div>

<div
    class="system-file"
    data-type="folder"
    data-path="/storage/gallery/.thumbs"
>
    <span>📁 .thumbs</span>
    <small>
        Thumbnail cache
    </small>
</div>

<div
    class="system-file"
    data-type="folder"
    data-path="/storage/gallery"
>
    <span>📁 storage</span>
    <small>
        ${storage.storage || "0 MB"}
    </small>
</div>

<div
    class="system-file warning"
    data-type="missing"
>
    <span>
        ⚠ Missing Thumbnails
    </span>

    <small>
        ${health.missingThumbs || 0}
    </small>
</div>

`;

    return createNode({

        node: "system",

        icon: "⚙",

        title: "System Files",

        description:
            "Metadata and cache",

        count: 6,

        children

    });

}



function renderExplorerWorkspaceInfo(
    health = {},
    storage = {},
    albums = 0,
    images = 0
){

    const score =
        calculateHealthScore(
            health
        );

    const children = `

<div class="explorer-child">

    <span>
        Albums
    </span>

    <small>
        (${albums})
    </small>

</div>

<div class="explorer-child">

    <span>
        Images
    </span>

    <small>
        (${images})
    </small>

</div>

<div class="explorer-child">

    <span>
        Storage
    </span>

    <small>
        ${storage.storage || "0 MB"}
    </small>

</div>

<div class="explorer-child">

    <span>
        Health
    </span>

    <small>
        ${score}%
    </small>

</div>

`;

    return createNode({

        node:
            "workspace",

        icon:
            "ℹ",

        title:
            "Workspace Info",

        description:
            "Statistics and health",

        count:
            null,

        children

    });

}



// ======================================
// NODE FACTORY
// ======================================

function createNode({
    node,
    icon,
    title,
    description,
    count,
    children,
    expanded = false
}) {

    const folderIcon =
        expanded
            ? "📂"
            : icon;

    return `

<div
    class="explorer-node"
    data-node="${node}"
    data-icon="${icon}"
>

    <div class="explorer-row">

        <div class="explorer-title">

            <span class="explorer-arrow">
                ${expanded ? "▼" : "▶"}
            </span>

            <span class="explorer-icon">
                ${folderIcon}
            </span>

            <span>
                ${title}
            </span>

        </div>

        ${
            count !== null
                ? `
                    <span class="explorer-pill">
                        ${count}
                    </span>
                `
                : ""
        }

    </div>

    <small>
        ${description}
    </small>

    <div
        class="explorer-children"
        style="
            display:
            ${expanded ? "flex" : "none"}
        "
    >
        ${children}
    </div>

</div>

`;
}



// ======================================
// SEARCH
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
                ".explorer-folder, .explorer-child"
            )
            .forEach(item => {

                const visible =
                    item.textContent
                        .toLowerCase()
                        .includes(query);

                item.style.display =
                    visible
                        ? ""
                        : "none";

            });

        document
            .querySelectorAll(
                ".explorer-image"
            )
            .forEach(item => {

                const visible =
                    item.textContent
                        .toLowerCase()
                        .includes(query);

                item.style.display =
                    visible
                        ? ""
                        : "none";

            });

    };

}



// ======================================
// TREE INTERACTIONS
// ======================================

function initExplorer(){

    bindTreeNodes();

    bindAlbumFolders();

    bindThumbnailFolders();

    bindSystemFiles();

    bindImageRows();

    bindImageMenus();

    bindRefreshButton();

    initExplorerMenu();

}






function bindTreeNodes(){

    document
        .querySelectorAll(
            ".explorer-node"
        )
        .forEach(node => {

            const row =
                node.querySelector(
                    ".explorer-row"
                );

            row?.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    toggleNode(
                        node
                    );

                }
            );

        });

}







function bindAlbumFolders(){

    document
        .querySelectorAll(
            ".explorer-folder-row"
        )
        .forEach(row => {

            row.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    const folder =
                        row.parentElement;

                    const files =
                        folder.querySelector(
                            ".explorer-folder-images"
                        );

                    const arrow =
                        row.querySelector(
                            ".folder-arrow"
                        );

                    const isOpen =
                        files.style.display ===
                        "block";

                    files.style.display =
                        isOpen
                            ? "none"
                            : "block";

                    arrow.textContent =
                        isOpen
                            ? "▶"
                            : "▼";

                    updateBreadcrumb(
                        row.dataset.album,
                        !isOpen
                    );

                });

        });

}






function bindThumbnailFolders(){

    document
        .querySelectorAll(
            ".thumb-folder-row"
        )
        .forEach(row => {

            row.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    const folder =
                        row.parentElement;

                    const grid =
                        folder.querySelector(
                            ".thumb-grid"
                        );

                    const arrow =
                        row.querySelector(
                            ".folder-arrow"
                        );

                    const isOpen =
                        grid.style.display ===
                        "grid";

                    grid.style.display =
                        isOpen
                            ? "none"
                            : "grid";

                    arrow.textContent =
                        isOpen
                            ? "▶"
                            : "▼";

                    updateBreadcrumb(
                        row.dataset.album,
                        !isOpen
                    );

                });

        });

    document
        .querySelectorAll(
            ".thumb-card"
        )
        .forEach(card => {

            card.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    const id =
                        card.dataset.id;

                    if(!id){
                        return;
                    }

                    previewImage(id);

                });

        });

}





function bindSystemFiles(){

    document
        .querySelectorAll(
            ".system-file"
        )
        .forEach(file => {

            file.addEventListener(
                "click",
                () => {

                    const type =
                        file.dataset.type;

                    const path =
                        file.dataset.path;

                    openSystemFile(
                        type,
                        path
                    );

                });

        });

}





function openSystemFile(
    type,
    path
){

    if(type === "folder"){

        showToast(
            `Opened ${path}`
        );

        return;
    }

    if(type === "json"){

        navigator.clipboard
            .writeText(path);

        showToast(
            `Copied ${path}`
        );

        return;
    }

    if(type === "missing"){

        showToast(
            "Rebuild thumbnails recommended"
        );

    }

}










function bindImageRows(){

    document
        .querySelectorAll(
            ".explorer-image"
        )
        .forEach(row => {

            row.addEventListener(
                "click",
                event => {

                    if(
                        event.target.closest(
                            ".explorer-menu-btn"
                        )
                    ){
                        return;
                    }

                    event.stopPropagation();

                    const id =
                        row.dataset.id;

                    if(!id){
                        return;
                    }

                    previewImage(id);

                });

        });

}






function bindImageMenus(){

    document
        .querySelectorAll(
            ".explorer-menu-btn"
        )
        .forEach(btn => {

            btn.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    currentExplorerImage =
                        btn.closest(
                            ".explorer-image"
                        );

                    openExplorerMenu(
                        event.clientX,
                        event.clientY
                    );

                });

        });

}







function bindRefreshButton(){

    const button =
        document.getElementById(
            "refreshExplorerBtn"
        );

    if(!button){
        return;
    }

    button.onclick =
        renderExplorer;

}





function updateBreadcrumb(
    album,
    opened
){

    const breadcrumb =
        document.getElementById(
            "explorerBreadcrumb"
        );

    if(!breadcrumb){
        return;
    }

    breadcrumb.textContent =
        opened
            ? `📂 Albums › ${album}`
            : "📂 Gallery OS";

}










function toggleNode(node){

    const children =
        node.querySelector(
            ".explorer-children"
        );

    if(!children){
        return;
    }

    const arrow =
        node.querySelector(
            ".explorer-arrow"
        );

    const icon =
        node.querySelector(
            ".explorer-icon"
        );

    const type =
        node.dataset.node;

    const isOpen =
        children.style.display !==
        "none";

    children.style.display =
        isOpen
            ? "none"
            : "flex";

    arrow.textContent =
        isOpen
            ? "▶"
            : "▼";

    if(
        icon &&
        type === "albums"
    ){

        icon.textContent =
            isOpen
                ? "📁"
                : "📂";

    }

}






// ======================================
// MENU
// ======================================



function openExplorerMenu(x, y){

    const menu =
        document.getElementById(
            "explorerMenu"
        );

    if(!menu){
        return;
    }

    menu.classList.remove(
        "hidden"
    );

    menu.style.visibility =
        "hidden";

    menu.style.left =
        "0px";

    menu.style.top =
        "0px";

    requestAnimationFrame(() => {

        const menuWidth =
            menu.offsetWidth;

        const menuHeight =
            menu.offsetHeight;

        const padding = 12;

        const maxX =
            window.innerWidth -
            menuWidth -
            padding;

        const maxY =
            window.innerHeight -
            menuHeight -
            padding;

        const left =
            Math.min(
                Math.max(x, padding),
                maxX
            );

        const top =
            Math.min(
                Math.max(y, padding),
                maxY
            );

        menu.style.left =
            `${left}px`;

        menu.style.top =
            `${top}px`;

        menu.style.visibility =
            "visible";

    });

}


function closeExplorerMenu(){

    const menu =
        document.getElementById(
            "explorerMenu"
        );

    menu?.classList.add(
        "hidden"
    );

}




function initExplorerMenu(){

    const menu =
        document.getElementById(
            "explorerMenu"
        );

    if(!menu){
        return;
    }

    menu.addEventListener(
        "click",
        async event => {

            const action =
                event.target.dataset.action;

            if(
                !action ||
                !currentExplorerImage
            ){
                return;
            }

            const id =
                currentExplorerImage.dataset.id;

            switch(action){

                case "preview":
                    previewImage(id);
                    break;

                case "metadata":
                    showImageMetadata(id);
                    break;

                case "manager":
                    openImageManager(id);
                    break;

                case "download":
                    downloadImage(id);
                    break;

                case "copy":
                    await copyImageUrl(id);
                    break;
            }

            closeExplorerMenu();

        }
    );

}












// ======================================
// IMAGE ACTIONS
// ======================================


    
function previewImage(id){

    const modal =
        document.getElementById(
            "imageModal"
        );

    const img =
        document.getElementById(
            "modalImage"
        );

    img.src =
        `/image/${id}`;

    modal.classList.add(
        "open"
    );
}


function showImageMetadata(
    id
){

    showToast(
        `Image ID: ${id}`
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
        .writeText(url);

    showToast(
        "Image URL copied"
    );
}





// ======================================
// GLOBAL EVENTS
// ======================================

document.addEventListener(
    "click",
    closeExplorerMenu
);


