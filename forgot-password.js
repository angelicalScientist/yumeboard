
const recoveryForm = document.getElementById("recoveryForm");
const recoveryEmail = document.getElementById("recoveryEmail");
const recoveryMessage = document.getElementById("recoveryMessage");
const recoveryButton = document.getElementById("recoveryButton");

recoveryForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = recoveryEmail.value.trim();

    if (!email) {
        recoveryMessage.textContent = "Please enter your email! ♡";
        return;
    }

    recoveryButton.disabled = true;
    recoveryMessage.textContent = "Sending your recovery email... 🌸";

    try {
        const { error } =
            await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo:
                    "https://angelicalscientist.github.io/yumeboard/reset-password.html"
            });

        if (error) {
            console.error("Recovery request failed:", error);

            recoveryMessage.textContent =
                "We couldn't process that request. Please try again later.";
            return;
        }

        recoveryMessage.textContent =
            "If an account exists for that email, " +
            "you'll receive a recovery link shortly. ♡";

    } catch (error) {
        console.error("Recovery error:", error);

        recoveryMessage.textContent =
            "Something went wrong. Please try again later.";

    } finally {
        recoveryButton.disabled = false;
    }
});