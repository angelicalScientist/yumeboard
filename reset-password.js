
const resetForm = document.getElementById("resetForm");
const resetMessage = document.getElementById("resetMessage");
const resetButton = document.getElementById("resetButton");

const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");

let recoveryVerified = false;
let resetInProgress = false;

// Supabase detects the recovery link and emits this event.
const {
    data: { subscription }
} = supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
        recoveryVerified = true;

        resetForm.hidden = false;
        resetMessage.textContent =
            "Recovery link verified! Choose your new password. ♡";
    }
});

resetForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!recoveryVerified || resetInProgress) {
        resetMessage.textContent =
            "Please open a valid recovery link from your email.";
        return;
    }

    const password = newPassword.value;
    const confirmation = confirmPassword.value;

    if (password.length < 8) {
        resetMessage.textContent =
            "Your password must be at least 8 characters long.";
        return;
    }

    if (password !== confirmation) {
        resetMessage.textContent =
            "Your passwords don't match! Please try again. ♡";
        return;
    }

    resetInProgress = true;
    resetButton.disabled = true;
    resetMessage.textContent = "Updating your password... 🌸";

    try {
        const { error } = await supabaseClient.auth.updateUser({
            password: password
        });

        if (error) {
            console.error("Password reset failed:", error);

            resetMessage.textContent =
                "We couldn't update your password. " +
                "Your recovery link may have expired. " +
                "Please request a new one.";

            return;
        }

        recoveryVerified = false;
        resetForm.hidden = true;

        resetMessage.textContent =
            "Your password has been updated! ♡ " +
            "You can now return to the login page.";

        resetForm.reset();

    } catch (error) {
        console.error("Password reset error:", error);

        resetMessage.textContent =
            "Something went wrong. Please try again.";

    } finally {
        resetInProgress = false;
        resetButton.disabled = false;
    }
});