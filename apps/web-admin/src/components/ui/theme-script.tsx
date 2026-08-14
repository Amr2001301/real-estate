/**
 * Inlined before any render to apply the stored theme class without flash.
 * Must be a server component placed as the first child of <head>.
 */
export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem('admin-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
