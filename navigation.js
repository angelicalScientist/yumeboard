// ============================================
// SHARED NAVIGATION
// navigation.js
// ============================================

(() => {
    "use strict";

    // ========================================
    // ELEMENTS
    // ========================================

    const suggestionsButton =
        document.getElementById("suggestionsButton");

    const modSettingsGroup =
        document.getElementById("modSettingsGroup");

    // ========================================
    // SUPABASE
    // ========================================

    const client = window.supabaseClient;

    if (!client) {
        console.error("Navigation: Supabase client not found.");
        return;
    }

    // ========================================
    // SUGGESTIONS
    // ========================================

    if (suggestionsButton) {
        suggestionsButton.addEventListener("click", () => {
            window.location.href = "suggest.html";
        });
    }

    // ========================================
    // MODERATOR ACCESS
    // ========================================

    async function checkModeratorAccess() {
        if (!modSettingsGroup) {
            console.warn(
                "Navigation: modSettingsGroup not found."
            );
            return;
        }

        // Keep moderation hidden by default.
        modSettingsGroup.hidden = true;

        const {
            data: { user },
            error: userError
        } = await client.auth.getUser();

        if (userError) {
            console.error(
                "Navigation: could not get current user:",
                userError
            );
            return;
        }

        if (!user) {
            return;
        }

        try {
            const {
                data: isModerator,
                error
            } = await client.rpc("is_moderator");

            if (error) {
                console.error(
                    "Navigation: could not check moderator status:",
                    error
                );
                return;
            }

            console.log(
                "Moderator status:",
                isModerator
            );

            if (isModerator === true) {
                modSettingsGroup.hidden = false;
            }

        } catch (error) {
            console.error(
                "Navigation: unexpected moderator check error:",
                error
            );
        }
    }


    async function loadMyPunishmentNotice() {

        const container =
            document.getElementById("punishmentNotice");

        if (!container) {
            return;
        }

        const {
            data,
            error
        } = await window.supabaseClient.rpc(
            "get_my_active_punishments"
        );

        if (error) {
            console.error(
                "Failed to load punishment notice:",
                error
            );

            container.hidden = true;
            return;
        }

        if (!data || !data.length) {
            container.hidden = true;
            return;
        }

        const accountPunishments =
            data.filter(
                punishment =>
                    punishment.scope === "account"
            );

        const punishments =
            accountPunishments.length
                ? accountPunishments
                : data;

        container.innerHTML = punishments
            .map(renderPunishmentNotice)
            .join("");

        container.hidden = false;
    }


    function renderPunishmentNotice(punishment) {

        const typeLabels = {
            warning: "Warning",
            restriction: "Restriction",
            temporary_ban: "Temporary ban",
            permanent_ban: "Permanent ban"
        };

        const scopeLabels = {
            account: "your entire account",
            imageboard: "the imageboard",
            imageboard_threads: "creating imageboard threads",
            imageboard_posts: "creating imageboard posts",
            image_uploads: "image uploads",
            gallery: "the gallery",
            guestbook: "the guestbook",
            suggestions: "suggestions"
        };

        const type =
            typeLabels[punishment.punishment_type]
            || punishment.punishment_type;

        const scope =
            scopeLabels[punishment.scope]
            || punishment.scope;

        const reason =
            punishment.reason
            || "No reason was provided.";

        let expiration = "";

        if (punishment.expires_at) {

            expiration = `
                <p>
                    <strong>Until:</strong>
                    ${escapeHtml(
                        new Date(
                            punishment.expires_at
                        ).toLocaleString()
                    )}
                </p>
            `;

        } else if (
            punishment.punishment_type ===
            "permanent_ban"
        ) {

            expiration = `
                <p>
                    <strong>
                        This punishment does not expire.
                    </strong>
                </p>
            `;

        }

        return `
            <article class="punishment-notice">

                <h2>
                    ♡ ${escapeHtml(type)}
                </h2>

                <p>
                    You currently have a moderation
                    action affecting
                    <strong>
                        ${escapeHtml(scope)}
                    </strong>.
                </p>

                <p>
                    <strong>Reason:</strong>
                    ${escapeHtml(reason)}
                </p>

                ${expiration}

            </article>
        `;
    }


    // ========================================
    // INITIALIZE
    // ========================================

    checkModeratorAccess();

})();