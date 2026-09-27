#!/usr/bin/env python3
"""PreToolUse hook (Bash): refuses what would change `staging` or `main` outside a pull request, and
anything that skips the git hooks. Both branches deploy (staging, production): they only move through
pull requests. Exit 2 blocks the command and tells the agent why.

Blocked:
  git push ... main | staging | HEAD:main | +staging | refs/heads/main ...   (explicit target)
  git push [remote]                   while on main or staging (implicit target)
  git push --all | --mirror
  git push --no-verify, git commit --no-verify | -n
"""
from __future__ import annotations

import json
import re
import shlex
import subprocess
import sys

PROTECTED = {"main", "staging"}


def block(reason: str) -> None:
    print(f"Blocked by .claude/hooks/guard-git.py: {reason}", file=sys.stderr)
    sys.exit(2)


def current_branch(repo: str | None) -> str:
    args = ["git"] + (["-C", repo] if repo else []) + ["branch", "--show-current"]
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception:
        return ""


def git_subcommand(tokens: list[str]) -> tuple[str | None, str | None, list[str]]:
    """(repo from -C, subcommand, its arguments) for `git [globals] <sub> args`, else Nones."""
    # The command itself, past environment assignments (FOO=bar git push) and `command`/`exec`.
    words = [t for t in tokens if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", t)]
    while words and words[0] in ("command", "exec", "sudo"):
        words = words[1:]
    if not words or words[0] != "git":
        return None, None, []
    rest = words[1:]
    repo = None
    i = 0
    while i < len(rest) and rest[i].startswith("-"):
        if rest[i] in ("-C", "-c") and i + 1 < len(rest):
            if rest[i] == "-C":
                repo = rest[i + 1]
            i += 2
        else:
            i += 1
    if i >= len(rest):
        return repo, None, []
    return repo, rest[i], rest[i + 1 :]


def main() -> None:
    data = json.load(sys.stdin)
    command = data.get("tool_input", {}).get("command", "")
    cwd = data.get("cwd")
    for segment in re.split(r"&&|\|\||;|\||\n", command):
        try:
            tokens = shlex.split(segment)
        except ValueError:
            tokens = segment.split()
        repo, sub, args = git_subcommand(tokens)
        if sub == "commit" and ("--no-verify" in args or "-n" in args):
            block("git commit --no-verify skips the commit hooks. Fix what they report instead.")
        if sub != "push":
            continue
        if "--no-verify" in args:
            block("git push --no-verify skips the pre-push hook.")
        if "--all" in args or "--mirror" in args:
            block("git push --all/--mirror would update staging and main. Push one feature branch.")
        positional = [a for a in args if not a.startswith("-")]
        refspecs = positional[1:]
        if refspecs:
            targets = {r.lstrip("+").split(":")[-1].removeprefix("refs/heads/") for r in refspecs}
        else:
            targets = {current_branch(repo or cwd)}
        hit = PROTECTED & targets
        if hit:
            block(
                f"pushing to {', '.join(sorted(hit))} is forbidden: they deploy. Push a feature branch "
                "and open a pull request into staging (then staging into main)."
            )


if __name__ == "__main__":
    main()
