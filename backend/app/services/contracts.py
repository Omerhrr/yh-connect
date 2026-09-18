"""Generation of the scope-of-work contract. A bid acceptance no longer
auto-generates this — the client defines the milestone plan first (see
create_milestone in api/v1/milestones.py), then explicitly generates the
contract (see generate_contract in api/v1/contracts.py), which embeds that
milestone plan into the contract text. Sits between acceptance and job
commencement — see app/models/contract.py."""

from datetime import datetime

from app.models.bid import Bid
from app.models.milestone import Milestone
from app.models.project import Project


def _milestone_plan_section(milestones: list[Milestone] | None) -> str:
    if not milestones:
        return "No milestones have been defined yet."

    ordered = sorted(milestones, key=lambda m: m.sort_order)
    lines = []
    total = 0.0
    for i, m in enumerate(ordered, start=1):
        due = f" — due {m.due_date.strftime('%Y-%m-%d')}" if m.due_date else ""
        lines.append(f"{i}. {m.title} — ₦{m.amount:,.2f}{due}")
        if m.description:
            lines.append(f"   {m.description}")
        total += m.amount

    lines.append("")
    lines.append(f"Total milestoned: ₦{total:,.2f}")
    return "\n".join(lines)


def generate_contract_content(project: Project, bid: Bid | None, milestones: list[Milestone] | None = None) -> str:
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

6. MILESTONE PLAN
{_milestone_plan_section(milestones)}

7. TERMS
Work will proceed in milestones, per the milestone plan above. Each milestone must be
funded by the client into escrow before work begins on it, and released to the
professional once the client approves the submitted work, in line with the platform's
standard payment protection policy.

This contract was generated from the accepted proposal and the agreed milestone plan.
Either party may edit the scope of work above before both sides approve it. Work does
not commence until this contract is approved by both the client and the professional,
and the required acceptance fee (if any) has been paid.
"""
