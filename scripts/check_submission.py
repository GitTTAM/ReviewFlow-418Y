"""Optional Python 3.8+ report-accounting check; does not certify behavior."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
data = json.loads((root / "docs/story-status.json").read_text(encoding="utf-8"))
assert {s["id"] for s in data["mvp"]} == {"US-%02d" % n for n in range(1, 11)}
assert len(data["mvp"]) == 10
assert {s["id"] for s in data["stretch"]} == {"US-11", "US-12", "US-13"}
assert sum(data["effort"].values()) == 100
assert data["effort"]["Joint work"] == 25
assert all(v == 15 for k, v in data["effort"].items() if k != "Joint work")
for story in data["mvp"]:
    assert story["status"] in ("Complete", "Incomplete")
    if story["status"] == "Complete":
        assert story.get("evidence"), story["id"]
        for evidence in story["evidence"]:
            assert (root / evidence).is_file(), evidence
    else:
        assert story.get("remaining"), story["id"]
for filename in ("README.md", "docs/TEAM_HANDOFF.md", "docs/DEMO_OUTLINE.md", "docs/VERIFICATION.md"):
    assert (root / filename).is_file(), filename
complete = sum(s["status"] == "Complete" for s in data["mvp"])
print("Declared MVP completion: %d/10 (%d%%). Stretch excluded." % (complete, complete * 10))
print("Effort: 25% joint + 15% each = 100%. Required files/evidence exist.")
print("M4 60%% threshold: %s. Run behavior tests before claiming stories." % ("met" if complete >= 6 else "NOT met"))
