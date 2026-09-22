const suggestionList =
    document.getElementById(
        "suggestionList"
    );

const moderatorMessage =
    document.getElementById(
        "moderatorMessage"
    );


// ==============================
// ESCAPE HTML
// ==============================

function escapeHtml(value) {

    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// ==============================
// LOAD SUGGESTIONS
// ==============================

async function loadSuggestions() {

    const {
        data: {
            user
        }
    } =
        await supabaseClient
            .auth
            .getUser();


    if (!user) {

        moderatorMessage.textContent =
            "Please log in first! ♡";

        return;

    }


    // ==========================
    // CHECK MODERATOR
    // ==========================

    const {
        data: isModerator,
        error: moderatorError
    } =
        await supabaseClient
            .rpc("is_moderator");


    if (moderatorError) {

        console.error(
            "Moderator check failed:",
            moderatorError
        );

        moderatorMessage.textContent =
            "Couldn't check moderator permissions. >_<";

        suggestionList.innerHTML =
            "";

        return;

    }


    if (!isModerator) {

        moderatorMessage.textContent =
            "You don't have moderator access. ♡";

        suggestionList.innerHTML =
            "";

        return;

    }


    // ==========================
    // LOAD SUGGESTIONS
    // ==========================

    const {
        data,
        error
    } =
        await supabaseClient
            .from("suggestions")
            .select(`
                *,
                character:characters (
                    id,
                    canonical_name,
                    fandom_id,
                    fandom:fandoms (
                        id,
                        name
                    )
                )
            `)
            .eq(
                "status",
                "pending"
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "Suggestion loading error:",
            error
        );

        moderatorMessage.textContent =
            "Couldn't load the suggestion queue. >_<";

        return;

    }


    console.log(
        "Suggestions with character information:",
        data
    );


    renderSuggestions(
        data || []
    );

}


// ==============================
// RENDER
// ==============================

function renderSuggestions(
    suggestions
) {

    suggestionList.innerHTML =
        "";


    if (
        suggestions.length === 0
    ) {

        suggestionList.innerHTML = `
            <p class="search-hint">
                No pending suggestions! 🎉
            </p>
        `;

        return;

    }


    suggestions.forEach(
        function (suggestion) {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "suggestion-card";


            // ==========================
            // TYPE LABEL
            // ==========================

            let typeLabel =
                suggestion.suggestion_type;


            if (
                suggestion.suggestion_type ===
                "fandom"
            ) {

                typeLabel =
                    "🌸 Fandom";

            }


            if (
                suggestion.suggestion_type ===
                "character"
            ) {

                typeLabel =
                    "✨ Character";

            }


            if (
                suggestion.suggestion_type ===
                "alias"
            ) {

                typeLabel =
                    "🏷️ Alias";

            }


            // ==========================
            // CHARACTER / FANDOM INFO
            // ==========================

            let relatedInfo =
                "";


            if (
                suggestion.suggestion_type ===
                "alias"
            ) {

                const character =
                    suggestion.character;


                if (character) {

                    const characterName =
                        character.canonical_name ||
                        "Unknown character";


                    const fandomName =
                        character.fandom &&
                        character.fandom.name
                            ? character.fandom.name
                            : "Unknown fandom";


                    relatedInfo = `

                        <div class="suggestion-related">

                            <p>
                                <strong>
                                    Character:
                                </strong>

                                ${escapeHtml(
                                    characterName
                                )}
                            </p>

                            <p>
                                <strong>
                                    Fandom:
                                </strong>

                                ${escapeHtml(
                                    fandomName
                                )}
                            </p>

                        </div>

                    `;

                }

                else {

                    relatedInfo = `

                        <div class="suggestion-related">

                            <p>
                                ⚠️ Character information
                                could not be loaded.
                            </p>

                        </div>

                    `;

                }

            }


            // ==========================
            // CARD
            // ==========================

            card.innerHTML = `

                <div class="suggestion-type">
                    ${typeLabel}
                </div>


                <h2>
                    ${escapeHtml(
                        suggestion.suggested_name
                    )}
                </h2>


                ${relatedInfo}


                ${
                    suggestion.suggested_description
                        ? `
                            <p>
                                ${escapeHtml(
                                    suggestion
                                        .suggested_description
                                )}
                            </p>
                        `
                        : ""
                }


                ${
                    suggestion.suggested_image_url
                        ? `
                            <img
                                class="suggestion-image"
                                src="${escapeHtml(
                                    suggestion
                                        .suggested_image_url
                                )}"
                                alt=""
                            >
                        `
                        : ""
                }


                <div class="suggestion-actions">

                    <button
                        class="approve-button"
                        data-id="${escapeHtml(
                            suggestion.id
                        )}"
                        data-type="${escapeHtml(
                            suggestion.suggestion_type
                        )}"
                    >
                        ✓ Approve
                    </button>


                    <button
                        class="reject-button"
                        data-id="${escapeHtml(
                            suggestion.id
                        )}"
                    >
                        ✕ Reject
                    </button>

                </div>

            `;


            suggestionList.appendChild(
                card
            );

        }
    );


    attachActions();

}


// ==============================
// BUTTONS
// ==============================

function attachActions() {

    document
        .querySelectorAll(
            ".approve-button"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    approveSuggestion
                );

            }
        );


    document
        .querySelectorAll(
            ".reject-button"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    rejectSuggestion
                );

            }
        );

}


// ==============================
// APPROVE
// ==============================

async function approveSuggestion(
    event
) {

    const button =
        event.currentTarget;


    const id =
        button.dataset.id;


    const type =
        button.dataset.type;


    button.disabled =
        true;


    let functionName;


    if (
        type === "fandom"
    ) {

        functionName =
            "approve_fandom_suggestion";

    }

    else if (
        type === "character"
    ) {

        functionName =
            "approve_character_suggestion";

    }

    else if (
        type === "alias"
    ) {

        functionName =
            "approve_alias_suggestion";

    }


    if (!functionName) {

        console.error(
            "Unknown suggestion type:",
            type
        );

        button.disabled =
            false;

        return;

    }


    const {
        error
    } =
        await supabaseClient
            .rpc(
                functionName,
                {
                    suggestion_uuid:
                        id
                }
            );


    if (error) {

        console.error(
            "Approval error:",
            error
        );

        alert(
            "Couldn't approve this suggestion. >_<"
        );

        button.disabled =
            false;

        return;

    }


    loadSuggestions();

}


// ==============================
// REJECT
// ==============================

async function rejectSuggestion(
    event
) {

    const button =
        event.currentTarget;


    const id =
        button.dataset.id;


    const note =
        prompt(
            "Optional reason for rejection:"
        );


    button.disabled =
        true;


    const {
        error
    } =
        await supabaseClient
            .rpc(
                "reject_suggestion",
                {
                    suggestion_uuid:
                        id,

                    note:
                        note || null
                }
            );


    if (error) {

        console.error(
            "Rejection error:",
            error
        );

        alert(
            "Couldn't reject this suggestion. >_<"
        );

        button.disabled =
            false;

        return;

    }


    loadSuggestions();

}


// ==============================
// START
// ==============================

loadSuggestions();