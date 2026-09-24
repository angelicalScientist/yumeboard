const userList = document.getElementById("userList");
const userSearch = document.getElementById("userSearch");
const searchMessage = document.getElementById("searchMessage");
const loadMoreButton = document.getElementById("loadMoreButton");
const loadMoreContainer = document.getElementById("loadMoreContainer");
const backToProfile = document.getElementById("backToProfile");
const fandomFilter = document.getElementById("fandomFilter");

const USERS_PER_PAGE = 24;

let currentOffset = 0;
let currentSearch = "";
let currentFandomId = "";
let loadingUsers = false;
let hasMoreUsers = true;

let currentUser = null;
let currentUserFos = [];
let blockedUserIds = new Set();


// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// --------------------------------------------------
// CURRENT USER
// --------------------------------------------------

async function getCurrentUser() {
    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error) {
        console.error("Couldn't get current user:", error);
        return null;
    }

    return user || null;
}


// --------------------------------------------------
// LOAD CURRENT USER'S F/OS
// --------------------------------------------------

async function loadCurrentUserFos() {
    if (!currentUser) {
        currentUserFos = [];
        return;
    }

    const { data, error } = await supabaseClient
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
        .eq("user_id", currentUser.id);

    if (error) {
        console.error("Couldn't load your F/Os:", error);
        currentUserFos = [];
        return;
    }

    currentUserFos = data || [];
}


// --------------------------------------------------
// COMPATIBILITY
// --------------------------------------------------

function getFoCompatibility(myFo, theirFo) {
    if (!myFo || !theirFo) {
        return null;
    }

    const myCharacterId =
        myFo.character_id ||
        myFo.characters?.id ||
        null;

    const theirCharacterId =
        theirFo.character_id ||
        theirFo.characters?.id ||
        null;

    if (!myCharacterId || !theirCharacterId) {
        return null;
    }

    if (myCharacterId !== theirCharacterId) {
        return null;
    }

    const myPreference = myFo.doubles_preference || "okay";
    const theirPreference = theirFo.doubles_preference || "okay";

    if (
        myPreference === "no" ||
        theirPreference === "no"
    ) {
        return {
            type: "conflict",
            text: "♡ F/O overlap preference conflict"
        };
    }

    if (
        myPreference === "ask" ||
        theirPreference === "ask"
    ) {
        return {
            type: "ask",
            text: "♡ Ask before interacting with this F/O"
        };
    }

    return {
        type: "compatible",
        text: "♡ F/O compatibility"
    };
}


function getUserCompatibility(theirFos) {
    if (!currentUserFos.length || !theirFos.length) {
        return {
            type: "none",
            text: ""
        };
    }

    let hasAsk = false;

    for (const myFo of currentUserFos) {
        for (const theirFo of theirFos) {
            const compatibility = getFoCompatibility(
                myFo,
                theirFo
            );

            if (!compatibility) {
                continue;
            }

            if (compatibility.type === "conflict") {
                return compatibility;
            }

            if (compatibility.type === "ask") {
                hasAsk = true;
            }
        }
    }

    if (hasAsk) {
        return {
            type: "ask",
            text: "♡ Ask before interacting with this F/O"
        };
    }

    return {
        type: "compatible",
        text: "♡ F/O compatibility"
    };
}


function getCompatibilityHTML(compatibility) {
    if (!compatibility || compatibility.type === "none") {
        return "";
    }

    let className = "compatibility-badge";

    if (compatibility.type === "conflict") {
        className += " conflict";
    } else if (compatibility.type === "ask") {
        className += " ask";
    } else if (compatibility.type === "compatible") {
        className += " compatible";
    }

    return `
        <p class="${className}">
            ${escapeHtml(compatibility.text)}
        </p>
    `;
}


// --------------------------------------------------
// LOAD FANDOMS
// --------------------------------------------------

async function loadFandoms() {
    if (!fandomFilter) {
        return;
    }

    const { data: fandoms, error } = await supabaseClient
        .from("fandoms")
        .select(`
            id,
            name
        `)
        .order("name", {
            ascending: true
        });

    if (error) {
        console.error("Couldn't load fandoms:", error);
        return;
    }

    fandomFilter.innerHTML = `
        <option value="">All fandoms ♡</option>
    `;

    (fandoms || []).forEach(function (fandom) {
        const option = document.createElement("option");

        option.value = fandom.id;
        option.textContent = fandom.name;

        fandomFilter.appendChild(option);
    });

    fandomFilter.value = currentFandomId;
}


// --------------------------------------------------
// LOAD BLOCKED USERS
// --------------------------------------------------

