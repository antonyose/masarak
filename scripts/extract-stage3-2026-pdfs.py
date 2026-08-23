"""Extract the frozen 2026 Stage-3 vacancy artifacts into reviewed JSON.

This is a research/build helper only. Runtime code consumes the committed JSON
and never downloads or parses PDFs.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "lib" / "coordination-data" / "stage3-2026-raw.json"
TEMP = Path(os.environ.get("TEMP", ROOT / "tmp")) / "masarak-stage3-research-20260823"

SOURCES = {
    "scientific": {
        "url": "https://drive.google.com/uc?export=download&id=1M2XUz9Wn9NMgjIMuMsjqC1BNZwLV8a9v",
        "publicUrl": "https://drive.google.com/file/d/1M2XUz9Wn9NMgjIMuMsjqC1BNZwLV8a9v/view",
        "file": "stage3-scientific-new-2026.pdf",
        "expectedSha256": "3d2f3d29bc71bbcb2e53be516337221df706f45854d0ce5b062b71d77f782b1c",
        "expectedRows": 673,
    },
    "literary": {
        "url": "https://drive.google.com/uc?export=download&id=1-LTHXKnToqaYTPU8QZfsVlrBQeOFaZWL",
        "publicUrl": "https://drive.google.com/file/d/1-LTHXKnToqaYTPU8QZfsVlrBQeOFaZWL/view",
        "file": "stage3-literary-new-2026.pdf",
        "expectedSha256": "bec44e7c6efce2da461c562be9d0433de796bad3d525b9cf213b0f2ae613ea30",
        "expectedRows": 335,
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_source(source: dict[str, object]) -> Path:
    TEMP.mkdir(parents=True, exist_ok=True)
    path = TEMP / str(source["file"])
    if not path.exists() or sha256(path) != source["expectedSha256"]:
        request = Request(str(source["url"]), headers={"User-Agent": "Masarak-Official-Data/1.0"})
        with urlopen(request) as response, path.open("wb") as output:
            output.write(response.read())
    actual = sha256(path)
    if actual != source["expectedSha256"]:
        raise RuntimeError(f"Unexpected source hash for {path.name}: {actual}")
    return path


def logical_cell(value: str) -> str:
    text = " ".join(line[::-1] for line in value.splitlines()).strip()
    replacements = {
        "االقصر": "الأقصر",
        "االرض": "الأرض",
        "االسماك": "الأسماك",
        "االستزراع": "الاستزراع",
        "االكاديمية": "الأكاديمية",
        "االدارة": "الإدارة",
        "االسكندريه": "الإسكندرية",
        "االسكندرية": "الإسكندرية",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    # pdfplumber clips the final word in these two very long single-column rows.
    if text.startswith("كلية تكنولوجيا الصناعة و الطاقة بالفيوم - دمو جامعة الفيوم التكنولوجية الدو"):
        return "كلية تكنولوجيا الصناعة و الطاقة بالفيوم - دمو جامعة الفيوم التكنولوجية الدولية"
    if text.startswith("الكلية المصرية الكورية لتكنولوجيا الصناعة و الطاقة ج بنى سويف التكنولوج"):
        return "الكلية المصرية الكورية لتكنولوجيا الصناعة و الطاقة ج بنى سويف التكنولوجية"
    return " ".join(text.split())


def extract(path: Path) -> tuple[list[str], int]:
    rows: list[str] = []
    with pdfplumber.open(path) as document:
        for page in document.pages:
            table = page.extract_table() or []
            for row in table:
                if not row or not row[0]:
                    continue
                value = logical_cell(row[0])
                if value and value != "اسم الكلية":
                    rows.append(value)
        return rows, len(document.pages)


def main() -> None:
    payload: dict[str, object] = {
        "schemaVersion": "stage3-2026-raw@1",
        "retrievedAt": "2026-08-23T21:00:00+03:00",
        "publisher": "Ministry of Higher Education and Scientific Research",
        "sources": {},
        "rows": {},
    }
    for group, source in SOURCES.items():
        path = ensure_source(source)
        rows, pages = extract(path)
        if len(rows) != source["expectedRows"]:
            raise RuntimeError(f"{group}: expected {source['expectedRows']} rows, got {len(rows)}")
        payload["sources"][group] = {
            "url": source["publicUrl"],
            "sha256": source["expectedSha256"],
            "rowCount": len(rows),
            "pageCount": pages,
        }
        payload["rows"][group] = rows

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "counts": {k: len(v) for k, v in payload["rows"].items()}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
