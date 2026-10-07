/* ============================================================================
   AI CENTER / ASSISTANT
   Dynamic Gallery OS Intelligence Layer
============================================================================ */


const AI = {


    history: [],

    storageKey:
    "gallery_ai_history",



    init(){


        this.loadHistory();

        this.bindEvents();

        this.renderHistory();

        this.loadDashboard();

    },







    bindEvents(){


        const input =
        document.getElementById(
            "aiPromptInput"
        );


        const send =
        document.getElementById(
            "aiSendBtn"
        );



        if(send){

            send.onclick =
            ()=>{

                this.ask(
                    input.value
                );

            };

        }





        if(input){

            input.addEventListener(
                "keydown",
                e=>{


                    if(
                        e.key==="Enter"
                    ){

                        this.ask(
                            input.value
                        );

                    }


                }
            );

        }







        document
        .querySelectorAll(
            ".ai-example-list .btn"
        )
        .forEach(btn=>{


            btn.onclick =
            ()=>{


                input.value =
                btn.textContent.trim();


                input.focus();


            };


        });





const refresh =
document.getElementById(
    "refreshAIButton"
);


if(refresh){

    refresh.onclick =
    ()=>{

        this.loadDashboard();

    };

}



        const clear =
        document.getElementById(
            "clearAIHistoryBtn"
        );


        if(clear){

            clear.onclick =
            ()=>{


                this.history=[];


                localStorage.removeItem(
                    this.storageKey
                );


                this.renderHistory();


            };

        }


    },









// ==================================================
// LOAD AI DASHBOARD
// ==================================================


async loadDashboard(){


    try{


        const res =
        await fetch(
            "/api/ai/dashboard"
        );


        const data =
        await res.json();



        if(!data.success)
            return;



        this.renderFindings(
            data.findings
        );


        this.renderActions(
            data.actions
        );


        this.renderStats(
            data.stats
        );


        this.renderActivity(
            data.activity
        );



    }
    catch(err){


        console.error(
            "AI dashboard:",
            err
        );


    }


},







// ==================================================
// FINDINGS
// ==================================================


renderFindings(findings){


    const box =
    document.getElementById(
        "aiFindings"
    );


    if(!box)
        return;



    box.innerHTML="";



    if(!findings.length){


        box.innerHTML =
        `
        <div class="ai-item">
            <strong>
            No issues found
            </strong>

            <p>
            Gallery is healthy.
            </p>
        </div>
        `;


        return;

    }





    findings.forEach(
    item=>{


        const div =
        document.createElement(
            "div"
        );


        div.className =
        "ai-item " +
        item.type;



        div.innerHTML =
        `
        <div>

        <strong>
        ${item.title}
        </strong>

        <p>
        ${item.message}
        </p>

        </div>
        `;



        if(item.action){


            const btn =
            document.createElement(
                "button"
            );


            btn.className =
            "btn";


            btn.textContent =
            "Fix";



            btn.onclick =
            ()=>{

                this.executeAction(
                    item.action
                );

            };


            div.appendChild(
                btn
            );


        }



        box.appendChild(
            div
        );


    });


},







// ==================================================
// ACTIONS
// ==================================================


renderActions(actions){


    const box =
    document.querySelector(
        ".ai-actions"
    );


    if(!box)
        return;



    box.innerHTML="";



    actions.forEach(
    action=>{


        const btn =
        document.createElement(
            "button"
        );


        btn.className =
        "btn";



        btn.textContent =
        action.label;



        btn.onclick =
        ()=>{


            this.executeAction(
                action.id
            );


        };



        box.appendChild(
            btn
        );


    });


},





formatActionResult(action,result){


    if(!result){

        return "Action completed successfully.";

    }



    switch(action){


        case "analyze":

            return `
Gallery Health Report

Albums:
${result.albums ?? 0}

Images:
${result.images ?? 0}

Missing thumbnails:
${result.missingThumbs ?? 0}

Broken images:
${result.brokenImages ?? 0}

Empty albums:
${result.emptyAlbums ?? 0}
`;



        case "sync":

            return `
Sync Result

Changed:
${result.changed ? "Yes" : "No"}

Albums:
${result.albums ?? 0}

Images:
${result.images ?? 0}
`;



        case "repair-thumbnails":

            return `
Thumbnail Repair

Rebuilt:
${result.rebuilt ?? 0}

Skipped:
${result.skipped ?? 0}

Failed:
${result.failed ?? 0}
`;



        case "optimize":

            return `
Optimization Suggestions

${
Array.isArray(result.suggestions)
?
result.suggestions.join("\n")
:
"No suggestions available"
}
`;



        default:

            return JSON.stringify(
                result,
                null,
                2
            );

    }

},





async executeAction(action){


    this.addActivity(
        "Running AI action: "
        + action
    );



    try{


        const res =
        await fetch(
            "/api/ai/action",
            {

            method:"POST",

            headers:{
                "Content-Type":
                "application/json"
            },


            body:
            JSON.stringify({
                action
            })

            }
        );



        const data =
        await res.json();



        this.addMessage(
    "ai",
`
Action completed:

${this.formatActionResult(
    action,
    data.result
)}
`
);



        this.loadDashboard();


    }
    catch(err){


        this.addMessage(
            "ai",
            err.message
        );


    }


},







renderStats(stats){

    // reserved for future AI stat widgets

},






renderActivity(activity){


    const box =
    document.querySelector(
        ".activity-list"
    );


    if(!box)
        return;



    box.innerHTML="";



    activity.forEach(
    item=>{


        const div =
        document.createElement(
            "div"
        );


        div.className =
        "list-item";


        div.textContent =
        item.action ||
        item.details ||
        JSON.stringify(item);



        box.appendChild(
            div
        );


    });


},







// ==================================================
// CHAT
// ==================================================


async ask(text){


    text =
    text.trim();



    if(!text)
        return;



    this.addMessage(
        "user",
        text
    );



    document
    .getElementById(
        "aiPromptInput"
    )
    .value="";



    try{


        const res =
        await fetch(
            "/api/ai",
            {

            method:"POST",

            headers:{
                "Content-Type":
                "application/json"
            },


            body:
            JSON.stringify({
                prompt:text
            })

            }
        );



        const data =
        await res.json();



        this.addMessage(
            "ai",
`
${data.title || "AI"}

${data.message || data.reply}
`
        );



    }
    catch(err){


        this.addMessage(
            "ai",
            err.message
        );


    }


},







addMessage(type,message){


    const box =
    document.getElementById(
        "aiConversation"
    );


    if(!box)
        return;



    const div =
    document.createElement(
        "div"
    );


    div.className =
    "ai-message "
    + type;



    div.textContent =
    message;



    box.appendChild(
        div
    );



    box.scrollTop =
    box.scrollHeight;



    this.history.push({

        type,

        message,

        time:
        Date.now()

    });


    this.saveHistory();


},







renderHistory(){


    const box =
    document.getElementById(
        "aiConversation"
    );


    if(!box)
        return;



    box.innerHTML="";


    this.history.forEach(
    item=>{


        const div =
        document.createElement(
            "div"
        );


        div.className =
        "ai-message "
        + item.type;



        div.textContent =
        item.message;



        box.appendChild(
            div
        );


    });


},







saveHistory(){


    localStorage.setItem(

        this.storageKey,

        JSON.stringify(
            this.history
        )

    );


},







loadHistory(){


    try{


        this.history =
        JSON.parse(
            localStorage.getItem(
                this.storageKey
            )
        )
        ||
        [];


    }
    catch{

        this.history=[];

    }


},







addActivity(text){


    const box =
    document.querySelector(
        ".activity-list"
    );


    if(!box)
        return;



    const div =
    document.createElement(
        "div"
    );


    div.className =
    "list-item";


    div.textContent =
    text;



    box.prepend(
        div
    );


}



};




document.addEventListener(
"DOMContentLoaded",
()=>{

    AI.init();

});