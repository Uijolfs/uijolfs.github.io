from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids, self.links, self.h1 = [], [], 0
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs: self.ids.append(attrs['id'])
        if tag == 'a': self.links.append(attrs.get('href', ''))
        if tag == 'h1': self.h1 += 1

root = Path(__file__).parent
pages = {p.name: Page(p.read_text()) for p in root.glob('*.html')}
for name, page in pages.items():
    assert len(page.ids) == len(set(page.ids)), (name, 'duplicate IDs')
    assert page.h1 == 1, (name, 'heading count', page.h1)
    for href in page.links:
        url = urlsplit(href)
        if url.scheme or url.netloc or url.path.startswith('assets/'): continue
        target = url.path or name
        assert target in pages, (name, href, 'missing page')
        assert not url.fragment or url.fragment in pages[target].ids, (name, href, 'missing anchor')
    print(name, 'PASS:', len(page.links), 'links;', len(page.ids), 'unique IDs')
