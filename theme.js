// ======================================
// YUMEBOARD THEME
// ======================================

(() => {
    "use strict";

    function applySavedTheme() {
        const savedTheme = localStorage.getItem("theme");

        if (savedTheme === "dark") {
            document.documentElement.classList.add("dark-mode");
            document.body?.classList.add("dark-mode");
        } else {
            document.documentElement.classList.remove("dark-mode");
            document.body?.classList.remove("dark-mode");
        }
    }

    function updateThemeButton() {
        const themeButton =
            document.getElementById("themeButton");

        if (!themeButton) {
            return;
        }

        if (
            document.documentElement.classList.contains(
                "dark-mode"
            )
        ) {
            themeButton.textContent = "🌸 Light mode";
        } else {
            themeButton.textContent = "🌙 Dark mode";
        }
    }

    function toggleTheme() {
        const isDark =
            !document.documentElement.classList.contains(
                "dark-mode"
            );

        if (isDark) {
            document.documentElement.classList.add(
                "dark-mode"
            );
            document.body?.classList.add("dark-mode");

            localStorage.setItem("theme", "dark");
        } else {
            document.documentElement.classList.remove(
                "dark-mode"
            );
            document.body?.classList.remove("dark-mode");

            localStorage.setItem("theme", "light");
        }

        updateThemeButton();
    }

    applySavedTheme();

    document.addEventListener(
        "DOMContentLoaded",
        () => {
            applySavedTheme();
            updateThemeButton();

            const themeButton =
                document.getElementById("themeButton");

            if (themeButton) {
                themeButton.addEventListener(
                    "click",
                    toggleTheme
                );
            }
        }
    );
})();