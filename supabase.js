const SUPABASE_URL =
    "https://hnwsigmcirzicamlwyrz.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_Z02g9b8U_Su8nXY290sJFw_WtEjgGir";

if (
    typeof window.supabase === "undefined"
) {
    console.error(
        "Supabase library was not loaded before supabase.js."
    );
} else {
    window.supabaseClient =
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY
        );
}