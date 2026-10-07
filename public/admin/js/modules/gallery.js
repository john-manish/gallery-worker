
// ======================================
// HELPERS
// ======================================


let imageSelectionMode = false;

let imagesOrigin = null;

// ======================================
// IMAGE HEADER
// ======================================

function updateImagesHeader(){

    const album =
        state.selectedAlbum;

    if(
        imagesOrigin === "album" &&
        album
    ){

        dom.imagesPageTitle.textContent =
            album;

        dom.imagesPageSubtitle.textContent =
            `Viewing images from "${album}"`;

        dom.backToAlbumsBtn
            ?.classList.remove(
                "hidden"
            );

        return;
    }

    dom.imagesPageTitle.textContent =
        "Image Manager";

    dom.imagesPageSubtitle.textContent =
        "Browse and manage files";

    dom.backToAlbumsBtn
        ?.classList.add(
            "hidden"
        );
}




// select option js

function createSelect(
    id,
    options,
    value,
    onChange
){

    const root = $(id);

    if(!root){
        return;
    }

    const btn =
        root.querySelector(
            ".custom-select-btn"
        );

    const label =
        btn.firstElementChild;

    const menu =
        root.querySelector(
            ".custom-select-menu"
        );

    menu.innerHTML = "";

    options.forEach(option => {

        const item =
            document.createElement(
                "div"
            );

        item.className =
            "custom-option";

        item.textContent =
            option.label;

        if(
            option.value === value
        ){
            item.classList.add(
                "active"
            );

            label.textContent =
                option.label;
        }

        item.onclick = () => {

            label.textContent =
                option.label;

            menu.querySelectorAll(
                ".custom-option"
            ).forEach(
                option =>
                    option.classList.remove(
                        "active"
                    )
            );

            item.classList.add(
                "active"
            );

            menu.classList.add(
                 "hidden"
            );

            onChange?.(
                option.value
            );
        };

        menu.appendChild(
            item
        );
    });

    btn.onclick = e => {
        e.stopPropagation();

        document
            .querySelectorAll(".custom-select-menu")
            .forEach(m => {
                if (m !== menu) {
         m.classList.add("hidden");
                }
            });

      menu.classList.toggle("hidden");
  };
}






