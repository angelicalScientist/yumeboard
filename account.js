const signupButton =
    document.getElementById("signupButton");

const loginButton =
    document.getElementById("loginButton");

const accountMessage =
    document.getElementById("accountMessage");


// ==============================
// CREATE ACCOUNT
// ==============================

signupButton.addEventListener(
    "click",
    async function () {

        const email =
            document
                .getElementById("signupEmail")
                .value
                .trim();

        const password =
            document
                .getElementById("signupPassword")
                .value;

        const username =
            document
                .getElementById("signupUsername")
                .value
                .trim();


        if (
            email === "" ||
            password === "" ||
            username === ""
        ) {

            accountMessage.textContent =
                "Please fill everything in! ♡";

            return;
        }


        accountMessage.textContent =
            "Creating your account... 🌸";


        const { data, error } =
            await supabaseClient.auth.signUp({

                email: email,

                password: password,

                options: {

                    emailRedirectTo:
                     "http://127.0.0.1:5500/dashboard.html",
                    data: {
                        username: username,
                        display_name: username
                    }

                }

            });


        if (error) {

            console.error(error);

            accountMessage.textContent =
                error.message;

            return;
        }


        if (data.session) {

            accountMessage.textContent =
                `Welcome, ${username}! ♡`;

        } else {

            accountMessage.textContent =
                "Account created! Check your email to finish setting things up!";

        }

    }
);


// ==============================
// LOG IN
// ==============================

loginButton.addEventListener(
    "click",
    async function (event) {

        event.preventDefault();
        
        const email =
            document
                .getElementById("loginEmail")
                .value
                .trim();

        const password =
            document
                .getElementById("loginPassword")
                .value;


        if (
            email === "" ||
            password === ""
        ) {

            accountMessage.textContent =
                "Please enter your email and password! ♡";

            return;
        }


        accountMessage.textContent =
            "Entering the yumeboard... 🌸";


        const { data, error } =
            await supabaseClient.auth
                .signInWithPassword({

                    email: email,

                    password: password

                });


        if (error) {

            console.error(error);

            accountMessage.textContent =
                error.message;

            return;
        }


        accountMessage.textContent =
            "Logged in! Welcome back!We missed you! ♡";
        window.location.href = "dashboard.html";      
          
        console.log(
            "Logged in user:",
            data.user
        );

    }
);

async function checkSession() {
    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error) {
        console.error(error);
        accountMessage.textContent = error.message;
        return;
    }

    if (data.session) {
        accountMessage.textContent =
            "♡ You're already logged in! Taking you to your dashboard... ♡";

        window.location.href = "dashboard.html";
        return;
    }

    // No session = stay on the account page
    accountMessage.textContent =
        "♡ Please log in or create an account! ♡";
}

checkSession();
