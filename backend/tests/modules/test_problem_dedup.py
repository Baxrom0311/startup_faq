from app.modules.problems.dedup import normalize_problem_text, similarity_score


def test_normalize_problem_text_removes_case_and_punctuation() -> None:
    assert normalize_problem_text("  Suv, BOSIMI!!! past  ") == "suv bosimi past"


def test_similarity_score_detects_close_text() -> None:
    left = normalize_problem_text("Issiqxonada suv bosimini nazorat qilish qiyin")
    right = normalize_problem_text("issiqxonada suv bosimini nazorat qilish juda qiyin")

    assert similarity_score(left, right) > 0.88


def test_similarity_score_rejects_empty_text() -> None:
    assert similarity_score("", "suv") == 0