function closeCustomSelects() {
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








// ======================================
// GALLERY
// ======================================

async function refreshGallery() {
    await Promise.all([
        loadAlbums(),
        loadAllImages(),
        loadDashboard(),
        loadSidebarStorage()
    ]);
}


async function refreshImages() {
    await Promise.all([
        loadAllImages(),
        loadDashboard(),
        loadSidebarStorage()
    ]);

    filterImages();
}



function clearSelection(){

    state.selectedImages = [];

    if(dom.selectAllImages){
        dom.selectAllImages.checked =
            false;
    }

}



function toggleImageSelectionMode(force){

    imageSelectionMode =
        force !== undefined
            ? force
            : !imageSelectionMode;


    document.body.classList.toggle(
        "image-selection-mode",
        imageSelectionMode
    );


    const box =
        document.querySelector(
            ".image-selection-box"
        );


    if(box){

        box.classList.toggle(
            "hidden",
            !imageSelectionMode
        );

    }


    if(!imageSelectionMode){

        clearSelection();

    }


    renderImages();

}




function handleError(
    err,
    fallback =
        "Something went wrong"
){

    console.error(err);

    showToast(
        err?.message ||
        fallback
    );

}





function ensureInfoModal() {

    let modal = document.getElementById("infoModal");

    if (!modal) {
        document.body.insertAdjacentHTML(
            "beforeend",
            `
            <div id="infoModal" class="modal">
                <div class="modal-content info-modal">

                    <button
                        id="closeInfoModal"
                        type="button"
                        class="btn btn-icon modal-close"
                    >
                        ×
                    </button>

                    <div id="infoContent"></div>

                </div>
            </div>
            `
        );
    }

    dom.infoModal =
        document.getElementById("infoModal");

    dom.infoContent =
        document.getElementById("infoContent");

    dom.closeInfoModal =
        document.getElementById("closeInfoModal");

    if (!dom.infoModal.dataset.bound) {

        dom.closeInfoModal.addEventListener(
            "click",
            hideInfoModal
        );

        dom.infoModal.addEventListener(
            "click",
            e => {
                if (e.target === dom.infoModal) {
                    hideInfoModal();
                }
            }
        );

        dom.infoModal.dataset.bound = "true";
    }
}



function showInfoModal(
    title,
    items
){

    ensureInfoModal();

    if(
        !dom.infoContent
    ){
        return;
    }

    dom.infoContent.innerHTML =
    `
   <div class="panel-title">
    <h2>${title}</h2>
</div>

<div class="info-list">

      ${
        items.map(
          ([label, value]) => `
          <div class="info-row">
            <span>${label}</span>
            <strong>${value}</strong>
          </div>
        `
        ).join("")
      }

    </div>
    `;

  dom.infoModal.classList.add(
    "open"
  );
 
 
 
 lockPageScroll(); 
  
}



function hideInfoModal(){

    dom.infoModal
        ?.classList.remove(
            "open"
        );

    document.body.classList.remove("modal-open");
unlockPageScroll();

}



function showAlbumInfo(album) {

  showInfoModal(
    "Album Details",
    [
      ["Name", album.name],
      ["Images", album.images ?? 0],
      ["Size", album.size || "0 MB"],
      ["Updated", album.updated || "-"]
    ]
  );
}




function showImageInfo(image) {

  showInfoModal(
    "Image Details",
    [
      ["File", image.filename],
      ["Album", image.album],
      ["Size", formatBytes(image.size)],
      ["Type", image.mimeType || "-"],
      ["Resolution",
        image.width && image.height
          ? `${image.width} × ${image.height}`
          : "-"
      ],
      [
        "Created",
        image.createdAt
          ? formatDateTime(
              image.createdAt,
              {
                year:"numeric",
                month:"short",
                day:"numeric",
                hour:"2-digit",
                minute:"2-digit"
              }
            )
          : "-"
      ],
      [
        "Updated",
        image.updatedAt
          ? formatDateTime(
              image.updatedAt,
              {
                year:"numeric",
                month:"short",
                day:"numeric",
                hour:"2-digit",
                minute:"2-digit"
              }
            )
          : "-"
      ],
      ["Views", image.viewCount || 0]
    ]
  );
}




// MOVE MODAL

function showMoveModal(){

    ensureInfoModal();


    dom.infoContent.innerHTML = `
        <div class="panel-title">
            <h2>
                Move ${state.selectedImages.length} Images
            </h2>
        </div>

        <div class="field">

            <label>
                Destination Album
            </label>

            <div
               id="moveAlbumSelect"
               class="custom-select"
            >
               <button
                   type="button"
                   class="custom-select-btn"
                >
                   <span>Select Album</span>
                   <span>⌄</span>
                </button>

                <div
                    class="custom-select-menu hidden"
                ></div>
            </div>

        </div>

        <button
            id="createMoveAlbumBtn"
            class="btn btn-secondary"
        >
            ➕ Create New Album
        </button>

        <div class="modal-actions">

            <button
                id="cancelMoveBtn"
                class="btn"
            >
                Cancel
            </button>

            <button
                id="confirmMoveBtn"
                class="btn btn-primary"
            >
                Move
            </button>

        </div>
    `;

    dom.infoModal.classList.add(
        "open"
    );

   document.body.classList.add("modal-open");

    bindMoveModalEvents();

    if (
        !state.moveDestination &&
        state.albums.length
    ) {
        state.moveDestination =
            state.albums[0].name;
    }

createSelect(
    "moveAlbumSelect",

    state.albums.map(
        album => ({
            value: album.name,
            label: `📁 ${album.name}`
        })
    ),

    state.moveDestination,

    value => {
        state.moveDestination =
            value;
    }
);


}



function bindMoveModalEvents() {
    $("cancelMoveBtn")
        ?.addEventListener(
            "click",
            hideInfoModal
        );

    $("confirmMoveBtn")
        ?.addEventListener(
            "click",
            moveImagesToSelectedAlbum
        );

    $("createMoveAlbumBtn")
        ?.addEventListener(
            "click",
            createAlbumFromMoveModal
        );
}


async function createAlbumFromMoveModal(){

    const name =
        prompt(
            "Album name"
        )?.trim();

    if(!name){
        return;
    }

    try{

        showToast(
            "Creating album...",
            "loading"
        );

        await api(
            API.ALBUM,
            {
                method:"POST",

                body:
                    JSON.stringify({
                        name
                    })
            }
        );

        await refreshGallery();

        showToast(
            "Album created.",
            "success"
        );

        showMoveModal();

    }
    catch(err){
        handleError(err);
    }
}



async function moveImagesToSelectedAlbum(){

    const destination =
        state.moveDestination;

    if(!destination){
        return;
    }

    try{

        showToast(
            "Moving images...",
            "loading"
        );


        await api(
            `${API.IMAGES}/move`,
            {
                method:"PATCH",

                body:
                    JSON.stringify({
                        from:
                            state.selectedAlbum,

                        to:
                            destination,

                        images:
                            state.selectedImages
                    })
            }
        );

        state.selectedImages = [];
        state.moveDestination = "";



        hideInfoModal();

        await refreshGallery();

        await refreshImages();

        showToast(
            "Images moved.",
            "success"
        );
    }
    catch(err){
        handleError(err);
    }
}




// ======================================
// ALBUM MODULE
// ======================================

async function loadAlbums(){

    try{

        const data =
            await api(
                API.ALBUMS
            );

        state.albums =
            data.albums.map(
                album => ({

                    name:
                        album.name,

                    images:
                        album.images,

                    updated:
                        album.updatedAt
                            ? formatDateTime(
                                album.updatedAt,
                                {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric"
                                }
                            )
                            : "Empty",

                    size:
                        formatBytes(
                            album.sizeBytes || 0
                        )

                })
            );

        renderAlbums();

        populateAlbumFilter();

        if(
            typeof populateUploadAlbums ===
            "function"
         ){
            populateUploadAlbums();
         }

    }
    catch(err){

        handleError(
            err,
            "Unable to load albums"
        );

    }

}





function populateAlbumFilter(){

    createSelect(
        "imageAlbumFilter",

        [
            {
                value: "",
                label: "📁 All Albums"
            },

            ...state.albums.map(
                album => ({
                    value: album.name,
                    label: `📁 ${album.name}`
                })
            )
        ],

        state.selectedAlbum || "",

        value => {

            state.selectedAlbum =
                value;

            filterImages();
        }
    );
}





function createAlbumCard(album){

    return `
        <div class="album-card"
             data-album="${album.name}"
        >

            <button
                class="btn btn-icon card-menu-btn"
                type="button"
                aria-label="Album actions"
                data-menu="galleryAlbumMenu"
                data-album="${album.name}"
            >
                <i class="bi bi-three-dots-vertical"></i>
            </button>

            <div class="album-cover">
                📁
            </div>

            <div class="album-body">

                <div class="album-badge">
                    ${album.updated}
                </div>

                <h3>
                    ${album.name}
                </h3>

                <span>
                    ${album.images}
                    Images •
                    ${album.size}
                </span>

            </div>

        </div>
    `;
}






function renderAlbums(){

    if(
        !state.albums.length
    ){

        dom.albumGrid.innerHTML =
            "";

        dom.emptyAlbums
            ?.classList.remove(
                "hidden"
            );

        return;
    }

    dom.emptyAlbums
        ?.classList.add(
            "hidden"
        );

    dom.albumGrid.innerHTML =
        state.albums
            .map(
                createAlbumCard
            )
            .join("");
}


async function createAlbum(){

    const name =
        prompt(
            "Album name"
        )?.trim();

    if(!name){
        return;
    }

    try{

        showToast(
            "Creating album...",
            "loading"
        );

        await api(
            API.ALBUM,
            {
                method:"POST",

                body:
                    JSON.stringify({
                        name
                    })
            }
        );

        showToast(
            "Album created"
        );

        await refreshGallery();

        showToast(
            "Album created.",
            "success"
        );

    }
    catch(err){
        handleError(err);
    }

}

async function deleteAlbum(name){

    if(
        !confirm(
            `Delete "${name}" and all images inside it?`
        )
    ){
        return;
    }

    try{

        showToast(
            "Deleting album...",
            "loading"
        );

        await api(
            `${API.ALBUM}/${encodeURIComponent(name)}`,
            {
                method:"DELETE"
            }
        );

        showToast(
            "Album deleted.",
            "success"
        );

        await refreshGallery();

        

    }
    catch(err){
        handleError(err);
    }

}

async function renameAlbum(name){

    const newName =
        prompt(
            "New album name",
            name
        )?.trim();

    if(
        !newName ||
        newName === name
    ){
        return;
    }

    try{


        showToast(
            "Renaming album...",
            "loading"
        );


        await api(
            `${API.ALBUM}/${encodeURIComponent(name)}`,
            {
                method: "PATCH",

                body:
                    JSON.stringify({
                        newName
                    })
            }
        );

        // Update selected album
        if(
            state.selectedAlbum === name
        ){

            state.selectedAlbum =
                newName;

        }

        // Clear selections
        state.selectedImages = [];

        // Reload everything
        await refreshGallery();

        // Keep filter on renamed album
        if(
            state.selectedAlbum
        ){

            populateAlbumFilter();
            filterImages();
        }

        showToast(
            `Album renamed: "${name}" → "${newName}"`,
            "success"
        );

    }
    catch(err){
        handleError(err);
    }

}








// ======================================
// IMAGE MODULE
// ======================================



async function loadAllImages(){

    try{

        const data =
            await api(
                API.IMAGES
            );

        state.allImages =
            data.images;

        

        state.images =
            data.images;

            

        renderImages();

    }
    catch(err){
        handleError(
            err,
            "Unable to load images"
        );
    }

}







function renderImages(){

    if(!dom.imageGrid){
        return;
    }

    dom.imageGrid.innerHTML =
        state.images
            .map(image => {

                // Grid = thumbnail
                const thumbnail =
                    image.thumb || image.url;

                // Viewer = original
                const original =
                    image.url;

               return `
               <div
                   class="image-item ${
                       state.selectedImages.some(
                           selected =>
                               selected.album === image.album &&
                               selected.filename === image.filename
                       )
                       ? "selected"
                       : ""
                   }"
                   data-action="view-image"
                   data-url="${original}"
                   data-image="${image.filename}"
                   data-album="${image.album}"
               >
               
               

               <button
                   class="btn btn-icon card-menu-btn"
                   type="button"
                   aria-label="Image actions"
                   data-menu="galleryImageMenu"
                   data-image="${image.filename}"
                   data-album="${image.album}"
               >
                   <i class="bi bi-three-dots-vertical"></i>
               </button>


                    ${
                        imageSelectionMode
                            ? `

                    <label
                       class="image-check"
                    >
                       <input
    type="checkbox"
    data-action="select-image"
    data-image="${image.filename}"
    data-album="${image.album}"
    ${
        state.selectedImages.some(
            selected =>
                selected.album === image.album &&
                selected.filename === image.filename
        )
        ? "checked"
        : ""
    }
> 
                    </label>
                    `
                            : ""
                    }




                    <div class="image-thumb">
 
                       <img
                            src="${thumbnail}"
                            alt="${image.filename}"
                            loading="lazy"
                       >

                   </div>

                   

               </div>
          `;
          })
          .join("");

}





function viewImage(url){

    if(!state.authenticated){

        handleAuthButton();
        return;

    }

    dom.modalImage.src = url;

    dom.imageModal?.classList.add(
        "open"
    );
    
    lockPageScroll();

}








async function deleteImage(
    album,
    filename
){

    if(
        !confirm(
            `Delete "${filename}" ?`
        )
    ){
        return;
    }

    try{

        showToast(
            "Deleting image...",
            "loading"
        );

        await api(
            `${API.IMAGE}/${
                encodeURIComponent(album)
            }/${
                encodeURIComponent(filename)
            }`,
            {
                method:"DELETE"
            }
        );

        await refreshImages();

        showToast(
            "Image deleted.",
            "success"
        );

    }
    catch(err){
        handleError(err);
    }

}







// ======================================
// BULK MODULE
// ======================================

function toggleImageSelection(
    album,
    filename,
    selected
){
    const exists =
        state.selectedImages.some(
            image =>
                image.album === album &&
                image.filename === filename
        );

    if(selected){

        if(!exists){
            state.selectedImages.push({
                album,
                filename
            });
        }

    }
    else{

        state.selectedImages =
            state.selectedImages.filter(
                image =>
                    !(
                        image.album === album &&
                        image.filename === filename
                    )
            );

    }
    
    renderImages();
    
}





function toggleSelectAll(
    checked
){

    toggleImageSelectionMode(true);


    state.selectedImages =
        checked
            ? state.images.map(
                image => ({
                    album:image.album,
                    filename:image.filename
                })
              )
            : [];


    renderImages();

}


 


async function deleteSelectedImages(){

    if(
        !state.selectedImages.length
    ){

        showToast(
            "Select images first"
        );

        return;
    }

    if(
        !confirm(
            `Delete ${state.selectedImages.length} images?`
        )
    ){
        return;
    }

    try{

        showToast(
            `Deleting ${state.selectedImages.length} images...`,
            "loading"
        );

        await api(
            API.IMAGES,
            {
                method:"DELETE",

                body:
                    JSON.stringify({
                        album:
                            state.selectedAlbum,

                        images:
                            state.selectedImages
                    })
            }
        );

        state.selectedImages = [];
        
        toggleImageSelectionMode(false);

        await refreshImages();

        showToast(
            "Images deleted.",
            "success"
        );

    }
    catch(err){
        handleError(err);
    }

}



async function moveSelectedImages(){

    if(
        !state.selectedImages.length
    ){

        showToast(
            "Select images first"
        );

        return;
    }

    showMoveModal();

    
}



async function downloadZip(){



    if(
        !state.selectedImages.length
    ){

        showToast(
            "Select images first"
        );

        return;
    }

    try{

        showToast(
            "Preparing ZIP...",
            "loading"
        );

        const response =
            await fetch(
                "/admin/images/zip",
                {
                    method:"POST",

                    credentials:
                        "include",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            album:
                                state.selectedAlbum,

                            images:
                                state.selectedImages
                        })
                }
            );

        if(!response.ok){

            const error =
                await response.json();

            throw new Error(
                error.message
            );
        }

        const blob =
            await response.blob();

        const url =
            URL.createObjectURL(
                blob
            );

        const a =
            document.createElement(
                "a"
            );

        a.href = url;

        a.download =
            `${state.selectedAlbum}.zip`;

        a.click();

        URL.revokeObjectURL(
            url
        );


        showToast(
            "ZIP download started.",
            "success"
        );


    }
    catch(err){
        handleError(err);
    }

}


