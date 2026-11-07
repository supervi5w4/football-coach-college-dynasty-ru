"""Render the translator; optionally build a patch from a user's original ASAR."""
import argparse
import hashlib
import json
import re
import shutil
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha(data):
    return hashlib.sha256(data).hexdigest().upper()


def render():
    literals = json.loads((ROOT / 'src/literals.json').read_text(encoding='utf-8'))
    templates = json.loads((ROOT / 'src/templates.json').read_text(encoding='utf-8'))
    for source, translated in templates:
        if sorted(re.findall(r'\{\d+\}', source)) != sorted(re.findall(r'\{\d+\}', translated)):
            raise ValueError(f'Placeholder mismatch: {source}')
    engine = (ROOT / 'src/fccd-ru.js').read_text(encoding='utf-8')
    for marker in ('__TRANSLATIONS__', '__TEMPLATE_TRANSLATIONS__'):
        if engine.count(marker) != 1:
            raise ValueError(f'Expected exactly one {marker}')
    script = engine.replace('__TRANSLATIONS__', json.dumps(literals, ensure_ascii=False, indent=2))
    script = script.replace('__TEMPLATE_TRANSLATIONS__', json.dumps(templates, ensure_ascii=False, indent=2))
    target = ROOT / 'build/fccd-ru.js'
    target.parent.mkdir(exist_ok=True)
    target.write_bytes(script.encode('utf-8'))
    print(f'Rendered {len(literals)} literals and {len(templates)} templates.')
    return script.encode('utf-8')


def build_archive(path, script):
    release = json.loads((ROOT / 'release-manifest.json').read_text(encoding='utf-8'))
    original = path.read_bytes()
    if sha(original) != release['original']:
        raise ValueError('Unsupported ASAR. Use the original backup of game 1.6.5, build 19732424.')
    _, header_size, _, json_size = struct.unpack_from('<4I', original)
    offset = 8 + header_size
    index = json.loads(original[16:16 + json_size])
    renderer = index['files']['dist']['files']['renderer']['files']
    item = renderer['index.html']
    start = offset + int(item['offset'])
    html = original[start:start + item['size']]
    if b'<html ' not in html or b'</head>' not in html:
        raise ValueError('Unexpected index.html')
    html = html.replace(b'<html ', b'<html lang="ru" ', 1)
    html = html.replace(b'</head>', b'<script defer src="./fccd-ru.js"></script></head>', 1)
    tail = bytearray()
    for name, content in (('index.html', html), ('fccd-ru.js', script)):
        renderer[name] = {'size': len(content), 'offset': str(len(original) - offset + len(tail))}
        tail.extend(content)
    encoded = json.dumps(index, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    padding = b'\0' * (-len(encoded) % 4)
    payload = 4 + len(encoded) + len(padding)
    header = struct.pack('<4I', 4, payload + 4, payload, len(encoded)) + encoded + padding
    digest = sha(header + original[offset:] + tail)
    manifest = dict(release, patched=digest, dataOffset=offset, header=sha(header), tail=sha(tail))
    target = ROOT / 'dist' / ('FCCD-RU-' + release['version'])
    target.mkdir(parents=True, exist_ok=True)
    for p in (ROOT / 'installer').iterdir():
        if p.is_file():
            shutil.copy2(p, target / p.name)
    (target / 'header.bin').write_bytes(header)
    (target / 'tail.bin').write_bytes(tail)
    (target / 'patch.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    shutil.make_archive(str(target), 'zip', target.parent, target.name)
    print(f'Built {target.name}. Patched ASAR SHA-256: {digest}')
    if digest != release['patched']:
        print('Sources differ from the published release. Retest before distributing this build.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('original_asar', nargs='?', type=Path)
    args = parser.parse_args()
    rendered = render()
    if args.original_asar:
        build_archive(args.original_asar, rendered)
