// ======================================
// SCANNER STATE
// ======================================

let scannerData = {
    albums: 0,
    images: 0,
    missingThumbs: 0,
    brokenImages: 0,
    duplicateImages: 0,
    emptyAlbums: 0
};

let scannerTimeline = [];


// Prevent unnecessary rescans when reopening scanner page
let scannerLoaded = false;


// ======================================
// HELPERS
// ======================================

function addScannerActivity(
    title,
    meta = ""
){

    scannerTimeline.unshift({

        title,
        meta,
        time:
            new Date()

    });

    if(
        scannerTimeline.length > 20
    ){
        scannerTimeline.pop();
    }

    renderScannerActivity();

}


// ======================================
// INIT
// ======================================

function initScanner(){
  
    dom.scanGalleryBtn
        ?.addEventListener(
            "click",
            scanGallery
        );

    dom.rebuildThumbsScannerBtn
        ?.addEventListener(
            "click",
            generateMissing
        );

    dom.repairGalleryBtn
        ?.addEventListener(
            "click",
            repairGallery
        );
        
    dom.cleanGalleryBtn
        ?.addEventListener(
            "click",
             cleanGallery
        );


    dom.exportReportBtn
       ?.addEventListener(
           "click",
            exportScannerReport
        );
        
        
    dom.refreshScannerBtn
        ?.addEventListener(
            "click",
            scanGallery
        );

}


// ======================================
// SCAN
// ======================================

async function scanGallery(
    silent = false
){

    try{

        if (!silent) {
            showToast(
                "Scanning gallery..."
            );
        }

        const data =
            await api(
                API.HEALTH
            );

        scannerData = {
            albums: data.albums,
            images: data.images,
            missingThumbs: data.missingThumbs,
            brokenImages: data.brokenImages,
            duplicateImages: data.duplicateImages,
            emptyAlbums: data.emptyAlbums
        };

        scannerLoaded = true;

        renderScanner();

        

        addScannerActivity(
            "Gallery scanned",
            `${scannerData.images} images indexed`
        );

        await loadActivity();
        
        if (!silent) {
            showToast(
                "Scan complete"
            );
        }

    }
    catch(err){

        console.error(err);

        showToast(
            err.message
        );

    }

}






async function loadScannerState(){

    if (scannerLoaded) {
        renderScanner();
        renderScannerActivity();
        return;
    }

    try{

        const data =
            await api(
                API.HEALTH
            );

        scannerData = {
            albums: data.albums,
            images: data.images,
            missingThumbs: data.missingThumbs,
            brokenImages: data.brokenImages,
            duplicateImages: data.duplicateImages,
            emptyAlbums: data.emptyAlbums
        };

        scannerLoaded = true;

        renderScanner();

    }
    catch(err){
        console.error(err);
    }
}





// ======================================
// ACTIONS
// ======================================


async function generateMissing(){

    try{

        showToast(
            "Generating thumbnails..."
        );

        await api(
            API.THUMBS,
            {
                method:"POST"
            }
        );

        await Promise.all([
            loadAllImages(),
            loadDashboard(),
            loadActivity()
        ]);

        
        addScannerActivity(
           "Thumbnails rebuilt",
           "Missing thumbnails regenerated"
        );

        await scanGallery(true);

       showToast(
           "Thumbnails rebuilt"
        );
    }
    catch(err){

        console.error(
            err
        );

        showToast(
            err.message
        );

    }

}





async function cleanGallery(){

    try{

        showToast(
            "Cleaning gallery..."
        );

        const data =
            await api(
                API.CLEAN,
                {
                    method:"POST"
                }
            );

        showToast(
            data.message
        );
        
        addScannerActivity(
             "Gallery cleanup completed"
        );

        await loadActivity();
        await scanGallery();

    }
    catch(err){

        console.error(
            err
        );

        showToast(
            err.message
        );

    }

}




async function repairGallery(){

    try{

        showToast(
            "Repairing gallery..."
        );

        const data =
            await api(
                API.REPAIR,
                {
                    method:"POST"
                }
            );

        showToast(
            data.message ||
            "Gallery repaired"
        );

        await Promise.all([
            loadAllImages(),
            loadDashboard(),
            loadActivity()
        ]);
        
        addScannerActivity(
            "Gallery repair completed"
        );

        await scanGallery(true);
    }
    catch(err){

        console.error(
            err
        );

        showToast(
            err.message
        );

    }

}






