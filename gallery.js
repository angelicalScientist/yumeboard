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

let moderatorHiddenArtworkIds = new Set();
let showModeratorDismissed = false;


/* =========================================================
   INITIAL LOAD
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    bindGalleryButtons();
    await loadGallery();
});


async function loadGallery() {
    console.log("GALLERY: loadGallery started");

    const status = document.getElementById("galleryStatus");

    try {
        if (status) {
            status.textContent = "Loading your archive... 🌸";
            status.classList.add("visible");
            status.classList.remove("error");
        }

        if (!client) {
            throw new Error("Supabase client was not found.");
        }

        const {
            data: { user },
            error: authError
        } = await client.auth.getUser();

        console.log("GALLERY: auth result", {
            user,
            authError
        });

        if (authError) {
            throw authError;
        }

        currentUser = user;

        if (!currentUser) {
            throw new Error("You must be signed in to view this gallery.");
        }

        await checkModeratorStatus();

        loadModeratorHiddenArtworkIds();

        const requestedUserId = getRequestedUserId();

        galleryOwnerId =
            requestedUserId ||
            currentUser.id;

        if (!galleryOwnerId) {
            throw new Error("Could not determine gallery owner.");
        }

        isGalleryOwner =
            currentUser.id === galleryOwnerId;

        updateOwnerInterface();
        updateModeratorInterface();

        await loadFolders();
        await loadArtwork();
        await loadArtworkFolders();

        renderFolders();
        renderOrphanArtwork();

        if (status) {
            status.textContent = "";
            status.classList.remove("visible");
            status.classList.remove("error");
        }

    } catch (error) {
        console.error("GALLERY LOAD ERROR:", error);

        if (status) {
            status.textContent =
                `Couldn't load the gallery: ${
                    error?.message || "Unknown error"
                }`;

            status.classList.add("visible");
            status.classList.add("error");
        }
    }
}


/* =========================================================
   AUTH / MODERATOR
========================================================= */

async function checkModeratorStatus() {
    if (!currentUser) {
        isModerator = false;
        return;
    }

    const {
        data,
        error
    } = await client.rpc("is_moderator");

    if (error) {
        console.error(
            "GALLERY: moderator check error:",
            error
        );

        isModerator = false;
        return;
    }

    isModerator = Boolean(data);
}


function loadModeratorHiddenArtworkIds() {
    if (!currentUser?.id) {
        return;
    }

    try {
        const key =
            `gallery_mod_hidden_artworks_${currentUser.id}`;

        const stored =
            localStorage.getItem(key);

        if (!stored) {
            moderatorHiddenArtworkIds = new Set();
            return;
        }

        const parsed = JSON.parse(stored);

        if (!Array.isArray(parsed)) {
            moderatorHiddenArtworkIds = new Set();
            return;
        }

        moderatorHiddenArtworkIds =
            new Set(parsed.map(String));

    } catch (error) {
        console.error(
            "GALLERY: localStorage load error:",
            error
        );

        moderatorHiddenArtworkIds = new Set();
    }
}


function saveModeratorHiddenArtworkIds() {
    if (!currentUser?.id) {
        return;
    }

    try {
        const key =
            `gallery_mod_hidden_artworks_${currentUser.id}`;

        localStorage.setItem(
            key,
            JSON.stringify(
                [...moderatorHiddenArtworkIds]
            )
        );

    } catch (error) {
        console.error(
            "GALLERY: localStorage save error:",
            error
        );
    }
}


/* =========================================================
   URL / OWNER
========================================================= */

function getRequestedUserId() {
    const params =
        new URLSearchParams(
            window.location.search
        );

    return (
        params.get("user") ||
        params.get("id") ||
        null
    );
}


function getGalleryOwnerId() {
    return galleryOwnerId;
}


function updateOwnerInterface() {
    const ownerElements =
        document.querySelectorAll(
            ".gallery-owner-only"
        );

    ownerElements.forEach((element) => {
        element.hidden = !isGalleryOwner;
    });

    const uploadButton =
        document.getElementById(
            "uploadArtworkButton"
        );

    const newFolderButton =
        document.getElementById(
            "newFolderButton"
        );

    const emptyNewFolderButton =
        document.getElementById(
            "emptyNewFolderButton"
        );

    if (uploadButton) {
        uploadButton.hidden = !isGalleryOwner;
    }

    if (newFolderButton) {
        newFolderButton.hidden = !isGalleryOwner;
    }

    if (emptyNewFolderButton) {
        emptyNewFolderButton.hidden =
            !isGalleryOwner;
    }

    const uploadCard =
        document.querySelector(
            ".gallery-upload-card"
        );

    if (uploadCard) {
        uploadCard.hidden = !isGalleryOwner;
    }
}


