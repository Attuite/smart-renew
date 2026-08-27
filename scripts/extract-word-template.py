"""Extract the approved Word master into the editable report-template data model."""

from __future__ import annotations

import argparse
import json
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn


FORMAL_CONTENT_PARAGRAPH_IDS = {
    "p-0008", "p-0009",
    "p-0014",
    "p-0017", "p-0019",
    "p-0021", "p-0023",
    "p-0040", "p-0041", "p-0042", "p-0043",
    "p-0045", "p-0046",
    "p-0050", "p-0051", "p-0052", "p-0053",
    "p-0055", "p-0056", "p-0057",
}

HEADING_ONE_PREFIXES = {
    "工作概述": "一、工作概述",
    "构建指标体系与评价方法": "二、构建指标体系与评价方法",
    "总体结论": "三、总体结论",
    "指标分析评价": "四、指标分析评价",
}


def clean_text(value: str) -> str:
    return "\n".join(" ".join(line.split()) for line in str(value or "").splitlines()).strip()


def paragraph_images(paragraph: Paragraph, document: Document, media_prefix: str) -> list[dict]:
    images = []
    seen = set()
    for blip in paragraph._element.xpath(".//a:blip"):
        relationship_id = blip.get(qn("r:embed"))
        if not relationship_id or relationship_id in seen:
            continue
        seen.add(relationship_id)
        relationship = document.part.rels.get(relationship_id)
        if not relationship:
            continue
        target = Path(relationship.target_ref).name
        images.append({
            "id": relationship_id,
            "src": f"{media_prefix}/{target}",
            "alt": clean_text(paragraph.text) or "Word 模板图片",
        })
    return images


def cell_images(cell, document: Document, media_prefix: str) -> list[dict]:
    images = []
    seen = set()
    for paragraph in cell.paragraphs:
        for image in paragraph_images(paragraph, document, media_prefix):
            if image["id"] in seen:
                continue
            seen.add(image["id"])
            images.append(image)
    return images


def extract_template(source: Path, output: Path, media_dir: Path) -> dict:
    document = Document(source)
    media_prefix = "assets/report-templates/v1/media"
    media_dir.mkdir(parents=True, exist_ok=True)
    for child in media_dir.iterdir():
        if child.is_file():
            child.unlink()
        elif child.is_dir():
            shutil.rmtree(child)

    with zipfile.ZipFile(source) as package:
        for name in package.namelist():
            if not name.startswith("word/media/") or name.endswith("/"):
                continue
            target = media_dir / Path(name).name
            target.write_bytes(package.read(name))

    blocks = []
    paragraph_number = 0
    table_number = 0
    pending_count = 0

    for item in document.iter_inner_content():
        if isinstance(item, Paragraph):
            text = clean_text(item.text)
            images = paragraph_images(item, document, media_prefix)
            if not text and not images:
                continue
            paragraph_number += 1
            style_name = item.style.name if item.style else "Normal"
            is_heading = style_name.lower().startswith("heading") or style_name.startswith("标题")
            if style_name.lower().startswith("heading 1"):
                text = HEADING_ONE_PREFIXES.get(text, text)
            paragraph_id = f"p-{paragraph_number:04d}"
            is_formal_content = paragraph_id in FORMAL_CONTENT_PARAGRAPH_IDS
            requires_review = not is_heading and text != "目录" and not is_formal_content
            if requires_review:
                pending_count += 1
            blocks.append({
                "id": paragraph_id,
                "type": "paragraph",
                "style": style_name,
                "text": text,
                "images": images,
                "requiresReview": requires_review,
                "reviewStatus": "pending" if requires_review else "approved",
                "reviewReason": (
                    "旧项目图片及其说明待替换或确认"
                    if images
                    else (
                        "制式内容，无需人工审核"
                        if is_formal_content
                        else ("旧模板正文待人工审核" if requires_review else "章节标题或目录结构")
                    )
                ),
                "reviewedBy": "",
                "reviewedAt": "",
            })
            continue

        if isinstance(item, Table):
            table_number += 1
            rows = []
            for row_index, row in enumerate(item.rows):
                cells = [clean_text(cell.text) for cell in row.cells]
                images_by_cell = [cell_images(cell, document, media_prefix) for cell in row.cells]
                requires_review = row_index > 0
                if requires_review:
                    pending_count += 1
                rows.append({
                    "id": f"t-{table_number:03d}-r-{row_index + 1:03d}",
                    "cells": cells,
                    "cellImages": images_by_cell,
                    "requiresReview": requires_review,
                    "reviewStatus": "pending" if requires_review else "approved",
                    "reviewReason": "旧项目表格数据待人工审核" if requires_review else "表头结构",
                    "reviewedBy": "",
                    "reviewedAt": "",
                })
            blocks.append({
                "id": f"t-{table_number:03d}",
                "type": "table",
                "style": item.style.name if item.style else "Table",
                "rows": rows,
            })

    first_section = document.sections[0]
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload = {
        "id": "TPL-WORD-V1",
        "name": "智更城市体检正式 Word 模板",
        "version": 1,
        "status": "reviewing",
        "sourceFile": "assets/report-templates/report-template-v1.docx",
        "sourceFileName": source.name,
        "createdAt": now,
        "updatedAt": now,
        "updatedBy": "",
        "reviewPolicy": "从旧项目导入的非标题正文、图片和表格数据行默认需要人工审核；审核通过后取消黄色标记。",
        "page": {
            "widthEmu": int(first_section.page_width or 0),
            "heightEmu": int(first_section.page_height or 0),
            "topMarginEmu": int(first_section.top_margin or 0),
            "rightMarginEmu": int(first_section.right_margin or 0),
            "bottomMarginEmu": int(first_section.bottom_margin or 0),
            "leftMarginEmu": int(first_section.left_margin or 0),
        },
        "stats": {
            "blocks": len(blocks),
            "paragraphs": paragraph_number,
            "tables": table_number,
            "pendingReview": pending_count,
        },
        "blocks": blocks,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="assets/report-templates/report-template-v1.docx")
    parser.add_argument("--output", default="assets/report-templates/report-template-v1.json")
    parser.add_argument("--media", default="assets/report-templates/v1/media")
    args = parser.parse_args()
    payload = extract_template(Path(args.source), Path(args.output), Path(args.media))
    print(json.dumps(payload["stats"], ensure_ascii=False))


if __name__ == "__main__":
    main()
