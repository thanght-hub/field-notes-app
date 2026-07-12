const THEME_STORAGE_KEY = "field-notes-theme";

// Script chặn-render (inline, không phải component client) để set class `dark` trên <html>
// TRƯỚC khi React hydrate — tránh nháy sáng/tối (FOUC) khi người dùng đã chọn theme thủ công.
const INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isDark = stored ? stored === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;

export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />;
}
