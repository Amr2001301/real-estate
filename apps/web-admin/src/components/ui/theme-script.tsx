/**
 * Inlined before any render to apply the stored theme class without flash.
 * Must be a server component placed as the first child of <head>.
 *
 * Paper is always light: the print pages (/print/…) never take the dark
 * theme, and any other page drops it while the browser prints (Ctrl+P), then
 * gets it back.
 */
export function ThemeScript() {
  const script = `(function(){try{var d=document.documentElement;var paper=location.pathname.indexOf('/print/')===0;if(!paper&&localStorage.getItem('admin-theme')==='dark')d.classList.add('dark');var was=false;window.addEventListener('beforeprint',function(){was=d.classList.contains('dark');d.classList.remove('dark');});window.addEventListener('afterprint',function(){if(was)d.classList.add('dark');});}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
