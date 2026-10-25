
(() => {
    "use strict";

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const STORAGE_BUCKET = "imageboard-images";

    const $ = id => document.getElementById(id);

    const form = $("newThreadForm");
    const boardInfo = $("boardInfo");
    const titleInput = $("threadTitle");
    const imageInput = $("threadImage");
    const preview = $("imagePreview");
    const previewImage = $("imagePreviewImage");
    const previewName = $("imagePreviewName");
    const contentInput = $("threadContent");
    const message = $("threadMessage");
    const createButton = $("createThreadButton");
    const cancelButton = $("cancelThreadButton");
    const anonymousInput = $("anonymousPost");

    let client = null;
    let board = null;
    let isSubmitting = false;
    let previewUrl = null;

    function showMessage(text, type = "error") {
        if (!message) return;

        message.textContent = text;
        message.hidden = !text;
        message.dataset.type = type;
        message.setAttribute(
            "role",
            type === "error" ? "alert" : "status"
        );
    }

    function getErrorMessage(error) {
        return error?.message ||
            error?.error_description ||
            String(error || "Unknown error");
    }

    function fail(stage, error) {
        const detail = getErrorMessage(error);
        console.error(`[Yumeboard: ${stage}]`, error);
        throw new Error(`${stage}: ${detail}`);
    }

    // --------------------------------------------------
    // Image optimization
    // --------------------------------------------------

    async function optimizeImageBeforeUpload(file) {
        if (
            !file ||
            !["image/jpeg", "image/png"].includes(file.type)
        ) {
            return file;
        }

        if (file.size <= 500 * 1024) {
            return file;
        }

        let bitmap;

        try {
            if (typeof createImageBitmap !== "function") {
                return file;
            }

            bitmap = await createImageBitmap(file);

            const maxDimension = 1920;
            const longestSide = Math.max(
                bitmap.width,
                bitmap.height
            );

            const scale = Math.min(
                1,
                maxDimension / longestSide
            );

            const width = Math.max(
                1,
                Math.round(bitmap.width * scale)
            );

            const height = Math.max(
                1,
                Math.round(bitmap.height * scale)
            );

            if (
                width === bitmap.width &&
                height === bitmap.height &&
                file.size <= 1024 * 1024
            ) {
                return file;
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");

            if (!context) return file;

            context.drawImage(
                bitmap,
                0,
                0,
                width,
                height
            );

            const blob = await new Promise(resolve => {
                canvas.toBlob(
                    resolve,
                    "image/webp",
                    0.82
                );
            });

            if (!blob || blob.size >= file.size) {
                return file;
            }

            const baseName = file.name.replace(/\.[^.]+$/, "");

            const optimizedFile = new File(
                [blob],
                `${baseName || "image"}.webp`,
                {
                    type: "image/webp",
                    lastModified: Date.now()
                }
            );

            console.info("[Yumeboard] Image optimized", {
                originalKB: Math.round(file.size / 1024),
                optimizedKB: Math.round(optimizedFile.size / 1024),
                savedPercent: Math.round(
                    (1 - optimizedFile.size / file.size) * 100
                )
            });

            return optimizedFile;
        } catch (error) {
            console.warn(
                "[Yumeboard] Image optimization failed; using original.",
                error
            );

            return file;
        } finally {
            bitmap?.close();
        }
    }

    // --------------------------------------------------
    // Image filename / extension
    // --------------------------------------------------

    function getFileExtension(file) {
        const name = file.name || "";
        const match = name.match(/\.([a-zA-Z0-9]+)$/);

        if (match) {
            const extension = match[1].toLowerCase();

            if ([
                "jpg",
                "jpeg",
                "png",
                "gif",
                "webp",
                "avif"
            ].includes(extension)) {
                return extension;
            }
        }

        const extensions = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/gif": "gif",
            "image/webp": "webp",
            "image/avif": "avif"
        };

        return extensions[file.type] || null;
    }

    // --------------------------------------------------
    // Formatting toolbar
    // --------------------------------------------------

    function wrapSelectedText(before, after = before) {
        if (!contentInput) return;

        const start = contentInput.selectionStart;
        const end = contentInput.selectionEnd;
        const value = contentInput.value;
        const selected = value.slice(start, end);

        const replacement = `${before}${selected}${after}`;

        contentInput.setRangeText(
            replacement,
            start,
            end,
            "select"
        );

        contentInput.focus();

        if (start === end) {
            const cursor = start + before.length;
            contentInput.setSelectionRange(cursor, cursor);
        }

        contentInput.dispatchEvent(
            new Event("input", { bubbles: true })
        );
    }

    function setupFormattingToolbar() {
        const toolbar = form?.querySelector(".formatting-toolbar");

        if (!toolbar || !contentInput) {
            console.warn(
                "[Yumeboard] Formatting toolbar or message textarea not found."
            );
            return;
        }

        const formats = {
            bold: ["**", "**"],
            italic: ["*", "*"],
            strike: ["~~", "~~"],
            spoiler: ["||", "||"],
            code: ["`", "`"]
        };

        toolbar.addEventListener("click", event => {
            const target = event.target;

            if (!(target instanceof Element)) return;

            const button = target.closest("button[data-format]");

            if (!button || !toolbar.contains(button)) return;

            event.preventDefault();

            const format = formats[button.dataset.format];

            if (!format) return;

            wrapSelectedText(format[0], format[1]);
        });
    }

    // --------------------------------------------------
    // Board and authentication
    // --------------------------------------------------

    async function loadBoard() {
        const slug = new URLSearchParams(
            window.location.search
        ).get("board");

        if (!slug) {
            showMessage(
                "No board specified. Open this page from a board first."
            );
            return false;
        }

        const { data, error } = await client
            .from("boards")
            .select("id, name, slug, description")
            .eq("slug", slug)
            .maybeSingle();

        if (error) {
            fail("Loading board", error);
        }

        if (!data) {
            showMessage("That board could not be found.");
            return false;
        }

        board = data;

        if (boardInfo) {
            boardInfo.textContent = board.description
                ? `${board.name} — ${board.description}`
                : `Posting to ${board.name}`;
        }

        return true;
    }

    async function getCurrentUser() {
        const { data, error } = await client.auth.getUser();

        if (error) {
            fail("Checking sign-in", error);
        }

        if (!data?.user) {
            throw new Error(
                "Please sign in before creating a thread."
            );
        }

        return data.user;
    }

    // --------------------------------------------------
    // Image validation
    // --------------------------------------------------

    function validateImage(file) {
        if (!file) {
            throw new Error(
                "Please choose an image for your thread."
            );
        }

        if (!file.type.startsWith("image/")) {
            throw new Error(
                "The selected file must be an image."
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error(
                "Your image must be 10 MB or smaller."
            );
        }

        const extension = getFileExtension(file);

        if (!extension) {
            throw new Error(
                "Unsupported image format. Try JPG, PNG, GIF, WebP, or AVIF."
            );
        }

        return extension;
    }

    // --------------------------------------------------
    // Image preview
    // --------------------------------------------------

    function setupImagePreview() {
        if (!imageInput) return;

        imageInput.addEventListener("change", () => {
            const file = imageInput.files?.[0];

            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                previewUrl = null;
            }

            if (!file) {
                if (preview) preview.hidden = true;
                if (previewImage) previewImage.removeAttribute("src");
                if (previewName) previewName.textContent = "";
                showMessage("");
                return;
            }

            try {
                validateImage(file);
            } catch (error) {
                showMessage(getErrorMessage(error));
                imageInput.value = "";

                if (preview) preview.hidden = true;

                return;
            }

            previewUrl = URL.createObjectURL(file);

            if (previewImage) {
                previewImage.src = previewUrl;
            }

            if (previewName) {
                previewName.textContent = file.name;
            }

            if (preview) preview.hidden = false;

            showMessage("");
        });
    }

    // --------------------------------------------------
    // Create thread and upload image
    // --------------------------------------------------

    async function createThread(event) {
        event.preventDefault();

        if (isSubmitting) return;

        showMessage("");

        if (!client) {
            showMessage(
                "Supabase did not initialize. Check supabase.js and the browser console."
            );
            return;
        }

        if (!board) {
            showMessage(
                "The board has not loaded. Refresh and try again."
            );
            return;
        }

        const title = titleInput?.value.trim() || "";
        const content = contentInput?.value || "";
        let file = imageInput?.files?.[0] || null;

        // Preserve the user's original filename for alt text.
        const originalFileName = file?.name || null;

        if (!title) {
            showMessage("Please enter a thread title.");
            titleInput?.focus();
            return;
        }

        if (title.length > 200) {
            showMessage(
                "Your title must be 200 characters or fewer."
            );
            titleInput?.focus();
            return;
        }

        try {
            validateImage(file);
        } catch (error) {
            showMessage(getErrorMessage(error));
            imageInput?.focus();
            return;
        }

        isSubmitting = true;

        if (createButton) {
            createButton.disabled = true;
            createButton.textContent = "Preparing image...";
        }

        try {

            showMessage(
                "Preparing your image...",
                "status"
            );

            file = await optimizeImageBeforeUpload(file);

            if (file.size > MAX_FILE_SIZE) {
                throw new Error(
                    "Your image must be 10 MB or smaller."
                );
            }


            const extension = validateImage(file);

            if (createButton) {
                createButton.textContent = "Creating thread...";
            }

            showMessage(
                "Creating your thread...",
                "status"
            );

            const user = await getCurrentUser();

            // Stage 1: create the thread and its first post.
            const {
                data: created,
                error: createError
            } = await client.rpc(
                "create_imageboard_thread",
                {
                    p_board_id: board.id,
                    p_title: title,
                    p_content: content,
                    p_is_anonymous: Boolean(anonymousInput?.checked)
                }
            );

            if (createError) {
                fail("Creating thread in database", createError);
            }

            const record = Array.isArray(created)
                ? created[0]
                : created;

            const threadId = record?.thread_id;
            const postId = record?.post_id;

            if (threadId == null || postId == null) {
                fail(
                    "Creating thread in database",
                    new Error(
                        "The create_imageboard_thread RPC did not return thread_id and post_id."
                    )
                );
            }

            // Stage 2: upload the image to Supabase Storage.
            const randomPart =
                typeof crypto.randomUUID === "function"
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

            const storagePath =
                `${user.id}/${threadId}/${randomPart}.${extension}`;

            if (createButton) {
                createButton.textContent = "Uploading image...";
            }

            showMessage(
                "Uploading your image...",
                "status"
            );

            try {
                await uploadImageToR2(
                    client,
                    STORAGE_BUCKET,
                    storagePath,
                    file
                );
            } catch (uploadError) {
                fail("Uploading image to Cloudflare R2", uploadError);
            }

            // Stage 3: attach the uploaded image to the first post.
            const { error: imageRowError } = await client
                .from("post_images")
                .insert({
                    post_id: postId,
                    storage_path: storagePath,
                    alt_text: originalFileName || file.name
                });

            if (imageRowError) {
                fail("Saving image record", imageRowError);
            }

            // Stage 4: finalize the thread using the existing RPC.
            const { error: finalizeError } = await client.rpc(
                "finalize_imageboard_thread",
                {
                    p_thread_id: threadId,
                    p_post_id: postId
                }
            );

            if (finalizeError) {
                fail("Finalizing thread", finalizeError);
            }

            showMessage("Thread created! Opening it...", "status");

            // Success: open the newly created thread.
            window.location.assign(
                `imageboard-thread.html?id=${encodeURIComponent(threadId)}`
            );
        } catch (error) {
            console.error(
                "[Yumeboard] Thread creation failed:",
                error
            );

            showMessage(getErrorMessage(error));
        } finally {
            isSubmitting = false;

            if (createButton) {
                createButton.disabled = false;
                createButton.textContent = "Create Thread";
            }
        }
    }

    // --------------------------------------------------
    // Initialize
    // --------------------------------------------------

    async function start() {
        if (!form) {
            console.error(
                "[Yumeboard] #newThreadForm was not found."
            );
            return;
        }

        setupFormattingToolbar();
        setupImagePreview();

        form.addEventListener("submit", createThread);

        if (cancelButton) {
            cancelButton.addEventListener("click", event => {
                event.preventDefault();
                window.history.back();
            });
        }

        client = window.supabaseClient;

        if (!client) {
            form.hidden = false;

            showMessage(
                "Supabase client not found. Check that supabase.js loads before this script and initializes window.supabaseClient."
            );

            console.error(
                "[Yumeboard] window.supabaseClient is missing."
            );

            return;
        }

        try {
            const loaded = await loadBoard();

            form.hidden = false;

            if (!loaded) return;

            showMessage("");
        } catch (error) {
            console.error(
                "[Yumeboard] Page initialization failed:",
                error
            );

            form.hidden = false;
            showMessage(getErrorMessage(error));
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            start,
            { once: true }
        );
    } else {
        start();
    }
})();
