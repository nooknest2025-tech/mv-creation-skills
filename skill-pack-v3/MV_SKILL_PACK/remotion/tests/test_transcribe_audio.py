"""Integration regressions for local packages and the minimal FFmpeg decoder."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
import wave

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'transcribe.py'
spec = importlib.util.spec_from_file_location('transcribe', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
import numpy as np


class DecodeAudioTests(unittest.TestCase):
    def test_stereo_48k_in_unicode_path_decodes_to_mono_16k(self):
        with tempfile.TemporaryDirectory(prefix='mv audio ') as tmp:
            path = Path(tmp) / '音声 テスト.wav'
            t = np.arange(48000) / 48000
            tone = (np.sin(2 * np.pi * 440 * t) * 12000).astype('<i2')
            with wave.open(str(path), 'wb') as out:
                out.setparams((2, 2, 48000, 0, 'NONE', 'not compressed'))
                out.writeframes(np.column_stack([tone, tone]).tobytes())
            audio = module.load_audio(str(path))
            self.assertEqual(audio.dtype, np.float32)
            self.assertEqual(audio.ndim, 1)
            self.assertEqual(len(audio), 16000)
            self.assertGreater(float(np.sqrt(np.mean(audio ** 2))), .2)
            self.assertLess(float(np.max(np.abs(audio))), .5)

    def test_bad_input_reports_decode_failure_not_missing_whisper(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'bad.wav'
            path.write_bytes(b'not audio')
            with self.assertRaisesRegex(RuntimeError, '音声読み込みに失敗'):
                module.load_audio(str(path))

    def test_model_cache_override_is_preserved(self):
        # Importing the helper must respect a caller-selected cache.
        from unittest.mock import patch
        with patch.dict(os.environ, {'HF_HOME': 'custom-cache'}):
            spec.loader.exec_module(module)
            self.assertEqual(os.environ['HF_HOME'], 'custom-cache')


if __name__ == '__main__':
    unittest.main()
