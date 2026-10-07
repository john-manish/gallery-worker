

(function(){

    const script =
        document.createElement("script");

    script.src =
        "https://cdn.jsdelivr.net/npm/eruda";

    script.onload = function(){

        eruda.init();

        console.log(
            "Eruda enabled"
        );

    };

    document.head.appendChild(script);

})();