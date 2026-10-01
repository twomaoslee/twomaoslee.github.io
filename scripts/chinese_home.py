"""Route the public entry to Chinese without moving English content URLs.

Run after Hugo: python3 scripts/chinese_home.py public https://zimin.li/
Remove the workflow step and rebuild to restore the original homepage.
"""

import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit, urlunsplit
import xml.etree.ElementTree as ET


def home_link(value, base):
    target = urlsplit(value)
    origin = urlsplit(base)
    if target.netloc and target.netloc != origin.netloc:
        return value
    if target.scheme and target.scheme not in ("http", "https"):
        return value
    if target.path != origin.path:
        return value
    return urlunsplit(target._replace(path=origin.path + "en/"))


class HomeLinks(HTMLParser):
    def __init__(self, source, base):
        super().__init__(convert_charrefs=False)
        self.source, self.base, self.edits = source, base, []
        self.lines = source.splitlines(keepends=True)
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        key = "href" if tag in ("a", "link") else None
        if tag == "meta" and attrs.get("property") == "og:url":
            key = "content"
        if not key or not attrs.get(key):
            return
        old = attrs[key]
        new = home_link(old, self.base)
        if old == new:
            return
        # Parse tags structurally, then change only this attribute's source span.
        raw = self.get_starttag_text()
        pattern = r"(\s" + key + r"\s*=\s*)(?:\"[^\"]*\"|'[^']*'|[^\s>]+)"
        replacement = re.sub(pattern, lambda m: m[1] + '"' + html.escape(new, quote=True) + '"', raw, count=1, flags=re.I)
        line, column = self.getpos()
        offset = sum(map(len, self.lines[:line - 1])) + column
        self.edits.append((offset, offset + len(raw), replacement))

    handle_startendtag = handle_starttag

    def result(self):
        result = self.source
        for start, end, value in reversed(self.edits):
            result = result[:start] + value + result[end:]
        return result


class HomeAlias(HTMLParser):
    def __init__(self, source, base):
        super().__init__()
        self.base, self.canonical, self.refresh = base, False, False
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs.get("href") == self.base
        if tag == "meta" and attrs.get("http-equiv", "").lower() == "refresh":
            self.refresh = attrs.get("content", "").replace(" ", "") == "0;url=" + self.base


def apply(public, base):
    public = Path(public)
    base = base.rstrip("/") + "/"
    root = public / "index.html"
    english = public / "en/index.html"
    if not root.is_file() or not (public / "zh/index.html").is_file():
        raise ValueError("Build both existing language homepages before routing")
    if english.exists():
        alias = HomeAlias(english.read_text(encoding="utf-8"), base)
        if not (alias.canonical and alias.refresh):
            raise ValueError("Unexpected /en/ page: refusing to overwrite it")
    english.parent.mkdir(exist_ok=True)
    root.rename(english)
    for path in public.rglob("*.html"):
        if path.relative_to(public).parts[0] == "slides":
            continue
        source = path.read_text(encoding="utf-8")
        changed = HomeLinks(source, base).result()
        if source != changed:
            path.write_text(changed, encoding="utf-8")
    # Keep only the new English homepage URL in the generated sitemap.
    for path in public.rglob("sitemap.xml"):
        tree = ET.parse(path)
        changed = False
        for element in tree.iter():
            if element.tag.endswith("}loc") and element.text == base:
                element.text = base + "en/"
                changed = True
            if "href" in element.attrib:
                old = element.attrib["href"]
                element.attrib["href"] = home_link(old, base)
                changed = changed or old != element.attrib["href"]
        if changed:
            tree.write(path, encoding="utf-8", xml_declaration=True)
    chinese = urlsplit(base).path + "zh/"
    root.write_text('<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8">'
                    '<title>李梓民</title><link rel="canonical" href="' + base + 'zh/">'
                    '<script>location.replace(' + json.dumps(chinese) + '+location.search+location.hash);</script>'
                    '<meta http-equiv="refresh" content="0;url=' + chinese + '"></head>'
                    '<body><a href="' + chinese + '">进入中文主页</a> · '
                    '<a href="' + urlsplit(base).path + 'en/">English</a></body></html>', encoding="utf-8")


if __name__ == "__main__":
    apply(sys.argv[1], sys.argv[2])
