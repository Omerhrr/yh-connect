from datetime import datetime, timedelta

from tests.conftest import auth_headers
from tests.test_disputes import _hire_and_fund


def _set_platform_setting(db_session_factory, key, value):
    from app.models.platform_setting import PlatformSetting
    db = db_session_factory()
    row = db.get(PlatformSetting, key)
    if row:
        row.value = value
    else:
        db.add(PlatformSetting(key=key, value=value))
    db.commit()
    db.close()


def test_milestone_auto_releases_after_window(client, client_user, professional_user, db_session_factory):
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)

    # Give the professional payout details and shrink the auto-release
    # window so the test doesn't need to wait days.
    from app.models.profile import ProfessionalProfile
    from app.models.milestone import Milestone
    db = db_session_factory()
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == professional_user["user"]["id"]).first()
    profile.bank_code = "044"
    profile.bank_account_number = "0123456789"
    profile.bank_account_name = "Paul Pro"
    db.commit()
    db.close()
    _set_platform_setting(db_session_factory, "milestone_auto_release_days", "1")

    resp = client.post(f"/api/v1/milestones/{milestone_id}/submit", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "funded"  # already funded, submit doesn't regress it
    assert resp.json()["submitted_at"] is not None

    # Backdate submitted_at as if the client went quiet for 2 days.
    db = db_session_factory()
    m = db.get(Milestone, milestone_id)
    m.submitted_at = datetime.utcnow() - timedelta(days=2)
    db.commit()
    db.close()

    pro_balance_before = client.get(
        "/api/v1/auth/me", headers=auth_headers(professional_user["access_token"])
    ).json()["wallet_balance"]

    # Listing milestones (what the project workspace does on load) is the
    # trigger point for the lazy auto-release check.
    resp = client.get(f"/api/v1/projects/{project['id']}/milestones", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    milestone = resp.json()[0]
    assert milestone["status"] == "paid"

    pro_balance_after = client.get(
        "/api/v1/auth/me", headers=auth_headers(professional_user["access_token"])
    ).json()["wallet_balance"]
    assert pro_balance_after > pro_balance_before


def test_milestone_reminder_sent_before_auto_release(client, client_user, professional_user, db_session_factory):
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)
    _set_platform_setting(db_session_factory, "milestone_auto_release_days", "10")

    resp = client.post(f"/api/v1/milestones/{milestone_id}/submit", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text

    from app.models.milestone import Milestone, MilestoneStatus
    db = db_session_factory()
    m = db.get(Milestone, milestone_id)
    # 9 days in: past the reminder threshold (10 - 2 = 8), before auto-release (10).
    m.submitted_at = datetime.utcnow() - timedelta(days=9)
    db.commit()
    db.close()

    resp = client.get(f"/api/v1/projects/{project['id']}/milestones", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    milestone = resp.json()[0]
    # Not auto-released yet, still funded.
    assert milestone["status"] == "funded"

    db = db_session_factory()
    m = db.get(Milestone, milestone_id)
    assert m.auto_release_reminder_sent is True
    db.close()
