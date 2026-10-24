"""Builds dist/ma.html: index.html with every stylesheet, script, image and font inlined,
one self-contained page (the file served at odysxi.com/ma). Run: python3 build.py

index.html stays the readable, working source. In it, consecutive tags that share a
data-bundle name become one inline block: stylesheets joined as CSS_JOIN says, scripts by
"\\n;\\n" (boot.js closes the edition's script directly). Images and fonts under assets/
become data URIs, wherever a src or href names them.
"""
import base64, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MIME = {'.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf'}
# How each bundle's stylesheets are joined: the edition's by a newline, our layer's directly.
CSS_JOIN = {'edition': '\n', 'layer': ''}

def data_uri(rel):
    path = ROOT / rel
    return 'data:' + MIME[path.suffix] + ';base64,' + base64.b64encode(path.read_bytes()).decode()

def inline_css(rel):
    text = (ROOT / rel).read_text()
    return re.sub(r'url\("\.\./(assets/[^"]+)"\)', lambda m: 'url("' + data_uri(m[1]) + '")', text)

def bundle(html):
    def styles(m):
        run = re.findall(r'href="([^"]+)" data-bundle="([\w-]+)"', m[0])
        return '<style>' + CSS_JOIN[run[0][1]].join(inline_css(f) for f, _ in run) + '</style>'
    def scripts(m):
        out = ''
        for i, (f, _) in enumerate(re.findall(r'src="([^"]+)" data-bundle="([\w-]+)"', m[0])):
            text = (ROOT / f).read_text()
            out += text if i == 0 or f.endswith('/boot.js') else '\n;\n' + text
        return '<script>' + out + '</script>'
    # A run is the tags of one bundle, with only whitespace between them.
    html = re.sub(r'(?:<link rel="stylesheet" href="[^"]+" data-bundle="([\w-]+)">)(?:\s*<link rel="stylesheet" href="[^"]+" data-bundle="\1">)*',
                  styles, html)
    html = re.sub(r'(?:<script src="[^"]+" data-bundle="([\w-]+)"></script>)(?:\s*<script src="[^"]+" data-bundle="\1"></script>)*',
                  scripts, html)
    return re.sub(r'(src|href)="(assets/[^"]+)"', lambda m: m[1] + '="' + data_uri(m[2]) + '"', html)

if __name__ == '__main__':
    out = ROOT / 'dist/ma.html'
    out.parent.mkdir(exist_ok=True)
    out.write_text(bundle((ROOT / 'index.html').read_text()))
    print(out)
