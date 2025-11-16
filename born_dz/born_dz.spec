# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\born_dz', 'born_dz'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\website', 'website'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\user', 'user'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\chain', 'chain'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\customer', 'customer'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\KDS', 'KDS'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\manager', 'manager'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\media', 'media'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\menu', 'menu'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\order', 'order'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\POS', 'POS'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\restaurant', 'restaurant'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\static', 'static'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\staticfiles', 'staticfiles'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\terminal', 'terminal'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\templates', 'templates'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\static', 'static'), ('C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\db.sqlite3', '.')]
binaries = []
hiddenimports = []
tmp_ret = collect_all('django')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['C:\\Users\\HoumameLachache\\Documents\\POS-APP\\born_dz\\manage.py'],
    pathex=[],
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
