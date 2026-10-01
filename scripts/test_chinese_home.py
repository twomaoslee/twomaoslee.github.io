import tempfile
from pathlib import Path
import unittest
from chinese_home import apply, HomeLinks, home_link


class HomeRoutingTests(unittest.TestCase):
    def test_only_home_urls_change(self):
        base = "https://zimin.li/"
        for value in ("/", "/#team", "https://zimin.li/#featured"):
            self.assertIn("/en/", home_link(value, base))
        for value in ("#team", "/zh/", "/publication/paper/", "/index.json", "https://other.test/", "mailto:test@example.com"):
            self.assertEqual(home_link(value, base), value)

    def test_markup_and_scripts_are_preserved(self):
        source = '<a href=/#team>Team</a><link rel=alternate href="https://zimin.li/"><script>const root="/";</script><img src="/media/a.jpg">'
        result = HomeLinks(source, "https://zimin.li/").result()
        self.assertIn('href="/en/#team"', result)
        self.assertIn('href="https://zimin.li/en/"', result)
        self.assertIn('<script>const root="/";</script>', result)
        self.assertIn('<img src="/media/a.jpg">', result)

    def test_build_routing_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "zh").mkdir()
            (root / "en").mkdir()
            (root / "en/index.html").write_text('<link rel=canonical href=https://zimin.li/><meta http-equiv=refresh content="0; url=https://zimin.li/">')
            (root / "index.html").write_text('<html lang="en"><a href="/#team">Team</a></html>')
            (root / "zh/index.html").write_text('<a href="/">English</a><a href="/zh/#team">团队</a>')
            (root / "sitemap.xml").write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://zimin.li/</loc></url></urlset>')
            apply(root, "https://zimin.li/")
            self.assertIn('location.search+location.hash', (root / "index.html").read_text())
            self.assertIn('lang="en"', (root / "en/index.html").read_text())
            self.assertIn('href="/en/"', (root / "zh/index.html").read_text())
            self.assertIn('href="/zh/#team"', (root / "zh/index.html").read_text())
            self.assertIn('https://zimin.li/en/', (root / "sitemap.xml").read_text())
            with self.assertRaises(ValueError):
                apply(root, "https://zimin.li/")


if __name__ == "__main__":
    unittest.main()
