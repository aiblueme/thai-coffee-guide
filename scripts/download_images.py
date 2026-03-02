#!/usr/bin/env python3
"""
Thai Coffee Brand Image Downloader
Uses icrawler with Bing + Baidu, antibot mitigations applied.
"""

import os
import time
import random
import logging
from pathlib import Path

from icrawler.builtin import BingImageCrawler, BaiduImageCrawler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rotating User-Agents – recent Chrome / Firefox strings
# ---------------------------------------------------------------------------
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
]

# ---------------------------------------------------------------------------
# Keywords per brand — English + Thai script
# ---------------------------------------------------------------------------
BRAND_KEYWORDS: dict[str, list[str]] = {
    "khao_shong": [
        "Khao Shong ground coffee bag",
        "เขาช่อง กาแฟคั่วบด",
        "Khao Shong coffee product Thailand",
        "เขาช่อง กาแฟ ถุง สินค้า",
    ],
    "dao_coffee": [
        "Dao Coffee Chiang Rai ground",
        "ดาวคอฟฟี่ กาแฟคั่วบด",
        "Dao Coffee Thailand product bag",
        "ดาวคอฟฟี่ กาแฟ ถุง",
    ],
    "cafe_amazon": [
        "Cafe Amazon ground coffee bag Thailand",
        "คาเฟ่ อเมซอน กาแฟ ถุง",
        "Cafe Amazon coffee product retail",
        "คาเฟ่ อเมซอน กาแฟคั่วบด",
    ],
    "birdy": [
        "Birdy coffee Thailand ground bag",
        "เบอร์ดี้ กาแฟ ถุง",
        "Birdy Ajinomoto coffee product",
        "เบอร์ดี้ กาแฟคั่วบด สินค้า",
    ],
    "bon_cafe": [
        "Bon Cafe Thailand ground coffee bag",
        "บอน คาเฟ่ กาแฟ ถุง",
        "Bon Cafe Thai coffee product",
        "บอน คาเฟ่ กาแฟคั่วบด",
    ],
    "punthai_coffee": [
        "Punthai Coffee ground coffee bag",
        "พันธุ์ไทย คอฟฟี่ กาแฟ ถุง",
        "Punthai Coffee product Thailand",
        "พันธุ์ไทย กาแฟคั่วบด สินค้า",
    ],
    "mezzox": [
        "MezzoX coffee ground bag Thailand",
        "เมซโซ่ เอ็กซ์ กาแฟ ถุง",
        "MezzoX Thai coffee product",
    ],
    "doi_tung": [
        "Doi Tung coffee ground bag Thailand",
        "ดอยตุง กาแฟ ถุง",
        "Doi Tung Royal Project coffee product",
        "ดอยตุง กาแฟคั่วบด สินค้า",
    ],
    "wawee_coffee": [
        "Wawee Coffee Chiang Mai ground bag",
        "วาวี คอฟฟี่ กาแฟ ถุง",
        "Wawee Coffee product retail",
        "วาวี กาแฟคั่วบด เชียงใหม่",
    ],
    "akha_ama": [
        "Akha Ama coffee beans bag Chiang Mai",
        "อาข่า อ่ามา กาแฟ ถุง",
        "Akha Ama coffee product specialty",
        "อาข่า อ่ามา กาแฟคั่วบด",
    ],
    "hillkoff": [
        "Hillkoff coffee ground bag Thailand",
        "ฮิลล์คอฟฟ์ กาแฟ ถุง",
        "Hillkoff Thai arabica coffee product",
        "ฮิลล์คอฟฟ์ กาแฟคั่วบด",
    ],
    "doi_chaang": [
        "Doi Chaang coffee ground bag Chiang Rai",
        "ดอยช้าง กาแฟ ถุง",
        "Doi Chaang coffee product single origin",
        "ดอยช้าง กาแฟคั่วบด สินค้า",
    ],
    "bluekoff": [
        "Bluekoff Thai arabica coffee bag",
        "บลูคอฟฟ์ กาแฟ ถุง",
        "Bluekoff specialty coffee Thailand product",
        "บลูคอฟฟ์ กาแฟคั่วบด",
    ],
    "ceresia": [
        "Ceresia Coffee Roasters Bangkok bag",
        "เซเรเซีย คอฟฟี่ กาแฟ ถุง",
        "Ceresia specialty coffee product Thailand",
    ],
    "roots_coffee": [
        "Roots Coffee Roaster Bangkok bag",
        "รูทส์ คอฟฟี่ กาแฟ ถุง",
        "Roots Coffee Thailand specialty product",
        "รูทส์ กาแฟคั่วบด สินค้า",
    ],
    "gallery_drip": [
        "Gallery Drip Coffee Thai single origin bag",
        "แกลเลอรี่ ดริปคอฟฟี่ ถุง",
        "Gallery Drip Coffee Thailand product",
    ],
}

