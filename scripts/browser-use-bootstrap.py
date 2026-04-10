#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import os
import sys
import types
from pathlib import Path

DEFAULT_BROWSER_USE_REPO = "/Users/molei/codes/ai-browser-book"


def _install_optional_shims() -> None:
    if importlib.util.find_spec("mcp_browser_use.xhs") is None:
        xhs = types.ModuleType("mcp_browser_use.xhs")

        def extract_urls_from_html(_html: str) -> list[str]:
            return []

        def filter_image_urls(values: list[str]) -> list[str]:
            seen: set[str] = set()
            out: list[str] = []
            for value in values or []:
                if not isinstance(value, str):
                    continue
                item = value.strip()
                if not item or item in seen:
                    continue
                seen.add(item)
                out.append(item)
            return out

        xhs.extract_urls_from_html = extract_urls_from_html
        xhs.filter_image_urls = filter_image_urls
        sys.modules["mcp_browser_use.xhs"] = xhs

    if importlib.util.find_spec("mcp_browser_use.ins") is None:
        ins = types.ModuleType("mcp_browser_use.ins")

        def extract_urls_from_html(_html: str) -> list[str]:
            return []

        def filter_media_urls(values: list[str]) -> list[str]:
            seen: set[str] = set()
            out: list[str] = []
            for value in values or []:
                if not isinstance(value, str):
                    continue
                item = value.strip()
                if not item or item in seen:
                    continue
                seen.add(item)
                out.append(item)
            return out

        def extract_post_info(_html: str) -> dict[str, object]:
            return {}

        ins.extract_urls_from_html = extract_urls_from_html
        ins.filter_media_urls = filter_media_urls
        ins.extract_post_info = extract_post_info
        sys.modules["mcp_browser_use.ins"] = ins


def main() -> None:
    browser_use_repo = str(os.getenv("AIOS_BROWSER_USE_REPO") or DEFAULT_BROWSER_USE_REPO).strip()
    mcp_dir = Path(browser_use_repo) / "mcp-browser-use"
    src_dir = mcp_dir / "src"
    if not src_dir.exists():
        raise SystemExit(f"[aios-browser] browser-use src directory missing: {src_dir}")

    sys.path.insert(0, str(src_dir))
    _install_optional_shims()

    from mcp_browser_use.server import main as server_main

    server_main()


if __name__ == "__main__":
    main()
