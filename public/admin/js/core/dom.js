// ======================================
// DOM CACHE
// ======================================

window.dom = {};

window.cacheDom = function(){

    Object.assign(
        dom,
        {
            app:
                $("app"),

            loginOverlay:
                $("loginOverlay"),

            loginForm:
                $("loginForm"),

            password:
                $("password"),

            sidebar:
                document.querySelector(
                    ".sidebar"
                ),

            overlay:
                $("sidebarOverlay"),

            rail:
                document.querySelector(
                    ".activity-rail"
                ),


            notificationBtn:
                document.getElementById(
                    "notificationBtn"
                ),
            


            profileBtn:
                 document.getElementById("profileBtn"),

            profileMenu:
                 document.getElementById("profileMenu"),

            profileLogoutBtn:
                 document.getElementById("profileLogoutBtn"),

            profileWorkspaceBtn:
                 document.getElementById("profileWorkspaceBtn"),


            profileThemeBtn:
                document.getElementById(
                    "profileThemeBtn"
                ),


            themeMenu:
                document.getElementById(
                    "themeMenu"
                ),



            profileBackupBtn:
                document.getElementById(
                    "profileBackupBtn"
                ),





            mobileMenuBtn:
                $("mobileMenuBtn"),

            showRailBtn:
                $("showRailBtn"),

            closeRailBtn:
                $("closeRailBtn"),

            logoutBtn:
                $("logoutBtn"),

            pageButtons:
                $$("[data-page]"),

            toast:
                $("toast"),
                




            dashboardHealth:
                $("dashboardHealth"),    
                
            recentUploads:
                $("recentUploads"),

            uploadsTodayDashboard:
                $("uploadsTodayDashboard"), 
                
                         
            
            dashboardCreateAlbumBtn:
                $("dashboardCreateAlbumBtn"),

            dashboardUploadBtn:
                $("dashboardUploadBtn"),

            dashboardScanBtn:
                $("dashboardScanBtn"),

            dashboardImagesBtn:
                $("dashboardImagesBtn"),




            
            topbarAlbumBtn:
                $("topbarAlbumBtn"),

            topbarUploadBtn:
                $("topbarUploadBtn"),

            topbarScanBtn:
                $("topbarScanBtn"),
            



            albumGrid:
                $("albumGrid"),

            imageGrid:
                $("imageGrid"),

            imageModal:
                $("imageModal"),

            modalImage:
                $("modalImage"),

            closeModal:
                $("closeModal"),

            albumsCount:
                $("albumsCount"),



            imagesPageTitle:
                $("imagesPageTitle"),

            imagesPageSubtitle:
                $("imagesPageSubtitle"),

            backToAlbumsBtn:
                $("backToAlbumsBtn"),



            imagesCount:
                $("imagesCount"),

            selectAllImages:
                $("selectAllImages"),

            imageAlbumFilter:
                $("imageAlbumFilter"),

            deleteSelectedBtn:
                $("deleteSelectedBtn"),

            moveSelectedBtn:
                $("moveSelectedBtn"),

            downloadZipBtn:
                $("downloadZipBtn"),

            rebuildThumbsBtn:
                $("rebuildThumbsBtn"),

            storageSize:
                $("storageSize"),
                
            mobileSearchBtn:
    document.getElementById(
        "mobileSearchBtn"
    ),
                
            commandOverlay:
                $("commandOverlay"),

            commandPalette:
                $("commandPalette"),

            commandInput:
                $("commandInput"),

            commandResults:
                $("commandResults"),

                
            infoModal:
$("#infoModal"),

            albumSearch:
                $("albumSearch"),

            imageSearch:
                $("imageSearch"),

            albumSort:
                $("albumSort"),

            refreshAlbums:
                $("refreshAlbums"),

            newAlbumBtn:
                $("newAlbumBtn"),

            emptyAlbums:
                $("emptyAlbums"),

            globalSearch:
                $("globalSearch"),

            activityFeed:
                $("activityFeed"),




            // ======================================
            // SCANNER
            // ======================================

             scanGalleryBtn:
                 $("scanGalleryBtn"),

            rebuildThumbsScannerBtn:
                $("rebuildThumbsScannerBtn"),

            repairGalleryBtn:
                $("repairGalleryBtn"),
                
            cleanGalleryBtn:
                $("cleanGalleryBtn"),

             missingThumbsCount:
                $("missingThumbsCount"),

            brokenImagesCount:
                $("brokenImagesCount"),

            duplicateImagesCount:
                $("duplicateImagesCount"),

            emptyAlbumsCount:
                $("emptyAlbumsCount"),
                
            
            exportReportBtn:
                $("exportReportBtn"),
                
            indexedImages:
                document.getElementById(
                "indexedImages"
            ),

           lastScanBanner:
               document.getElementById(
                 "lastScanBanner"
               ),

          healthScoreBig:
               document.getElementById(
                  "healthScoreBig"
               ),

          healthLabel:
              document.getElementById(
                  "healthLabel"
              ),
              
           scannerSummary:
                   $("scannerSummary"),

           scannerResults:
              document.getElementById(
                   "scannerResults"
              ),
              
            
            refreshScannerBtn:
                document.getElementById(
                "refreshScannerBtn"
             ),
 
              
              scannerStatus:
                 $("scannerStatus"),
 
 


            // ======================================
            // ANALYTICS
            // ======================================

            analyticsAlbums:
               $("analyticsAlbums"),

            analyticsImages:
               $("analyticsImages"),

            analyticsStorage:
               $("analyticsStorage"),

            uploadsToday:
               $("uploadsToday"),

            largestAlbumAnalytics:
               $("largestAlbumAnalytics"),

            averageImageSize:
               $("averageImageSize"),

            spaceSaved:
               $("spaceSaved"),

            newestAlbum:
               $("newestAlbum"),
            
            mostActiveAlbum:
               $("mostActiveAlbum"),

            largestImage:
               $("largestImage"),

            mostActiveDay:
               $("mostActiveDay"),


            totalStorage:
               $("totalStorage"),

            imagesStorage:
               $("imagesStorage"),

            thumbsStorage:
               $("thumbsStorage"),

            
            
            storageGrowth:
               $("storageGrowth"),




        albumsGrowthText:
    $("albumsGrowthText"),

imagesGrowthText:
    $("imagesGrowthText"),

storageSubtextMetric:
    $("storageSubtextMetric"),

uploadsChangeText:
    $("uploadsChangeText"),

spaceSavedText:
    $("spaceSavedText"),


         

        }
    );

};