const foForm = document.getElementById("foForm");
const foList = document.getElementById("foList");
const foMessage = document.getElementById("foMessage");

const foEditorTitle = document.getElementById("foEditorTitle");

const characterSearch = document.getElementById("characterSearch");
const characterResults = document.getElementById("characterResults");
const selectedCharacter = document.getElementById("selectedCharacter");
const characterIdInput = document.getElementById("characterId");

const foDisplayName = document.getElementById("foDisplayName");
const foRelationship = document.getElementById("foRelationship");
const foDescription = document.getElementById("foDescription");
const foImage = document.getElementById("foImage");
const isMain = document.getElementById("isMain");
const doublesPreference = document.getElementById("doublesPreference");

const cancelEdit = document.getElementById("cancelEdit");
const backButton = document.getElementById("backButton");


let currentUser = null;
let editingFoId = null;
let characters = [];


// ======================================
// MESSAGE
// ======================================

function showMessage(message) {

    foMessage.textContent = message;

}


// ======================================
// GET USER
// ======================================

async function getCurrentUser() {

    const {
        data,
        error
    } = await supabaseClient.auth.getUser();


    if (error) {

        console.error("Auth error:", error);

        showMessage(
            "Couldn't check your login. :("
        );

        return null;
    }


    if (!data.user) {

        showMessage(
            "Please log in before managing your F/Os! 🌸"
        );

        foForm.style.display = "none";

        return null;
    }


    return data.user;

}


// ======================================
// LOAD CHARACTERS
// ======================================

async function loadCharacters() {

    const {
        data,
        error
    } = await supabaseClient
        .from("characters")
        .select(`
            id,
            canonical_name,
            image_url,
            fandom_id,

            fandoms (
                id,
                name
            ),

            character_aliases (
                id,
                alias
            )
        `)
        .order("canonical_name");


    if (error) {

        console.error(
            "Character loading error:",
            error
        );

        showMessage(
            "Couldn't load the character list. :("
        );

        return;
    }


    characters = data || [];

}

// ======================================
// CHARACTER SEARCH
// ======================================

characterSearch.addEventListener(
    "input",
    function () {

        const search =
            characterSearch.value
                .trim()
                .toLowerCase();


        characterResults.innerHTML = "";


        // Don't show a giant list when only one
        // letter has been typed.
        if (search.length < 2) {

            if (search.length === 1) {

                characterResults.innerHTML = `
                    <p class="search-hint">
                        Keep typing to search... ♡
                    </p>
                `;

            }

            return;
        }


        const matches =
            characters.filter(
                function (character) {

                    const canonical =
                        (
                            character.canonical_name || ""
                        ).toLowerCase();


                    const aliases =
                        (
                            character.character_aliases || []
                        ).map(
                            function (item) {

                                return (
                                    item.alias || ""
                                ).toLowerCase();

                            }
                        );


                    return (
                        canonical.includes(search) ||
                        aliases.some(
                            function (alias) {

                                return alias.includes(search);

                            }
                        )
                    );

                }
            );


        if (matches.length === 0) {
            characterResults.innerHTML = `
                <p class="search-hint">
                    No characters found... ♡
                </p>

                <p class="search-hint">
                    Can't find them in the database?
                    <a href="suggest.html">
                        ✨ Suggest a new F/O, fandom, or alias
                    </a>
                </p>
            `;

            return;
        }


        // Only display the first 8 results.
        matches
            .slice(0, 8)
            .forEach(
                function (character) {

                    const button =
                        document.createElement("button");


                    button.type =
                        "button";


                    button.className =
                        "character-result";


                    const fandomName =
                        character.fandoms &&
                        character.fandoms.name
                            ? character.fandoms.name
                            : "Unknown fandom";


                    button.innerHTML = `

                        <span class="character-result-name">
                            ${escapeHtml(
                                character.canonical_name
                            )}
                        </span>

                        <span class="character-result-fandom">
                            ♡ ${escapeHtml(
                                fandomName
                            )}
                        </span>

                    `;


                    button.addEventListener(
                        "click",
                        function () {

                            selectCharacter(
                                character
                            );

                        }
                    );


                    characterResults.appendChild(
                        button
                    );

                }
            );


        if (matches.length > 8) {

            const more =
                document.createElement("p");


            more.className =
                "search-more";


            more.textContent =
                `Showing 8 of ${matches.length} matches. Keep typing to narrow it down! ♡`;


            characterResults.appendChild(
                more
            );

        }

    }
);

// ======================================
// SELECT CHARACTER
// ======================================

