// =========================================================
// GALLERY
// Main gallery/archive page
// =========================================================

const client = window.supabaseClient;

let currentUser = null;
let galleryOwnerId = null;
let isGalleryOwner = false;
let isModerator = false;

let folders = [];
let artworks = [];

const artworkFolderMap = new Map();

let editingFolder = null;
let deletingFolder = null;
let uploading = false;


// =========================================================
// INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {
    bindGalleryButtons();
    await loadGallery();
});


// =========================================================
// LOAD GALLERY
// =========================================================

async function loadGallery() {
    try {
        const {
            data: { user },
            error: userError
        } = await client.auth.getUser();

        if (userError) {
            throw userError;
        }

        currentUser = user || null;

        const params = new URLSearchParams(window.location.search);

        const requestedUserId =
            params.get("user") ||
            params.get("id");

        galleryOwnerId =
            requestedUserId ||
            currentUser?.id ||
            null;

        if (!galleryOwnerId) {
            showStatus(
                "Please sign in to view a gallery.",
                true
            );
            return;
        }

        isGalleryOwner =
            Boolean(currentUser) &&
            String(currentUser.id) ===
                String(galleryOwnerId);

        await loadModeratorState();

        updateOwnerInterface();
        updateModeratorInterface();

        await Promise.all([
            loadFolders(),
            loadArtwork()
        ]);

        await loadArtworkFolderRelations();

        renderGallery();

    } catch (error) {
        console.error(
            "GALLERY: load error:",
            error
        );

        showStatus(
            `Couldn't load the gallery: ${
                error?.message || "Unknown error"
            }`,
            true
        );
    }
}


// =========================================================
// MODERATOR STATE
// =========================================================

async function loadModeratorState() {
    isModerator = false;

    if (!currentUser) {
        return;
    }

    try {
        if (
            typeof window.isModeratorUser ===
            "function"
        ) {
            isModerator = Boolean(
                await window.isModeratorUser(
                    currentUser.id
                )
            );
        }
    } catch (error) {
        console.error(
            "GALLERY: moderator check error:",
            error
        );
    }
}


// =========================================================
// OWNER INTERFACE
// =========================================================

