"""Helpers for reconciling a payout bank account's resolved name against the
professional's own account name, so withdrawals only ever go to an account
that's plausibly theirs (see PayoutAccount.name_match / wallet.py withdraw)."""

import re

def _normalize(name: str) -> set[str]:
    words = re.findall(r"[a-z]+", name.lower())

    return {w for w in words if len(w) > 1}

def names_match(user_full_name: str, resolved_account_name: str) -> bool:
    """True if the bank's resolved account holder name plausibly belongs to
    the user. Doesn't require an exact string match (bank records commonly
    order/format names differently, e.g. "OKAFOR CHIDI JOHN" vs "Chidi John
    Okafor") — instead requires that most of the user's own name words show
    up in the account name, so a totally different person's account is
    rejected but formatting differences aren't."""
    user_words = _normalize(user_full_name)
    account_words = _normalize(resolved_account_name)
    if not user_words or not account_words:
        return False
    overlap = user_words & account_words

    return len(overlap) >= max(1, (len(user_words) + 1) // 2)
