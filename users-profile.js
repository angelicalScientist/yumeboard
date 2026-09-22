
// ======================================
// PUBLIC PROFILE
// ======================================

async function loadUserProfile() {
    console.log("🌸 Loading public profile...");

    try {
        // =========================
        // GET PROFILE ID FROM URL
        // =========================

        const params = new URLSearchParams(window.location.search);
        const profileId = params.get("id");

        if (!profileId) {
            console.error("❌ No profile ID in URL.");
            return;
        }

        // =========================
        // GET CURRENT USER
        // =========================

        const {
            data: { user },
            error: userError
        } = await supabaseClient.auth.getUser();

        if (userError) {
            throw userError;
        }

        // =========================
        // DON'T VIEW YOUR OWN PUBLIC PROFILE
        // =========================

        if (user && user.id === profileId) {
            window.location.href = "indexter.html";
            return;
        }

        // =========================
        // CHECK IF THIS USER IS BLOCKED
        // =========================

        if (user) {
            const {
                data: existingBlock,
                error: blockCheckError
            } = await supabaseClient
                .from("blocked_users")
                .select("id")
                .eq("blocker_id", user.id)
                .eq("blocked_id", profileId)
                .maybeSingle();

            if (blockCheckError) {
                console.error(
                    "❌ Block check error:",
                    blockCheckError
                );
            }

            if (existingBlock) {
                console.log(
                    "🚫 This user is already blocked."
                );

                window.location.href = "indexter.html";
                return;
            }
        }

        // =========================
        // LOAD PROFILE
        // =========================

        const {
            data: profile,
            error: profileError
        } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", profileId)
            .single();

        if (profileError) {
            throw profileError;
        }

        if (!profile) {
            throw new Error("Profile not found.");
        }

        console.log("✨ Profile loaded:", profile);

        // =========================
        // BASIC INFO
        // =========================

        const profileName =
            document.getElementById("profileUsername");

        const profileDisplayName =
            document.getElementById("profileDisplayName");

        const profileBio =
            document.getElementById("profileBio");

        const profileMood =
            document.getElementById("profileMood");

        const profileFandoms =
            document.getElementById("profileFandoms");

        if (profileName) {
            profileName.textContent =
                `♡ ${profile.username || "Profile"} ♡`;
        }

        if (profileDisplayName) {
            profileDisplayName.textContent =
                profile.display_name ||
                profile.username ||
                "Unnamed user";
        }

        if (profileBio) {
            profileBio.textContent =
                profile.bio ||
                "No bio yet! ♡";
        }

        if (profileMood) {
            profileMood.textContent =
                profile.mood ||
                "🌸 happy!";
        }

        // =========================
        // AVATAR
        // =========================

        const profileAvatar =
            document.getElementById("profileAvatar");

        if (
            profileAvatar &&
            profile.avatar_url
        ) {
            profileAvatar.src = profile.avatar_url;
        }

        // =========================
        // BANNER
        // =========================

        const profileBanner =
            document.getElementById("profileBanner");

        const bannerPlaceholder =
            document.getElementById("bannerPlaceholder");

        if (
            profileBanner &&
            profile.banner_url
        ) {
            profileBanner.src = profile.banner_url;
            profileBanner.style.display = "block";

            if (bannerPlaceholder) {
                bannerPlaceholder.style.display = "none";
            }
        }

        // =========================
        // FANDOMS
        // =========================

        if (profileFandoms) {
            const {
                data: fandomRows,
                error: fandomError
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
                    profile.id
                );

            if (fandomError) {
                console.error(
                    "❌ Public profile fandom loading error:",
                    fandomError
                );

                profileFandoms.textContent =
                    "Couldn't load fandoms. :(";
            } else {
                const fandomNames =
                    (fandomRows || [])
                        .map(
                            row => row.fandoms?.name
                        )
                        .filter(Boolean);

                if (fandomNames.length > 0) {
                    profileFandoms.textContent =
                        fandomNames.join(" ♡ ");
                } else {
                    profileFandoms.textContent =
                        "No fandoms listed yet! ♡";
                }
            }
        }

        // =========================
        // SOCIAL CONTROLS
        // =========================

        setupBlockButton(
            profileId,
            user
        );

        await setupFriendship(
            profileId,
            user
        );

        // =========================
        // F/Os
        // =========================

        await loadPublicFos(
            profile.id
        );

        // =========================
        // GALLERY
        // =========================

        await loadPublicGallery(
            profile.id
        );

        // =========================
        // GUESTBOOK
        // =========================

        await loadGuestbook(
            profile.id
        );

        await loadGuestbookAuthor();

        setupGuestbook(
            profile.id
        );

        console.log(
            "🎀 Public profile displayed!"
        );

    } catch (error) {
        console.error(
            "💥 USER PROFILE ERROR:",
            error
        );
    }
}