BASE_RAW_DIR = Path(__file__).parent.parent / "images" / "raw"


def random_sleep(min_s: float = 2.0, max_s: float = 5.0) -> None:
    """Sleep for a random duration to mimic human browsing pace."""
    delay = random.uniform(min_s, max_s)
    log.info("Sleeping %.1f seconds …", delay)
    time.sleep(delay)


def get_feeder_kwargs() -> dict:
    """Return downloader kwargs with a rotated User-Agent."""
    ua = random.choice(USER_AGENTS)
    return {
        "headers": {
            "User-Agent": ua,
            "Accept-Language": "en-US,en;q=0.9,th;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
    }


def crawl_bing(brand_key: str, keyword: str, save_dir: Path, max_num: int = 4) -> None:
    """Download images from Bing for a single keyword."""
    save_dir.mkdir(parents=True, exist_ok=True)
    feeder_kwargs = get_feeder_kwargs()
    crawler = BingImageCrawler(
        feeder_threads=1,
        parser_threads=1,
        downloader_threads=1,
        storage={"root_dir": str(save_dir)},
        extra_downloader_args={"headers": feeder_kwargs["headers"]},
    )
    try:
        crawler.crawl(
            keyword=keyword,
            max_num=max_num,
            min_size=(200, 200),
        )
    except Exception as exc:
        log.warning("Bing crawl failed for %r: %s", keyword, exc)


def crawl_baidu(brand_key: str, keyword: str, save_dir: Path, max_num: int = 4) -> None:
    """Download images from Baidu for a single keyword (great for Thai product photos)."""
    save_dir.mkdir(parents=True, exist_ok=True)
    feeder_kwargs = get_feeder_kwargs()
    crawler = BaiduImageCrawler(
        feeder_threads=1,
        parser_threads=1,
        downloader_threads=1,
        storage={"root_dir": str(save_dir)},
        extra_downloader_args={"headers": feeder_kwargs["headers"]},
    )
    try:
        crawler.crawl(
            keyword=keyword,
            max_num=max_num,
        )
    except Exception as exc:
        log.warning("Baidu crawl failed for %r: %s", keyword, exc)


def download_brand(brand_key: str, keywords: list[str]) -> None:
    """Download images for a single brand using all provided keywords."""
    brand_dir = BASE_RAW_DIR / brand_key
    brand_dir.mkdir(parents=True, exist_ok=True)

    log.info("=" * 60)
    log.info("Downloading: %s", brand_key)
    log.info("=" * 60)

    for i, keyword in enumerate(keywords):
        log.info("[%d/%d] Keyword: %r", i + 1, len(keywords), keyword)

        # Bing pass
        bing_dir = brand_dir / f"bing_{i}"
        crawl_bing(brand_key, keyword, bing_dir, max_num=4)
        random_sleep(2.0, 4.0)

        # Baidu pass (valuable for Thai product indexing)
        baidu_dir = brand_dir / f"baidu_{i}"
        crawl_baidu(brand_key, keyword, baidu_dir, max_num=4)
        random_sleep(2.0, 5.0)

    log.info("Finished brand: %s", brand_key)


def main() -> None:
    BASE_RAW_DIR.mkdir(parents=True, exist_ok=True)

    brand_keys = list(BRAND_KEYWORDS.keys())
    random.shuffle(brand_keys)  # Vary crawl order to avoid patterns

    for idx, brand_key in enumerate(brand_keys):
        keywords = BRAND_KEYWORDS[brand_key]
        download_brand(brand_key, keywords)

        if idx < len(brand_keys) - 1:
            # Stagger brand downloads: 10-30 second pause between brands
            inter_brand_sleep = random.uniform(10, 30)
            log.info(
                "Sleeping %.0f seconds before next brand …", inter_brand_sleep
            )
            time.sleep(inter_brand_sleep)

    log.info("All brands downloaded. Run process_images.py next.")


if __name__ == "__main__":
    main()
