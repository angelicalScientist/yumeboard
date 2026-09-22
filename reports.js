const client = window.supabaseClient;

const reportsMessage = document.getElementById("reportsMessage");
const reportList = document.getElementById("reportList");

const filterButtons = document.querySelectorAll(".report-filter-button");

let currentStatus = "open";
let currentUser = null;

async function init() {
    if (!client) {
        setMessage("Supabase client is unavailable.");
        return;
    }

    const {
        data: { user },
        error: userError
    } = await client.auth.getUser();

    if (userError || !user) {
        setMessage("You must be logged in to view reports.");
        reportList.innerHTML = "";
        return;
    }

    currentUser = user;

    const { data: moderator, error: moderatorError } = await client.rpc(
        "is_moderator"
    );

    if (moderatorError || !moderator) {
        setMessage("You do not have permission to view this page.");
        reportList.innerHTML = "";
        return;
    }

    setupFilters();
    await loadReports();
}

function setupFilters() {
    filterButtons.forEach(button => {
        button.addEventListener("click", async () => {
            filterButtons.forEach(item => {
                item.classList.remove("active");
            });

            button.classList.add("active");

            currentStatus = button.dataset.status;
            await loadReports();
        });
    });
}

async function loadReports() {
    setMessage("");
    reportList.innerHTML = "<p>Loading reports... ♡</p>";

    const { data: reports, error } = await client
        .from("reports")
        .select(`
            id,
            reporter_id,
            target_type,
            target_id,
            reason,
            details,
            status,
            reviewed_by,
            reviewed_at,
            created_at
        `)
        .eq("status", currentStatus)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error(error);
        reportList.innerHTML = `
            <p>Unable to load reports right now. ♡</p>
        `;
        return;
    }

    if (!reports || reports.length === 0) {
        reportList.innerHTML = `
            <p>No ${escapeHtml(currentStatus)} reports. ♡</p>
        `;
        return;
    }

    const cards = [];

    for (const report of reports) {
        try {
            cards.push(await renderReport(report));
        } catch (error) {
            console.error("Failed to render report:", report, error);

            cards.push(`
                <article class="report-card card">
                    <h2>${escapeHtml(formatTargetType(report.target_type))}</h2>
                    <p>Unable to load the reported content.</p>
                    <p class="small-text">
                        Target ID: ${escapeHtml(report.target_id)}
                    </p>
                </article>
            `);
        }
    }

    reportList.innerHTML = cards.join("");
}

async function renderReport(report) {
    const content = await loadReportedContent(report);

    return `
        <article class="report-card card">
            <div class="report-header">
                <div>
                    <h2>${escapeHtml(formatTargetType(report.target_type))}</h2>

                    <p class="small-text">
                        Reported ${formatDate(report.created_at)}
                    </p>
                </div>

                <span class="report-status">
                    ${escapeHtml(report.status)}
                </span>
            </div>

            <section class="report-reason">
                <h3>Report reason</h3>

                <p>
                    ${escapeHtml(report.reason)}
                </p>

                ${
                    report.details
                        ? `
                            <h4>Additional details</h4>
                            <p>
                                ${escapeHtml(report.details)}
                            </p>
                        `
                        : ""
                }
            </section>

            <section class="reported-content">
                <h3>Reported content</h3>

                ${content.html}
            </section>

            <section class="report-actions">
                ${
                    report.status === "open"
                        ? `
                            <button
                                type="button"
                                class="moderation-button"
                                data-action="hide"
                                data-report-id="${escapeHtml(report.id)}"
                            >
                                Hide content
                            </button>

                            <button
                                type="button"
                                class="moderation-button danger"
                                data-action="delete"
                                data-report-id="${escapeHtml(report.id)}"
                            >
                                Delete permanently
                            </button>

                            <button
                                type="button"
                                class="moderation-button secondary"
                                data-action="dismiss"
                                data-report-id="${escapeHtml(report.id)}"
                            >
                                Dismiss report
                            </button>
                        `
                        : ""
                }
            </section>
        </article>
    `;
}

async function loadReportedContent(report) {
    switch (report.target_type) {
        case "imageboard_thread":
            return loadImageboardThread(report.target_id);

        case "imageboard_post":
            return loadImageboardPost(report.target_id);

        case "gallery_item":
            return loadGalleryItem(report.target_id);

        case "guestbook_entry":
            return loadGuestbookEntry(report.target_id);

        case "guestbook_reply":
            return loadGuestbookReply(report.target_id);

        default:
            return {
                html: `
                    <p>Unknown report target type.</p>
                `
            };
    }
}

