// =========================================================
// GALLERY FOLDER
// Artwork inside a single gallery folder
// =========================================================

const client = window.supabaseClient;

let currentUser = null;
let folder = null;
let folderId = null;
let isOwner = false;
let artworks = [];
let uploading = false;
let statusTimeout = null;

// =========================================================
// INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();
    await loadFolderPage();
});

// =========================================================
// GET FOLDER ID
// =========================================================

function getFolderId() {
    const params = new URLSearchParams(window.location.search);

    return (
        params.get("id") ||
        params.get("folder")
    );
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
        folderId = getFolderId();

        if (!folderId) {
            showFolderUnavailable(
                "No gallery folder was specified."
            );
            return;
        }

        // -------------------------------------------------
        // Load folder
        // IMPORTANT:
        // gallery_folders does NOT have a description column.
        // -------------------------------------------------

        const {
            data,
            error
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

        if (error) {
            throw error;
        }

        if (!data) {
            showFolderUnavailable(
                "This gallery folder doesn't exist or is no longer available."
            );
            return;
        }

        folder = data;

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
            `Couldn't load this gallery folder: ${
                error?.message || "Unknown error"
            }`
        );
    }
}

// =========================================================
// FOLDER UNAVAILABLE
// =========================================================

function showFolderUnavailable(message) {
    const unavailable =
        document.getElementById(
            "folderUnavailable"
        );

    const grid =
        document.getElementById(
            "artworkGrid"
        );

    const empty =
        document.getElementById(
            "artworkEmpty"
        );

    const title =
        document.getElementById(
            "folderTitle"
        );

    const description =
        document.getElementById(
            "folderDescription"
        );

    if (title) {
        title.textContent = "Gallery folder";
    }

    // gallery_folders has no description column,
    // so keep the description element empty/hidden.
    if (description) {
        description.textContent = "";
        description.hidden = true;
    }

    if (grid) {
        grid.innerHTML = "";
        grid.hidden = true;
    }

    if (empty) {
        empty.hidden = true;
    }

    if (unavailable) {
        unavailable.textContent = message;
        unavailable.hidden = false;
    } else {
        showStatus(message, true);
    }

    const uploadButton =
        document.getElementById(
            "uploadArtworkButton"
        );

    const emptyUploadButton =
        document.getElementById(
            "emptyUploadButton"
        );

    if (uploadButton) {
        uploadButton.hidden = true;
        uploadButton.disabled = true;
    }

    if (emptyUploadButton) {
        emptyUploadButton.hidden = true;
        emptyUploadButton.disabled = true;
    }
}

// =========================================================
// OWNER INTERFACE
// =========================================================

