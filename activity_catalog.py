"""Shared server catalog; JSON is also imported by the isolated local preview."""
import json
from pathlib import Path

CATALOG=json.loads(Path(__file__).with_name("activity_catalog.json").read_text(encoding="utf-8"))
TASKS=CATALOG["tasks"]
ACHIEVEMENTS={item["game"]:item for item in CATALOG["achievements"]}
if len({task["id"] for task in TASKS}) != len(TASKS):
    raise ValueError("Duplicate task ID")
for task in TASKS:
    if task["kind"] not in ("runs","distinct_games","best","total") or task["target"] <= 0:
        raise ValueError("Invalid task definition")
for item in ACHIEVEMENTS.values():
    scores=[step["score"] for step in item["steps"]]
    if scores != sorted(set(scores)) or any(score<=0 for score in scores):
        raise ValueError("Achievement scores must be positive and increasing")
    if any(step["amount"]<0 for step in item["steps"]):
        raise ValueError("Achievement rewards must not be negative")
