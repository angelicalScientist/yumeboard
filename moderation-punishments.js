const punishmentClient = window.supabaseClient;


// ============================================================
// ELEMENTS
// ============================================================

const punishmentSearchForm =
    document.getElementById("punishmentSearchForm");

const punishmentUsername =
    document.getElementById("punishmentUsername");

const punishmentUserResults =
    document.getElementById("punishmentUserResults");

const selectedPunishmentUser =
    document.getElementById("selectedPunishmentUser");

const punishmentForm =
    document.getElementById("punishmentForm");

const punishmentType =
    document.getElementById("punishmentType");

const punishmentScope =
    document.getElementById("punishmentScope");

const punishmentDuration =
    document.getElementById("punishmentDuration");

const punishmentReason =
    document.getElementById("punishmentReason");

const punishmentMessage =
    document.getElementById("punishmentMessage");

const activePunishments =
    document.getElementById("activePunishments");

let selectedUser = null;


// ============================================================
// HELPERS
// ============================================================

function punishmentEscapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function punishmentFormatDate(value) {

    if (!value) {
        return "No expiration";
    }

    return new Date(value).toLocaleString();
}


function getDurationExpiration(duration) {

    if (!duration) {
        return null;
    }

    const days = Number.parseInt(
        duration.replace("d", ""),
        10
    );

    if (!Number.isFinite(days)) {
        return null;
    }

    const expiration = new Date();

    expiration.setDate(
        expiration.getDate() + days
    );

    return expiration.toISOString();
}


// ============================================================
// USER SEARCH
// ============================================================

async function searchPunishmentUsers() {

    const searchTerm =
        punishmentUsername.value.trim();

    if (!searchTerm) {
        punishmentUserResults.innerHTML = "";
        return;
    }

    punishmentUserResults.innerHTML = `
        <p>Searching... ♡</p>
    `;

    const {
        data,
        error
    } = await punishmentClient
        .from("profiles")
        .select("id, username, display_name")
        .ilike(
            "username",
            `%${searchTerm}%`
        )
        .limit(25);

    if (error) {
        throw error;
    }

    if (!data || !data.length) {

        punishmentUserResults.innerHTML = `
            <p>No users found. ♡</p>
        `;

        return;
    }

    punishmentUserResults.innerHTML = data
        .map(user => `
            <button
                type="button"
                class="punishment-user-button"
                data-user-id="${punishmentEscapeHtml(user.id)}"
                data-username="${punishmentEscapeHtml(user.username)}"
                data-display-name="${punishmentEscapeHtml(user.display_name || "")}"
            >
                <strong>
                    ${punishmentEscapeHtml(user.username)}
                </strong>

                ${
                    user.display_name
                        ? `
                            <span>
                                ${punishmentEscapeHtml(user.display_name)}
                            </span>
                        `
                        : ""
                }
            </button>
        `)
        .join("");

    document
        .querySelectorAll(".punishment-user-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    selectPunishmentUser({
                        id: button.dataset.userId,
                        username: button.dataset.username,
                        display_name:
                            button.dataset.displayName
                    });

                }
            );

        });
}


// ============================================================
// SELECT USER
// ============================================================

async function selectPunishmentUser(user) {

    selectedUser = user;

    selectedPunishmentUser.innerHTML = `
        <div class="card">
            <p>
                <strong>Selected user:</strong>
            </p>

            <p>
                ${punishmentEscapeHtml(user.username)}
            </p>
        </div>
    `;

    punishmentForm.hidden = false;

    punishmentUserResults.innerHTML = "";

    await loadUserPunishments(user.id);
}


// ============================================================
// LOAD PUNISHMENTS
// ============================================================

async function loadUserPunishments(userId) {

    activePunishments.innerHTML = `
        <p>Loading punishment history... ♡</p>
    `;

    const {
        data,
        error
    } = await punishmentClient
        .from("user_punishments")
        .select(`
            id,
            punishment_type,
            scope,
            reason,
            starts_at,
            expires_at,
            created_at,
            revoked_at,
            revoked_by,
            created_by
        `)
        .eq("user_id", userId)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    if (!data || !data.length) {

        activePunishments.innerHTML = `
            <p>
                This user has no punishment history. ♡
            </p>
        `;

        return;
    }

    activePunishments.innerHTML = `
        <h3>♡ Punishment history</h3>

        ${data.map(punishment => {

            const active =
                !punishment.revoked_at &&
                (
                    !punishment.expires_at ||
                    new Date(punishment.expires_at) > new Date()
                );

            return `
                <article class="punishment-entry">

                    <h4>
                        ${punishmentEscapeHtml(
                            punishment.punishment_type
                        )}
                    </h4>

                    <p>
                        <strong>Scope:</strong>
                        ${punishmentEscapeHtml(
                            punishment.scope
                        )}
                    </p>

                    <p>
                        <strong>Started:</strong>
                        ${punishmentEscapeHtml(
                            punishmentFormatDate(
                                punishment.starts_at
                            )
                        )}
                    </p>

                    <p>
                        <strong>Expires:</strong>
                        ${punishmentEscapeHtml(
                            punishmentFormatDate(
                                punishment.expires_at
                            )
                        )}
                    </p>

                    <p>
                        <strong>Reason:</strong>
                        ${punishmentEscapeHtml(
                            punishment.reason ||
                            "No reason provided."
                        )}
                    </p>

                    <p>
                        <strong>Status:</strong>
                        ${
                            punishment.revoked_at
                                ? "Revoked"
                                : active
                                    ? "Active"
                                    : "Expired"
                        }
                    </p>

                    ${
                        active
                            ? `
                                <button
                                    type="button"
                                    class="revoke-punishment-button"
                                    data-punishment-id="${punishmentEscapeHtml(punishment.id)}"
                                >
                                    Revoke punishment
                                </button>
                            `
                            : ""
                    }

                </article>
            `;

        }).join("")}
    `;

    attachRevokeButtons();
}