async function loadImageboardThread(threadId) {
    const { data: thread, error } = await client
        .from("threads")
        .select(`
            id,
            user_id,
            title,
            created_at,
            is_locked,
            is_archived,
            is_hidden,
            posts (
                id,
                user_id,
                content,
                created_at,
                is_anonymous,
                is_hidden,
                post_images (
                    id,
                    storage_path,
                    alt_text
                )
            )
        `)
        .eq("id", threadId)
        .single();

    if (error || !thread) {
        return {
            html: `
                <p>This thread no longer exists.</p>
            `
        };
    }

    const openingPost = Array.isArray(thread.posts)
        ? [...thread.posts].sort(
            (a, b) =>
                new Date(a.created_at) - new Date(b.created_at)
        )[0]
        : null;

    const author = openingPost?.is_anonymous
        ? "Anonymous"
        : thread.user_id;

    return {
        html: `
            <div class="reported-thread">
                <h4>${escapeHtml(thread.title)}</h4>

                <p class="small-text">
                    Author:
                    ${escapeHtml(author)}
                </p>

                <p class="small-text">
                    Created:
                    ${formatDate(thread.created_at)}
                </p>

                ${
                    openingPost
                        ? `
                            <div class="reported-post-content">
                                ${formatMultilineText(
                                    openingPost.content
                                )}
                            </div>

                            ${renderPostImages(
                                openingPost.post_images
                            )}
                        `
                        : `
                            <p>No opening post was found.</p>
                        `
                }
            </div>
        `
    };
}

async function loadImageboardPost(postId) {
    const { data: post, error } = await client
        .from("posts")
        .select(`
            id,
            user_id,
            thread_id,
            content,
            created_at,
            is_anonymous,
            is_hidden,
            post_images (
                id,
                storage_path,
                alt_text
            )
        `)
        .eq("id", postId)
        .single();

    if (error || !post) {
        return {
            html: `
                <p>This post no longer exists.</p>
            `
        };
    }

    const author = post.is_anonymous
        ? "Anonymous"
        : post.user_id;

    return {
        html: `
            <div class="reported-post">
                <p class="small-text">
                    Author:
                    ${escapeHtml(author)}
                </p>

                <p class="small-text">
                    Created:
                    ${formatDate(post.created_at)}
                </p>

                <div class="reported-post-content">
                    ${formatMultilineText(post.content)}
                </div>

                ${renderPostImages(post.post_images)}
            </div>
        `
    };
}

async function loadGalleryItem(itemId) {
    const { data: item, error } = await client
        .from("gallery_items")
        .select(`
            id,
            user_id,
            image_url,
            title,
            description,
            created_at,
            updated_at,
            storage_path,
            image_path,
            is_hidden
        `)
        .eq("id", itemId)
        .single();

    if (error || !item) {
        return {
            html: `
                <p>This gallery item no longer exists.</p>
            `
        };
    }

    const imageUrl =
        item.image_url ||
        item.image_path ||
        "";

    return {
        html: `
            <div class="reported-gallery-item">

                ${
                    imageUrl
                        ? `
                            <img
                                src="${escapeAttribute(imageUrl)}"
                                alt="${escapeAttribute(
                                    item.title || "Reported gallery image"
                                )}"
                                class="reported-content-image"
                            >
                        `
                        : ""
                }

                <p class="small-text">
                    Author:
                    ${escapeHtml(item.user_id)}
                </p>

                ${
                    item.title
                        ? `
                            <h4>
                                ${escapeHtml(item.title)}
                            </h4>
                        `
                        : ""
                }

                ${
                    item.description
                        ? `
                            <p>
                                ${escapeHtml(item.description)}
                            </p>
                        `
                        : ""
                }

                <p class="small-text">
                    Created:
                    ${formatDate(item.created_at)}
                </p>
            </div>
        `
    };
}

async function loadGuestbookEntry(entryId) {
    const { data: entry, error } = await client
        .from("guestbook_entries")
        .select(`
            id,
            profile_id,
            user_id,
            author_name,
            message,
            is_anonymous,
            created_at,
            is_hidden
        `)
        .eq("id", entryId)
        .single();

    if (error || !entry) {
        return {
            html: `
                <p>This guestbook entry no longer exists.</p>
            `
        };
    }

    const author = entry.is_anonymous
        ? "Anonymous"
        : entry.author_name || entry.user_id;

    return {
        html: `
            <div class="reported-guestbook-entry">
                <p class="small-text">
                    Author:
                    ${escapeHtml(author)}
                </p>

                <p>
                    ${formatMultilineText(entry.message)}
                </p>

                <p class="small-text">
                    Created:
                    ${formatDate(entry.created_at)}
                </p>
            </div>
        `
    };
}

async function loadGuestbookReply(replyId) {
    const { data: reply, error } = await client
        .from("guestbook_replies")
        .select(`
            id,
            entry_id,
            user_id,
            author_name,
            message,
            is_anonymous,
            created_at,
            is_hidden
        `)
        .eq("id", replyId)
        .single();

    if (error || !reply) {
        return {
            html: `
                <p>This guestbook reply no longer exists.</p>
            `
        };
    }

    const author = reply.is_anonymous
        ? "Anonymous"
        : reply.author_name || reply.user_id;

    return {
        html: `
            <div class="reported-guestbook-reply">
                <p class="small-text">
                    Author:
                    ${escapeHtml(author)}
                </p>

                <p>
                    ${formatMultilineText(reply.message)}
                </p>

                <p class="small-text">
                    Created:
                    ${formatDate(reply.created_at)}
                </p>
            </div>
        `
    };
}

