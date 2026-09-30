(() => {
    "use strict";

    const client = window.supabaseClient;

    const threadPage =
        document.getElementById("threadPage");

    const STORAGE_BUCKET =
        "imageboard-images";

    const currentPostNumbers =
        new Map();

    let currentReportTarget = null;

    const REPORT_TARGET_TYPES = new Set([
        "imageboard_thread",
        "imageboard_post"
    ]);

    const REPORT_REASONS = [
        "Spam",
        "Harassment or bullying",
        "Hate or discriminatory content",
        "Threats or dangerous content",
        "Inappropriate content",
        "Other"
    ];


    function getThreadId() {
        const params =
            new URLSearchParams(
                window.location.search
            );

        return params.get("id");
    }


    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function formatDate(value) {
        if (!value) {
            return "";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleString();
    }


    function getImageUrl(storagePath) {
        if (!storagePath) {
            return null;
        }

        const {
            data
        } = client.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(storagePath);

        return data?.publicUrl || null;
    }


    function renderError(message) {
        threadPage.innerHTML = `
            <section class="thread-error">
                <p>${escapeHtml(message)}</p>
            </section>
        `;
    }


    function buildPostNumbers(posts) {
        currentPostNumbers.clear();

        let number = 1;

        for (const post of posts) {
            if (post.is_hidden) {
                continue;
            }

            currentPostNumbers.set(
                post.id,
                number
            );

            number += 1;
        }
    }


    function formatPostContent(content) {
        if (!content) {
            return "";
        }

        return String(content)
            .split("\n")
            .map(formatPostLine)
            .join("<br>");
    }


    function formatPostLine(line) {
        const escaped =
            escapeHtml(line);

        const withReferences =
            escaped.replace(
                /&gt;&gt;([0-9]+)/g,
                (match, numberText) => {
                    const number =
                        Number(numberText);

                    let referencedPostId = null;

                    for (
                        const [
                            postId,
                            postNumber
                        ]
                        of currentPostNumbers
                    ) {
                        if (
                            postNumber === number
                        ) {
                            referencedPostId =
                                postId;
                            break;
                        }
                    }

                    if (
                        !referencedPostId
                    ) {
                        return match;
                    }

                    return `
                        <a
                            href="#post-${escapeHtml(referencedPostId)}"
                            class="thread-post-reference"
                            data-post-reference="${escapeHtml(referencedPostId)}"
                        >
                            &gt;&gt;${number}
                        </a>
                    `;
                }
            );

        if (
            withReferences.startsWith("&gt;")
        ) {
            return `
                <span class="thread-quotetext">
                    ${withReferences}
                </span>
            `;
        }

        return withReferences;
    }


    function escapeFormattedText(value) {
        return value;
    }


    function setupPostReferenceLinks() {
        document.addEventListener(
            "click",
            (event) => {
                const link =
                    event.target.closest(
                        "[data-post-reference]"
                    );

                if (!link) {
                    return;
                }

                const postId =
                    link.dataset.postReference;

                const target =
                    document.getElementById(
                        `post-${postId}`
                    );

                if (!target) {
                    return;
                }

                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                target.classList.add(
                    "thread-post-reference-highlight"
                );

                window.history.replaceState(
                    null,
                    "",
                    `#post-${postId}`
                );

                window.setTimeout(() => {
                    target.classList.remove(
                        "thread-post-reference-highlight"
                    );
                }, 1800);
            }
        );
    }


    function ensureReportDialog() {
        if (
            document.getElementById(
                "reportDialog"
            )
        ) {
            return;
        }

        const dialog =
            document.createElement("dialog");

        dialog.id =
            "reportDialog";

        dialog.className =
            "report-dialog";

        dialog.innerHTML = `
            <form
                method="dialog"
                class="report-dialog-form"
                id="reportDialogForm"
            >
                <h2>Report content</h2>

                <p class="report-dialog-intro">
                    Tell the moderation team what is wrong with
                    this content. ♡
                </p>

                <label for="reportReason">
                    Reason
                </label>

                <select
                    id="reportReason"
                    name="reason"
                    required
                >
                    <option
                        value=""
                        selected
                        disabled
                    >
                        Choose a reason...
                    </option>

                    ${REPORT_REASONS.map(
                        (reason) => `
                            <option value="${escapeHtml(reason)}">
                                ${escapeHtml(reason)}
                            </option>
                        `
                    ).join("")}
                </select>

                <label for="reportDetails">
                    Details
                    <span class="optional-label">
                        optional
                    </span>
                </label>

                <textarea
                    id="reportDetails"
                    name="details"
                    maxlength="2000"
                    placeholder="Add any helpful context..."
                ></textarea>

                <p class="report-dialog-help">
                    Please only report content that actually
                    needs moderator attention.
                </p>

                <p
                    id="reportDialogMessage"
                    class="report-dialog-message"
                    aria-live="polite"
                ></p>

                <div class="report-dialog-actions">
                    <button
                        type="button"
                        class="report-dialog-cancel"
                        id="reportDialogCancel"
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        id="reportDialogSubmit"
                    >
                        Submit report
                    </button>
                </div>
            </form>
        `;

        document.body.appendChild(dialog);

        const form =
            document.getElementById(
                "reportDialogForm"
            );

        const cancelButton =
            document.getElementById(
                "reportDialogCancel"
            );

        cancelButton.addEventListener(
            "click",
            () => {
                dialog.close();
            }
        );

        form.addEventListener(
            "submit",
            async (event) => {
                event.preventDefault();

                await submitReport();
            }
        );
    }


    async function openReportDialog(
        targetType,
        targetId
    ) {
        if (
            !REPORT_TARGET_TYPES.has(
                targetType
            )
        ) {
            return;
        }

        if (!targetId) {
            return;
        }

        ensureReportDialog();

        currentReportTarget = {
            targetType,
            targetId
        };

        const dialog =
            document.getElementById(
                "reportDialog"
            );

        const reason =
            document.getElementById(
                "reportReason"
            );

        const details =
            document.getElementById(
                "reportDetails"
            );

        const message =
            document.getElementById(
                "reportDialogMessage"
            );

        const submitButton =
            document.getElementById(
                "reportDialogSubmit"
            );

        reason.value = "";
        details.value = "";
        message.textContent = "";
        submitButton.disabled = false;
        submitButton.textContent =
            "Submit report";

        if (
            typeof dialog.showModal ===
            "function"
        ) {
            dialog.showModal();
        } else {
            dialog.setAttribute(
                "open",
                ""
            );
        }
    }


    async function submitReport() {
        if (!currentReportTarget) {
            return;
        }

        const reason =
            document.getElementById(
                "reportReason"
            ).value;

        const details =
            document.getElementById(
                "reportDetails"
            ).value.trim();

        const message =
            document.getElementById(
                "reportDialogMessage"
            );

        const submitButton =
            document.getElementById(
                "reportDialogSubmit"
            );

        if (!reason) {
            message.textContent =
                "Please choose a reason.";

            return;
        }

        const {
            data: {
                user
            } = {}
        } = await client.auth.getUser();

        if (!user) {
            message.textContent =
                "You must be logged in to submit a report. ♡";

            return;
        }

        submitButton.disabled = true;
        submitButton.textContent =
            "Submitting...";

        message.textContent = "";

        const {
            error
        } = await client.rpc(
            "create_report",
            {
                p_target_type:
                    currentReportTarget.targetType,

                p_target_id:
                    currentReportTarget.targetId,

                p_reason:
                    reason,

                p_details:
                    details || null
            }
        );

        if (error) {
            console.error(
                "Report submission error:",
                error
            );

            message.textContent =
                error.message ||
                "Unable to submit the report.";

            submitButton.disabled = false;
            submitButton.textContent =
                "Submit report";

            return;
        }

        message.textContent =
            "Report submitted. Thank you. ♡";

        window.setTimeout(() => {
            const dialog =
                document.getElementById(
                    "reportDialog"
                );

            if (
                dialog?.open
            ) {
                dialog.close();
            }

            currentReportTarget = null;
        }, 700);
    }


    function setupReportButtons() {
        document.addEventListener(
            "click",
            (event) => {
                const button =
                    event.target.closest(
                        "[data-report-target-type][data-report-target-id]"
                    );

                if (!button) {
                    return;
                }

                event.preventDefault();

                openReportDialog(
                    button.dataset
                        .reportTargetType,

                    button.dataset
                        .reportTargetId
                );
            }
        );
    }


    async function loadThread() {
        const threadId =
            getThreadId();

        if (!threadId) {
            renderError(
                "No thread was specified."
            );

            return;
        }

        const {
            data: thread,
            error: threadError
        } = await client
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
                boards (
                    name,
                    slug
                )
            `)
            .eq("id", threadId)
            .single();

        if (threadError) {
            console.error(
                "Thread loading error:",
                threadError
            );

            renderError(
                "Unable to load this thread."
            );

            return;
        }

        const {
            data: posts,
            error: postsError
        } = await client
            .from("posts")
            .select(`
                id,
                user_id,
                content,
                created_at,
                is_hidden,
                is_anonymous,
                profiles!posts_user_id_fkey (
                    id,
                    username,
                    display_name,
                    avatar_url
                ),
                post_images (
                    id,
                    storage_path,
                    alt_text
                )
            `)
            .eq("thread_id", threadId)
            .order(
                "created_at",
                {
                    ascending: true
                }
            );

        if (postsError) {
            console.error(
                "Posts loading error:",
                postsError
            );

            renderError(
                "Unable to load the posts in this thread."
            );

            return;
        }

        buildPostNumbers(
            posts || []
        );

        renderThread(
            thread,
            posts || []
        );

        setupReplyForm(thread);
    }


    function renderThread(
        thread,
        posts
    ) {
        const visiblePosts =
            posts.filter(
                (post) =>
                    !post.is_hidden
            );

        const openingPost =
            visiblePosts[0] || null;

        const replies =
            visiblePosts.slice(1);

        const board =
            thread.boards;

        const boardName =
            board?.name ||
            "Imageboard";

        const boardSlug =
            board?.slug ||
            "";

        const statuses = [];

        if (thread.is_locked) {
            statuses.push(
                `<span class="thread-status">Locked</span>`
            );
        }

        if (thread.is_archived) {
            statuses.push(
                `<span class="thread-status">Archived</span>`
            );
        }

        threadPage.innerHTML = `
            <section class="thread-header">

                <p class="board-slug">
                    /${escapeHtml(boardSlug)}/
                </p>

                <h2>
                    ${escapeHtml(thread.title)}
                </h2>

                <p class="thread-header-meta">
                    ${escapeHtml(boardName)}
                    · Started
                    ${escapeHtml(
                        formatDate(
                            thread.created_at
                        )
                    )}
                </p>

                ${
                    statuses.length
                        ? `
                            <div class="thread-statuses">
                                ${statuses.join("")}
                            </div>
                        `
                        : ""
                }

                <div class="thread-header-actions">

                    <a
                        href="imageboard.html"
                    >
                        Back to boards
                    </a>

                    <button
                        type="button"
                        class="thread-report-button"
                        data-report-target-type="imageboard_thread"
                        data-report-target-id="${escapeHtml(thread.id)}"
                    >
                        ⚑ Report thread
                    </button>

                </div>

            </section>

            <section class="thread-posts">

                ${
                    openingPost
                        ? renderPost(
                            openingPost,
                            true
                        )
                        : `
                            <p class="thread-empty">
                                This thread has no visible posts.
                            </p>
                        `
                }

                <div class="thread-replies">
                    ${
                        replies.length
                            ? replies
                                .map(
                                    (post) =>
                                        renderPost(
                                            post,
                                            false
                                        )
                                )
                                .join("")
                            : ""
                    }
                </div>

            </section>

            <section
                id="threadReplySection"
                class="thread-header"
                style="margin-top: 20px;"
            >
                <h2>Reply</h2>

                <div id="replyFormContainer">
                    <p class="thread-empty">
                        Loading reply form... ♡
                    </p>
                </div>
            </section>
        `;
    }


    function renderPost(
        post,
        isOpeningPost
    ) {
        const profile =
            post.profiles;

        const isAnonymous =
            Boolean(
                post.is_anonymous
            );

        const displayName =
            isAnonymous
                ? "Anonymous"
                : (
                    profile?.display_name ||
                    profile?.username ||
                    "User"
                );

        const username =
            isAnonymous
                ? "anonymous"
                : (
                    profile?.username ||
                    ""
                );

        const postNumber =
            currentPostNumbers.get(
                post.id
            );

        const images =
            Array.isArray(
                post.post_images
            )
                ? post.post_images
                : [];

        const imageMarkup =
            images.length
                ? `
                    <div class="thread-post-images">
                        ${
                            images
                                .map(
                                    (image) => {
                                        const url =
                                            getImageUrl(
                                                image.storage_path
                                            );

                                        if (!url) {
                                            return "";
                                        }

                                        return `
                                            <a
                                                href="${escapeHtml(url)}"
                                                class="thread-post-image-link"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <img
                                                    src="${escapeHtml(url)}"
                                                    alt="${escapeHtml(
                                                        image.alt_text ||
                                                        "Attached image"
                                                    )}"
                                                    class="thread-post-image"
                                                    loading="lazy"
                                                >
                                            </a>
                                        `;
                                    }
                                )
                                .join("")
                        }
                    </div>
                `
                : "";

        return `
            <article
                class="thread-post ${
                    isOpeningPost
                        ? "thread-op"
                        : ""
                }"
                id="post-${escapeHtml(post.id)}"
            >

                <header class="thread-post-header">

                    <strong>
                        ${escapeHtml(displayName)}
                    </strong>

                    ${
                        username
                            ? `
                                <span class="thread-post-username">
                                    @${escapeHtml(username)}
                                </span>
                            `
                            : ""
                    }

                    <time>
                        ${escapeHtml(
                            formatDate(
                                post.created_at
                            )
                        )}
                    </time>

                    ${
                        postNumber
                            ? `
                                <a
                                    href="#post-${escapeHtml(post.id)}"
                                    class="thread-post-number"
                                >
                                    No. ${postNumber}
                                </a>
                            `
                            : ""
                    }

                    ${
                        isOpeningPost
                            ? `
                                <span class="thread-post-label">
                                    OP
                                </span>
                            `
                            : ""
                    }

                    <button
                        type="button"
                        class="thread-post-report-button"
                        data-report-target-type="imageboard_post"
                        data-report-target-id="${escapeHtml(post.id)}"
                    >
                        ⚑ Report
                    </button>

                </header>

                <div class="thread-post-body">

                    ${imageMarkup}

                    <div class="thread-post-content">
                        ${
                            escapeFormattedText(
                                formatPostContent(
                                    post.content
                                )
                            )
                        }
                    </div>

                </div>

            </article>
        `;
    }


    async function setupReplyForm(thread) {
        const container =
            document.getElementById(
                "replyFormContainer"
            );

        if (!container) {
            return;
        }

        if (
            thread.is_locked ||
            thread.is_archived
        ) {
            container.innerHTML = `
                <p class="thread-empty">
                    This thread is closed for replies.
                </p>
            `;

            return;
        }

        const {
            data: {
                user
            } = {}
        } = await client.auth.getUser();

        if (!user) {
            container.innerHTML = `
                <p class="thread-empty">
                    You must be logged in to reply.
                </p>
            `;

            return;
        }

        container.innerHTML = `
            <form id="replyForm">

                <label for="replyContent">
                    Message
                </label>

                <textarea
                    id="replyContent"
                    required
                    maxlength="10000"
                    placeholder="Write your reply..."
                ></textarea>

                <label for="replyImage">
                    Image
                    <span class="optional-label">
                        optional
                    </span>
                </label>

                <input
                    type="file"
                    id="replyImage"
                    accept="image/*"
                >

                <p class="upload-help">
                    Images must be 10 MB or smaller.
                </p>

                <div
                    id="replyImagePreview"
                    class="image-preview"
                    hidden
                ></div>

                <label>
                    <input
                        type="checkbox"
                        id="replyAnonymous"
                    >
                    Post anonymously
                </label>

                <p
                    id="replyFormMessage"
                    class="editor-message"
                    aria-live="polite"
                ></p>

                <button
                    type="submit"
                >
                    Post reply
                </button>

            </form>
        `;

        setupReplyImagePreview();

        const form =
            document.getElementById(
                "replyForm"
            );

        form.addEventListener(
            "submit",
            async (event) => {
                event.preventDefault();

                await submitReply(
                    thread
                );
            }
        );
    }


    function setupReplyImagePreview() {
        const input =
            document.getElementById(
                "replyImage"
            );

        const preview =
            document.getElementById(
                "replyImagePreview"
            );

        if (!input || !preview) {
            return;
        }

        input.addEventListener(
            "change",
            () => {
                const file =
                    input.files?.[0];

                if (!file) {
                    preview.innerHTML = "";
                    preview.hidden = true;
                    return;
                }

                if (
                    file.size >
                    10 * 1024 * 1024
                ) {
                    preview.innerHTML = `
                        <p>
                            This image is larger than 10 MB.
                        </p>
                    `;

                    preview.hidden = false;
                    input.value = "";

                    return;
                }

                const url =
                    URL.createObjectURL(
                        file
                    );

                preview.innerHTML = `
                    <img
                        src="${escapeHtml(url)}"
                        alt="Image preview"
                    >
                    <p>
                        ${escapeHtml(file.name)}
                    </p>
                `;

                preview.hidden = false;
            }
        );
    }


    async function submitReply(thread) {
        const contentInput =
            document.getElementById(
                "replyContent"
            );

        const imageInput =
            document.getElementById(
                "replyImage"
            );

        const anonymousInput =
            document.getElementById(
                "replyAnonymous"
            );

        const message =
            document.getElementById(
                "replyFormMessage"
            );

        const submitButton =
            document.querySelector(
                "#replyForm button[type='submit']"
            );

        const content =
            contentInput.value.trim();

        const file =
            imageInput.files?.[0] ||
            null;

        const isAnonymous =
            anonymousInput.checked;

        if (!content) {
            message.textContent =
                "Please write a message.";

            return;
        }

        if (
            file &&
            file.size >
                10 * 1024 * 1024
        ) {
            message.textContent =
                "That image is larger than 10 MB.";

            return;
        }

        submitButton.disabled = true;
        submitButton.textContent =
            "Posting...";

        message.textContent = "";

        const {
            data: postId,
            error: postError
        } = await client.rpc(
            "create_imageboard_post",
            {
                p_thread_id:
                    thread.id,

                p_content:
                    content,

                p_is_anonymous:
                    isAnonymous,

                p_has_image:
                    Boolean(file)
            }
        );

        if (postError) {
            console.error(
                "Reply creation error:",
                postError
            );

            message.textContent =
                postError.message ||
                "Unable to create the reply.";

            submitButton.disabled = false;
            submitButton.textContent =
                "Post reply";

            return;
        }

        if (file) {
            const extension =
                file.name.includes(".")
                    ? file.name
                        .split(".")
                        .pop()
                        .toLowerCase()
                    : "bin";

            const storagePath =
                [
                    window.crypto.randomUUID
                        ? window.crypto.randomUUID()
                        : `${Date.now()}-${Math.random()
                            .toString(16)
                            .slice(2)}`,
                    thread.id,
                    `${postId}.${extension}`
                ].join("/");

            const {
                error: uploadError
            } = await client.storage
                .from(STORAGE_BUCKET)
                .upload(
                    storagePath,
                    file,
                    {
                        upsert: false
                    }
                );

            if (uploadError) {
                console.error(
                    "Image upload error:",
                    uploadError
                );

                message.textContent =
                    "The reply was created, but the image upload failed.";

                submitButton.disabled = false;
                submitButton.textContent =
                    "Post reply";

                return;
            }

            const {
                error: imageInsertError
            } = await client
                .from("post_images")
                .insert({
                    post_id:
                        postId,

                    storage_path:
                        storagePath,

                    alt_text:
                        file.name
                });

            if (imageInsertError) {
                console.error(
                    "Post image record error:",
                    imageInsertError
                );

                message.textContent =
                    "The reply was created, but the image record could not be saved.";

                submitButton.disabled = false;
                submitButton.textContent =
                    "Post reply";

                return;
            }
        }

        await loadThread();

        window.setTimeout(() => {
            const post =
                document.getElementById(
                    `post-${postId}`
                );

            if (post) {
                post.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                post.classList.add(
                    "thread-post-reference-highlight"
                );

                window.setTimeout(() => {
                    post.classList.remove(
                        "thread-post-reference-highlight"
                    );
                }, 1800);
            }
        }, 100);
    }


    ensureReportDialog();
    setupReportButtons();
    setupPostReferenceLinks();

    if (!client) {
        renderError(
            "Supabase is not available."
        );
    } else {
        loadThread();
    }
})();