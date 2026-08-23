# -*- mode: python ; coding: utf-8 -*-
# PACK-002 PyInstaller onedir spec for the clean-room fastwork AI Worker.
# Produces resources/worker/fastwork-ai-worker.exe (onedir runtime) with:
#   - console subsystem (stdin/stdout JSONL RPC v1 preserved)
#   - faiss + numpy native libs collected (targeted, no optional contrib tree)
#   - all fastwork_ai_worker submodules bundled (hidden imports)
#   - no system-Python / PYTHONPATH dependency at runtime
# No test/report/parity fixtures are bundled.
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, collect_submodules

SPEC_DIR = Path(SPECPATH)
SRC = (SPEC_DIR / ".." / "src").resolve()
ENTRY = SPEC_DIR / "worker_entry.py"

# faiss: collect its native DLL + _swigfaiss.pyd only (avoid faiss.contrib which
# pulls torch/onnx). numpy is handled by PyInstaller's built-in hook-numpy.
faiss_binaries = collect_dynamic_libs("faiss")
faiss_datas = collect_data_files("faiss")
worker_hidden = collect_submodules("fastwork_ai_worker")

a = Analysis(
    [str(ENTRY)],
    pathex=[str(SRC)],
    binaries=faiss_binaries,
    datas=faiss_datas,
    hiddenimports=worker_hidden + ["faiss"],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "pytest", "unittest", "torch", "onnx", "pandas", "sklearn", "scipy",
        "matplotlib", "nltk", "PyQt5", "pygame", "sphinx", "tables", "dask",
        "distributed", "IPython", "jupyter", "PIL", "cv2",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="fastwork-ai-worker",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="worker",
)
