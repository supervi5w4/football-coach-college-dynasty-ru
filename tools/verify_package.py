"""Verify the published ZIP, its manifest, and its generated translator."""
import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'release-manifest.json').read_text(encoding='utf-8'))
name = 'FCCD-RU-' + manifest['version']
archive = ROOT / 'packages' / (name + '.zip')
expected = {'header.bin', 'tail.bin', 'patch.json', 'Patch.ps1', 'INSTALL.cmd',
            'RESTORE.cmd', 'STATUS.cmd', 'README.txt', 'TERMINOLOGY.md'}
with zipfile.ZipFile(archive) as z:
    actual = {p for p in z.namelist() if not p.endswith('/')}
    assert actual == {name + '/' + p for p in expected}, 'Unexpected package contents'
    read = lambda p: z.read(name + '/' + p)
    assert json.loads(read('patch.json')) == manifest, 'Release manifest mismatch'
    for filename, key in (('header.bin', 'header'), ('tail.bin', 'tail')):
        assert hashlib.sha256(read(filename)).hexdigest().upper() == manifest[key], filename
    assert read('tail.bin').endswith((ROOT / 'build/fccd-ru.js').read_bytes()), 'Translator differs from release'
    for filename in expected - {'header.bin', 'tail.bin', 'patch.json'}:
        assert read(filename) == (ROOT / 'installer' / filename).read_bytes(), filename
checksums = (ROOT / 'packages/SHA256SUMS.txt').read_text(encoding='utf-8').strip().split()
assert checksums == [hashlib.sha256(archive.read_bytes()).hexdigest(), archive.name]
print('Release ZIP, source translator, installer, manifest, and SHA-256 verified.')
