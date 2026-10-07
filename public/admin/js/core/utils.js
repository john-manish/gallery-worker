// ======================================
// HELPERS
// ======================================

window.$ = id =>
    document.getElementById(id);

window.$$ = selector =>
    document.querySelectorAll(
        selector
    );

window.on = (
    element,
    event,
    handler
) => {

    element?.addEventListener(
        event,
        handler
    );

};

window.toggle = (
    element,
    className,
    force
) => {

    element?.classList.toggle(
        className,
        force
    );

};

window.setText = (
    element,
    value = ""
) => {

    if(element){

        element.textContent =
            value;

    }

};

window.sleep = ms =>
    new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );








function calculateHealthScore(data){

    const issues =
        (data.missingThumbs || 0) +
        (data.brokenImages || 0) +
        (data.duplicateImages || 0) +
        (data.emptyAlbums || 0);

    return Math.max(
        100 - issues * 5,
        0
    );

}




// ======================================
// TOAST
// ======================================

const TOAST_TYPES = [
    "success",
    "error",
    "loading",
    "warning",
    "info"
];

window.showToast = function (
    message,
    type = "info"
){

    if(!dom.toast)
        return;

    clearTimeout(dom.toastTimer);

    dom.toast.className = "";

    dom.toast.classList.add(
        type,
        "show"
    );

    dom.toast.textContent = message;

    // Loading toast stays visible
    if(type === "loading")
        return;

    dom.toastTimer = setTimeout(() => {

        dom.toast.classList.remove(
            "show",
            ...TOAST_TYPES
        );

    }, CONFIG.TOAST_DURATION);

};


