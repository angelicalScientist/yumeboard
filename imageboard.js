(() => {

    "use strict";

    const client = window.supabaseClient;

    if (!client) {
        console.error(
            "Imageboard: Supabase client not found."
        );
        return;
    }

    const boardsList =
        document.getElementById("boardsList");

    const recentThreads =
        document.getElementById("recentThreads");

    const newThreadButton =
        document.getElementById("newThreadButton");

    const STORAGE_BUCKET = "imageboard-images";

    function getBoardSlug() {
        const params = new URLSearchParams(
            window.location.search
        );

        return params.get("board");
    }

    function getImageUrl(storagePath) {
        if (!storagePath) {
            return "";
        }

        const { data } = client.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(storagePath);

        return data?.publicUrl || "";
    }

    function getOpeningImage(thread) {
        if (!Array.isArray(thread.posts)) {
            return null;
        }

        const visiblePosts = thread.posts
            .filter((post) => !post.is_hidden)
            .sort((a, b) => {
                return (
                    new Date(a.created_at) -
                    new Date(b.created_at)
                );
            });

        const openingPost = visiblePosts[0];

        if (!openingPost) {
            return null;
        }

        if (
            !Array.isArray(openingPost.post_images) ||
            openingPost.post_images.length === 0
        ) {
            return null;
        }

        return openingPost.post_images[0];
    }

    async function loadBoardPage(slug) {
        const {
            data: board,
            error: boardError
        } = await client
            .from("boards")
            .select(`
                id,
                name,
                slug,
                description
            `)
            .eq("slug", slug)
            .maybeSingle();

        if (boardError) {
            console.error(
                "Imageboard: could not load board:",
                boardError
            );

            boardsList.innerHTML = `
                <p class="error-message">
                    Couldn't load this board. Please try again! ♡
                </p>
            `;

            recentThreads.innerHTML = "";

            return;
        }

        if (!board) {
            boardsList.innerHTML = `
                <p class="error-message">
                    That board doesn't exist! ♡
                </p>

                <p>
                    <a href="imageboard.html">
                        ← Back to boards
                    </a>
                </p>
            `;

            recentThreads.innerHTML = "";

            return;
        }

        boardsList.innerHTML = `
            <div class="board-header">

                <p class="board-slug">
                    /${escapeHtml(board.slug)}/
                </p>

                <h2>
                    ${escapeHtml(board.name)}
                </h2>

                <p>
                    ${escapeHtml(
                        board.description ||
                        "No description yet."
                    )}
                </p>

                <div class="board-header-actions">

                    <a href="imageboard.html">
                        ← All boards
                    </a>

                    <button
                        type="button"
                        id="boardNewThreadButton"
                    >
                        ✨ New thread
                    </button>

                </div>

            </div>
        `;

        const boardNewThreadButton =
            document.getElementById(
                "boardNewThreadButton"
            );

        if (boardNewThreadButton) {
            boardNewThreadButton.addEventListener(
                "click",
                () => {
                    window.location.href =
                        `imageboard-new-thread.html?board=${encodeURIComponent(
                            board.slug
                        )}`;
                }
            );
        }

        await loadBoardThreads(board);
    }

    async function loadBoardThreads(board) {
        const {
            data,
            error
        } = await client
            .from("threads")
            .select(`
                id,
                title,
                created_at,
                last_post_at,
                is_locked,
                is_archived,
                is_ready,

                profiles!threads_user_id_fkey (
                    username,
                    display_name
                ),

                posts (
                    id,
                    created_at,
                    is_hidden,

                    post_images (
                        id,
                        storage_path,
                        alt_text
                    )
                )
            `)
            .eq("board_id", board.id)
            .eq("is_archived", false)
            .eq("is_ready", true)
            .eq("is_hidden", false)
            .order("last_post_at", {
                ascending: false
            });

        if (error) {
            console.error(
                "Imageboard: could not load board threads:",
                error
            );

            recentThreads.innerHTML = `
                <p class="error-message">
                    Couldn't load this board's threads. ♡
                </p>
            `;

            return;
        }

        recentThreads.innerHTML = `
            <div class="board-thread-list">

                <div class="board-thread-list-header">

                    <h2>
                        Threads
                    </h2>

                    <span>
                        ${data.length}
                        ${data.length === 1
                            ? "thread"
                            : "threads"}
                    </span>

                </div>

                ${
                    data.length === 0
                        ? `
                            <p class="empty-message">
                                No threads here yet! Be the first. ♡
                            </p>
                        `
                        : data
                            .map(renderThread)
                            .join("")
                }

            </div>
        `;
    }

    function renderThread(thread) {
        const profile =
            thread.profiles;

        const displayName =
            profile?.display_name ||
            profile?.username ||
            "Unknown user";

        const openingImage =
            getOpeningImage(thread);

        let status = "";

        if (thread.is_locked) {
            status = `
                <span class="thread-status">
                    🔒 Locked
                </span>
            `;
        }

        let thumbnailHtml;

        if (openingImage) {
            const imageUrl =
                getImageUrl(
                    openingImage.storage_path
                );

            thumbnailHtml = imageUrl
                ? `
                    <a
                        class="thread-preview-thumbnail-link"
                        href="${escapeHtml(imageUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View full-size image"
                    >
                        <img
                            class="thread-preview-thumbnail"
                            src="${escapeHtml(imageUrl)}"
                            alt="${escapeHtml(
                                openingImage.alt_text ||
                                "Thread image"
                            )}"
                            loading="lazy"
                        >
                    </a>
                `
                : `
                    <a
                        class="thread-preview-thumbnail-link thread-preview-no-image"
                        href="imageboard-thread.html?id=${encodeURIComponent(
                            thread.id
                        )}"
                        aria-label="Open thread"
                    >
                        <span>♡</span>
                    </a>
                `;
        } else {
            thumbnailHtml = `
                <a
                    class="thread-preview-thumbnail-link thread-preview-no-image"
                    href="imageboard-thread.html?id=${encodeURIComponent(
                        thread.id
                    )}"
                    aria-label="Open thread"
                >
                    <span>♡</span>
                </a>
            `;
        }

        return `
            <article class="thread-preview">

                ${thumbnailHtml}

                <div class="thread-preview-content">

                    <div class="thread-preview-main">

                        <h3>
                            <a
                                href="imageboard-thread.html?id=${encodeURIComponent(
                                    thread.id
                                )}"
                            >
                                ${escapeHtml(thread.title)}
                            </a>
                        </h3>

                        ${status}

                    </div>

                    <p class="thread-preview-meta">
                        Started by
                        ${escapeHtml(displayName)}
                        ·
                        ${formatDate(thread.created_at)}
                    </p>

                    <p class="thread-preview-bump">
                        Last activity:
                        ${formatDate(thread.last_post_at)}
                    </p>

                </div>

            </article>
        `;
    }

    async function loadBoardsDirectory() {
        const {
            data,
            error
        } = await client
            .from("boards")
            .select(`
                id,
                name,
                slug,
                description
            `)
            .order("name", {
                ascending: true
            });

        if (error) {
            console.error(
                "Imageboard: could not load boards:",
                error
            );

            boardsList.innerHTML = `
                <p class="error-message">
                    Couldn't load the boards. Please try again! ♡
                </p>
            `;

            return;
        }

        if (!data || data.length === 0) {
            boardsList.innerHTML = `
                <p class="empty-message">
                    There aren't any boards yet! ♡
                </p>
            `;

            return;
        }

        boardsList.innerHTML = data
            .map(
                (board) => `
                    <a
                        class="board-card"
                        href="imageboard.html?board=${encodeURIComponent(
                            board.slug
                        )}"
                    >

                        <p class="board-card-slug">
                            /${escapeHtml(board.slug)}/
                        </p>

                        <h3>
                            ${escapeHtml(board.name)}
                        </h3>

                        <p>
                            ${escapeHtml(
                                board.description ||
                                "No description yet."
                            )}
                        </p>

                        <span>
                            Browse board →
                        </span>

                    </a>
                `
            )
            .join("");

        await loadRecentThreads();
    }

    async function loadRecentThreads() {
        const {
            data,
            error
        } = await client
            .from("threads")
            .select(`
                id,
                title,
                created_at,
                last_post_at,
                board_id,
                is_ready,

                boards (
                    name,
                    slug
                ),

                profiles!threads_user_id_fkey (
                    username,
                    display_name
                ),

                posts (
                    id,
                    created_at,
                    is_hidden,

                    post_images (
                        id,
                        storage_path,
                        alt_text
                    )
                )
            `)
            .eq("is_archived", false)
            .eq("is_ready", true)
            .eq("is_hidden", false)
            .order("last_post_at", {
                ascending: false
            })
            .limit(15);

        if (error) {
            console.error(
                "Imageboard: could not load recent threads:",
                error
            );

            recentThreads.innerHTML = `
                <p class="error-message">
                    Couldn't load recent threads. ♡
                </p>
            `;

            return;
        }

        if (!data || data.length === 0) {
            recentThreads.innerHTML = `
                <p class="empty-message">
                    No threads yet! Be the first to make one. ♡
                </p>
            `;

            return;
        }

        recentThreads.innerHTML = data
            .map((thread) => {

                const board =
                    thread.boards;

                const profile =
                    thread.profiles;

                const displayName =
                    profile?.display_name ||
                    profile?.username ||
                    "Unknown user";

                const openingImage =
                    getOpeningImage(thread);

                let thumbnailHtml;

                if (openingImage) {
                    const imageUrl =
                        getImageUrl(
                            openingImage.storage_path
                        );

                    thumbnailHtml = imageUrl
                        ? `
                            <a
                                class="thread-preview-thumbnail-link"
                                href="${escapeHtml(imageUrl)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View full-size image"
                            >
                                <img
                                    class="thread-preview-thumbnail"
                                    src="${escapeHtml(imageUrl)}"
                                    alt="${escapeHtml(
                                        openingImage.alt_text ||
                                        "Thread image"
                                    )}"
                                    loading="lazy"
                                >
                            </a>
                        `
                        : `
                            <a
                                class="thread-preview-thumbnail-link thread-preview-no-image"
                                href="imageboard-thread.html?id=${encodeURIComponent(
                                    thread.id
                                )}"
                                aria-label="Open thread"
                            >
                                <span>♡</span>
                            </a>
                        `;
                } else {
                    thumbnailHtml = `
                        <a
                            class="thread-preview-thumbnail-link thread-preview-no-image"
                            href="imageboard-thread.html?id=${encodeURIComponent(
                                thread.id
                            )}"
                            aria-label="Open thread"
                        >
                            <span>♡</span>
                        </a>
                    `;
                }

                return `
                    <article class="thread-preview">

                        ${thumbnailHtml}

                        <div class="thread-preview-content">

                            <div class="thread-preview-board">

                                <a
                                    href="imageboard.html?board=${encodeURIComponent(
                                        board?.slug || ""
                                    )}"
                                >
                                    /
                                    ${escapeHtml(
                                        board?.name ||
                                        "Unknown board"
                                    )}
                                    /
                                </a>

                            </div>

                            <h3>

                                <a
                                    href="imageboard-thread.html?id=${encodeURIComponent(
                                        thread.id
                                    )}"
                                >
                                    ${escapeHtml(thread.title)}
                                </a>

                            </h3>

                            <p class="thread-preview-meta">
                                Started by
                                ${escapeHtml(displayName)}
                                ·
                                ${formatDate(thread.created_at)}
                            </p>

                            <p class="thread-preview-bump">
                                Last activity:
                                ${formatDate(thread.last_post_at)}
                            </p>

                        </div>

                    </article>
                `;
            })
            .join("");
    }

    function formatDate(value) {
        if (!value) {
            return "Unknown date";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Unknown date";
        }

        return date.toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    if (newThreadButton) {
        newThreadButton.addEventListener(
            "click",
            () => {
                const slug = getBoardSlug();

                if (slug) {
                    window.location.href =
                        `imageboard-new-thread.html?board=${encodeURIComponent(
                            slug
                        )}`;
                } else {
                    window.location.href =
                        "imageboard-new-thread.html";
                }
            }
        );
    }

    async function start() {
        const boardSlug =
            getBoardSlug();

        if (boardSlug) {
            await loadBoardPage(boardSlug);
        } else {
            await loadBoardsDirectory();
        }
    }

    start();

})();