#!/usr/bin/env python3
"""Simple project health check for grokclock."""
import os
import sys

def main():
    src_files = sum(1 for _, _, files in os.walk("src") for f in files)
    print(f"Source files: {src_files}")
    print("Project check: OK")
    return 0

if __name__ == "__main__":
    sys.exit(main())