// ======================================
// PUBLIC GALLERY
// ======================================

async function loadPublicGallery(userId) {
    const emptyState =
        document.getElementById("artEmpty");

    const gallerySection =
        document.getElementById("artGallery");

    const image =
        document.getElementById("artImage");

    const previousButton =
        document.getElementById("previousArt");

    const nextButton =
        document.getElementById("nextArt");

    const counter =
        document.getElementById("artCounter");

    const caption =
        document.getElementById("artCaption");

    if (
        !emptyState ||
        !gallerySection ||
        !image ||
        !previousButton ||
        !nextButton ||
        !counter ||
        !caption
    ) {
        console.warn(
            "⚠️ Public gallery elements not found."
        );
        return;
    }

    // =========================
    // LOADING STATE
    // =========================

    gallerySection.hidden = true;
    emptyState.hidden = false;
    emptyState.textContent =
        "Loading this user's artwork... 🌸";

    // =========================
    // LOAD VISIBLE ARTWORK
    // =========================

    const {
        data: artworks,
        error
    } = await supabaseClient
        .from("gallery_items")
        .select(`
            id,
            user_id,
            image_url,
            image_path,
            title,
            description,
            created_at,
            updated_at
        `)
        .eq(
            "user_id",
            userId
        )
        .eq(
            "is_hidden",
            false
        )
        .order(
            "created_at",
            {
                ascending: false
            }
        );

    if (error) {
        console.error(
            "💥 Public gallery loading error:",
            error
        );

        emptyState.hidden = false;
        emptyState.textContent =
            "Couldn't load this user's artwork. :(";

        gallerySection.hidden = true;
        return;
    }

    // =========================
    // EMPTY GALLERY
    // =========================

    if (
        !artworks ||
        artworks.length === 0
    ) {
        emptyState.hidden = false;
        emptyState.textContent =
            "This user hasn't uploaded any artwork yet. ♡";

        gallerySection.hidden = true;
        return;
    }

    // =========================
    // GALLERY STATE
    // =========================

    let currentArt = 0;

    function showArt() {
        const artwork =
            artworks[currentArt];

        if (!artwork) {
            return;
        }

        image.src =
            artwork.image_url;

        image.alt =
            artwork.title ||
            "Artwork";

        // =========================
        // CAPTION
        // =========================

        if (
            artwork.title &&
            artwork.description
        ) {
            caption.textContent =
                `${artwork.title} — ${artwork.description}`;

        } else if (artwork.title) {
            caption.textContent =
                artwork.title;

        } else if (artwork.description) {
            caption.textContent =
                artwork.description;

        } else {
            caption.textContent =
                "♡";
        }

        // =========================
        // COUNTER
        // =========================

        counter.textContent =
            `${currentArt + 1} / ${artworks.length}`;

        // =========================
        // NAVIGATION BUTTONS
        // =========================

        const hasMultipleArtworks =
            artworks.length > 1;

        previousButton.disabled =
            !hasMultipleArtworks;

        nextButton.disabled =
            !hasMultipleArtworks;
    }

    // =========================
    // PREVIOUS
    // =========================

    previousButton.onclick = function () {
        currentArt =
            (
                currentArt -
                1 +
                artworks.length
            ) %
            artworks.length;

        showArt();
    };

    // =========================
    // NEXT
    // =========================

    nextButton.onclick = function () {
        currentArt =
            (
                currentArt +
                1
            ) %
            artworks.length;

        showArt();
    };

    // =========================
    // SHOW GALLERY
    // =========================

    emptyState.hidden = true;
    gallerySection.hidden = false;

    showArt();

    // =========================
    // FULL GALLERY BUTTON
    // =========================

    addFullGalleryButton(userId);
}


