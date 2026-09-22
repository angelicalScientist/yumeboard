const client = window.supabaseClient;


// ============================================================
// ELEMENTS
// ============================================================

const moderationSearchForm =
    document.getElementById("moderationSearchForm");

const moderationSearch =
    document.getElementById("moderationSearch");

const moderationType =
    document.getElementById("moderationType");

const moderationVisibility =
    document.getElementById("moderationVisibility");

const moderationResults =
    document.getElementById("moderationResults");

const moderationMessage =
    document.getElementById("moderationMessage");


// ============================================================
// AUTH
// ============================================================

async function checkModerator() {
    const {
        data: { user },
        error: authError
    } = await client.auth.getUser();

    if (authError || !user) {
        window.location.href = "index.html";
        return false;
    }

    const {
        data: isModerator,
        error: moderatorError
    } = await client.rpc("is_moderator");

    if (moderatorError) {
        console.error("Moderator check failed:", moderatorError);
        window.location.href = "index.html";
        return false;
    }

    if (!isModerator) {
        window.location.href = "index.html";
        return false;
    }

    return true;
}


// ============================================================
// GENERAL HELPERS
// ============================================================

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatMultilineText(value) {
    return escapeHtml(value || "")
        .replace(/\n/g, "<br>");
}


function formatDate(value) {
    if (!value) {
        return "Unknown date";
    }

    return new Date(value).toLocaleString();
}


function getVisibilityFilter() {
    const visibility = moderationVisibility.value;

    if (visibility === "visible") {
        return false;
    }

    if (visibility === "hidden") {
        return true;
    }

    return null;
}


function applyVisibilityFilter(query) {
    const visibility = getVisibilityFilter();

    if (visibility === null) {
        return query;
    }

    return query.eq("is_hidden", visibility);
}


function mergeUniqueResults(...groups) {
    const map = new Map();

    for (const group of groups) {
        for (const item of group) {
            const key = `${item.targetType}:${item.id}`;

            if (!map.has(key)) {
                map.set(key, item);
            }
        }
    }

    return Array.from(map.values());
}


function createUsernameMap(users) {
    const map = new Map();

    for (const user of users) {
        map.set(user.id, user.username || "Unknown user");
    }

    return map;
}


function getDisplayedUsername(item, usernameMap) {
    if (item.is_anonymous) {
        return "Anonymous";
    }

    if (item.author_name) {
        return item.author_name;
    }

    return usernameMap.get(item.user_id) || "Unknown user";
}


// ============================================================
// USERNAME SEARCH
// ============================================================

async function findMatchingUsers(searchTerm) {
    if (!searchTerm) {
        return [];
    }

    const {
        data,
        error
    } = await client
        .from("profiles")
        .select("id, username")
        .ilike("username", `%${searchTerm}%`)
        .limit(100);

    if (error) {
        throw error;
    }

    return data || [];
}


// ============================================================
// IMAGEBOARD THREAD SEARCH
// ============================================================

async function searchThreadsByTitle(searchTerm) {
    if (!searchTerm) {
        return [];
    }

    let query = client
        .from("threads")
        .select(`
            id,
            board_id,
            user_id,
            title,
            created_at,
            last_post_at,
            is_locked,
            is_archived,
            is_hidden,
            boards (
                name,
                slug
            )
        `)
        .ilike("title", `%${searchTerm}%`)
        .order("last_post_at", { ascending: false })
        .limit(100);

    query = applyVisibilityFilter(query);

    const {
        data,
        error
    } = await query;

    if (error) {
        throw error;
    }

    return (data || []).map(thread => ({
        ...thread,
        targetType: "imageboard_thread"
    }));
}


