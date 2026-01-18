# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [('/Users/houmamelachache/Documents/POS-APP/born_dz/born_dz', 'born_dz'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/user', 'user'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/chain', 'chain'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/customer', 'customer'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/KDS', 'KDS'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/manager', 'manager'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/media', 'media'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/menu', 'menu'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/order', 'order'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/POS', 'POS'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/restaurant', 'restaurant'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/terminal', 'terminal'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/website', 'website'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/templates', 'templates'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/static', 'static'), ('/Users/houmamelachache/Documents/POS-APP/born_dz/db.sqlite3', '.')]
binaries = []
hiddenimports = []
tmp_ret = collect_all('django')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('daphne')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('channels')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('channels_redis')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['/Users/houmamelachache/Documents/POS-APP/born_dz/run_daphne.py'],
    pathex=['/Users/houmamelachache/Documents/POS-APP/born_dz/user', '/Users/houmamelachache/Documents/POS-APP/born_dz/chain', '/Users/houmamelachache/Documents/POS-APP/born_dz/customer', '/Users/houmamelachache/Documents/POS-APP/born_dz/KDS', '/Users/houmamelachache/Documents/POS-APP/born_dz/manager', '/Users/houmamelachache/Documents/POS-APP/born_dz/media', '/Users/houmamelachache/Documents/POS-APP/born_dz/menu', '/Users/houmamelachache/Documents/POS-APP/born_dz/order', '/Users/houmamelachache/Documents/POS-APP/born_dz/POS', '/Users/houmamelachache/Documents/POS-APP/born_dz/restaurant', '/Users/houmamelachache/Documents/POS-APP/born_dz/terminal', '/Users/houmamelachache/Documents/POS-APP/born_dz/website'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='born_dz',
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
    name='born_dz',
)
