(() => {
    "use strict";

    const client = window.supabaseClient;

    if (!client) {
        console.error("❌ Supabase client not found.");
        return;
    }


    // ======================================
    // DOM
    // ======================================

    const folderTitle =
        document.getElementById("folderTitle");

    const folderDescription =
        document.getElementById("folderDescription");

    const artworkGrid =
        document.getElementById("artworkGrid");

    const artworkEmpty =
        document.getElementById("artworkEmpty");

    const galleryStatus =
        document.getElementById("galleryStatus");

    const uploadArtworkButton =
        document.getElementById("uploadArtworkButton");

    const uploadDialog =
        document.getElementById("uploadDialog");

    const uploadForm =
        document.getElementById("uploadForm");

    /*
     * Try the normal ID first.
     *
     * If gallery-folder.html uses a different ID,
     * fall back to the first file input inside the form.
     */
    const galleryImage =
        document.getElementById("galleryImage") ||
        uploadForm?.querySelector('input[type="file"]');

    const galleryTitle =
        document.getElementById("galleryTitle");

    const galleryDescription =
        document.getElementById("galleryDescription");

    const uploadFileError =
        document.getElementById("uploadFileError");

    const uploadDialogError =
        document.getElementById("uploadDialogError");

    const uploadCancelButton =
        document.getElementById("uploadCancelButton");

    const uploadSaveButton =
        document.getElementById("uploadSaveButton");

    const backButton =
        document.getElementById("backButton");


    // ======================================
    // STATE
    // ======================================

    let currentUser = null;
    let folder = null;
    let artworks = [];
    let isOwner = false;
    let uploading = false;


    // ======================================
    // GET FOLDER ID
    // ======================================

    function getFolderId() {
        const params =
            new URLSearchParams(
                window.location.search
            );

        return params.get("id");
    }


    // ======================================
    // OWNER INTERFACE
    // ======================================

    function updateOwnerInterface() {
        const ownerControls =
            document.querySelectorAll(
                ".gallery-owner-only"
            );

        ownerControls.forEach(element => {
            element.hidden = !isOwner;

            if (isOwner) {
                element.style.removeProperty(
                    "display"
                );
            } else {
                element.style.setProperty(
                    "display",
                    "none",
                    "important"
                );
            }
        });

        if (uploadArtworkButton) {
            uploadArtworkButton.hidden = !isOwner;

            if (isOwner) {
                uploadArtworkButton.style.removeProperty(
                    "display"
                );
            } else {
                uploadArtworkButton.style.setProperty(
                    "display",
                    "none",
                    "important"
                );
            }
        }
    }


    // Hide owner controls immediately.
    updateOwnerInterface();


    // ======================================
    // LOAD FOLDER
    // ======================================

    async function loadFolderPage() {
        try {
            const folderId =
                getFolderId();

            if (!folderId) {
                showStatus(
                    "No folder was specified. :("
                );

                return;
            }


            // =========================
            // CURRENT USER
            // =========================

            const {
                data: { user },
                error: userError
            } = await client.auth.getUser();

            if (userError) {
                throw userError;
            }

            currentUser =
                user || null;


            // =========================
            // LOAD FOLDER
            // =========================

            const {
                data: loadedFolder,
                error: folderError
            } = await client
                .from("gallery_folders")
                .select(
                    "id, user_id, name, created_at, updated_at"
                )
                .eq("id", folderId)
                .single();

            if (folderError) {
                throw folderError;
            }

            if (!loadedFolder) {
                throw new Error(
                    "Folder not found."
                );
            }

            folder =
                loadedFolder;


            // The folder itself tells us who owns it.
            isOwner =
                !!currentUser &&
                String(currentUser.id) ===
                String(folder.user_id);

            console.log(
                "📁 Folder owner:",
                folder.user_id
            );

            console.log(
                "👤 Current user:",
                currentUser?.id || null
            );

            console.log(
                "🔐 Is folder owner:",
                isOwner
            );


            updateOwnerInterface();


            // =========================
            // LOAD ARTWORK
            // =========================

            await loadArtwork();

            renderFolder();

        } catch (error) {
            console.error(
                "💥 Folder loading error:",
                error
            );

            showStatus(
                "Couldn't load this folder. :("
            );
        }
    }


    // ======================================
    // LOAD ARTWORK
    // ======================================

    async function loadArtwork() {
        if (!folder?.id) {
            artworks = [];
            return;
        }

        const {
            data: relationships,
            error: relationshipError
        } = await client
            .from("gallery_item_folders")
            .select("gallery_item_id")
            .eq(
                "folder_id",
                folder.id
            );

        if (relationshipError) {
            throw relationshipError;
        }

        const artworkIds =
            (relationships || []).map(
                relationship =>
                    relationship.gallery_item_id
            );

        if (!artworkIds.length) {
            artworks = [];
            return;
        }

        const {
            data,
            error
        } = await client
            .from("gallery_items")
            .select(
                "id, user_id, image_url, image_path, title, description, created_at, updated_at"
            )
            .in(
                "id",
                artworkIds
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {
            throw error;
        }

        /*
         * Extra safety:
         * only show artwork belonging to this
         * folder's owner.
         */
        artworks =
            (data || []).filter(
                artwork =>
                    String(artwork.user_id) ===
                    String(folder.user_id)
            );
    }


    // ======================================
    // RENDER FOLDER
    // ======================================

    function renderFolder() {
        if (folderTitle) {
            folderTitle.textContent =
                `♡ ${folder.name}`;
        }

        if (folderDescription) {
            folderDescription.textContent =
                isOwner
                    ? "Your artwork in this folder. ♡"
                    : "Artwork in this folder. ♡";
        }

        updateOwnerInterface();

        if (!artworkGrid) {
            return;
        }

        artworkGrid.innerHTML = "";

        if (artworks.length === 0) {
            if (artworkEmpty) {
                artworkEmpty.hidden = false;

                artworkEmpty.textContent =
                    isOwner
                        ? "This folder is empty. Add some artwork! ♡"
                        : "This folder is empty. ♡";
            }

            showStatus(
                isOwner
                    ? "This folder is empty. ♡"
                    : "No artwork in this folder. ♡"
            );

            return;
        }

        if (artworkEmpty) {
            artworkEmpty.hidden = true;
        }

        artworks.forEach(artwork => {
            artworkGrid.appendChild(
                createArtworkCard(artwork)
            );
        });

        showStatus(
            `${artworks.length} artwork${
                artworks.length === 1
                    ? ""
                    : "s"
            } in this folder. ♡`
        );
    }


    // ======================================
    // ARTWORK CARD
    // ======================================

    function createArtworkCard(artwork) {
        const card =
            document.createElement("article");

        card.className =
            "artwork-card";


        // =========================
        // IMAGE BUTTON
        // =========================

        const button =
            document.createElement("button");

        button.type =
            "button";

        button.className =
            "artwork-card-button";

        const image =
            document.createElement("img");

        image.className =
            "artwork-card-image";

        image.style.width =
            "100%";

        image.style.aspectRatio =
            "1 / 1";

        image.style.objectFit =
            "cover";

        image.style.display =
            "block";

        image.src =
            artwork.image_url;

        image.alt =
            artwork.title ||
            "Artwork";

        image.loading =
            "lazy";

        button.appendChild(image);

        button.addEventListener(
            "click",
            () => {
                openArtworkViewer(
                    artwork
                );
            }
        );

        card.appendChild(button);


        // =========================
        // CONTENT
        // =========================

        const content =
            document.createElement("div");

        content.className =
            "artwork-card-content";


        if (artwork.title) {
            const title =
                document.createElement("h3");

            title.className =
                "artwork-card-title";

            title.textContent =
                artwork.title;

            content.appendChild(title);
        }


        if (artwork.description) {
            const description =
                document.createElement("p");

            description.className =
                "artwork-card-description";

            description.textContent =
                artwork.description;

            content.appendChild(description);
        }


        // =========================
        // OWNER ACTIONS
        // =========================

        if (isOwner) {
            const actions =
                document.createElement("div");

            actions.className =
                "artwork-card-actions";


            const editButton =
                document.createElement("button");

            editButton.type =
                "button";

            editButton.className =
                "artwork-card-action";

            editButton.textContent =
                "✏️ Edit";

            editButton.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    editArtwork(
                        artwork
                    );
                }
            );


            const removeButton =
                document.createElement("button");

            removeButton.type =
                "button";

            removeButton.className =
                "artwork-card-action";

            removeButton.textContent =
                "📂 Remove from folder";

            removeButton.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    removeFromFolder(
                        artwork
                    );
                }
            );


            actions.appendChild(
                editButton
            );

            actions.appendChild(
                removeButton
            );

            content.appendChild(
                actions
            );
        }


        card.appendChild(content);

        return card;
    }


    // ======================================
    // VIEWER
    // ======================================

    function openArtworkViewer(artwork) {
        const dialog =
            document.createElement("dialog");

        dialog.className =
            "artwork-viewer-dialog";


        const closeButton =
            document.createElement("button");

        closeButton.type =
            "button";

        closeButton.className =
            "artwork-viewer-close";

        closeButton.textContent =
            "×";

        closeButton.addEventListener(
            "click",
            () => dialog.close()
        );


        const image =
            document.createElement("img");

        image.className =
            "artwork-viewer-image";

        image.src =
            artwork.image_url;

        image.alt =
            artwork.title ||
            "Artwork";


        const title =
            document.createElement("h2");

        title.textContent =
            artwork.title ||
            "♡ Artwork";


        dialog.appendChild(
            closeButton
        );

        dialog.appendChild(
            image
        );

        dialog.appendChild(
            title
        );


        if (artwork.description) {
            const description =
                document.createElement("p");

            description.textContent =
                artwork.description;

            dialog.appendChild(
                description
            );
        }


        document.body.appendChild(
            dialog
        );


        dialog.addEventListener(
            "close",
            () => dialog.remove()
        );


        dialog.showModal();
    }


    // ======================================
    // EDIT ARTWORK
    // ======================================

    async function editArtwork(artwork) {
        if (
            !isOwner ||
            !currentUser ||
            !folder
        ) {
            return;
        }


        if (
            String(currentUser.id) !==
            String(folder.user_id)
        ) {
            console.warn(
                "⚠️ Edit blocked: current user does not own this folder."
            );

            return;
        }


        const title =
            window.prompt(
                "Artwork title:",
                artwork.title || ""
            );

        if (title === null) {
            return;
        }


        const description =
            window.prompt(
                "Artwork description:",
                artwork.description || ""
            );

        if (description === null) {
            return;
        }


        const {
            error
        } = await client
            .from("gallery_items")
            .update({
                title:
                    title.trim() || null,

                description:
                    description.trim() || null
            })
            .eq(
                "id",
                artwork.id
            )
            .eq(
                "user_id",
                currentUser.id
            );


        if (error) {
            console.error(
                "❌ Artwork update error:",
                error
            );

            alert(
                "Couldn't update the artwork. :("
            );

            return;
        }


        await loadArtwork();

        renderFolder();
    }


    // ======================================
    // REMOVE ARTWORK FROM FOLDER
    // ======================================

    async function removeFromFolder(artwork) {
        if (
            !isOwner ||
            !currentUser ||
            !folder
        ) {
            return;
        }


        if (
            String(currentUser.id) !==
            String(folder.user_id)
        ) {
            console.warn(
                "⚠️ Remove blocked: current user does not own this folder."
            );

            return;
        }


        const confirmed =
            window.confirm(
                `Remove "${
                    artwork.title ||
                    "this artwork"
                }" from "${
                    folder.name
                }"? The artwork itself will NOT be deleted. ♡`
            );


        if (!confirmed) {
            return;
        }


        const {
            error
        } = await client
            .from("gallery_item_folders")
            .delete()
            .eq(
                "gallery_item_id",
                artwork.id
            )
            .eq(
                "folder_id",
                folder.id
            );


        if (error) {
            console.error(
                "❌ Remove-from-folder error:",
                error
            );

            alert(
                "Couldn't remove the artwork from this folder. :("
            );

            return;
        }


        await loadArtwork();

        renderFolder();

        showStatus(
            "Artwork removed from the folder. ♡"
        );
    }


    // ======================================
    // UPLOAD TO CURRENT FOLDER
    // ======================================

    async function uploadArtwork(event) {
        event.preventDefault();


        if (
            !isOwner ||
            !currentUser ||
            !folder ||
            uploading
        ) {
            return;
        }


        // =========================
        // OWNERSHIP CHECK
        // =========================

        if (
            String(currentUser.id) !==
            String(folder.user_id)
        ) {
            showUploadError(
                "You don't own this folder."
            );

            return;
        }


        // =========================
        // FILE INPUT
        // =========================

        /*
         * Re-check the file input at submit time.
         *
         * This makes the uploader work even if the
         * HTML uses a different ID.
         */
        const fileInput =
            document.getElementById("galleryImage") ||
            uploadForm?.querySelector(
                'input[type="file"]'
            );


        const file =
            fileInput?.files?.[0];


        if (!file) {
            showUploadError(
                "Please choose an image."
            );

            return;
        }


        uploading = true;


        // =========================
        // VALIDATE FILE
        // =========================

        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif"
        ];


        const allowedExtensions = [
            "png",
            "jpg",
            "jpeg",
            "webp",
            "gif"
        ];


        const extension =
            file.name
                .split(".")
                .pop()
                .toLowerCase();


        const validType =
            allowedTypes.includes(
                file.type
            );


        const validExtension =
            allowedExtensions.includes(
                extension
            );


        if (
            !validType &&
            !validExtension
        ) {
            showUploadError(
                "Please choose a PNG, JPEG, WebP, or GIF image."
            );

            uploading = false;

            return;
        }


        if (
            file.size >
            10 * 1024 * 1024
        ) {
            showUploadError(
                "Images must be 10 MB or smaller."
            );

            uploading = false;

            return;
        }


        if (uploadSaveButton) {
            uploadSaveButton.disabled =
                true;

            uploadSaveButton.textContent =
                "Uploading...";
        }


        // =========================
        // STORAGE PATH
        // =========================

        const path =
            `${currentUser.id}/${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}.${extension}`;


        let uploadedPath = null;
        let artworkId = null;


        try {

            // =========================
            // STORAGE
            // =========================

            const {
                error: storageError
            } = await client.storage
                .from("gallery")
                .upload(
                    path,
                    file,
                    {
                        cacheControl:
                            "3600",

                        upsert:
                            false,

                        contentType:
                            file.type ||
                            `image/${extension}`
                    }
                );


            if (storageError) {
                throw storageError;
            }


            uploadedPath =
                path;


            // =========================
            // PUBLIC URL
            // =========================

            const {
                data: publicUrlData
            } = client.storage
                .from("gallery")
                .getPublicUrl(
                    path
                );


            const imageUrl =
                publicUrlData.publicUrl;


            // =========================
            // GALLERY ITEM
            // =========================

            const {
                data: artwork,
                error: artworkError
            } = await client
                .from("gallery_items")
                .insert({
                    user_id:
                        currentUser.id,

                    image_url:
                        imageUrl,

                    image_path:
                        path,

                    title:
                        galleryTitle?.value
                            ?.trim() || null,

                    description:
                        galleryDescription?.value
                            ?.trim() || null
                })
                .select("id")
                .single();


            if (artworkError) {
                throw artworkError;
            }


            artworkId =
                artwork.id;


            // =========================
            // CURRENT FOLDER
            // =========================

            /*
             * IMPORTANT:
             *
             * We do NOT ask the user to select a folder.
             *
             * Because this upload happened from
             * gallery-folder.html, the destination is
             * automatically the folder we're currently in.
             */
            const {
                error: relationshipError
            } = await client
                .from("gallery_item_folders")
                .insert({
                    gallery_item_id:
                        artworkId,

                    folder_id:
                        folder.id
                });


            if (relationshipError) {
                throw relationshipError;
            }


            // =========================
            // SUCCESS
            // =========================

            uploadForm?.reset();

            uploadDialog?.close();

            await loadArtwork();

            renderFolder();

            showStatus(
                `Artwork added to "${folder.name}"! ♡`
            );


        } catch (error) {

            console.error(
                "❌ Folder artwork upload error:",
                error
            );


            // =========================
            // CLEAN UP RELATIONSHIP
            // =========================

            if (artworkId) {
                await client
                    .from("gallery_item_folders")
                    .delete()
                    .eq(
                        "gallery_item_id",
                        artworkId
                    )
                    .eq(
                        "folder_id",
                        folder.id
                    );
            }


            // =========================
            // CLEAN UP ARTWORK ROW
            // =========================

            if (artworkId) {
                await client
                    .from("gallery_items")
                    .delete()
                    .eq(
                        "id",
                        artworkId
                    )
                    .eq(
                        "user_id",
                        currentUser.id
                    );
            }


            // =========================
            // CLEAN UP STORAGE
            // =========================

            if (uploadedPath) {
                await client.storage
                    .from("gallery")
                    .remove([
                        uploadedPath
                    ]);
            }


            showUploadError(
                error?.message ||
                "Couldn't upload the artwork."
            );


        } finally {

            uploading = false;


            if (uploadSaveButton) {
                uploadSaveButton.disabled =
                    false;

                uploadSaveButton.textContent =
                    "Save ♡";
            }
        }
    }


    // ======================================
    // SHOW UPLOAD ERROR
    // ======================================

    function showUploadError(message) {

        if (uploadDialogError) {
            uploadDialogError.textContent =
                message;
        }

        if (uploadFileError) {
            uploadFileError.textContent =
                message;
        }

        /*
         * Only use alert if neither error element
         * exists.
         */
        if (
            !uploadDialogError &&
            !uploadFileError
        ) {
            alert(message);
        }
    }


    // ======================================
    // CLEAR UPLOAD ERRORS
    // ======================================

    function clearUploadErrors() {

        if (uploadDialogError) {
            uploadDialogError.textContent =
                "";
        }

        if (uploadFileError) {
            uploadFileError.textContent =
                "";
        }
    }


    // ======================================
    // STATUS
    // ======================================

    function showStatus(message) {

        if (galleryStatus) {
            galleryStatus.textContent =
                message;
        }
    }


    // ======================================
    // EVENTS
    // ======================================

    uploadArtworkButton?.addEventListener(
        "click",
        () => {

            if (
                !isOwner ||
                !currentUser ||
                !folder
            ) {
                return;
            }

            clearUploadErrors();

            uploadForm?.reset();

            uploadDialog?.showModal();
        }
    );


    uploadCancelButton?.addEventListener(
        "click",
        () => {

            if (uploading) {
                return;
            }

            clearUploadErrors();

            uploadForm?.reset();

            uploadDialog?.close();
        }
    );


    uploadForm?.addEventListener(
        "submit",
        uploadArtwork
    );


    backButton?.addEventListener(
        "click",
        () => {

            if (folder?.user_id) {

                window.location.href =
                    `gallery.html?user=${encodeURIComponent(
                        folder.user_id
                    )}`;

            } else {

                window.history.back();
            }
        }
    );


    // ======================================
    // INITIALIZE
    // ======================================

    loadFolderPage();

})();