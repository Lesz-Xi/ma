# Ma

*The space between.* A botanical concept by XI, live at [odysxi.com/ma](https://www.odysxi.com/ma/).

Ma is one quiet page about removal and distance, made of paper, water and stone.

- **Arrival.** A paper flower opens, then the page parts along a single thread.
- **Hero.** Two washi koi swim beneath pampas grass and a ring of stones. Haste scatters them; stillness brings one near.
- **Vessels.** One vessel becomes the next through a rising waterline.
- **Close.** 間 rests above one hairline that you can pluck. It rings as water in a suikinkutsu, tuned to hirajōshi; a hairline wind bell turns the sound off.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page, self-contained: open it in a browser, or serve it as is. |
| `build.py` | Rebuilds `index.html` from `src/`. |
| `src/edition.html` | The edition the layer builds on: chapters, type, water, header and footer. |
| `src/pond.js`, `pond.css` | The hero: koi, grass and stones on one canvas, in washi. |
| `src/vessels-motion.js`, `.css` | The vessels' water handoff between forms. |
| `src/coda.js`, `.css` | The close: the line, its string and the sound. |
| `src/ma-mark-flower.webp` | The flower that is the mark, left of "Ma". |
| `licenses/` | Licences for the fonts and the library the page embeds. |

## Build

```sh
python3 build.py
```

This needs Python 3 and nothing else: no packages and no network. The output is `index.html`, one file with every image, font and script inlined.

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
- **Everything else.** The page, its images, its words and its code are XI's. No licence is granted for them.
