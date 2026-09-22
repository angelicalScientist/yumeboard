(() => {
    "use strict";

    const client = window.supabaseClient;

    const threadPage =
        document.getElementById("threadPage");

    const STORAGE_BUCKET =
        "imageboard-images";

    let currentPostNumbers = new Map();

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

    function formatDate(dateString) {
        const date =
            new Date(dateString);

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
            return "";
        }

        const { data } =
            client.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(storagePath);

        return data?.publicUrl || "";
    }

    function renderError(message) {
        threadPage.innerHTML = `
            <div class="imageboard-error">
                <p>
                    ${escapeHtml(message)}
                </p>

                <a href="./imageboard.html">
                    Back to imageboard
                </a>
            </div>
        `;
    }

    function buildPostNumbers(posts) {
        currentPostNumbers =
            new Map();

        let visibleNumber = 0;

        posts.forEach((post) => {
            if (post.is_hidden) {
                post.threadNumber = null;
                return;
            }

            visibleNumber += 1;

            post.threadNumber =
                visibleNumber;

            currentPostNumbers.set(
                visibleNumber,
                post.id
            );
        });
    }

    function formatPostContent(content) {
        if (!content) {
            return "";
        }

        const escaped =
            escapeHtml(content);

        return escaped
            .split("\n")
            .map((line) =>
                formatPostLine(line)
            )
            .join("<br>");
    }

    function formatPostLine(line) {
        const referencePattern =
            /&gt;&gt;(\d+)/g;

        let formattedLine = "";
        let lastIndex = 0;
        let match;

        while (
            (match =
                referencePattern.exec(
                    line
                )) !== null
        ) {
            formattedLine +=
                escapeFormattedText(
                    line.slice(
                        lastIndex,
                        match.index
                    )
                );

            const referencedNumber =
                Number(match[1]);

            const referencedPostId =
                currentPostNumbers.get(
                    referencedNumber
                );

            if (referencedPostId) {
                formattedLine += `
                    <a
                        class="thread-post-reference"
                        href="#post-${escapeHtml(
                            referencedPostId
                        )}"
                        data-post-number="${referencedNumber}"
                    >&gt;&gt;${referencedNumber}</a>
                `;
            } else {
                formattedLine +=
                    `&gt;&gt;${referencedNumber}`;
            }

            lastIndex =
                referencePattern.lastIndex;
        }

        formattedLine +=
            escapeFormattedText(
                line.slice(lastIndex)
            );

        if (
            line.startsWith("&gt;") &&
            !line.startsWith("&gt;&gt;")
        ) {
            return `
                <span class="thread-quotetext">
                    ${formattedLine}
                </span>
            `.trim();
        }

        return formattedLine;
    }

    function escapeFormattedText(value) {
        return value;
    }

    function setupPostReferenceLinks() {
        const referenceLinks =
            threadPage.querySelectorAll(
                ".thread-post-reference"
            );

        referenceLinks.forEach((link) => {
            link.addEventListener(
                "click",
                (event) => {
                    const href =
                        link.getAttribute(
                            "href"
                        );

                    if (
                        !href ||
                        !href.startsWith(
                            "#post-"
                        )
                    ) {
                        return;
                    }

                    const targetPost =
                        document.querySelector(
                            href
                        );

                    if (!targetPost) {
                        return;
                    }

                    event.preventDefault();

                    targetPost.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

                    targetPost.classList.remove(
                        "thread-post-reference-highlight"
                    );

                    void targetPost.offsetWidth;

                    targetPost.classList.add(
                        "thread-post-reference-highlight"
                    );

                    window.history.replaceState(
                        null,
                        "",
                        href
                    );

                    window.setTimeout(
                        () => {
                            targetPost.classList.remove(
                                "thread-post-reference-highlight"
                            );
                        },
                        1400
                    );
                }
            );
        });
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

        threadPage.innerHTML = `
            <p class="loading-message">
                Loading thread... ♡
            </p>
        `;

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

        if (
            threadError ||
            !thread
        ) {
            console.error(
                threadError
            );

            renderError(
                "That thread could not be found."
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
            .eq("thread_id", thread.id)
            .order("created_at", {
                ascending: true
            });

        if (postsError) {
            console.error(
                postsError
            );

            renderError(
                "The posts could not be loaded."
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

        setupPostReferenceLinks();
    }

    function renderThread(
        thread,
        posts
    ) {
        const board =
            thread.boards;

        const visiblePosts =
            posts.filter(
                (post) =>
                    !post.is_hidden
            );

        const openingPost =
            visiblePosts[0] || null;

        const replies =
            visiblePosts.slice(1);

        const boardName =
            board?.name ||
            "Imageboard";

        const boardSlug =
            board?.slug || "";

        const statusParts = [];

        if (thread.is_locked) {
            statusParts.push(
                `
                    <span class="thread-status thread-status-locked">
                        Locked
                    </span>
                `
            );
        }

        if (thread.is_archived) {
            statusParts.push(
                `
                    <span class="thread-status thread-status-archived">
                        Archived
                    </span>
                `
            );
        }

        const statusHtml =
            statusParts.length
                ? `
                    <div class="thread-statuses">
                        ${statusParts.join("")}
                    </div>
                `
                : "";

        threadPage.innerHTML = `
            <div class="thread-page-header">

                <div class="thread-page-header-top">

                    <div>
                        <p class="thread-board-name">
                            <a
                                href="./imageboard.html?board=${encodeURIComponent(
                                    boardSlug
                                )}"
                            >
                                ${escapeHtml(
                                    boardName
                                )}
                            </a>
                        </p>

                        <h2>
                            ${escapeHtml(
                                thread.title
                            )}
                        </h2>

                        <p class="thread-meta">
                            Started
                            ${escapeHtml(
                                formatDate(
                                    thread.created_at
                                )
                            )}
                        </p>
                    </div>

                    ${statusHtml}

                </div>

                <div class="thread-navigation">

                    <a
                        href="./imageboard.html?board=${encodeURIComponent(
                            boardSlug
                        )}"
                    >
                        ← Back to board
                    </a>

                    <a href="./imageboard.html">
                        Imageboard home
                    </a>

                </div>

            </div>

            <section
                class="thread-posts"
                aria-label="Thread posts"
            >
                ${
                    openingPost
                        ? renderPost(
                            openingPost,
                            true
                        )
                        : `
                            <p class="thread-empty-message">
                                This thread has no visible posts.
                            </p>
                        `
                }

                ${replies
                    .map((post) =>
                        renderPost(
                            post,
                            false
                        )
                    )
                    .join("")}
            </section>

            <section
                id="threadReplySection"
                class="thread-reply-section"
            >
            </section>
        `;
    }

    function renderPost(
        post,
        isOpeningPost
    ) {
        const profile =
            post.profiles;

        const displayName =
            post.is_anonymous
                ? "Anonymous"
                : (
                    profile?.display_name ||
                    profile?.username ||
                    "Unknown user"
                );

        const username =
            post.is_anonymous
                ? ""
                : (
                    profile?.username ||
                    "unknown"
                );

        const postNumber =
            post.threadNumber;

        const postNumberHtml =
            postNumber
                ? `
                    <a
                        class="thread-post-number"
                        href="#post-${escapeHtml(
                            post.id
                        )}"
                        aria-label="Link to post ${postNumber}"
                    >
                        No. ${postNumber}
                    </a>
                `
                : "";

        const images =
            Array.isArray(
                post.post_images
            )
                ? post.post_images
                : [];

        const imageHtml =
            images
                .map((image) => {
                    const fullImageUrl =
                        getImageUrl(
                            image.storage_path
                        );

                    if (!fullImageUrl) {
                        return "";
                    }

                    return `
                        <a
                            class="thread-post-image-link"
                            href="${escapeHtml(
                                fullImageUrl
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View full-size image"
                        >
                            <img
                                class="thread-post-image"
                                src="${escapeHtml(
                                    fullImageUrl
                                )}"
                                alt="${escapeHtml(
                                    image.alt_text ||
                                    "Attached image"
                                )}"
                                loading="lazy"
                            >
                        </a>
                    `;
                })
                .join("");

        const content =
            formatPostContent(
                post.content
            );

        const postClass =
            isOpeningPost
                ? "thread-post thread-op"
                : "thread-post thread-reply";

        return `
            <article
                class="${postClass}"
                id="post-${escapeHtml(
                    post.id
                )}"
            >

                <header class="thread-post-header">

                    <div class="thread-post-user">

                        <strong>
                            ${escapeHtml(
                                displayName
                            )}
                        </strong>

                        ${
                            username
                                ? `
                                    <span class="thread-post-username">
                                        @${escapeHtml(
                                            username
                                        )}
                                    </span>
                                `
                                : ""
                        }

                    </div>

                    <div class="thread-post-info">

                        ${postNumberHtml}

                        <time
                            datetime="${escapeHtml(
                                post.created_at
                            )}"
                        >
                            ${escapeHtml(
                                formatDate(
                                    post.created_at
                                )
                            )}
                        </time>

                        ${
                            isOpeningPost
                                ? `
                                    <span class="thread-op-label">
                                        OP
                                    </span>
                                `
                                : ""
                        }

                    </div>

                </header>

                <div class="thread-post-body">

                    ${
                        imageHtml
                            ? `
                                <div class="thread-post-images">
                                    ${imageHtml}
                                </div>
                            `
                            : ""
                    }

                    ${
                        content
                            ? `
                                <div class="thread-post-content">
                                    ${content}
                                </div>
                            `
                            : ""
                    }

                </div>

            </article>
        `;
    }

    async function setupReplyForm(thread) {
        const replySection =
            document.getElementById(
                "threadReplySection"
            );

        if (!replySection) {
            return;
        }

        if (
            thread.is_locked ||
            thread.is_archived
        ) {
            replySection.innerHTML = `
                <div class="thread-reply-closed">
                    <p>
                        ${
                            thread.is_archived
                                ? "This thread is archived."
                                : "This thread is locked."
                        }
                    </p>
                </div>
            `;

            return;
        }

        const {
            data: {
                user
            }
        } = await client.auth.getUser();

        if (!user) {
            replySection.innerHTML = `
                <div class="thread-reply-closed">
                    <p>
                        You must be logged in to reply.
                    </p>

                    <a href="./account.html">
                        Log in
                    </a>
                </div>
            `;

            return;
        }

        replySection.innerHTML = `
            <div class="thread-reply-box">

                <h3>
                    Reply to this thread
                </h3>

                <form id="replyForm">

                    <label for="replyContent">
                        Message
                        <span class="optional-label">
                            optional
                        </span>
                    </label>

                    <textarea
                        id="replyContent"
                        rows="6"
                        maxlength="10000"
                        placeholder="Write your reply... ♡"
                    ></textarea>

                    <label for="replyImage">
                        Add an image
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
                        Maximum file size: 10 MB.
                    </p>

                    <div
                        id="replyImagePreview"
                        class="image-preview"
                        hidden
                    >
                        <img
                            id="replyImagePreviewImage"
                            alt="Selected image preview"
                        >

                        <p id="replyImagePreviewName"></p>
                    </div>

                    <label class="imageboard-anonymous-option">
                        <input
                            type="checkbox"
                            id="anonymousReply"
                        >
                        Reply anonymously
                    </label>

                    <p
                        id="replyMessage"
                        class="editor-message"
                        aria-live="polite"
                    ></p>

                    <div class="thread-reply-actions">

                        <button
                            type="submit"
                            id="replyButton"
                        >
                            ♡ Post reply
                        </button>

                    </div>

                </form>

            </div>
        `;

        const form =
            document.getElementById(
                "replyForm"
            );

        const contentInput =
            document.getElementById(
                "replyContent"
            );

        const imageInput =
            document.getElementById(
                "replyImage"
            );

        const imagePreview =
            document.getElementById(
                "replyImagePreview"
            );

        const imagePreviewImage =
            document.getElementById(
                "replyImagePreviewImage"
            );

        const imagePreviewName =
            document.getElementById(
                "replyImagePreviewName"
            );

        const replyMessage =
            document.getElementById(
                "replyMessage"
            );

        const replyButton =
            document.getElementById(
                "replyButton"
            );

        const anonymousReply =
            document.getElementById(
                "anonymousReply"
            );

        let selectedImage = null;

        imageInput.addEventListener(
            "change",
            () => {
                const file =
                    imageInput.files?.[0] ||
                    null;

                selectedImage = null;

                imagePreview.hidden =
                    true;

                imagePreviewImage
                    .removeAttribute(
                        "src"
                    );

                imagePreviewName
                    .textContent = "";

                if (!file) {
                    return;
                }

                if (
                    !file.type.startsWith(
                        "image/"
                    )
                ) {
                    replyMessage.textContent =
                        "Please choose an image file.";

                    imageInput.value =
                        "";

                    return;
                }

                if (
                    file.size >
                    10 * 1024 * 1024
                ) {
                    replyMessage.textContent =
                        "That image is too large. Maximum size is 10 MB.";

                    imageInput.value =
                        "";

                    return;
                }

                selectedImage =
                    file;

                imagePreviewImage.src =
                    URL.createObjectURL(
                        file
                    );

                imagePreviewName.textContent =
                    file.name;

                imagePreview.hidden =
                    false;

                replyMessage.textContent =
                    "";
            }
        );

        form.addEventListener(
            "submit",
            async (event) => {
                event.preventDefault();

                replyMessage.textContent =
                    "";

                const content =
                    contentInput.value.trim();

                const isAnonymous =
                    anonymousReply?.checked === true;

                if (
                    !content &&
                    !selectedImage
                ) {
                    replyMessage.textContent =
                        "Please add a message or an image.";

                    return;
                }

                if (
                    content.length >
                    10000
                ) {
                    replyMessage.textContent =
                        "Your message is too long.";

                    return;
                }

                replyButton.disabled =
                    true;

                replyButton.textContent =
                    "Posting...";

                try {
                    const {
                        data: {
                            user: currentUser
                        }
                    } =
                        await client.auth.getUser();

                    if (!currentUser) {
                        throw new Error(
                            "You must be logged in to reply."
                        );
                    }

                    const {
                        data: postId,
                        error: postError
                    } = await client.rpc(
                        "create_imageboard_post",
                        {
                            p_thread_id:
                                thread.id,
                            p_content:
                                content || null,
                            p_is_anonymous:
                                isAnonymous,
                            p_has_image:
                                Boolean(selectedImage)
                        }
                    );

                    if (postError) {
                        throw postError;
                    }

                    const post = {
                        id: postId
                    };

                    if (selectedImage) {
                        const extension =
                            selectedImage.name
                                .split(".")
                                .pop()
                                ?.toLowerCase() ||
                            "jpg";

                        const storagePath = [
                            currentUser.id,
                            thread.id,
                            `${crypto.randomUUID()}.${extension}`
                        ].join("/");

                        const {
                            error: uploadError
                        } =
                            await client.storage
                                .from(
                                    STORAGE_BUCKET
                                )
                                .upload(
                                    storagePath,
                                    selectedImage,
                                    {
                                        cacheControl:
                                            "3600",

                                        contentType:
                                            selectedImage.type,

                                        upsert:
                                            false
                                    }
                                );

                        if (uploadError) {
                            throw uploadError;
                        }

                        const {
                            error: imageRowError
                        } = await client
                            .from("post_images")
                            .insert({
                                post_id:
                                    post.id,

                                storage_path:
                                    storagePath,

                                alt_text:
                                    null
                            });

                        if (imageRowError) {
                            throw imageRowError;
                        }
                    }

                    window.location.hash =
                        `post-${post.id}`;

                    await loadThread();

                    const newPost =
                        document.getElementById(
                            `post-${post.id}`
                        );

                    if (newPost) {
                        newPost.scrollIntoView({
                            behavior:
                                "smooth",

                            block:
                                "center"
                        });

                        newPost.classList.add(
                            "thread-post-reference-highlight"
                        );

                        window.setTimeout(
                            () => {
                                newPost.classList.remove(
                                    "thread-post-reference-highlight"
                                );
                            },
                            1400
                        );
                    }

                } catch (error) {
                    console.error(error);

                    replyMessage.textContent =
                        error.message ||
                        "Something went wrong while posting.";

                } finally {
                    replyButton.disabled =
                        false;

                    replyButton.textContent =
                        "♡ Post reply";
                }
            }
        );
    }

    loadThread();
})();