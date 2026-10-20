
(() => {
    "use strict";

    const client = window.supabaseClient;

    const LIKE_TYPES = {
        gallery: {
            table: "gallery_item_likes",
            column: "gallery_item_id",
            label: "gallery artwork"
        },
        thread: {
            table: "thread_likes",
            column: "thread_id",
            label: "thread"
        },
        post: {
            table: "post_likes",
            column: "post_id",
            label: "post"
        }
    };

    const BUTTON_TEXT = "⸜(｡˃ ᵕ ˂ )⸝♡";
    const busy = new Set();

    function escapeAttribute(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function ensureStyles() {
        if (document.getElementById("yumeboardLikesStyles")) return;

        const style = document.createElement("style");
        style.id = "yumeboardLikesStyles";

        style.textContent = `
            .yb-like-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.45rem;
                padding: 0.4rem 0.7rem;
                border: 1px solid var(--border-color, #d8c8df);
                border-radius: 999px;
                background: var(--card-background, transparent);
                color: inherit;
                font: inherit;
                font-size: 0.9rem;
                line-height: 1.4;
                cursor: pointer;
                transition:
                    background-color 0.15s ease,
                    transform 0.15s ease,
                    border-color 0.15s ease;
            }

            .yb-like-button:hover:not(:disabled) {
                transform: translateY(-1px);
                border-color: #c49bd8;
            }

            .yb-like-button[aria-pressed="true"] {
                background: rgba(196, 155, 216, 0.2);
                border-color: #b48ead;
            }

            .yb-like-button:disabled {
                cursor: wait;
                opacity: 0.65;
            }

            .yb-like-count {
                min-width: 1ch;
                font-variant-numeric: tabular-nums;
            }

            .yb-like-message {
                font-size: 0.85rem;
                opacity: 0.8;
            }
        `;

        document.head.appendChild(style);
    }

    function buttonMarkup(type, id) {
        if (!LIKE_TYPES[type] || !id) return "";

        return `
            <button
                type="button"
                class="yb-like-button"
                data-yb-like-type="${escapeAttribute(type)}"
                data-yb-like-id="${escapeAttribute(id)}"
                aria-pressed="false"
                aria-label="Like this ${LIKE_TYPES[type].label}"
                title="Show appreciation"
            >
                <span class="yb-like-label">${BUTTON_TEXT}</span>
                <span class="yb-like-count" aria-label="Like count">0</span>
            </button>
        `;
    }

    function getButtons(root = document) {
        return Array.from(
            root.querySelectorAll(
                ".yb-like-button[data-yb-like-type][data-yb-like-id]"
            )
        );
    }

    function setButtonState(button, count, liked) {
        button.querySelector(".yb-like-count").textContent =
            String(count);

        button.setAttribute("aria-pressed", String(liked));

        const type = button.dataset.ybLikeType;
        const label = LIKE_TYPES[type]?.label || "item";

        button.setAttribute(
            "aria-label",
            `${liked ? "Unlike" : "Like"} this ${label}. ${count} likes.`
        );
    }

    async function refresh(root = document) {
        if (!client) return;

        const buttons = getButtons(root);
        if (!buttons.length) return;

        let user = null;

        try {
            const { data, error } = await client.auth.getUser();

            if (error) {
                console.warn("[Yumeboard Likes] Could not get user.", error);
            } else {
                user = data?.user || null;
            }
        } catch (error) {
            console.warn("[Yumeboard Likes] Auth check failed.", error);
        }

        for (const [type, config] of Object.entries(LIKE_TYPES)) {
            const typeButtons = buttons.filter(
                button => button.dataset.ybLikeType === type
            );

            if (!typeButtons.length) continue;

            const ids = [
                ...new Set(typeButtons.map(
                    button => button.dataset.ybLikeId
                ))
            ];

            try {
                const { data, error } = await client
                    .from(config.table)
                    .select(`${config.column}, user_id`)
                    .in(config.column, ids);

                if (error) throw error;

                const counts = new Map();
                const likedIds = new Set();

                for (const row of data || []) {
                    const id = row[config.column];

                    counts.set(id, (counts.get(id) || 0) + 1);

                    if (user && row.user_id === user.id) {
                        likedIds.add(id);
                    }
                }

                for (const button of typeButtons) {
                    // Don't overwrite a button while its toggle is in flight.
                    if (busy.has(button)) continue;

                    const id = button.dataset.ybLikeId;

                    setButtonState(
                        button,
                        counts.get(id) || 0,
                        likedIds.has(id)
                    );

                    button.disabled = false;
                }
            } catch (error) {
                console.error(
                    `[Yumeboard Likes] Could not load ${type} likes.`,
                    error
                );

                for (const button of typeButtons) {
                    button.disabled = true;
                    button.title = "Likes could not be loaded. Please refresh.";
                }
            }
        }
    }

    async function toggle(button) {
        if (!client || busy.has(button)) return;

        const type = button.dataset.ybLikeType;
        const id = button.dataset.ybLikeId;
        const config = LIKE_TYPES[type];

        if (!config || !id) return;

        busy.add(button);
        button.disabled = true;

        const originalText = button.querySelector(".yb-like-label");
        const previousLabel = originalText?.textContent;

        try {
            const { data, error: authError } = await client.auth.getUser();

            if (authError || !data?.user) {
                window.alert("Please log in to leave some appreciation. ♡");
                return;
            }

            const userId = data.user.id;
            const alreadyLiked =
                button.getAttribute("aria-pressed") === "true";

            if (alreadyLiked) {
                const { error } = await client
                    .from(config.table)
                    .delete()
                    .eq(config.column, id)
                    .eq("user_id", userId);

                if (error) throw error;
            } else {
                const { error } = await client
                    .from(config.table)
                    .insert({
                        [config.column]: id,
                        user_id: userId
                    });

                if (error) {
                    // A duplicate can occur if two requests overlap.
                    // The primary key prevents duplicate likes.
                    if (error.code !== "23505") throw error;
                }
            }

            await refresh(document);
        } catch (error) {
            console.error("[Yumeboard Likes] Could not toggle like.", error);

            window.alert(
                "Couldn't update your like. Please try again. ♡"
            );

            await refresh(document);
        } finally {
            busy.delete(button);
            button.disabled = false;

            if (originalText && previousLabel) {
                originalText.textContent = BUTTON_TEXT;
            }
        }
    }

    function setup() {
        ensureStyles();

        document.addEventListener("click", event => {
            const target = event.target;

            if (!(target instanceof Element)) return;

            const button = target.closest(".yb-like-button");

            if (!button) return;

            event.preventDefault();
            event.stopPropagation();

            toggle(button);
        });

        // Refresh likes when the page's gallery/thread content changes.
        // A short delay batches multiple DOM changes into one refresh.
        let refreshTimer = null;

        const observer = new MutationObserver(() => {
            if (refreshTimer !== null) {
                window.clearTimeout(refreshTimer);
            }

            refreshTimer = window.setTimeout(() => {
                refreshTimer = null;
                refresh(document);
            }, 150);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        refresh(document);
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