// ======================================
// FULL GALLERY BUTTON
// ======================================

function addFullGalleryButton(userId) {
    const galleryCard =
        document.querySelector(
            ".art-gallery"
        );

    if (!galleryCard) {
        return;
    }

    // Prevent duplicates.
    const existing =
        galleryCard.querySelector(
            ".public-gallery-link"
        );

    if (existing) {
        return;
    }

    const link =
        document.createElement("a");

    link.className =
        "public-gallery-link";

    link.href =
        `gallery.html?user=${encodeURIComponent(userId)}`;

    link.textContent =
        "✨ View Full Gallery";

    galleryCard.appendChild(link);
}


// ======================================
// BLOCK BUTTON
// ======================================

function setupBlockButton(
    profileId,
    currentUser
) {
    const blockUserButton =
        document.getElementById(
            "blockUserButton"
        );

    if (!blockUserButton) {
        console.warn(
            "⚠️ Block button not found."
        );
        return;
    }

    // =========================
    // LOGGED OUT
    // =========================

    if (!currentUser) {
        blockUserButton.disabled = true;
        blockUserButton.textContent =
            "🚫 Log in to block";

        return;
    }

    // =========================
    // OWN PROFILE
    // =========================

    if (
        currentUser.id === profileId
    ) {
        blockUserButton.style.display =
            "none";

        return;
    }

    // =========================
    // REMOVE OLD LISTENER
    // =========================

    const freshButton =
        blockUserButton.cloneNode(true);

    blockUserButton.replaceWith(
        freshButton
    );

    // =========================
    // BLOCK
    // =========================

    freshButton.addEventListener(
        "click",
        async function () {
            await blockUser(
                profileId,
                currentUser
            );
        }
    );
}


// ======================================
// FRIENDSHIP CONTROLS
// ======================================

async function setupFriendship(
    profileId,
    currentUser
) {
    const controls =
        document.getElementById(
            "friendshipControls"
        );

    const addButton =
        document.getElementById(
            "addFriendButton"
        );

    const acceptButton =
        document.getElementById(
            "acceptFriendButton"
        );

    const declineButton =
        document.getElementById(
            "declineFriendButton"
        );

    const removeButton =
        document.getElementById(
            "removeFriendButton"
        );

    const status =
        document.getElementById(
            "friendshipStatus"
        );

    if (!controls) {
        return;
    }

    // =========================
    // HIDE EVERYTHING FIRST
    // =========================

    controls.style.display = "none";

    if (addButton) {
        addButton.style.display = "none";
    }

    if (acceptButton) {
        acceptButton.style.display = "none";
    }

    if (declineButton) {
        declineButton.style.display = "none";
    }

    if (removeButton) {
        removeButton.style.display = "none";
    }

    if (status) {
        status.textContent = "";
    }

    // =========================
    // LOGGED OUT
    // =========================

    if (!currentUser) {
        return;
    }

    // =========================
    // OWN PROFILE
    // =========================

    if (
        String(currentUser.id) ===
        String(profileId)
    ) {
        return;
    }

    // =========================
    // FIND EXISTING FRIENDSHIP
    // =========================

    const {
        data: friendship,
        error
    } = await supabaseClient
        .from("friendships")
        .select("*")
        .or(
            `and(requester_id.eq.${currentUser.id},addressee_id.eq.${profileId}),` +
            `and(requester_id.eq.${profileId},addressee_id.eq.${currentUser.id})`
        )
        .maybeSingle();

    if (error) {
        console.error(
            "❌ Error checking friendship:",
            error
        );
        return;
    }

    controls.style.display = "block";

    // =========================
    // NO RELATIONSHIP
    // =========================

    if (!friendship) {
        if (addButton) {
            addButton.style.display =
                "inline-block";

            addButton.onclick = () => {
                sendFriendRequest(
                    profileId,
                    currentUser
                );
            };
        }

        return;
    }

    // =========================
    // ALREADY FRIENDS
    // =========================

    if (
        friendship.status === "accepted"
    ) {
        if (removeButton) {
            removeButton.style.display =
                "inline-block";

            removeButton.onclick = () => {
                removeFriendship(
                    friendship.id,
                    profileId,
                    currentUser
                );
            };
        }

        if (status) {
            status.textContent =
                "♡ You are friends!";
        }

        return;
    }

    // =========================
    // YOU SENT THE REQUEST
    // =========================

    if (
        friendship.status === "pending" &&
        String(friendship.requester_id) ===
            String(currentUser.id)
    ) {
        if (status) {
            status.textContent =
                "♡ Friend request sent!";
        }

        return;
    }

    // =========================
    // THEY SENT THE REQUEST
    // =========================

    if (
        friendship.status === "pending" &&
        String(friendship.addressee_id) ===
            String(currentUser.id)
    ) {
        if (acceptButton) {
            acceptButton.style.display =
                "inline-block";

            acceptButton.onclick = () => {
                acceptFriendship(
                    friendship.id,
                    profileId,
                    currentUser
                );
            };
        }

        if (declineButton) {
            declineButton.style.display =
                "inline-block";

            declineButton.onclick = () => {
                declineFriendship(
                    friendship.id,
                    profileId,
                    currentUser
                );
            };
        }

        if (status) {
            status.textContent =
                "♡ This user sent you a friend request!";
        }
    }
}