function selectCharacter(character) {

    characterIdInput.value =
        character.id;


    characterSearch.value =
        character.canonical_name;


    foDisplayName.value =
        character.canonical_name;


    selectedCharacter.innerHTML = `
        ♡ <strong>
            ${escapeHtml(
                character.canonical_name
            )}
        </strong>
    `;


    characterResults.innerHTML = "";


    const aliases =
        character.character_aliases || [];


    if (aliases.length > 0) {

        const aliasBox =
            document.createElement("div");


        aliasBox.className =
            "alias-picker";


        aliasBox.innerHTML = `
            <small>
                ♡ Choose a preferred name:
            </small>
        `;


        const aliasButtons =
            document.createElement("div");


        aliasButtons.className =
            "alias-buttons";


        const names = [
            character.canonical_name,
            ...aliases.map(
                function (item) {
                    return item.alias;
                }
            )
        ];


        names.forEach(
            function (name) {

                const button =
                    document.createElement("button");


                button.type =
                    "button";


                button.className =
                    "alias-button";


                button.textContent =
                    name;


                button.addEventListener(
                    "click",
                    function () {

                        foDisplayName.value =
                            name;

                    }
                );


                aliasButtons.appendChild(
                    button
                );

            }
        );


        aliasBox.appendChild(
            aliasButtons
        );


        selectedCharacter.appendChild(
            aliasBox
        );

    }

}


// ======================================
// LOAD F/Os
// ======================================

async function loadFos() {
    if (!currentUser) {
        console.error("No current user.");
        return;
    }

    if (!foList) {
        console.error("F/O list container not found.");
        return;
    }

    foList.innerHTML = "<p>Loading F/Os... 🌸</p>";

    const { data, error } = await supabaseClient
        .from("fos")
        .select(`
            id,
            user_id,
            character_id,
            name,
            relationship,
            description,
            image_url,
            is_main,
            doubles_preference,
            characters (
                id,
                canonical_name,
                image_url
            )
        `)
        .eq("user_id", currentUser.id)
        .order("is_main", {
            ascending: false
        });

    if (error) {
        console.error("F/O loading error:", error);

        foList.innerHTML = `
            <p>
                Couldn't load your F/Os. :(
            </p>
        `;

        return;
    }

    console.log("Loaded F/Os:", data);

    renderFos(data || []);
}

// ======================================
// RENDER F/Os
// ======================================

function renderFos(fos) {

    foList.innerHTML = "";


    if (fos.length === 0) {

        foList.innerHTML = `
            <p>
                You haven't added any F/Os yet! ♡
            </p>
        `;

        return;
    }


    fos.forEach(
        function (fo) {

            const character =
                fo.characters;


            if (!character) {

                console.warn(
                    "F/O has no character:",
                    fo
                );

                return;
            }


            const card =
                document.createElement("article");


            card.className =
                "managed-fo";


            const image =
                fo.image_url ||
                character.image_url;


            const imageHTML =
                image
                    ? `
                        <img
                            src="${escapeHtml(image)}"
                            alt="${escapeHtml(
                                character.canonical_name
                            )}"
                            class="managed-fo-image"
                        >
                    `
                    : `
                        <div class="managed-fo-no-image">
                            ♡
                        </div>
                    `;


            const doublesLabels = {

                welcome:
                    "🌸 Doubles welcome",

                ask_first:
                    "💭 Ask before interacting",

                no:
                    "🔒 No doubles"

            };


            card.innerHTML = `

                ${imageHTML}

                <div class="managed-fo-info">

                    <h3>

                        ♡ ${escapeHtml(
                            character.canonical_name
                        )}

                        ${
                            fo.is_main
                                ? `
                                    <span class="main-badge">
                                        MAIN F/O
                                    </span>
                                `
                                : ""
                        }

                    </h3>


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


                    <p>
                        ${
                            doublesLabels[
                                fo.doubles_preference
                            ] ||
                            "💭 Preference not specified"
                        }
                    </p>


                    <div class="managed-fo-buttons">

                        <button
                            type="button"
                            class="edit-fo"
                        >
                            ✏️ Edit
                        </button>


                        <button
                            type="button"
                            class="delete-fo"
                        >
                            🗑️ Delete
                        </button>

                    </div>

                </div>
            `;


            const editButton =
                card.querySelector(".edit-fo");


            const deleteButton =
                card.querySelector(".delete-fo");


            editButton.addEventListener(
                "click",
                function () {

                    startEditing(fo);

                }
            );


            deleteButton.addEventListener(
                "click",
                function () {

                    deleteFo(fo.id);

                }
            );


            const imageElement =
                card.querySelector(".managed-fo-image");


            if (imageElement) {

                imageElement.addEventListener(
                    "error",
                    function () {

                        console.warn(
                            "Image could not be loaded:",
                            image
                        );


                        imageElement.style.display =
                            "none";

                    }
                );

            }


            foList.appendChild(card);

        }
    );

}


// ======================================
// EDIT
// ======================================

