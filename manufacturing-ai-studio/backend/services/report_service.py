from __future__ import annotations

from pathlib import Path
from string import Template

from services.automl_service import get_model_result

BASE_DIR = Path(__file__).resolve().parents[1]
REPORT_DIR = BASE_DIR / "data/reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

TEMPLATE_PATH = BASE_DIR / "templates/report.html"


def _render_html(payload: dict) -> str:
    template = Template(TEMPLATE_PATH.read_text(encoding="utf-8"))
    feature_items = "".join(
        f"<li>{name}: {score:.4f}</li>" for name, score in payload["feature_importance"].items()
    )

    return template.safe_substitute(
        model_name=payload["model_name"],
        task_type=payload["task_type"],
        metric_name=payload["metric_name"],
        metric_value=f"{payload['metric_value']:.4f}" if payload["metric_value"] is not None else "N/A",
        target_column=payload["target_column"],
        feature_items=feature_items,
        created_at=payload["created_at"],
    )


def build_report(model_id: int) -> Path:
    payload = get_model_result(model_id)
    html = _render_html(payload)
    html_path = REPORT_DIR / f"report_{model_id}.html"
    html_path.write_text(html, encoding="utf-8")

    pdf_path = REPORT_DIR / f"report_{model_id}.pdf"

    try:
        from weasyprint import HTML

        HTML(string=html).write_pdf(pdf_path)
    except Exception:  # noqa: BLE001
        pdf_path.write_bytes(html.encode("utf-8"))

    return pdf_path
