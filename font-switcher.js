
(() => {
    const STORAGE_KEY = "yumeboard-font";

    function initFontSwitcher() {
        const button = document.getElementById("font-toggle");

        function applyFont(useArial) {
            document.documentElement.classList.toggle(
                "accessible-font",
                useArial
            );

            localStorage.setItem(
                STORAGE_KEY,
                useArial ? "arial" : "default"
            );

            if (button) {
                button.textContent = useArial
                    ? "Use default font"
                    : "Switch to Arial font";

                button.setAttribute(
                    "aria-pressed",
                    String(useArial)
                );
            }
        }

        // Restore the saved preference.
        applyFont(localStorage.getItem(STORAGE_KEY) === "arial");

        if (!button || button.dataset.fontSwitcherReady === "true") {
            return;
        }

        button.dataset.fontSwitcherReady = "true";

        button.addEventListener("click", (event) => {
            event.preventDefault();

            const currentlyArial =
                document.documentElement.classList.contains("accessible-font");

            applyFont(!currentlyArial);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initFontSwitcher
        );
    } else {
        initFontSwitcher();
    }
})();
