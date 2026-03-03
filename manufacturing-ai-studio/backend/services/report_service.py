from __future__ import annotations

from html import escape
from pathlib import Path
from string import Template

from services.automl_service import get_model_result

BASE_DIR = Path(__file__).resolve().parents[1]
REPORT_DIR = BASE_DIR / "data/reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

TEMPLATE_PATH = BASE_DIR / "templates/report.html"


def _format_metric(metric_name: str, metric_value: float | None) -> str:
    if metric_value is None:
        return "N/A"
    if metric_name in {"accuracy", "f1_score", "r2_score"}:
        return f"{metric_value:.4f}"
    return f"{metric_value:.4f}"


def _metric_grade(task_type: str, metric_name: str, metric_value: float | None) -> tuple[str, str]:
    if metric_value is None:
        return "N/A", "학습 지표가 저장되지 않았습니다."

    if task_type == "regression" and metric_name == "r2_score":
        if metric_value >= 0.8:
            return "A", "설명력이 매우 우수합니다."
        if metric_value >= 0.6:
            return "B", "운영 적용 가능한 수준입니다."
        if metric_value >= 0.3:
            return "C", "추가 피처 엔지니어링이 필요합니다."
        return "D", "학습 데이터/타겟 정의 재점검이 필요합니다."

    if task_type == "classification" and metric_name in {"accuracy", "f1_score"}:
        if metric_value >= 0.9:
            return "A", "분류 성능이 매우 우수합니다."
        if metric_value >= 0.8:
            return "B", "운영 적용 가능한 수준입니다."
        if metric_value >= 0.7:
            return "C", "클래스 불균형 및 피처 보강 검토가 필요합니다."
        return "D", "데이터 전처리/레이블링 품질 재점검이 필요합니다."

    if metric_value >= 0.8:
        return "B", "성능이 양호합니다."
    if metric_value >= 0.6:
        return "C", "성능 보완 여지가 있습니다."
    return "D", "지표 기준 재설정 또는 데이터 보강이 필요합니다."


def _render_html(payload: dict) -> str:
    template = Template(TEMPLATE_PATH.read_text(encoding="utf-8"))
    raw_features = payload.get("feature_importance") or {}
    features = sorted(raw_features.items(), key=lambda item: abs(float(item[1])), reverse=True)
    max_abs_score = max((abs(float(score)) for _, score in features), default=1.0)
    top_features = features[:10]

    feature_rows = "".join(
        (
            "<tr>"
            f"<td>{idx}</td>"
            f"<td>{escape(str(name))}</td>"
            f"<td class='mono'>{float(score):.6f}</td>"
            "</tr>"
        )
        for idx, (name, score) in enumerate(top_features, start=1)
    )

    feature_bars = "".join(
        (
            "<div class='bar-row'>"
            f"<div class='bar-label'>{escape(str(name))}</div>"
            "<div class='bar-track'>"
            f"<div class='bar-fill' style='width:{max(2.0, abs(float(score)) / max_abs_score * 100):.2f}%'></div>"
            "</div>"
            f"<div class='bar-value mono'>{float(score):.6f}</div>"
            "</div>"
        )
        for name, score in top_features[:5]
    )

    grade, grade_comment = _metric_grade(
        str(payload.get("task_type")),
        str(payload.get("metric_name")),
        payload.get("metric_value"),
    )

    recommendations = [
        f"상위 중요 피처({', '.join(escape(str(name)) for name, _ in top_features[:3])})의 공정 관리 기준을 재정의하세요.",
        "이상치/결측치 처리 규칙을 표준화해 재학습 데이터 품질을 높이세요.",
        "동일 설정으로 주기 재학습 후 성능 변동(드리프트)을 모니터링하세요.",
    ]
    recommendation_items = "".join(f"<li>{item}</li>" for item in recommendations)

    return template.safe_substitute(
        model_id=payload.get("model_id", "N/A"),
        model_name=payload.get("model_name", "N/A"),
        task_type=payload.get("task_type", "N/A"),
        metric_name=payload.get("metric_name", "N/A"),
        metric_value=_format_metric(str(payload.get("metric_name")), payload.get("metric_value")),
        metric_grade=grade,
        metric_comment=grade_comment,
        target_column=payload.get("target_column", "N/A"),
        feature_count=len(payload.get("feature_columns") or []),
        created_at=payload.get("created_at", "N/A"),
        experiment_name=payload.get("experiment_name") or "N/A",
        feature_rows=feature_rows or "<tr><td colspan='3'>피처 정보가 없습니다.</td></tr>",
        feature_bars=feature_bars or "<p>피처 중요도 정보가 없습니다.</p>",
        recommendation_items=recommendation_items,
    )


def build_report(model_id: int) -> Path:
    payload = get_model_result(model_id)
    html = _render_html(payload)
    html_path = REPORT_DIR / f"report_{model_id}.html"
    html_path.write_text(html, encoding="utf-8")

    pdf_path = REPORT_DIR / f"report_{model_id}.pdf"
    if pdf_path.exists():
        pdf_path.unlink()

    try:
        from weasyprint import HTML

        HTML(string=html, base_url=str(BASE_DIR)).write_pdf(str(pdf_path))
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"PDF 생성 엔진 오류: {exc}") from exc

    return pdf_path
