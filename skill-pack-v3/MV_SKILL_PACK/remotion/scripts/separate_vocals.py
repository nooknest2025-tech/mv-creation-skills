"""Run an already installed/cached Demucs offline; never fetch weights."""
import runpy
import socket
import sys


def offline(*_args, **_kwargs):
    raise RuntimeError('自動分離のモデルがローカルにないか、ネットワークが必要です')


socket.create_connection = offline
socket.socket.connect = offline
socket.socket.connect_ex = offline
sys.argv = ['demucs', '--two-stems', 'vocals', '--out', sys.argv[2], sys.argv[1]]
runpy.run_module('demucs', run_name='__main__')