async function searchThreadsByUserIds(userIds) {
    if (!userIds.length) {
        return [];
    }

    let query = client
        .from("threads")
        .select(`
            id,
            board_id,
            user_id,
            title,
            created_at,
            last_post_at,
            is_locked,
            is_archived,
            is_hidden,
            boards (
                name,
                slug
            )
        `)
        .in("user_id", userIds)
        .order("last_post_at", { ascending: false })
        .limit(100);

    query = applyVisibilityFilter(query);

    const {
        data,
        error
    } = await query;

    if (error) {
        throw error;
    }

    return (data || []).map(thread => ({
        ...thread,
        targetType: "imageboard_thread"
    }));
}


// ============================================================
// IMAGEBOARD POST SEARCH
// ============================================================

async function searchPostsByContent(searchTerm) {
    if (!searchTerm) {
        return [];
    }

    let query = client
        .from("posts")
        .select(`
            id,
            thread_id,
            user_id,
            content,
            created_at,
            is_anonymous,
            is_hidden,
            threads (
                id,
                title,
                is_hidden
            )
        `)
        .ilike("content", `%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(100);

    query = applyVisibilityFilter(query);

    const {
        data,
        error
    } = await query;

    if (error) {
        throw error;
    }

    return (data || []).map(post => ({
        ...post,
        targetType: "imageboard_post"
    }));
}


async function searchPostsByUserIds(userIds) {
    if (!userIds.length) {
        return [];
    }

    let query = client
        .from("posts")
        .select(`
            id,
            thread_id,
            user_id,
            content,
            created_at,
            is_anonymous,
            is_hidden,
            threads (
                id,
                title,
                is_hidden
            )
        `)
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(100);

    query = applyVisibilityFilter(query);

    const {
        data,
        error
    } = await query;

    if (error) {
        throw error;
    }

    return (data || []).map(post => ({
        ...post,
        targetType: "imageboard_post"
    }));
}


// ============================================================
// GALLERY SEARCH
// Confirmed columns:
// id, user_id, title, description, created_at, is_hidden...
// ============================================================

async function searchGalleryByText(searchTerm) {
    if (!searchTerm) {
        return [];
    }

    let titleQuery = client
        .from("gallery_items")
        .select("*")
        .ilike("title", `%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(100);

    titleQuery = applyVisibilityFilter(titleQuery);

    let descriptionQuery = client
        .from("gallery_items")
        .select("*")
        .ilike("description", `%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(100);

    descriptionQuery = applyVisibilityFilter(descriptionQuery);

    const [
        titleResult,
        descriptionResult
    ] = await Promise.all([
        titleQuery,
        descriptionQuery
    ]);

    if (titleResult.error) {
        throw titleResult.error;
    }

    if (descriptionResult.error) {
        throw descriptionResult.error;
    }

    const titleResults = (titleResult.data || []).map(item => ({
        ...item,
        targetType: "gallery_item"
    }));

    const descriptionResults = (descriptionResult.data || []).map(item => ({
        ...item,
        targetType: "gallery_item"
    }));

    return mergeUniqueResults(
        titleResults,
        descriptionResults
    );
}


async function searchGalleryByUserIds(userIds) {
    if (!userIds.length) {
        return [];
    }

    let query = client
        .from("gallery_items")
        .select("*")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(100);

    query = applyVisibilityFilter(query);

    const {
        data,
        error
    } = await query;

    if (error) {
        throw error;
    }

    return (data || []).map(item => ({
        ...item,
        targetType: "gallery_item"
    }));
}


// ============================================================
// GUESTBOOK ENTRY SEARCH
//
// Confirmed columns:
// id
// profile_id
// user_id
// author_name
// message
// is_anonymous
// created_at
// is_hidden
// ============================================================

async function searchGuestbookEntriesByText(searchTerm) {
    if (!searchTerm) {
        return [];
    }

    let messageQuery = client
        .from("guestbook_entries")
        .select("*")
        .ilike("message", `%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(100);

    messageQuery = applyVisibilityFilter(messageQuery);

    let authorQuery = client
        .from("guestbook_entries")
        .select("*")
        .ilike("author_name", `%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(100);

    authorQuery = applyVisibilityFilter(authorQuery);

    const [
        messageResult,
        authorResult
    ] = await Promise.all([
        messageQuery,
        authorQuery
    ]);

    if (messageResult.error) {
        throw messageResult.error;
    }

    if (authorResult.error) {
        throw authorResult.error;
    }

    const messageResults = (messageResult.data || []).map(entry => ({
        ...entry,
        targetType: "guestbook_entry"
    }));

    const authorResults = (authorResult.data || []).map(entry => ({
        ...entry,
        targetType: "guestbook_entry"
    }));

    return mergeUniqueResults(
        messageResults,
        authorResults
    );
}


async function searchGuestbookEntriesByUserIds(userIds) {
    if (!userIds.length) {
        return [];
    }

    let userQuery = client
        .from("guestbook_entries")
        .select("*")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(100);

    userQuery = applyVisibilityFilter(userQuery);

    let profileQuery = client
        .from("guestbook_entries")
        .select("*")
        .in("profile_id", userIds)
        .order("created_at", { ascending: false })
        .limit(100);

    profileQuery = applyVisibilityFilter(profileQuery);

    const [
        userResult,
        profileResult
    ] = await Promise.all([
        userQuery,
        profileQuery
    ]);

    if (userResult.error) {
        throw userResult.error;
    }

    if (profileResult.error) {
        throw profileResult.error;
    }

    const userResults = (userResult.data || []).map(entry => ({
        ...entry,
        targetType: "guestbook_entry"
    }));

    const profileResults = (profileResult.data || []).map(entry => ({
        ...entry,
        targetType: "guestbook_entry"
    }));

    return mergeUniqueResults(
        userResults,
        profileResults
    );
}


// ============================================================
// GUESTBOOK REPLY SEARCH
//
// Confirmed columns:
// id
// entry_id
// user_id
// author_name
// message
// is_anonymous
// created_at
// is_hidden
// ============================================================

async function searchGuestbookRepliesByText(searchTerm) {
    if (!searchTerm) {
        return [];
    }

    let messageQuery = client
        .from("guestbook_replies")
        .select("*")
        .ilike("message", `%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(100);

    messageQuery = applyVisibilityFilter(messageQuery);

    let authorQuery = client
        .from("guestbook_replies")
        .select("*")
        .ilike("author_name", `%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(100);

    authorQuery = applyVisibilityFilter(authorQuery);

    const [
        messageResult,
        authorResult
    ] = await Promise.all([
        messageQuery,
        authorQuery
    ]);

    if (messageResult.error) {
        throw messageResult.error;
    }

    if (authorResult.error) {
        throw authorResult.error;
    }

    const messageResults = (messageResult.data || []).map(reply => ({
        ...reply,
        targetType: "guestbook_reply"
    }));

    const authorResults = (authorResult.data || []).map(reply => ({
        ...reply,
        targetType: "guestbook_reply"
    }));

    return mergeUniqueResults(
        messageResults,
        authorResults
    );
}


async function searchGuestbookRepliesByUserIds(userIds) {
    if (!userIds.length) {
        return [];
    }

    let query = client
        .from("guestbook_replies")
        .select("*")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(100);

    query = applyVisibilityFilter(query);

    const {
        data,
        error
    } = await query;

    if (error) {
        throw error;
    }

    return (data || []).map(reply => ({
        ...reply,
        targetType: "guestbook_reply"
    }));
}


// ============================================================
// SEARCH ALL CONTENT
// ============================================================

async function searchAllContent(searchTerm, matchingUserIds) {
    const searches = [];

    if (searchTerm) {
        searches.push(
            searchThreadsByTitle(searchTerm),
            searchPostsByContent(searchTerm),
            searchGalleryByText(searchTerm),
            searchGuestbookEntriesByText(searchTerm),
            searchGuestbookRepliesByText(searchTerm)
        );
    }

    if (matchingUserIds.length) {
        searches.push(
            searchThreadsByUserIds(matchingUserIds),
            searchPostsByUserIds(matchingUserIds),
            searchGalleryByUserIds(matchingUserIds),
            searchGuestbookEntriesByUserIds(matchingUserIds),
            searchGuestbookRepliesByUserIds(matchingUserIds)
        );
    }

    if (!searches.length) {
        return [];
    }

    const results = await Promise.all(searches);

    return mergeUniqueResults(...results);
}


// ============================================================
// SEARCH SPECIFIC CONTENT TYPE
// ============================================================

async function searchContent(searchTerm, matchingUserIds, type) {
    if (type === "imageboard_thread") {
        const results = [];

        if (searchTerm) {
            results.push(
                await searchThreadsByTitle(searchTerm)
            );
        }

        if (matchingUserIds.length) {
            results.push(
                await searchThreadsByUserIds(matchingUserIds)
            );
        }

        return mergeUniqueResults(...results);
    }


    if (type === "imageboard_post") {
        const results = [];

        if (searchTerm) {
            results.push(
                await searchPostsByContent(searchTerm)
            );
        }

        if (matchingUserIds.length) {
            results.push(
                await searchPostsByUserIds(matchingUserIds)
            );
        }

        return mergeUniqueResults(...results);
    }


    if (type === "gallery_item") {
        const results = [];

        if (searchTerm) {
            results.push(
                await searchGalleryByText(searchTerm)
            );
        }

        if (matchingUserIds.length) {
            results.push(
                await searchGalleryByUserIds(matchingUserIds)
            );
        }

        return mergeUniqueResults(...results);
    }


    if (type === "guestbook_entry") {
        const results = [];

        if (searchTerm) {
            results.push(
                await searchGuestbookEntriesByText(searchTerm)
            );
        }

        if (matchingUserIds.length) {
            results.push(
                await searchGuestbookEntriesByUserIds(
                    matchingUserIds
                )
            );
        }

        return mergeUniqueResults(...results);
    }


    if (type === "guestbook_reply") {
        const results = [];

        if (searchTerm) {
            results.push(
                await searchGuestbookRepliesByText(searchTerm)
            );
        }

        if (matchingUserIds.length) {
            results.push(
                await searchGuestbookRepliesByUserIds(
                    matchingUserIds
                )
            );
        }

        return mergeUniqueResults(...results);
    }


    return [];
}


// ============================================================
// RENDER RESULTS
// ============================================================

function renderResult(item, usernameMap) {
    const username = getDisplayedUsername(
        item,
        usernameMap
    );

    const hiddenLabel = item.is_hidden
        ? `
            <span class="moderation-hidden-label">
                Hidden
            </span>
        `
        : "";


    let title = "";
    let content = "";


    // --------------------------------------------------------
    // IMAGEBOARD THREAD
    // --------------------------------------------------------

    if (item.targetType === "imageboard_thread") {
        title = `Thread: ${item.title || "Untitled thread"}`;

        content = `
            <p>
                <strong>Board:</strong>
                ${escapeHtml(
                    item.boards?.name || "Unknown board"
                )}
            </p>

            <p>
                <strong>Last activity:</strong>
                ${escapeHtml(
                    formatDate(item.last_post_at)
                )}
            </p>

            ${
                item.is_locked
                    ? "<p><strong>Locked</strong></p>"
                    : ""
            }

            ${
                item.is_archived
                    ? "<p><strong>Archived</strong></p>"
                    : ""
            }
        `;
    }


    // --------------------------------------------------------
    // IMAGEBOARD POST
    // --------------------------------------------------------

    if (item.targetType === "imageboard_post") {
        title = `
            Post in:
            ${item.threads?.title || "Unknown thread"}
        `;

        content = `
            <p>
                ${formatMultilineText(
                    item.content || "(No text)"
                )}
            </p>
        `;
    }


    // --------------------------------------------------------
    // GALLERY ITEM
    // --------------------------------------------------------

    if (item.targetType === "gallery_item") {
        title = `
            Gallery item:
            ${item.title || "Untitled"}
        `;

        content = `
            <p>
                ${formatMultilineText(
                    item.description || "(No description)"
                )}
            </p>
        `;
    }


    // --------------------------------------------------------
    // GUESTBOOK ENTRY
    // --------------------------------------------------------

    if (item.targetType === "guestbook_entry") {
        title = "Guestbook entry";

        content = `
            <p>
                ${formatMultilineText(
                    item.message || "(No message)"
                )}
            </p>
        `;
    }


    // --------------------------------------------------------
    // GUESTBOOK REPLY
    // --------------------------------------------------------

    if (item.targetType === "guestbook_reply") {
        title = "Guestbook reply";

        content = `
            <p>
                ${formatMultilineText(
                    item.message || "(No message)"
                )}
            </p>
        `;
    }


    return `
        <article class="moderation-result">

            <div class="moderation-result-header">

                <div>

                    <h3>
                        ${escapeHtml(title)}
                    </h3>

                    <p>
                        <strong>User:</strong>
                        ${escapeHtml(username)}
                    </p>

                    <p>
                        <strong>Created:</strong>
                        ${escapeHtml(
                            formatDate(item.created_at)
                        )}
                    </p>

                </div>

                <div>
                    ${hiddenLabel}
                </div>

            </div>


            <div class="moderation-result-content">
                ${content}
            </div>


            <div class="moderation-result-actions">

                <button
                    type="button"
                    class="moderation-hide-button"
                    data-target-type="${escapeHtml(
                        item.targetType
                    )}"
                    data-target-id="${escapeHtml(
                        item.id
                    )}"
                >
                    Hide
                </button>


                <button
                    type="button"
                    class="moderation-delete-button"
                    data-target-type="${escapeHtml(
                        item.targetType
                    )}"
                    data-target-id="${escapeHtml(
                        item.id
                    )}"
                >
                    Delete
                </button>

            </div>

        </article>
    `;
}


function renderResults(results, usernameMap) {
    if (!results.length) {
        moderationResults.innerHTML = `
            <p>
                No matching content found. ♡
            </p>
        `;

        return;
    }


    moderationResults.innerHTML = results
        .map(item =>
            renderResult(item, usernameMap)
        )
        .join("");


    attachModerationButtons();
}


// ============================================================
// HIDE CONTENT
// ============================================================

async function hideContent(targetType, targetId) {
    const reason = prompt(
        "Optional internal moderation reason:\n\n" +
        "Leave blank if you don't need one."
    );

    if (reason === null) {
        return false;
    }


    const {
        error
    } = await client.rpc(
        "moderator_hide_content",
        {
            p_target_type: targetType,
            p_target_id: targetId,
            p_reason: reason.trim() || null
        }
    );


    if (error) {
        throw error;
    }


    return true;
}


// ============================================================
// DELETE CONTENT
// ============================================================

async function deleteContent(targetType, targetId) {
    const confirmed = confirm(
        "Are you sure you want to permanently delete this content?"
    );

    if (!confirmed) {
        return false;
    }


    const reason = prompt(
        "Optional internal moderation reason:\n\n" +
        "Leave blank if you don't need one."
    );

    if (reason === null) {
        return false;
    }


    // Get associated Storage paths before deleting
    // the database row.
    const {
        data: preparation,
        error: preparationError
    } = await client.rpc(
        "moderator_prepare_delete_content",
        {
            p_target_type: targetType,
            p_target_id: targetId
        }
    );


    if (preparationError) {
        throw preparationError;
    }


    const storagePaths =
        preparation?.storage_paths || [];


    // Imageboard images are known to use this bucket.
    //
    // Gallery storage is intentionally NOT removed here
    // because we have not established the gallery bucket name.
    if (
        (
            targetType === "imageboard_thread" ||
            targetType === "imageboard_post"
        ) &&
        storagePaths.length > 0
    ) {
        const {
            error: storageError
        } = await client
            .storage
            .from("imageboard-images")
            .remove(storagePaths);


        if (storageError) {
            throw storageError;
        }
    }


    const {
        error: deleteError
    } = await client.rpc(
        "moderator_delete_content",
        {
            p_target_type: targetType,
            p_target_id: targetId,
            p_reason: reason.trim() || null
        }
    );


    if (deleteError) {
        throw deleteError;
    }


    return true;
}


// ============================================================
// BUTTON EVENTS
// ============================================================

function attachModerationButtons() {

    // --------------------------------------------------------
    // HIDE
    // --------------------------------------------------------

    document
        .querySelectorAll(".moderation-hide-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const targetType =
                        button.dataset.targetType;

                    const targetId =
                        button.dataset.targetId;


                    try {
                        button.disabled = true;

                        const changed =
                            await hideContent(
                                targetType,
                                targetId
                            );

                        if (changed) {
                            await performSearch();
                        }

                    } catch (error) {

                        console.error(
                            "Hide failed:",
                            error
                        );

                        alert(
                            error.message ||
                            "Something went wrong."
                        );

                        button.disabled = false;
                    }
                }
            );
        });


    // --------------------------------------------------------
    // DELETE
    // --------------------------------------------------------

    document
        .querySelectorAll(".moderation-delete-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const targetType =
                        button.dataset.targetType;

                    const targetId =
                        button.dataset.targetId;


                    try {
                        button.disabled = true;

                        const deleted =
                            await deleteContent(
                                targetType,
                                targetId
                            );

                        if (deleted) {
                            await performSearch();
                        }

                    } catch (error) {

                        console.error(
                            "Delete failed:",
                            error
                        );

                        alert(
                            error.message ||
                            "Something went wrong."
                        );

                        button.disabled = false;
                    }
                }
            );
        });
}


// ============================================================
// MAIN SEARCH
// ============================================================

async function performSearch() {
    const searchTerm =
        moderationSearch.value.trim();

    const type =
        moderationType.value;


    moderationMessage.textContent =
        "Searching... ♡";

    moderationResults.innerHTML = `
        <p>
            Searching... ♡
        </p>
    `;


    try {

        // Find matching usernames first.
        const matchingUsers =
            await findMatchingUsers(searchTerm);


        const matchingUserIds =
            matchingUsers.map(user => user.id);


        const usernameMap =
            createUsernameMap(matchingUsers);


        let results;


        if (type === "all") {

            results =
                await searchAllContent(
                    searchTerm,
                    matchingUserIds
                );

        } else {

            results =
                await searchContent(
                    searchTerm,
                    matchingUserIds,
                    type
                );
        }


        // Newest first.
        results.sort(
            (a, b) =>
                new Date(
                    b.created_at || 0
                ) -
                new Date(
                    a.created_at || 0
                )
        );


        renderResults(
            results,
            usernameMap
        );


        moderationMessage.textContent =
            `${results.length} result` +
            `${results.length === 1 ? "" : "s"} found. ♡`;


    } catch (error) {

        console.error(
            "Moderation search failed:",
            error
        );


        moderationMessage.textContent = "";


        moderationResults.innerHTML = `
            <p class="error-message">
                Search failed:
                ${escapeHtml(
                    error.message ||
                    "Unknown error"
                )}
            </p>
        `;
    }
}


// ============================================================
// FORM EVENTS
// ============================================================

moderationSearchForm.addEventListener(
    "submit",
    event => {
        event.preventDefault();
        performSearch();
    }
);


moderationVisibility.addEventListener(
    "change",
    performSearch
);


moderationType.addEventListener(
    "change",
    performSearch
);


// ============================================================
// START
// ============================================================

(async function init() {

    if (!client) {
        moderationMessage.textContent =
            "Supabase could not be loaded. Please refresh the page.";

        return;
    }


    const allowed =
        await checkModerator();


    if (!allowed) {
        return;
    }


    moderationMessage.textContent =
        "Ready. Search by username, title, or content. ♡";

})();