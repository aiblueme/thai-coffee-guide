#!/usr/bin/env python3
"""
Image Processing Pipeline
Converts downloaded raw images → WebP (max 1 MB) + 300×300 thumbnails.
Updates images/processed/{brand_name}/ structure.
"""

import json
import logging
import os
import shutil
from pathlib import Path

from PIL import Image, UnidentifiedImageError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).parent.parent
RAW_DIR = PROJECT_ROOT / "images" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "images" / "processed"
DATA_FILE = PROJECT_ROOT / "data" / "coffee-data.json"

MAX_FILE_SIZE_BYTES = 1_000_000  # 1 MB
MAX_DIMENSION = 1200            # px on longest side for full images
THUMB_SIZE = (300, 300)
WEBP_QUALITY_START = 80
WEBP_QUALITY_MIN = 40
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"}

# Mapping from raw directory names → brand slugs (must match coffee-data.json)
BRAND_SLUG_MAP: dict[str, str] = {
    "khao_shong": "khao-shong",
    "dao_coffee": "dao-coffee",
    "cafe_amazon": "cafe-amazon",
    "birdy": "birdy",
    "bon_cafe": "bon-cafe",
    "punthai_coffee": "punthai-coffee",
    "mezzox": "mezzox",
    "doi_tung": "doi-tung",
    "wawee_coffee": "wawee-coffee",
    "akha_ama": "akha-ama",
    "hillkoff": "hillkoff",
    "doi_chaang": "doi-chaang",
    "bluekoff": "bluekoff",
    "ceresia": "ceresia",
    "roots_coffee": "roots-coffee",
    "gallery_drip": "gallery-drip",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def resize_to_max_dimension(img: Image.Image, max_dim: int) -> Image.Image:
    """Resize image so its longest side is ≤ max_dim, preserving aspect ratio."""
    w, h = img.size
    if max(w, h) <= max_dim:
        return img
    if w >= h:
        new_w = max_dim
        new_h = int(h * max_dim / w)
    else:
        new_h = max_dim
        new_w = int(w * max_dim / h)
    return img.resize((new_w, new_h), Image.LANCZOS)


def save_webp(img: Image.Image, output_path: Path, quality: int = WEBP_QUALITY_START) -> int:
    """Save image as WebP at given quality. Returns file size in bytes."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(output_path), format="WEBP", quality=quality, method=6)
    return output_path.stat().st_size


def compress_to_under_1mb(img: Image.Image, output_path: Path) -> bool:
    """
    Progressively reduce quality (then dimensions) until file is under MAX_FILE_SIZE_BYTES.
    Returns True on success.
    """
    quality = WEBP_QUALITY_START
    current_img = img.copy()

    # First pass: reduce quality only
    while quality >= WEBP_QUALITY_MIN:
        size = save_webp(current_img, output_path, quality=quality)
        if size <= MAX_FILE_SIZE_BYTES:
            log.debug("  Saved at quality=%d, size=%d bytes", quality, size)
            return True
        quality -= 10

    # Second pass: reduce dimensions by 25% each iteration
    scale = 0.75
    for _ in range(4):
        w, h = img.size
        new_w = max(100, int(w * scale))
        new_h = max(100, int(h * scale))
        current_img = img.resize((new_w, new_h), Image.LANCZOS)
        size = save_webp(current_img, output_path, quality=WEBP_QUALITY_MIN)
        if size <= MAX_FILE_SIZE_BYTES:
            log.debug("  Saved scaled to %dx%d, size=%d bytes", new_w, new_h, size)
            return True
        scale *= 0.75

    log.warning("  Could not compress under 1 MB: %s", output_path)
    return False


def make_thumbnail(img: Image.Image, output_path: Path) -> None:
    """Create a square 300×300 thumbnail (center-cropped), saved as WebP."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Center-crop to square
    w, h = img.size
    min_side = min(w, h)
    left = (w - min_side) // 2
    top = (h - min_side) // 2
    img_cropped = img.crop((left, top, left + min_side, top + min_side))
    img_thumb = img_cropped.resize(THUMB_SIZE, Image.LANCZOS)
    img_thumb.save(str(output_path), format="WEBP", quality=75, method=6)


def collect_raw_images(brand_raw_dir: Path) -> list[Path]:
    """Recursively collect all supported image files under brand's raw directory."""
    images: list[Path] = []
    if not brand_raw_dir.exists():
        return images
    for path in sorted(brand_raw_dir.rglob("*")):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            images.append(path)
    return images


# ---------------------------------------------------------------------------
# Core Processing
# ---------------------------------------------------------------------------

def process_brand(brand_key: str, slug: str) -> list[str]:
    """
    Process all raw images for a brand. Returns list of processed filenames (without extension).
    """
    brand_raw_dir = RAW_DIR / brand_key
    brand_processed_dir = PROCESSED_DIR / slug
    brand_processed_dir.mkdir(parents=True, exist_ok=True)

    raw_images = collect_raw_images(brand_raw_dir)
    if not raw_images:
        log.warning("No raw images found for brand: %s", brand_key)
        return []

    log.info("Processing %d images for %s → %s", len(raw_images), brand_key, slug)

    processed_names: list[str] = []
    kept = 0

    for i, raw_path in enumerate(raw_images):
        try:
            img = Image.open(raw_path).convert("RGB")
        except (UnidentifiedImageError, OSError) as exc:
            log.debug("  Skipping unreadable file %s: %s", raw_path.name, exc)
            continue

        # Skip tiny images (likely icons/placeholders)
        if img.width < 200 or img.height < 200:
            log.debug("  Skipping too-small image: %dx%d", img.width, img.height)
            continue

        # Resize to max dimension for full image
        img_resized = resize_to_max_dimension(img, MAX_DIMENSION)

        filename_stem = f"product_{kept + 1:02d}"
        full_path = brand_processed_dir / f"{filename_stem}.webp"
        thumb_path = brand_processed_dir / f"{filename_stem}_thumb.webp"

        # Save full image compressed under 1 MB
        ok = compress_to_under_1mb(img_resized, full_path)
        if not ok:
            log.warning("  Skipping %s (could not compress)", raw_path.name)
            continue

        # Save thumbnail
        make_thumbnail(img, thumb_path)

        processed_names.append(filename_stem)
        kept += 1
        log.info("  [%d] %s → %s.webp (%.0f KB)", kept, raw_path.name, filename_stem,
                 full_path.stat().st_size / 1024)

        # Limit to 8 images per brand
        if kept >= 8:
            break

    log.info("  Kept %d/%d images for %s", kept, len(raw_images), slug)
    return processed_names


def update_data_json(brand_images: dict[str, list[str]]) -> None:
    """Write processed image filenames back into coffee-data.json."""
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    for brand in data["brands"]:
        slug = brand["slug"]
        names = brand_images.get(slug, [])
        brand["images"] = [f"{n}.webp" for n in names]
        brand["thumbnail"] = f"{names[0]}_thumb.webp" if names else ""

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    log.info("Updated coffee-data.json with processed image filenames.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    brand_images: dict[str, list[str]] = {}  # slug → list of stems

    for brand_key, slug in BRAND_SLUG_MAP.items():
        names = process_brand(brand_key, slug)
        brand_images[slug] = names

    update_data_json(brand_images)

    # Summary
    total = sum(len(v) for v in brand_images.values())
    log.info("=" * 60)
    log.info("Processing complete. %d total images saved to images/processed/", total)
    log.info("Run scripts/build_site.py to generate HTML.")


if __name__ == "__main__":
    main()