function startEditing(fo) {

    if (!fo) {
        return;
    }


    editingFoId =
        fo.id;


    foEditorTitle.textContent =
        "♡ Edit F/O ♡";


    characterIdInput.value =
        fo.character_id;


    characterSearch.value =
        fo.characters
            ? fo.characters.canonical_name
            : "";


    selectedCharacter.innerHTML = `
        ♡ <strong>
            ${
                fo.characters
                    ? escapeHtml(
                        fo.characters.canonical_name
                    )
                    : "Character"
            }
        </strong>
    `;


    foRelationship.value =
        fo.relationship || "";


    foDescription.value =
        fo.description || "";

    foDisplayName.value =
        fo.name || fo.characters.canonical_name;

    foImage.value =
        fo.image_url || "";


    isMain.checked =
        fo.is_main === true;


    doublesPreference.value =
        fo.doubles_preference ||
        "ask_first";


    characterResults.innerHTML = "";


    showMessage(
        "Editing your F/O! Make your changes and save. ♡"
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// ======================================
// SAVE
// ======================================

foForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        if (!currentUser) {

            showMessage(
                "Please log in first! >_<"
            );

            return;
        }


        if (!characterIdInput.value) {

            showMessage(
                "Please choose a character first! ♡"
            );

            return;
        }


        showMessage(
            "Saving your F/O... 🌸"
        );


        const selectedCharacter =
            characters.find(
                function (character) {
                    return character.id === characterIdInput.value;
                }
            );


        if (!selectedCharacter) {

            showMessage(
                "Please choose a character first! ♡"
            );

            return;
        }


       const payload = {

            name:
                foDisplayName.value.trim(),

            character_id:
                characterIdInput.value,

            relationship:
                foRelationship.value.trim(),

            description:
                foDescription.value.trim(),

            image_url:
                foImage.value.trim() ||
                null,

            is_main:
                isMain.checked,

            doubles_preference:
                doublesPreference.value

        };
        if (!foDisplayName.value.trim()) {

            showMessage(
                "Please choose a name to display for your F/O! ♡"
            );

            return;
        }
        console.log(
            "Saving F/O:",
            payload
        );


        let result;


        if (editingFoId) {

            result =
                await supabaseClient
                    .from("fos")
                    .update(payload)
                    .eq(
                        "id",
                        editingFoId
                    )
                    .eq(
                        "user_id",
                        currentUser.id
                    )
                    .select()
                    .single();

        } else {

            result =
                await supabaseClient
                    .from("fos")
                    .insert({
                        ...payload,
                        user_id:
                            currentUser.id
                    })
                    .select()
                    .single();

        }


        console.log(
            "Save result:",
            result
        );


        if (result.error) {

            console.error(
                "SAVE ERROR:",
                result.error
            );


            if (
                result.error.code === "23505"
            ) {

                showMessage(
                    "You already have a main F/O! ♡"
                );

            } else {

                showMessage(
                    "Supabase rejected the save: " +
                    result.error.message
                );

            }

            return;
        }


        showMessage(
            "Profile F/O saved successfully! 🌸"
        );


        resetForm();


        await loadFos();

    }
);


// ======================================
// DELETE
// ======================================

async function deleteFo(id) {

    const confirmed =
        window.confirm(
            "Remove this F/O from your profile? ♡"
        );


    if (!confirmed) {
        return;
    }


    const {
        error
    } =
        await supabaseClient
            .from("fos")
            .delete()
            .eq(
                "id",
                id
            )
            .eq(
                "user_id",
                currentUser.id
            );


    if (error) {

        console.error(
            "Delete error:",
            error
        );

        showMessage(
            "Couldn't delete that F/O. :("
        );

        return;
    }


    showMessage(
        "F/O removed! ♡"
    );


    await loadFos();

}


// ======================================
// RESET
// ======================================

function resetForm() {

    editingFoId =
        null;


    foForm.reset();


    characterIdInput.value =
        "";


    characterSearch.value =
        "";


    selectedCharacter.textContent =
        "No character selected yet.";


    characterResults.innerHTML =
        "";


    foEditorTitle.textContent =
        "♡ Add an F/O ♡";

}


// ======================================
// CANCEL
// ======================================

cancelEdit.addEventListener(
    "click",
    function () {

        resetForm();

        showMessage("");

    }
);


// ======================================
// BACK
// ======================================

backButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "indexter.html";

    }
);


// ======================================
// ESCAPE HTML
// ======================================

function escapeHtml(value) {

    const div =
        document.createElement("div");


    div.textContent =
        value || "";


    return div.innerHTML;

}


// ======================================
// START
// ======================================

async function start() {

    currentUser =
        await getCurrentUser();


    if (!currentUser) {
        return;
    }


    await loadCharacters();

    await loadFos();

}


start();