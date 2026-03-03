from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request


def _get_json(url: str) -> tuple[dict, float]:
    start = time.perf_counter()
    with urllib.request.urlopen(url) as res:
        payload = json.loads(res.read().decode("utf-8"))
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    return payload, elapsed_ms


def _post_json(url: str, payload: dict) -> tuple[dict, float]:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    start = time.perf_counter()
    with urllib.request.urlopen(req) as res:
        body = json.loads(res.read().decode("utf-8"))
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    return body, elapsed_ms


def main():
    parser = argparse.ArgumentParser(description="EDA/XAI 성능 스모크 점검")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--file-id", required=True)
    parser.add_argument("--model-id", required=True, type=int)
    parser.add_argument("--target-column", required=True)
    parser.add_argument("--feature-name", required=True)
    args = parser.parse_args()

    base = args.base_url.rstrip("/")

    summary, ms = _get_json(f"{base}/api/eda/{args.file_id}/summary")
    print(f"EDA summary: {ms:.1f} ms, quality_score={summary.get('quality_score')}")

    corr, ms = _get_json(
        f"{base}/api/eda/{args.file_id}/correlation?{urllib.parse.urlencode({'max_features': 30, 'threshold': 0.8})}"
    )
    print(f"EDA correlation: {ms:.1f} ms, features={len(corr.get('features', []))}")

    target_insight, ms = _post_json(
        f"{base}/api/eda/{args.file_id}/target-insight",
        {"target_column": args.target_column, "top_n": 8},
    )
    print(f"EDA target-insight: {ms:.1f} ms, task_type={target_insight.get('task_type')}")

    global_xai, ms = _get_json(
        f"{base}/api/xai/global/{args.model_id}?{urllib.parse.urlencode({'sample_size': 1000, 'top_n': 10})}"
    )
    print(
        "XAI global: "
        f"{ms:.1f} ms, method={global_xai.get('explanation_method')}, "
        f"cache_hit={global_xai.get('cache_hit')}"
    )

    pdp, ms = _post_json(
        f"{base}/api/xai/pdp",
        {
            "model_id": args.model_id,
            "feature_name": args.feature_name,
            "grid_points": 20,
            "sample_size": 1000,
            "use_cache": True,
        },
    )
    print(f"XAI pdp: {ms:.1f} ms, points={len(pdp.get('points', []))}, cache_hit={pdp.get('cache_hit')}")


if __name__ == "__main__":
    main()