function renderPostImages(images) {
    if (!Array.isArray(images) || images.length === 0) {
        return "";
    }

    return `
        <div class="reported-post-images">
            ${images.map(image => {
                const { data } = client
                    .storage
                    .from("imageboard-images")
                    .getPublicUrl(image.storage_path);

                return `
                    <figure class="reported-image">
                        <img
                            src="${escapeAttribute(data.publicUrl)}"
                            alt="${escapeAttribute(
                                image.alt_text || "Imageboard image"
                            )}"
                            class="reported-content-image"
                        >
                    </figure>
                `;
            }).join("")}
        </div>
    `;
}

async function hideReportedContent(report) {
    const reason = window.prompt(
        "Optional moderation reason:\n\n" +
        "Leave blank if you don't need to record one."
    );

    if (reason === null) {
        return;
    }

    const { error } = await client.rpc(
        "moderator_hide_content",
        {
            p_target_type: report.target_type,
            p_target_id: report.target_id,
            p_reason: reason.trim() || null
        }
    );

    if (error) {
        throw error;
    }

    await resolveReport(report.id);

    await loadReports();
}

async function deleteReportedContent(report) {
    const confirmed = window.confirm(
        "Permanently delete this content?\n\n" +
        "This cannot be undone."
    );

    if (!confirmed) {
        return;
    }

    const reason = window.prompt(
        "Optional deletion reason:\n\n" +
        "Leave blank if you don't need to record one."
    );

    if (reason === null) {
        return;
    }

    const {
        data: prepared,
        error: prepareError
    } = await client.rpc(
        "moderator_prepare_delete_content",
        {
            p_target_type: report.target_type,
            p_target_id: report.target_id
        }
    );

    if (prepareError) {
        throw prepareError;
    }

    const storagePaths = Array.isArray(prepared?.storage_paths)
        ? prepared.storage_paths.filter(Boolean)
        : [];

    if (storagePaths.length > 0) {
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
            p_target_type: report.target_type,
            p_target_id: report.target_id,
            p_reason: reason.trim() || null
        }
    );

    if (deleteError) {
        throw deleteError;
    }

    await resolveReport(report.id);

    await loadReports();
}

async function dismissReport(report) {
    const confirmed = window.confirm(
        "Dismiss this report without removing the content?"
    );

    if (!confirmed) {
        return;
    }

    const reason = window.prompt(
        "Optional dismissal note:\n\n" +
        "Leave blank if you don't need to record one."
    );

    if (reason === null) {
        return;
    }

    const cleanReason = reason.trim() || null;

    const { error } = await client
        .from("reports")
        .update({
            status: "dismissed",
            reviewed_by: currentUser.id,
            reviewed_at: new Date().toISOString()
        })
        .eq("id", report.id);

    if (error) {
        throw error;
    }

    const { error: actionError } = await client
        .from("moderation_actions")
        .insert({
            moderator_id: currentUser.id,
            action_type: "dismiss_report",
            target_type: report.target_type,
            target_id: report.target_id,
            reason: cleanReason
        });

    if (actionError) {
        console.error(
            "Report dismissed but audit log failed:",
            actionError
        );
    }

    await loadReports();
}

async function resolveReport(reportId) {
    const { error } = await client
        .from("reports")
        .update({
            status: "resolved",
            reviewed_by: currentUser.id,
            reviewed_at: new Date().toISOString()
        })
        .eq("id", reportId);

    if (error) {
        throw error;
    }
}

document.addEventListener("click", async event => {
    const button = event.target.closest(
        "[data-action][data-report-id]"
    );

    if (!button) {
        return;
    }

    const reportId = button.dataset.reportId;
    const action = button.dataset.action;

    const { data: report, error } = await client
        .from("reports")
        .select(`
            id,
            target_type,
            target_id,
            status,
            reason,
            details
        `)
        .eq("id", reportId)
        .single();

    if (error || !report) {
        setMessage("Unable to find that report.");
        return;
    }

    button.disabled = true;

    try {
        if (action === "hide") {
            await hideReportedContent(report);
        } else if (action === "delete") {
            await deleteReportedContent(report);
        } else if (action === "dismiss") {
            await dismissReport(report);
        }
    } catch (error) {
        console.error(error);

        setMessage(
            error?.message ||
            "Something went wrong while processing the moderation action."
        );

        button.disabled = false;
    }
});

function setMessage(message) {
    reportsMessage.textContent = message || "";
}

function formatTargetType(type) {
    const labels = {
        imageboard_thread: "Imageboard thread",
        imageboard_post: "Imageboard post",
        gallery_item: "Gallery item",
        guestbook_entry: "Guestbook entry",
        guestbook_reply: "Guestbook reply"
    };

    return labels[type] || type;
}

function formatDate(value) {
    if (!value) {
        return "Unknown";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unknown";
    }

    return date.toLocaleString();
}

function formatMultilineText(value) {
    if (!value) {
        return "<p><em>No message.</em></p>";
    }

    return escapeHtml(value)
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n/g, "<br>");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

init();