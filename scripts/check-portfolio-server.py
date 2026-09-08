"""Check the running portfolio's HTTP routes/assets; this does not exercise a browser."""

import sys
from html.parser import HTMLParser
from urllib.request import urlopen, build_opener, ProxyHandler
from urllib.error import HTTPError
from urllib.parse import urljoin, urlparse

origin = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
paths = [
    "/",
    "/project/downright",
    "/project/monkeyclaw",
    "/project/etch",
    "/project/flowe",
    "/project/velox",
    "/project/argyph",
    "/project/nexarad",
    "/project/mathpilot",
    "/resume",
]
assets = set()
pages = {}
if urlparse(origin).hostname in {"127.0.0.1", "localhost"}:
    urlopen = build_opener(ProxyHandler({})).open


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.headings = 0
        self.ids = set()
        self.anchors = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        self.headings += tag == "h1"
        if "id" in attrs:
            self.ids.add(attrs["id"])
        href = attrs.get("href", "")
        if tag == "a" and href.startswith(("#", "/")) and urlparse(href).fragment:
            self.anchors.append(href)
        if tag == "img":
            assert "alt" in attrs, "Image has no alt attribute"
            if attrs.get("src", "").startswith("/"):
                assets.add(attrs["src"])
        if tag == "script" and attrs.get("src", "").startswith("/"):
            assets.add(attrs["src"])


for path in paths:
    with urlopen(urljoin(origin, path), timeout=15) as response:
        assert response.status == 200, path
        assert "text/html" in response.headers.get("Content-Type", ""), path
        page = Page()
        page.feed(response.read().decode())
        assert page.headings == 1, (path, "Expected one main heading", page.headings)
        pages[path] = page

# Return-to-project links cross route boundaries. Validate the destination IDs
# against rendered HTML, including the fallback pages and supporting work.
for path, page in pages.items():
    for href in page.anchors:
        target = urlparse(urljoin(urljoin(origin, path), href))
        assert target.path in pages, (path, "Unknown anchor route", href)
        assert target.fragment in pages[target.path].ids, (
            path, "Broken destination anchor", href,
        )

assets.update(
    [
        "/assets/hero/playground-glyphs.glb",
        "/assets/hero/silver-studio.hdr",
        "/assets/hero/playground-title.webp",
        "/resume.pdf",
        "/projects/downright/editor-demo.mp4",
    ]
)
for path in sorted(assets):
    target = urljoin(origin, path)
    assert urlparse(target).netloc == urlparse(origin).netloc
    with urlopen(target, timeout=30) as response:
        assert response.status == 200, path
        assert len(response.read()) > 0, path
try:
    urlopen(urljoin(origin, "/project/this-project-does-not-exist"), timeout=15)
except HTTPError as error:
    assert error.code == 404
else:
    raise AssertionError("Unknown project must return 404")
print(
    f"PASS {len(paths)} routes, local and return-to-project anchors, {len(assets)} image/script/download assets, and unknown-project 404. HTTP only; no visual or interaction claims."
)
