async function loadPopularPosts(){

    const container =
        document.getElementById(
            "popular-posts"
        );


    if(!container)
        return;


    try{


        const res =
            await fetch(
                "/articles/popular"
            );


        if(!res.ok){

            throw new Error(
                "Popular request failed"
            );

        }


        const json =
            await res.json();


        const posts =
            json.articles || [];



        if(posts.length === 0){

            container.innerHTML = `
                <p class="empty-popular">
                    No popular posts found.
                </p>
            `;

            return;

        }



        container.innerHTML =
            posts.map(
                function(a){


                    const imageUrl =
                        a.hero
                        ?
                        "/admin/live-preview-image?url=" +
                        encodeURIComponent(a.hero)
                        :
                        "";



                    const articleUrl =
                        "https://manish8090.dpdns.org/articles/" +
                        a.article;



                    return `

<a
class="popular-item"
href="${articleUrl}"
>


${imageUrl ? `

<img
class="popular-image"
src="${imageUrl}"
alt="${a.title || ""}"
>

` : ""}



<div class="popular-content">

<strong>
${a.title || "Untitled"}
</strong>


<span>
${a.displayDate || ""}
</span>


</div>


</a>

`;

                }

            ).join("");


    }
    catch(err){

        console.error(
            "Popular posts error:",
            err
        );

    }

}





function connectLivePreview(){


    const path =
        window.location.pathname;


    const match =
        path.match(
            /live-preview\/([^\/]+)/
        );


    if(!match){

        console.log(
            "No preview token found"
        );

        return;

    }



    const token =
        match[1];



    const source =
        new EventSource(
            "/admin/articles/live-preview/" +
            token +
            "/events"
        );



    source.onopen = ()=>{

        console.log(
            "Live preview connected"
        );
        
        
        document.body.dataset.livePreview =
            "connected";

    };



    source.onmessage =
    function(event){

        try{

            const data =
                JSON.parse(
                    event.data
                );

            console.log(
                "🔥 SSE UPDATE RECEIVED",
                data
            );


            /* ==================================================
               ARTICLE BODY
               ================================================== */

            if(
                typeof data.html === "string"
            ){

                const body =
                    document.getElementById(
                        "article-body"
                    );

                if(body){

                    body.innerHTML =
                        data.html;

                }

            }


            /* ==================================================
               METADATA
               ================================================== */

            if(data.meta){

                const meta =
                    data.meta;


                /* ------------------------------------------
                   TITLE
                   ------------------------------------------ */

                const title =
                    document.querySelector(
                        ".article-page-title"
                    );

                if(title){

                    title.textContent =
                        meta.title || "Live Preview";

                }

                /*
                 * Also update browser tab title.
                 */

                document.title =
                    meta.title || "Live Preview";


                /* ------------------------------------------
                   AUTHOR / ROLE / DATE
                   ------------------------------------------ */

                const author =
                    document.querySelector(
                        ".meta-left"
                    );

                if(author){

                    const parts = [];

                    if(meta.author){
                        parts.push(
                            meta.author
                        );
                    }

                    if(meta.role){
                        parts.push(
                            meta.role
                        );
                    }

                    if(meta.date){
                        parts.push(
                            meta.date
                        );
                    }

                    author.textContent =
                        parts.join(" · ");

                }


                /* ------------------------------------------
                   TAGS
                   ------------------------------------------ */

                const tags =
                    document.querySelector(
                        ".meta-right"
                    );

                if(tags){

                    tags.textContent =
                        meta.tags || "";

                }


                /* ------------------------------------------
                   HERO IMAGE
                   ------------------------------------------ */

                const hero =
                    document.querySelector(
                        ".article-page-hero"
                    );

                const articlePage =
                    document.querySelector(
                        ".content-card.article-page"
                    );


                if(meta.hero){

                    const heroUrl =
                        "/admin/live-preview-image?url=" +
                        encodeURIComponent(
                            meta.hero
                        );


                    if(hero){

                        const img =
                            hero.querySelector(
                                "img"
                            );


                        if(img){

                            img.src =
                                heroUrl;

                            img.alt =
                                meta.title || "";

                        }

                    }

                    else if(articlePage){

                        const pageArticle =
                            articlePage.querySelector(
                                ".page-article"
                            );


                        if(pageArticle){

                            pageArticle.insertAdjacentHTML(
                                "beforebegin",
                                `
                                <div class="article-page-hero">
                
                                    <img
                                        src="${heroUrl}"
                                        alt="${meta.title || ""}"
                                    >
                
                                </div>
                                `
                            );

                        }

                    }

                }

                else if(hero){

                    hero.remove();

                }


                /* ------------------------------------------
                   DRAFT / PROTECTED / POPULAR
                   ------------------------------------------ */

                /*
                 * These values are now transmitted through
                 * SSE and are available here.
                 *
                 * We intentionally do not modify the
                 * published site's article list because
                 * Live Preview is temporary and unsaved.
                 */

                if(
                    typeof meta.draft !== "undefined"
                ){

                    document.body.dataset.previewDraft =
                        String(meta.draft);

                }

                if(
                    typeof meta.protected !== "undefined"
                ){

                    document.body.dataset.previewProtected =
                        String(meta.protected);

                }

                if(
                    typeof meta.popular !== "undefined"
                ){

                    document.body.dataset.previewPopular =
                        String(meta.popular);

                }

            }

        }
        catch(err){

            console.error(
                "Preview update error",
                err
            );

        }

    };



    source.onerror =
        function(err){

            console.warn(
                "Live preview reconnecting",
                err
            );
            
            document.body.dataset.livePreview =
                "reconnecting";
        

        };
        
        
    
    
    
    window.addEventListener(
        "beforeunload",
        ()=>{

            source.close();
    
        }
    );


}





loadPopularPosts();

connectLivePreview();