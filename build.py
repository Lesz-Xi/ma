"""Builds Ma: the edition page (src/edition.html) with our layer on top: the koi pond,
grass and stones in the hero, the flower as the mark, the vessels' water handoff, the coda,
the Capillary arrival, and reading that holds still under the pointer. Writes index.html,
one self-contained page. Run: python3 build.py
Flags on the page: ?pond-water=0 · ?pond-art=drawn · ?vessel-water=stillpoint · ?coda-sound=koto
"""
from pathlib import Path
import re
P=Path(__file__).resolve().parent
src=(P/'src/edition.html').read_text()
css=(P/'src/pond.css').read_text()+(P/'src/vessels-motion.css').read_text()+(P/'src/coda.css').read_text()
js=(P/'src/pond.js').read_text().replace('</script','<\\/script')
# Vessels: one vessel becomes the next through the page's own water handoff.
vjs=(P/'src/vessels-motion.js').read_text().replace('</script','<\\/script')
# The coda: 間 above one still line, after About and before the footer.
cjs=(P/'src/coda.js').read_text().replace('</script','<\\/script')
label='Pampas grass rising from a ring of pale stones, with two koi swimming beneath: one black, one white with red markings and red lips.'

# The voice (chosen 19 October): plain
# words, nature stated rather than decorated, no luck claimed as fact, impermanence
# welcomed, and nothing promised the page does not do.
TITLE='You were nature<br>before you<br>had a name.'
SUB='The stone keeps still. The grass bends, and returns. Two koi swim on: one toward its work, one toward what it loves. So\u00a0do\u00a0you.'  # the closing turn never splits
# The botanical concept is credited to XI (Chief, 20 October, after Rhine on 19 October):
# the caption and the description say so, as the footer (design) and About (digital concept) do.
CAPTION='A botanical concept by\u00a0XI'  # the name never sits alone on its line
# The description keeps the concept disclosure and says what the hero shows.
DESCRIPTION='Ma, a botanical concept by XI. The stone keeps still, the grass bends and returns, and two koi swim on: one toward its work, one toward what it loves.'

# 1. The study leaves the hero; its box stays so the caption keeps its place.
fig=re.search(r'(<figure class="ch01-specimen">)\s*<img\b[^>]*\bsrc="([^"]+)"[^>]*>',src)
if not fig:raise SystemExit('Arrival study not found')
doc=src[:fig.start()]+fig[1]+src[fig.end():]
# The mark is the same study trimmed to its drawn edges (src/ma-mark-flower.webp, 105×216).
import base64
flower='data:image/webp;base64,'+base64.b64encode((P/'src/ma-mark-flower.webp').read_bytes()).decode()

# 2. The flower becomes the mark, left of Ma; 間 retires from the header.
mark='<span lang="ja">間</span>'
if doc.count(mark)!=1:raise SystemExit('Header mark not found once')
doc=doc.replace(mark,'<img class="ma-mark-flower" src="'+flower+'" width="26" height="54" alt="">')

# 3. The pond canvas opens the hero. The flag runs before the shared wake registers.
canvas=('<canvas class="ch01-pond" role="img" aria-label="'+label+'" data-water-artwork></canvas>'
        '<script>/[?&]pond-water=0\\b/.test(location.search)&&document.currentScript.previousElementSibling.removeAttribute("data-water-artwork")</script>')
doc,n=re.subn(r'(<div class="ch01-hero">)',lambda m:m[1]+canvas,doc,count=1)
if n!=1:raise SystemExit('Arrival hero not found')

# 4. Arrival speaks in the new voice. It carries no action of its own (Chief, 19 October:
# "Make room" removed); Composition stays one step away in the header.
for old,new in [('>The space<br>between is the<br>arrangement.</h1>','>'+TITLE+'</h1>'),
                ('>A stem, a leaf, a pause between them. Ma explores what becomes visible when we leave room.</p>','>'+SUB+'</p>'),
                ('data-water-reading>A botanical concept by XI</figcaption>','data-water-reading>'+CAPTION+'</figcaption>')]:
    if doc.count(old)!=1:raise SystemExit('Arrival copy not found: '+old[:40])
    doc=doc.replace(old,new)
