from tests.conftest import auth_headers
from tests.test_disputes import _post_project


def _hire(client, client_user, professional_user, amount=200000):
    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/bids",
        json={"amount": amount, "cover_letter": "I can do this", "estimated_days": 14},
        headers=auth_headers(professional_user["access_token"]),
    )
    bid = resp.json()
    resp = client.patch(f"/api/v1/bids/{bid['id']}", json={"status": "accepted"}, headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    return project


def _thread(client, headers, project_id, other_user_id):
    resp = client.get(f"/api/v1/projects/{project_id}/messages?other_user_id={other_user_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_milestone_creation_logs_a_system_message(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Foundation work", "description": "", "amount": 50000},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text

    messages = _thread(client, auth_headers(client_user["access_token"]), project["id"], professional_user["user"]["id"])
    system_msgs = [m for m in messages if m["message_type"] == "system"]
    assert any("Foundation work" in m["body"] for m in system_msgs)


def test_milestone_lifecycle_logs_system_messages(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Wiring", "description": "", "amount": 40000},
        headers=auth_headers(client_user["access_token"]),
    )
    milestone = resp.json()

    client.post("/api/v1/wallet/topup", json={"amount": 500000}, headers=auth_headers(client_user["access_token"]))
    resp = client.post(f"/api/v1/milestones/{milestone['id']}/fund", json={}, headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text

    resp = client.post(f"/api/v1/milestones/{milestone['id']}/approve", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text

    messages = _thread(client, auth_headers(client_user["access_token"]), project["id"], professional_user["user"]["id"])
    bodies = " | ".join(m["body"] for m in messages if m["message_type"] == "system")
    assert "funded" in bodies.lower()
    assert "approved" in bodies.lower()
    assert "released" in bodies.lower()


def test_change_order_events_logged(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/change-orders",
        json={"description": "Add extra fencing", "amount_delta": 15000},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    co = resp.json()

    resp = client.patch(f"/api/v1/change-orders/{co['id']}?status=approved", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text

    messages = _thread(client, auth_headers(client_user["access_token"]), project["id"], professional_user["user"]["id"])
    bodies = " | ".join(m["body"] for m in messages if m["message_type"] == "system")
    assert "change order" in bodies.lower()
    assert "approved" in bodies.lower()


def test_general_project_update_posts_a_real_message(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/updates",
        json={"note": "We'll be on site tomorrow at 9am."},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["message_type"] == "update"
    assert body["sender_id"] == professional_user["user"]["id"]

    messages = _thread(client, auth_headers(client_user["access_token"]), project["id"], professional_user["user"]["id"])
    assert any(m["message_type"] == "update" and "9am" in m["body"] for m in messages)


def test_project_update_rejects_non_party(client, client_user, professional_user):
    project = _post_project(client, client_user)  # not hired, no professional assigned
    resp = client.post(
        f"/api/v1/projects/{project['id']}/updates",
        json={"note": "hi"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 403, resp.text


def test_project_update_empty_rejected(client, client_user, professional_user):
    project = _hire(client, client_user, professional_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/updates",
        json={"note": "   "},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 400, resp.text


def test_message_emails_when_recipient_offline(client, client_user, professional_user, monkeypatch):
    from app.services import ws_manager as ws_manager_module

    monkeypatch.setattr(ws_manager_module.manager, "is_online", lambda user_id: False)

    project = _hire(client, client_user, professional_user)
    sent = {}

    def fake_send_notification_email(to, name, title, body, link=None):
        sent["to"] = to

    import app.services.notify as notify_module
    monkeypatch.setattr(notify_module, "send_notification_email", fake_send_notification_email)

    resp = client.post(
        f"/api/v1/projects/{project['id']}/messages",
        json={"recipient_id": client_user["user"]["id"], "body": "hello"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    assert sent.get("to") == client_user["user"]["email"]


def test_message_no_email_when_recipient_online(client, client_user, professional_user, monkeypatch):
    from app.services import ws_manager as ws_manager_module

    monkeypatch.setattr(ws_manager_module.manager, "is_online", lambda user_id: True)

    project = _hire(client, client_user, professional_user)
    sent = {}

    def fake_send_notification_email(to, name, title, body, link=None):
        sent["to"] = to

    import app.services.notify as notify_module
    monkeypatch.setattr(notify_module, "send_notification_email", fake_send_notification_email)

    resp = client.post(
        f"/api/v1/projects/{project['id']}/messages",
        json={"recipient_id": client_user["user"]["id"], "body": "hello"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    assert "to" not in sent
