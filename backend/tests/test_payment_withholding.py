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


def test_approve_with_no_withholding_pays_in_full(client, client_user, professional_user, db_session_factory):
    """Default (0%) behaves exactly like before this feature existed."""
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)
    client.post(f"/api/v1/milestones/{milestone_id}/submit", headers=auth_headers(professional_user["access_token"]))

    resp = client.post(f"/api/v1/milestones/{milestone_id}/approve", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "paid"
    assert body["withheld_amount"] is None
    assert body["withheld_release_at"] is None


def test_approve_with_withholding_splits_payout(client, client_user, professional_user, db_session_factory):
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)
    _set_platform_setting(db_session_factory, "payment_withholding_percent", "20")
    _set_platform_setting(db_session_factory, "payment_withholding_release_days", "7")

    client.post(f"/api/v1/milestones/{milestone_id}/submit", headers=auth_headers(professional_user["access_token"]))

    balance_before = client.get("/api/v1/auth/me", headers=auth_headers(professional_user["access_token"])).json()["wallet_balance"]

    resp = client.post(f"/api/v1/milestones/{milestone_id}/approve", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "paid"

    # 100000 amount, 5% platform fee -> 95000 net. 20% withheld -> 19000 held, 76000 released now.
    assert body["withheld_amount"] == 19000.0
    assert body["withheld_release_at"] is not None
    assert body["withheld_released_at"] is None

    balance_after = client.get("/api/v1/auth/me", headers=auth_headers(professional_user["access_token"])).json()["wallet_balance"]
    assert balance_after == balance_before + 76000.0


def test_withheld_amount_auto_releases_after_delay(client, client_user, professional_user, db_session_factory):
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)
    _set_platform_setting(db_session_factory, "payment_withholding_percent", "20")
    _set_platform_setting(db_session_factory, "payment_withholding_release_days", "7")

    client.post(f"/api/v1/milestones/{milestone_id}/submit", headers=auth_headers(professional_user["access_token"]))
    resp = client.post(f"/api/v1/milestones/{milestone_id}/approve", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text

    balance_after_release = client.get("/api/v1/auth/me", headers=auth_headers(professional_user["access_token"])).json()["wallet_balance"]

    # Backdate the release date as if the holdback window has already passed.
    from app.models.milestone import Milestone
    db = db_session_factory()
    m = db.get(Milestone, milestone_id)
    m.withheld_release_at = datetime.utcnow() - timedelta(days=1)
    db.commit()
    db.close()

    # Viewing transactions (Earnings page) is the lazy trigger point.
    resp = client.get("/api/v1/wallet/transactions", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text

    balance_after_holdback_release = client.get("/api/v1/auth/me", headers=auth_headers(professional_user["access_token"])).json()["wallet_balance"]
    assert balance_after_holdback_release == balance_after_release + 19000.0


def test_pending_holdbacks_endpoint_reports_total_and_next_release(client, client_user, professional_user, db_session_factory):
    project, milestone_id = _hire_and_fund(client, client_user, professional_user)
    _set_platform_setting(db_session_factory, "payment_withholding_percent", "20")
    _set_platform_setting(db_session_factory, "payment_withholding_release_days", "7")

    client.post(f"/api/v1/milestones/{milestone_id}/submit", headers=auth_headers(professional_user["access_token"]))
    client.post(f"/api/v1/milestones/{milestone_id}/approve", headers=auth_headers(client_user["access_token"]))

    resp = client.get("/api/v1/wallet/pending-holdbacks", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total_pending"] == 19000.0
    assert body["count"] == 1
    assert body["next_release_at"] is not None


def test_payment_policy_endpoint_reflects_admin_settings(client, client_user, db_session_factory):
    _set_platform_setting(db_session_factory, "payment_withholding_percent", "15")
    _set_platform_setting(db_session_factory, "payment_withholding_release_days", "10")

    resp = client.get("/api/v1/wallet/payment-policy", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["withholding_percent"] == 15.0
    assert body["withholding_release_days"] == 10.0
