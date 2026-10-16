
(() => {
    const STORAGE_KEY = "yumeboard-font";

    function applyFont(useArial) {
        document.documentElement.classList.toggle(
            "accessible-font",
            useArial
        );
    }

    // Apply the saved preference as early as possible.
    const savedFont = localStorage.getItem(STORAGE_KEY);
    applyFont(savedFont === "arial");

    document.addEventListener("DOMContentLoaded", () => {
        const fontToggle = document.getElementById("font-toggle");

        if (!fontToggle) return;

        function updateButton() {
            const useArial =
                document.documentElement.classList.contains("accessible-font");

            fontToggle.textContent = useArial
                ? "Use default font"
                : "Switch to Arial font";

            fontToggle.setAttribute("aria-pressed", String(useArial));
        }

        fontToggle.addEventListener("click", () => {
            const useArial =
                !document.documentElement.classList.contains("accessible-font");

            applyFont(useArial);

            localStorage.setItem(
                STORAGE_KEY,
                useArial ? "arial" : "default"
            );

            updateButton();
        });

        updateButton();
    });
})();
