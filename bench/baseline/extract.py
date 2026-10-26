"""Text-only baseline: PDF -> Markdown with PyMuPDF's pymupdf4llm, the extractor the original
hiring-agent project used. Reads PDF paths from argv, prints one JSON line per file.

    uv run --python 3.11 --with-requirements bench/baseline/requirements.txt python -I bench/baseline/extract.py a.pdf b.pdf
"""
import json
import sys
import time

import pymupdf
import pymupdf4llm

for path in sys.argv[1:]:
    t = time.perf_counter()
    try:
        with pymupdf.open(path) as doc:
            pages = list(range(min(4, doc.page_count)))
        md = pymupdf4llm.to_markdown(path, pages=pages, show_progress=False)
        err = None
    except Exception as e:  # a broken PDF is a result, not a crash
        md, err = "", str(e)[:200]
    print(json.dumps({"file": path, "markdown": md, "ms": round((time.perf_counter() - t) * 1000), "error": err}), flush=True)
