// ======================================
// SCRIPT.JS
// ======================================

(() => {
    "use strict";

    const client = window.supabaseClient;

    if (!client) {
        console.error("Supabase client not found.");
        return;
    }

    // ======================================
    // SETTINGS DROPDOWN NAVIGATION
    // ======================================

    const settingsButtons =
        document.querySelectorAll(
            ".settings-group-button"
        );

    settingsButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const groupName =
                button.dataset.settingsGroup;

            const options =
                document.getElementById(
                    `settings-${groupName}`
                );

            const group =
                button.closest(".settings-group");

            if (!options || !group) {
                return;
            }

            const isOpen =
                !options.hidden;

            document
                .querySelectorAll(
                    ".settings-group"
                )
                .forEach((otherGroup) => {
                    const otherOptions =
                        otherGroup.querySelector(
                            ".settings-group-options"
                        );

                    if (otherOptions) {
                        otherOptions.hidden =
                            true;
                    }

                    otherGroup.classList.remove(
                        "open"
                    );
                });

            if (!isOpen) {
                options.hidden = false;
                group.classList.add("open");
            }
        });
    });

    // ======================================
    // EDIT PROFILE
    // ======================================

    const editProfileButton =
        document.getElementById(
            "editProfileButton"
        );

    if (editProfileButton) {
        editProfileButton.addEventListener(
            "click",
            () => {
                window.location.href =
                    "edit-profile.html";
            }
        );
    }

    // ======================================
    // THEME
    // ======================================

    const themeButton =
        document.getElementById(
            "themeButton"
        );

    function updateThemeButton() {
        if (!themeButton) {
            return;
        }

        if (
            document.body.classList.contains(
                "dark-mode"
            )
        ) {
            themeButton.textContent =
                "🌸 Light mode";
        } else {
            themeButton.textContent =
                "🌙 Dark mode";
        }
    }

    function applySavedTheme() {
        const savedTheme =
            localStorage.getItem(
                "theme"
            );

        if (savedTheme === "dark") {
            document.body.classList.add(
                "dark-mode"
            );
        } else {
            document.body.classList.remove(
                "dark-mode"
            );
        }

        updateThemeButton();
    }

    if (themeButton) {
        themeButton.addEventListener(
            "click",
            () => {
                const isDark =
                    document.body.classList.toggle(
                        "dark-mode"
                    );

                localStorage.setItem(
                    "theme",
                    isDark
                        ? "dark"
                        : "light"
                );

                updateThemeButton();
            }
        );
    }

    applySavedTheme();

    // ======================================
    // MANAGE F/Os
    // ======================================

    const manageFosButton =
        document.getElementById(
            "manageFosButton"
        );

    if (manageFosButton) {
        manageFosButton.addEventListener(
            "click",
            () => {
                window.location.href =
                    "fo-manager.html";
            }
        );
    }

    // ======================================
    // DISCOVER
    // ======================================

    const discoverButton =
        document.getElementById(
            "discoverButton"
        );

    if (discoverButton) {
        discoverButton.addEventListener(
            "click",
            () => {
                window.location.href =
                    "discover.html";
            }
        );
    }

    const imageboardButton =
        document.getElementById(
            "imageboardButton"
        );

    if (imageboardButton) {
        imageboardButton.addEventListener(
            "click",
            () => {
                window.location.href =
                    "imageboard.html";
            }
        );
    }

    // ======================================
    // MOOD
    // ======================================

    const moodButton =
        document.getElementById(
            "moodButton"
        );

    const mood =
        document.getElementById(
            "mood"
        );

    const profileMood =
        document.getElementById(
            "profileMood"
        );

    const moods = [
        "🌸 happy!",
        "💭 daydreaming...",
        "🎨 feeling creative!",
        "☕ sleepy...",
        "✨ thinking about my F/O!"
    ];

    let moodIndex = 0;

    if (moodButton) {
        moodButton.addEventListener(
            "click",
            async () => {
                moodIndex++;

                if (
                    moodIndex >=
                    moods.length
                ) {
                    moodIndex = 0;
                }

                const newMood =
                    moods[moodIndex];

                if (mood) {
                    mood.textContent =
                        newMood;
                }

                if (profileMood) {
                    profileMood.textContent =
                        newMood;
                }

                const {
                    data: { user },
                    error: userError
                } =
                    await client.auth.getUser();

                if (userError) {
                    console.error(
                        "Could not get current user:",
                        userError
                    );
                    return;
                }

                if (!user) {
                    console.warn(
                        "No logged-in user."
                    );
                    return;
                }

                const { error } =
                    await client
                        .from("profiles")
                        .update({
                            mood: newMood
                        })
                        .eq(
                            "id",
                            user.id
                        );

                if (error) {
                    console.error(
                        "Mood update error:",
                        error
                    );
                    return;
                }

                console.log(
                    "Mood saved:",
                    newMood
                );
            }
        );
    }

    // ======================================
    // COLLAPSIBLE SECTIONS
    // ======================================

    const sectionTitles =
        document.querySelectorAll(
            ".section-title"
        );

    sectionTitles.forEach((title) => {
        title.addEventListener(
            "click",
            () => {
                const section =
                    title.parentElement;

                if (section) {
                    section.classList.toggle(
                        "collapsed"
                    );
                }
            }
        );
    });

    // ======================================
    // ART GALLERY PREVIEW
    // ======================================

    const artImage =
        document.getElementById(
            "artImage"
        );

    const previousArt =
        document.getElementById(
            "previousArt"
        );

    const nextArt =
        document.getElementById(
            "nextArt"
        );

    const artCounter =
        document.getElementById(
            "artCounter"
        );

    const artCaption =
        document.getElementById(
            "artCaption"
        );

    async function loadProfileGalleryPreview() {
        if (
            !artImage ||
            !previousArt ||
            !nextArt ||
            !artCounter ||
            !artCaption
        ) {
            return;
        }

        const {
            data: { user },
            error: userError
        } =
            await client.auth.getUser();

        if (userError) {
            console.error(
                "Could not get current user:",
                userError
            );
            return;
        }

        if (!user) {
            artCaption.textContent =
                "Please log in to view your gallery. ♡";

            artCounter.textContent =
                "0 / 0";

            previousArt.disabled = true;
            nextArt.disabled = true;

            return;
        }

        const {
            data: gallery,
            error
        } =
            await client
                .from("gallery_items")
                .select(
                    "id, user_id, image_url, title, description, created_at"
                )
                .eq(
                    "user_id",
                    user.id
                )
                .eq(
                    "is_hidden",
                    false
                )
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );

        if (error) {
            console.error(
                "Profile gallery loading error:",
                error
            );

            artImage.removeAttribute(
                "src"
            );

            artCaption.textContent =
                "Couldn't load your gallery. :(";

            artCounter.textContent =
                "0 / 0";

            previousArt.disabled = true;
            nextArt.disabled = true;

            return;
        }

        const artwork =
            gallery || [];

        let currentArt = 0;

        function showArt() {
            if (
                artwork.length === 0
            ) {
                artImage.removeAttribute(
                    "src"
                );

                artImage.alt =
                    "No artwork";

                artCaption.textContent =
                    "No artwork uploaded yet! 🌸";

                artCounter.textContent =
                    "0 / 0";

                previousArt.disabled = true;
                nextArt.disabled = true;

                return;
            }

            const currentArtwork =
                artwork[currentArt];

            artImage.src =
                currentArtwork.image_url;

            artImage.alt =
                currentArtwork.title ||
                "Gallery artwork";

            artCaption.textContent =
                currentArtwork.title ||
                currentArtwork.description ||
                "♡";

            artCounter.textContent =
                `${currentArt + 1} / ${artwork.length}`;

            previousArt.disabled =
                artwork.length <= 1;

            nextArt.disabled =
                artwork.length <= 1;
        }

        previousArt.addEventListener(
            "click",
            () => {
                if (
                    artwork.length === 0
                ) {
                    return;
                }

                currentArt--;

                if (
                    currentArt < 0
                ) {
                    currentArt =
                        artwork.length - 1;
                }

                showArt();
            }
        );

        nextArt.addEventListener(
            "click",
            () => {
                if (
                    artwork.length === 0
                ) {
                    return;
                }

                currentArt++;

                if (
                    currentArt >=
                    artwork.length
                ) {
                    currentArt = 0;
                }

                showArt();
            }
        );

        showArt();

        const gallerySection =
            artImage.closest(
                ".art-gallery"
            );

        if (gallerySection) {
            let viewGalleryButton =
                document.getElementById(
                    "viewFullGalleryButton"
                );

            if (!viewGalleryButton) {
                viewGalleryButton =
                    document.createElement(
                        "a"
                    );

                viewGalleryButton.id =
                    "viewFullGalleryButton";

                viewGalleryButton.className =
                    "gallery-preview-link";

                viewGalleryButton.textContent =
                    "✨ View Full Gallery";

                artCounter.insertAdjacentElement(
                    "afterend",
                    viewGalleryButton
                );
            }

            viewGalleryButton.href =
                `gallery.html?user=${encodeURIComponent(
                    user.id
                )}`;
        }
    }

    loadProfileGalleryPreview();

    // ======================================
    // GUESTBOOK
    // ======================================

    const guestMessage =
        document.getElementById(
            "guestMessage"
        );

    const guestAnonymous =
        document.getElementById(
            "guestAnonymous"
        );

    const guestbookForm =
        document.getElementById(
            "guestbookForm"
        );

    const guestbookEntries =
        document.getElementById(
            "guestbookEntries"
        );

    const guestbookIdentity =
        document.getElementById(
            "guestbookIdentity"
        );

    // ======================================
    // GUESTBOOK UX STATUS
    // ======================================

    function getGuestbookStatusElement() {
        if (!guestbookForm) {
            return null;
        }

        let status =
            document.getElementById(
                "guestbookStatus"
            );

        if (!status) {
            status =
                document.createElement(
                    "p"
                );

            status.id =
                "guestbookStatus";

            status.className =
                "guestbook-status";

            status.setAttribute(
                "role",
                "status"
            );

            status.setAttribute(
                "aria-live",
                "polite"
            );

            guestbookForm.insertAdjacentElement(
                "afterend",
                status
            );
        }

        return status;
    }

    function setGuestbookStatus(
        message,
        type = "info"
    ) {
        const status =
            getGuestbookStatusElement();

        if (!status) {
            return;
        }

        status.textContent =
            message;

        status.dataset.status =
            type;

        status.hidden =
            !message;
    }

    function clearGuestbookStatus() {
        const status =
            document.getElementById(
                "guestbookStatus"
            );

        if (!status) {
            return;
        }

        status.textContent = "";
        status.hidden = true;
        delete status.dataset.status;
    }

    // ======================================
    // GUESTBOOK ERROR UX
    // ======================================

    function getGuestbookErrorMessage(
        error,
        action = "sign"
    ) {
        if (!error) {
            return `Couldn't ${action} the guestbook. Please try again. :(`;
        }

        console.error(
            `Guestbook ${action} error details:`,
            {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            }
        );

        if (
            error.code === "42501" ||
            error.code === "401"
        ) {
            return (
                action === "reply"
                    ? "You can't reply to guestbook messages right now. You may have a temporary guestbook restriction.♡"
                    : "You can't sign guestbooks right now. You may have a temporary guestbook restriction.♡"
            );
        }

        if (
            error.code === "23505"
        ) {
            return (
                action === "reply"
                    ? "It looks like this reply was already sent. ♡"
                    : "It looks like this guestbook message was already sent. ♡"
            );
        }

        if (
            error.code === "23503"
        ) {
            return (
                action === "reply"
                    ? "That guestbook message no longer exists, so the reply couldn't be posted. :("
                    : "That guestbook entry couldn't be created because the profile isn't available. :("
            );
        }

        return (
            action === "reply"
                ? "Couldn't save your reply. Please try again. :("
                : "Couldn't sign the guestbook. Please try again. :("
        );
    }

    // ======================================
    // CURRENT USER
    // ======================================

    async function getCurrentUser() {
        const {
            data: { user },
            error
        } =
            await client.auth.getUser();

        if (error) {
            console.error(
                "Guestbook auth error:",
                error
            );

            return null;
        }

        return user || null;
    }

    // ======================================
    // GET USER PROFILE
    // ======================================

    async function getCurrentUserProfile(
        userId
    ) {
        if (!userId) {
            return null;
        }

        const {
            data: profile,
            error
        } =
            await client
                .from("profiles")
                .select(
                    "id, username, display_name"
                )
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();

        if (error) {
            console.error(
                "Guestbook profile error:",
                error
            );

            return null;
        }

        return profile;
    }

    // ======================================
    // UPDATE GUESTBOOK IDENTITY
    // ======================================

    async function updateGuestbookIdentity() {
        if (!guestbookIdentity) {
            return;
        }

        const user =
            await getCurrentUser();

        const submitButton =
            guestbookForm?.querySelector(
                'button[type="submit"]'
            );

        if (!user) {
            guestbookIdentity.textContent =
                "You need to be logged in to sign the guestbook. ♡";

            if (submitButton) {
                submitButton.disabled =
                    true;
            }

            if (guestAnonymous) {
                guestAnonymous.disabled =
                    true;
            }

            setGuestbookStatus(
                "Log in to leave messages or replies. ♡",
                "info"
            );

            return;
        }

        const profile =
            await getCurrentUserProfile(
                user.id
            );

        if (!profile) {
            guestbookIdentity.textContent =
                "Couldn't load your profile. :(";

            if (submitButton) {
                submitButton.disabled =
                    true;
            }

            if (guestAnonymous) {
                guestAnonymous.disabled =
                    true;
            }

            setGuestbookStatus(
                "Your profile couldn't be loaded, so guestbook posting is temporarily unavailable. :(",
                "error"
            );

            return;
        }

        const currentName =
            profile.display_name ||
            profile.username ||
            "Unnamed user";

        guestbookIdentity.textContent =
            `Posting as: ${currentName} ♡`;

        if (submitButton) {
            submitButton.disabled =
                false;
        }

        if (guestAnonymous) {
            guestAnonymous.disabled =
                false;
        }

        clearGuestbookStatus();
    }

    // ======================================
    // CREATE REPLY FORM
    // ======================================

    function createReplyForm(
        entryElement,
        entryId
    ) {
        if (
            !entryElement ||
            !entryId
        ) {
            return;
        }

        if (
            entryElement.querySelector(
                ".reply-form"
            )
        ) {
            return;
        }

        const replyForm =
            document.createElement(
                "div"
            );

        replyForm.className =
            "reply-form";

        const replyText =
            document.createElement(
                "textarea"
            );

        replyText.placeholder =
            "Write your reply...";

        replyText.rows = 3;
        replyText.maxLength = 1000;

        const anonymousLabel =
            document.createElement(
                "label"
            );

        anonymousLabel.className =
            "guestbook-anonymous-option";

        const anonymousCheckbox =
            document.createElement(
                "input"
            );

        anonymousCheckbox.type =
            "checkbox";

        const anonymousText =
            document.createElement(
                "span"
            );

        anonymousText.textContent =
            "Reply anonymously 🫥";

        anonymousLabel.appendChild(
            anonymousCheckbox
        );

        anonymousLabel.appendChild(
            anonymousText
        );

        const replySubmit =
            document.createElement(
                "button"
            );

        replySubmit.type = "button";
        replySubmit.textContent =
            "Reply ♡";

        const replyCancel =
            document.createElement(
                "button"
            );

        replyCancel.type = "button";
        replyCancel.textContent =
            "Cancel";

        replyForm.appendChild(
            replyText
        );

        replyForm.appendChild(
            anonymousLabel
        );

        replyForm.appendChild(
            replySubmit
        );

        replyForm.appendChild(
            replyCancel
        );

        entryElement.appendChild(
            replyForm
        );

        // ==================================
        // CANCEL
        // ==================================

        replyCancel.addEventListener(
            "click",
            () => {
                replyForm.remove();
            }
        );

        // ==================================
        // SUBMIT REPLY
        // ==================================

        replySubmit.addEventListener(
            "click",
            async () => {
                const message =
                    replyText.value.trim();

                if (!message) {
                    alert(
                        "Please write a reply first! ♡"
                    );
                    return;
                }

                const user =
                    await getCurrentUser();

                if (!user) {
                    alert(
                        "You need to be logged in to reply. ♡"
                    );
                    return;
                }

                const profile =
                    await getCurrentUserProfile(
                        user.id
                    );

                if (!profile) {
                    alert(
                        "Couldn't load your profile. :("
                    );
                    return;
                }

                const authorName =
                    profile.display_name ||
                    profile.username ||
                    "Unnamed user";

                replySubmit.disabled =
                    true;

                replySubmit.textContent =
                    "Replying... ♡";

                setGuestbookStatus(
                    "Sending your reply... 🌸",
                    "loading"
                );

                try {
                    const {
                        error
                    } =
                        await client
                            .from(
                                "guestbook_replies"
                            )
                            .insert({
                                entry_id:
                                    entryId,

                                user_id:
                                    user.id,

                                author_name:
                                    authorName,

                                message:
                                    message,

                                is_anonymous:
                                    anonymousCheckbox.checked
                            });

                    if (error) {
                        const friendlyMessage =
                            getGuestbookErrorMessage(
                                error,
                                "reply"
                            );

                        setGuestbookStatus(
                            friendlyMessage,
                            "error"
                        );

                        return;
                    }

                    setGuestbookStatus(
                        "Reply posted! ♡",
                        "success"
                    );

                    replyForm.remove();

                    await loadGuestbook();

                } catch (error) {
                    console.error(
                        "Unexpected guestbook reply error:",
                        error
                    );

                    setGuestbookStatus(
                        "Something went wrong while posting your reply. Please try again. :(",
                        "error"
                    );

                } finally {
                    replySubmit.disabled =
                        false;

                    replySubmit.textContent =
                        "Reply ♡";
                }
            }
        );
    }

    // ======================================
    // CREATE GUESTBOOK ENTRY
    // ======================================

    function createGuestbookEntry(
        entry,
        replies
    ) {
        const entryElement =
            document.createElement(
                "div"
            );

        entryElement.className =
            "guestbook-entry";

        // ==================================
        // HEADER
        // ==================================

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

        const displayedName =
            entry.is_anonymous
                ? "Anonymous"
                : (
                    entry.author_name ||
                    "Unnamed user"
                );

        username.textContent =
            `♡ ${displayedName}`;

        header.appendChild(
            username
        );

        // ==================================
        // DATE
        // ==================================

        const date =
            document.createElement(
                "small"
            );

        const createdDate =
            new Date(
                entry.created_at
            );

        date.textContent =
            Number.isNaN(
                createdDate.getTime()
            )
                ? ""
                : createdDate.toLocaleString();

        header.appendChild(
            date
        );

        // ==================================
        // MESSAGE
        // ==================================

        const messageText =
            document.createElement(
                "p"
            );

        messageText.textContent =
            entry.message || "";

        // ==================================
        // REPLY BUTTON
        // ==================================

        const replyButton =
            document.createElement(
                "button"
            );

        replyButton.type = "button";

        replyButton.className =
            "reply-button";

        replyButton.textContent =
            "↩ Reply";

        // ==================================
        // REPLIES
        // ==================================

        const repliesContainer =
            document.createElement(
                "div"
            );

        repliesContainer.className =
            "replies";

        (replies || []).forEach(
            (reply) => {
                const replyElement =
                    document.createElement(
                        "div"
                    );

                replyElement.className =
                    "reply";

                const replyUsername =
                    document.createElement(
                        "strong"
                    );

                const displayedReplyName =
                    reply.is_anonymous
                        ? "Anonymous"
                        : (
                            reply.author_name ||
                            "Unnamed user"
                        );

                replyUsername.textContent =
                    `↳ ${displayedReplyName}`;

                const replyMessage =
                    document.createElement(
                        "p"
                    );

                replyMessage.textContent =
                    reply.message || "";

                const replyDate =
                    document.createElement(
                        "small"
                    );

                const replyCreatedDate =
                    new Date(
                        reply.created_at
                    );

                replyDate.textContent =
                    Number.isNaN(
                        replyCreatedDate.getTime()
                    )
                        ? ""
                        : replyCreatedDate.toLocaleString();

                replyElement.appendChild(
                    replyUsername
                );

                replyElement.appendChild(
                    replyMessage
                );

                replyElement.appendChild(
                    replyDate
                );

                repliesContainer.appendChild(
                    replyElement
                );
            }
        );

        // ==================================
        // BUILD ENTRY
        // ==================================

        entryElement.appendChild(
            header
        );

        entryElement.appendChild(
            messageText
        );

        entryElement.appendChild(
            replyButton
        );

        entryElement.appendChild(
            repliesContainer
        );

        replyButton.addEventListener(
            "click",
            async () => {
                const user =
                    await getCurrentUser();

                if (!user) {
                    alert(
                        "You need to be logged in to reply. ♡"
                    );
                    return;
                }

                createReplyForm(
                    entryElement,
                    entry.id
                );
            }
        );

        return entryElement;
    }

    // ======================================
    // LOAD GUESTBOOK
    // ======================================

    async function loadGuestbook() {
        if (!guestbookEntries) {
            return;
        }

        const {
            data: { user },
            error: userError
        } =
            await client.auth.getUser();

        if (userError) {
            console.error(
                "Guestbook auth error:",
                userError
            );
        }

        if (!user) {
            guestbookEntries.innerHTML =
                "<p>Please log in to view your guestbook. ♡</p>";

            return;
        }

        const profileId =
            user.id;

        guestbookEntries.innerHTML =
            "<p>Loading messages... 🌸</p>";

        const {
            data: entries,
            error: entriesError
        } =
            await client
                .from(
                    "guestbook_entries"
                )
                .select(
                    "id, profile_id, user_id, author_name, message, is_anonymous, created_at"
                )
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

        if (entriesError) {
            console.error(
                "Guestbook loading error:",
                entriesError
            );

            guestbookEntries.innerHTML =
                "<p>Couldn't load the guestbook. :(</p>";

            return;
        }

        if (
            !entries ||
            entries.length === 0
        ) {
            guestbookEntries.innerHTML =
                "<p>No messages yet! Be the first to leave one. ♡</p>";

            return;
        }

        guestbookEntries.innerHTML =
            "";

        // ==================================
        // LOAD REPLIES
        // ==================================

        const entryIds =
            entries.map(
                (entry) =>
                    entry.id
            );

        let replies = [];

        if (
            entryIds.length > 0
        ) {
            const {
                data: replyData,
                error: repliesError
            } =
                await client
                    .from(
                        "guestbook_replies"
                    )
                    .select(
                        "id, entry_id, user_id, author_name, message, is_anonymous, created_at"
                    )
                    .in(
                        "entry_id",
                        entryIds
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    );

            if (repliesError) {
                console.error(
                    "Guestbook replies loading error:",
                    repliesError
                );
            } else {
                replies =
                    replyData || [];
            }
        }

        // ==================================
        // DISPLAY ENTRIES
        // ==================================

        entries.forEach(
            (entry) => {
                const entryReplies =
                    replies.filter(
                        (reply) =>
                            reply.entry_id ===
                            entry.id
                    );

                const entryElement =
                    createGuestbookEntry(
                        entry,
                        entryReplies
                    );

                guestbookEntries.appendChild(
                    entryElement
                );
            }
        );
    }

    // ======================================
    // SIGN GUESTBOOK
    // ======================================

    if (
        guestbookForm &&
        guestMessage &&
        guestbookEntries
    ) {
        guestbookForm.addEventListener(
            "submit",
            async (event) => {
                event.preventDefault();

                const message =
                    guestMessage.value.trim();

                if (!message) {
                    alert(
                        "Please write a little message first! ♡"
                    );
                    return;
                }

                const {
                    data: { user },
                    error: userError
                } =
                    await client.auth.getUser();

                if (
                    userError ||
                    !user
                ) {
                    setGuestbookStatus(
                        "You need to be logged in to sign the guestbook. ♡",
                        "error"
                    );

                    alert(
                        "You need to be logged in to sign the guestbook. ♡"
                    );

                    return;
                }

                const profile =
                    await getCurrentUserProfile(
                        user.id
                    );

                if (!profile) {
                    setGuestbookStatus(
                        "Couldn't load your profile. Please try again. :(",
                        "error"
                    );

                    alert(
                        "Couldn't load your profile. Please try again. :("
                    );

                    return;
                }

                const authorName =
                    profile.display_name ||
                    profile.username ||
                    "Unnamed user";

                const submitButton =
                    guestbookForm.querySelector(
                        'button[type="submit"]'
                    );

                if (submitButton) {
                    submitButton.disabled =
                        true;

                    submitButton.textContent =
                        "Signing... ♡";
                }

                setGuestbookStatus(
                    "Signing the guestbook... 🌸",
                    "loading"
                );

                try {
                    const {
                        error
                    } =
                        await client
                            .from(
                                "guestbook_entries"
                            )
                            .insert({
                                profile_id:
                                    user.id,

                                user_id:
                                    user.id,

                                author_name:
                                    authorName,

                                message:
                                    message,

                                is_anonymous:
                                    guestAnonymous
                                        ? guestAnonymous.checked
                                        : false
                            });

                    if (error) {
                        const friendlyMessage =
                            getGuestbookErrorMessage(
                                error,
                                "sign"
                            );

                        setGuestbookStatus(
                            friendlyMessage,
                            "error"
                        );

                        return;
                    }

                    guestMessage.value =
                        "";

                    if (
                        guestAnonymous
                    ) {
                        guestAnonymous.checked =
                            false;
                    }

                    setGuestbookStatus(
                        "Your guestbook message was posted! ♡",
                        "success"
                    );

                    await loadGuestbook();

                } catch (error) {
                    console.error(
                        "Unexpected guestbook error:",
                        error
                    );

                    setGuestbookStatus(
                        "Something went wrong while signing the guestbook. Please try again. :(",
                        "error"
                    );

                } finally {
                    if (submitButton) {
                        submitButton.disabled =
                            false;

                        submitButton.textContent =
                            "Sign Guestbook ♡";
                    }
                }
            }
        );
    }

    // ======================================
    // START GUESTBOOK
    // ======================================

    updateGuestbookIdentity();
    loadGuestbook();

    // ======================================
    // LOG OUT
    // ======================================

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );

    if (logoutButton) {
        logoutButton.addEventListener(
            "click",
            async () => {
                const { error } =
                    await client.auth.signOut();

                if (error) {
                    console.error(
                        "Logout error:",
                        error
                    );

                    alert(
                        "Oops! Couldn't log you out."
                    );

                    return;
                }

                window.location.href =
                    "account.html";
            }
        );
    }
})();