// ======================================
// SEND FRIEND REQUEST
// ======================================

async function sendFriendRequest(
    profileId,
    currentUser
) {
    if (!currentUser) {
        alert(
            "Please log in before sending friend requests! ♡"
        );
        return;
    }

    if (
        String(currentUser.id) ===
        String(profileId)
    ) {
        alert(
            "You can't send yourself a friend request! ♡"
        );
        return;
    }

    const button =
        document.getElementById(
            "addFriendButton"
        );

    if (button) {
        button.disabled = true;
        button.textContent =
            "♡ Sending...";
    }

    try {
        const {
            error
        } = await supabaseClient.rpc(
            "send_friend_request",
            {
                target_user_id: profileId
            }
        );

        if (error) {
            console.error(
                "❌ Send friend request error:",
                error
            );

            alert(
                "Couldn't send the friend request. :("
            );

            return;
        }

        await setupFriendship(
            profileId,
            currentUser
        );

    } catch (error) {
        console.error(
            "❌ Unexpected friend request error:",
            error
        );

        alert(
            "Something went wrong sending the friend request. :("
        );

    } finally {
        if (button) {
            button.disabled = false;
        }
    }
}


// ======================================
// ACCEPT FRIEND REQUEST
// ======================================

async function acceptFriendship(
    friendshipId,
    profileId,
    currentUser
) {
    const {
        error
    } = await supabaseClient.rpc(
        "accept_friend_request",
        {
            friendship_id: friendshipId
        }
    );

    if (error) {
        console.error(
            "❌ Accept friend request error:",
            error
        );

        alert(
            "Couldn't accept the friend request. :("
        );

        return;
    }

    await setupFriendship(
        profileId,
        currentUser
    );
}


// ======================================
// DECLINE FRIEND REQUEST
// ======================================

async function declineFriendship(
    friendshipId,
    profileId,
    currentUser
) {
    const {
        error
    } = await supabaseClient.rpc(
        "decline_friend_request",
        {
            friendship_id: friendshipId
        }
    );

    if (error) {
        console.error(
            "❌ Decline friend request error:",
            error
        );

        alert(
            "Couldn't decline the friend request. :("
        );

        return;
    }

    await setupFriendship(
        profileId,
        currentUser
    );
}


// ======================================
// REMOVE FRIEND
// ======================================

async function removeFriendship(
    friendshipId,
    profileId,
    currentUser
) {
    const confirmed =
        window.confirm(
            "Remove this person from your friends? ♡"
        );

    if (!confirmed) {
        return;
    }

    const {
        error
    } = await supabaseClient.rpc(
        "remove_friend",
        {
            friendship_id: friendshipId
        }
    );

    if (error) {
        console.error(
            "❌ Remove friend error:",
            error
        );

        alert(
            "Couldn't remove this friend. :("
        );

        return;
    }

    await setupFriendship(
        profileId,
        currentUser
    );
}


