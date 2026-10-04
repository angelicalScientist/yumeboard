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


// ==============================
// PROFILE IMAGE ELEMENTS
// ==============================

const avatarUrlInput =
    document.getElementById("avatarUrl");

const bannerUrlInput =
    document.getElementById("bannerUrl");

const avatarFileInput =
    document.getElementById("avatarFile");

const bannerFileInput =
    document.getElementById("bannerFile");

const avatarPreviewImage =
    document.getElementById(
        "avatarPreviewImage"
    );

const avatarPreviewPlaceholder =
    document.getElementById(
        "avatarPreviewPlaceholder"
    );

const bannerPreviewImage =
    document.getElementById(
        "bannerPreviewImage"
    );

const bannerPreviewPlaceholder =
    document.getElementById(
        "bannerPreviewPlaceholder"
    );


// ==============================
// PROFILE IMAGE STATE
// ==============================

let currentAvatarUrl = "";
let currentBannerUrl = "";


// ==============================
// UPLOAD SETTINGS
// ==============================

const PROFILE_IMAGE_BUCKET =
    "profile-images";

const MAX_PROFILE_IMAGE_SIZE =
    5 * 1024 * 1024;


// ==============================
// FANDOM STATE
// ==============================

let allFandoms = [];
let selectedFandomIds = [];


// ==============================
// IMAGE VALIDATION
// ==============================

function validateProfileImage(file) {

    if (!file) {
        return false;
    }

    if (
        !file.type ||
        !file.type.startsWith("image/")
    ) {
        editorMessage.textContent =
            "Please choose an image file! ♡";

        return false;
    }

    if (
        file.size >
        MAX_PROFILE_IMAGE_SIZE
    ) {
        editorMessage.textContent =
            "That image is too large! Please choose an image smaller than 5 MB. ♡";

        return false;
    }

    return true;
}


// ==============================
// IMAGE PREVIEW
// ==============================

function showImagePreview(
    file,
    imageElement,
    placeholderElement
) {

    if (!file) {
        return;
    }

    const previewUrl =
        URL.createObjectURL(file);

    imageElement.src =
        previewUrl;

    imageElement.hidden =
        false;

    placeholderElement.hidden =
        true;
}


// ==============================
// SHOW EXISTING IMAGE
// ==============================

function showExistingImage(
    url,
    imageElement,
    placeholderElement
) {

    if (!url) {

        imageElement.removeAttribute(
            "src"
        );

        imageElement.hidden =
            true;

        placeholderElement.hidden =
            false;

        return;
    }

    imageElement.src =
        url;

    imageElement.hidden =
        false;

    placeholderElement.hidden =
        true;
}


// ==============================
// PROFILE IMAGE FILE EVENTS
// ==============================

if (avatarFileInput) {

    avatarFileInput.addEventListener(
        "change",
        function () {

            const file =
                avatarFileInput.files?.[0];

            if (!file) {
                return;
            }

            if (
                !validateProfileImage(
                    file
                )
            ) {

                avatarFileInput.value =
                    "";

                return;
            }

            showImagePreview(
                file,
                avatarPreviewImage,
                avatarPreviewPlaceholder
            );

            editorMessage.textContent =
                "Profile picture ready to upload! ♡";
        }
    );
}


if (bannerFileInput) {

    bannerFileInput.addEventListener(
        "change",
        function () {

            const file =
                bannerFileInput.files?.[0];

            if (!file) {
                return;
            }

            if (
                !validateProfileImage(
                    file
                )
            ) {

                bannerFileInput.value =
                    "";

                return;
            }

            showImagePreview(
                file,
                bannerPreviewImage,
                bannerPreviewPlaceholder
            );

            editorMessage.textContent =
                "Banner ready to upload! ♡";
        }
    );
}


// ==============================
// URL PREVIEW EVENTS
// ==============================

