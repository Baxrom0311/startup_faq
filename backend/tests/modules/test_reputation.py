import uuid
from sqlmodel import Session

from app.models import Problem, Project, ReviewCreate, CommentCreate, User
from app.modules.problems.lifecycle import transition_problem
from app.modules.projects.service import complete_project_with_review
from app.api.routes.problems import vote_problem, unvote_problem, create_comment
from tests.utils.user import create_random_user


def test_reputation_system_flow(db: Session, monkeypatch) -> None:
    # 1. Create author and solver
    author = create_random_user(db)
    solver = create_random_user(db)
    
    assert author.reputation == 0
    assert solver.reputation == 0
    
    # 2. Create problem in draft status
    problem = Problem(
        raw_text="This is a test problem.",
        author_id=author.id,
        status="draft",
    )
    db.add(problem)
    db.commit()
    db.refresh(problem)
    
    # Verify transitioning to published adds +5 reputation
    transition_problem(session=db, problem=problem, to_status="published", actor_id=author.id)
    db.commit()
    db.refresh(author)
    assert author.reputation == 5
    
    # Real Request for rate limiting (since the routes now use it)
    from fastapi import Request
    request = Request(scope={"type": "http", "path": "/api/v1/problems/vote", "headers": [], "client": ("127.0.0.1", 1234)})
    
    # 3. Test Voting (+1 reputation)
    # Refresh solver/author instances from db session to prevent StaleDataError
    author = db.get(User, author.id)
    solver = db.get(User, solver.id)
    
    # solver votes on author's problem
    vote_problem(session=db, request=request, current_user=solver, problem_id=problem.id)
    db.commit()
    db.refresh(author)
    assert author.reputation == 6
    
    # Test Unvoting (-1 reputation)
    author = db.get(User, author.id)
    solver = db.get(User, solver.id)
    unvote_problem(session=db, request=request, current_user=solver, problem_id=problem.id)
    db.commit()
    db.refresh(author)
    assert author.reputation == 5
    
    # 4. Test Commenting (+2 reputation)
    # solver comments on author's problem
    author = db.get(User, author.id)
    solver = db.get(User, solver.id)
    comment_in = CommentCreate(text="Interesting problem!")
    create_comment(
        session=db,
        request=request,
        current_user=solver,
        problem_id=problem.id,
        comment_in=comment_in,
    )
    db.commit()
    db.refresh(solver)
    assert solver.reputation == 2
    
    # 5. Test Project Completion (+20 reputation for solver/lead)
    # Claim problem to transition to claimed/piloting
    transition_problem(session=db, problem=problem, to_status="claimed", actor_id=solver.id)
    transition_problem(session=db, problem=problem, to_status="piloting", actor_id=solver.id)
    project = Project(
        title="Test project",
        problem_id=problem.id,
        lead_id=solver.id,
        status="piloting",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Complete project with review
    author = db.get(User, author.id)
    solver = db.get(User, solver.id)
    review_in = ReviewCreate(rating=5, comment="Great job!")
    complete_project_with_review(
        session=db,
        project=project,
        actor=author, # Author completes it (accepts the review)
        review_in=review_in,
    )
    db.commit()
    db.refresh(solver)
    
    # Solver had 2 (from comment) + 20 (from project completion) = 22 reputation
    assert solver.reputation == 22
