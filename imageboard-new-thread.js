(() => {
    "use strict";

    const client = window.supabaseClient;

    if (!client) {
        console.error(
            "New thread: Supabase client not found."
        );
        return;
    }

    const MAX_FILE_SIZE =
        10 * 1024 * 1024;

    const STORAGE_BUCKET =
        "imageboard-images";

    const boardInfo =
        document.getElementById("boardInfo");

    const form =
        document.getElementById("newThreadForm");

    const threadTitle =
        document.getElementById("threadTitle");

    const threadImage =
        document.getElementById("threadImage");

    const imagePreview =
        document.getElementById("imagePreview");

    const imagePreviewImage =
        document.getElementById(
            "imagePreviewImage"
        );

    const imagePreviewName =
        document.getElementById(
            "imagePreviewName"
        );

    const threadContent =
        document.getElementById("threadContent");

    const threadMessage =
        document.getElementById("threadMessage");

    const createThreadButton =
        document.getElementById(
            "createThreadButton"
        );

    const cancelThreadButton =
        document.getElementById(
            "cancelThreadButton"
        );

    const anonymousPost =
        document.getElementById(
            "anonymousPost"
        );

    let currentUser = null;
    let currentBoard = null;
    let selectedFile = null;

    function getBoardSlug() {
        const params =
            new URLSearchParams(
                window.location.search
            );

        return params.get("board");
    }

    function showMessage(
        message,
        type = ""
    ) {
        if (!threadMessage) {
            return;
        }

        threadMessage.textContent =
            message;

        threadMessage.className =
            `editor-message ${type}`;
    }

    async function getCurrentUser() {
        const {
            data: { user },
            error
        } = await client.auth.getUser();

        if (error) {
            console.error(
                "New thread: could not get user:",
                error
            );

            return null;
        }

        return user;
    }

    async function loadBoard() {
        const boardSlug =
            getBoardSlug();

        if (!boardSlug) {
            boardInfo.innerHTML = `
                <p class="error-message">
                    No board was selected.
                </p>

                <p>
                    <a href="imageboard.html">
                        ← Back to boards
                    </a>
                </p>
            `;

            return false;
        }

        const {
            data: board,
            error
        } = await client
            .from("boards")
            .select(`
                id,
                name,
                slug,
                description
            `)
            .eq("slug", boardSlug)
            .maybeSingle();

        if (error) {
            console.error(
                "New thread: could not load board:",
                error
            );

            boardInfo.innerHTML = `
                <p class="error-message">
                    Couldn't load this board. Please try again.
                </p>
            `;

            return false;
        }

        if (!board) {
            boardInfo.innerHTML = `
                <p class="error-message">
                    That board doesn't exist! ♡
                </p>

                <p>
                    <a href="imageboard.html">
                        ← Back to boards
                    </a>
                </p>
            `;

            return false;
        }

        currentBoard = board;

        boardInfo.innerHTML = `
            <div class="new-thread-board">
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
            </div>
        `;

        cancelThreadButton.href =
            `imageboard.html?board=${encodeURIComponent(
                board.slug
            )}`;

        return true;
    }

    function handleImageSelection() {
        const file =
            threadImage.files[0];

        selectedFile = null;
        imagePreview.hidden = true;
        imagePreviewImage.src = "";
        imagePreviewName.textContent = "";

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            showMessage(
                "Please choose an image file.",
                "error"
            );

            threadImage.value = "";
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            showMessage(
                "That image is too large. The maximum file size is 10 MB.",
                "error"
            );

            threadImage.value = "";
            return;
        }

        selectedFile = file;

        const previewUrl =
            URL.createObjectURL(file);

        imagePreviewImage.src =
            previewUrl;

        imagePreviewName.textContent =
            file.name;

        imagePreview.hidden = false;

        showMessage("");
    }

    function createStoragePath(
        userId,
        threadId,
        file
    ) {
        const extension =
            getFileExtension(file.name);

        const randomPart =
            crypto.randomUUID();

        return [
            userId,
            threadId,
            `${randomPart}.${extension}`
        ].join("/");
    }

    function getFileExtension(filename) {
        const parts =
            filename.split(".");

        if (parts.length < 2) {
            return "bin";
        }

        const extension =
            parts
                .pop()
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                );

        return extension || "bin";
    }

    async function createThread(event) {
        event.preventDefault();

        showMessage("");

        if (!currentUser) {
            showMessage(
                "You need to be logged in to create a thread.",
                "error"
            );

            return;
        }

        if (!currentBoard) {
            showMessage(
                "No board was selected.",
                "error"
            );

            return;
        }

        const title =
            threadTitle.value.trim();

        const content =
            threadContent.value.trim();

        const isAnonymous =
            anonymousPost?.checked === true;

        if (!title) {
            showMessage(
                "Please give your thread a title.",
                "error"
            );

            threadTitle.focus();
            return;
        }

        if (!selectedFile) {
            showMessage(
                "An image is required to start a thread.",
                "error"
            );

            threadImage.focus();
            return;
        }

        if (
            !selectedFile.type.startsWith(
                "image/"
            )
        ) {
            showMessage(
                "Please choose a valid image file.",
                "error"
            );

            return;
        }

        if (
            selectedFile.size >
            MAX_FILE_SIZE
        ) {
            showMessage(
                "That image is too large. The maximum file size is 10 MB.",
                "error"
            );

            return;
        }

        createThreadButton.disabled = true;

        createThreadButton.textContent =
            "Creating...";

        let threadId = null;
        let postId = null;
        let storagePath = null;

        try {
            /*
             * 1. Create the thread and opening
             *    post as an invisible draft.
             */

            const {
                data,
                error
            } = await client.rpc(
                "create_imageboard_thread",
                {
                    p_board_id:
                        currentBoard.id,

                    p_title:
                        title,

                    p_content:
                        content || null,

                    p_is_anonymous:
                        isAnonymous
                }
            );

            if (error) {
                throw error;
            }

            if (
                !data ||
                !data[0] ||
                !data[0].thread_id ||
                !data[0].post_id
            ) {
                throw new Error(
                    "The server did not return the new thread information."
                );
            }

            threadId =
                data[0].thread_id;

            postId =
                data[0].post_id;

            /*
             * 2. Upload the mandatory image.
             */

            storagePath =
                createStoragePath(
                    currentUser.id,
                    threadId,
                    selectedFile
                );

            const {
                error: uploadError
            } = await client.storage
                .from(STORAGE_BUCKET)
                .upload(
                    storagePath,
                    selectedFile,
                    {
                        cacheControl:
                            "3600",

                        upsert:
                            false,

                        contentType:
                            selectedFile.type
                    }
                );

            if (uploadError) {
                throw uploadError;
            }

            /*
             * 3. Attach the image to the OP.
             */

            const {
                error: imageRowError
            } = await client
                .from("post_images")
                .insert({
                    post_id:
                        postId,

                    storage_path:
                        storagePath,

                    alt_text:
                        title
                });

            if (imageRowError) {
                throw imageRowError;
            }

            /*
             * 4. Make the thread publicly visible.
             */

            const {
                error: finalizeError
            } = await client.rpc(
                "finalize_imageboard_thread",
                {
                    p_thread_id:
                        threadId,

                    p_post_id:
                        postId
                }
            );

            if (finalizeError) {
                throw finalizeError;
            }

            /*
             * Everything succeeded!
             */

            window.location.href =
                `imageboard-thread.html?id=${encodeURIComponent(
                    threadId
                )}`;

        } catch (error) {
            console.error(
                "New thread creation failed:",
                error
            );

            showMessage(
                error.message ||
                "Something went wrong while creating the thread. Please try again.",
                "error"
            );

            createThreadButton.disabled =
                false;

            createThreadButton.textContent =
                "✨ Create thread";
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }

    async function start() {
        currentUser =
            await getCurrentUser();

        if (!currentUser) {
            boardInfo.innerHTML = `
                <p class="error-message">
                    You need to be logged in to create a thread.
                </p>

                <p>
                    <a href="imageboard.html">
                        ← Back to boards
                    </a>
                </p>
            `;

            return;
        }

        const boardLoaded =
            await loadBoard();

        if (boardLoaded) {
            form.hidden = false;
        }
    }

    threadImage.addEventListener(
        "change",
        handleImageSelection
    );

    form.addEventListener(
        "submit",
        createThread
    );

    start();
})();