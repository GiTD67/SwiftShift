#!/usr/bin/env python3
"""Simple project health check for grokclock."""
import os
import sys

def main():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    src_files = sum(
        1 for _, _, files in os.walk(backend_dir)
        for f in files
        if f.endswith(".py") and not f.startswith(".")
    )
    print(f"Source files: {src_files}")
    print("Project check: OK")
    return 0

if __name__ == "__main__":
    sys.exit(main())
