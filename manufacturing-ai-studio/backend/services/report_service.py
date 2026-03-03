from __future__ import annotations

from html import escape
from pathlib import Path
from string import Template

from services.automl_service import get_model_result
from services.data_service import get_upload_metadata
from services.eda_service import get_eda_correlation, get_eda_summary
from services.xai_service import get_global_explanation

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


def _format_percent(value: float | None) -> str:
    if value is None:
        return "N/A"
    return f"{float(value) * 100.0:.2f}%"


def _resolve_file_id(base_payload: dict, xai_payload: dict | None) -> str | None:
    if base_payload.get("file_id"):
        return str(base_payload["file_id"])

    xai_ref = (xai_payload or {}).get("reference") or {}
    if xai_ref.get("file_id"):
        return str(xai_ref["file_id"])

    source_file = xai_ref.get("source_file")
    if not source_file:
        return None

    stem = Path(str(source_file)).stem
    if not stem:
        return None

    for ext in (".csv", ".xlsx"):
        if (BASE_DIR / "data/uploads" / f"{stem}{ext}").exists():
            return stem
    return None


def _resolve_data_meta(file_id: str | None, payload: dict) -> tuple[str | None, str | None]:
    if not file_id:
        data_ref = payload.get("data_ref") or payload.get("data_id") or payload.get("file_id")
        return payload.get("data_name"), data_ref
    meta = get_upload_metadata(file_id)
    data_name = payload.get("data_name") or meta.get("original_filename")
    data_ref = payload.get("data_ref") or payload.get("data_id") or meta.get("data_id") or file_id
    return data_name, data_ref


def _enrich_payload(base_payload: dict) -> dict:
    payload = dict(base_payload)
    payload["eda_summary"] = None
    payload["eda_correlation"] = None
    payload["xai_global"] = None

    try:
        payload["xai_global"] = get_global_explanation(
            model_id=int(payload["model_id"]),
            sample_size=300,
            top_n=10,
            use_cache=True,
        )
    except Exception as exc:  # noqa: BLE001
        payload["xai_error"] = str(exc)

    file_id = _resolve_file_id(payload, payload.get("xai_global"))
    payload["file_id"] = file_id
    data_name, data_ref = _resolve_data_meta(file_id=file_id, payload=payload)
    payload["data_ref"] = data_ref
    payload["data_id"] = data_ref
    payload["data_name"] = data_name

    if file_id:
        try:
            payload["eda_summary"] = get_eda_summary(file_id=file_id, use_cache=True)
        except Exception as exc:  # noqa: BLE001
            payload["eda_error"] = str(exc)

        try:
            payload["eda_correlation"] = get_eda_correlation(
                file_id=file_id,
                method="pearson",
                max_features=30,
                threshold=0.8,
                use_cache=True,
            )
        except Exception as exc:  # noqa: BLE001
            payload["eda_error"] = str(exc)

    return payload


def _render_rank_rows(items: list[tuple[str, float]], score_fmt: str = "{:.6f}") -> str:
    return "".join(
        (
            "<tr>"
            f"<td>{idx}</td>"
            f"<td>{escape(str(name))}</td>"
            f"<td class='mono'>{score_fmt.format(float(score))}</td>"
            "</tr>"
        )
        for idx, (name, score) in enumerate(items, start=1)
    )


def _render_bars(items: list[tuple[str, float]], top_n: int = 5) -> str:
    if not items:
        return "<p>데이터가 없습니다.</p>"

    selected = items[:top_n]
    max_abs_score = max((abs(float(score)) for _, score in selected), default=1.0)
    return "".join(
        (
            "<div class='bar-row'>"
            f"<div class='bar-label'>{escape(str(name))}</div>"
            "<div class='bar-track'>"
            f"<div class='bar-fill' style='width:{max(2.0, abs(float(score)) / max_abs_score * 100):.2f}%'></div>"
            "</div>"
            f"<div class='bar-value mono'>{float(score):.6f}</div>"
            "</div>"
        )
        for name, score in selected
    )