// ======================================
// BLOCK USER
// ======================================

async function blockUser(
    profileId,
    currentUser
) {
    if (!profileId) {
        console.error(
            "❌ Cannot block: no profile ID."
        );
        return;
    }

    if (!currentUser) {
        alert(
            "Please log in before blocking users. ♡"
        );
        return;
    }

    if (
        currentUser.id === profileId
    ) {
        alert(
            "You can't block yourself! ♡"
        );
        return;
    }

    const confirmed =
        window.confirm(
            "Block this user? You won't see them in Discover anymore. ♡"
        );

    if (!confirmed) {
        return;
    }

    const blockButton =
        document.getElementById(
            "blockUserButton"
        );

    if (blockButton) {
        blockButton.disabled = true;
        blockButton.textContent =
            "🚫 Blocking...";
    }

    try {
        // =========================
        // CHECK EXISTING BLOCK
        // =========================

        const {
            data: existingBlock,
            error: checkError
        } = await supabaseClient
            .from("blocked_users")
            .select("id")
            .eq(
                "blocker_id",
                currentUser.id
            )
            .eq(
                "blocked_id",
                profileId
            )
            .maybeSingle();

        if (checkError) {
            throw checkError;
        }

        if (existingBlock) {
            alert(
                "This user is already blocked. 🚫"
            );

            window.location.href =
                "indexter.html";

            return;
        }

        // =========================
        // CREATE BLOCK
        // =========================

        const {
            error: insertError
        } = await supabaseClient
            .from("blocked_users")
            .insert({
                blocker_id:
                    currentUser.id,

                blocked_id:
                    profileId
            });

        if (insertError) {
            throw insertError;
        }

        console.log(
            "🚫 User blocked successfully."
        );

        alert(
            "User blocked! 🚫♡"
        );

        window.location.href =
            "indexter.html";

    } catch (error) {
        console.error(
            "❌ Block error:",
            error
        );

        if (blockButton) {
            blockButton.disabled = false;
            blockButton.textContent =
                "🚫 Block User";
        }

        if (
            error.code === "23505"
        ) {
            alert(
                "This user is already blocked. 🚫"
            );

            window.location.href =
                "indexter.html";

            return;
        }

        alert(
            "Couldn't block this user. Please try again. :("
        );
    }
}


// ======================================
// LOAD PUBLIC F/Os
// ======================================

async function loadPublicFos(
    userId
) {
    const foList =
        document.getElementById(
            "profileFos"
        );

    if (!foList) {
        return;
    }

    foList.innerHTML =
        "<p>Loading F/Os... 🌸</p>";

    const {
        data: fos,
        error
    } = await supabaseClient
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
        .eq(
            "user_id",
            userId
        )
        .order(
            "is_main",
            {
                ascending: false
            }
        );

    if (error) {
        console.error(
            "💥 Public F/O loading error:",
            error
        );

        foList.innerHTML =
            "<p>Couldn't load this user's F/Os. :(</p>";

        return;
    }

    if (
        !fos ||
        fos.length === 0
    ) {
        foList.innerHTML =
            "<p>This user hasn't added any F/Os yet! ♡</p>";

        return;
    }

    foList.innerHTML = "";

    fos.forEach(
        function (fo) {
            const character =
                fo.characters;

            if (!character) {
                return;
            }

            const card =
                document.createElement(
                    "article"
                );

            card.className =
                "fo-card";

            const image =
                fo.image_url ||
                character.image_url;

            // =========================
            // IMAGE
            // =========================

            const imageHTML =
                image
                    ? `
                        <img
                            src="${escapeHtml(image)}"
                            alt="${escapeHtml(character.canonical_name)}"
                            class="fo-card-image"
                        >
                    `
                    : "";

            // =========================
            // CARD
            // =========================

            card.innerHTML = `
                ${imageHTML}

                <div class="fo-card-info">
                    <h3>
                        ♡ ${escapeHtml(
                            fo.name ||
                            character.canonical_name
                        )}
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
                </div>
            `;

            foList.appendChild(card);
        }
    );
}


