#!/bin/bash
# One-shot: push the already-made local commit to GitHub main (triggers Render deploy).
cd "$(dirname "$0")" || exit 1
echo "Pushing local commits to GitHub main..."
if git push origin main; then
  echo
  echo "Pushed. Render is redeploying swiftshift.work now."
else
  echo
  echo "Push failed — usually a GitHub sign-in issue. Re-run after signing in."
fi
echo
read -r -p "Press Return to close this window."
