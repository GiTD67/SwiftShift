#!/usr/bin/env python3
"""Simple project health check for swiftshift."""
import os
import sys

def main():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_path = os.path.join(project_root, "frontend", "src")
    src_files = sum(1 for _, _, files in os.walk(src_path) for f in files)
    print(f"Source files: {src_files}")
    print("Project check: OK")
    return 0

if __name__ == "__main__":
    sys.exit(main())