if (avatarUrlInput) {

    avatarUrlInput.addEventListener(
        "input",
        function () {

            /*
             * If a file is selected, the file
             * will take priority when saving.
             */

            if (
                avatarFileInput?.files?.[0]
            ) {
                return;
            }

            const url =
                avatarUrlInput.value.trim();

            if (!url) {

                showExistingImage(
                    currentAvatarUrl,
                    avatarPreviewImage,
                    avatarPreviewPlaceholder
                );

                return;
            }

            showExistingImage(
                url,
                avatarPreviewImage,
                avatarPreviewPlaceholder
            );
        }
    );
}


if (bannerUrlInput) {

    bannerUrlInput.addEventListener(
        "input",
        function () {

            /*
             * If a file is selected, the file
             * will take priority when saving.
             */

            if (
                bannerFileInput?.files?.[0]
            ) {
                return;
            }

            const url =
                bannerUrlInput.value.trim();

            if (!url) {

                showExistingImage(
                    currentBannerUrl,
                    bannerPreviewImage,
                    bannerPreviewPlaceholder
                );

                return;
            }

            showExistingImage(
                url,
                bannerPreviewImage,
                bannerPreviewPlaceholder
            );
        }
    );
}


// ==============================
// UPLOAD PROFILE IMAGE
// ==============================

