#!/usr/bin/env python3
"""Builds data/maxroll-data.json, the table that turns a maxroll planner item
into readable modifier lines.

Maxroll stores items as internal stat ids and numbers, "base_maximum_life": 90,
with no display text anywhere in the payload. The text lives in the planner's
own game data, which is a 45 MB blob that cannot be fetched at runtime, so the
part covering items is distilled here and shipped with the extension.

Re-run when a league changes the mod pool:

    curl -s https://assets-ng.maxroll.gg/poeplanner/game/data.min.json -o data.min.json
    python3 tools/build-maxroll-data.py data.min.json
"""
import json
import sys

EQUIPPABLE = (
    'Metadata/Items/Armours', 'Metadata/Items/Weapons', 'Metadata/Items/Amulets',
    'Metadata/Items/Rings', 'Metadata/Items/Belts', 'Metadata/Items/Flasks',
    'Metadata/Items/Quivers', 'Metadata/Items/Jewels', 'Metadata/Items/Tinctures',
)

# Domains whose mods can land on an item the player equips
ITEM_DOMAINS = {
    'item', 'crafted', 'flask', 'base_jewel', 'abyss_jewel', 'affliction_jewel',
    'chest', 'delve', 'veiled', 'unveiled', 'synthesis_a', 'tincture',
}


def stat_ids_on_items(src):
    ids = set()
    for mod in src['mods'].values():
        if mod.get('domain') not in ITEM_DOMAINS:
            continue
        stats = mod.get('stats')
        if isinstance(stats, list):
            for entry in stats:
                if isinstance(entry, dict) and 'id' in entry:
                    ids.add(entry['id'])
                elif isinstance(entry, str):
                    ids.add(entry)
        elif isinstance(stats, dict):
            ids.update(stats.keys())
    return ids


def build_stats(src, allowed):
    # Blocks are contextual and several describe the same stat id differently.
    # "base_cast_speed_+%" is "X% increased Cast Speed" on an item and "Monsters
    # have X% increased Cast Speed" in a map, so the item-facing blocks are
    # applied first and everything else only fills gaps.
    priority = {'global': 0, 'advanced_mod': 1}
    blocks = sorted(
        src['translations'],
        key=lambda b: priority.get(b.get('name'), 2),
    )

    table = {}
    for block in blocks:
        for entry in block.get('data', []):
            ids = entry.get('ids') or []
            english = entry.get('English') or []
            if not ids or not english:
                continue
            if not all(i in allowed for i in ids):
                continue
            variants = []
            for variant in english:
                text = variant.get('string')
                if text is None:
                    continue
                # index_handlers matter: "negate" alone covers thousands of
                # entries, and dropping it prints reduced rolls as increased
                variants.append([
                    variant.get('condition') or [],
                    text,
                    variant.get('format') or [],
                    variant.get('index_handlers') or [],
                ])
            if variants:
                table.setdefault('\t'.join(ids), variants)
    return table


def build_bases(src):
    bases = {}
    for path, item in src['items'].items():
        if not isinstance(item, dict):
            continue
        if not path.startswith(EQUIPPABLE):
            continue
        name = item.get('name')
        if not name:
            continue
        bases[path] = [name, item.get('item_class') or '']
    return bases


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else 'data.min.json'
    with open(source) as handle:
        src = json.load(handle)

    allowed = stat_ids_on_items(src)

    # A handful of unique mods interpolate a gem name by index rather than a
    # number. The lookups are a few KB each, so they ride along.
    def names(key, field):
        return [(e or {}).get(field) if isinstance(e, dict) else None
                for e in src.get(key, [])]

    # Planner gem ids are not the trade site's gem names, and the only reliable
    # bridge is the gem's own base_item entry
    gems = {}
    for gem_id, gem in src.get('gems', {}).items():
        base = gem.get('base_item') or {}
        name = base.get('display_name')
        if name:
            gems[gem_id] = [name, base.get('max_level') or 20]

    payload = {
        'stats': build_stats(src, allowed),
        'bases': build_bases(src),
        'gems': gems,
        'indexable': {
            'skill': names('indexable_skill_gems', 'name1'),
            'support': names('indexable_support_gems', 'name'),
            'non_active_support': names('indexable_non_active_support_gems', 'name'),
        },
    }

    raw = json.dumps(payload, separators=(',', ':'), ensure_ascii=False)
    with open('data/maxroll-data.json', 'w') as handle:
        handle.write(raw)

    print('stat entries:', len(payload['stats']))
    print('base types:', len(payload['bases']))
    print('size:', len(raw.encode()) // 1024, 'KB')


if __name__ == '__main__':
    main()
