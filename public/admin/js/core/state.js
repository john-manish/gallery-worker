// ======================================
// APP STATE
// ======================================

window.state = {
    // App
    currentPage: "dashboard",
    sidebarOpen: false,
    railOpen: false,
    authenticated: false,

    // Gallery
    albums: [],
    allImages: [],
    images: [],

    // Selection
    selectedAlbum: "",
    selectedImages: [],
    moveDestination: "",
    selectedUploadAlbum: "",

    // Search
    search: "",
    searchIndex: []
};