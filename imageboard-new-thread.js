
(() => {
  "use strict";

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const STORAGE_BUCKET = "imageboard-images";

  const $ = (id) => document.getElementById(id);

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
    message.setAttribute("role", type === "error" ? "alert" : "status");
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

  function getFileExtension(file) {
    const name = file.name || "";
    const match = name.match(/\.([a-zA-Z0-9]+)$/);

    if (match) {
      const extension = match[1].toLowerCase();

      if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(extension)) {
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

  function wrapSelectedText(before, after = before) {
    if (!contentInput) return;

    const start = contentInput.selectionStart;
    const end = contentInput.selectionEnd;
    const value = contentInput.value;
    const selected = value.slice(start, end);

    const replacement = `${before}${selected}${after}`;

    contentInput.setRangeText(replacement, start, end, "select");
    contentInput.focus();

    // Place the cursor inside the formatting markers when
    // no text was selected.
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

    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-format]");

      if (!button || !toolbar.contains(button)) return;

      event.preventDefault();

      const format = formats[button.dataset.format];

      if (!format) return;

      wrapSelectedText(format[0], format[1]);
    });
  }

  async function loadBoard() {
    const slug = new URLSearchParams(window.location.search).get("board");

    if (!slug) {
      showMessage("No board specified. Open this page from a board first.");
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
      throw new Error("Please sign in before creating a thread.");
    }

    return data.user;
  }

  function validateImage(file) {
    if (!file) {
      throw new Error("Please choose an image for your thread.");
    }

    if (!file.type.startsWith("image/")) {
      throw new Error("The selected file must be an image.");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Your image must be 10 MB or smaller.");
    }

    const extension = getFileExtension(file);

    if (!extension) {
      throw new Error(
        "Unsupported image format. Try JPG, PNG, GIF, WebP, or AVIF."
      );
    }

    return extension;
  }

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

      if (previewImage) previewImage.src = previewUrl;
      if (previewName) previewName.textContent = file.name;
      if (preview) preview.hidden = false;

      showMessage("");
    });
  }

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
      showMessage("The board has not loaded. Refresh and try again.");
      return;
    }

    const title = titleInput?.value.trim() || "";
    const content = contentInput?.value || "";
    const file = imageInput?.files?.[0];

    if (!title) {
      showMessage("Please enter a thread title.");
      titleInput?.focus();
      return;
    }

    if (title.length > 200) {
      showMessage("Your title must be 200 characters or fewer.");
      titleInput?.focus();
      return;
    }

    let extension;

    try {
      extension = validateImage(file);
    } catch (error) {
      showMessage(getErrorMessage(error));
      imageInput?.focus();
      return;
    }

    isSubmitting = true;

    if (createButton) {
      createButton.disabled = true;
      createButton.textContent = "Creating thread...";
    }

    try {
      const user = await getCurrentUser();

      // Stage 1: create the thread and its first post.
      const { data: created, error: createError } = await client.rpc(
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

      const record = Array.isArray(created) ? created[0] : created;
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
      const randomPart = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const storagePath =
        `${user.id}/${threadId}/${randomPart}.${extension}`;

      const { error: uploadError } = await client.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        fail("Uploading image to Storage", uploadError);
      }

      // Stage 3: attach the uploaded image to the first post.
      const { error: imageRowError } = await client
        .from("post_images")
        .insert({
          post_id: postId,
          storage_path: storagePath,
          alt_text: file.name
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

      // Success: open the newly created thread.
      window.location.assign(
        `imageboard-thread.html?id=${encodeURIComponent(threadId)}`
      );
    } catch (error) {
      console.error("[Yumeboard] Thread creation failed:", error);
      showMessage(getErrorMessage(error));
    } finally {
      isSubmitting = false;

      if (createButton) {
        createButton.disabled = false;
        createButton.textContent = "Create Thread";
      }
    }
  }

  async function start() {
    if (!form) {
      console.error("[Yumeboard] #newThreadForm was not found.");
      return;
    }

    setupFormattingToolbar();
    setupImagePreview();

    form.addEventListener("submit", createThread);

    if (cancelButton) {
      cancelButton.addEventListener("click", (event) => {
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
      console.error("[Yumeboard] Page initialization failed:", error);
      form.hidden = false;
      showMessage(getErrorMessage(error));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
