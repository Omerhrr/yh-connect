from tests.conftest import auth_headers


def _post_project(client, client_user):
    resp = client.post(
        "/api/v1/projects",
        json={
            "title": "Renovate a rooftop terrace",
            "description": "Waterproofing and tiling",
            "category_id": "civil-structural-engineering",
            "budget_min": 300000,
            "budget_max": 600000,
            "location": "Ikoyi, Lagos",
        },
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_professional_can_request_inspection(client, client_user, professional_user):
    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/access-requests",
        json={"request_type": "inspection", "note": "Available this weekend"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "pending"
    assert body["request_type"] == "inspection"


def test_duplicate_pending_request_rejected(client, client_user, professional_user):
    project = _post_project(client, client_user)
    client.post(
        f"/api/v1/projects/{project['id']}/access-requests",
        json={"request_type": "chat"},
        headers=auth_headers(professional_user["access_token"]),
    )
    resp = client.post(
        f"/api/v1/projects/{project['id']}/access-requests",
        json={"request_type": "chat"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 409


def test_client_can_reject_request(client, client_user, professional_user):
    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/access-requests",
        json={"request_type": "chat"},
        headers=auth_headers(professional_user["access_token"]),
    )
    req_id = resp.json()["id"]

    resp = client.patch(
        f"/api/v1/access-requests/{req_id}",
        json={"status": "rejected"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


def test_chat_approval_without_address_required(client, client_user, professional_user):
    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/access-requests",
        json={"request_type": "chat"},
        headers=auth_headers(professional_user["access_token"]),
    )
    req_id = resp.json()["id"]

    resp = client.patch(
        f"/api/v1/access-requests/{req_id}",
        json={"status": "approved"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


def test_inspection_approval_requires_address(client, client_user, professional_user):
    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/access-requests",
        json={"request_type": "inspection"},
        headers=auth_headers(professional_user["access_token"]),
    )
    req_id = resp.json()["id"]

    resp = client.patch(
        f"/api/v1/access-requests/{req_id}",
        json={"status": "approved"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 400

    resp = client.patch(
        f"/api/v1/access-requests/{req_id}",
        json={"status": "approved", "address": "12 Bourdillon Rd, Ikoyi", "phone": "08012345678"},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "approved"
    assert body["address"] == "12 Bourdillon Rd, Ikoyi"
    assert body["phone"] == "08012345678"


def test_approved_request_grants_messaging_eligibility(client, client_user, professional_user):
    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/access-requests",
        json={"request_type": "chat"},
        headers=auth_headers(professional_user["access_token"]),
    )
    req_id = resp.json()["id"]

    # Before approval, the professional has never bid/invited — messaging should be forbidden.
    resp = client.post(
        f"/api/v1/projects/{project['id']}/messages",
        json={"recipient_id": client_user["user"]["id"], "body": "Hi there"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 403

    client.patch(
        f"/api/v1/access-requests/{req_id}",
        json={"status": "approved"},
        headers=auth_headers(client_user["access_token"]),
    )

    resp = client.post(
        f"/api/v1/projects/{project['id']}/messages",
        json={"recipient_id": client_user["user"]["id"], "body": "Hi there"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text


def test_other_professional_cannot_respond_to_request(client, client_user, professional_user):
    project = _post_project(client, client_user)
    resp = client.post(
        f"/api/v1/projects/{project['id']}/access-requests",
        json={"request_type": "chat"},
        headers=auth_headers(professional_user["access_token"]),
    )
    req_id = resp.json()["id"]

    resp = client.patch(
        f"/api/v1/access-requests/{req_id}",
        json={"status": "approved"},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 403


def test_client_can_list_project_access_requests(client, client_user, professional_user):
    project = _post_project(client, client_user)
    client.post(
        f"/api/v1/projects/{project['id']}/access-requests",
        json={"request_type": "inspection"},
        headers=auth_headers(professional_user["access_token"]),
    )
    resp = client.get(
        f"/api/v1/projects/{project['id']}/access-requests",
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_professional_can_list_own_requests(client, client_user, professional_user):
    project = _post_project(client, client_user)
    client.post(
        f"/api/v1/projects/{project['id']}/access-requests",
        json={"request_type": "chat"},
        headers=auth_headers(professional_user["access_token"]),
    )
    resp = client.get("/api/v1/access-requests/mine", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200
    assert len(resp.json()) == 1
