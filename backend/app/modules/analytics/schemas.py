from sqlmodel import SQLModel


class AnalyticsOverview(SQLModel):
    submitted_problems: int
    published_problems: int
    claimed_problems: int
    piloting_problems: int
    solved_problems: int
    proposed_projects: int
    active_projects: int
    completed_projects: int
    problem_to_claim_rate: float
    claim_to_solved_rate: float
