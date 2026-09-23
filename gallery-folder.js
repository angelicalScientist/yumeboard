// =========================================================
// GALLERY FOLDER
// Artwork inside one specific gallery folder
// =========================================================

const client = window.supabaseClient;

let currentUser = null;
let folder = null;
let isOwner = false;
let artworks = [];
let uploading = false;


// =========================================================
// INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {
    bindFolderButtons();
    await loadFolderPage();
});


// =========================================================
// GET FOLDER ID
// =========================================================

function getFolderId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}


// =========================================================
// LOAD FOLDER PAGE
// =========================================================

async function loadFolderPage() {
    try {
        const {
            data: { user },
            error: userError
        } = await client.auth.getUser();

        if (userError) {
            throw userError;
        }

        currentUser = user || null;

        const folderId = getFolderId();

        if (!folderId) {
            showFolderUnavailable(
                "No folder was specified."
            );
            return;
        }

        const {
            data: folderData,
            error: folderError
        } = await client
            .from("gallery_folders")
            .select(`
                id,
                user_id,
                name,
                created_at,
                updated_at
            `)
            .eq("id", folderId)
            .maybeSingle();

        if (folderError) {
            throw folderError;
        }

        if (!folderData) {
            showFolderUnavailable(
                "This folder doesn't exist or is no longer available."
            );
            return;
        }

        folder = folderData;

        isOwner =
            Boolean(currentUser) &&
            String(currentUser.id) ===
            String(folder.user_id);

        updateOwnerInterface();

        await loadArtwork();

        renderFolder();

    } catch (error) {
        console.error(
            "GALLERY FOLDER: load error:",
            error
        );

        showFolderUnavailable(
            `Couldn't load this folder: ${
                error?.message || "Unknown error"
            }`
        );
    }
}


// =========================================================
// OWNER INTERFACE
// =========================================================

function updateOwnerInterface() {
    document
        .querySelectorAll(".gallery-owner-only")
        .forEach(element => {
            element.hidden = !isOwner;

            if (isOwner) {
                element.style.removeProperty("display");
            } else {
                element.style.setProperty(
                    "display",
                    "none",
                    "important"
                );
            }
        });
}


// =========================================================
// LOAD ARTWORK
// =========================================================

async function loadArtwork() {
    artworks = [];

    if (!folder?.id) {
        return;
    }

    // -----------------------------------------
    // Get artwork IDs belonging to this folder
    // -----------------------------------------

    const {
        data: relations,
        error: relationError
    } = await client
        .from("gallery_item_folders")
        .select("gallery_item_id")
        .eq("folder_id", folder.id);

    if (relationError) {
        throw relationError;
    }

    const artworkIds =
        (relations || [])
            .map(relation => relation.gallery_item_id)
            .filter(Boolean);

    if (!artworkIds.length) {
        return;
    }

    // -----------------------------------------
    // Load artwork rows
    // -----------------------------------------

    let query = client
        .from("gallery_items")
        .select(`
            id,
            user_id,
            image_url,
            image_path,
            storage_path,
            title,
            description,
            created_at,
            updated_at,
            is_hidden,
            hidden_at,
            hidden_by
        `)
        .in("id", artworkIds)
        .order("created_at", {
            ascending: false
        });

    // Only the owner should see their own hidden
    // artwork. Everyone else sees public artwork.
    if (!isOwner) {
        query = query.eq("is_hidden", false);
    }

    const {
        data,
        error
    } = await query;

    if (error) {
        throw error;
    }

    // Extra ownership check so a bad relation cannot
    // accidentally make another user's artwork appear.
    artworks = (data || []).filter(item => {
        return (
            String(item.user_id) ===
            String(folder.user_id)
        );
    });
}


// =========================================================
// RENDER FOLDER
// =========================================================

function renderFolder() {
    const titleElement =
        document.getElementById("folderTitle");

    const descriptionElement =
        document.getElementById("folderDescription");

    const grid =
        document.getElementById("artworkGrid");

    const emptyState =
        document.getElementById("artworkEmpty");

    const unavailable =
        document.getElementById("folderUnavailable");

    if (unavailable) {
        unavailable.hidden = true;
    }

    if (titleElement) {
        titleElement.textContent =
            folder?.name ||
            "Untitled Folder";
    }

    if (descriptionElement) {
        descriptionElement.textContent =
            `Artwork in this folder ♡`;
    }

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    if (!artworks.length) {
        grid.hidden = true;

        if (emptyState) {
            emptyState.hidden = false;
        }

        return;
    }

    grid.hidden = false;

    if (emptyState) {
        emptyState.hidden = true;
    }

    artworks.forEach(artwork => {
        grid.appendChild(
            createArtworkCard(artwork)
        );
    });
}