// ============================================================
// REVOKE
// ============================================================

function attachRevokeButtons() {

    document
        .querySelectorAll(
            ".revoke-punishment-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const punishmentId =
                        button.dataset.punishmentId;

                    const confirmed = confirm(
                        "Revoke this punishment?"
                    );

                    if (!confirmed) {
                        return;
                    }

                    try {

                        button.disabled = true;

                        const {
                            error
                        } = await punishmentClient.rpc(
                            "moderator_revoke_punishment",
                            {
                                p_punishment_id:
                                    punishmentId
                            }
                        );

                        if (error) {
                            throw error;
                        }

                        punishmentMessage.textContent =
                            "Punishment revoked. ♡";

                        await loadUserPunishments(
                            selectedUser.id
                        );

                    } catch (error) {

                        console.error(
                            "Failed to revoke punishment:",
                            error
                        );

                        alert(
                            error.message ||
                            "Could not revoke punishment."
                        );

                        button.disabled = false;
                    }

                }
            );

        });
}


// ============================================================
// APPLY PUNISHMENT
// ============================================================

async function applyPunishment(event) {

    event.preventDefault();

    if (!selectedUser) {
        alert("Please select a user first.");
        return;
    }

    const type =
        punishmentType.value;

    const scope =
        punishmentScope.value;

    const duration =
        punishmentDuration.value;

    const reason =
        punishmentReason.value.trim();

    if (
        type === "temporary_ban" &&
        !duration
    ) {
        alert(
            "Temporary bans require a duration."
        );

        return;
    }

    if (
        type === "permanent_ban" &&
        duration
    ) {
        alert(
            "Permanent bans cannot have a duration."
        );

        return;
    }

    const expiresAt =
        type === "permanent_ban"
            ? null
            : getDurationExpiration(duration);

    const confirmed = confirm(
        `Apply ${type.replaceAll("_", " ")} ` +
        `to ${selectedUser.username}?`
    );

    if (!confirmed) {
        return;
    }

    punishmentMessage.textContent =
        "Applying punishment... ♡";

    try {

        const {
            data,
            error
        } = await punishmentClient.rpc(
            "moderator_create_punishment",
            {
                p_user_id:
                    selectedUser.id,

                p_punishment_type:
                    type,

                p_scope:
                    scope,

                p_reason:
                    reason || null,

                p_starts_at:
                    new Date().toISOString(),

                p_expires_at:
                    expiresAt
            }
        );

        if (error) {
            throw error;
        }

        punishmentMessage.textContent =
            "Punishment applied successfully. ♡";

        punishmentReason.value = "";

        punishmentDuration.value = "";

        await loadUserPunishments(
            selectedUser.id
        );

    } catch (error) {

        console.error(
            "Failed to apply punishment:",
            error
        );

        punishmentMessage.textContent = "";

        alert(
            error.message ||
            "Could not apply punishment."
        );
    }
}


// ============================================================
// PUNISHMENT TYPE UI
// ============================================================

function updatePunishmentDurationUI() {

    const type =
        punishmentType.value;

    if (type === "permanent_ban") {

        punishmentDuration.value = "";
        punishmentDuration.disabled = true;

        return;
    }

    punishmentDuration.disabled = false;

    if (type === "temporary_ban") {

        if (!punishmentDuration.value) {
            punishmentDuration.value = "7d";
        }

    } else {

        punishmentDuration.value = "";
    }
}


// ============================================================
// EVENTS
// ============================================================

punishmentSearchForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        try {
            await searchPunishmentUsers();
        } catch (error) {

            console.error(
                "Punishment user search failed:",
                error
            );

            punishmentUserResults.innerHTML = `
                <p class="error-message">
                    ${punishmentEscapeHtml(
                        error.message ||
                        "Search failed."
                    )}
                </p>
            `;
        }

    }
);


punishmentForm.addEventListener(
    "submit",
    applyPunishment
);


punishmentType.addEventListener(
    "change",
    updatePunishmentDurationUI
);


updatePunishmentDurationUI();