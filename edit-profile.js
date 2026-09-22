const profileForm =
    document.getElementById("profileForm");

const editorMessage =
    document.getElementById("editorMessage");

const backButton =
    document.getElementById("backButton");

// ==============================
// FORM ELEMENTS
// ==============================

const usernameInput =
    document.getElementById("username");

const displayNameInput =
    document.getElementById("displayName");

const bioInput =
    document.getElementById("bio");

const foNameInput =
    document.getElementById("foName");

const foRelationshipInput =
    document.getElementById("foRelationship");

const foDescriptionInput =
    document.getElementById("foDescription");

const fandomSearch =
    document.getElementById("fandomSearch");

const fandomResults =
    document.getElementById("fandomResults");

const selectedFandoms =
    document.getElementById("selectedFandoms");

const moodInput =
    document.getElementById("mood");

const avatarUrlInput =
    document.getElementById("avatarUrl");

const bannerUrlInput =
    document.getElementById("bannerUrl");

// ==============================
// FANDOM STATE
// ==============================

let allFandoms = [];

let selectedFandomIds = [];

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
// LOAD FANDOMS
// ==============================

async function loadFandoms() {
    const {
        data,
        error
    } = await supabaseClient
        .from("fandoms")
        .select("id, name")
        .order("name", {
            ascending: true
        });

    if (error) {
        console.error(
            "COULDN'T LOAD FANDOMS:",
            error
        );

        editorMessage.textContent =
            "Couldn't load the fandom list. >_<";

        return false;
    }

    allFandoms = data || [];

    return true;
}

// ==============================
// LOAD PROFILE FANDOMS
// ==============================

async function loadProfileFandoms(userId) {
    const {
        data,
        error
    } = await supabaseClient
        .from("profile_fandoms")
        .select(`
            fandom_id,
            fandoms (
                id,
                name
            )
        `)
        .eq("profile_id", userId);

    if (error) {
        console.error(
            "COULDN'T LOAD PROFILE FANDOMS:",
            error
        );

        editorMessage.textContent =
            "Couldn't load your fandoms. >_<";

        return false;
    }

    selectedFandomIds =
        (data || [])
            .map(function (row) {
                return row.fandom_id;
            });

    renderSelectedFandoms();

    return true;
}

// ==============================
// RENDER SELECTED FANDOMS
// ==============================

function renderSelectedFandoms() {
    if (!selectedFandoms) {
        return;
    }

    selectedFandoms.innerHTML = "";

    selectedFandomIds.forEach(
        function (fandomId) {
            const fandom =
                allFandoms.find(
                    function (item) {
                        return item.id === fandomId;
                    }
                );

            if (!fandom) {
                return;
            }

            const tag =
                document.createElement("span");

            tag.className =
                "selected-tag";

            const name =
                document.createElement("span");

            name.textContent =
                fandom.name;

            const removeButton =
                document.createElement("button");

            removeButton.type =
                "button";

            removeButton.textContent =
                "×";

            removeButton.setAttribute(
                "aria-label",
                `Remove ${fandom.name}`
            );

            removeButton.addEventListener(
                "click",
                function () {
                    selectedFandomIds =
                        selectedFandomIds.filter(
                            function (id) {
                                return id !== fandomId;
                            }
                        );

                    renderSelectedFandoms();
                }
            );

            tag.appendChild(name);
            tag.appendChild(removeButton);

            selectedFandoms.appendChild(tag);
        }
    );
}

// ==============================
// FANDOM SEARCH
// ==============================

if (fandomSearch) {
    fandomSearch.addEventListener(
        "input",
        function () {
            const query =
                fandomSearch.value
                    .trim()
                    .toLowerCase();

            if (fandomResults) {
                fandomResults.innerHTML = "";
            }

            if (!query) {
                return;
            }

            const matches =
                allFandoms
                    .filter(
                        function (fandom) {
                            return fandom.name
                                .toLowerCase()
                                .includes(query);
                        }
                    )
                    .filter(
                        function (fandom) {
                            return !selectedFandomIds.includes(
                                fandom.id
                            );
                        }
                    )
                    .slice(0, 8);

            renderFandomResults(matches);
        }
    );
}

// ==============================
// RENDER FANDOM RESULTS
// ==============================

function renderFandomResults(matches) {
    if (!fandomResults) {
        return;
    }

    fandomResults.innerHTML = "";

    if (matches.length === 0) {
        fandomResults.innerHTML = `
            <p class="search-hint">
                No matching fandoms found. ♡
            </p>

            <a
                class="suggestion-link"
                href="suggest.html"
            >
                ✨ Suggest a new fandom
            </a>
        `;

        return;
    }

    matches.forEach(
        function (fandom) {
            const button =
                document.createElement("button");

            button.type =
                "button";

            button.className =
                "suggestion-result";

            button.textContent =
                fandom.name;

            button.addEventListener(
                "click",
                function () {
                    if (
                        !selectedFandomIds.includes(
                            fandom.id
                        )
                    ) {
                        selectedFandomIds.push(
                            fandom.id
                        );
                    }

                    fandomSearch.value = "";

                    fandomResults.innerHTML = "";

                    renderSelectedFandoms();
                }
            );

            fandomResults.appendChild(button);
        }
    );
}