async function exportScannerReport(){

    try{

        showToast(
            "Generating report..."
        );

        const report =
            await api(
                API.REPORT
            );

        const blob =
            new Blob(
                [
                    JSON.stringify(
                        report,
                        null,
                        2
                    )
                ],
                {
                    type:
                        "application/json"
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const a =
            document.createElement(
                "a"
            );

        a.href =
            url;

        a.download =
            "scanner-report.json";

        a.click();

        URL.revokeObjectURL(
            url
        );

        showToast(
            "Report downloaded"
        );
        
        addScannerActivity(
           "Scanner report exported",
           "scanner-report.json"
        );

        await loadActivity();
        
    }
    catch(err){

        console.error(
            err
        );

        showToast(
            err.message
        );

    }

}






// ======================================
// RENDER
// ======================================


function renderScannerActivity(){

    if(
        !dom.scannerResults
    ){
        return;
    }

    if(
        !scannerTimeline.length
    ){

        dom.scannerResults.innerHTML = `
            <div class="empty-state">
                No scanner activity yet
            </div>
        `;

        return;
    }

    dom.scannerResults.innerHTML =
        scannerTimeline
            .map(
                item => `
                    <div class="timeline-item list-item">

                        <strong>
                            ✓ ${item.title}
                        </strong>

                        <small>
                            ${item.meta}
                            ${item.meta ? " • " : ""}
                            
                            ${formatDateTime(
                                item.time,
                                {
                                    hour: "numeric",
                                    minute: "2-digit"
                                }
                            )}


                        </small>

                    </div>
                `
            )
            .join("");

}






function renderScannerSummary(){

    if(!dom.scannerSummary){
        return;
    }

    dom.scannerSummary.innerHTML = `

        <div class="timeline-item">
            ✓ Indexed Images
            <strong>
                ${scannerData.images}
            </strong>
        </div>

        <div class="timeline-item">
            ✓ Missing Thumbnails
            <strong>
                ${scannerData.missingThumbs}
            </strong>
        </div>

        <div class="timeline-item">
            ✓ Broken Images
            <strong>
                ${scannerData.brokenImages}
            </strong>
        </div>

        <div class="timeline-item">
            ✓ Duplicate Images
            <strong>
                ${scannerData.duplicateImages}
            </strong>
        </div>

        <div class="timeline-item">
            ✓ Empty Albums
            <strong>
                ${scannerData.emptyAlbums}
            </strong>
        </div>

    `;

}






function renderScanner(){

    setText(
        dom.missingThumbsCount,
        scannerData.missingThumbs
    );

    setText(
        dom.brokenImagesCount,
        scannerData.brokenImages
    );

    setText(
        dom.duplicateImagesCount,
        scannerData.duplicateImages
    );

    setText(
        dom.emptyAlbumsCount,
        scannerData.emptyAlbums
    );

    const score =
        calculateHealthScore(
            scannerData
        );

    setText(
        dom.healthScoreBig,
        `${score}%`
    );

    let label =
        "Excellent";

    if(score < 90){
        label = "Good";
    }

    if(score < 70){
        label = "Warning";
    }

    if(score < 50){
        label = "Critical";
    }

    setText(
        dom.healthLabel,
        label
    );


    const statusEl = dom.scannerStatus;

    if (score >= 90) {
        statusEl.textContent = "🟢 Healthy";
        statusEl.className = "scanner-status good";
    }
     else if (score >= 70) {
        statusEl.textContent = "🟡 Attention";
        statusEl.className = "scanner-status warning";
    }
    else {
        statusEl.textContent = "🔴 Critical";
        statusEl.className = "scanner-status danger";
    }

 

    setText(
        dom.indexedImages,
         `${scannerData.images}
          Images Indexed`
     );


     
    setText(
        dom.lastScanBanner,
        `Scanned ${formatDateTime(
            new Date(),
            {
                hour: "numeric",
                minute: "2-digit"
            }
        )}`
    );


    renderScannerSummary();
    
}


