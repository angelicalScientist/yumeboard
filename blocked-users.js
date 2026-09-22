
const blockedUsersList =
    document.getElementById(
        "blockedUsersList"
    );

const blockedUsersEmpty =
    document.getElementById(
        "blockedUsersEmpty"
    );

const backToProfile =
    document.getElementById(
        "backToProfile"
    );

const discoverButton =
    document.getElementById(
        "discoverButton"
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
// LOAD BLOCKED USERS
// ==============================

async function loadBlockedUsers() {

    blockedUsersList.innerHTML = `
        <p class="search-hint">
            Loading blocked users... 🌸
        </p>
    `;

    blockedUsersEmpty.hidden = true;


    // Get current user

    const {
        data: {
            user
        },
        error: userError
    } = await supabaseClient
        .auth
        .getUser();


    if (userError || !user) {

        blockedUsersList.innerHTML = `
            <p class="search-hint">
                You need to be logged in to view your blocked users. ♡
            </p>
        `;

        return;
    }


    // Get blocked-user records

    const {
        data: blockedRecords,
        error: blockedError
    } = await supabaseClient
        .from("blocked_users")
        .select(`
            id,
            blocked_id,
            created_at
        `)
        .eq(
            "blocker_id",
            user.id
        )
        .order(
            "created_at",
            {
                ascending: false
            }
        );


    if (blockedError) {

        console.error(
            "Couldn't load blocked users:",
            blockedError
        );

        blockedUsersList.innerHTML = `
            <p class="search-hint">
                Couldn't load your blocked users. >_<
            </p>
        `;

        return;
    }


    const records =
        blockedRecords || [];


    // Nothing blocked

    if (records.length === 0) {

        blockedUsersList.innerHTML = "";

        blockedUsersEmpty.hidden = false;

        return;
    }


    // Get profile IDs

    const blockedIds =
        records.map(
            function (record) {
                return record.blocked_id;
            }
        );


    // Load profiles

    const {
        data: profiles,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select(`
            id,
            username,
            display_name,
            bio,
            avatar_url
        `)
        .in(
            "id",
            blockedIds
        );


    if (profileError) {

        console.error(
            "Couldn't load blocked profiles:",
            profileError
        );

        blockedUsersList.innerHTML = `
            <p class="search-hint">
                Couldn't load blocked profiles. >_<
            </p>
        `;

        return;
    }


    const profileMap =
        new Map();

    (profiles || []).forEach(
        function (profile) {

            profileMap.set(
                profile.id,
                profile
            );

        }
    );


    // Clear loading message

    blockedUsersList.innerHTML = "";


    // Render each blocked user

    records.forEach(
        function (record) {

            const profile =
                profileMap.get(
                    record.blocked_id
                );


            // Account may have been deleted

            if (!profile) {
                return;
            }


            renderBlockedUser(
                profile,
                record.id
            );

        }
    );

}


// ==============================
// RENDER BLOCKED USER
// ==============================

function renderBlockedUser(
    profile,
    blockRecordId
) {

    const card =
        document.createElement(
            "article"
        );

    card.className =
        "user-card";


    const displayName =
        profile.display_name ||
        profile.username ||
        "Unnamed user";

    const username =
        profile.username ||
        "unknown";

    const bio =
        profile.bio ||
        "No bio yet. ♡";

    const avatar =
        profile.avatar_url ||
        "https://placehold.co/150x150";


    card.innerHTML = `

        <img
            class="user-card-avatar"
            src="${escapeHtml(avatar)}"
            alt=""
            loading="lazy"
        >

        <div class="user-card-content">

            <h2>
                ${escapeHtml(displayName)}
            </h2>

            <p class="user-card-username">
                @${escapeHtml(username)}
            </p>

            <p class="user-card-bio">
                ${escapeHtml(bio)}
            </p>

            <div class="blocked-user-actions">

                <button
                    type="button"
                    class="unblock-user-button"
                >
                    ♡ Unblock
                </button>

            </div>

        </div>
    `;


    blockedUsersList.appendChild(
        card
    );


    // Unblock button

    const unblockButton =
        card.querySelector(
            ".unblock-user-button"
        );


    unblockButton.addEventListener(
        "click",
        async function () {

            unblockButton.disabled = true;

            unblockButton.textContent =
                "Unblocking...";


            const {
                error
            } = await supabaseClient
                .from("blocked_users")
                .delete()
                .eq(
                    "id",
                    blockRecordId
                );


            if (error) {

                console.error(
                    "Couldn't unblock user:",
                    error
                );

                unblockButton.disabled =
                    false;

                unblockButton.textContent =
                    "♡ Unblock";

                alert(
                    "Couldn't unblock this user. Please try again! >_<"
                );

                return;
            }


            // Remove the card immediately

            card.remove();


            // If there are no cards left,
            // show the empty state.

            if (
                blockedUsersList
                    .querySelectorAll(
                        ".user-card"
                    )
                    .length === 0
            ) {

                blockedUsersEmpty.hidden =
                    false;

            }

        }
    );

}


// ==============================
// BACK TO PROFILE
// ==============================

backToProfile.addEventListener(
    "click",
    async function () {

        const {
            data: {
                user
            }
        } = await supabaseClient
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


// ==============================
// DISCOVER BUTTON
// ==============================

discoverButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "discover.html";

    }
);


// ==============================
// START
// ==============================

loadBlockedUsers();