// =========================================================
// CREATE ARTWORK CARD
// =========================================================

function createArtworkCard(artwork) {
    const card =
        document.createElement("article");

    card.className = "artwork-card";

    if (artwork.is_hidden) {
        card.classList.add(
            "artwork-hidden"
        );
    }

    // -----------------------------------------
    // IMAGE
    // -----------------------------------------

    const image =
        document.createElement("img");

    image.className =
        "artwork-card-image";

    image.src =
        artwork.image_url || "";

    image.alt =
        artwork.title ||
        "Artwork";

    image.loading = "lazy";

    image.addEventListener(
        "click",
        () => openArtworkViewer(artwork)
    );

    card.appendChild(image);

    // -----------------------------------------
    // CONTENT
    // -----------------------------------------

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

    // -----------------------------------------
    // ACTIONS
    // -----------------------------------------

    if (
        isOwner &&
        String(artwork.user_id) ===
        String(currentUser?.id)
    ) {
        const actions =
            document.createElement("div");

        actions.className =
            "artwork-card-actions";

        // Edit
        const editButton =
            document.createElement("button");

        editButton.type = "button";
        editButton.textContent =
            "✏️ Edit";

        editButton.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                if (
                    typeof window.galleryEditArtwork ===
                    "function"
                ) {
                    window.galleryEditArtwork(
                        artwork
                    );
                } else {
                    editArtwork(artwork);
                }
            }
        );

        // Remove from folder
        const removeButton =
            document.createElement("button");

        removeButton.type = "button";
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

        // Delete completely
        const deleteButton =
            document.createElement("button");

        deleteButton.type = "button";
        deleteButton.textContent =
            "🗑️ Delete";

        deleteButton.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                deleteArtwork(
                    artwork
                );
            }
        );

        actions.appendChild(editButton);
        actions.appendChild(removeButton);
        actions.appendChild(deleteButton);

        content.appendChild(actions);
    }

    // -----------------------------------------
    // MODERATOR INDICATOR
    // -----------------------------------------

    if (artwork.is_hidden) {
        const hiddenLabel =
            document.createElement("p");

        hiddenLabel.className =
            "artwork-hidden-label";

        hiddenLabel.textContent =
            "🙈 Hidden";

        content.appendChild(hiddenLabel);
    }

    card.appendChild(content);

    return card;
}


// =========================================================
// ARTWORK VIEWER
// =========================================================

