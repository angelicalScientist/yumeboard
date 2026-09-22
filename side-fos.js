async function loadFos(profileId) {

    const mainFo =
        document.getElementById("mainFo");

    const sideFosList =
        document.getElementById("sideFosList");


    if (!mainFo || !sideFosList) {
        return;
    }


    const {
        data: fos,
        error
    } = await supabaseClient
        .from("fos")
        .select("*")
        .eq("user_id", profileId)
        .order("is_main", {
            ascending: false
        })
        .order("created_at", {
            ascending: true
        });


    if (error) {

        console.error(
            "Couldn't load F/Os:",
            error
        );

        mainFo.innerHTML =
            "<p>Couldn't load F/Os... >_<</p>";

        sideFosList.innerHTML = "";

        return;
    }


    const main =
        fos.find(function (fo) {
            return fo.is_main === true;
        });


    const side =
        fos.filter(function (fo) {
            return fo.is_main !== true;
        });


    // ==========================
    // MAIN F/O
    // ==========================

    if (!main) {

        mainFo.innerHTML = `
            <p>
                No main F/O added yet! ♡
            </p>
        `;

    } else {

        mainFo.innerHTML =
            createFoCard(main, true);

    }


    // ==========================
    // SIDE F/Os
    // ==========================

    sideFosList.innerHTML = "";


    if (side.length === 0) {

        sideFosList.innerHTML = `
            <p>
                No side F/Os yet! ♡
            </p>
        `;

        return;
    }


    side.forEach(function (fo) {

        sideFosList.insertAdjacentHTML(
            "beforeend",
            createFoCard(fo, false)
        );

    });

}
function createFoCard(fo, isMain) {

    const image =
        fo.image_url
            ? `
                <img
                    class="side-fo-image"
                    src="${escapeHtml(fo.image_url)}"
                    alt="${escapeHtml(fo.name)}"
                >
              `
            : "";


    const doublesText = {

        welcome:
            "🌸 Doubles welcome",

        ask_first:
            "💭 Ask before interacting",

        no:
            "🔒 No doubles"

    };


    return `

        <article
            class="${isMain ? "main-fo" : "side-fo"}"
        >

            ${image}

            <div class="fo-info">

                <h3>
                    ♡ ${escapeHtml(fo.name)}
                </h3>

                ${
                    fo.fandom
                        ? `
                            <p>
                                🎀 ${escapeHtml(fo.fandom)}
                            </p>
                          `
                        : ""
                }

                ${
                    fo.relationship
                        ? `
                            <p>
                                💕 ${escapeHtml(
                                    fo.relationship
                                )}
                            </p>
                          `
                        : ""
                }

                ${
                    fo.description
                        ? `
                            <p>
                                ${escapeHtml(
                                    fo.description
                                )}
                            </p>
                          `
                        : ""
                }

                <p class="doubles-preference">
                    ${
                        doublesText[
                            fo.doubles_preference
                        ] || "💭 Doubles preference not specified"
                    }
                </p>

            </div>

        </article>

    `;
}


function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text || "";

    return div.innerHTML;

}