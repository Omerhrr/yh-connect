from tests.conftest import auth_headers

def test_username_suggestions_are_available(client, professional_user):
    resp = client.get("/api/v1/auth/username/suggestions", headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text
    suggestions = resp.json()["suggestions"]
    assert len(suggestions) >= 1
    for s in suggestions:
        assert 3 <= len(s) <= 20

def test_set_username_success(client, professional_user):
    headers = auth_headers(professional_user["access_token"])
    resp = client.patch("/api/v1/auth/me", json={"username": "paulpro"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["username"] == "paulpro"

def test_username_taken_is_rejected(client, professional_user, client_user):
    resp = client.patch("/api/v1/auth/me", json={"username": "sharedname"}, headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text

    resp = client.patch("/api/v1/clients/me", json={"username": "sharedname"}, headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 409, resp.text
    assert "taken" in resp.json()["detail"].lower()

def test_username_invalid_format_rejected(client, professional_user):
    headers = auth_headers(professional_user["access_token"])
    for bad in ["ab", "Has-Dash", "way.too.long.for.the.limit.set"]:
        resp = client.patch("/api/v1/auth/me", json={"username": bad}, headers=headers)
        assert resp.status_code == 400, f"{bad!r} should be rejected: {resp.text}"

def test_username_check_endpoint(client, professional_user):
    headers = auth_headers(professional_user["access_token"])
    resp = client.patch("/api/v1/auth/me", json={"username": "takenhandle"}, headers=headers)
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/auth/username/check?username=takenhandle", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["available"] is True

    resp = client.get("/api/v1/auth/username/check?username=freshhandle123", headers=headers)
    assert resp.json()["available"] is True

def test_client_can_also_set_username(client, client_user):
    resp = client.patch("/api/v1/clients/me", json={"username": "clienthandle"}, headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["username"] == "clienthandle"

def test_search_by_username_finds_professional(client, professional_user, client_user):
    resp = client.patch("/api/v1/auth/me", json={"username": "findmepro"}, headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/auth/users/search?q=findme", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    usernames = [r["username"] for r in resp.json()]
    assert "findmepro" in usernames

def test_professionals_list_matches_exact_username(client, professional_user, client_user):
    resp = client.patch("/api/v1/auth/me", json={"username": "engineerpaul"}, headers=auth_headers(professional_user["access_token"]))
    assert resp.status_code == 200, resp.text

    resp = client.get("/api/v1/professionals?q=@engineerpaul", headers=auth_headers(client_user["access_token"]))
    assert resp.status_code == 200, resp.text
    results = resp.json()
    assert len(results) == 1
    assert results[0]["first_name"] == "Paul"