async function uploadProfileImage(
    file,
    userId,
    type
) {

    if (!file) {
        return null;
    }

    if (
        !validateProfileImage(
            file
        )
    ) {

        throw new Error(
            "Invalid profile image."
        );
    }

    const fileExtension =
        (
            file.name
                .split(".")
                .pop() ||
            "png"
        )
            .toLowerCase()
            .replace(
                /[^a-z0-9]/g,
                ""
            );

    const safeExtension =
        fileExtension || "png";

    const fileName =
        `${type}-${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

    const filePath =
        `${userId}/${type}/${fileName}`;

    const {
        data,
        error
    } = await supabaseClient
        .storage
        .from(
            PROFILE_IMAGE_BUCKET
        )
        .upload(
            filePath,
            file,
            {
                cacheControl: "3600",
                contentType:
                    file.type,
                upsert: false
            }
        );

    if (error) {

        console.error(
            "PROFILE IMAGE UPLOAD ERROR:",
            error
        );

        throw error;
    }

    const {
        data: publicUrlData
    } = supabaseClient
        .storage
        .from(
            PROFILE_IMAGE_BUCKET
        )
        .getPublicUrl(
            data.path
        );

    if (
        !publicUrlData ||
        !publicUrlData.publicUrl
    ) {

        throw new Error(
            "The image uploaded, but its public URL could not be created."
        );
    }

    return {
        url:
            publicUrlData.publicUrl,

        path:
            data.path
    };
}


// ==============================
// CHECK WHETHER URL IS ONE OF
// OUR PROFILE IMAGE FILES
// ==============================

function getProfileImageStoragePath(
    url
) {

    if (!url) {
        return null;
    }

    const marker =
        `/storage/v1/object/public/${PROFILE_IMAGE_BUCKET}/`;

    const markerIndex =
        url.indexOf(marker);

    if (
        markerIndex === -1
    ) {
        return null;
    }

    return decodeURIComponent(
        url.substring(
            markerIndex +
            marker.length
        )
    );
}


// ==============================
// DELETE OLD PROFILE IMAGE
// ==============================

async function deleteOldProfileImage(
    url
) {

    const path =
        getProfileImageStoragePath(
            url
        );

    /*
     * External URLs are not ours,
     * so there is nothing to delete.
     */

    if (!path) {
        return;
    }

    const {
        error
    } = await supabaseClient
        .storage
        .from(
            PROFILE_IMAGE_BUCKET
        )
        .remove([
            path
        ]);

    if (error) {

        console.error(
            "OLD PROFILE IMAGE DELETE ERROR:",
            error
        );
    }
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
        .order(
            "name",
            {
                ascending: true
            }
        );

    if (error) {

        console.error(
            "COULDN'T LOAD FANDOMS:",
            error
        );

        editorMessage.textContent =
            "Couldn't load the fandom list. >_<";

        return false;
    }

    allFandoms =
        data || [];

    return true;
}


// ==============================
// LOAD PROFILE FANDOMS
// ==============================

async function loadProfileFandoms(
    userId
) {

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
        .eq(
            "profile_id",
            userId
        );

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
            .map(
                function (row) {
                    return row.fandom_id;
                }
            );

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

    selectedFandoms.innerHTML =
        "";

    selectedFandomIds.forEach(
        function (fandomId) {

            const fandom =
                allFandoms.find(
                    function (item) {
                        return (
                            item.id ===
                            fandomId
                        );
                    }
                );

            if (!fandom) {
                return;
            }

            const tag =
                document.createElement(
                    "span"
                );

            tag.className =
                "selected-tag";

            const name =
                document.createElement(
                    "span"
                );

            name.textContent =
                fandom.name;

            const removeButton =
                document.createElement(
                    "button"
                );

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
                                return (
                                    id !==
                                    fandomId
                                );
                            }
                        );

                    renderSelectedFandoms();
                }
            );

            tag.appendChild(
                name
            );

            tag.appendChild(
                removeButton
            );

            selectedFandoms.appendChild(
                tag
            );
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
                fandomResults.innerHTML =
                    "";
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

                            return (
                                !selectedFandomIds.includes(
                                    fandom.id
                                )
                            );
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
}


// ==============================
// RENDER FANDOM RESULTS
// ==============================

function renderFandomResults(
    matches
) {

    if (!fandomResults) {
        return;
    }

    fandomResults.innerHTML =
        "";

    if (
        matches.length ===
        0
    ) {

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

                    if (
                        !selectedFandomIds.includes(
                            fandom.id
                        )
                    ) {

                        selectedFandomIds.push(
                            fandom.id
                        );
                    }

                    fandomSearch.value =
                        "";

                    fandomResults.innerHTML =
                        "";

                    renderSelectedFandoms();
                }
            );

            fandomResults.appendChild(
                button
            );
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
    } = await supabaseClient
        .auth
        .getUser();

    if (
        userError ||
        !user
    ) {

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
        .eq(
            "id",
            user.id
        )
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


    // ==========================
    // LOAD EXISTING IMAGE URLS
    // ==========================

    currentAvatarUrl =
        profile.avatar_url || "";

    currentBannerUrl =
        profile.banner_url || "";

    avatarUrlInput.value =
        currentAvatarUrl;

    bannerUrlInput.value =
        currentBannerUrl;


    showExistingImage(
        currentAvatarUrl,
        avatarPreviewImage,
        avatarPreviewPlaceholder
    );

    showExistingImage(
        currentBannerUrl,
        bannerPreviewImage,
        bannerPreviewPlaceholder
    );


    // ==========================
    // LOAD CANONICAL FANDOMS
    // ==========================

    const fandomsLoaded =
        await loadFandoms();

    if (!fandomsLoaded) {
        return;
    }

    await loadProfileFandoms(
        user.id
    );
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
        } = await supabaseClient
            .auth
            .getUser();

        if (
            userError ||
            !user
        ) {

            editorMessage.textContent =
                "Who are you?! Go log in first!";

            return;
        }


        // ==========================
        // VALIDATE USERNAME
        // ==========================

        const username =
            usernameInput.value.trim();

        if (
            username === ""
        ) {

            editorMessage.textContent =
                "Choose a username people'll know you as...";

            return;
        }


        // ==========================
        // GET SELECTED FILES
        // ==========================

        const avatarFile =
            avatarFileInput?.files?.[0] ||
            null;

        const bannerFile =
            bannerFileInput?.files?.[0] ||
            null;


        // ==========================
        // VALIDATE SELECTED FILES
        // ==========================

        if (
            avatarFile &&
            !validateProfileImage(
                avatarFile
            )
        ) {

            return;
        }

        if (
            bannerFile &&
            !validateProfileImage(
                bannerFile
            )
        ) {

            return;
        }


        try {

            // ==========================
            // DETERMINE AVATAR
            // ==========================

            let avatarUrl =
                avatarUrlInput.value.trim();

            let newAvatarPath =
                null;

            if (avatarFile) {

                editorMessage.textContent =
                    "Uploading your profile picture... 🌸";

                const uploadedAvatar =
                    await uploadProfileImage(
                        avatarFile,
                        user.id,
                        "avatar"
                    );

                avatarUrl =
                    uploadedAvatar.url;

                newAvatarPath =
                    uploadedAvatar.path;
            }


            // ==========================
            // DETERMINE BANNER
            // ==========================

            let bannerUrl =
                bannerUrlInput.value.trim();

            let newBannerPath =
                null;

            if (bannerFile) {

                editorMessage.textContent =
                    "Uploading your banner... 🌸";

                const uploadedBanner =
                    await uploadProfileImage(
                        bannerFile,
                        user.id,
                        "banner"
                    );

                bannerUrl =
                    uploadedBanner.url;

                newBannerPath =
                    uploadedBanner.path;
            }


            // ==========================
            // PROFILE UPDATE
            // ==========================

            editorMessage.textContent =
                "Saving your profile... 🌸";

            const updates = {

                username:
                    username,

                display_name:
                    displayNameInput
                        .value
                        .trim(),

                bio:
                    bioInput
                        .value
                        .trim(),

                fo_name:
                    foNameInput
                        .value
                        .trim(),

                fo_relationship:
                    foRelationshipInput
                        .value
                        .trim(),

                fo_description:
                    foDescriptionInput
                        .value
                        .trim(),

                mood:
                    moodInput
                        .value
                        .trim(),

                avatar_url:
                    avatarUrl,

                banner_url:
                    bannerUrl
            };


            const {
                error: profileError
            } = await supabaseClient
                .from("profiles")
                .update(updates)
                .eq(
                    "id",
                    user.id
                );


            if (profileError) {

                console.error(
                    "PROFILE UPDATE ERROR:",
                    profileError
                );

                if (
                    profileError.code ===
                    "23505"
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
            // UPDATE CURRENT IMAGE STATE
            // ==========================

            const oldAvatarUrl =
                currentAvatarUrl;

            const oldBannerUrl =
                currentBannerUrl;

            currentAvatarUrl =
                avatarUrl;

            currentBannerUrl =
                bannerUrl;


            // ==========================
            // REMOVE OLD FANDOM LINKS
            // ==========================

            const {
                error: deleteFandomError
            } = await supabaseClient
                .from("profile_fandoms")
                .delete()
                .eq(
                    "profile_id",
                    user.id
                );


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

            if (
                selectedFandomIds.length >
                0
            ) {

                const fandomRows =
                    selectedFandomIds.map(
                        function (fandomId) {

                            return {
                                profile_id:
                                    user.id,

                                fandom_id:
                                    fandomId
                            };
                        }
                    );


                const {
                    error: fandomError
                } = await supabaseClient
                    .from("profile_fandoms")
                    .insert(
                        fandomRows
                    );


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
            // UPDATE URL INPUTS
            // ==========================

            avatarUrlInput.value =
                avatarUrl;

            bannerUrlInput.value =
                bannerUrl;


            // ==========================
            // DELETE OLD UPLOADED AVATAR
            // ==========================

            if (
                avatarFile &&
                oldAvatarUrl &&
                oldAvatarUrl !== avatarUrl
            ) {

                await deleteOldProfileImage(
                    oldAvatarUrl
                );
            }


            // ==========================
            // DELETE OLD UPLOADED BANNER
            // ==========================

            if (
                bannerFile &&
                oldBannerUrl &&
                oldBannerUrl !== bannerUrl
            ) {

                await deleteOldProfileImage(
                    oldBannerUrl
                );
            }


            // ==========================
            // SUCCESS
            // ==========================

            editorMessage.textContent =
                "♡ Profile saved successfully! ♡";


        } catch (error) {

            console.error(
                "PROFILE SAVE ERROR:",
                error
            );

            editorMessage.textContent =
                error?.message ||
                "Couldn't save your profile! >_<";
        }
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