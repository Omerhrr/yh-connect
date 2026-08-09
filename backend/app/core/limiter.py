"""Simple in-process rate limiter (per-IP) for auth endpoints, brute force
protection on login/register/forgot-password. In-memory, so it resets on
restart and doesn't share state across multiple backend instances, fine for
a single-instance deployment; swap the storage_uri for Redis if scaling out
to more than one process.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
