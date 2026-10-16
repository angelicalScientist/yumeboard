
(() => {
    const STORAGE_KEY = "yumeboard-font";

    function applyFont(useArial) {
        document.documentElement.classList.toggle(
            "accessible-font",
            useArial
        );

        try {
            localStorage.setItem(
                STORAGE_KEY,
                useArial ? "arial" : "default"
            );
        } catch (error) {
            console.warn("Could not save font preference:", error);
        }

        const button = document.getElementById("font-toggle");

        if (button) {
            button.textContent = useArial
                ? "🖋️ Use default font"
                : "🖋️ Switch to Arial font";

            button.setAttribute("aria-pressed", String(useArial));
        }
    }

    // Restore the saved preference.
    try {
        applyFont(localStorage.getItem(STORAGE_KEY) === "arial");
    } catch (error) {
        applyFont(false);
    }

    // Listen for clicks even if the dropdown is rebuilt later.
    document.addEventListener("click", (event) => {
        const button = event.target.closest("#font-toggle");

        if (!button) return;

        event.preventDefault();

        const useArial =
            !document.documentElement.classList.contains("accessible-font");

        applyFont(useArial);
    });
})();