function updateOwnerInterface() {
    document
        .querySelectorAll(".gallery-owner-only")
        .forEach((element) => {
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

    const uploadButton =
        document.getElementById(
            "uploadArtworkButton"
        );

    const emptyUploadButton =
        document.getElementById(
            "emptyUploadButton"
        );

    if (uploadButton) {
        uploadButton.hidden = !isOwner;
        uploadButton.disabled = !isOwner;
    }

    if (emptyUploadButton) {
        emptyUploadButton.hidden = !isOwner;
        emptyUploadButton.disabled = !isOwner;
    }
}

// =========================================================
// LOAD ARTWORK
// =========================================================

async function loadArtwork() {
    artworks = [];

    const {
        data: relations,
        error: relationError
    } = await client
        .from("gallery_item_folders")
        .select("gallery_item_id")
        .eq("folder_id", folderId);

    if (relationError) {
        throw relationError;
    }

    if (!relations?.length) {
        return;
    }

    const artworkIds = [
        ...new Set(
            relations.map(
                (relation) =>
                    relation.gallery_item_id
            )
        )
    ];

    if (!artworkIds.length) {
        return;
    }

    const {
        data,
        error
    } = await client
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
        .eq("user_id", folder.user_id)
        .eq("is_hidden", false)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    artworks = data || [];
}

// =========================================================
// RENDER FOLDER
// =========================================================

function renderFolder() {
    const unavailable =
        document.getElementById(
            "folderUnavailable"
        );

    const title =
        document.getElementById(
            "folderTitle"
        );

    const description =
        document.getElementById(
            "folderDescription"
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
        unavailable.hidden = true;
    }

    if (title) {
        title.textContent =
            `📁 ${
                folder?.name ||
                "Untitled Folder"
            }`;
    }

    // gallery_folders does not have a description column.
    if (description) {
        description.textContent = "";
        description.hidden = true;
    }

    if (!grid || !empty) {
        return;
    }

    grid.innerHTML = "";

    if (!artworks.length) {
        grid.hidden = true;
        empty.hidden = false;
        return;
    }

    empty.hidden = true;
    grid.hidden = false;

    artworks.forEach((artwork) => {
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
        document.createElement(
            "article"
        );

    card.className = "artwork-card";

    const image =
        document.createElement("img");

    image.className =
        "artwork-card-image";

    image.src =
        artwork.image_url;

    image.alt =
        artwork.title ||
        "Artwork";

    image.loading = "lazy";

    image.addEventListener(
        "click",
        () => {
            openArtworkViewer(
                artwork
            );
        }
    );

    card.appendChild(image);

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

        content.appendChild(
            description
        );
    }

    const actions =
        document.createElement("div");

    actions.className =
        "artwork-card-actions";

    if (
        isOwner &&
        currentUser &&
        String(artwork.user_id) ===
            String(currentUser.id)
    ) {
        const editButton =
            document.createElement(
                "button"
            );

        editButton.type = "button";
        editButton.textContent =
            "✏️ Edit";

        editButton.addEventListener(
            "click",
            (event) => {
                event.stopPropagation();
                editArtwork(artwork);
            }
        );

        const folderButton =
            document.createElement(
                "button"
            );

        folderButton.type = "button";
        folderButton.textContent =
            "📂 Remove from folder";

        folderButton.addEventListener(
            "click",
            (event) => {
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
            folderButton
        );
    }

    if (actions.children.length) {
        content.appendChild(
            actions
        );
    }

    card.appendChild(content);

    return card;
}

// =========================================================
// ARTWORK VIEWER
// =========================================================

function openArtworkViewer(artwork) {
    const dialog =
        document.getElementById(
            "artworkDialog"
        );

    const image =
        document.getElementById(
            "artworkDialogImage"
        );

    const title =
        document.getElementById(
            "artworkDialogTitle"
        );

    const description =
        document.getElementById(
            "artworkDialogDescription"
        );

    if (
        !dialog ||
        !image ||
        !title ||
        !description
    ) {
        return;
    }

    image.src =
        artwork.image_url;

    image.alt =
        artwork.title ||
        "Artwork";

    title.textContent =
        artwork.title ||
        "♡ Artwork";

    description.textContent =
        artwork.description ||
        "";

    description.hidden =
        !artwork.description;

    if (!dialog.open) {
        dialog.showModal();
    }
}

// =========================================================
// EDIT ARTWORK
// =========================================================

function editArtwork(artwork) {
    if (
        !isOwner ||
        !currentUser ||
        String(artwork.user_id) !==
            String(currentUser.id)
    ) {
        return;
    }

    const dialog =
        document.createElement(
            "dialog"
        );

    dialog.className =
        "artwork-edit-dialog";

    const heading =
        document.createElement("h2");

    heading.textContent =
        "✏️ Edit artwork";

    dialog.appendChild(heading);

    const preview =
        document.createElement("img");

    preview.className =
        "artwork-edit-preview";

    preview.src =
        artwork.image_url;

    preview.alt =
        artwork.title ||
        "Artwork";

    dialog.appendChild(preview);

    const form =
        document.createElement("form");

    form.className =
        "artwork-edit-form";

    // -----------------------------------------------------
    // TITLE
    // -----------------------------------------------------

    const titleLabel =
        document.createElement("label");

    titleLabel.textContent =
        "Title";

    const titleInput =
        document.createElement("input");

    titleInput.type = "text";
    titleInput.maxLength = 200;
    titleInput.value =
        artwork.title || "";

    titleLabel.appendChild(
        titleInput
    );

    // -----------------------------------------------------
    // DESCRIPTION
    // -----------------------------------------------------

    const descriptionLabel =
        document.createElement(
            "label"
        );

    descriptionLabel.textContent =
        "Description";

    const descriptionInput =
        document.createElement(
            "textarea"
        );

    descriptionInput.rows = 5;
    descriptionInput.maxLength = 2000;
    descriptionInput.value =
        artwork.description || "";

    descriptionLabel.appendChild(
        descriptionInput
    );

    // -----------------------------------------------------
    // STATUS
    // -----------------------------------------------------

    const status =
        document.createElement("p");

    status.className =
        "artwork-edit-status";

    // -----------------------------------------------------
    // BUTTONS
    // -----------------------------------------------------

    const buttons =
        document.createElement("div");

    buttons.className =
        "artwork-edit-actions";

    const cancelButton =
        document.createElement(
            "button"
        );

    cancelButton.type = "button";
    cancelButton.textContent =
        "Cancel";

    const deleteButton =
        document.createElement(
            "button"
        );

    deleteButton.type = "button";
    deleteButton.textContent =
        "🗑️ Delete artwork";

    const saveButton =
        document.createElement(
            "button"
        );

    saveButton.type = "submit";
    saveButton.textContent =
        "Save changes ♡";

    // -----------------------------------------------------
    // CANCEL
    // -----------------------------------------------------

    cancelButton.addEventListener(
        "click",
        () => {
            dialog.close();
        }
    );

    // -----------------------------------------------------
    // DELETE
    // -----------------------------------------------------

    deleteButton.addEventListener(
        "click",
        async () => {
            const confirmed =
                window.confirm(
                    `Delete "${
                        artwork.title ||
                        "this artwork"
                    }" permanently?\n\n` +
                    "The artwork and uploaded image will be removed. This cannot be undone."
                );

            if (!confirmed) {
                return;
            }

            deleteButton.disabled = true;
            cancelButton.disabled = true;
            saveButton.disabled = true;

            status.textContent =
                "Deleting artwork... 🌸";

            try {
                await performArtworkDelete(
                    artwork
                );

                dialog.close();

                await loadFolderPage();

                showStatus(
                    "Artwork deleted. ♡"
                );

            } catch (error) {
                console.error(
                    "GALLERY FOLDER: delete error:",
                    error
                );

                status.textContent =
                    `Couldn't delete artwork: ${
                        error?.message ||
                        "Unknown error"
                    }`;

                deleteButton.disabled = false;
                cancelButton.disabled = false;
                saveButton.disabled = false;
            }
        }
    );

    // -----------------------------------------------------
    // SAVE
    // -----------------------------------------------------

    form.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            saveButton.disabled = true;
            cancelButton.disabled = true;
            deleteButton.disabled = true;

            status.textContent =
                "Saving artwork... 🌸";

            try {
                const {
                    error
                } = await client
                    .from("gallery_items")
                    .update({
                        title:
                            titleInput.value.trim() ||
                            null,

                        description:
                            descriptionInput.value.trim() ||
                            null,

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
                    throw error;
                }

                dialog.close();

                await loadFolderPage();

                showStatus(
                    "Artwork updated! ♡"
                );

            } catch (error) {
                console.error(
                    "GALLERY FOLDER: edit error:",
                    error
                );

                status.textContent =
                    `Couldn't update artwork: ${
                        error?.message ||
                        "Unknown error"
                    }`;

                saveButton.disabled = false;
                cancelButton.disabled = false;
                deleteButton.disabled = false;
            }
        }
    );

    // -----------------------------------------------------
    // BUILD FORM
    // -----------------------------------------------------

    buttons.appendChild(
        cancelButton
    );

    buttons.appendChild(
        deleteButton
    );

    buttons.appendChild(
        saveButton
    );

    form.appendChild(
        titleLabel
    );

    form.appendChild(
        descriptionLabel
    );

    form.appendChild(
        status
    );

    form.appendChild(
        buttons
    );

    dialog.appendChild(form);

    document.body.appendChild(
        dialog
    );

    dialog.addEventListener(
        "close",
        () => {
            dialog.remove();
        },
        { once: true }
    );

    dialog.addEventListener(
        "cancel",
        () => {
            dialog.close();
        }
    );

    dialog.showModal();

    titleInput.focus();
}

// =========================================================
// DELETE ARTWORK
// =========================================================

async function performArtworkDelete(
    artwork
) {
    if (
        !currentUser ||
        !isOwner ||
        String(artwork.user_id) !==
            String(currentUser.id)
    ) {
        throw new Error(
            "You don't own this artwork."
        );
    }

    const storagePath =
        artwork.storage_path ||
        artwork.image_path ||
        null;

    // -----------------------------------------------------
    // Delete uploaded image from Storage first.
    // -----------------------------------------------------

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
            throw new Error(
                `The image couldn't be removed from storage: ${storageError.message}`
            );
        }
    }

    // -----------------------------------------------------
    // Remove all folder relationships.
    // -----------------------------------------------------

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

    // -----------------------------------------------------
    // Delete artwork database row.
    // -----------------------------------------------------

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
}

// =========================================================
// REMOVE ARTWORK FROM THIS FOLDER
// =========================================================

async function removeFromFolder(
    artwork
) {
    if (
        !isOwner ||
        !currentUser ||
        String(artwork.user_id) !==
            String(currentUser.id)
    ) {
        return;
    }

    const confirmed =
        window.confirm(
            `Remove "${
                artwork.title ||
                "this artwork"
            }" from this folder?\n\n` +
            "The artwork itself will stay in your gallery."
        );

    if (!confirmed) {
        return;
    }

    showStatus(
        "Removing artwork from folder... 🌸"
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
                folderId
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
            "GALLERY FOLDER: remove from folder error:",
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
// OPEN UPLOAD DIALOG
// =========================================================

async function openUploadDialog() {
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

    const form =
        document.getElementById(
            "uploadForm"
        );

    if (!dialog || !form) {
        return;
    }

    form.reset();

    clearUploadError();
    resetUploadPreview();

    await renderUploadFolderList();

    if (!dialog.open) {
        dialog.showModal();
    }
}

// =========================================================
// CLOSE UPLOAD DIALOG
// =========================================================

function closeUploadDialog() {
    const dialog =
        document.getElementById(
            "uploadDialog"
        );

    if (dialog?.open) {
        dialog.close();
    }

    const form =
        document.getElementById(
            "uploadForm"
        );

    if (form) {
        form.reset();
    }

    clearUploadError();
    resetUploadPreview();
}

// =========================================================
// RENDER UPLOAD FOLDER LIST
// =========================================================

async function renderUploadFolderList() {
    const list =
        document.getElementById(
            "uploadFolderList"
        );

    if (!list || !currentUser) {
        return;
    }

    list.innerHTML =
        "<p>Loading folders... 🌸</p>";

    const {
        data: userFolders,
        error
    } = await client
        .from("gallery_folders")
        .select(
            "id, name"
        )
        .eq(
            "user_id",
            currentUser.id
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        );

    if (error) {
        console.error(
            "GALLERY FOLDER: folder list error:",
            error
        );

        list.textContent =
            "Couldn't load folders.";

        return;
    }

    list.innerHTML = "";

    if (!userFolders?.length) {
        const empty =
            document.createElement("p");

        empty.textContent =
            "You don't have any folders yet. The artwork can still be uploaded unsorted. ♡";

        list.appendChild(empty);

        return;
    }

    userFolders.forEach(
        (userFolder) => {
            const label =
                document.createElement(
                    "label"
                );

            label.className =
                "upload-folder-option";

            const checkbox =
                document.createElement(
                    "input"
                );

            checkbox.type =
                "checkbox";

            checkbox.name =
                "folderIds";

            checkbox.value =
                String(
                    userFolder.id
                );

            // Automatically select the
            // folder currently being viewed.
            checkbox.checked =
                String(
                    userFolder.id
                ) ===
                String(folderId);

            const text =
                document.createElement(
                    "span"
                );

            text.textContent =
                userFolder.name ||
                "Untitled Folder";

            label.appendChild(
                checkbox
            );

            label.appendChild(
                text
            );

            list.appendChild(
                label
            );
        }
    );
}

// =========================================================
// UPLOAD ARTWORK
// =========================================================

async function uploadArtwork(event) {
    event.preventDefault();

    if (
        uploading ||
        !isOwner ||
        !currentUser
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

    const file =
        fileInput?.files?.[0];

    if (!file) {
        showUploadError(
            "Please choose an image."
        );

        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/avif"
    ];

    if (
        !allowedTypes.includes(
            file.type
        )
    ) {
        showUploadError(
            "Please choose a supported image file."
        );

        return;
    }

    const maxSize =
        10 * 1024 * 1024;

    if (file.size > maxSize) {
        showUploadError(
            "Images must be 10 MB or smaller."
        );

        return;
    }

    uploading = true;

    const saveButton =
        document.getElementById(
            "uploadSaveButton"
        );

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent =
            "Uploading... 🌸";
    }

    clearUploadError();

    let storagePath = null;
    let createdArtworkId = null;

    try {
        // -------------------------------------------------
        // Create unique storage path
        // -------------------------------------------------

        const extension =
            getFileExtension(file);

        const uniqueId =
            typeof crypto !==
                "undefined" &&
            typeof crypto.randomUUID ===
                "function"
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2)}`;

        storagePath =
            `${currentUser.id}/${uniqueId}.${extension}`;

        // -------------------------------------------------
        // Upload image
        // -------------------------------------------------

        const {
            error: uploadStorageError
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

        if (uploadStorageError) {
            throw uploadStorageError;
        }

        // -------------------------------------------------
        // Get public URL
        // -------------------------------------------------

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

        // -------------------------------------------------
        // Create database row
        // -------------------------------------------------

        const {
            data: artworkData,
            error: artworkError
        } = await client
            .from("gallery_items")
            .insert({
                user_id:
                    currentUser.id,

                image_url:
                    imageUrl,

                image_path:
                    storagePath,

                storage_path:
                    storagePath,

                title:
                    titleInput?.value.trim() ||
                    null,

                description:
                    descriptionInput?.value.trim() ||
                    null,

                is_hidden:
                    false
            })
            .select("id")
            .single();

        if (artworkError) {
            throw artworkError;
        }

        createdArtworkId =
            artworkData?.id ||
            null;

        // -------------------------------------------------
        // Folder assignments
        // -------------------------------------------------

        const selectedFolderIds =
            Array.from(
                document.querySelectorAll(
                    '#uploadFolderList input[type="checkbox"]:checked'
                )
            ).map(
                (checkbox) =>
                    checkbox.value
            );

        if (
            createdArtworkId &&
            selectedFolderIds.length
        ) {
            const rows =
                selectedFolderIds.map(
                    (selectedFolderId) => ({
                        gallery_item_id:
                            createdArtworkId,

                        folder_id:
                            selectedFolderId
                    })
                );

            const {
                error: relationError
            } = await client
                .from(
                    "gallery_item_folders"
                )
                .insert(rows);

            if (relationError) {
                console.error(
                    "GALLERY FOLDER: folder assignment error:",
                    relationError
                );

                closeUploadDialog();

                await loadFolderPage();

                showStatus(
                    "Artwork uploaded, but the folder assignment couldn't be saved. You can assign folders later. ♡",
                    true
                );

                return;
            }
        }

        // -------------------------------------------------
        // Finished
        // -------------------------------------------------

        closeUploadDialog();

        await loadFolderPage();

        showStatus(
            "Artwork uploaded! ♡"
        );

    } catch (error) {
        console.error(
            "GALLERY FOLDER: upload error:",
            error
        );

        // If the image was uploaded but the
        // database row was never created,
        // remove the orphaned Storage file.
        if (
            storagePath &&
            !createdArtworkId
        ) {
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

    } finally {
        uploading = false;

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent =
                "Upload artwork ♡";
        }
    }
}

// =========================================================
// FILE EXTENSION
// =========================================================

function getFileExtension(file) {
    const filename =
        file?.name || "";

    const parts =
        filename.split(".");

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

    const mimeMap = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/avif": "avif"
    };

    return (
        mimeMap[file?.type] ||
        "jpg"
    );
}

// =========================================================
// UPLOAD PREVIEW
// =========================================================

function updateUploadPreview() {
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
        resetUploadPreview();
        return;
    }

    if (
        !file.type.startsWith(
            "image/"
        )
    ) {
        resetUploadPreview();
        return;
    }

    const objectUrl =
        URL.createObjectURL(file);

    previewImage.src =
        objectUrl;

    preview.hidden = false;

    previewImage.addEventListener(
        "load",
        () => {
            URL.revokeObjectURL(
                objectUrl
            );
        },
        { once: true }
    );
}

function resetUploadPreview() {
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
}

// =========================================================
// UPLOAD ERROR
// =========================================================

function showUploadError(message) {
    const errorElement =
        document.getElementById(
            "uploadError"
        );

    if (!errorElement) {
        return;
    }

    errorElement.textContent =
        message;

    errorElement.hidden =
        false;
}

function clearUploadError() {
    const errorElement =
        document.getElementById(
            "uploadError"
        );

    if (!errorElement) {
        return;
    }

    errorElement.textContent =
        "";

    errorElement.hidden =
        true;
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
        message;

    status.dataset.state =
        isError
            ? "error"
            : "success";

    clearTimeout(
        statusTimeout
    );

    statusTimeout =
        setTimeout(() => {
            status.textContent =
                "";

            status.removeAttribute(
                "data-state"
            );
        }, 5000);
}

// =========================================================
// EVENT BINDING
// =========================================================

function bindEvents() {
    const uploadButton =
        document.getElementById(
            "uploadArtworkButton"
        );

    const refreshButton =
        document.getElementById(
            "refreshArtworkButton"
        );

    const emptyUploadButton =
        document.getElementById(
            "emptyUploadButton"
        );

    const uploadCancelButton =
        document.getElementById(
            "uploadCancelButton"
        );

    const uploadForm =
        document.getElementById(
            "uploadForm"
        );

    const uploadDialog =
        document.getElementById(
            "uploadDialog"
        );

    const artworkFile =
        document.getElementById(
            "artworkFile"
        );

    const artworkCloseButton =
        document.getElementById(
            "artworkCloseButton"
        );

    const artworkDialog =
        document.getElementById(
            "artworkDialog"
        );

    // -----------------------------------------------------
    // Upload button
    // -----------------------------------------------------

    if (uploadButton) {
        uploadButton.addEventListener(
            "click",
            openUploadDialog
        );
    }

    // -----------------------------------------------------
    // Empty-state upload button
    // -----------------------------------------------------

    if (emptyUploadButton) {
        emptyUploadButton.addEventListener(
            "click",
            openUploadDialog
        );
    }

    // -----------------------------------------------------
    // Refresh
    // -----------------------------------------------------

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            async () => {
                refreshButton.disabled =
                    true;

                try {
                    await loadFolderPage();
                } finally {
                    refreshButton.disabled =
                        false;
                }
            }
        );
    }

    // -----------------------------------------------------
    // Cancel upload
    // -----------------------------------------------------

    if (uploadCancelButton) {
        uploadCancelButton.addEventListener(
            "click",
            closeUploadDialog
        );
    }

    // -----------------------------------------------------
    // Upload form
    // -----------------------------------------------------

    if (uploadForm) {
        uploadForm.addEventListener(
            "submit",
            uploadArtwork
        );
    }

    // -----------------------------------------------------
    // File preview
    // -----------------------------------------------------

    if (artworkFile) {
        artworkFile.addEventListener(
            "change",
            updateUploadPreview
        );
    }

    // -----------------------------------------------------
    // Upload dialog close
    // -----------------------------------------------------

    if (uploadDialog) {
        uploadDialog.addEventListener(
            "close",
            () => {
                clearUploadError();
                resetUploadPreview();
            }
        );
    }

    // -----------------------------------------------------
    // Artwork viewer close button
    // -----------------------------------------------------

    if (artworkCloseButton) {
        artworkCloseButton.addEventListener(
            "click",
            () => {
                if (
                    artworkDialog?.open
                ) {
                    artworkDialog.close();
                }
            }
        );
    }

    // -----------------------------------------------------
    // Click outside artwork dialog
    // -----------------------------------------------------

    if (artworkDialog) {
        artworkDialog.addEventListener(
            "click",
            (event) => {
                if (
                    event.target ===
                    artworkDialog
                ) {
                    artworkDialog.close();
                }
            }
        );
    }
}

// =========================================================
// GLOBAL API
// =========================================================

window.galleryFolderLoad =
    loadFolderPage;