// ======================================
// PUBLIC PROFILE GUESTBOOK
// ======================================

async function loadGuestbook(
    profileId
) {
    const entries =
        document.getElementById(
            "guestbookEntries"
        );

    if (!entries) {
        console.warn(
            "⚠️ guestbookEntries element not found."
        );
        return;
    }

    entries.innerHTML = `
        <p class="search-hint">
            Loading messages... 🌸
        </p>
    `;

    const {
        data,
        error
    } = await supabaseClient
        .from("guestbook_entries")
        .select(`
            id,
            profile_id,
            user_id,
            author_name,
            message,
            is_anonymous,
            created_at
        `)
        .eq(
            "profile_id",
            profileId
        )
        .order(
            "created_at",
            {
                ascending: false
            }
        );

    if (error) {
        console.error(
            "💥 Guestbook loading error:",
            error
        );

        entries.innerHTML = `
            <p class="search-hint">
                Couldn't load the guestbook. :(
            </p>
        `;

        return;
    }

    if (
        !data ||
        data.length === 0
    ) {
        entries.innerHTML = `
            <p class="search-hint">
                No messages yet. Be the first! ♡
            </p>
        `;

        return;
    }

    entries.innerHTML = "";

    data.forEach(
        function (guestbookEntry) {
            const entry =
                document.createElement(
                    "div"
                );

            entry.className =
                "guestbook-entry";

            const author =
                guestbookEntry.is_anonymous
                    ? "Anonymous"
                    : (
                        guestbookEntry.author_name ||
                        "Unknown user"
                    );

            entry.innerHTML = `
                <div class="entry-header">
                    <strong>
                        ♡ ${escapeHtml(author)}
                    </strong>
                </div>

                <p>
                    ${escapeHtml(
                        guestbookEntry.message
                    )}
                </p>
            `;

            entries.appendChild(entry);
        }
    );
}


// ======================================
// GET CURRENT USERNAME
// ======================================

async function loadGuestbookAuthor() {
    const postingAs =
        document.getElementById(
            "guestbookPostingAs"
        );

    if (!postingAs) {
        console.warn(
            "⚠️ guestbookPostingAs element not found."
        );
        return;
    }

    postingAs.textContent =
        "Posting as: Loading... ♡";

    const {
        data,
        error
    } = await supabaseClient.auth.getUser();

    if (error) {
        console.error(
            "❌ Auth lookup failed:",
            error
        );

        postingAs.textContent =
            "Posting as: Not logged in ♡";

        return;
    }

    const user =
        data?.user;

    if (!user) {
        postingAs.textContent =
            "Posting as: Not logged in ♡";

        return;
    }

    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select("username")
        .eq(
            "id",
            user.id
        )
        .maybeSingle();

    if (profileError) {
        console.error(
            "❌ Guestbook author profile error:",
            profileError
        );

        postingAs.textContent =
            "Posting as: Unknown user ♡";

        return;
    }

    const username =
        profile?.username ||
        "Unnamed user";

    postingAs.textContent =
        `Posting as: ${username} ♡`;
}


// ======================================
// SET UP GUESTBOOK FORM
// ======================================