# The page's description and its share card speak the same voice. The title, "Ma — the
# space between", is the name and its meaning, and still the invitation (Make room).
old_intro='Ma is a botanical concept by XI. Remove one stem, watch the water answer, and discover the space between.'
if doc.count('content="'+old_intro+'"')!=2:raise SystemExit('Description and og:description not found')
doc=doc.replace('content="'+old_intro+'"','content="'+DESCRIPTION+'"')
# 5. The coda closes the page: 間 (retired from the header) comes to rest above one line,
# the water's surface. The caption is the only text; the character is its picture.
CODA=('<section class="ma-ch ma-coda" id="ma-coda" aria-labelledby="ma-coda-caption">'
      '<div class="ma-coda-inner">'
      '<div class="ma-coda-mark" lang="ja" aria-hidden="true">間</div>'
      '<svg class="ma-coda-line" viewBox="0 0 1000 96" preserveAspectRatio="none" aria-hidden="true" focusable="false">'
      '<path vector-effect="non-scaling-stroke" d="M0 48 L1000 48"/></svg>'
      '<p class="ma-coda-caption" id="ma-coda-caption" data-water-reading>ma, the space between</p>'
      # Sound waits for its script and is on by default (coda.js: a suikinkutsu in hirajōshi).
      # Its mark is a fūrin, the wind bell, in hairline: still when off, its strip lifted when on.
      '<button type="button" class="ma-coda-sound" aria-pressed="true" aria-label="Sound" title="Sound on" hidden>'
      # An Edo glass fūrin: a round bulb with a narrower open mouth, hung by its cord. Inside,
      # the clapper hangs free, and its cord runs on past the mouth to the tanzaku (paper strip).
      '<svg class="ma-coda-furin" viewBox="2 0 12 34" aria-hidden="true" focusable="false">'
      '<path vector-effect="non-scaling-stroke" d="M8 .5V3"/>'
      '<path vector-effect="non-scaling-stroke" d="M4.85 13A5.5 5.5 0 1 1 11.15 13"/>'
      '<g class="ma-coda-furin-strip"><path vector-effect="non-scaling-stroke" d="M8 6V18"/>'
      '<rect vector-effect="non-scaling-stroke" x="6.2" y="18" width="3.6" height="14.5"/></g></svg></button>'
      # As the section arrives, a few handwritten words under the bell say what it does, then fade.
      '<div class="ma-coda-hint" aria-hidden="true" hidden><span>the bell turns</span> <span>the sound off</span></div>'
      '</div></section>')
if doc.count('</main>')!=1:raise SystemExit('Main close not found once')
doc=doc.replace('</main>',CODA+'</main>')
hero_cta=re.search(r'\s*<a data-waterline="original" class="ma-cta" href="#ch03">.*?</a>',doc,re.S)
if not hero_cta or 'Examine the composition' not in hero_cta[0]:raise SystemExit('Arrival action not found')
doc=doc[:hero_cta.start()]+doc[hero_cta.end():]
# 6. The arrival (Chief, 20 October). The flower opens alone (a stem and leaf were tried the
# same day and removed at Chief's request).
# The water opens as Capillary, not First Drop: a thread gathers down the stem's line, then
# parts into a curved seam (new_assets/ma_water_entries.md, 2.7s). The 1s hold for the flower stays.
for old,new in [("/* Ma's one-shot bloom → hold → First Drop. Shared XI Lab reveal, local 1s hold. */",
                 "/* Ma's one-shot bloom → hold → Capillary. Shared XI Lab reveal, local 1s hold. */"),
                ("// Shift the reveal and fade together; First Drop itself still takes 2.4s.",
                 "// Shift the reveal and fade together; Capillary itself still takes 2.7s."),
                ("revealDuration = engine.specs.drop.duration","revealDuration = engine.specs.capillary.duration"),
                ("engine.geometry('drop', progress, width, height)","engine.geometry('capillary', progress, width, height)")]:
    if doc.count(old)!=1:raise SystemExit('Arrival script not found: '+old[:48])
    doc=doc.replace(old,new)
# 7. Reading holds still under the pointer (Chief, 24 October: hovering "not too smooth").
# The wake refracted every heading and paragraph it crossed, re-rasterising that text each
# frame (Chrome trace, 4s over the hero at 2x: raster 45-49ms with it, 1ms without), and the
# Reed cursor, drawn by the page, waited on it. The water stays in the artwork (the pond, the
# images); a click still ripples anywhere on the page.
if doc.count('"textHover":true')!=1:raise SystemExit('Edition text hover not found once')
doc=doc.replace('"textHover":true','"textHover":false')
doc=doc.replace('</head>','<style>'+css+'</style></head>',1)
doc=re.sub(r'<title>[^<]*</title>','<title>Ma — the space between</title>',doc,count=1)
idx=doc.rfind('</body>')
doc=doc[:idx]+'<script>'+js+'</script><script>'+vjs+'</script><script>'+cjs+'</script>'+doc[idx:]
out=P/'index.html';out.write_text(doc)
print(out)