function updateOwnerInterface() {
    const ownerControls =
        document.querySelectorAll(
            ".gallery-owner-only"
        );

    ownerControls.forEach(element => {
        element.hidden = !isGalleryOwner;

        if (isGalleryOwner) {
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
}


// =========================================================
// MODERATOR INTERFACE
// =========================================================

function updateModeratorInterface() {
    const moderatorControls =
        document.querySelectorAll(
            ".gallery-moderator-only"
        );

    moderatorControls.forEach(element => {
        element.hidden = !isModerator;

        if (isModerator) {
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
}


// =========================================================
// FOLDERS
// =========================================================

async function loadFolders() {
    const {
        data,
        error
    } = await client
        .from("gallery_folders")
        .select(
            "id, user_id, name, created_at, updated_at"
        )
        .eq(
            "user_id",
            galleryOwnerId
        )
        .order(
            "created_at",
            { ascending: true }
        );

    if (error) {
        throw error;
    }

    folders = data || [];
}


// =========================================================
// ARTWORK
// =========================================================

async function loadArtwork() {
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
        .eq(
            "user_id",
            galleryOwnerId
        )
        .order(
            "created_at",
            { ascending: false }
        );

    if (!isModerator) {
        query = query.eq(
            "is_hidden",
            false
        );
    }

    const {
        data,
        error
    } = await query;

    if (error) {
        throw error;
    }

    artworks = data || [];
}


// =========================================================
// ARTWORK / FOLDER RELATIONS
// =========================================================

async function loadArtworkFolderRelations() {
    artworkFolderMap.clear();

    if (!artworks.length) {
        return;
    }

    const artworkIds =
        artworks.map(
            artwork => artwork.id
        );

    const {
        data,
        error
    } = await client
        .from("gallery_item_folders")
        .select(
            "gallery_item_id, folder_id"
        )
        .in(
            "gallery_item_id",
            artworkIds
        );

    if (error) {
        throw error;
    }

    (data || []).forEach(relation => {
        if (
            !artworkFolderMap.has(
                relation.gallery_item_id
            )
        ) {
            artworkFolderMap.set(
                relation.gallery_item_id,
                []
            );
        }

        artworkFolderMap
            .get(relation.gallery_item_id)
            .push(relation.folder_id);
    });
}


// =========================================================
// RENDER GALLERY
// =========================================================

function renderGallery() {
    renderFolders();
    renderOrphanArtwork();
}


// =========================================================
// RENDER FOLDERS
// =========================================================

function renderFolders() {
    const container =
        document.getElementById(
            "folderList"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!folders.length) {
        const empty =
            document.createElement("p");

        empty.className =
            "gallery-empty";

        empty.textContent =
            "You don't have any folders yet. ♡";

        container.appendChild(empty);

        return;
    }

    folders.forEach(folder => {
        container.appendChild(
            createFolderElement(folder)
        );
    });
}


// =========================================================
// CREATE FOLDER ELEMENT
// =========================================================

function createFolderElement(folder) {
    const wrapper =
        document.createElement("article");

    wrapper.className =
        "gallery-folder";

    const header =
        document.createElement("div");

    header.className =
        "gallery-folder-header";

    const link =
        document.createElement("a");

    link.href =
        `gallery-folder.html?id=${encodeURIComponent(
            folder.id
        )}`;

    link.className =
        "gallery-folder-link";

    link.textContent =
        `📁 ${folder.name || "Untitled Folder"}`;

    header.appendChild(link);

    if (isGalleryOwner) {
        const actions =
            document.createElement("div");

        actions.className =
            "gallery-folder-actions";

        const renameButton =
            document.createElement("button");

        renameButton.type = "button";
        renameButton.textContent =
            "✏️ Rename";

        renameButton.addEventListener(
            "click",
            event => {
                event.preventDefault();
                event.stopPropagation();
                openRenameFolder(folder);
            }
        );

        const deleteButton =
            document.createElement("button");

        deleteButton.type = "button";
        deleteButton.textContent =
            "🗑️ Delete";

        deleteButton.addEventListener(
            "click",
            event => {
                event.preventDefault();
                event.stopPropagation();
                openDeleteFolder(folder);
            }
        );

        actions.appendChild(renameButton);
        actions.appendChild(deleteButton);

        header.appendChild(actions);
    }

    wrapper.appendChild(header);

    const folderArtwork =
        getFolderArtwork(folder.id);

    const artworkGrid =
        document.createElement("div");

    artworkGrid.className =
        "artwork-grid";

    folderArtwork.forEach(artwork => {
        artworkGrid.appendChild(
            createArtworkCard(artwork)
        );
    });

    wrapper.appendChild(artworkGrid);

    return wrapper;
}


// =========================================================
// GET FOLDER ARTWORK
// =========================================================

function getFolderArtwork(folderId) {
    return artworks.filter(artwork => {
        const folderIds =
            artworkFolderMap.get(
                artwork.id
            ) || [];

        return folderIds.some(
            id =>
                String(id) ===
                String(folderId)
        );
    });
}


// =========================================================
// ORPHAN / UNSORTED ARTWORK
// =========================================================

function renderOrphanArtwork() {
    const container =
        document.getElementById(
            "orphanArtwork"
        ) ||
        document.getElementById(
            "unsortedArtwork"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const orphanArtwork =
        artworks.filter(artwork => {
            const folderIds =
                artworkFolderMap.get(
                    artwork.id
                ) || [];

            return folderIds.length === 0;
        });

    if (!orphanArtwork.length) {
        const empty =
            document.createElement("p");

        empty.className =
            "gallery-empty";

        empty.textContent =
            "No unsorted artwork. ♡";

        container.appendChild(empty);

        return;
    }

    orphanArtwork.forEach(artwork => {
        container.appendChild(
            createArtworkCard(artwork)
        );
    });
}


// =========================================================
// ARTWORK CARD
// =========================================================

function createArtworkCard(artwork) {
    const card =
        document.createElement("article");

    card.className =
        "artwork-card";

    if (artwork.is_hidden) {
        card.classList.add(
            "artwork-hidden"
        );
    }

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
        () => openArtworkViewer(artwork)
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

    if (isGalleryOwner) {
        const editButton =
            document.createElement("button");

        editButton.type = "button";
        editButton.textContent =
            "✏️ Edit";

        editButton.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                editArtwork(artwork);
            }
        );

        const folderButton =
            document.createElement("button");

        folderButton.type = "button";
        folderButton.textContent =
            "📁 Folders";

        folderButton.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                openArtworkFolderManager(
                    artwork
                );
            }
        );

        actions.appendChild(editButton);
        actions.appendChild(folderButton);
    }

    if (isModerator) {
        const moderationButton =
            document.createElement("button");

        moderationButton.type = "button";

        moderationButton.textContent =
            artwork.is_hidden
                ? "👁️ Unhide"
                : "🙈 Hide";

        moderationButton.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                toggleArtworkVisibility(
                    artwork
                );
            }
        );

        actions.appendChild(
            moderationButton
        );
    }

    if (actions.children.length) {
        content.appendChild(actions);
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
        artwork.image_url;

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

    document.body.appendChild(dialog);

    dialog.addEventListener(
        "close",
        () => dialog.remove()
    );

    dialog.showModal();
}


// =========================================================
// EDIT ARTWORK
// =========================================================

function editArtwork(artwork) {
    if (
        !isGalleryOwner ||
        !currentUser ||
        String(artwork.user_id) !==
            String(currentUser.id)
    ) {
        return;
    }

    const dialog =
        document.createElement("dialog");

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

    form.method = "dialog";
    form.className =
        "artwork-edit-form";

    const titleLabel =
        document.createElement("label");

    titleLabel.textContent =
        "Title";

    const titleInput =
        document.createElement("input");

    titleInput.type = "text";
    titleInput.name = "title";
    titleInput.maxLength = 200;
    titleInput.value =
        artwork.title || "";

    titleLabel.appendChild(
        titleInput
    );

    const descriptionLabel =
        document.createElement("label");

    descriptionLabel.textContent =
        "Description";

    const descriptionInput =
        document.createElement("textarea");

    descriptionInput.name =
        "description";

    descriptionInput.rows = 5;
    descriptionInput.maxLength = 2000;

    descriptionInput.value =
        artwork.description || "";

    descriptionLabel.appendChild(
        descriptionInput
    );

    const status =
        document.createElement("p");

    status.className =
        "artwork-edit-status";

    const buttons =
        document.createElement("div");

    buttons.className =
        "artwork-edit-actions";

    const cancelButton =
        document.createElement("button");

    cancelButton.type = "button";
    cancelButton.textContent =
        "Cancel";

    cancelButton.addEventListener(
        "click",
        () => dialog.close()
    );

    const deleteButton =
        document.createElement("button");

    deleteButton.type = "button";
    deleteButton.textContent =
        "🗑️ Delete artwork";

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

                await loadGallery();

                showStatus(
                    "Artwork deleted. ♡"
                );

            } catch (error) {
                console.error(
                    "GALLERY: edit dialog delete error:",
                    error
                );

                status.textContent =
                    `Couldn't delete artwork: ${
                        error?.message ||
                        "Unknown error"
                    }`;

                deleteButton.disabled =
                    false;

                cancelButton.disabled =
                    false;

                saveButton.disabled =
                    false;
            }
        }
    );

    const saveButton =
        document.createElement("button");

    saveButton.type = "submit";
    saveButton.textContent =
        "Save changes ♡";

    form.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            saveButton.disabled =
                true;

            cancelButton.disabled =
                true;

            deleteButton.disabled =
                true;

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

                await loadGallery();

                showStatus(
                    "Artwork updated! ♡"
                );

            } catch (error) {
                console.error(
                    "GALLERY: edit artwork error:",
                    error
                );

                status.textContent =
                    `Couldn't update artwork: ${
                        error?.message ||
                        "Unknown error"
                    }`;

                saveButton.disabled =
                    false;

                cancelButton.disabled =
                    false;

                deleteButton.disabled =
                    false;
            }
        }
    );

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

    document.body.appendChild(dialog);

    dialog.addEventListener(
        "close",
        () => dialog.remove()
    );

    dialog.showModal();

    titleInput.focus();
}


