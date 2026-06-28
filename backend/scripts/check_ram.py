# backend/scripts/check_ram.py
"""
Estimates RAM usage of the new stack.
Run: python scripts/check_ram.py
"""
import tracemalloc
import sys

tracemalloc.start()

print("Importing FastAPI...", end=" ", flush=True)
import fastapi
print("OK")

print("Importing spaCy...", end=" ", flush=True)
import spacy
nlp = spacy.load("en_core_web_sm")
print("OK")

print("Importing qdrant_client...", end=" ", flush=True)
import qdrant_client
print("OK")

print("Importing groq...", end=" ", flush=True)
import groq
print("OK")

print("Importing neo4j...", end=" ", flush=True)
import neo4j
print("OK")

print("Importing PyMuPDF...", end=" ", flush=True)
import fitz
print("OK")

print("Importing httpx...", end=" ", flush=True)
import httpx
print("OK")

current, peak = tracemalloc.get_traced_memory()
tracemalloc.stop()

print(f"\nPeak RAM usage: {peak / 1024 / 1024:.1f} MB")
print(f"Render free tier limit: 512 MB")
print(f"Headroom: {512 - peak / 1024 / 1024:.1f} MB")

if peak / 1024 / 1024 < 300:
    print("OK: Well within limits — safe to deploy")
elif peak / 1024 / 1024 < 450:
    print("WARNING: Within limits but tight — monitor on Render")
else:
    print("ERROR: Too close to limit — further optimization needed")