// ==============================
// LOAD PROFILE
// ==============================

async function loadProfile() {
    const {
        data: {
            user
        },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        editorMessage.textContent =
            "Hey! Log in before editing your profile! o_0";

        profileForm.style.display =
            "none";

        return;
    }

    // ==========================
    // LOAD PROFILE ROW
    // ==========================

    const {
        data: profile,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error(
            "PROFILE LOAD ERROR:",
            error
        );

        editorMessage.textContent =
            "Couldn't load your profile, whoops... :(";

        return;
    }

    // ==========================
    // FILL PROFILE FIELDS
    // ==========================

    usernameInput.value =
        profile.username || "";

    displayNameInput.value =
        profile.display_name || "";

    bioInput.value =
        profile.bio || "";

    foNameInput.value =
        profile.fo_name || "";

    foRelationshipInput.value =
        profile.fo_relationship || "";

    foDescriptionInput.value =
        profile.fo_description || "";

    moodInput.value =
        profile.mood || "";

    avatarUrlInput.value =
        profile.avatar_url || "";

    bannerUrlInput.value =
        profile.banner_url || "";

    // ==========================
    // LOAD CANONICAL FANDOMS
    // ==========================

    const fandomsLoaded =
        await loadFandoms();

    if (!fandomsLoaded) {
        return;
    }

    await loadProfileFandoms(user.id);
}

// ==============================
// SAVE PROFILE
// ==============================

profileForm.addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        editorMessage.textContent =
            "Saving your profile... 🌸";

        const {
            data: {
                user
            },
            error: userError
        } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            editorMessage.textContent =
                "Who are you?! Go log in first!";

            return;
        }

        // ==========================
        // VALIDATE USERNAME
        // ==========================

        const username =
            usernameInput.value.trim();

        if (username === "") {
            editorMessage.textContent =
                "Choose a username people'll know you as...";

            return;
        }

        // ==========================
        // PROFILE UPDATE
        // ==========================

        const updates = {
            username: username,

            display_name:
                displayNameInput.value.trim(),

            bio:
                bioInput.value.trim(),

            fo_name:
                foNameInput.value.trim(),

            fo_relationship:
                foRelationshipInput.value.trim(),

            fo_description:
                foDescriptionInput.value.trim(),

            mood:
                moodInput.value.trim(),

            avatar_url:
                avatarUrlInput.value.trim(),

            banner_url:
                bannerUrlInput.value.trim()
        };

        const {
            error: profileError
        } = await supabaseClient
            .from("profiles")
            .update(updates)
            .eq("id", user.id);

        if (profileError) {
            console.error(
                "PROFILE UPDATE ERROR:",
                profileError
            );

            if (
                profileError.code === "23505"
            ) {
                editorMessage.textContent =
                    "Whoops! Someone already has that username :/";
            } else {
                editorMessage.textContent =
                    "Couldn't save your profile! >_<";
            }

            return;
        }

        // ==========================
        // REMOVE OLD FANDOM LINKS
        // ==========================

        const {
            error: deleteFandomError
        } = await supabaseClient
            .from("profile_fandoms")
            .delete()
            .eq("profile_id", user.id);

        if (deleteFandomError) {
            console.error(
                "PROFILE FANDOM DELETE ERROR:",
                deleteFandomError
            );

            editorMessage.textContent =
                "Your profile saved, but I couldn't update your fandoms. >_<";

            return;
        }

        // ==========================
        // INSERT NEW FANDOM LINKS
        // ==========================

        if (selectedFandomIds.length > 0) {
            const fandomRows =
                selectedFandomIds.map(
                    function (fandomId) {
                        return {
                            profile_id: user.id,
                            fandom_id: fandomId
                        };
                    }
                );

            const {
                error: fandomError
            } = await supabaseClient
                .from("profile_fandoms")
                .insert(fandomRows);

            if (fandomError) {
                console.error(
                    "PROFILE FANDOM INSERT ERROR:",
                    fandomError
                );

                editorMessage.textContent =
                    "Your profile saved, but I couldn't save your fandoms. >_<";

                return;
            }
        }

        // ==========================
        // SUCCESS
        // ==========================

        editorMessage.textContent =
            "♡ Profile saved successfully! ♡";
    }
);

// ==============================
// BACK BUTTON
// ==============================

backButton.addEventListener(
    "click",
    function () {
        window.location.href =
            "indexter.html";
    }
);

// ==============================
// START
// ==============================

loadProfile();