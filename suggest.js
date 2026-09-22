// ==============================
// ELEMENTS
// ==============================

const suggestionForm =
    document.getElementById("suggestionForm");

const suggestionType =
    document.getElementById("suggestionType");

const fandomFields =
    document.getElementById("fandomFields");

const characterFields =
    document.getElementById("characterFields");

const aliasFields =
    document.getElementById("aliasFields");

const suggestedName =
    document.getElementById("suggestedName");

const characterName =
    document.getElementById("characterName");

const aliasName =
    document.getElementById("aliasName");

const suggestedDescription =
    document.getElementById("suggestedDescription");

const suggestedImage =
    document.getElementById("suggestedImage");

const suggestionMessage =
    document.getElementById("suggestionMessage");


// ==============================
// SEARCH ELEMENTS
// ==============================

const characterFandomSearch =
    document.getElementById(
        "characterFandomSearch"
    );

const characterSearch =
    document.getElementById(
        "characterSearch"
    );


// ==============================
// RESULT CONTAINERS
// ==============================

const fandomResults =
    document.getElementById(
        "fandomResults"
    );

const characterResults =
    document.getElementById(
        "characterResults"
    );


// ==============================
// SELECTED LABELS
// ==============================

const selectedFandom =
    document.getElementById(
        "selectedFandom"
    );

const selectedCharacter =
    document.getElementById(
        "selectedCharacter"
    );


// ==============================
// STATE
// ==============================

let selectedFandomId =
    null;

let selectedCharacterId =
    null;

let fandoms =
    [];

let characters =
    [];


// ==============================
// HTML ESCAPING
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
// RESET SELECTIONS
// ==============================

function resetSelections() {

    selectedFandomId =
        null;

    selectedCharacterId =
        null;


    characterFandomSearch.value =
        "";

    characterSearch.value =
        "";


    fandomResults.innerHTML =
        "";

    characterResults.innerHTML =
        "";


    selectedFandom.textContent =
        "";

    selectedCharacter.textContent =
        "";

}


// ==============================
// TYPE SWITCHING
// ==============================

suggestionType.addEventListener(
    "change",
    function () {

        resetSelections();


        fandomFields.style.display =
            "none";

        characterFields.style.display =
            "none";

        aliasFields.style.display =
            "none";


        suggestedName.required =
            false;

        characterName.required =
            false;

        aliasName.required =
            false;


        // ==========================
        // FANDOM
        // ==========================

        if (
            suggestionType.value ===
            "fandom"
        ) {

            fandomFields.style.display =
                "block";

            suggestedName.required =
                true;

        }


        // ==========================
        // CHARACTER
        // ==========================

        if (
            suggestionType.value ===
            "character"
        ) {

            characterFields.style.display =
                "block";

            characterName.required =
                true;

            loadFandoms();

        }


        // ==========================
        // ALIAS
        // ==========================

        if (
            suggestionType.value ===
            "alias"
        ) {

            aliasFields.style.display =
                "block";

            aliasName.required =
                true;

            loadCharacters();

        }

    }
);


// ==============================
// LOAD FANDOMS
// ==============================

async function loadFandoms() {

    if (
        fandoms.length > 0
    ) {

        return;

    }


    console.log(
        "Loading fandoms..."
    );


    const {
        data,
        error
    } =
        await supabaseClient
            .from("fandoms")
            .select(
                "id, name"
            )
            .order(
                "name",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "Couldn't load fandoms:",
            error
        );

        suggestionMessage.textContent =
            "Couldn't load the fandom list. >_<";

        return;

    }


    fandoms =
        data || [];


    console.log(
        "Fandoms loaded:",
        fandoms
    );

}


// ==============================
// LOAD APPROVED CHARACTERS
// ==============================

