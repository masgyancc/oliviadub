// Shared by the root layout (server) and the theme hook (client), so no "use client".

export const THEME_STORAGE_KEY = "brewcc-theme";

// runs inline in <head> before first paint, so there's no light flash on load
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();`;
