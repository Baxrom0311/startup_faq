from app.worker.tasks.analyze_problem import _build_summary, _build_title


def test_build_title_keeps_short_text() -> None:
    assert _build_title("Suv nazorati qiyin") == "Suv nazorati qiyin"


def test_build_title_truncates_long_text() -> None:
    title = _build_title("a" * 120)
    assert len(title) <= 90
    assert title.endswith("...")


def test_build_summary_truncates_long_text() -> None:
    summary = _build_summary("b" * 260)
    assert len(summary) <= 220
    assert summary.endswith("...")
