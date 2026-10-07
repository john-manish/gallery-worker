// ======================================
// UPLOAD STATE
// ======================================

let uploadQueue = [];
let uploading = false;



// ======================================
// DOM
// ======================================

const dropZone =
    document.querySelector(".drop-zone");

const uploadInput =
    document.getElementById(
        "uploadFiles"
    );

const uploadButton =
    document.getElementById(
        "uploadBtn"
    );

const uploadQueueContainer =
    document.querySelector(
        ".upload-queue"
    );

const albumSelect =
    document.getElementById(
        "uploadAlbumSelect"
    );


// ======================================
// INIT
// ======================================

function initUpload(){

    if(!dropZone){
        return;
    }

    bindUploadEvents();
    renderUploadQueue();
    populateUploadAlbums();

}


// ======================================
// EVENTS
// ======================================

function bindUploadEvents(){

    dropZone.addEventListener(
        "click",
        () => uploadInput.click()
    );

    uploadInput.addEventListener(
        "change",
        e => {

            addFiles(
                e.target.files
            );

            uploadInput.value = "";

        }
    );

    dropZone.addEventListener(
        "dragover",
        handleDragOver
    );

    dropZone.addEventListener(
        "dragleave",
        handleDragLeave
    );

    dropZone.addEventListener(
        "drop",
        handleDrop
    );

    uploadButton.addEventListener(
        "click",
        uploadImages
    );

    

}


// ======================================
// DRAG EVENTS
// ======================================

function handleDragOver(e){

    e.preventDefault();

    dropZone.classList.add(
        "drag-active"
    );

}

function handleDragLeave(){

    dropZone.classList.remove(
        "drag-active"
    );

}

function handleDrop(e){

    e.preventDefault();

    dropZone.classList.remove(
        "drag-active"
    );

    addFiles(
        e.dataTransfer.files
    );

}


// ======================================
// FILES
// ======================================

function addFiles(files){

    const validTypes = [

        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"

    ];

    for(
        const file
        of files
    ){

        if(
            !validTypes.includes(
                file.type
            )
        ){
            showToast(
                `${file.name} is not an image`
            );
            continue;
        }

        const exists =
            uploadQueue.some(
                item =>
                    item.file === file
            );

        if(exists){
            continue;
        }

        uploadQueue.push({
            file,
            name:
                file.name,
            size:
                file.size,
            progress:0
        });

    }

    renderUploadQueue();

}


// ======================================
// RENDER QUEUE
// ======================================

function renderUploadQueue(){

    uploadQueueContainer.innerHTML = `
        <h3>Upload Queue</h3>
    `;

    if(
        uploadQueue.length === 0
    ){

        uploadQueueContainer
            .insertAdjacentHTML(
                "beforeend",
                `
                <p>
                    No files selected
                </p>
                `
            );

        return;
    }

    for(
        const item
        of uploadQueue
    ){

        uploadQueueContainer
            .insertAdjacentHTML(
                "beforeend",
                `
                <div
                    class="queue-item list-item"
                    data-name="${item.name}"
                >

                    <span>
                        ${item.name}
                    </span>

                    <small>
                        ${formatBytes(
                            item.size
                        )}
                    </small>

                    <div
                        class="progress-bar"
                    >

                        <div
                            class="progress-fill"
                            style="
                                width:
                                ${item.progress}%
                            "
                        ></div>

                    </div>

                    <button
                        class="btn btn-icon btn-danger remove-upload"
                        data-name="${item.name}"
                    >
                        ✕
                    </button>

                </div>
                `
            );

    }

    document
        .querySelectorAll(
            ".remove-upload"
        )
        .forEach(btn => {

            btn.onclick =
                removeQueuedFile;

        });

}


// ======================================
// REMOVE FILE
// ======================================

function removeQueuedFile(e){

    if(uploading){
        showToast(
            "Upload in progress"
        );
        return;
    }

    const name =
        e.currentTarget.dataset
            .name;

    uploadQueue =
        uploadQueue.filter(
            file =>
                file.name !== name
        );

    renderUploadQueue();

}


// LOAD UPLOAD ALBUMS