async function loadCharacters() {

    characterResults.innerHTML =
        "<p>Loading characters... 🌸</p>";


    console.log(
        "Loading approved characters..."
    );


    const {
        data: characterData,
        error: characterError
    } =
        await supabaseClient
            .from("characters")
            .select(
                "id, fandom_id, canonical_name, status"
            )
            .eq(
                "status",
                "approved"
            )
            .order(
                "canonical_name",
                {
                    ascending: true
                }
            );


    console.log(
        "Characters returned by Supabase:",
        characterData
    );

    console.log(
        "Character loading error:",
        characterError
    );


    if (characterError) {

        console.error(
            "Couldn't load characters:",
            characterError
        );

        characterResults.innerHTML =
            "<p>Couldn't load characters. >_<</p>";

        return;

    }


    // ==========================
    // LOAD FANDOMS
    // ==========================

    const {
        data: fandomData,
        error: fandomError
    } =
        await supabaseClient
            .from("fandoms")
            .select(
                "id, name"
            );


    if (fandomError) {

        console.error(
            "Couldn't load fandoms:",
            fandomError
        );

        characterResults.innerHTML =
            "<p>Couldn't load fandoms. >_<</p>";

        return;

    }


    // ==========================
    // CREATE FANDOM LOOKUP
    // ==========================

    const fandomMap =
        new Map();


    (fandomData || []).forEach(
        function (fandom) {

            fandomMap.set(
                fandom.id,
                fandom.name
            );

        }
    );


    // ==========================
    // PREPARE CHARACTERS
    // ==========================

    characters =
        (characterData || [])
            .map(
                function (character) {

                    return {

                        id:
                            character.id,

                        canonical_name:
                            character.canonical_name,

                        fandom_id:
                            character.fandom_id,

                        status:
                            character.status,

                        fandom_name:
                            fandomMap.get(
                                character.fandom_id
                            ) ||
                            "Unknown fandom"

                    };

                }
            );


    console.log(
        "Characters prepared for alias search:",
        characters
    );


    characterResults.innerHTML =
        "<p>Type a character name to search! ♡</p>";

}


// ==============================
// FANDOM SEARCH
// ==============================

characterFandomSearch.addEventListener(
    "input",
    function () {

        const query =
            characterFandomSearch.value
                .trim()
                .toLowerCase();


        selectedFandomId =
            null;

        selectedFandom.textContent =
            "";


        if (!query) {

            fandomResults.innerHTML =
                "";

            return;

        }


        const matches =
            fandoms
                .filter(
                    function (fandom) {

                        return fandom.name
                            .toLowerCase()
                            .includes(query);

                    }
                )
                .slice(
                    0,
                    8
                );


        renderFandomResults(
            matches
        );

    }
);


// ==============================
// RENDER FANDOM RESULTS
// ==============================

function renderFandomResults(
    matches
) {

    fandomResults.innerHTML =
        "";


    if (
        matches.length === 0
    ) {

        fandomResults.innerHTML =
            "<p>No matching fandoms found. ♡</p>";

        return;

    }


    matches.forEach(
        function (fandom) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "suggestion-result";


            button.textContent =
                fandom.name;


            button.addEventListener(
                "click",
                function () {

                    selectedFandomId =
                        fandom.id;


                    characterFandomSearch.value =
                        fandom.name;


                    selectedFandom.textContent =
                        `♡ Selected: ${fandom.name}`;


                    fandomResults.innerHTML =
                        "";

                }
            );


            fandomResults.appendChild(
                button
            );

        }
    );

}


// ==============================
// CHARACTER SEARCH
// ==============================

characterSearch.addEventListener(
    "input",
    function () {

        const query =
            characterSearch.value
                .trim()
                .toLowerCase();


        selectedCharacterId =
            null;


        selectedCharacter.textContent =
            "";


        if (!query) {

            characterResults.innerHTML =
                "<p>Type a character name to search! ♡</p>";

            return;

        }


        const matches =
            characters
                .filter(
                    function (character) {

                        return character
                            .canonical_name
                            .toLowerCase()
                            .includes(query);

                    }
                )
                .slice(
                    0,
                    8
                );


        renderCharacterResults(
            matches
        );

    }
);


// ==============================
// RENDER CHARACTER RESULTS
// ==============================

