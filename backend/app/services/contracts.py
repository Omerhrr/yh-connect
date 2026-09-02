"""Auto-generation of the scope-of-work contract created the moment a bid
is accepted (see _finalize_acceptance in api/v1/bids.py). Sits between
acceptance and job commencement — see app/models/contract.py."""

from datetime import datetime

from app.models.bid import Bid
from app.models.project import Project


def generate_contract_content(project: Project, bid: Bid) -> str:
    amount = bid.amount if bid else ((project.budget_min + project.budget_max) / 2)
    timeline = project.timeline or "As agreed between both parties"
    skills = ", ".join(project.skills_list) if project.skills_list else "As described in the project brief"
    days = f"{bid.estimated_days} days" if bid and bid.estimated_days else "As agreed between both parties"

    return f"""SERVICE CONTRACT

Project: {project.title}
Date generated: {datetime.utcnow().strftime('%Y-%m-%d')}

1. SCOPE OF WORK
{project.description}

2. SKILLS / TRADE
{skills}

3. AGREED PRICE
₦{amount:,.2f}

4. ESTIMATED DURATION
{days}

5. PROJECT TIMELINE
{timeline}

6. TERMS
Work will proceed in milestones. Each milestone must be funded by the client into escrow
before work begins on it, and released to the professional once the client approves the
submitted work, in line with the platform's standard payment protection policy.

This contract was auto-generated from the accepted proposal. Either party may edit the
scope of work above before both sides approve it. Work does not commence until this
contract is approved by both the client and the professional, and the required
acceptance fee (if any) has been paid.
"""
