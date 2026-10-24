/* Public Ma chapter disclosure. Native links retain MA's existing navigation owner. */
(function () {
  'use strict';
  var MA=window.MA,header=document.getElementById('ma-header');
  if(!MA||!header)return;
  var toggle=header.querySelector('.ma-chapters-toggle'),nav=document.getElementById('ma-chapter-nav');
  if(!toggle||!nav)return;
  if(MA.mobileChapters)MA.mobileChapters.dispose();
  var mobile=matchMedia('(max-width:600px)'),open=false,dead=false,clean=[],focusTargets=[],focusOwner=null;
  var icon=toggle.querySelector('path'),rest=icon&&icon.getAttribute('d');
  function listen(el,type,fn){el.addEventListener(type,fn);clean.push(function(){el.removeEventListener(type,fn);});}
  function revealHeader(){header.removeAttribute('data-scroll-hidden');}
  function setOpen(next,returnFocus){
    if(dead)return;
    open=!!next&&mobile.matches;
    toggle.setAttribute('aria-expanded',String(open));
    nav.hidden=mobile.matches&&!open;
    header.toggleAttribute('data-chapters-open',open);
    if(icon)icon.setAttribute('d',open?'M4 4l12 12M16 4L4 16':rest);
    if(open||returnFocus)revealHeader();
    if(returnFocus&&mobile.matches&&!toggle.hidden)toggle.focus({preventScroll:true});
  }
  function mode(){
    if(dead)return;
    var focused=document.activeElement;
    // CSS can hide/blur a control before the breakpoint change event is delivered.
    var wasToggle=focused===toggle||(focused===document.body&&focusOwner==='toggle');
    var wasLink=nav.contains(focused)||(focused===document.body&&focusOwner==='nav');
    toggle.hidden=!mobile.matches;
    setOpen(false,mobile.matches&&wasLink);
    // Never leave focus on a control that has just become hidden at a breakpoint.
    if(!mobile.matches&&wasToggle){var link=nav.querySelector('a');if(link)link.focus({preventScroll:true});}
    revealHeader();MA.scroll.refresh();
  }
  listen(toggle,'click',function(){setOpen(!open,false);});
  listen(nav,'click',function(event){
    var link=event.target.closest&&event.target.closest('a[href]');
    if(!open||!link||!nav.contains(link)||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
    // This runs before the document's existing chapter-navigation handler. Do not
    // prevent default, stop propagation or introduce a competing hash/scroll path.
    // Keep this destination focusable after the incumbent navigator commits.
    // Its temporary tabindex cleanup otherwise drops focus back to the body.
    var href=link.getAttribute('href'),target=href&&href.charAt(0)==='#'&&document.getElementById(href.slice(1));
    if(target&&target.matches('.ma-ch')&&!target.hasAttribute('tabindex')){target.setAttribute('tabindex','-1');focusTargets.push(target);}
    setOpen(false,true);
  });
  listen(document,'keydown',function(event){if(open&&event.key==='Escape'){event.preventDefault();setOpen(false,true);}});
  listen(document,'focusin',function(event){focusOwner=event.target===toggle?'toggle':nav.contains(event.target)?'nav':null;});
  listen(document,'pointerdown',function(event){if(!header.contains(event.target)){focusOwner=null;if(open)setOpen(false,nav.contains(document.activeElement));}});
  listen(header,'focusout',function(event){if(open&&event.relatedTarget&&!header.contains(event.relatedTarget))setOpen(false,false);});
  listen(mobile,'change',mode);
  listen(window,'pageshow',function(){mode();});
  listen(document,'visibilitychange',function(){if(document.hidden)setOpen(false,false);});
  function dispose(){
    if(dead)return;setOpen(false,false);dead=true;clean.forEach(function(off){off();});
    var focused=toggle===document.activeElement;
    header.removeAttribute('data-chapters-ready');header.removeAttribute('data-chapters-open');
    nav.hidden=false;toggle.hidden=true;toggle.setAttribute('aria-expanded','false');if(icon)icon.setAttribute('d',rest);
    focusTargets.forEach(function(target){if(target.getAttribute('tabindex')==='-1')target.removeAttribute('tabindex');});
    if(focused){var link=nav.querySelector('a');if(link)link.focus({preventScroll:true});}
    revealHeader();MA.scroll.refresh();
  }
  listen(window,'pagehide',function(event){if(event.persisted)setOpen(false,false);else dispose();});
  MA.mobileChapters={dispose:dispose,stats:function(){return{mobile:mobile.matches,open:open,disposed:dead};}};
  // Progressive enhancement: until this point the native four-link nav is visible.
  header.setAttribute('data-chapters-ready','');mode();
})();
