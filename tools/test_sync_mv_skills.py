"""Check distribution resources, drift, links and portable skill text."""
import contextlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sync_mv_skills', Path(__file__).with_name('sync_mv_skills.py'))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root/'source'
        self.skill = self.source/'mv-demo'
        (self.skill/'references').mkdir(parents=True)
        (self.skill/'SKILL.md').write_text('---\nname: mv-demo\ndescription: demo\n---\n[guide](references/demo.md)\n## この環境でのパックの場所\nC:/Users/private\n', encoding='utf8')
        (self.skill/'references/demo.md').write_text('Reusable guide\n', encoding='utf8')
        self.dest = [self.root/'a', self.root/'b']

    def run_sync(self, mode):
        with patch.object(sync, 'SOURCE', self.source), patch.object(sync, 'DESTINATIONS', self.dest), patch('sys.argv', ['sync', mode]), contextlib.redirect_stdout(io.StringIO()):
            return sync.main()

    def test_copies_resources_and_removes_local_footer(self):
        self.assertEqual(self.run_sync('--write'), 0)
        self.assertEqual(self.run_sync('--check'), 0)
        for dest in self.dest:
            self.assertEqual((dest/'mv-demo/references/demo.md').read_text(), 'Reusable guide\n')
            self.assertNotIn('C:/Users/private', (dest/'mv-demo/SKILL.md').read_text(encoding='utf8'))

    def test_resource_drift_detected_and_repaired(self):
        self.run_sync('--write')
        (self.dest[0]/'mv-demo/references/demo.md').write_text('changed')
        self.assertEqual(self.run_sync('--check'), 1)
        self.assertEqual(self.run_sync('--write'), 0)
        self.assertEqual(self.run_sync('--check'), 0)

    def test_missing_relative_reference_is_rejected(self):
        (self.skill/'references/demo.md').write_text('[missing](missing.md)')
        self.assertEqual(self.run_sync('--check'), 1)

    def test_orphan_resource_is_reported_without_deletion(self):
        self.run_sync('--write')
        extra = self.dest[0]/'mv-demo/references/user-note.md'
        extra.write_text('keep')
        self.assertEqual(self.run_sync('--check'), 1)
        self.assertEqual(self.run_sync('--write'), 1)
        self.assertTrue(extra.exists())

    def test_invalid_identity_is_rejected(self):
        (self.skill/'SKILL.md').write_text('---\nname: wrong\n---\n')
        self.assertEqual(self.run_sync('--check'), 1)

if __name__ == '__main__':
    unittest.main()
