from tests.conftest import auth_headers
from tests.test_disputes import _hire_and_fund, _post_project


def test_matching_professional_notified_on_project_post(client, client_user, professional_user):
    # The professional's profile is seeded with a category during fixture
    # setup (see conftest); posting a project in that same category should
    # generate a notification for them, even before they've bid on anything.
    resp = client.get("/api/v1/notifications", headers=auth_headers(professional_user["access_token"]))
    before = len(resp.json())

    _post_project(client, client_user)

    resp = client.get("/api/v1/notifications", headers=auth_headers(professional_user["access_token"]))
    after = resp.json()
    assert len(after) > before
    assert any("New project in your category" in n["title"] for n in after)


def test_client_payment_verified_after_funding(client, client_user, professional_user, db_session_factory):
    # Before ever funding anything, the client shouldn't be payment-verified.
    resp = client.get(f"/api/v1/clients/{client_user['user']['id']}", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["payment_verified"] is False

    project, milestone_id = _hire_and_fund(client, client_user, professional_user)

    resp = client.get(f"/api/v1/clients/{client_user['user']['id']}", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["payment_verified"] is True

    # And it should also show up on the project itself, not just the client profile.
    resp = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["client_payment_verified"] is True