function populateUploadAlbums(){

    if(
        !albumSelect
    ){
        return;
    }

    const options = [

        {
            value: "__create__",
            label: "➕ Create New Album..."
        },

        ...state.albums.map(
            album => ({
                value: album.name,
                label: `📁 ${album.name}`
            })
        )

    ];

    if(
        !state.selectedUploadAlbum &&
        state.albums.length
    ){
        state.selectedUploadAlbum =
            state.albums[0].name;
    }

    createSelect(
        "uploadAlbumSelect",
        options,
        state.selectedUploadAlbum,
        async value => {

            if(
                value === "__create__"
            ){

                const name =
                    prompt(
                        "Album name"
                    )?.trim();

                if(!name){
                    return;
                }

                try{

                    await api(
                        API.ALBUMS,
                        {
                            method:"POST",
                            body:JSON.stringify({
                                name
                            })
                        }
                    );

                    showToast(
                        "Album created"
                    );

                    await loadAlbums();

                    state.selectedUploadAlbum =
                        name;

                    populateUploadAlbums();
                }
                catch(err){

                    showToast(
                        err.message ||
                        "Failed to create album"
                    );
                }

                return;
            }

            state.selectedUploadAlbum =
                value;
        }
    );
}






// ======================================
// UPLOAD
// ======================================

async function uploadImages(){

    if(uploading){
        showToast(
            "Upload in progress"
        );

        return;
    }

    if(
        uploadQueue.length === 0
    ){
        showToast(
            "Select some images"
        );
        return;
    }

    const album =
        state.selectedUploadAlbum;

    if(!album){
        showToast(
            "Select an album"
        );
        return;
    }

    uploading = true;

    uploadButton.disabled = true;
    uploadButton.textContent =
        "Uploading...";

    try{

        const formData =
            new FormData();

        formData.append(
            "album",
            album
        );

        for(
            const item
            of uploadQueue
        ){

            formData.append(
                "images",
                item.file
            );

        }

        const xhr =
            new XMLHttpRequest();

        xhr.open(
           "POST",
           API.UPLOAD
        );

        xhr.withCredentials =
            true;

        xhr.upload.onprogress =
            e => {

                if(
                    !e.lengthComputable
                ){
                    return;
                }

                const percent =
                    Math.round(
                        e.loaded /
                        e.total *
                        100
                    );

                updateProgress(
                    percent
                );

                uploadButton.textContent =
                `Uploading ${percent}%...`;


            };

        xhr.onload =
            async () => {

                uploading = false;

                uploadButton.disabled =
                    false;

                uploadButton.textContent =
                    "Upload";

                if(
                    xhr.status >= 200 &&
                    xhr.status < 300
                ){

                    updateProgress(100);

                    showToast(
                        "Upload successful"
                    );


                    await sleep(500);

                    uploadQueue = [];
                    renderUploadQueue();

                    if(
                        typeof loadAlbums ===
                        "function"
                    ){
                        await loadAlbums();
                    }


                    if(
                        typeof loadAllImages ===
                        "function"
                    ){
                        await loadAllImages();
                    }

                    return;
                }


                showToast(
                    "Upload failed"
                );

            };

        xhr.onerror =
            () => {

                uploading = false;

                uploadButton.disabled =
                    false;

                uploadButton.textContent =
                    "Upload";

                showToast(
                    "Upload failed"
                );

            };

        updateProgress(0);
            
        xhr.send(
            formData
        );

    }
    catch(err){

        uploading = false;

        uploadButton.disabled =
            false;

        uploadButton.textContent =
            "Upload";

        console.error(err);

        showToast(
            "Upload failed"
        );

    }

}


// ======================================
// PROGRESS
// ======================================

function updateProgress(percent){

    uploadQueue.forEach(
        item =>
            item.progress =
                percent
    );

    document
        .querySelectorAll(
            ".progress-fill"
        )
        .forEach(bar => {

            bar.style.width =
                `${percent}%`;

        });

}


// ======================================
// HELPERS
// ======================================

function formatBytes(bytes){

    if(bytes < 1024){
        return `${bytes} B`;
    }

    if(bytes < 1024 * 1024){
        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;
    }

    return `${(
        bytes /
        1024 /
        1024
    ).toFixed(1)} MB`;

}