function updateModeratorInterface() {
    /*
        Moderator buttons are added directly
        to artwork cards.
    */
}


/* =========================================================
   FOLDERS
========================================================= */

async function loadFolders() {
    console.log(
        "GALLERY: loading folders for",
        galleryOwnerId
    );

    const {
        data,
        error
    } = await client
        .from("gallery_folders")
        .select("*")
        .eq("user_id", galleryOwnerId)
        .order("created_at", {
            ascending: true
        });

    if (error) {
        console.error(
            "GALLERY: folder loading error:",
            error
        );

        throw error;
    }

    folders = data || [];

    console.log(
        "GALLERY: folders loaded:",
        folders
    );
}


/* =========================================================
   ARTWORK
========================================================= */

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
        .eq("user_id", galleryOwnerId)
        .order("created_at", {
            ascending: false
        });

    /*
        Normal visitors should NEVER receive
        hidden artwork.

        Moderators can receive hidden artwork.
    */

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
        console.error(
            "GALLERY: artwork loading error:",
            error
        );

        throw error;
    }

    artworks = data || [];

    console.log(
        "GALLERY: artwork loaded:",
        artworks
    );
}


/* =========================================================
   ARTWORK / FOLDER RELATIONS
========================================================= */

async function loadArtworkFolders() {
    artworkFolderMap.clear();

    if (!artworks.length) {
        return;
    }

    const artworkIds =
        artworks.map(
            (artwork) => artwork.id
        );

    const {
        data,
        error
    } = await client
        .from("gallery_item_folders")
        .select(`
            gallery_item_id,
            folder_id
        `)
        .in(
            "gallery_item_id",
            artworkIds
        );

    if (error) {
        console.error(
            "GALLERY: artwork-folder loading error:",
            error
        );

        throw error;
    }

    (data || []).forEach((row) => {
        const artworkId =
            String(row.gallery_item_id);

        const folderId =
            String(row.folder_id);

        if (!artworkFolderMap.has(artworkId)) {
            artworkFolderMap.set(
                artworkId,
                new Set()
            );
        }

        artworkFolderMap
            .get(artworkId)
            .add(folderId);
    });
}


/* =========================================================
   VISIBILITY
========================================================= */

function shouldRenderArtwork(artwork) {
    if (!artwork) {
        return false;
    }

    if (
        artwork.is_hidden &&
        !isModerator
    ) {
        return false;
    }

    if (
        isModerator &&
        artwork.is_hidden &&
        !showModeratorDismissed &&
        moderatorHiddenArtworkIds.has(
            String(artwork.id)
        )
    ) {
        return false;
    }

    return true;
}


/* =========================================================
   FOLDER RENDERING
========================================================= */

function renderFolders() {
    const container =
        document.getElementById(
            "folderList"
        );

    const emptyState =
        document.getElementById(
            "folderEmpty"
        );

    if (!container) {
        console.error(
            "GALLERY: #folderList was not found."
        );
        return;
    }

    container.innerHTML = "";

    if (!folders.length) {
        container.hidden = true;

        if (emptyState) {
            emptyState.hidden = false;
        }

        return;
    }

    container.hidden = false;

    if (emptyState) {
        emptyState.hidden = true;
    }

    folders.forEach((folder) => {
        const folderElement =
            createFolderElement(folder);

        container.appendChild(
            folderElement
        );
    });
}


