const userList =
    document.getElementById("userList");

const userSearch =
    document.getElementById("userSearch");

const searchMessage =
    document.getElementById("searchMessage");

const loadMoreButton =
    document.getElementById("loadMoreButton");

const loadMoreContainer =
    document.getElementById("loadMoreContainer");

const backToProfile =
    document.getElementById("backToProfile");


// ==============================
// SETTINGS
// ==============================

const USERS_PER_PAGE = 24;

let currentOffset = 0;
let currentSearch = "";
let loadingUsers = false;
let hasMoreUsers = true;

let currentUser = null;
let currentUserFos = [];

let blockedUserIds = new Set();

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
// GET LOGGED-IN USER
// ==============================

async function getCurrentUser() {

    const {
        data,
        error
    } = await supabaseClient
        .auth
        .getUser();

    if (error) {
        console.error(
            "Couldn't get current user:",
            error
        );

        return null;
    }

    return data.user || null;
}


// ==============================
// LOAD MY F/Os
// ==============================

async function loadCurrentUserFos() {

    if (!currentUser) {
        currentUserFos = [];
        return;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("fos")
        .select(`
            id,
            user_id,
            character_id,
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
        .eq(
            "user_id",
            currentUser.id
        );

    if (error) {
        console.error(
            "Couldn't load your F/Os:",
            error
        );

        currentUserFos = [];
        return;
    }

    currentUserFos =
        data || [];

    console.log(
        "🌸 My F/Os loaded:",
        currentUserFos
    );
}


// ==============================
// CHECK F/O COMPATIBILITY
// ==============================

function getFoCompatibility(
    myFo,
    theirFo
) {

    // These aren't the same character,
    // so there is no doubles conflict.
    if (
        !myFo ||
        !theirFo ||
        myFo.character_id !== theirFo.character_id
    ) {
        return "compatible";
    }

    // Someone who welcomes doubles
    // has no conflict.
    if (
        theirFo.doubles_preference ===
        "welcome"
    ) {
        return "compatible";
    }

    // Ask-first isn't a hard conflict.
    if (
        theirFo.doubles_preference ===
        "ask_first"
    ) {
        return "ask_first";
    }

    // "no" means they do not want
    // another person sharing this character.
    if (
        theirFo.doubles_preference ===
        "no"
    ) {
        return "conflict";
    }

    // Unknown / empty preference.
    return "compatible";
}


// ==============================
// CHECK ALL F/O PAIRS
// ==============================

function getUserCompatibility(theirFos) {

    if (
        !currentUser ||
        currentUserFos.length === 0 ||
        theirFos.length === 0
    ) {
        return {
            status: "compatible",
            conflicts: [],
            askFirst: []
        };
    }

    const conflicts = [];
    const askFirst = [];

    currentUserFos.forEach(
        function (myFo) {

            theirFos.forEach(
                function (theirFo) {

                    // These are different characters,
                    // so there is no doubles conflict.
                    if (
                        !myFo.character_id ||
                        !theirFo.character_id ||
                        myFo.character_id !==
                            theirFo.character_id
                    ) {
                        return;
                    }


                    // ==============================
                    // SHARING PREFERENCES
                    // ==============================

                    const myPreference =
                        myFo.doubles_preference ||
                        "ask_first";

                    const theirPreference =
                        theirFo.doubles_preference ||
                        "ask_first";


                    // ==============================
                    // EITHER PERSON SAYS "NO"
                    // ==============================

                    if (
                        myPreference === "no" ||
                        theirPreference === "no"
                    ) {

                        conflicts.push({
                            myFo,
                            theirFo
                        });

                        return;
                    }


                    // ==============================
                    // OTHERWISE, CHECK ASK-FIRST
                    // ==============================

                    if (
                        myPreference ===
                            "ask_first" ||
                        theirPreference ===
                            "ask_first"
                    ) {

                        askFirst.push({
                            myFo,
                            theirFo
                        });
                    }
                }
            );
        }
    );


    // ==============================
    // FINAL STATUS
    // ==============================

    if (
        conflicts.length > 0
    ) {
        return {
            status: "conflict",
            conflicts,
            askFirst
        };
    }


    if (
        askFirst.length > 0
    ) {
        return {
            status: "ask_first",
            conflicts,
            askFirst
        };
    }


    return {
        status: "compatible",
        conflicts,
        askFirst
    };
}

// ==============================
// GET COMPATIBILITY LABEL
// ==============================

function getCompatibilityHTML(
    compatibility
) {

    if (
        compatibility.status ===
        "conflict"
    ) {

        const names =
            compatibility.conflicts
                .map(
                    function (pair) {

                        return (
                            pair.theirFo
                                .characters
                                ?.canonical_name ||
                            "this character"
                        );
                    }
                )
                .filter(
                    function (
                        name,
                        index,
                        array
                    ) {
                        return (
                            array.indexOf(
                                name
                            ) === index
                        );
                    }
                );

        return `
            <div class="discover-compatibility discover-compatibility-conflict">
                🔒 <strong>Non-sharing conflict</strong>

                ${
                    names.length > 0
                        ? `
                            <small>
                                Their F/O:
                                ${escapeHtml(
                                    names.join(", ")
                                )}
                            </small>
                        `
                        : ""
                }
            </div>
        `;
    }

    if (
        compatibility.status ===
        "ask_first"
    ) {

        const names =
            compatibility.askFirst
                .map(
                    function (pair) {

                        return (
                            pair.theirFo
                                .characters
                                ?.canonical_name ||
                            "this character"
                        );
                    }
                )
                .filter(
                    function (
                        name,
                        index,
                        array
                    ) {
                        return (
                            array.indexOf(
                                name
                            ) === index
                        );
                    }
                );

        return `
            <div class="discover-compatibility discover-compatibility-ask">
                💭 <strong>Ask before interacting</strong>

                ${
                    names.length > 0
                        ? `
                            <small>
                                Their F/O:
                                ${escapeHtml(
                                    names.join(", ")
                                )}
                            </small>
                        `
                        : ""
                }
            </div>
        `;
    }

    return `
        <div class="discover-compatibility discover-compatibility-compatible">
            🌸 <strong>No sharing conflict detected</strong>
        </div>
    `;
}


// ==============================
// LOAD USERS
// ==============================

async function loadUsers(reset = false) {

    if (loadingUsers) {
        return;
    }

    if (reset) {
        currentOffset = 0;
        hasMoreUsers = true;
        userList.innerHTML = "";

        if (loadMoreContainer) {
            loadMoreContainer.style.display = "none";
        }
    }

    if (!hasMoreUsers) {
        return;
    }

    loadingUsers = true;

    if (searchMessage) {
        searchMessage.textContent =
            "Loading users... 🌸";
    }

    // Number of visible users we want
    // to add during this load.
    const targetVisibleUsers =
        USERS_PER_PAGE;

    let visibleUsersAdded = 0;

    // Keep fetching database pages until
    // we have enough visible users.
    while (
        visibleUsersAdded <
            targetVisibleUsers &&
        hasMoreUsers
    ) {

        // ==============================
        // PROFILE QUERY
        // ==============================

        let profileQuery =
            supabaseClient
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    bio,
                    avatar_url
                `)
                .order(
                    "username",
                    {
                        ascending: true
                    }
                )
                .range(
                    currentOffset,
                    currentOffset +
                        USERS_PER_PAGE -
                        1
                );


        // ==============================
        // SEARCH
        // ==============================

        if (
            currentSearch !== ""
        ) {

            const safeSearch =
                currentSearch
                    .replaceAll("%", "")
                    .replaceAll(",", "")
                    .replaceAll(".", "");

            profileQuery =
                supabaseClient
                    .from("profiles")
                    .select(`
                        id,
                        username,
                        display_name,
                        bio,
                        avatar_url
                    `)
                    .or(
                        `username.ilike.%${safeSearch}%,display_name.ilike.%${safeSearch}%`
                    )
                    .order(
                        "username",
                        {
                            ascending: true
                        }
                    )
                    .range(
                        currentOffset,
                        currentOffset +
                            USERS_PER_PAGE -
                            1
                    );
        }


        // ==============================
        // GET PROFILES
        // ==============================

        const {
            data: profiles,
            error: profileError
        } = await profileQuery;


        if (profileError) {

            console.error(
                "Couldn't load profiles:",
                profileError
            );

            if (searchMessage) {
                searchMessage.textContent =
                    "Couldn't load users. >_<";
            }

            loadingUsers = false;
            return;
        }


        const loadedProfiles =
            profiles || [];


        // If this database page is smaller
        // than the page size, we've reached
        // the actual end of the profiles.
        if (
            loadedProfiles.length <
            USERS_PER_PAGE
        ) {
            hasMoreUsers = false;
        }


        // No profiles left at all.
        if (
            loadedProfiles.length === 0
        ) {
            hasMoreUsers = false;
            break;
        }


        // ==============================
        // GET USER IDS
        // ==============================

        const userIds =
            loadedProfiles.map(
                function (profile) {
                    return profile.id;
                }
            );


        // ==============================
        // LOAD ALL F/Os
        // ==============================

        let allFos = [];

        if (
            userIds.length > 0
        ) {

            const {
                data: foData,
                error: foError
            } = await supabaseClient
                .from("fos")
                .select(`
                    id,
                    user_id,
                    character_id,
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
                .in(
                    "user_id",
                    userIds
                );

            if (foError) {

                console.error(
                    "Couldn't load F/Os:",
                    foError
                );

            } else {

                allFos =
                    foData || [];
            }
        }


        // ==============================
        // BUILD F/O MAP
        // ==============================

        const foMap =
            new Map();

        allFos.forEach(
            function (fo) {

                if (
                    !foMap.has(
                        fo.user_id
                    )
                ) {
                    foMap.set(
                        fo.user_id,
                        []
                    );
                }

                foMap
                    .get(fo.user_id)
                    .push(fo);
            }
        );


        // ==============================
        // ATTACH F/Os + CHECK COMPATIBILITY
        // ==============================

        loadedProfiles.forEach(
            function (profile) {

                profile.fos =
                    foMap.get(
                        profile.id
                    ) || [];

                profile.compatibility =
                    getUserCompatibility(
                        profile.fos
                    );
            }
        );


        // ==============================
        // FILTER + RENDER
        // ==============================

        loadedProfiles.forEach(
            function (user) {

                // Never show yourself.
                if (
                    currentUser &&
                    user.id === currentUser.id
                ) {
                    return;
                }

                // Never show blocked users.
                if (
                    blockedUserIds.has(user.id)
                ) {
                    return;
                }

                // Hide users with a matching
                // F/O marked as "no doubles".
                if (
                    user.compatibility &&
                    user.compatibility.status ===
                        "conflict"
                ) {
                    return;
                }

                renderUser(user);

                visibleUsersAdded++;
            }
        );


        // ==============================
        // MOVE TO NEXT DATABASE PAGE
        // ==============================

        currentOffset +=
            loadedProfiles.length;


        // If we already filled the visible
        // batch, stop fetching.
        if (
            visibleUsersAdded >=
            targetVisibleUsers
        ) {
            break;
        }
    }


    // ==============================
    // UPDATE MESSAGE
    // ==============================

    if (searchMessage) {

        if (
            currentSearch !== ""
        ) {

            searchMessage.textContent =
                `${visibleUsersAdded} compatible result${
                    visibleUsersAdded === 1
                        ? ""
                        : "s"
                } found ♡`;

        } else {

            searchMessage.textContent =
                "Discover fellow yume enthusiasts! ♡";
        }
    }


    // ==============================
    // LOAD MORE VISIBILITY
    // ==============================

    if (loadMoreContainer) {

        loadMoreContainer.style.display =
            hasMoreUsers
                ? "block"
                : "none";
    }


    // ==============================
    // NOTHING FOUND
    // ==============================

    if (
        reset &&
        visibleUsersAdded === 0
    ) {

        userList.innerHTML = `
            <p class="search-hint">
                No compatible users found yet! ♡
            </p>
        `;
    }


    loadingUsers = false;
}

async function loadBlockedUsers() {

    if (!currentUser) {
        blockedUserIds = new Set();
        return;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("blocked_users")
        .select("blocked_id")
        .eq(
            "blocker_id",
            currentUser.id
        );

    if (error) {
        console.error(
            "Couldn't load blocked users:",
            error
        );

        blockedUserIds = new Set();
        return;
    }

    blockedUserIds =
        new Set(
            (data || []).map(
                function (block) {
                    return block.blocked_id;
                }
            )
        );

    console.log(
        "🚫 Blocked users:",
        blockedUserIds
    );
}


// ==============================
// RENDER USER
// ==============================

function renderUser(
    user
) {

    const card =
        document.createElement(
            "article"
        );

    card.className =
        "user-card";


    // ==============================
    // BASIC INFO
    // ==============================

    const displayName =
        user.display_name ||
        user.username ||
        "Unnamed user";

    const username =
        user.username ||
        "unknown";

    const bio =
        user.bio ||
        "No bio yet. ♡";

    const avatar =
        user.avatar_url ||
        "https://placehold.co/150x150";


    // ==============================
    // F/Os
    // ==============================

    const fos =
        user.fos || [];

    const mainFO =
        fos.find(
            function (fo) {
                return (
                    fo.is_main === true
                );
            }
        ) || fos[0] || null;


    // ==============================
    // MAIN F/O DISPLAY
    // ==============================

    let foHTML;

    if (mainFO) {

        const characterName =
            mainFO
                .characters
                ?.canonical_name ||
            "Unknown character";

        foHTML = `
            <div class="discover-fo">

                <strong>
                    ♡ Main F/O
                </strong>

                <p>
                    ${escapeHtml(
                        characterName
                    )}
                </p>

                ${
                    mainFO.relationship
                        ? `
                            <small>
                                ${escapeHtml(
                                    mainFO.relationship
                                )}
                            </small>
                        `
                        : ""
                }

            </div>
        `;

    } else {

        foHTML = `
            <div class="discover-fo">
                <small>
                    ♡ No F/O listed
                </small>
            </div>
        `;
    }


    // ==============================
    // COMPATIBILITY
    // ==============================

    const compatibility =
        user.compatibility ||
        {
            status:
                "compatible",
            conflicts: [],
            askFirst: []
        };

    const compatibilityHTML =
        getCompatibilityHTML(
            compatibility
        );


    // ==============================
    // CARD HTML
    // ==============================

    card.innerHTML = `
        <img
            class="user-card-avatar"
            src="${escapeHtml(
                avatar
            )}"
            alt=""
            loading="lazy"
        >

        <div class="user-card-content">

            <h2>
                ${escapeHtml(
                    displayName
                )}
            </h2>

            <p class="user-card-username">
                @${escapeHtml(
                    username
                )}
            </p>

            ${foHTML}

            ${compatibilityHTML}

            <p class="user-card-bio">
                ${escapeHtml(
                    bio
                )}
            </p>

            <button
                type="button"
                class="view-profile-button"
                data-user-id="${escapeHtml(
                    user.id
                )}"
            >
                View Profile ♡
            </button>

        </div>
    `;


    userList.appendChild(
        card
    );


    // ==============================
    // PROFILE BUTTON
    // ==============================

    const viewButton =
        card.querySelector(
            ".view-profile-button"
        );

    if (viewButton) {

        viewButton.addEventListener(
            "click",
            function () {

                const userId =
                    viewButton
                        .dataset
                        .userId;

                window.location.href =
                    `users-profile.html?id=${encodeURIComponent(
                        userId
                    )}`;
            }
        );
    }


    // ==============================
    // AVATAR ERROR
    // ==============================

    const avatarElement =
        card.querySelector(
            ".user-card-avatar"
        );

    if (avatarElement) {

        avatarElement.addEventListener(
            "error",
            function () {

                avatarElement.src =
                    "https://placehold.co/150x150";
            }
        );
    }
}



// ==============================
// SEARCH
// ==============================

let searchTimer = null;

if (userSearch) {
    userSearch.addEventListener(
        "input",
        function () {
            currentSearch =
                userSearch.value.trim();

            clearTimeout(
                searchTimer
            );

            searchTimer =
                setTimeout(
                    function () {
                        loadUsers(true);
                    },
                    300
                );
        }
    );
}


// ==============================
// LOAD MORE
// ==============================

if (loadMoreButton) {
    loadMoreButton.addEventListener(
        "click",
        function () {
            loadUsers(false);
        }
    );
}

// ==============================
// BACK TO PROFILE
// ==============================

if (backToProfile) {
    backToProfile.addEventListener(
        "click",
        async function () {
            const {
                data: {
                    user
                }
            } =
                await supabaseClient
                    .auth
                    .getUser();

            if (user) {
                window.location.href =
                    `users-profile.html?id=${encodeURIComponent(
                        user.id
                    )}`;
            } else {
                window.location.href =
                    "indexter.html";
            }
        }
    );
}

// ==============================
// START
// ==============================

async function startDiscover() {

    currentUser =
        await getCurrentUser();

    await loadBlockedUsers();

    await loadCurrentUserFos();

    await loadUsers(
        true
    );
}

startDiscover();
