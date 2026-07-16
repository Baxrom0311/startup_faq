from app.modules.analytics.schemas import AnalyticsOverview


def test_analytics_overview_schema() -> None:
    overview = AnalyticsOverview(
        submitted_problems=10,
        ai_processing_problems=1,
        needs_review_problems=2,
        published_problems=4,
        claimed_problems=2,
        piloting_problems=1,
        solved_problems=1,
        proposed_projects=3,
        active_projects=2,
        completed_projects=1,
        problem_to_claim_rate=0.4,
        claim_to_solved_rate=0.25,
    )

    assert overview.solved_problems == 1
    assert overview.problem_to_claim_rate == 0.4