function createFolderElement(folder) {
    const section =
        document.createElement("section");

    section.className =
        "gallery-folder";

    section.dataset.folderId =
        String(folder.id);


    /* -----------------------------
       HEADER
    ----------------------------- */

    const header =
        document.createElement("div");

    header.className =
        "gallery-folder-header";


    /* -----------------------------
       FOLDER TOGGLE
    ----------------------------- */

    const toggle =
        document.createElement("button");

    toggle.type = "button";
    toggle.className =
        "gallery-folder-toggle";

    toggle.setAttribute(
        "aria-expanded",
        "false"
    );


    const icon =
        document.createElement("span");

    icon.className =
        "gallery-folder-icon";

    icon.textContent = "📁";


    const name =
        document.createElement("span");

    name.className =
        "gallery-folder-name";

    name.textContent =
        folder.name ||
        "Untitled Folder";


    toggle.appendChild(icon);
    toggle.appendChild(name);

    header.appendChild(toggle);


    /* -----------------------------
       OWNER CONTROLS
    ----------------------------- */

    if (isGalleryOwner) {
        const controls =
            document.createElement("div");

        controls.className =
            "gallery-folder-controls";


        const renameButton =
            document.createElement("button");

        renameButton.type = "button";
        renameButton.textContent =
            "✏️ Rename";

        renameButton.addEventListener(
            "click",
            (event) => {
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
            (event) => {
                event.stopPropagation();
                openDeleteFolder(folder);
            }
        );


        controls.appendChild(
            renameButton
        );

        controls.appendChild(
            deleteButton
        );

        header.appendChild(
            controls
        );
    }


    /* -----------------------------
       CONTENT
    ----------------------------- */

    const content =
        document.createElement("div");

    content.className =
        "gallery-folder-content";

    content.hidden = true;


    const grid =
        document.createElement("div");

    grid.className =
        "artwork-grid";

    content.appendChild(grid);


    renderFolderArtwork(
        folder,
        grid
    );


    /* -----------------------------
       OPEN / CLOSE
    ----------------------------- */

    toggle.addEventListener(
        "click",
        () => {
            const opening =
                content.hidden;

            content.hidden = !opening;

            toggle.setAttribute(
                "aria-expanded",
                String(opening)
            );

            icon.textContent =
                opening
                    ? "📂"
                    : "📁";
        }
    );


    section.appendChild(header);
    section.appendChild(content);

    return section;
}


function getFolderArtwork(folderId) {
    const id =
        String(folderId);

    return artworks.filter(
        (artwork) => {
            if (
                !shouldRenderArtwork(
                    artwork
                )
            ) {
                return false;
            }

            const folderIds =
                artworkFolderMap.get(
                    String(artwork.id)
                );

            return (
                folderIds &&
                folderIds.has(id)
            );
        }
    );
}


function renderFolderArtwork(
    folder,
    container
) {
    const folderArtwork =
        getFolderArtwork(
            folder.id
        );

    container.innerHTML = "";

    if (!folderArtwork.length) {
        const empty =
            document.createElement("p");

        empty.className =
            "gallery-empty";

        empty.textContent =
            "♡ No artwork in this folder yet! ♡";

        container.appendChild(empty);

        return;
    }

    folderArtwork.forEach(
        (artwork) => {
            container.appendChild(
                createArtworkCard(
                    artwork
                )
            );
        }
    );
}


/* =========================================================
   UNSORTED ARTWORK
========================================================= */

function renderOrphanArtwork() {
    const section =
        document.getElementById(
            "orphanArtworkSection"
        );

    const grid =
        document.getElementById(
            "orphanArtworkGrid"
        );

    const empty =
        document.getElementById(
            "orphanArtworkEmpty"
        );

    if (!section || !grid) {
        return;
    }

    grid.innerHTML = "";

    const validFolderIds =
        new Set(
            folders.map(
                (folder) =>
                    String(folder.id)
            )
        );


    const orphanArtwork =
        artworks.filter(
            (artwork) => {
                if (
                    !shouldRenderArtwork(
                        artwork
                    )
                ) {
                    return false;
                }

                const folderIds =
                    artworkFolderMap.get(
                        String(artwork.id)
                    );

                /*
                    No relations at all
                    = unsorted.
                */

                if (
                    !folderIds ||
                    folderIds.size === 0
                ) {
                    return true;
                }

                /*
                    Relation points to a folder
                    that no longer exists.
                */

                for (
                    const folderId
                    of folderIds
                ) {
                    if (
                        !validFolderIds.has(
                            String(folderId)
                        )
                    ) {
                        return true;
                    }
                }

                return false;
            }
        );


    if (!orphanArtwork.length) {
        section.hidden = true;

        if (empty) {
            empty.hidden = false;
        }

        return;
    }


    section.hidden = false;

    if (empty) {
        empty.hidden = true;
    }


    orphanArtwork.forEach(
        (artwork) => {
            grid.appendChild(
                createArtworkCard(
                    artwork
                )
            );
        }
    );
}


/* =========================================================
   ARTWORK CARD
========================================================= */

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


    /* -----------------------------
       IMAGE
    ----------------------------- */

    const image =
        document.createElement("img");

    image.src =
        artwork.image_url;

    image.alt =
        artwork.title ||
        "Gallery artwork";

    image.loading = "lazy";

    image.addEventListener(
        "click",
        () => {
            openArtworkViewer(
                artwork
            );
        }
    );


    /* -----------------------------
       INFO
    ----------------------------- */

    const info =
        document.createElement("div");

    info.className =
        "artwork-card-info";


    const title =
        document.createElement("h3");

    title.textContent =
        artwork.title ||
        "Untitled";

    info.appendChild(title);


    if (artwork.description) {
        const description =
            document.createElement("p");

        description.textContent =
            artwork.description;

        info.appendChild(
            description
        );
    }


    /* -----------------------------
       CONTROLS
    ----------------------------- */

    const controls =
        document.createElement("div");

    controls.className =
        "artwork-card-controls";


    /* -----------------------------
       OWNER BUTTONS
    ----------------------------- */

    if (isGalleryOwner) {
        const editButton =
            document.createElement("button");

        editButton.type = "button";

        editButton.className =
            "artwork-action-button artwork-edit-button";

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
            document.createElement("button");

        folderButton.type = "button";

        folderButton.className =
            "artwork-action-button artwork-folder-button";

        folderButton.textContent =
            "📁 Folders";

        folderButton.addEventListener(
            "click",
            (event) => {
                event.stopPropagation();
                openArtworkFolderManager(
                    artwork
                );
            }
        );


        controls.appendChild(
            editButton
        );

        controls.appendChild(
            folderButton
        );
    }


    /* -----------------------------
       MODERATOR BUTTON
    ----------------------------- */

    if (isModerator) {
        const visibilityButton =
            document.createElement("button");

        visibilityButton.type = "button";

        visibilityButton.className =
            "artwork-action-button artwork-hide-button";

        visibilityButton.textContent =
            artwork.is_hidden
                ? "👁️ Unhide"
                : "🙈 Hide";

        visibilityButton.addEventListener(
            "click",
            (event) => {
                event.stopPropagation();
                toggleArtworkVisibility(
                    artwork
                );
            }
        );


        controls.appendChild(
            visibilityButton
        );
    }


    if (controls.children.length > 0) {
        info.appendChild(controls);
    }


    card.appendChild(image);
    card.appendChild(info);

    return card;
}


