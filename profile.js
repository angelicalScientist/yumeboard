// ======================================
// PROFILE.JS
// Loads the currently logged-in user's profile
// ======================================

(() => {
    "use strict";

    const client = window.supabaseClient;

    if (!client) {
        console.error(
            "Profile: Supabase client not found."
        );
        return;
    }

    async function loadProfile() {

        // ======================================
        // GET CURRENT USER
        // ======================================

        const {
            data: { user },
            error: userError
        } = await client.auth.getUser();

        if (userError) {
            console.error(
                "Profile: could not get current user:",
                userError
            );
            return;
        }

        if (!user) {
            console.warn(
                "Profile: no logged-in user."
            );
            window.location.href = "account.html";
            return;
        }

        console.log(
            "Profile: logged-in user:",
            user.id
        );

        // ======================================
        // LOAD OWN PROFILE
        // ======================================

        const {
            data: profile,
            error: profileError
        } = await client
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error(
                "Profile: database error:",
                profileError
            );
            return;
        }

        if (!profile) {
            console.warn(
                "Profile: no profile row found for:",
                user.id
            );
            return;
        }

        console.log(
            "Profile data loaded:",
            profile
        );

        // ======================================
        // NAME
        // ======================================

        const profileName =
            document.getElementById(
                "profileName"
            );

        if (profileName) {
            profileName.textContent =
                profile.display_name ||
                profile.username ||
                "Unnamed user";
        }

        const profileDisplayName =
            document.getElementById(
                "profileDisplayName"
            );

        if (profileDisplayName) {
            profileDisplayName.textContent =
                profile.display_name ||
                profile.username ||
                "";
        }

        // ======================================
        // BIO
        // ======================================

        const profileBio =
            document.getElementById(
                "profileBio"
            );

        if (profileBio) {
            profileBio.textContent =
                profile.bio || "";
        }

        // ======================================
        // ABOUT
        // ======================================

        const profileAbout =
            document.getElementById(
                "profileAbout"
            );

        if (profileAbout) {
            profileAbout.textContent =
                profile.about || "";
        }

        // ======================================
        // FANDOMS
        // ======================================

        const profileFandoms =
            document.getElementById(
                "profileFandoms"
            );

        if (profileFandoms) {

            const {
                data: fandomRows,
                error: fandomError
            } = await client
                .from("profile_fandoms")
                .select(`
                    fandom_id,
                    fandoms (
                        id,
                        name
                    )
                `)
                .eq(
                    "profile_id",
                    profile.id
                );

            if (fandomError) {
                console.error(
                    "Profile: could not load fandoms:",
                    fandomError
                );

                profileFandoms.textContent = "";
            } else {

                const fandomNames =
                    (fandomRows || [])
                        .map(row =>
                            row.fandoms?.name
                        )
                        .filter(Boolean);

                profileFandoms.textContent =
                    fandomNames.join(", ");
            }
        }

        // ======================================
        // MOOD
        // ======================================

        const currentMood =
            profile.mood || "🌸 happy!";

        const mood =
            document.getElementById("mood");

        const profileMood =
            document.getElementById(
                "profileMood"
            );

        if (mood) {
            mood.textContent = currentMood;
        }

        if (profileMood) {
            profileMood.textContent = currentMood;
        }

        // ======================================
        // AVATAR
        // ======================================

        const avatar =
            document.getElementById(
                "profileAvatar"
            );

        if (avatar) {

            if (profile.avatar_url) {
                avatar.src =
                    profile.avatar_url;
            }

            avatar.alt =
                `${
                    profile.display_name ||
                    profile.username ||
                    "User"
                }'s avatar`;
        }

        // ======================================
        // BANNER
        // ======================================

        const banner =
            document.getElementById(
                "profileBanner"
            );

        if (banner) {

            if (profile.banner_url) {

                banner.style.backgroundImage =
                    `url("${profile.banner_url}")`;

                banner.classList.add(
                    "has-profile-banner"
                );

            } else {

                banner.style.backgroundImage =
                    "";

                banner.classList.remove(
                    "has-profile-banner"
                );
            }
        }

        // ======================================
        // F/Os
        // ======================================

        if (
            typeof window.loadFos ===
            "function"
        ) {
            await window.loadFos(
                profile.id
            );
        }

        console.log(
            "Profile: finished loading own profile."
        );
    }

    loadProfile();
})();