function renderCharacterResults(
    matches
) {

    characterResults.innerHTML =
        "";


    if (
        matches.length === 0
    ) {

        characterResults.innerHTML = `
            <p>
                No matching characters found. ♡
            </p>
        `;

        return;

    }


    matches.forEach(
        function (character) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "suggestion-result";


            button.innerHTML = `
                <strong>
                    ${escapeHtml(
                        character.canonical_name
                    )}
                </strong>

                <small>
                    ♡ ${escapeHtml(
                        character.fandom_name
                    )}
                </small>
            `;


            button.addEventListener(
                "click",
                function () {

                    selectedCharacterId =
                        character.id;


                    characterSearch.value =
                        character.canonical_name;


                    selectedCharacter.innerHTML = `
                        ♡ Selected:
                        <strong>
                            ${escapeHtml(
                                character.canonical_name
                            )}
                        </strong>
                        · ${escapeHtml(
                            character.fandom_name
                        )}
                    `;


                    characterResults.innerHTML =
                        "";

                }
            );


            characterResults.appendChild(
                button
            );

        }
    );

}


// ==============================
// SUBMIT SUGGESTION
// ==============================

suggestionForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        suggestionMessage.textContent =
            "Sending your suggestion... 🌸";


        // ==========================
        // CHECK LOGIN
        // ==========================

        const {
            data: {
                user
            },
            error: userError
        } =
            await supabaseClient
                .auth
                .getUser();


        if (userError) {

            console.error(
                "Auth error:",
                userError
            );

            suggestionMessage.textContent =
                "I couldn't check your login status. >_<";

            return;

        }


        if (!user) {

            suggestionMessage.textContent =
                "Please log in before suggesting something! ♡";

            return;

        }


        // ==========================
        // TYPE
        // ==========================

        const type =
            suggestionType.value;


        let name =
            "";


        if (
            type === "fandom"
        ) {

            name =
                suggestedName.value
                    .trim();

        }


        if (
            type === "character"
        ) {

            name =
                characterName.value
                    .trim();

        }


        if (
            type === "alias"
        ) {

            name =
                aliasName.value
                    .trim();

        }


        // ==========================
        // VALIDATE NAME
        // ==========================

        if (!name) {

            suggestionMessage.textContent =
                "Please give your suggestion a name! ♡";

            return;

        }


        // ==========================
        // VALIDATE FANDOM
        // ==========================

        if (
            type === "character" &&
            !selectedFandomId
        ) {

            suggestionMessage.textContent =
                "Please select a fandom from the search results first! ♡";

            return;

        }


        // ==========================
        // VALIDATE CHARACTER
        // ==========================

        if (
            type === "alias" &&
            !selectedCharacterId
        ) {

            suggestionMessage.textContent =
                "Please select the character from the search results first! ♡";

            return;

        }


        // ==========================
        // BUILD SUGGESTION
        // ==========================

        const suggestion = {

            suggestion_type:
                type,

            suggested_name:
                name,

            fandom_id:
                type === "character"
                    ? selectedFandomId
                    : null,

            character_id:
                type === "alias"
                    ? selectedCharacterId
                    : null,

            suggested_description:
                suggestedDescription.value
                    .trim()
                    || null,

            suggested_image_url:
                suggestedImage.value
                    .trim()
                    || null,

            submitted_by:
                user.id

        };


        console.log(
            "Submitting suggestion:",
            suggestion
        );


        // ==========================
        // INSERT
        // ==========================

        const {
            data,
            error
        } =
            await supabaseClient
                .from("suggestions")
                .insert(
                    suggestion
                )
                .select()
                .single();


        if (error) {

            console.error(
                "Suggestion submission failed:",
                error
            );

            suggestionMessage.textContent =
                `Supabase rejected the suggestion: ${error.message}`;

            return;

        }


        // ==========================
        // SUCCESS
        // ==========================

        console.log(
            "Suggestion submitted:",
            data
        );


        suggestionMessage.textContent =
            "Suggestion sent successfully! Thank you! 🌸";


        suggestionForm.reset();


        resetSelections();


        // Restore default view

        fandomFields.style.display =
            "block";

        characterFields.style.display =
            "none";

        aliasFields.style.display =
            "none";


        suggestedName.required =
            true;

        characterName.required =
            false;

        aliasName.required =
            false;

    }
);


// ==============================
// INITIALIZE
// ==============================

suggestionType.dispatchEvent(
    new Event("change")
);