function openArtworkViewer(artwork) {
    const dialog =
        document.createElement("dialog");

    dialog.className =
        "artwork-viewer-dialog";

    const closeButton =
        document.createElement("button");

    closeButton.type = "button";
    closeButton.className =
        "artwork-viewer-close";

    closeButton.textContent = "×";

    closeButton.addEventListener(
        "click",
        () => dialog.close()
    );

    const image =
        document.createElement("img");

    image.className =
        "artwork-viewer-image";

    image.src =
        artwork.image_url || "";

    image.alt =
        artwork.title ||
        "Artwork";

    const title =
        document.createElement("h2");

    title.textContent =
        artwork.title ||
        "♡ Artwork";

    dialog.appendChild(closeButton);
    dialog.appendChild(image);
    dialog.appendChild(title);

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


// =========================================================
// EDIT ARTWORK
// =========================================================

async function editArtwork(artwork) {
    if (
        !isOwner ||
        !currentUser ||
        !artwork ||
        String(artwork.user_id) !==
        String(currentUser.id)
    ) {
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

    showStatus(
        "Saving artwork... 🌸"
    );

    const {
        error
    } = await client
        .from("gallery_items")
        .update({
            title:
                title.trim() || null,

            description:
                description.trim() || null,

            updated_at:
                new Date().toISOString()
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
            "GALLERY FOLDER: edit error:",
            error
        );

        showStatus(
            `Couldn't update artwork: ${
                error.message
            }`,
            true
        );

        return;
    }

    await loadFolderPage();

    showStatus(
        "Artwork updated! ♡"
    );
}


// =========================================================
// REMOVE FROM FOLDER
// =========================================================

async function removeFromFolder(
    artwork
) {
    if (
        !isOwner ||
        !currentUser ||
        !artwork ||
        String(artwork.user_id) !==
        String(currentUser.id)
    ) {
        return;
    }

    const confirmed =
        window.confirm(
            `Remove "${artwork.title || "this artwork"}" from "${folder?.name || "this folder"}"?\n\n` +
            "The artwork itself will stay in your gallery."
        );

    if (!confirmed) {
        return;
    }

    showStatus(
        "Removing from folder... 🌸"
    );

    try {
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
            throw error;
        }

        await loadFolderPage();

        showStatus(
            "Artwork removed from this folder. ♡"
        );

    } catch (error) {
        console.error(
            "GALLERY FOLDER: remove error:",
            error
        );

        showStatus(
            `Couldn't remove artwork from folder: ${
                error?.message ||
                "Unknown error"
            }`,
            true
        );
    }
}


// =========================================================
// DELETE ARTWORK COMPLETELY
// =========================================================

async function deleteArtwork(
    artwork
) {
    if (
        !isOwner ||
        !currentUser ||
        !artwork ||
        String(artwork.user_id) !==
        String(currentUser.id)
    ) {
        return;
    }

    const title =
        artwork.title ||
        "this artwork";

    const confirmed =
        window.confirm(
            `Delete "${title}" permanently?\n\n` +
            "This removes the artwork from your gallery, " +
            "this folder, and deletes its uploaded image.\n\n" +
            "This cannot be undone."
        );

    if (!confirmed) {
        return;
    }

    showStatus(
        "Deleting artwork... 🌸"
    );

    try {
        // -----------------------------------------
        // Storage path
        // -----------------------------------------

        const storagePath =
            artwork.storage_path ||
            artwork.image_path ||
            null;

        // -----------------------------------------
        // Delete storage object first
        //
        // This prevents the database from pointing
        // at a file we know we couldn't remove.
        // -----------------------------------------

        if (storagePath) {
            const {
                error: storageError
            } = await client
                .storage
                .from("gallery")
                .remove([
                    storagePath
                ]);

            if (storageError) {
                throw storageError;
            }
        }

        // -----------------------------------------
        // Remove folder relationships
        // -----------------------------------------

        const {
            error: relationError
        } = await client
            .from("gallery_item_folders")
            .delete()
            .eq(
                "gallery_item_id",
                artwork.id
            );

        if (relationError) {
            throw relationError;
        }

        // -----------------------------------------
        // Delete artwork row
        // -----------------------------------------

        const {
            error: artworkError
        } = await client
            .from("gallery_items")
            .delete()
            .eq(
                "id",
                artwork.id
            )
            .eq(
                "user_id",
                currentUser.id
            );

        if (artworkError) {
            throw artworkError;
        }

        await loadFolderPage();

        showStatus(
            "Artwork deleted. ♡"
        );

    } catch (error) {
        console.error(
            "GALLERY FOLDER: delete error:",
            error
        );

        showStatus(
            `Couldn't delete artwork: ${
                error?.message ||
                "Unknown error"
            }`,
            true
        );
    }
}


// =========================================================
// UPLOAD DIALOG
// =========================================================

function openUploadDialog() {
    if (
        !isOwner ||
        !currentUser
    ) {
        return;
    }

    const dialog =
        document.getElementById(
            "uploadDialog"
        );

    if (!dialog) {
        console.error(
            "GALLERY FOLDER: #uploadDialog not found."
        );
        return;
    }

    const form =
        document.getElementById(
            "uploadForm"
        );

    form?.reset();

    clearUploadError();

    const preview =
        document.getElementById(
            "uploadPreview"
        );

    const previewImage =
        document.getElementById(
            "uploadPreviewImage"
        );

    if (preview) {
        preview.hidden = true;
    }

    if (previewImage) {
        previewImage.removeAttribute(
            "src"
        );
    }

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


// =========================================================
// UPLOAD ARTWORK
// =========================================================

async function uploadArtwork(
    event
) {
    event.preventDefault();

    if (
        !isOwner ||
        !currentUser?.id ||
        uploading
    ) {
        return;
    }

    const fileInput =
        document.getElementById(
            "artworkFile"
        );

    const titleInput =
        document.getElementById(
            "artworkTitle"
        );

    const descriptionInput =
        document.getElementById(
            "artworkDescription"
        );

    const saveButton =
        document.getElementById(
            "uploadSaveButton"
        );

    const dialog =
        document.getElementById(
            "uploadDialog"
        );

    clearUploadError();

    const file =
        fileInput?.files?.[0];

    if (!file) {
        showUploadError(
            "Please choose an image first. ♡"
        );
        return;
    }

    const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif"
    ];

    if (
        !allowedTypes.includes(
            file.type
        )
    ) {
        showUploadError(
            "Please choose a PNG, JPEG, WEBP, or GIF image."
        );
        return;
    }

    if (
        file.size >
        10 * 1024 * 1024
    ) {
        showUploadError(
            "Images must be 10 MB or smaller."
        );
        return;
    }

    uploading = true;

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent =
            "Uploading... ♡";
    }

    let storagePath = null;
    let databaseArtwork = null;

    try {
        const extension =
            getFileExtension(file);

        storagePath =
            `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

        showStatus(
            "Uploading your artwork... 🌸"
        );

        // -----------------------------------------
        // STORAGE
        // -----------------------------------------

        const {
            error: uploadError
        } = await client
            .storage
            .from("gallery")
            .upload(
                storagePath,
                file,
                {
                    cacheControl: "3600",
                    contentType: file.type,
                    upsert: false
                }
            );

        if (uploadError) {
            throw uploadError;
        }

        // -----------------------------------------
        // PUBLIC URL
        // -----------------------------------------

        const {
            data: publicUrlData
        } = client
            .storage
            .from("gallery")
            .getPublicUrl(
                storagePath
            );

        const imageUrl =
            publicUrlData?.publicUrl;

        if (!imageUrl) {
            throw new Error(
                "Couldn't create the image URL."
            );
        }

        // -----------------------------------------
        // DATABASE
        // -----------------------------------------

        const title =
            titleInput?.value.trim() ||
            null;

        const description =
            descriptionInput?.value.trim() ||
            null;

        const {
            data: artwork,
            error: itemError
        } = await client
            .from("gallery_items")
            .insert({
                user_id:
                    currentUser.id,

                image_url:
                    imageUrl,

                // Keep both fields so this matches
                // gallery.js and older artwork rows.
                image_path:
                    storagePath,

                storage_path:
                    storagePath,

                title,
                description,

                is_hidden:
                    false
            })
            .select()
            .single();

        if (itemError) {
            throw itemError;
        }

        databaseArtwork =
            artwork;

        // -----------------------------------------
        // ADD TO THIS FOLDER
        // -----------------------------------------

        const {
            error: relationError
        } = await client
            .from("gallery_item_folders")
            .insert({
                gallery_item_id:
                    artwork.id,

                folder_id:
                    folder.id
            });

        if (relationError) {
            throw relationError;
        }

        // -----------------------------------------
        // CLOSE + REFRESH
        // -----------------------------------------

        if (dialog?.open) {
            dialog.close();
        }

        await loadFolderPage();

        showStatus(
            "Artwork uploaded! ♡"
        );

    } catch (error) {
        console.error(
            "GALLERY FOLDER: upload error:",
            error
        );

        // -----------------------------------------
        // CLEANUP
        // -----------------------------------------

        if (databaseArtwork?.id) {
            try {
                await client
                    .from("gallery_item_folders")
                    .delete()
                    .eq(
                        "gallery_item_id",
                        databaseArtwork.id
                    );
            } catch (cleanupError) {
                console.error(
                    "GALLERY FOLDER: relation cleanup error:",
                    cleanupError
                );
            }

            try {
                await client
                    .from("gallery_items")
                    .delete()
                    .eq(
                        "id",
                        databaseArtwork.id
                    )
                    .eq(
                        "user_id",
                        currentUser.id
                    );
            } catch (cleanupError) {
                console.error(
                    "GALLERY FOLDER: database cleanup error:",
                    cleanupError
                );
            }
        }

        if (storagePath) {
            try {
                await client
                    .storage
                    .from("gallery")
                    .remove([
                        storagePath
                    ]);
            } catch (cleanupError) {
                console.error(
                    "GALLERY FOLDER: storage cleanup error:",
                    cleanupError
                );
            }
        }

        showUploadError(
            `Couldn't upload artwork: ${
                error?.message ||
                "Unknown error"
            }`
        );

        showStatus(
            "Couldn't upload artwork.",
            true
        );

    } finally {
        uploading = false;

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent =
                "Upload ♡";
        }
    }
}


// =========================================================
// FILE EXTENSION
// =========================================================

function getFileExtension(file) {
    const originalName =
        file?.name || "";

    const parts =
        originalName.split(".");

    if (parts.length > 1) {
        const extension =
            parts
                .pop()
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                );

        if (extension) {
            return extension;
        }
    }

    switch (file?.type) {
        case "image/png":
            return "png";

        case "image/jpeg":
            return "jpg";

        case "image/webp":
            return "webp";

        case "image/gif":
            return "gif";

        default:
            return "img";
    }
}


// =========================================================
// PREVIEW
// =========================================================

function handleArtworkFilePreview() {
    const fileInput =
        document.getElementById(
            "artworkFile"
        );

    const preview =
        document.getElementById(
            "uploadPreview"
        );

    const previewImage =
        document.getElementById(
            "uploadPreviewImage"
        );

    const file =
        fileInput?.files?.[0];

    if (
        !file ||
        !preview ||
        !previewImage
    ) {
        return;
    }

    const reader =
        new FileReader();

    reader.onload = () => {
        previewImage.src =
            reader.result;

        preview.hidden = false;
    };

    reader.readAsDataURL(file);
}


// =========================================================
// CLEAR UPLOAD ERROR
// =========================================================

function clearUploadError() {
    const element =
        document.getElementById(
            "uploadError"
        );

    if (!element) {
        return;
    }

    element.textContent = "";
    element.hidden = true;
}


// =========================================================
// SHOW UPLOAD ERROR
// =========================================================

function showUploadError(
    message
) {
    const element =
        document.getElementById(
            "uploadError"
        );

    if (!element) {
        console.error(
            "GALLERY FOLDER:",
            message
        );
        return;
    }

    element.textContent =
        message || "";

    element.hidden =
        !message;
}


// =========================================================
// FOLDER UNAVAILABLE
// =========================================================

function showFolderUnavailable(
    message
) {
    const unavailable =
        document.getElementById(
            "folderUnavailable"
        );

    const status =
        document.getElementById(
            "folderStatus"
        );

    const grid =
        document.getElementById(
            "artworkGrid"
        );

    const empty =
        document.getElementById(
            "artworkEmpty"
        );

    if (unavailable) {
        unavailable.hidden = false;
    }

    if (status) {
        status.textContent =
            message || "";

        status.classList.add(
            "visible"
        );

        status.classList.add(
            "error"
        );
    }

    if (grid) {
        grid.hidden = true;
    }

    if (empty) {
        empty.hidden = true;
    }
}


// =========================================================
// STATUS
// =========================================================

function showStatus(
    message,
    isError = false
) {
    const status =
        document.getElementById(
            "folderStatus"
        );

    if (!status) {
        return;
    }

    status.textContent =
        message || "";

    status.classList.toggle(
        "visible",
        Boolean(message)
    );

    status.classList.toggle(
        "error",
        Boolean(isError)
    );

    window.clearTimeout(
        showStatus.timeout
    );

    if (
        message &&
        !isError
    ) {
        showStatus.timeout =
            window.setTimeout(
                () => {
                    status.textContent =
                        "";

                    status.classList.remove(
                        "visible"
                    );

                    status.classList.remove(
                        "error"
                    );
                },
                3500
            );
    }
}


// =========================================================
// BUTTON BINDINGS
// =========================================================

function bindFolderButtons() {
    // -----------------------------------------
    // UPLOAD
    // -----------------------------------------

    document
        .getElementById(
            "uploadArtworkButton"
        )
        ?.addEventListener(
            "click",
            openUploadDialog
        );

    document
        .getElementById(
            "emptyUploadButton"
        )
        ?.addEventListener(
            "click",
            openUploadDialog
        );

    // -----------------------------------------
    // REFRESH
    // -----------------------------------------

    document
        .getElementById(
            "refreshArtworkButton"
        )
        ?.addEventListener(
            "click",
            async () => {
                await loadFolderPage();
            }
        );

    // -----------------------------------------
    // UPLOAD FORM
    // -----------------------------------------

    document
        .getElementById(
            "uploadForm"
        )
        ?.addEventListener(
            "submit",
            uploadArtwork
        );

    // -----------------------------------------
    // FILE PREVIEW
    // -----------------------------------------

    document
        .getElementById(
            "artworkFile"
        )
        ?.addEventListener(
            "change",
            handleArtworkFilePreview
        );

    // -----------------------------------------
    // CANCEL
    // -----------------------------------------

    document
        .getElementById(
            "uploadCancelButton"
        )
        ?.addEventListener(
            "click",
            () => {
                const dialog =
                    document.getElementById(
                        "uploadDialog"
                    );

                clearUploadError();

                if (dialog?.open) {
                    dialog.close();
                }
            }
        );

    // -----------------------------------------
    // DIALOG BACKDROP
    // -----------------------------------------

    document
        .getElementById(
            "uploadDialog"
        )
        ?.addEventListener(
            "close",
            clearUploadError
        );
}


// =========================================================
// GLOBAL API
// =========================================================

window.galleryFolderLoad =
    loadFolderPage;

window.galleryFolderUpload =
    uploadArtwork;

window.galleryFolderEditArtwork =
    editArtwork;

window.galleryFolderDeleteArtwork =
    deleteArtwork;

window.galleryFolderRemoveArtwork =
    removeFromFolder;