def _render_html(payload: dict) -> str:
    template = Template(TEMPLATE_PATH.read_text(encoding="utf-8"))

    model_importance_raw = payload.get("feature_importance") or {}
    model_importance = sorted(model_importance_raw.items(), key=lambda item: abs(float(item[1])), reverse=True)[:10]

    xai_features_raw = ((payload.get("xai_global") or {}).get("top_features") or [])
    xai_features = [
        (str(item.get("feature", "")), float(item.get("mean_abs_shap", 0.0)))
        for item in xai_features_raw
        if item.get("feature") is not None
    ][:10]

    eda_summary = payload.get("eda_summary") or {}
    high_corr_pairs = ((payload.get("eda_correlation") or {}).get("high_correlation_pairs") or [])[:10]

    corr_rows = "".join(
        (
            "<tr>"
            f"<td>{idx}</td>"
            f"<td>{escape(str(item.get('left', '')))}</td>"
            f"<td>{escape(str(item.get('right', '')))}</td>"
            f"<td class='mono'>{float(item.get('corr', 0.0)):.4f}</td>"
            "</tr>"
        )
        for idx, item in enumerate(high_corr_pairs, start=1)
    )

    eda_warning_items = ""
    for warning in (eda_summary.get("warnings") or [])[:8]:
        eda_warning_items += f"<li>{escape(str(warning))}</li>"
    if not eda_warning_items:
        eda_warning_items = "<li>특이 경고 없음</li>"

    grade, grade_comment = _metric_grade(
        str(payload.get("task_type")),
        str(payload.get("metric_name")),
        payload.get("metric_value"),
    )

    rec_items = []
    if xai_features:
        rec_items.append(
            f"XAI 상위 요인({', '.join(escape(name) for name, _ in xai_features[:3])}) 중심으로 공정 제어값 허용범위를 재정의하세요."
        )
    if eda_summary.get("warnings"):
        rec_items.append(f"EDA 경고 {len(eda_summary.get('warnings') or [])}건을 우선순위로 정리해 데이터 품질 규칙을 보강하세요.")
    rec_items.extend(
        [
            "상관도가 높은 피처쌍은 중복 정보 가능성이 있으므로 피처 선택/변환 정책을 검토하세요.",
            "주기 재학습과 드리프트 모니터링을 운영 절차에 포함하세요.",
        ]
    )
    recommendation_items = "".join(f"<li>{item}</li>" for item in rec_items[:5])

    xai_meta = payload.get("xai_global") or {}
    xai_ref = xai_meta.get("reference") or {}

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
        source_data_ref=payload.get("data_ref") or "N/A",
        source_data_name=payload.get("data_name") or "N/A",
        training_time=(f"{float(payload.get('training_time')):.3f}s" if payload.get("training_time") is not None else "N/A"),
        model_feature_rows=_render_rank_rows(model_importance) or "<tr><td colspan='3'>피처 정보가 없습니다.</td></tr>",
        model_feature_bars=_render_bars(model_importance, top_n=5),
        xai_rows=_render_rank_rows(xai_features) if xai_features else "<tr><td colspan='3'>XAI 결과가 없습니다.</td></tr>",
        xai_bars=_render_bars(xai_features, top_n=5),
        xai_method=xai_meta.get("explanation_method", "N/A"),
        xai_runtime_ms=(f"{float(xai_meta.get('runtime_ms', 0.0)):.2f}" if xai_meta else "N/A"),
        xai_reference_file=xai_ref.get("source_file_name") or xai_ref.get("source_file", "N/A"),
        xai_reference_rows=xai_ref.get("rows_used", "N/A"),
        eda_quality_score=eda_summary.get("quality_score", "N/A"),
        eda_rows=eda_summary.get("rows", "N/A"),
        eda_columns=eda_summary.get("columns", "N/A"),
        eda_missing_ratio=_format_percent(eda_summary.get("missing_overall_ratio")),
        eda_duplicate_ratio=_format_percent(eda_summary.get("duplicate_ratio")),
        eda_warning_items=eda_warning_items,
        eda_corr_rows=corr_rows or "<tr><td colspan='4'>고상관 쌍이 없습니다.</td></tr>",
        recommendation_items=recommendation_items,
    )


def build_report(model_id: int) -> Path:
    base_payload = get_model_result(model_id)
    payload = _enrich_payload(base_payload)
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