/* =========================================================
   ARTWORK VIEWER
========================================================= */

function openArtworkViewer(artwork) {
    const overlay =
        document.createElement("div");

    overlay.className =
        "gallery-artwork-viewer";


    const image =
        document.createElement("img");

    image.src =
        artwork.image_url;

    image.alt =
        artwork.title ||
        "Gallery artwork";


    const close =
        document.createElement("button");

    close.type = "button";

    close.textContent = "×";

    close.className =
        "gallery-artwork-viewer-close";


    close.addEventListener(
        "click",
        () => {
            overlay.remove();
        }
    );


    overlay.addEventListener(
        "click",
        (event) => {
            if (
                event.target === overlay
            ) {
                overlay.remove();
            }
        }
    );


    overlay.appendChild(close);
    overlay.appendChild(image);

    document.body.appendChild(
        overlay
    );
}


/* =========================================================
   EDIT ARTWORK
========================================================= */

async function editArtwork(artwork) {
    if (!isGalleryOwner) {
        return;
    }

    const newTitle =
        prompt(
            "Artwork title:",
            artwork.title || ""
        );

    if (newTitle === null) {
        return;
    }


    const newDescription =
        prompt(
            "Artwork description:",
            artwork.description || ""
        );

    if (newDescription === null) {
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
            title: newTitle.trim(),
            description:
                newDescription.trim(),
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
            "GALLERY: edit artwork error:",
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


    await loadGallery();
}


/* =========================================================
   ARTWORK FOLDER MANAGER
========================================================= */

async function openArtworkFolderManager(
    artwork
) {
    if (!isGalleryOwner) {
        return;
    }

    if (!folders.length) {
        alert(
            "You don't have any folders yet. Create one first! ♡"
        );

        return;
    }


    const currentFolderIds =
        artworkFolderMap.get(
            String(artwork.id)
        ) || new Set();


    /*
        Create a temporary dialog.
    */

    const dialog =
        document.createElement("dialog");

    dialog.className =
        "folder-dialog gallery-folder-manager-dialog";


    const form =
        document.createElement("form");

    form.method = "dialog";


    const heading =
        document.createElement("h2");

    heading.textContent =
        "📁 Organize Artwork";


    const subtitle =
        document.createElement("p");

    subtitle.textContent =
        `Choose which folders "${
            artwork.title || "Untitled"
        }" belongs to. ♡`;


    const list =
        document.createElement("div");

    list.className =
        "gallery-folder-manager-list";


    folders.forEach(
        (folder) => {
            const label =
                document.createElement("label");

            label.className =
                "gallery-folder-manager-option";


            const checkbox =
                document.createElement("input");

            checkbox.type = "checkbox";

            checkbox.value =
                String(folder.id);

            checkbox.checked =
                currentFolderIds.has(
                    String(folder.id)
                );


            const folderName =
                document.createElement("span");

            folderName.textContent =
                `📁 ${
                    folder.name ||
                    "Untitled Folder"
                }`;


            label.appendChild(
                checkbox
            );

            label.appendChild(
                folderName
            );

            list.appendChild(
                label
            );
        }
    );


    const error =
        document.createElement("p");

    error.className =
        "gallery-error";

    error.hidden = true;


    const buttons =
        document.createElement("div");

    buttons.className =
        "folder-dialog-buttons";


    const cancelButton =
        document.createElement("button");

    cancelButton.type = "button";

    cancelButton.textContent =
        "Cancel";


    const saveButton =
        document.createElement("button");

    saveButton.type = "submit";

    saveButton.textContent =
        "Save ♡";


    buttons.appendChild(
        cancelButton
    );

    buttons.appendChild(
        saveButton
    );


    form.appendChild(heading);
    form.appendChild(subtitle);
    form.appendChild(list);
    form.appendChild(error);
    form.appendChild(buttons);

    dialog.appendChild(form);

    document.body.appendChild(dialog);


    function closeDialog() {
        if (dialog.open) {
            dialog.close();
        }

        dialog.remove();
    }


    cancelButton.addEventListener(
        "click",
        closeDialog
    );


    dialog.addEventListener(
        "cancel",
        (event) => {
            event.preventDefault();
            closeDialog();
        }
    );


    form.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const selectedFolderIds =
                Array.from(
                    list.querySelectorAll(
                        'input[type="checkbox"]:checked'
                    )
                ).map(
                    (checkbox) =>
                        checkbox.value
                );


            saveButton.disabled = true;
            saveButton.textContent =
                "Saving... ♡";

            error.hidden = true;
            error.textContent = "";


            try {
                await saveArtworkFolders(
                    artwork,
                    selectedFolderIds
                );


                await loadArtworkFolders();

                renderFolders();
                renderOrphanArtwork();

                closeDialog();

                showStatus(
                    "Artwork folders updated! ♡"
                );

            } catch (saveError) {
                console.error(
                    "GALLERY: folder manager error:",
                    saveError
                );

                error.textContent =
                    `Couldn't update folders: ${
                        saveError?.message ||
                        "Unknown error"
                    }`;

                error.hidden = false;

                saveButton.disabled = false;
                saveButton.textContent =
                    "Save ♡";
            }
        }
    );


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


