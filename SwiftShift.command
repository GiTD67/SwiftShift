#!/bin/bash
#
# One-click launcher: opens Claude Code in the SwiftShift project using
# Claude Opus 4.8, with permission prompts fully skipped.
#
# Double-click this file in Finder to start. A Terminal window opens,
# Claude Code starts in your SwiftShift folder, and you can just start
# typing what you want changed on your website.
#
# When Claude makes a change it will automatically commit and push to the
# `main` branch (see CLAUDE.md in this folder), which triggers Railway to
# redeploy your live site — exactly like editing on github.com.

# Always run from the folder this script lives in (the SwiftShift repo),
# no matter where it's launched from.
cd "$(dirname "$0")" || exit 1

clear
echo "============================================================"
echo "  SwiftShift  ·  Claude Opus 4.8  ·  permissions skipped"
echo "------------------------------------------------------------"
echo "  Folder: $(pwd)"
echo "  Just type what you want changed. Claude will edit the"
echo "  files, then auto commit + push to main (live site updates)."
echo "  Type  exit  or press Ctrl-C twice to quit."
echo "============================================================"
echo

# Launch Claude Code:
#   --model opus                   use the latest Opus (4.8) — alias stays
#                                  correct across future updates
#   --dangerously-skip-permissions run without per-action approval prompts
claude --model opus --dangerously-skip-permissions

# Keep the window open after Claude exits so you can read any final output.
echo
echo "Claude Code session ended. You can close this window."
