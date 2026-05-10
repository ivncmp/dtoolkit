#!/usr/bin/env python3
"""
Fact Search — search the PARA knowledge graph.

Searches facts in the configured life directory using keywords + simple ranking.

Usage:
    search_facts.py <query> [--limit N] [--collection <name>] [--life-dir <path>]

Examples:
    search_facts.py "react typescript"
    search_facts.py "database migration" --limit 10
    search_facts.py "stack" --collection projects --life-dir ~/my-kb
"""

import json
import sys
import re
from pathlib import Path
from typing import List, Dict, Tuple
from datetime import datetime

DEFAULT_LIMIT = 20

def normalize_text(text: str) -> str:
    """Normalize text for search (lowercase, strip accents)."""
    text = text.lower()
    replacements = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'ü': 'u', 'ñ': 'n'
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text

def score_fact(fact: Dict, query_terms: List[str], entity_name: str) -> float:
    """
    Calculate relevance score for a fact.

    Factors:
    - Matches in fact text (weight 10)
    - Matches in entity name (weight 5)
    - accessCount (weight 1)
    - Tier hot/warm (boost)
    """
    score = 0.0
    fact_text = normalize_text(fact.get('fact', ''))
    entity_norm = normalize_text(entity_name)

    # Matches in fact text
    for term in query_terms:
        if term in fact_text:
            score += 10.0
            # Bonus for exact word match
            if re.search(r'\b' + re.escape(term) + r'\b', fact_text):
                score += 5.0

    # Matches in entity name
    for term in query_terms:
        if term in entity_norm:
            score += 5.0

    # Access count (popularity)
    score += fact.get('accessCount', 0) * 1.0

    # Tier boost (recently accessed facts are more relevant)
    last_accessed = fact.get('lastAccessed', '')
    if last_accessed:
        try:
            accessed_date = datetime.fromisoformat(last_accessed).date()
            days_ago = (datetime.now().date() - accessed_date).days
            if days_ago <= 7:
                score *= 1.5  # Hot boost
            elif days_ago <= 30:
                score *= 1.2  # Warm boost
        except (ValueError, TypeError):
            pass

    return score

def search_in_entity(entity_path: Path, query_terms: List[str]) -> List[Tuple[float, Dict, str, str]]:
    """Search within a specific entity."""
    items_path = entity_path / "items.json"
    if not items_path.exists():
        return []

    try:
        with open(items_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, IOError):
        return []

    entity_name = data.get('entity', entity_path.name)
    entity_type = data.get('type', 'unknown')
    facts = data.get('facts', [])

    results = []
    for fact in facts:
        score = score_fact(fact, query_terms, entity_name)
        if score > 0:
            results.append((score, fact, entity_name, entity_type))

    return results

def search_facts(query: str, life_dir: Path, collection: str = None, limit: int = DEFAULT_LIMIT) -> List[Dict]:
    """
    Search facts in the life directory.

    Args:
        query: Search query (space-separated keywords)
        life_dir: Root directory of the PARA knowledge base
        collection: Filter by collection (projects, people, companies, resources, systems, events)
        limit: Maximum number of results

    Returns:
        List of results sorted by relevance
    """
    # Normalize query
    query_norm = normalize_text(query)
    query_terms = [term for term in query_norm.split() if len(term) >= 2]

    if not query_terms:
        return []

    # Determine paths to search
    search_paths = []

    if collection:
        # Map collection names to base directories for scoped search
        collection_map = {
            'projects': life_dir / 'projects',
            'people': life_dir / 'areas' / 'people',
            'companies': life_dir / 'areas' / 'companies',
            'resources': life_dir / 'resources',
            'systems': life_dir / 'areas' / 'systems',
            'events': life_dir / 'areas' / 'events',
        }
        if collection in collection_map:
            base = collection_map[collection]
            search_paths = []
            if base.exists():
                _collect_entity_dirs(base, search_paths)
        else:
            print(f"Warning: Unknown collection '{collection}', searching all", file=sys.stderr)
            search_paths = _all_search_paths(life_dir)
    else:
        search_paths = _all_search_paths(life_dir)

    # search_paths now contains entity directories directly (each has items.json)
    entities = [p for p in search_paths if p.is_dir()]

    # Search in each entity
    all_results = []
    for entity_path in entities:
        results = search_in_entity(entity_path, query_terms)
        all_results.extend(results)

    # Sort by score (descending)
    all_results.sort(key=lambda x: x[0], reverse=True)

    # Format results
    formatted_results = []
    for score, fact, entity_name, entity_type in all_results[:limit]:
        formatted_results.append({
            'score': round(score, 2),
            'entity': entity_name,
            'entity_type': entity_type,
            'fact_id': fact.get('id'),
            'fact': fact.get('fact'),
            'category': fact.get('category'),
            'timestamp': fact.get('timestamp'),
            'lastAccessed': fact.get('lastAccessed'),
            'accessCount': fact.get('accessCount', 0)
        })

    return formatted_results

def _all_search_paths(life_dir: Path) -> List[Path]:
    """
    Recursively discover entity directories under projects/, areas/, resources/.
    An entity directory is one that contains items.json.
    This matches the TypeScript discoverEntities() recursive scan behavior.
    """
    entity_dirs = []
    for top_level in ['projects', 'areas', 'resources']:
        base = life_dir / top_level
        if not base.exists():
            continue
        _collect_entity_dirs(base, entity_dirs)
    return entity_dirs


def _collect_entity_dirs(directory: Path, result: List[Path]):
    """Recursively collect directories that contain items.json."""
    if not directory.is_dir():
        return
    for child in directory.iterdir():
        if not child.is_dir():
            continue
        if (child / 'items.json').exists():
            result.append(child)
        else:
            # Nested directory (e.g. areas/people/, areas/systems/) — recurse
            _collect_entity_dirs(child, result)

def print_results(results: List[Dict], query: str):
    """Print results in a human-readable format."""
    if not results:
        print(f"No results found for: {query}")
        return

    print(f"Search results for: '{query}'")
    print(f"{'=' * 80}")
    print(f"Found {len(results)} fact(s)\n")

    for i, result in enumerate(results, 1):
        print(f"{i}. [{result['entity']}] {result['fact_id']} (score: {result['score']})")
        print(f"   {result['fact']}")
        print(f"   Category: {result['category']} | Type: {result['entity_type']}")
        print(f"   Access: {result['accessCount']}x | Last: {result['lastAccessed']}")
        print()

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Search facts in PARA knowledge graph")
    parser.add_argument('query', type=str, help="Search query (keywords)")
    parser.add_argument('--limit', type=int, default=DEFAULT_LIMIT, help=f"Max results (default: {DEFAULT_LIMIT})")
    parser.add_argument('--collection', type=str, choices=['projects', 'people', 'companies', 'resources', 'systems', 'events'], help="Filter by collection")
    parser.add_argument('--json', action='store_true', help="Output JSON instead of human-readable")
    parser.add_argument('--life-dir', type=str, required=True, help="Root directory of the PARA knowledge base")

    args = parser.parse_args()
    life_dir = Path(args.life_dir)

    if not life_dir.exists():
        print(f"Error: life directory does not exist: {life_dir}", file=sys.stderr)
        sys.exit(1)

    results = search_facts(args.query, life_dir, collection=args.collection, limit=args.limit)

    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        print_results(results, args.query)

if __name__ == "__main__":
    main()
