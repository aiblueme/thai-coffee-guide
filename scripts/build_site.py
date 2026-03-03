#!/usr/bin/env python3
"""
Site Builder — generates all HTML pages from Jinja2 templates + coffee-data.json.
Copies static assets (css, js, images) to dist/.
Run: python scripts/build_site.py
"""

import json
import os
import shutil
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).parent.parent
TEMPLATES_DIR = PROJECT_ROOT / "templates"
DATA_FILE = PROJECT_ROOT / "data" / "coffee-data.json"
DIST_DIR = PROJECT_ROOT / "dist"
STATIC_DIRS = {
    PROJECT_ROOT / "css": DIST_DIR / "css",
    PROJECT_ROOT / "js": DIST_DIR / "js",
    PROJECT_ROOT / "images" / "processed": DIST_DIR / "images",
}

# ---------------------------------------------------------------------------
# Jinja2 environment
# ---------------------------------------------------------------------------
env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)

# Custom test: used as selectattr("category", "contains", "specialty")
env.tests["contains"] = lambda lst, val: isinstance(lst, list) and val in lst

# Custom filters
env.filters["tojson"] = lambda v: json.dumps(v, ensure_ascii=False)


def load_data() -> dict:
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def clean_dist():
    """Remove and recreate dist/ directory."""
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True)
    (DIST_DIR / "brands").mkdir()
    print("dist/ cleaned and recreated.")


def copy_static():
    """Copy css/, js/, processed images, and favicon to dist/."""
    for src, dst in STATIC_DIRS.items():
        if src.exists():
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(str(src), str(dst))
            print(f"  Copied {src.relative_to(PROJECT_ROOT)} → {dst.relative_to(PROJECT_ROOT)}")
        else:
            dst.mkdir(parents=True, exist_ok=True)
            print(f"  (skipped missing) {src.relative_to(PROJECT_ROOT)}")
    # Copy favicon if it exists in project root or dist already
    favicon_src = PROJECT_ROOT / "favicon.svg"
    if favicon_src.exists():
        shutil.copy2(str(favicon_src), str(DIST_DIR / "favicon.svg"))
        print("  Copied favicon.svg → dist/favicon.svg")


def render(template_name: str, output_path: Path, **ctx) -> None:
    tpl = env.get_template(template_name)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    html = tpl.render(**ctx)
    output_path.write_text(html, encoding="utf-8")
    print(f"  Built: {output_path.relative_to(PROJECT_ROOT)}")


def build_index(brands: list):
    render(
        "index.html",
        DIST_DIR / "index.html",
        brands=brands,
    )


def build_compare(brands: list):
    render(
        "compare.html",
        DIST_DIR / "compare.html",
        brands=brands,
    )


def build_guide(brands: list):
    render(
        "guide.html",
        DIST_DIR / "guide.html",
        brands=brands,
    )


def build_brand_pages(brands: list):
    for i, brand in enumerate(brands):
        prev_brand = brands[i - 1] if i > 0 else None
        next_brand = brands[i + 1] if i < len(brands) - 1 else None
        render(
            "brand_detail.html",
            DIST_DIR / "brands" / f"{brand['slug']}.html",
            brand=brand,
            brands=brands,
            prev_brand=prev_brand,
            next_brand=next_brand,
        )


def write_404(brands: list):
    """Simple 404 page with consistent fonts and favicon."""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Found — Thai Coffee Guide</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;1,8..60,300;1,8..60,400&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+Thai:wght@300;400;600;700&display=swap"
       rel="stylesheet">
  <link rel="stylesheet" href="/css/main.css">
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="site-logo">
        <span class="logo-mark">&#9679;</span>
        <span class="logo-text">Thai Coffee<br><em>Ground Guide</em></span>
      </a>
    </div>
  </header>
  <main style="min-height:60vh; display:flex; align-items:center;
               justify-content:center; padding:4rem 1rem; text-align:center">
    <div>
      <p style="font-family:monospace; font-size:5rem; margin:0;
                color:#C4652A">404</p>
      <h1 style="font-family:'Playfair Display',serif; color:#2C1810;
                 margin-top:0.5rem">Page Not Found</h1>
      <p>That page doesn't exist. Try browsing all Thai coffee brands.</p>
      <a href="/" style="display:inline-block; margin-top:1.5rem;
                        padding:0.75rem 2rem; background:#C4652A;
                        color:#FAF7F2; text-decoration:none;
                        font-family:monospace">Back to Home</a>
    </div>
  </main>
</body>
</html>"""
    (DIST_DIR / "404.html").write_text(html, encoding="utf-8")
    print("  Built: dist/404.html")


def write_sitemap(brands: list):
    """Generate sitemap.xml for all pages."""
    base_url = "https://shellnode.lol:8420"
    urls = [
        f"{base_url}/",
        f"{base_url}/compare.html",
        f"{base_url}/guide.html",
    ]
    for brand in brands:
        urls.append(f"{base_url}/brands/{brand['slug']}.html")

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url in urls:
        lines.append(f"  <url><loc>{url}</loc></url>")
    lines.append("</urlset>")

    (DIST_DIR / "sitemap.xml").write_text("\n".join(lines), encoding="utf-8")
    print("  Built: dist/sitemap.xml")


def write_robots(brands: list):
    """Generate robots.txt."""
    content = "User-agent: *\nAllow: /\nSitemap: https://shellnode.lol:8420/sitemap.xml\n"
    (DIST_DIR / "robots.txt").write_text(content, encoding="utf-8")
    print("  Built: dist/robots.txt")


def main():
    print("=" * 60)
    print("Thai Coffee Guide — Site Builder")
    print("=" * 60)

    data = load_data()
    brands = data["brands"]
    print(f"Loaded {len(brands)} brands from coffee-data.json")

    print("\n[1/4] Cleaning dist/")
    clean_dist()

    print("\n[2/4] Copying static assets")
    copy_static()

    print("\n[3/4] Building pages")
    build_index(brands)
    build_compare(brands)
    build_guide(brands)
    build_brand_pages(brands)
    write_404(brands)
    write_sitemap(brands)
    write_robots(brands)

    print(f"\n[4/4] Done — {len(brands) + 3} pages built in dist/")
    print("=" * 60)
    print("Next: docker compose up -d --build")


if __name__ == "__main__":
    main()