function setupGuestbook(
    profileId
) {
    const form =
        document.getElementById(
            "guestbookForm"
        );

    const messageInput =
        document.getElementById(
            "guestMessage"
        );

    if (
        !form ||
        !messageInput
    ) {
        console.warn(
            "⚠️ Guestbook form elements not found."
        );
        return;
    }

    // =========================
    // PREVENT DUPLICATE LISTENERS
    // =========================

    const freshForm =
        form.cloneNode(true);

    form.replaceWith(
        freshForm
    );

    const freshMessageInput =
        freshForm.querySelector(
            "#guestMessage"
        );

    const freshAnonymousCheckbox =
        freshForm.querySelector(
            "#guestbookAnonymous"
        );

    // =========================
    // SUBMIT
    // =========================

    freshForm.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            const message =
                freshMessageInput.value.trim();

            const isAnonymous =
                freshAnonymousCheckbox
                    ? freshAnonymousCheckbox.checked
                    : false;

            if (!message) {
                alert(
                    "Please write a message first! ♡"
                );
                return;
            }

            try {
                // =========================
                // CHECK AUTH
                // =========================

                const {
                    data: { user },
                    error: userError
                } = await supabaseClient.auth.getUser();

                if (
                    userError ||
                    !user
                ) {
                    alert(
                        "You need to be logged in to sign guestbooks! ♡"
                    );

                    return;
                }

                // =========================
                // LOAD AUTHOR PROFILE
                // =========================

                const {
                    data: profile,
                    error: profileError
                } = await supabaseClient
                    .from("profiles")
                    .select("username")
                    .eq(
                        "id",
                        user.id
                    )
                    .maybeSingle();

                if (profileError) {
                    console.error(
                        "❌ Couldn't load author profile:",
                        profileError
                    );

                    alert(
                        "Couldn't load your profile. Please try again! :("
                    );

                    return;
                }

                const username =
                    profile?.username ||
                    "Unnamed user";

                // =========================
                // CREATE GUESTBOOK ENTRY
                // =========================

                const {
                    error: insertError
                } = await supabaseClient
                    .from("guestbook_entries")
                    .insert({
                        profile_id:
                            profileId,

                        user_id:
                            user.id,

                        author_name:
                            username,

                        message:
                            message,

                        is_anonymous:
                            isAnonymous
                    });

                if (insertError) {
                    console.error(
                        "💥 Guestbook INSERT error:",
                        insertError
                    );

                    alert(
                        `Couldn't sign the guestbook. ${insertError.message}`
                    );

                    return;
                }

                // =========================
                // RESET FORM
                // =========================

                freshMessageInput.value = "";

                if (freshAnonymousCheckbox) {
                    freshAnonymousCheckbox.checked =
                        false;
                }

                await loadGuestbook(
                    profileId
                );

            } catch (error) {
                console.error(
                    "💥 Unexpected guestbook error:",
                    error
                );

                alert(
                    "Something went wrong while signing the guestbook. :("
                );
            }
        }
    );
}


// ======================================
// CREATE PUBLIC GUESTBOOK ENTRY
// ======================================

function createPublicGuestbookEntry(
    entry
) {
    const container =
        document.createElement(
            "div"
        );

    container.className =
        "guestbook-entry";

    let displayName =
        "Anonymous";

    if (!entry.is_anonymous) {
        displayName =
            entry.profiles?.username ||
            entry.profiles?.display_name ||
            "Unknown user";
    }

    // =========================
    // HEADER
    // =========================

    const header =
        document.createElement(
            "div"
        );

    header.className =
        "entry-header";

    const username =
        document.createElement(
            "strong"
        );

    username.textContent =
        entry.is_anonymous
            ? "♡ Anonymous"
            : `♡ ${displayName}`;

    header.appendChild(
        username
    );

    // =========================
    // MESSAGE
    // =========================

    const message =
        document.createElement(
            "p"
        );

    message.textContent =
        entry.message;

    // =========================
    // DATE
    // =========================

    const date =
        document.createElement(
            "small"
        );

    date.className =
        "guestbook-date";

    if (entry.created_at) {
        const createdDate =
            new Date(
                entry.created_at
            );

        date.textContent =
            createdDate.toLocaleString();
    }

    // =========================
    // ASSEMBLE
    // =========================

    container.appendChild(
        header
    );

    container.appendChild(
        message
    );

    container.appendChild(
        date
    );

    return container;
}


// ======================================
// ESCAPE HTML
// ======================================

function escapeHtml(
    value
) {
    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value || "";

    return div.innerHTML;
}


// ======================================
// START PUBLIC PROFILE
// ======================================

const profileParams =
    new URLSearchParams(
        window.location.search
    );

const publicProfileId =
    profileParams.get("id");

if (publicProfileId) {
    loadUserProfile();
} else {
    console.log(
        "🌸 No public profile ID found. Skipping public-profile loader."
    );
}

