"""Compatibility shim: canonical index policy lives in index_refresh.py."""
from .index_refresh import index_signal, refresh_for  # noqa: F401
