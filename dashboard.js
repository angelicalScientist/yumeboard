const welcomeMessage =
    document.getElementById("welcomeMessage");

const dashboardUsername =
    document.getElementById("dashboardUsername");

const profileButton =
    document.getElementById("profileButton");

const editButton =
    document.getElementById("editButton");

const homeButton =
    document.getElementById("homeButton");

const logoutButton =
    document.getElementById("logoutButton");


// ==============================
// LOAD CURRENT USER
// ==============================

async function loadDashboard() {

    const {
        data,
        error
    } = await supabaseClient.auth.getSession();


    if (error) {

        console.error(error);

        return;

    }


    if (!data.session) {

        window.location.href =
            "account.html";

        return;

    }


    const user =
        data.session.user;


    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();


    if (profileError) {

        console.error(profileError);

        welcomeMessage.textContent =
            "♡ Welcome! ♡";

        dashboardUsername.textContent =
            user.email;

        return;

    }


    const displayName =
        profile.display_name ||
        profile.username ||
        "Friend";


    welcomeMessage.textContent =
        `♡ Welcome back, ${displayName}! ♡`;


    dashboardUsername.textContent =
        `Logged in as @${profile.username}`;

}


// ==============================
// BUTTONS
// ==============================

profileButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "indexter.html";

    }
);


editButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "edit-profile.html";

    }
);


homeButton.addEventListener(
    "click",
    function () {

        window.location.href =
            "indexter.html";

    }
);


logoutButton.addEventListener(
    "click",
    async function () {

        const {
            error
        } = await supabaseClient.auth.signOut();


        if (error) {

            console.error(error);

            return;

        }


        window.location.href =
            "account.html";

    }
);


// ==============================
// START
// ==============================

loadDashboard();