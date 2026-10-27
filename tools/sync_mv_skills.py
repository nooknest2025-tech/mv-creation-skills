"""Maintain distributable MV skills from the workspace's canonical skill sources."""
from pathlib import Path
import argparse
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'skill-pack-v3' / 'MV_SKILL_PACK'
SOURCE = ROOT / '.agents' / 'skills'
DESTINATIONS = [PACK / '.agents' / 'skills', PACK / 'skills']

def distributable(text):
    # Personal installation paths belong only to the installed workspace sources.
    text = text.split('## この環境でのパックの場所')[0].rstrip()
    return text + '\n\n## パック内での実行\n\nこのファイルは配布用コピー。編集原本は管理用ワークスペースの `.agents/skills/`。制作時は、この配布パックのルートにある `AGENTS.md` を読み、コマンドは `remotion/` で実行する。本文の `input/`、`projects/`、`docs/`、`gen/` はパックのルートを基準に解決する。\n'

def skill_files(folder):
    return sorted(p for p in folder.rglob('*') if p.is_file()
                  and '__pycache__' not in p.parts and p.suffix != '.pyc')

def check_links(source, errors):
    text = source.read_text(encoding='utf-8-sig')
    for link in re.findall(r'\]\(([^)]+)\)', text):
        if link.startswith(('https://', 'http://', '#', 'mailto:')):
            continue
        relative = link.split('#', 1)[0]
        if relative and not (source.parent / relative).resolve().is_file():
            errors.append(f'Broken skill link: {source}: {link}')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    sources = sorted(SOURCE.glob('mv-*/SKILL.md'))
    if not sources:
        parser.error('No canonical MV skill files found')
    errors = []
    resource_count = 0
    for source in sources:
        text = source.read_text(encoding='utf-8-sig')
        if not text.startswith('---\n') or not re.search(r'^name: ' + re.escape(source.parent.name) + r'\s*$', text, re.M):
            errors.append(f'Invalid skill identity: {source}')
            continue
        resources = skill_files(source.parent)
        for resource in resources:
            if resource.is_symlink():
                errors.append(f'Symlink is not distributable: {resource}')
            if resource.suffix == '.md':
                check_links(resource, errors)
        expected = distributable(text)
        for destination in DESTINATIONS:
            target = destination / source.parent.name / 'SKILL.md'
            if args.write:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(expected, encoding='utf-8', newline='\n')
            elif not target.is_file() or target.read_text(encoding='utf-8-sig') != expected:
                errors.append(f'Outdated distribution: {target}')
            for resource in resources:
                if resource == source or resource.is_symlink():
                    continue
                relative = resource.relative_to(source.parent)
                copied = target.parent / relative
                if args.write:
                    copied.parent.mkdir(parents=True, exist_ok=True)
                    copied.write_bytes(resource.read_bytes())
                elif not copied.is_file() or copied.read_bytes() != resource.read_bytes():
                    errors.append(f'Outdated resource: {copied}')
                resource_count += 1
            expected_files = {p.relative_to(source.parent) for p in resources}
            if target.parent.exists():
                for copied in skill_files(target.parent):
                    if copied.relative_to(target.parent) not in expected_files:
                        errors.append(f'Distribution has no canonical resource: {copied}')
    for destination in DESTINATIONS:
        source_names = {p.parent.name for p in sources}
        for target in destination.glob('mv-*/SKILL.md'):
            if target.parent.name not in source_names:
                errors.append(f'Distribution has no canonical source: {target}')
    if errors:
        print('\n'.join(errors))
        return 1
    print(f'{len(sources)} canonical skills; {len(sources) * len(DESTINATIONS)} distribution skill files + {resource_count} resources; relative links OK; ' + ('synchronized' if args.write else 'no drift'))
    return 0

if __name__ == '__main__':
    sys.exit(main())
