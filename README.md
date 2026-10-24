# Ma

*The space between.* A botanical concept by XI, live at [odysxi.com/ma](https://www.odysxi.com/ma/).

Ma is one quiet page about removal and distance, made of paper, water and stone.

- **Arrival.** A paper flower opens, then the page parts along a single thread.
- **Hero.** Two washi koi swim beneath pampas grass and a ring of stones. Haste scatters them; stillness brings one near.
- **Vessels.** One vessel becomes the next through a rising waterline.
- **Close.** 間 rests above one hairline that you can pluck. It rings as water in a suikinkutsu, tuned to hirajōshi; a hairline wind bell turns the sound off.

It is plain HTML, CSS and JavaScript, with no framework and no build step to run it.

## Run it

```sh
python3 -m http.server
```

Then open http://localhost:8000. It needs a server rather than `file://`, because browsers won't load fonts from local files.

## Build the single file

```sh
python3 build.py
```

This writes `dist/ma.html`, the same page with every stylesheet, script, image and font inlined into one file. It is the file served at odysxi.com/ma, byte for byte. It needs Python 3 and nothing else.

## Where things are

| Path | What it is |
|---|---|
| `index.html` | The page: its markup, and the stylesheets and scripts it loads in order. |
| `js/shell.js` | The runtime the rest shares: one frame clock, pointer, scroll, reduced motion, chapters. |
| `js/pond.js` · `css/pond.css` | The hero: koi, grass and stones on one canvas, in washi. |
| `js/coda.js` · `css/coda.css` | The close: the line, its damped string, and the synthesized sound. |
| `js/vessels-motion.js` · `css/vessels-motion.css` | The vessels' water handoff between forms. |
| `js/water/` | The water engines: arrivals, transitions, sections, text and hover. |
| `js/page-water.js` | The wake behind the pointer and the ripple of a click, refracting the images. |
| `js/entry-water.js` | The arrival: the flower's bloom, then the Capillary opening. |
| `js/chapters/` · `css/chapters/` | Each chapter's own behaviour and styles. |
| `js/edition-config.js` | The edition's settings: chapters, durations, what the water touches. |
| `js/vendor/` | Lenis 1.3.4, for the scroll's weight. |
| `css/fonts.css` · `css/tokens.css` | The faces and the design tokens. |
| `assets/images/` · `assets/fonts/` | The images of each chapter, the flower mark and the fonts. |
| `licenses/` | Licences for the fonts and Lenis. |

## On the page

- **Motion.** Every motion runs on one frame clock and stops when it's off screen. Reduced motion shows the same page still.
- **Sound.** It is synthesized, with no samples, and wakes on the first click, tap or key. Turning it off is remembered on the device.
- **Flags for comparison:** `?pond-art=drawn` (the earlier drawn koi), `?pond-water=0`, `?vessel-water=stillpoint` and `?coda-sound=koto` (a plucked koto string in place of the water).
- **Search engines.** The page is `noindex`.

## Credits and licences

- **Fonts and library.** The fonts are under the SIL Open Font License, and Lenis under MIT. Their licence texts are in `licenses/`:
  - Newsreader
  - Noto Serif JP
  - Waiting for the Sunrise
- **The coda's gesture.** It is after Annnimate's Elastic Divider: the gesture only, with code of our own.
- **The code** (HTML, CSS, JavaScript and `build.py`) is under the MIT License: see `LICENSE`. Use it as a template, change it, ship it.
- **The images and the words** stay XI's and are not covered by that licence: replace them with your own.