async function loadBlockedUsers() {
    if (!currentUser) {
        blockedUserIds = new Set();
        return;
    }

    const { data, error } = await supabaseClient
        .from("blocked_users")
        .select("blocked_id")
        .eq("blocker_id", currentUser.id);

    if (error) {
        console.error("Couldn't load blocked users:", error);
        blockedUserIds = new Set();
        return;
    }

    blockedUserIds = new Set(
        (data || [])
            .map(function (row) {
                return row.blocked_id;
            })
            .filter(Boolean)
    );
}


// --------------------------------------------------
// RENDER USER
// --------------------------------------------------

function renderUser(user) {
    const card = document.createElement("article");

    card.className = "user-card";

    const displayName =
        user.display_name ||
        user.username ||
        "Unnamed user";

    const username =
        user.username ||
        "";

    const avatarHTML = user.avatar_url
        ? `
            <img
                src="${escapeHtml(user.avatar_url)}"
                alt=""
                class="user-card-avatar"
            >
        `
        : `
            <div class="user-card-avatar placeholder-avatar">
                ♡
            </div>
        `;

    const bioHTML = user.bio
        ? `
            <p class="user-card-bio">
                ${escapeHtml(user.bio)}
            </p>
        `
        : "";

    let mainFoHTML = "";

    if (user.fos && user.fos.length > 0) {
        const mainFo =
            user.fos.find(function (fo) {
                return fo.is_main;
            }) || user.fos[0];

        const characterName =
            mainFo.characters?.canonical_name ||
            "Unknown character";

        mainFoHTML = `
            <p class="user-card-fo">
                ♡ Main F/O:
                <strong>${escapeHtml(characterName)}</strong>
            </p>
        `;
    }

    const compatibilityHTML =
        getCompatibilityHTML(user.compatibility);

    card.innerHTML = `
        <div class="user-card-top">
            ${avatarHTML}

            <div class="user-card-heading">
                <h3>
                    ${escapeHtml(displayName)}
                </h3>

                <p class="user-card-username">
                    @${escapeHtml(username)}
                </p>
            </div>
        </div>

        ${bioHTML}

        ${mainFoHTML}

        ${compatibilityHTML}

        <button
            type="button"
            class="view-profile-button"
        >
            View Profile ♡
        </button>
    `;

    const profileButton =
        card.querySelector(".view-profile-button");

    if (profileButton) {
        profileButton.addEventListener("click", function () {
            window.location.href =
                `users-profile.html?id=${encodeURIComponent(user.id)}`;
        });
    }

    userList.appendChild(card);
}


// --------------------------------------------------
// LOAD USERS
// --------------------------------------------------

