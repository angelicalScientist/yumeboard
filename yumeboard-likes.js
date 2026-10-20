
(() => {
  "use strict";

  const LIKE_TYPES = {
    gallery: {
      table: "gallery_item_likes",
      column: "gallery_item_id",
      statsFunction: "get_gallery_item_like_stats",
      label: "gallery artwork"
    },
    thread: {
      table: "thread_likes",
      column: "thread_id",
      statsFunction: "get_thread_like_stats",
      label: "thread"
    },
    post: {
      table: "post_likes",
      column: "post_id",
      statsFunction: "get_post_like_stats",
      label: "post"
    }
  };

  const BUTTON_TEXT = "⸜(｡˃ ᵕ ˂ )⸝♡";
  const busy = new Set();
  let initialized = false;

  // Resolve the client when needed so the script can load before
  // the Supabase client is initialized, provided initialization
  // finishes before the first like operation.
  function getClient() {
    return window.supabaseClient || null;
  }

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&#39;");
  }

  function ensureStyles() {
    if (document.getElementById("yb-like-styles")) return;

    const style = document.createElement("style");
    style.id = "yb-like-styles";
    style.textContent = `
      .yb-like-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        padding: 0.4rem 0.7rem;
        border: 1px solid var(--yb-like-border, #e7b9d2);
        border-radius: 999px;
        background: var(--yb-like-background, transparent);
        color: var(--yb-like-color, inherit);
        font: inherit;
        line-height: 1.4;
        cursor: pointer;
        transition:
          background-color 150ms ease,
          border-color 150ms ease,
          transform 150ms ease;
      }

      .yb-like-button:hover:not(:disabled) {
        background: var(--yb-like-hover, #fff0f7);
        border-color: var(--yb-like-hover-border, #df91bb);
      }

      .yb-like-button:active:not(:disabled) {
        transform: scale(0.97);
      }

      .yb-like-button[aria-pressed="true"] {
        background: var(--yb-like-active-background, #ffe4f1);
        border-color: var(--yb-like-active-border, #df91bb);
      }

      .yb-like-button:disabled {
        cursor: default;
        opacity: 0.7;
      }

      .yb-like-button:focus-visible {
        outline: 2px solid var(--yb-like-focus, #d86da5);
        outline-offset: 3px;
      }

      .yb-like-button-text,
      .yb-like-count {
        display: inline-block;
      }

      @media (prefers-reduced-motion: reduce) {
        .yb-like-button {
          transition: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function buttonMarkup(type, id) {
    if (!LIKE_TYPES[type] || !id) {
      console.error("[Yumeboard] Invalid like button type or ID.");
      return "";
    }

    const safeType = escapeAttribute(type);
    const safeId = escapeAttribute(id);
    const label = escapeAttribute(BUTTON_TEXT);

    return `
      <button
        type="button"
        class="yb-like-button"
        data-yb-like-type="${safeType}"
        data-yb-like-id="${safeId}"
        aria-pressed="false"
        aria-label="Appreciate this ${escapeAttribute(LIKE_TYPES[type].label)}"
        title="Send appreciation"
        disabled
      >
        <span class="yb-like-button-text">${label}</span>
        <span class="yb-like-count" aria-label="Appreciation count">0</span>
      </button>
    `;
  }

  function getButtons(root = document) {
    const buttons = [];

    if (
      root instanceof Element &&
      root.matches(".yb-like-button")
    ) {
      buttons.push(root);
    }

    if (root && typeof root.querySelectorAll === "function") {
      buttons.push(...root.querySelectorAll(".yb-like-button"));
    }

    return buttons;
  }

  function setButtonState(button, count, liked) {
    const countElement = button.querySelector(".yb-like-count");
    if (countElement) {
      countElement.textContent = String(count);
    }

    button.dataset.ybLiked = liked ? "true" : "false";
    button.setAttribute("aria-pressed", liked ? "true" : "false");

    const type = button.dataset.ybLikeType;
    const config = LIKE_TYPES[type];

    if (config) {
      button.setAttribute(
        "aria-label",
        `${liked ? "Remove appreciation from" : "Appreciate this"} ${config.label}. ${count} appreciation${count === 1 ? "" : "s"}.`
      );
    }
  }

  async function refresh(root = document) {
    const client = getClient();

    if (!client) {
      console.error(
        "[Yumeboard] Supabase client is unavailable. Make sure window.supabaseClient is initialized."
      );
      return;
    }

    const buttons = getButtons(root);
    const buttonsByType = new Map();

    for (const button of buttons) {
      const type = button.dataset.ybLikeType;
      const id = button.dataset.ybLikeId;

      if (!LIKE_TYPES[type] || !id) continue;

      if (!buttonsByType.has(type)) {
        buttonsByType.set(type, []);
      }

      buttonsByType.get(type).push(button);
    }

    for (const [type, typeButtons] of buttonsByType) {
      const config = LIKE_TYPES[type];
      const ids = [...new Set(
        typeButtons.map(button => button.dataset.ybLikeId)
      )];

      try {
        const { data, error } = await client.rpc(
          config.statsFunction,
          { p_ids: ids }
        );

        if (error) throw error;

        const statsById = new Map(
          (data || []).map(row => [
            String(row.target_id),
            row
          ])
        );

        for (const button of typeButtons) {
          if (!button.isConnected || busy.has(button)) continue;

          const id = button.dataset.ybLikeId;
          const stats = statsById.get(String(id));

          // The RPC only returns targets the viewer is allowed to see.
          if (!stats) {
            button.disabled = true;
            continue;
          }

          setButtonState(
            button,
            Number(stats.like_count) || 0,
            stats.liked_by_me === true
          );

          button.disabled = false;
        }
      } catch (error) {
        console.error(
          `[Yumeboard] Could not refresh ${config.label} appreciation counts:`,
          error
        );
      }
    }
  }

  async function toggle(button) {
    if (!button || busy.has(button)) return;

    const type = button.dataset.ybLikeType;
    const id = button.dataset.ybLikeId;
    const config = LIKE_TYPES[type];

    if (!config || !id) return;

    const client = getClient();

    if (!client) {
      console.error("[Yumeboard] Supabase client is unavailable.");
      return;
    }

    busy.add(button);
    button.disabled = true;

    try {
      const { data: userResult, error: userError } =
        await client.auth.getUser();

      if (userError) throw userError;

      const user = userResult && userResult.user;

      if (!user) {
        window.alert("Please sign in to send appreciation. ♡");
        return;
      }

      const alreadyLiked = button.dataset.ybLiked === "true";

      if (alreadyLiked) {
        const { error } = await client
          .from(config.table)
          .delete()
          .eq(config.column, id)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const insertValues = {
          [config.column]: id,
          user_id: user.id
        };

        const { error } = await client
          .from(config.table)
          .insert(insertValues);

        // A duplicate like is harmless: the primary key prevents
        // the same account from liking the same item twice.
        if (error && error.code !== "23505") {
          throw error;
        }
      }
    } catch (error) {
      console.error("[Yumeboard] Could not update appreciation:", error);
      window.alert("Sorry, appreciation couldn't be updated. Please try again.");
    } finally {
      busy.delete(button);

      // Refresh after the operation, even if it failed, so the
      // displayed state can recover from a stale button state.
      await refresh(document);
    }
  }

  function setup() {
    if (initialized) return;
    initialized = true;

    ensureStyles();

    document.addEventListener("click", event => {
      const button = event.target.closest(".yb-like-button");

      if (!button || !document.contains(button)) return;

      event.preventDefault();
      void toggle(button);
    });

    // Refresh only on setup and when a page renderer explicitly
    // calls YumeboardLikes.refresh(container). No mutation observer:
    // updating the count must not trigger another refresh.
    void refresh(document);
  }

  window.YumeboardLikes = {
    buttonMarkup,
    refresh,
    setup
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();