async function rebuildThumbnails(){

    try{


        showToast(
            "Rebuilding thumbnails...",
            "loading"
        );


        await api(
            API.THUMBS,
            {
                method:"POST"
            }
        );

        showToast(
            "Thumbnails rebuilt.",
            "success"
        );



        if(
            state.selectedAlbum
        ){

            await loadAllImages();
            filterImages();

        }

    }
    catch(err){
        handleError(err);
    }

}


// ======================================
// SEARCH MODULE
// ======================================


function filterImages(){

    clearSelection();
    
    if(imageSelectionMode){

        imageSelectionMode = false;

        document.body.classList.remove(
        "image-selection-mode"
        );

        document
            .querySelector(
                ".image-selection-box"
            )
            ?.classList.add(
                "hidden"
            );

    }


    
    const album =
        state.selectedAlbum;

    const search =
        dom.imageSearch.value
            .toLowerCase();

    state.images =
        state.allImages.filter(image => {

            const albumMatch =
                !album ||
                image.album === album;

            const searchMatch =
                image.filename
                    .toLowerCase()
                    .includes(search);

            return (
                albumMatch &&
                searchMatch
            );

        });

    renderImages();

    

    updateImagesHeader();
}







function searchAlbums(){

    const q =
        dom.albumSearch.value
            .trim()
            .toLowerCase();

    let albums =
        state.albums.filter(
            album =>
                album.name
                    .toLowerCase()
                    .includes(q)
        );

    const sort =
        dom.albumSort.value;

    switch(sort){

        case "images":

            albums.sort(
                (a, b) =>
                    b.images - a.images
            );
            break;

        case "recent":

            albums.sort(
                (a, b) =>
                    (b.updated || "")
                    .localeCompare(
                        a.updated || ""
                    )
            );
            break;

        default:

            albums.sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name
                    )
            );
    }

    dom.albumGrid.innerHTML =
        albums
            .map(createAlbumCard)
            .join("");
}





function sortAlbums(){

    const sort =
        dom.albumSort.value;

    const albums =
        [...state.albums];

    switch(sort){

        case "images":

            albums.sort(
                (a, b) =>
                    b.images - a.images
            );
            break;

        case "recent":

            albums.sort(
                (a, b) =>
                    (b.updated || "")
                    .localeCompare(
                        a.updated || ""
                    )
            );
            break;

        default:

            albums.sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name
                    )
            );

    }

    dom.albumGrid.innerHTML =
        albums
            .map(createAlbumCard)
            .join("");
}