async function loadUsers(reset = false) {
    if (loadingUsers) {
        return;
    }

    if (reset) {
        currentOffset = 0;
        hasMoreUsers = true;

        userList.innerHTML = `
            <p class="search-hint">
                Loading people... 🌸
            </p>
        `;

        if (loadMoreContainer) {
            loadMoreContainer.style.display = "none";
        }
    }

    loadingUsers = true;

    if (searchMessage) {
        searchMessage.textContent = "Loading users... 🌸";
    }

    let visibleUsersAdded = 0;
    const targetVisibleUsers = USERS_PER_PAGE;

    while (
        visibleUsersAdded < targetVisibleUsers &&
        hasMoreUsers
    ) {
        let profileSelect = `
            id,
            username,
            display_name,
            bio,
            avatar_url
        `;

       
        if (currentFandomId) {
            profileSelect += `,
                profile_fandoms!inner (
                    fandom_id
                )
            `;
        }

        let profileQuery = supabaseClient
            .from("profiles")
            .select(profileSelect)
            .order("username", {
                ascending: true
            })
            .range(
                currentOffset,
                currentOffset + USERS_PER_PAGE - 1
            );

        if (currentSearch) {
            const safeSearch = currentSearch
                .replaceAll("%", "")
                .replaceAll(",", "")
                .replaceAll(".", "");

            profileQuery = supabaseClient
                .from("profiles")
                .select(profileSelect)
                .or(
                    `username.ilike.%${safeSearch}%,display_name.ilike.%${safeSearch}%`
                )
                .order("username", {
                    ascending: true
                })
                .range(
                    currentOffset,
                    currentOffset + USERS_PER_PAGE - 1
                );
        }

        if (currentFandomId) {
            profileQuery = profileQuery.eq(
                "profile_fandoms.fandom_id",
                currentFandomId
            );
        }

        const {
            data: profiles,
            error: profileError
        } = await profileQuery;

        if (profileError) {
            console.error(
                "Couldn't load discover profiles:",
                profileError
            );

            if (searchMessage) {
                searchMessage.textContent =
                    "Couldn't load people right now. Please try again. ♡";
            }

            break;
        }

        const loadedProfiles = profiles || [];

        if (loadedProfiles.length < USERS_PER_PAGE) {
            hasMoreUsers = false;
        }

        if (loadedProfiles.length === 0) {
            break;
        }

        const userIds = loadedProfiles
            .map(function (profile) {
                return profile.id;
            })
            .filter(Boolean);

        let foMap = new Map();

        if (userIds.length > 0) {
            const {
                data: fos,
                error: fosError
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
                .in("user_id", userIds);

            if (fosError) {
                console.error(
                    "Couldn't load F/Os:",
                    fosError
                );
            } else {
                (fos || []).forEach(function (fo) {
                    if (!foMap.has(fo.user_id)) {
                        foMap.set(fo.user_id, []);
                    }

                    foMap.get(fo.user_id).push(fo);
                });
            }
        }

        for (const profile of loadedProfiles) {
            // Never show yourself.
            if (
                currentUser &&
                profile.id === currentUser.id
            ) {
                continue;
            }

            // Never show blocked users.
            if (blockedUserIds.has(profile.id)) {
                continue;
            }

            const theirFos =
                foMap.get(profile.id) || [];

            profile.fos = theirFos;

            profile.compatibility =
                getUserCompatibility(theirFos);

            // Hide doubles whose preferences conflict.
            if (
                profile.compatibility &&
                profile.compatibility.type === "conflict"
            ) {
                continue;
            }

            renderUser(profile);

            visibleUsersAdded++;

            if (
                visibleUsersAdded >= targetVisibleUsers
            ) {
                break;
            }
        }

        currentOffset += loadedProfiles.length;

        if (
            loadedProfiles.length < USERS_PER_PAGE
        ) {
            hasMoreUsers = false;
        }
    }

    // --------------------------------------------------
    // STATUS MESSAGE
    // --------------------------------------------------

    if (searchMessage) {
        if (
            currentSearch !== "" ||
            currentFandomId !== ""
        ) {
            const searchParts = [];

            if (currentSearch !== "") {
                searchParts.push(
                    `search for "${escapeHtml(currentSearch)}"`
                );
            }

            if (currentFandomId !== "" && fandomFilter) {
                const selectedOption =
                    fandomFilter.options[
                        fandomFilter.selectedIndex
                    ];

                if (selectedOption) {
                    searchParts.push(
                        `fandom "${escapeHtml(selectedOption.textContent)}"`
                    );
                }
            }

            if (searchParts.length > 0) {
                searchMessage.textContent =
                    `Showing people matching your ${searchParts.join(" and ")}. ♡`;
            }
        } else {
            searchMessage.textContent =
                "Find other yumeshippers and explore their profiles! 🌸";
        }
    }

    if (loadMoreContainer) {
        loadMoreContainer.style.display =
            hasMoreUsers ? "block" : "none";
    }

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


// --------------------------------------------------
// SEARCH
// --------------------------------------------------

let searchTimer = null;

if (userSearch) {
    userSearch.addEventListener(
        "input",
        function () {
            currentSearch =
                userSearch.value.trim();

            clearTimeout(searchTimer);

            searchTimer = setTimeout(
                function () {
                    loadUsers(true);
                },
                300
            );
        }
    );
}


// --------------------------------------------------
// FANDOM FILTER
// --------------------------------------------------

if (fandomFilter) {
    fandomFilter.addEventListener(
        "change",
        function () {
            currentFandomId =
                fandomFilter.value;

            loadUsers(true);
        }
    );
}


// --------------------------------------------------
// LOAD MORE
// --------------------------------------------------

if (loadMoreButton) {
    loadMoreButton.addEventListener(
        "click",
        function () {
            loadUsers(false);
        }
    );
}


// --------------------------------------------------
// BACK TO PROFILE
// --------------------------------------------------

if (backToProfile) {
    backToProfile.addEventListener(
        "click",
        async function () {
            const user = await getCurrentUser();

            if (user) {
                window.location.href =
                    `users-profile.html?id=${encodeURIComponent(user.id)}`;
            } else {
                window.location.href =
                    "indexter.html";
            }
        }
    );
}


// --------------------------------------------------
// START DISCOVER
// --------------------------------------------------

async function startDiscover() {
    currentUser =
        await getCurrentUser();

    await loadBlockedUsers();

    await loadCurrentUserFos();

    await loadFandoms();

    await loadUsers(true);
}

startDiscover();