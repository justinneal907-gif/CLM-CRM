"""Append newly published CLM models to the restricted coworker roster.

Only package-app/roster-updates.js is written. The private CRM is never read or
modified by this script.
"""

from __future__ import annotations

from datetime import date
from html import unescape
from pathlib import Path
import json
import re
import unicodedata
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT_PATH = ROOT / "package-app" / "roster.js"
UPDATES_PATH = ROOT / "package-app" / "roster-updates.js"
SITEMAP_URL = "https://www.chezlesmannequins.com/sitemap.xml"
ALLOWED_BOARDS = {"main-board", "women", "men-5", "curve", "development"}
LABELS = {
    "altezza": "Height",
    "hauteur": "Height",
    "height": "Height",
    "petto": "Bust",
    "poitrine": "Bust",
    "bust": "Bust",
    "vita": "Waist",
    "taille": "Waist",
    "waist": "Waist",
    "anca": "Hip",
    "hanche": "Hip",
    "hip": "Hip",
    "scarpa": "Shoe",
    "shoe": "Shoe",
    "capelli": "Hair",
    "cheveux": "Hair",
    "hair": "Hair",
    "occhi": "Eyes",
    "yeux": "Eyes",
    "eyes": "Eyes",
}
VALUES = {
    "bionda": "Blonde",
    "azzurro": "Blue",
    "châtain marron": "Chestnut Brown",
    "bleu": "Blue",
}


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": "CLM roster sync/1.0"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def extract_array(path: Path, variable: str) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    match = re.search(rf"window\.{re.escape(variable)}\s*=\s*(\[.*\]);\s*$", text, re.S)
    if not match:
        raise RuntimeError(f"Could not find {variable} in {path}")
    return json.loads(match.group(1))


def plain(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", " | ", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return re.sub(r"\s+", " ", unescape(fragment)).strip(" \xa0|")


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def translate_measurements(value: str) -> str:
    for source, target in LABELS.items():
        value = re.sub(rf"\b{source}\s*:", f"{target}:", value, flags=re.I)
    for source, target in VALUES.items():
        value = re.sub(rf"(?<=:\s){re.escape(source)}(?=\s*(?:\||$))", target, value, flags=re.I)
    return re.sub(r"\s*\|\s*", " | ", value).strip(" |")


def infer_location(description: str) -> str:
    match = re.search(r"\bfrom\s+([^.;]+)", description, flags=re.I)
    if match:
        return match.group(1).strip()
    if re.search(r"\bGerman\b", description, flags=re.I):
        return "Germany"
    return "International"


def parse_profile(url: str, first_image: str) -> dict | None:
    page = fetch(url)
    paragraphs = re.findall(r"<p\b[^>]*>(.*?)</p>", page, flags=re.I | re.S)
    rows = [plain(item) for item in paragraphs]
    metric_index = next(
        (i for i, row in enumerate(rows) if re.search(r"\b(?:height|hauteur|altezza)\s*:", row, re.I)),
        None,
    )
    if metric_index is None or metric_index == 0:
        return None
    name = rows[metric_index - 1].strip()
    measurements = translate_measurements(rows[metric_index])
    description = rows[metric_index + 1] if metric_index + 1 < len(rows) else ""
    board = urlparse(url).path.strip("/").split("/", 1)[0]
    division = {
        "main-board": "Main Board",
        "women": "Women",
        "men-5": "Men",
        "curve": "Curve",
        "development": "Development",
    }[board]
    slug = re.sub(r"[^a-z0-9]+", "-", normalize(name)).strip("-") or "model"
    hair = re.search(r"\bHair:\s*([^|]+)", measurements, flags=re.I)
    eyes = re.search(r"\bEyes:\s*([^|]+)", measurements, flags=re.I)
    return {
        "id": f"site-{board}-{slug}",
        "name": name,
        "location": infer_location(description),
        "division": division,
        "measurements": measurements,
        "profileUrl": url,
        "photoUrl": first_image,
        "photos": [],
        "hair": hair.group(1).strip() if hair else "",
        "eyes": eyes.group(1).strip() if eyes else "",
        "description": description,
        "websiteSyncedOn": date.today().isoformat(),
    }


def sitemap_profiles(xml: str) -> list[tuple[str, str]]:
    root = ElementTree.fromstring(xml)
    ns = {
        "sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
        "image": "http://www.google.com/schemas/sitemap-image/1.1",
    }
    profiles = []
    for entry in root.findall("sm:url", ns):
        loc = entry.findtext("sm:loc", default="", namespaces=ns)
        parts = urlparse(loc).path.strip("/").split("/")
        if len(parts) != 2 or parts[0] not in ALLOWED_BOARDS:
            continue
        image = entry.findtext("image:image/image:loc", default="", namespaces=ns)
        profiles.append((loc, image))
    return profiles


def main() -> None:
    snapshot = extract_array(SNAPSHOT_PATH, "CLM_PACKAGE_ROSTER")
    updates = extract_array(UPDATES_PATH, "CLM_ROSTER_UPDATES")
    all_records = snapshot + updates
    by_url = {record.get("profileUrl"): record for record in all_records if record.get("profileUrl")}
    by_name = {normalize(record.get("name", "")): record for record in all_records if record.get("name")}
    update_by_id = {record["id"]: record for record in updates}
    changed = []

    for url, image in sitemap_profiles(fetch(SITEMAP_URL)):
        existing = by_url.get(url)
        if existing and existing["id"] not in update_by_id:
            continue
        profile = parse_profile(url, image)
        if not profile:
            continue
        matched = existing or by_name.get(normalize(profile["name"]))
        if matched:
            profile["id"] = matched["id"]
        old = update_by_id.get(profile["id"])
        if old != profile:
            update_by_id[profile["id"]] = profile
            changed.append(profile["name"])
        by_url[url] = profile
        by_name[normalize(profile["name"])] = profile

    payload = json.dumps(list(update_by_id.values()), ensure_ascii=False, indent=2)
    UPDATES_PATH.write_text(
        "// Public website roster updates for the restricted coworker package app.\n"
        "// This file contains model records only. It is intentionally independent of\n"
        "// the private CRM, contacts, submissions, casting research, and Gmail drafts.\n"
        f"window.CLM_ROSTER_UPDATES = {payload};\n",
        encoding="utf-8",
    )
    print(f"Coworker roster contains {len(update_by_id)} website updates.")
    if changed:
        print("Added or refreshed: " + ", ".join(changed))


if __name__ == "__main__":
    main()
