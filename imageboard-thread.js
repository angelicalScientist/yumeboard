
(() => {
    "use strict";

    const client = window.supabaseClient;
    const threadPage = document.getElementById("threadPage");

    const STORAGE_BUCKET = "imageboard-images";
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

    const currentPostNumbers = new Map();

    let currentReportTarget = null;
    let isSubmittingReply = false;
    let activePreviewUrl = null;

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

    // --------------------------------------------------
    // General helpers
    // --------------------------------------------------

    function getThreadId() {
        return new URLSearchParams(
            window.location.search
        ).get("id");
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value) {
        if (!value) return "";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? ""
            : date.toLocaleString();
    }

    function getImageUrl(storagePath) {
        if (!storagePath || !client) return null;

        const { data } = client.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(storagePath);

        return data?.publicUrl || null;
    }

    function renderError(message) {
        if (!threadPage) return;

        threadPage.innerHTML = `
            <section class="thread-error">
                <p>${escapeHtml(message)}</p>
            </section>
        `;
    }

    function getErrorMessage(error, fallback) {
        return error?.message || fallback;
    }

    function getReplyMessage() {
        return document.getElementById("replyFormMessage");
    }

    function setReplyMessage(message) {
        const element = getReplyMessage();

        if (element) {
            element.textContent = message;
        }
    }

    function setSubmitButtonState(disabled, text) {
        const button = document.querySelector(
            "#replyForm button[type='submit']"
        );

        if (!button) return;

        button.disabled = disabled;
        button.textContent = text;
    }

    // --------------------------------------------------
    // Formatting styles
    // --------------------------------------------------

    function ensureFormattingStyles() {
        if (document.getElementById("threadFormattingStyles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "threadFormattingStyles";

        style.textContent = `
            /* Yumeboard violet quote text */
            .thread-post-content .thread-quotetext {
                color: #b48ead;
                margin: 0.25em 0;
                overflow-wrap: anywhere;
                white-space: normal;
            }

            .thread-post-content .thread-quotetext p {
                color: inherit;
                margin: 0;
            }

            .thread-post-content .thread-quotetext a {
                color: inherit;
            }

            /* Spoilers are hidden until activated */
            .thread-post-content .thread-spoiler {
                display: inline;
                color: transparent;
                background-color: #555;
                border-radius: 3px;
                padding: 0 3px;
                cursor: pointer;
                overflow-wrap: anywhere;
                transition:
                    color 0.15s ease,
                    background-color 0.15s ease;
                -webkit-box-decoration-break: clone;
                box-decoration-break: clone;
            }

            .thread-post-content .thread-spoiler.revealed {
                color: inherit;
                background-color: rgba(128, 128, 128, 0.2);
            }

            .thread-post-content .thread-spoiler:focus-visible {
                outline: 2px solid currentColor;
                outline-offset: 2px;
            }

            .thread-post-content blockquote {
                margin: 0.5em 0;
                padding-left: 0.8em;
                border-left: 2px solid currentColor;
            }

            .thread-post-content pre {
                overflow-x: auto;
                padding: 0.75em;
                border-radius: 5px;
            }

            .thread-post-content code {
                overflow-wrap: anywhere;
            }

            .thread-post-content a {
                overflow-wrap: anywhere;
            }

            .reply-formatting-toolbar,
            .formatting-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 0.4rem;
                margin: 0.5rem 0;
            }

            .reply-formatting-toolbar button,
            .formatting-toolbar button {
                cursor: pointer;
            }

            .reply-formatting-help {
                font-size: 0.9rem;
                opacity: 0.8;
            }
        `;

        document.head.appendChild(style);
    }

    // --------------------------------------------------
    // Post numbering
    // --------------------------------------------------

    function buildPostNumbers(posts) {
        currentPostNumbers.clear();

        let number = 1;

        for (const post of posts) {
            if (post.is_hidden) continue;

            currentPostNumbers.set(post.id, number++);
        }
    }

    // --------------------------------------------------
    // Markdown, violet quote text, and spoilers
    // --------------------------------------------------

    function configureMarkdown() {
        if (!window.marked || !window.DOMPurify) {
            console.error(
                "Markdown or DOMPurify failed to load."
            );

            return false;
        }

        /*
         * Supported formatting:
         *
         * - Bold, italic, strikethrough, and inline code.
         * - >>N references to existing visible posts.
         * - ||spoiler|| creates a clickable spoiler.
         * - Lines beginning with > display violet quote text.
         */

        window.marked.setOptions({
            gfm: true,
            breaks: true
        });

        window.marked.use({
            renderer: {
                blockquote(token) {
                    /*
                     * Marked versions generally provide token.text.
                     * The fallback also handles a string argument.
                     */
                    const quoteText = typeof token === "string"
                        ? token
                        : String(token?.text ?? "");

                    return quoteText
                        .split("\n")
                        .map(line => {
                            const renderedLine =
                                window.marked.parseInline(line);

                            return `
                                <div class="thread-quotetext">
                                    &gt; ${renderedLine}
                                </div>
                            `;
                        })
                        .join("\n");
                }
            },

            extensions: [
                // ------------------------------------------
                // Post references: >>1, >>2, >>3, etc.
                // ------------------------------------------

                {
                    name: "postReference",
                    level: "inline",

                    start(source) {
                        const index = source.indexOf(">>");

                        return index === -1
                            ? undefined
                            : index;
                    },

                    tokenizer(source) {
                        const match = /^>>([0-9]+)/.exec(source);

                        if (!match) return undefined;

                        return {
                            type: "postReference",
                            raw: match[0],
                            number: Number(match[1])
                        };
                    },

                    renderer(token) {
                        for (
                            const [postId, postNumber]
                            of currentPostNumbers
                        ) {
                            if (postNumber === token.number) {
                                return `
                                    <a
                                        href="#post-${escapeHtml(postId)}"
                                        class="thread-post-reference"
                                        data-post-reference="${escapeHtml(postId)}"
                                    >&gt;&gt;${token.number}</a>
                                `;
                            }
                        }

                        // Leave references to nonexistent posts as text.
                        return escapeHtml(token.raw);
                    }
                },

                // ------------------------------------------
                // Spoilers: ||hidden text||
                // ------------------------------------------

                {
                    name: "spoiler",
                    level: "inline",

                    start(source) {
                        const index = source.indexOf("||");

                        return index === -1
                            ? undefined
                            : index;
                    },

                    tokenizer(source) {
                        const match = /^\|\|([\s\S]+?)\|\|/.exec(source);

                        if (!match) return undefined;

                        return {
                            type: "spoiler",
                            raw: match[0],
                            text: match[1]
                        };
                    },

                    renderer(token) {
                        /*
                         * Escape spoiler contents so they cannot inject
                         * HTML into the rendered post.
                         */
                        return `
                            <span
                                class="thread-spoiler"
                                tabindex="0"
                                role="button"
                                aria-expanded="false"
                                aria-label="Spoiler. Activate to reveal."
                            >${escapeHtml(token.text)}</span>
                        `;
                    }
                }
            ]
        });

        return true;
    }

    function formatPostContent(content) {
        if (!content) return "";

        if (!window.marked || !window.DOMPurify) {
            return escapeHtml(content).replace(/\n/g, "<br>");
        }

        try {
            const rawHtml = window.marked.parse(
                String(content)
            );

            return window.DOMPurify.sanitize(rawHtml, {
                USE_PROFILES: {
                    html: true
                }
            });
        } catch (error) {
            console.error(
                "Markdown rendering error:",
                error
            );

            return escapeHtml(content).replace(/\n/g, "<br>");
        }
    }

    // --------------------------------------------------
    // Formatting toolbar
    // --------------------------------------------------

    function applyFormatting(textarea, format) {
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.slice(start, end);

        const wrappers = {
            bold: ["**", "**", "bold text"],
            italic: ["*", "*", "italic text"],
            strike: ["~~", "~~", "strikethrough text"],
            spoiler: ["||", "||", "spoiler text"],
            code: ["`", "`", "code"]
        };

        if (format === "quote") {
            const value = textarea.value;

            const lineStart =
                value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;

            const lineEndIndex = value.indexOf("\n", end);

            const lineEnd = lineEndIndex === -1
                ? value.length
                : lineEndIndex;

            const selectionEnd = selected
                ? end
                : lineEnd;

            const text = value.slice(
                lineStart,
                selectionEnd
            );

            const quoted = text
                .split("\n")
                .map(line => {
                    if (line.startsWith("> ")) {
                        return line;
                    }

                    if (line.startsWith(">")) {
                        return `> ${line.slice(1)}`;
                    }

                    return `> ${line}`;
                })
                .join("\n");

            textarea.setRangeText(
                quoted,
                lineStart,
                selectionEnd,
                "select"
            );

            textarea.setSelectionRange(
                lineStart,
                lineStart + quoted.length
            );
        } else {
            const wrapper = wrappers[format];

            if (!wrapper) return;

            const [prefix, suffix, placeholder] = wrapper;
            const insertedText = selected || placeholder;

            const replacement =
                prefix + insertedText + suffix;

            textarea.setRangeText(
                replacement,
                start,
                end,
                "select"
            );

            if (!selected) {
                textarea.setSelectionRange(
                    start + prefix.length,
                    start + prefix.length + placeholder.length
                );
            } else {
                textarea.setSelectionRange(
                    start + prefix.length,
                    start + prefix.length + selected.length
                );
            }
        }

        textarea.focus();

        textarea.dispatchEvent(
            new Event("input", {
                bubbles: true
            })
        );
    }

    function setupFormattingToolbar(container, textarea) {
        const toolbar = container.querySelector(
            ".reply-formatting-toolbar"
        );

        if (!toolbar || !textarea) return;

        toolbar.addEventListener("click", event => {
            const target = event.target;

            if (!(target instanceof Element)) return;

            const button = target.closest("[data-format]");

            if (!button || !toolbar.contains(button)) return;

            event.preventDefault();

            applyFormatting(
                textarea,
                button.dataset.format
            );
        });
    }

    // --------------------------------------------------
    // Post references and spoiler interactions
    // --------------------------------------------------

    function setupPostReferenceLinks() {
        document.addEventListener("click", event => {
            const target = event.target;

            if (!(target instanceof Element)) return;

            // Spoiler activation.
            const spoiler = target.closest(".thread-spoiler");

            if (spoiler) {
                spoiler.classList.toggle("revealed");

                const revealed =
                    spoiler.classList.contains("revealed");

                spoiler.setAttribute(
                    "aria-expanded",
                    String(revealed)
                );

                spoiler.setAttribute(
                    "aria-label",
                    revealed
                        ? "Spoiler revealed. Activate to hide."
                        : "Spoiler hidden. Activate to reveal."
                );

                return;
            }

            // Post-reference activation.
            const link = target.closest(
                "[data-post-reference]"
            );

            if (!link) return;

            const postId = link.dataset.postReference;

            const post = document.getElementById(
                `post-${postId}`
            );

            if (!post) return;

            event.preventDefault();

            post.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

            post.classList.add(
                "thread-post-reference-highlight"
            );

            window.history.replaceState(
                null,
                "",
                `#post-${postId}`
            );

            window.setTimeout(() => {
                post.classList.remove(
                    "thread-post-reference-highlight"
                );
            }, 1800);
        });

        // Keyboard support for spoilers.
        document.addEventListener("keydown", event => {
            if (
                event.key !== "Enter" &&
                event.key !== " "
            ) {
                return;
            }

            if (!(event.target instanceof Element)) return;

            const spoiler = event.target.closest(
                ".thread-spoiler"
            );

            if (!spoiler) return;

            event.preventDefault();

            // The click listener performs the actual toggle.
            spoiler.click();
        });
    }

    // --------------------------------------------------
    // Reporting
    // --------------------------------------------------

    function ensureReportDialog() {
        if (document.getElementById("reportDialog")) {
            return;
        }

        const dialog = document.createElement("dialog");

        dialog.id = "reportDialog";
        dialog.className = "report-dialog";

        dialog.innerHTML = `
            <form
                method="dialog"
                class="report-dialog-form"
                id="reportDialogForm"
            >
                <h2>Report content</h2>

                <p class="report-dialog-intro">
                    Tell the moderation team what is wrong
                    with this content. ♡
                </p>

                <label for="reportReason">Reason</label>

                <select id="reportReason" name="reason" required>
                    <option value="" selected disabled>
                        Choose a reason...
                    </option>

                    ${REPORT_REASONS.map(reason => `
                        <option value="${escapeHtml(reason)}">
                            ${escapeHtml(reason)}
                        </option>
                    `).join("")}
                </select>

                <label for="reportDetails">
                    Details
                    <span class="optional-label">optional</span>
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
                    >Cancel</button>

                    <button
                        type="submit"
                        id="reportDialogSubmit"
                    >Submit report</button>
                </div>
            </form>
        `;

        document.body.appendChild(dialog);

        document.getElementById("reportDialogCancel")
            .addEventListener("click", () => {
                dialog.close();
            });

        document.getElementById("reportDialogForm")
            .addEventListener("submit", async event => {
                event.preventDefault();

                await submitReport();
            });
    }

    function openReportDialog(targetType, targetId) {
        if (
            !REPORT_TARGET_TYPES.has(targetType) ||
            !targetId
        ) {
            return;
        }

        ensureReportDialog();

        currentReportTarget = {
            targetType,
            targetId
        };

        document.getElementById("reportReason").value = "";
        document.getElementById("reportDetails").value = "";

        document.getElementById(
            "reportDialogMessage"
        ).textContent = "";

        const submitButton = document.getElementById(
            "reportDialogSubmit"
        );

        submitButton.disabled = false;
        submitButton.textContent = "Submit report";

        const dialog = document.getElementById("reportDialog");

        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
    }

    async function submitReport() {
        if (!currentReportTarget || !client) return;

        const reason = document.getElementById(
            "reportReason"
        ).value;

        const details = document.getElementById(
            "reportDetails"
        ).value.trim();

        const message = document.getElementById(
            "reportDialogMessage"
        );

        const submitButton = document.getElementById(
            "reportDialogSubmit"
        );

        if (!reason) {
            message.textContent = "Please choose a reason.";
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
        message.textContent = "";

        let submitted = false;

        try {
            const {
                data: { user } = {},
                error: userError
            } = await client.auth.getUser();

            if (userError || !user) {
                message.textContent =
                    "You must be logged in to submit a report. ♡";

                return;
            }

            const { error } = await client.rpc(
                "create_report",
                {
                    p_target_type: currentReportTarget.targetType,
                    p_target_id: currentReportTarget.targetId,
                    p_reason: reason,
                    p_details: details || null
                }
            );

            if (error) {
                console.error(
                    "Report submission error:",
                    error
                );

                message.textContent = getErrorMessage(
                    error,
                    "Unable to submit the report."
                );

                return;
            }

            submitted = true;

            message.textContent =
                "Report submitted. Thank you. ♡";

            window.setTimeout(() => {
                const currentDialog = document.getElementById(
                    "reportDialog"
                );

                if (currentDialog?.open) {
                    currentDialog.close();
                }

                currentReportTarget = null;
            }, 700);
        } catch (error) {
            console.error(
                "Unexpected report error:",
                error
            );

            message.textContent =
                "Something went wrong while submitting the report.";
        } finally {
            if (!submitted) {
                submitButton.disabled = false;
                submitButton.textContent = "Submit report";
            }
        }
    }

    function setupReportButtons() {
        document.addEventListener("click", event => {
            const target = event.target;

            if (!(target instanceof Element)) return;

            const button = target.closest(
                "[data-report-target-type][data-report-target-id]"
            );

            if (!button) return;

            event.preventDefault();

            openReportDialog(
                button.dataset.reportTargetType,
                button.dataset.reportTargetId
            );
        });
    }

    // --------------------------------------------------
    // Load thread and posts
    // --------------------------------------------------

    async function loadThread() {
        if (!client || !threadPage) return;

        const threadId = getThreadId();

        if (!threadId) {
            renderError("No thread was specified.");
            return;
        }

        try {
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

            if (threadError || !thread) {
                console.error(
                    "Thread loading error:",
                    threadError
                );

                renderError("Unable to load this thread.");
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
                .order("created_at", {
                    ascending: true
                });

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

            const loadedPosts = posts || [];

            buildPostNumbers(loadedPosts);

            renderThread(thread, loadedPosts);

            await setupReplyForm(thread);
        } catch (error) {
            console.error(
                "Unexpected thread loading error:",
                error
            );

            renderError(
                "Something went wrong while loading this thread."
            );
        }
    }

    // --------------------------------------------------
    // Render thread
    // --------------------------------------------------

    function renderThread(thread, posts) {
        const visiblePosts = posts.filter(
            post => !post.is_hidden
        );

        const openingPost = visiblePosts[0] || null;
        const replies = visiblePosts.slice(1);

        const board = thread.boards;
        const boardName = board?.name || "Imageboard";
        const boardSlug = board?.slug || "";

        const statuses = [];

        if (thread.is_locked) {
            statuses.push(
                '<span class="thread-status">Locked</span>'
            );
        }

        if (thread.is_archived) {
            statuses.push(
                '<span class="thread-status">Archived</span>'
            );
        }

        threadPage.innerHTML = `
            <section class="thread-header">
                <p class="board-slug">
                    /${escapeHtml(boardSlug)}/
                </p>

                <h2>${escapeHtml(thread.title)}</h2>

                <p class="thread-header-meta">
                    ${escapeHtml(boardName)}
                    · Started ${escapeHtml(formatDate(thread.created_at))}
                </p>

                ${statuses.length
                    ? `<div class="thread-statuses">${statuses.join("")}</div>`
                    : ""}

                <div class="thread-header-actions">
                    <a href="imageboard.html">Back to boards</a>

                    <button
                        type="button"
                        class="thread-report-button"
                        data-report-target-type="imageboard_thread"
                        data-report-target-id="${escapeHtml(thread.id)}"
                    >⚑ Report thread</button>
                </div>
            </section>

            <section class="thread-posts">
                ${openingPost
                    ? renderPost(openingPost, true)
                    : `<p class="thread-empty">This thread has no visible posts.</p>`}

                <div class="thread-replies">
                    ${replies.map(post => renderPost(post, false)).join("")}
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

    function renderPost(post, isOpeningPost) {
        const profile = post.profiles;
        const isAnonymous = Boolean(post.is_anonymous);

        const displayName = isAnonymous
            ? "Anonymous"
            : (
                profile?.display_name ||
                profile?.username ||
                "User"
            );

        const username = isAnonymous
            ? "anonymous"
            : (profile?.username || "");

        const postNumber = currentPostNumbers.get(post.id);

        const images = Array.isArray(post.post_images)
            ? post.post_images
            : [];

        const imageMarkup = images.length
            ? `
                <div class="thread-post-images">
                    ${images.map(image => {
                        const url = getImageUrl(
                            image.storage_path
                        );

                        if (!url) return "";

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
                                        image.alt_text || "Attached image"
                                    )}"
                                    class="thread-post-image"
                                    loading="lazy"
                                >
                            </a>
                        `;
                    }).join("")}
                </div>
            `
            : "";

        return `
            <article
                class="thread-post ${isOpeningPost ? "thread-op" : ""}"
                id="post-${escapeHtml(post.id)}"
            >
                <header class="thread-post-header">
                    <strong>${escapeHtml(displayName)}</strong>

                    ${username
                        ? `<span class="thread-post-username">@${escapeHtml(username)}</span>`
                        : ""}

                    <time>${escapeHtml(formatDate(post.created_at))}</time>

                    ${postNumber
                        ? `<a
                            href="#post-${escapeHtml(post.id)}"
                            class="thread-post-number"
                        >No. ${postNumber}</a>`
                        : ""}

                    ${isOpeningPost
                        ? '<span class="thread-post-label">OP</span>'
                        : ""}

                    <button
                        type="button"
                        class="thread-post-report-button"
                        data-report-target-type="imageboard_post"
                        data-report-target-id="${escapeHtml(post.id)}"
                    >⚑ Report</button>
                </header>

                <div class="thread-post-body">
                    ${imageMarkup}

                    <div class="thread-post-content">
                        ${formatPostContent(post.content)}
                    </div>
                </div>
            </article>
        `;
    }

    // --------------------------------------------------
    // Reply form
    // --------------------------------------------------

    async function setupReplyForm(thread) {
        const container = document.getElementById(
            "replyFormContainer"
        );

        if (!container) return;

        if (thread.is_locked || thread.is_archived) {
            container.innerHTML = `
                <p class="thread-empty">
                    This thread is closed for replies.
                </p>
            `;

            return;
        }

        try {
            const {
                data: { user } = {},
                error
            } = await client.auth.getUser();

            if (error || !user) {
                container.innerHTML = `
                    <p class="thread-empty">
                        You must be logged in to reply.
                    </p>
                `;

                return;
            }

            container.innerHTML = `
                <form id="replyForm">
                    <label for="replyContent">Message</label>

                    <div
                        class="reply-formatting-toolbar"
                        role="toolbar"
                        aria-label="Reply formatting"
                    >
                        <button
                            type="button"
                            data-format="bold"
                            title="Bold"
                        ><strong>B</strong></button>

                        <button
                            type="button"
                            data-format="italic"
                            title="Italic"
                        ><em>I</em></button>

                        <button
                            type="button"
                            data-format="strike"
                            title="Strikethrough"
                        ><s>S</s></button>

                        <button
                            type="button"
                            data-format="quote"
                            title="Violet quote text"
                        >❝</button>

                        <button
                            type="button"
                            data-format="spoiler"
                            title="Spoiler"
                        >▰</button>

                        <button
                            type="button"
                            data-format="code"
                            title="Inline code"
                        >&lt;/&gt;</button>
                    </div>

                    <textarea
                        id="replyContent"
                        maxlength="10000"
                        rows="6"
                        placeholder="Write your reply..."
                    ></textarea>

                    <p class="reply-formatting-help">
                        Select text and use a button, or click one to start
                        formatting. Start a line with &gt; for violet quote text.
                    </p>

                    <label for="replyImage">
                        Image
                        <span class="optional-label">optional</span>
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

                    <button type="submit">Post reply</button>
                </form>
            `;

            setupFormattingToolbar(
                container,
                document.getElementById("replyContent")
            );

            setupReplyImagePreview();

            document.getElementById("replyForm")
                .addEventListener("submit", async event => {
                    event.preventDefault();

                    await submitReply(thread);
                });
        } catch (error) {
            console.error(
                "Reply form setup error:",
                error
            );

            container.innerHTML = `
                <p class="thread-empty">
                    Unable to load the reply form. Please refresh.
                </p>
            `;
        }
    }

    function setupReplyImagePreview() {
        const input = document.getElementById("replyImage");
        const preview = document.getElementById(
            "replyImagePreview"
        );

        if (!input || !preview) return;

        input.addEventListener("change", () => {
            if (activePreviewUrl) {
                URL.revokeObjectURL(activePreviewUrl);
                activePreviewUrl = null;
            }

            preview.replaceChildren();
            preview.hidden = true;

            const file = input.files?.[0];

            if (!file) return;

            if (!file.type.startsWith("image/")) {
                preview.textContent =
                    "Please choose a valid image file.";

                preview.hidden = false;
                input.value = "";

                return;
            }

            if (file.size > MAX_IMAGE_SIZE) {
                preview.textContent =
                    "This image is larger than 10 MB.";

                preview.hidden = false;
                input.value = "";

                return;
            }

            activePreviewUrl = URL.createObjectURL(file);

            const image = document.createElement("img");

            image.src = activePreviewUrl;
            image.alt = "Image preview";

            const filename = document.createElement("p");

            filename.textContent = file.name;

            preview.append(image, filename);
            preview.hidden = false;
        });
    }

    // --------------------------------------------------
    // Submit reply and optional image
    // --------------------------------------------------

    async function submitReply(thread) {
        if (isSubmittingReply) return;

        if (!client) {
            setReplyMessage("Supabase is not available.");
            return;
        }

        const contentInput = document.getElementById(
            "replyContent"
        );

        const imageInput = document.getElementById(
            "replyImage"
        );

        const anonymousInput = document.getElementById(
            "replyAnonymous"
        );

        const message = getReplyMessage();

        if (
            !contentInput ||
            !imageInput ||
            !anonymousInput ||
            !message
        ) {
            return;
        }

        const content = contentInput.value.trim();
        const file = imageInput.files?.[0] || null;
        const isAnonymous = anonymousInput.checked;

        if (!content && !file) {
            message.textContent =
                "Please write a message or choose an image.";

            return;
        }

        if (file && !file.type.startsWith("image/")) {
            message.textContent =
                "Please choose a valid image file.";

            return;
        }

        if (file && file.size > MAX_IMAGE_SIZE) {
            message.textContent =
                "That image is larger than 10 MB.";

            return;
        }

        isSubmittingReply = true;

        setSubmitButtonState(true, "Posting...");

        message.textContent = "";

        let postId = null;
        let replyCreated = false;
        let imageSaved = false;
        let failureMessage = null;

        try {
            const {
                data: { user } = {},
                error: userError
            } = await client.auth.getUser();

            if (userError || !user) {
                throw new Error(
                    "Your session may have expired. Please log in again."
                );
            }

            const userId = user.id;

            const {
                data: createdPostId,
                error: postError
            } = await client.rpc(
                "create_imageboard_post",
                {
                    p_thread_id: thread.id,
                    p_content: content || null,
                    p_is_anonymous: isAnonymous,
                    p_has_image: Boolean(file)
                }
            );

            if (postError) {
                throw new Error(
                    getErrorMessage(
                        postError,
                        "Unable to create the reply."
                    )
                );
            }

            postId = createdPostId;

            if (!postId) {
                throw new Error(
                    "The server did not return the new post ID."
                );
            }

            replyCreated = true;

            if (file) {
                const extensionFromName = file.name.includes(".")
                    ? file.name.split(".").pop().toLowerCase()
                    : "";

                const extension = /^[a-z0-9]{1,10}$/.test(
                    extensionFromName
                )
                    ? extensionFromName
                    : "img";

                const storagePath = [
                    userId,
                    thread.id,
                    `${postId}.${extension}`
                ].join("/");

                const { error: uploadError } = await client.storage
                    .from(STORAGE_BUCKET)
                    .upload(storagePath, file, {
                        upsert: false,
                        contentType: file.type
                    });

                if (uploadError) {
                    console.error(
                        "Image upload error:",
                        uploadError
                    );

                    throw new Error(
                        "Your reply was posted, but the image upload failed. Your reply is still saved."
                    );
                }

                const { error: imageInsertError } = await client
                    .from("post_images")
                    .insert({
                        post_id: postId,
                        storage_path: storagePath,
                        alt_text: file.name
                    });

                if (imageInsertError) {
                    console.error(
                        "Post image record error:",
                        imageInsertError
                    );

                    throw new Error(
                        "Your reply was posted and the image uploaded, but its image record could not be saved. Please contact a moderator if the image remains missing."
                    );
                }

                imageSaved = true;
            }
        } catch (error) {
            console.error(
                "Reply submission error:",
                error
            );

            failureMessage = getErrorMessage(
                error,
                "Something went wrong while posting your reply."
            );
        } finally {
            isSubmittingReply = false;
        }

        if (replyCreated) {
            await loadThread();

            if (failureMessage) {
                setReplyMessage(failureMessage);
            } else if (imageSaved || !file) {
                setReplyMessage(
                    "Reply posted successfully! ♡"
                );
            }

            if (postId) {
                window.setTimeout(() => {
                    const post = document.getElementById(
                        `post-${postId}`
                    );

                    if (!post) return;

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
                }, 100);
            }

            return;
        }

        setReplyMessage(
            failureMessage ||
            "Something went wrong while posting your reply."
        );

        setSubmitButtonState(false, "Post reply");
    }

    // --------------------------------------------------
    // Initialize
    // --------------------------------------------------

    if (!client) {
        renderError(
            "Supabase is not available. Please refresh the page."
        );

        return;
    }

    if (!threadPage) {
        console.error(
            'Could not find the "#threadPage" element.'
        );

        return;
    }

    ensureFormattingStyles();

    ensureReportDialog();

    setupReportButtons();

    setupPostReferenceLinks();

    if (!configureMarkdown()) {
        console.warn(
            "Posts will display as plain text until Markdown dependencies load."
        );
    }

    loadThread();
})();
//crap