async function saveArtworkFolders(
    artwork,
    selectedFolderIds
) {
    /*
        The junction table columns are:

        gallery_item_id
        folder_id
    */


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
            (folderId) => ({
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


/* =========================================================
   RENAME FOLDER
========================================================= */

function openRenameFolder(folder) {
    if (!isGalleryOwner) {
        return;
    }

    editingFolder = folder;


    const dialog =
        document.getElementById(
            "folderDialog"
        );

    const title =
        document.getElementById(
            "folderDialogTitle"
        );

    const input =
        document.getElementById(
            "folderName"
        );

    const error =
        document.getElementById(
            "folderDialogError"
        );


    if (!dialog || !input) {
        return;
    }


    if (title) {
        title.textContent =
            "✏️ Rename Folder";
    }


    input.value =
        folder.name || "";


    if (error) {
        error.hidden = true;
        error.textContent = "";
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


    input.focus();
    input.select();
}


/* =========================================================
   DELETE FOLDER
========================================================= */

function openDeleteFolder(folder) {
    if (!isGalleryOwner) {
        return;
    }

    deletingFolder = folder;


    const dialog =
        document.getElementById(
            "deleteFolderDialog"
        );

    const message =
        document.getElementById(
            "deleteFolderMessage"
        );

    const error =
        document.getElementById(
            "deleteDialogError"
        );


    if (!dialog) {
        return;
    }


    if (message) {
        message.textContent =
            `Are you sure you want to delete "${
                folder.name ||
                "Untitled Folder"
            }"?`;
    }


    if (error) {
        error.hidden = true;
        error.textContent = "";
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


/* =========================================================
   CREATE FOLDER
========================================================= */

function createFolder() {
    if (!isGalleryOwner) {
        return;
    }

    editingFolder = null;


    const dialog =
        document.getElementById(
            "folderDialog"
        );

    const title =
        document.getElementById(
            "folderDialogTitle"
        );

    const input =
        document.getElementById(
            "folderName"
        );

    const error =
        document.getElementById(
            "folderDialogError"
        );


    if (!dialog || !input) {
        return;
    }


    if (title) {
        title.textContent =
            "📁 New Folder";
    }


    input.value = "";


    if (error) {
        error.hidden = true;
        error.textContent = "";
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


    input.focus();
}


/* =========================================================
   SAVE FOLDER DIALOG
========================================================= */

async function handleFolderFormSubmit(
    event
) {
    event.preventDefault();

    if (!isGalleryOwner) {
        return;
    }


    const input =
        document.getElementById(
            "folderName"
        );

    const error =
        document.getElementById(
            "folderDialogError"
        );

    const saveButton =
        document.getElementById(
            "folderSaveButton"
        );

    const dialog =
        document.getElementById(
            "folderDialog"
        );


    const name =
        input?.value.trim();


    if (!name) {
        if (error) {
            error.textContent =
                "Please enter a folder name. ♡";

            error.hidden = false;
        }

        return;
    }


    if (saveButton) {
        saveButton.disabled = true;
    }


    try {
        let result;


        if (editingFolder) {
            result = await client
                .from("gallery_folders")
                .update({
                    name: name
                })
                .eq(
                    "id",
                    editingFolder.id
                )
                .eq(
                    "user_id",
                    currentUser.id
                );

        } else {
            result = await client
                .from("gallery_folders")
                .insert({
                    user_id:
                        currentUser.id,

                    name: name
                });
        }


        if (result.error) {
            throw result.error;
        }


        editingFolder = null;


        if (dialog?.open) {
            dialog.close();
        }


        await loadFolders();
        await loadArtworkFolders();

        renderFolders();
        renderOrphanArtwork();
        renderUploadFolderList();


        showStatus(
            "Folder saved! ♡"
        );

    } catch (error) {
        console.error(
            "GALLERY: save folder error:",
            error
        );


        if (error?.code === "23505") {
            if (error?.message) {
                error.message =
                    "A folder with that name already exists.";
            }
        }


        if (error) {
            if (document.getElementById(
                "folderDialogError"
            )) {
                document.getElementById(
                    "folderDialogError"
                ).textContent =
                    error.message ||
                    "Couldn't save the folder.";

                document.getElementById(
                    "folderDialogError"
                ).hidden = false;
            }
        }

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
        }
    }
}


/* =========================================================
   DELETE FOLDER FORM
========================================================= */

async function handleDeleteFolderSubmit(
    event
) {
    event.preventDefault();


    if (
        !isGalleryOwner ||
        !deletingFolder
    ) {
        return;
    }


    const folder =
        deletingFolder;


    const error =
        document.getElementById(
            "deleteDialogError"
        );

    const confirmButton =
        document.getElementById(
            "deleteConfirmButton"
        );

    const dialog =
        document.getElementById(
            "deleteFolderDialog"
        );


    if (confirmButton) {
        confirmButton.disabled = true;
    }


    if (error) {
        error.hidden = true;
        error.textContent = "";
    }


    try {
        /*
            First remove all artwork-folder
            relations for this folder.
        */

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


        /*
            Then delete the folder itself.
        */

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


        deletingFolder = null;


        if (dialog?.open) {
            dialog.close();
        }


        await loadFolders();
        await loadArtworkFolders();

        renderFolders();
        renderOrphanArtwork();
        renderUploadFolderList();


        showStatus(
            "Folder deleted. Artwork was kept safe! ♡"
        );

    } catch (error) {
        console.error(
            "GALLERY: delete folder error:",
            error
        );


        if (error) {
            const errorElement =
                document.getElementById(
                    "deleteDialogError"
                );

            if (errorElement) {
                errorElement.textContent =
                    error.message ||
                    "Couldn't delete the folder.";

                errorElement.hidden = false;
            }
        }

    } finally {
        if (confirmButton) {
            confirmButton.disabled = false;
        }
    }
}


/* =========================================================
   UPLOAD DIALOG
========================================================= */

function openUploadDialog() {
    if (!isGalleryOwner) {
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

    const fileInput =
        document.getElementById(
            "galleryImage"
        );

    const titleInput =
        document.getElementById(
            "galleryTitle"
        );

    const descriptionInput =
        document.getElementById(
            "galleryDescription"
        );


    if (form) {
        form.reset();
    }


    if (fileInput) {
        fileInput.value = "";
    }

    if (titleInput) {
        titleInput.value = "";
    }

    if (descriptionInput) {
        descriptionInput.value = "";
    }


    clearUploadErrors();

    renderUploadFolderList();


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


function clearUploadErrors() {
    const ids = [
        "uploadFileError",
        "uploadDialogError"
    ];


    ids.forEach((id) => {
        const element =
            document.getElementById(id);

        if (!element) {
            return;
        }

        element.textContent = "";
        element.hidden = true;
    });
}


/* =========================================================
   UPLOAD FOLDER CHECKBOXES
========================================================= */

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


    folders.forEach(
        (folder) => {
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
        }
    );
}


/* =========================================================
   ACTUAL UPLOAD
========================================================= */

async function uploadArtworkFromDialog(
    event
) {
    event.preventDefault();


    if (
        !isGalleryOwner ||
        !currentUser?.id
    ) {
        return;
    }


    if (uploading) {
        return;
    }


    const fileInput =
        document.getElementById(
            "galleryImage"
        );

    const titleInput =
        document.getElementById(
            "galleryTitle"
        );

    const descriptionInput =
        document.getElementById(
            "galleryDescription"
        );

    const saveButton =
        document.getElementById(
            "uploadSaveButton"
        );

    const fileError =
        document.getElementById(
            "uploadFileError"
        );

    const dialogError =
        document.getElementById(
            "uploadDialogError"
        );

    const dialog =
        document.getElementById(
            "uploadDialog"
        );


    clearUploadErrors();


    const file =
        fileInput?.files?.[0];


    if (!file) {
        if (fileError) {
            fileError.textContent =
                "Please choose an image first. ♡";

            fileError.hidden = false;
        }

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
        if (fileError) {
            fileError.textContent =
                "Please choose a PNG, JPEG, WEBP, or GIF image.";

            fileError.hidden = false;
        }

        return;
    }


    uploading = true;


    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent =
            "Uploading... ♡";
    }


    let storagePath = null;


    try {
        const extension =
            getFileExtension(file);


        /*
            Every user's gallery files live
            inside their own UUID folder.
        */

        storagePath =
            `${currentUser.id}/${crypto.randomUUID()}.${extension}`;


        showStatus(
            "Uploading your artwork... 🌸"
        );


        /* -----------------------------
           STORAGE UPLOAD
        ----------------------------- */

        const {
            error: uploadError
        } = await client.storage
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


        /* -----------------------------
           PUBLIC URL
        ----------------------------- */

        const {
            data: publicUrlData
        } = client.storage
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


        /* -----------------------------
           DATABASE ITEM
        ----------------------------- */

        const title =
            titleInput?.value.trim() || "";

        const description =
            descriptionInput?.value.trim() || "";


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

                image_path:
                    storagePath,

                storage_path:
                    storagePath,

                title:
                    title,

                description:
                    description,

                is_hidden:
                    false
            })
            .select()
            .single();


        if (itemError) {
            /*
                Database insert failed after
                storage upload, so clean up
                the uploaded file.
            */

            await client.storage
                .from("gallery")
                .remove([
                    storagePath
                ]);

            throw itemError;
        }


        /* -----------------------------
           FOLDER RELATIONS
        ----------------------------- */

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
            selectedFolderIds.length
        ) {
            const rows =
                selectedFolderIds.map(
                    (folderId) => ({
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

                if (dialogError) {
                    dialogError.textContent =
                        `Image uploaded, but folders couldn't be assigned: ${
                            folderError.message
                        }`;

                    dialogError.hidden = false;
                }
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


        if (dialogError) {
            dialogError.textContent =
                `Couldn't upload image: ${
                    error?.message ||
                    "Unknown error"
                }`;

            dialogError.hidden = false;
        }

    } finally {
        uploading = false;


        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent =
                "Upload ♡";
        }
    }
}


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


/* =========================================================
   COMPATIBILITY UPLOAD FUNCTION
========================================================= */

async function uploadArtwork(
    file,
    title = "",
    description = "",
    selectedFolderIds = []
) {
    if (!file) {
        throw new Error(
            "No image was selected."
        );
    }


    if (!currentUser?.id) {
        throw new Error(
            "You must be signed in."
        );
    }


    const extension =
        getFileExtension(file);


    const storagePath =
        `${currentUser.id}/${crypto.randomUUID()}.${extension}`;


    const {
        error: uploadError
    } = await client.storage
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


    const {
        data: publicUrlData
    } = client.storage
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

            image_path:
                storagePath,

            storage_path:
                storagePath,

            title:
                title.trim(),

            description:
                description.trim(),

            is_hidden:
                false
        })
        .select()
        .single();


    if (itemError) {
        await client.storage
            .from("gallery")
            .remove([
                storagePath
            ]);

        throw itemError;
    }


    if (
        selectedFolderIds.length
    ) {
        const rows =
            selectedFolderIds.map(
                (folderId) => ({
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
        }
    }


    return artwork;
}


/* =========================================================
   MODERATOR HIDE / UNHIDE
========================================================= */

async function toggleArtworkVisibility(
    artwork
) {
    if (!isModerator) {
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


    if (newHiddenState) {
        moderatorHiddenArtworkIds.add(
            String(artwork.id)
        );
    } else {
        moderatorHiddenArtworkIds.delete(
            String(artwork.id)
        );
    }


    saveModeratorHiddenArtworkIds();

    await loadGallery();
}


/* =========================================================
   BUTTON BINDINGS
========================================================= */

function bindGalleryButtons() {
    /* -----------------------------
       UPLOAD
    ----------------------------- */

    const uploadButton =
        document.getElementById(
            "uploadArtworkButton"
        );

    if (uploadButton) {
        uploadButton.addEventListener(
            "click",
            openUploadDialog
        );
    }


    /* -----------------------------
       NEW FOLDER
    ----------------------------- */

    const newFolderButton =
        document.getElementById(
            "newFolderButton"
        );

    if (newFolderButton) {
        newFolderButton.addEventListener(
            "click",
            createFolder
        );
    }


    const emptyNewFolderButton =
        document.getElementById(
            "emptyNewFolderButton"
        );

    if (emptyNewFolderButton) {
        emptyNewFolderButton.addEventListener(
            "click",
            createFolder
        );
    }


    /* -----------------------------
       REFRESH
    ----------------------------- */

    const refreshButton =
        document.getElementById(
            "refreshFoldersButton"
        );

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            async () => {
                await loadGallery();
            }
        );
    }


    /* -----------------------------
       FOLDER DIALOG
    ----------------------------- */

    const folderForm =
        document.getElementById(
            "folderForm"
        );

    if (folderForm) {
        folderForm.addEventListener(
            "submit",
            handleFolderFormSubmit
        );
    }


    const folderCancelButton =
        document.getElementById(
            "folderCancelButton"
        );

    if (folderCancelButton) {
        folderCancelButton.addEventListener(
            "click",
            () => {
                const dialog =
                    document.getElementById(
                        "folderDialog"
                    );

                editingFolder = null;

                if (dialog?.open) {
                    dialog.close();
                }
            }
        );
    }


    /* -----------------------------
       DELETE DIALOG
    ----------------------------- */

    const deleteForm =
        document.getElementById(
            "deleteFolderForm"
        );

    if (deleteForm) {
        deleteForm.addEventListener(
            "submit",
            handleDeleteFolderSubmit
        );
    }


    const deleteCancelButton =
        document.getElementById(
            "deleteCancelButton"
        );

    if (deleteCancelButton) {
        deleteCancelButton.addEventListener(
            "click",
            () => {
                const dialog =
                    document.getElementById(
                        "deleteFolderDialog"
                    );

                deletingFolder = null;

                if (dialog?.open) {
                    dialog.close();
                }
            }
        );
    }


    /* -----------------------------
       UPLOAD DIALOG
    ----------------------------- */

    const uploadForm =
        document.getElementById(
            "uploadForm"
        );

    if (uploadForm) {
        uploadForm.addEventListener(
            "submit",
            uploadArtworkFromDialog
        );
    }


    const uploadCancelButton =
        document.getElementById(
            "uploadCancelButton"
        );

    if (uploadCancelButton) {
        uploadCancelButton.addEventListener(
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
}


/* =========================================================
   STATUS
========================================================= */

function showStatus(
    message,
    isError = false
) {
    const status =
        document.getElementById(
            "galleryStatus"
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


    /*
        Success messages disappear automatically.
        Error messages remain until replaced.
    */

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
                    status.textContent = "";

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


/* =========================================================
   GLOBAL API
========================================================= */

window.galleryUploadArtwork =
    uploadArtwork;

window.galleryCreateFolder =
    createFolder;

window.galleryLoad =
    loadGallery;

window.getGalleryOwnerId =
    getGalleryOwnerId;