// =========================================================
// DELETE ARTWORK
// =========================================================

async function deleteArtwork(artwork) {
    if (
        !isGalleryOwner ||
        !currentUser ||
        String(artwork.user_id) !==
            String(currentUser.id)
    ) {
        return;
    }

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

    showStatus(
        "Deleting artwork... 🌸"
    );

    try {
        await performArtworkDelete(
            artwork
        );

        await loadGallery();

        showStatus(
            "Artwork deleted. ♡"
        );

    } catch (error) {
        console.error(
            "GALLERY: delete artwork error:",
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
// ACTUAL ARTWORK DELETE
// =========================================================

async function performArtworkDelete(
    artwork
) {
    if (
        !currentUser ||
        !isGalleryOwner ||
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
    // Delete the Storage file first.
    //
    // If Storage deletion is blocked by RLS, we stop here
    // instead of deleting the database row and leaving a
    // broken gallery item behind.
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
    // Remove folder relationships.
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
    // Delete database row.
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
// ARTWORK FOLDER MANAGER
// =========================================================

function openArtworkFolderManager(
    artwork
) {
    if (
        !isGalleryOwner ||
        !currentUser ||
        String(artwork.user_id) !==
            String(currentUser.id)
    ) {
        return;
    }

    const dialog =
        document.createElement("dialog");

    dialog.className =
        "folder-dialog";

    const title =
        document.createElement("h2");

    title.textContent =
        "📁 Artwork folders";

    dialog.appendChild(title);

    const description =
        document.createElement("p");

    description.textContent =
        "Choose which folders this artwork belongs to. ♡";

    dialog.appendChild(
        description
    );

    const list =
        document.createElement("div");

    list.className =
        "upload-folder-list";

    const currentFolderIds =
        artworkFolderMap.get(
            artwork.id
        ) || [];

    if (!folders.length) {
        const empty =
            document.createElement("p");

        empty.textContent =
            "You don't have any folders yet. ♡";

        list.appendChild(empty);

    } else {
        folders.forEach(folder => {
            const label =
                document.createElement("label");

            label.className =
                "upload-folder-option";

            const checkbox =
                document.createElement("input");

            checkbox.type =
                "checkbox";

            checkbox.value =
                String(folder.id);

            checkbox.checked =
                currentFolderIds.some(
                    id =>
                        String(id) ===
                        String(folder.id)
                );

            const text =
                document.createElement("span");

            text.textContent =
                folder.name ||
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
        });
    }

    dialog.appendChild(list);

    const buttons =
        document.createElement("div");

    buttons.className =
        "folder-dialog-buttons";

    const cancelButton =
        document.createElement("button");

    cancelButton.type = "button";
    cancelButton.textContent =
        "Cancel";

    cancelButton.addEventListener(
        "click",
        () => dialog.close()
    );

    const saveButton =
        document.createElement("button");

    saveButton.type = "button";
    saveButton.textContent =
        "Save ♡";

    saveButton.addEventListener(
        "click",
        async () => {
            const selectedFolderIds =
                Array.from(
                    list.querySelectorAll(
                        'input[type="checkbox"]:checked'
                    )
                ).map(
                    checkbox =>
                        checkbox.value
                );

            saveButton.disabled =
                true;

            saveButton.textContent =
                "Saving...";

            try {
                await saveArtworkFolders(
                    artwork,
                    selectedFolderIds
                );

                dialog.close();

                await loadGallery();

                showStatus(
                    "Artwork folders updated! ♡"
                );

            } catch (error) {
                console.error(
                    "GALLERY: folder assignment error:",
                    error
                );

                showStatus(
                    `Couldn't update folders: ${
                        error?.message ||
                        "Unknown error"
                    }`,
                    true
                );

                saveButton.disabled =
                    false;

                saveButton.textContent =
                    "Save ♡";
            }
        }
    );

    buttons.appendChild(
        cancelButton
    );

    buttons.appendChild(
        saveButton
    );

    dialog.appendChild(buttons);

    document.body.appendChild(dialog);

    dialog.addEventListener(
        "close",
        () => dialog.remove()
    );

    dialog.showModal();
}


// =========================================================
// SAVE ARTWORK FOLDERS
// =========================================================

async function saveArtworkFolders(
    artwork,
    selectedFolderIds
) {
    if (
        !currentUser ||
        !isGalleryOwner ||
        String(artwork.user_id) !==
            String(currentUser.id)
    ) {
        throw new Error(
            "You don't own this artwork."
        );
    }

    const {
        error: deleteError
    } = await client
        .from("gallery_item_folders")
        .delete()
        .eq(
            "gallery_item_id",
            artwork.id
        );

    if (deleteError) {
        throw deleteError;
    }

    if (!selectedFolderIds.length) {
        return;
    }

    const rows =
        selectedFolderIds.map(
            folderId => ({
                gallery_item_id:
                    artwork.id,

                folder_id:
                    folderId
            })
        );

    const {
        error: insertError
    } = await client
        .from("gallery_item_folders")
        .insert(rows);

    if (insertError) {
        throw insertError;
    }
}


// =========================================================
// CREATE FOLDER
// =========================================================

async function createFolder() {
    if (
        !isGalleryOwner ||
        !currentUser
    ) {
        return;
    }

    const name =
        window.prompt(
            "Folder name:",
            ""
        );

    if (name === null) {
        return;
    }

    const cleanName =
        name.trim();

    if (!cleanName) {
        return;
    }

    const {
        error
    } = await client
        .from("gallery_folders")
        .insert({
            user_id:
                currentUser.id,

            name:
                cleanName
        });

    if (error) {
        console.error(
            "GALLERY: create folder error:",
            error
        );

        showStatus(
            `Couldn't create folder: ${
                error.message
            }`,
            true
        );

        return;
    }

    await loadGallery();

    showStatus(
        "Folder created! ♡"
    );
}


// =========================================================
// RENAME FOLDER
// =========================================================

function openRenameFolder(folder) {
    if (
        !isGalleryOwner ||
        !currentUser
    ) {
        return;
    }

    editingFolder = folder;

    const dialog =
        document.getElementById(
            "folderDialog"
        );

    const input =
        document.getElementById(
            "folderName"
        ) ||
        document.getElementById(
            "folderNameInput"
        );

    if (!dialog || !input) {
        const newName =
            window.prompt(
                "Folder name:",
                folder.name || ""
            );

        if (newName !== null) {
            renameFolder(
                folder,
                newName
            );
        }

        return;
    }

    input.value =
        folder.name || "";

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


async function renameFolder(
    folder,
    newName
) {
    const cleanName =
        String(newName || "")
            .trim();

    if (!cleanName) {
        return;
    }

    const {
        error
    } = await client
        .from("gallery_folders")
        .update({
            name:
                cleanName,

            updated_at:
                new Date().toISOString()
        })
        .eq(
            "id",
            folder.id
        )
        .eq(
            "user_id",
            currentUser.id
        );

    if (error) {
        throw error;
    }

    await loadGallery();
}


// =========================================================
// DELETE FOLDER
// =========================================================

function openDeleteFolder(folder) {
    if (
        !isGalleryOwner ||
        !currentUser
    ) {
        return;
    }

    deletingFolder =
        folder;

    const confirmed =
        window.confirm(
            `Delete "${folder.name}"?\n\n` +
            "The folder will be deleted, but the artwork inside it will stay in your gallery."
        );

    if (!confirmed) {
        deletingFolder = null;
        return;
    }

    handleDeleteFolder(folder);
}


async function handleDeleteFolder(
    folder
) {
    if (
        !currentUser ||
        !isGalleryOwner
    ) {
        return;
    }

    try {
        const {
            error: relationError
        } = await client
            .from("gallery_item_folders")
            .delete()
            .eq(
                "folder_id",
                folder.id
            );

        if (relationError) {
            throw relationError;
        }

        const {
            error: folderError
        } = await client
            .from("gallery_folders")
            .delete()
            .eq(
                "id",
                folder.id
            )
            .eq(
                "user_id",
                currentUser.id
            );

        if (folderError) {
            throw folderError;
        }

        await loadGallery();

        showStatus(
            "Folder deleted. The artwork is safe. ♡"
        );

    } catch (error) {
        console.error(
            "GALLERY: delete folder error:",
            error
        );

        showStatus(
            `Couldn't delete folder: ${
                error?.message ||
                "Unknown error"
            }`,
            true
        );

    } finally {
        deletingFolder = null;
    }
}


// =========================================================
// MODERATOR HIDE / UNHIDE
// =========================================================

async function toggleArtworkVisibility(
    artwork
) {
    if (
        !isModerator ||
        !currentUser
    ) {
        return;
    }

    const newHiddenState =
        !artwork.is_hidden;

    const {
        error
    } = await client
        .from("gallery_items")
        .update({
            is_hidden:
                newHiddenState,

            hidden_at:
                newHiddenState
                    ? new Date().toISOString()
                    : null,

            hidden_by:
                newHiddenState
                    ? currentUser.id
                    : null,

            updated_at:
                new Date().toISOString()
        })
        .eq(
            "id",
            artwork.id
        );

    if (error) {
        console.error(
            "GALLERY: visibility update error:",
            error
        );

        showStatus(
            `Couldn't update visibility: ${
                error.message
            }`,
            true
        );

        return;
    }

    await loadGallery();
}


// =========================================================
// UPLOAD DIALOG
// =========================================================

function openUploadDialog() {
    if (
        !isGalleryOwner ||
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
            "GALLERY: #uploadDialog not found."
        );
        return;
    }

    const form =
        document.getElementById(
            "uploadForm"
        );

    form?.reset();

    clearUploadErrors();

    renderUploadFolderList();

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
// UPLOAD FOLDER CHECKBOXES
// =========================================================

function renderUploadFolderList() {
    const container =
        document.getElementById(
            "uploadFolderList"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!folders.length) {
        const message =
            document.createElement("p");

        message.textContent =
            "No folders yet — you can leave this unsorted. ♡";

        container.appendChild(
            message
        );

        return;
    }

    folders.forEach(folder => {
        const label =
            document.createElement("label");

        label.className =
            "upload-folder-option";

        const checkbox =
            document.createElement("input");

        checkbox.type =
            "checkbox";

        checkbox.name =
            "galleryFolders";

        checkbox.value =
            String(folder.id);

        const text =
            document.createElement("span");

        text.textContent =
            folder.name ||
            "Untitled Folder";

        label.appendChild(
            checkbox
        );

        label.appendChild(
            text
        );

        container.appendChild(
            label
        );
    });
}


// =========================================================
// UPLOAD ARTWORK
// =========================================================

async function uploadArtworkFromDialog(
    event
) {
    event.preventDefault();

    if (
        !isGalleryOwner ||
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

    const errorElement =
        document.getElementById(
            "uploadError"
        );

    const dialog =
        document.getElementById(
            "uploadDialog"
        );

    clearUploadErrors();

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
        saveButton.disabled =
            true;

        saveButton.textContent =
            "Uploading... ♡";
    }

    let storagePath = null;
    let artworkId = null;

    try {
        const extension =
            getFileExtension(file);

        storagePath =
            `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

        showStatus(
            "Uploading your artwork... 🌸"
        );

        // -------------------------------------------------
        // STORAGE
        // -------------------------------------------------

        const {
            error: uploadError
        } = await client
            .storage
            .from("gallery")
            .upload(
                storagePath,
                file,
                {
                    cacheControl:
                        "3600",

                    contentType:
                        file.type,

                    upsert:
                        false
                }
            );

        if (uploadError) {
            throw uploadError;
        }

        // -------------------------------------------------
        // PUBLIC URL
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
        // DATABASE
        // -------------------------------------------------

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

                // Keep both names so this page and
                // gallery-folder.js remain compatible.
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

        artworkId =
            artwork.id;

        // -------------------------------------------------
        // FOLDERS
        // -------------------------------------------------

        const selectedFolderIds =
            Array.from(
                document.querySelectorAll(
                    '#uploadFolderList input[type="checkbox"]:checked'
                )
            ).map(
                checkbox =>
                    checkbox.value
            );

        if (selectedFolderIds.length) {
            const rows =
                selectedFolderIds.map(
                    folderId => ({
                        gallery_item_id:
                            artwork.id,

                        folder_id:
                            folderId
                    })
                );

            const {
                error: folderError
            } = await client
                .from("gallery_item_folders")
                .insert(rows);

            if (folderError) {
                console.error(
                    "GALLERY: folder assignment error:",
                    folderError
                );

                showUploadError(
                    `Artwork uploaded, but folders couldn't be assigned: ${folderError.message}`
                );
            }
        }

        if (dialog?.open) {
            dialog.close();
        }

        await loadGallery();

        showStatus(
            "Artwork uploaded! ♡"
        );

    } catch (error) {
        console.error(
            "GALLERY: upload error:",
            error
        );

        // If the DB insert failed after the
        // Storage upload, remove the uploaded file.
        if (storagePath && !artworkId) {
            try {
                await client
                    .storage
                    .from("gallery")
                    .remove([
                        storagePath
                    ]);
            } catch (cleanupError) {
                console.error(
                    "GALLERY: upload cleanup error:",
                    cleanupError
                );
            }
        }

        if (errorElement) {
            errorElement.textContent =
                `Couldn't upload image: ${
                    error?.message ||
                    "Unknown error"
                }`;

            errorElement.hidden =
                false;
        }

        showStatus(
            "Couldn't upload artwork.",
            true
        );

    } finally {
        uploading = false;

        if (saveButton) {
            saveButton.disabled =
                false;

            saveButton.textContent =
                "Upload ♡";
        }
    }
}


// =========================================================
// UPLOAD ERROR
// =========================================================

function showUploadError(
    message
) {
    const element =
        document.getElementById(
            "uploadError"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message || "";

    element.hidden =
        !message;
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
// FOLDER FORM
// =========================================================

async function handleFolderFormSubmit(
    event
) {
    event.preventDefault();

    if (
        !isGalleryOwner ||
        !currentUser
    ) {
        return;
    }

    const input =
        document.getElementById(
            "folderName"
        ) ||
        document.getElementById(
            "folderNameInput"
        );

    const name =
        input?.value.trim() ||
        "";

    if (!name) {
        return;
    }

    try {
        if (editingFolder) {
            await renameFolder(
                editingFolder,
                name
            );

            editingFolder =
                null;

            showStatus(
                "Folder renamed! ♡"
            );

        } else {
            const {
                error
            } = await client
                .from("gallery_folders")
                .insert({
                    user_id:
                        currentUser.id,

                    name
                });

            if (error) {
                throw error;
            }

            await loadGallery();

            showStatus(
                "Folder created! ♡"
            );
        }

        const dialog =
            document.getElementById(
                "folderDialog"
            );

        if (dialog?.open) {
            dialog.close();
        }

    } catch (error) {
        console.error(
            "GALLERY: folder form error:",
            error
        );

        showStatus(
            `Couldn't save folder: ${
                error?.message ||
                "Unknown error"
            }`,
            true
        );
    }
}


// =========================================================
// DELETE FOLDER FORM
// =========================================================

async function handleDeleteFolderSubmit(
    event
) {
    event.preventDefault();

    if (!deletingFolder) {
        return;
    }

    await handleDeleteFolder(
        deletingFolder
    );

    const dialog =
        document.getElementById(
            "deleteFolderDialog"
        );

    if (dialog?.open) {
        dialog.close();
    }
}


// =========================================================
// CLEAR UPLOAD ERRORS
// =========================================================

function clearUploadErrors() {
    const element =
        document.getElementById(
            "uploadError"
        );

    if (!element) {
        return;
    }

    element.textContent =
        "";

    element.hidden =
        true;
}


// =========================================================
// BUTTON BINDINGS
// =========================================================

function bindGalleryButtons() {
    // -----------------------------------------------------
    // UPLOAD
    // -----------------------------------------------------

    document
        .getElementById(
            "uploadArtworkButton"
        )
        ?.addEventListener(
            "click",
            openUploadDialog
        );

    // -----------------------------------------------------
    // NEW FOLDER
    // -----------------------------------------------------

    document
        .getElementById(
            "newFolderButton"
        )
        ?.addEventListener(
            "click",
            createFolder
        );

    document
        .getElementById(
            "emptyNewFolderButton"
        )
        ?.addEventListener(
            "click",
            createFolder
        );

    // -----------------------------------------------------
    // REFRESH
    // -----------------------------------------------------

    document
        .getElementById(
            "refreshFoldersButton"
        )
        ?.addEventListener(
            "click",
            async () => {
                await loadGallery();
            }
        );

    // -----------------------------------------------------
    // FOLDER FORM
    // -----------------------------------------------------

    document
        .getElementById(
            "folderForm"
        )
        ?.addEventListener(
            "submit",
            handleFolderFormSubmit
        );

    // -----------------------------------------------------
    // FOLDER CANCEL
    // -----------------------------------------------------

    document
        .getElementById(
            "folderCancelButton"
        )
        ?.addEventListener(
            "click",
            () => {
                const dialog =
                    document.getElementById(
                        "folderDialog"
                    );

                editingFolder =
                    null;

                if (dialog?.open) {
                    dialog.close();
                }
            }
        );

    // -----------------------------------------------------
    // DELETE FOLDER FORM
    // -----------------------------------------------------

    document
        .getElementById(
            "deleteFolderForm"
        )
        ?.addEventListener(
            "submit",
            handleDeleteFolderSubmit
        );

    // -----------------------------------------------------
    // DELETE FOLDER CANCEL
    // -----------------------------------------------------

    document
        .getElementById(
            "deleteCancelButton"
        )
        ?.addEventListener(
            "click",
            () => {
                const dialog =
                    document.getElementById(
                        "deleteFolderDialog"
                    );

                deletingFolder =
                    null;

                if (dialog?.open) {
                    dialog.close();
                }
            }
        );

    // -----------------------------------------------------
    // UPLOAD FORM
    // -----------------------------------------------------

    document
        .getElementById(
            "uploadForm"
        )
        ?.addEventListener(
            "submit",
            uploadArtworkFromDialog
        );

    // -----------------------------------------------------
    // UPLOAD CANCEL
    // -----------------------------------------------------

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

                clearUploadErrors();

                if (dialog?.open) {
                    dialog.close();
                }
            }
        );
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
            "galleryStatus"
        ) ||
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

    if (
        message &&
        !isError
    ) {
        window.clearTimeout(
            showStatus.timeout
        );

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
// GLOBAL API
// =========================================================

window.galleryCreateFolder =
    createFolder;

window.galleryLoad =
    loadGallery;

window.getGalleryOwnerId =
    () => galleryOwnerId;

window.galleryEditArtwork =
    editArtwork;

window.galleryDeleteArtwork =
    deleteArtwork;